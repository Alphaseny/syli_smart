/**
 * Smart Bureau — Firmware ESP8266
 * ================================
 * Contrôleur IoT pour un bureau unique.
 *
 * Matériel géré par cette carte :
 *   - 1 servo-moteur  → serrure de porte    (GPIO D2 / GPIO4)
 *   - 1 relais        → éclairage (lampe)   (GPIO D1 / GPIO5)
 *   - 1 capteur PIR   → détecteur présence  (GPIO D5 / GPIO14)
 *   - 1 capteur MQ-2  → fumée / gaz         (A0)
 *   - 1 DHT11/22      → température/humidité (GPIO D6 / GPIO12)
 *   - 1 buzzer        → alarme sonore        (GPIO D7 / GPIO13)
 *
 * Topics MQTT :
 *   Subscribe → smartbureau/{ENT_ID}/{BUREAU_ID}/{ID_xxx}/commande
 *   Publish   → smartbureau/{ENT_ID}/{BUREAU_ID}/{ID_xxx}/donnee
 *   Publish   → smartbureau/{ENT_ID}/{BUREAU_ID}/{ID_xxx}/statut
 *   Publish   → smartbureau/{ENT_ID}/{BUREAU_ID}/{ID_xxx}/alerte
 *
 * Bibliothèques requises (Arduino Library Manager) :
 *   - PubSubClient    (Nick O'Leary)
 *   - ArduinoJson     (Benoit Blanchon) v6+
 *   - Servo           (inclus dans l'IDE)
 *   - DHT sensor library (Adafruit) + Adafruit Unified Sensor
 *
 * Configuration : modifiez la section CONFIG ci-dessous avant de flasher.
 */

#include <ESP8266WiFi.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>
#include <Servo.h>
#include <DHT.h>

// ============================================================================
//  CONFIG — à personnaliser avant de flasher
// ============================================================================

// Réseau Wi-Fi
#define WIFI_SSID      "NomDuReseau"
#define WIFI_PASSWORD  "MotDePasseWifi"

// Broker MQTT (IP locale du PC qui fait tourner le backend)
#define MQTT_BROKER    "192.168.1.100"
#define MQTT_PORT      1883
#define MQTT_USER      ""            // laisser vide si pas d'authentification
#define MQTT_PASSWORD  ""

// Identifiants du bureau (doivent correspondre à la base de données)
#define ENT_ID         "1"
#define BUREAU_ID      "1"

// Identifiants MQTT de chaque équipement (identifiant_mqtt dans la BDD)
#define ID_PORTE       "porte-bureau-1"
#define ID_LAMPE       "lampe-bureau-1"
#define ID_PIR         "pir-bureau-1"
#define ID_MQ2         "mq2-bureau-1"
#define ID_TEMP        "temp-bureau-1"

// Broches
#define PIN_SERVO      4   // D2
#define PIN_RELAY      5   // D1  (LOW = relais fermé / lampe allumée)
#define PIN_PIR        14  // D5
#define PIN_MQ2        A0
#define PIN_DHT        12  // D6
#define PIN_BUZZER     13  // D7

#define DHT_TYPE       DHT11   // DHT11 ou DHT22

// Seuils d'alerte locaux (confirmés aussi côté backend)
#define SEUIL_MQ2_PPM  300
#define SEUIL_TEMP_C   40.0f

// Durées (ms)
#define INTERVALLE_CAPTEURS_MS  10000UL   // lecture toutes les 10 s
#define DUREE_SERVO_OUVERTE_MS  5000UL    // temps avant refermeture auto
#define RECONNECT_DELAY_MS      5000UL

// ============================================================================
//  Constantes de topics
// ============================================================================

static const char* BASE = "smartbureau/" ENT_ID "/" BUREAU_ID "/";

static const char TOPIC_PORTE_CMD[]  = "smartbureau/" ENT_ID "/" BUREAU_ID "/" ID_PORTE "/commande";
static const char TOPIC_LAMPE_CMD[]  = "smartbureau/" ENT_ID "/" BUREAU_ID "/" ID_LAMPE "/commande";
static const char TOPIC_CAM_CMD[]    = "smartbureau/" ENT_ID "/" BUREAU_ID "/+/commande";

// ============================================================================
//  Objets globaux
// ============================================================================

WiFiClient   wifiClient;
PubSubClient mqtt(wifiClient);
Servo        servo;
DHT          dht(PIN_DHT, DHT_TYPE);

// État local
bool    porteOuverte    = false;
bool    lampeAllumee    = false;
bool    pirPrecedent    = false;
bool    alarmeActive    = false;
unsigned long derniereLectureCapteurs = 0;
unsigned long tempsOuverturePorte     = 0;

// ============================================================================
//  Helpers — construction de topics
// ============================================================================

String topic(const char* identifiant, const char* suffixe) {
  return String("smartbureau/" ENT_ID "/" BUREAU_ID "/") + identifiant + "/" + suffixe;
}

// ============================================================================
//  Wi-Fi
// ============================================================================

void connecterWifi() {
  Serial.print("[WiFi] Connexion à ");
  Serial.println(WIFI_SSID);
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  int tentatives = 0;
  while (WiFi.status() != WL_CONNECTED && tentatives < 30) {
    delay(500);
    Serial.print(".");
    tentatives++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println();
    Serial.print("[WiFi] Connecté — IP: ");
    Serial.println(WiFi.localIP());
  } else {
    Serial.println("\n[WiFi] ÉCHEC — redémarrage dans 5s");
    delay(5000);
    ESP.restart();
  }
}

// ============================================================================
//  MQTT — Connexion et réabonnements
// ============================================================================

void abonnerTopics() {
  mqtt.subscribe(TOPIC_PORTE_CMD, 1);
  mqtt.subscribe(TOPIC_LAMPE_CMD, 1);
  // Abonnement générique pour les futures caméras / commandes système
  mqtt.subscribe((String(BASE) + "+/commande").c_str(), 1);
  Serial.println("[MQTT] Topics souscrits.");
}

bool connecterMqtt() {
  String clientId = String("smartbureau-esp-") + String(ESP.getChipId(), HEX);

  bool ok;
  if (strlen(MQTT_USER) > 0) {
    ok = mqtt.connect(clientId.c_str(), MQTT_USER, MQTT_PASSWORD);
  } else {
    ok = mqtt.connect(clientId.c_str());
  }

  if (ok) {
    Serial.println("[MQTT] Connecté au broker.");
    abonnerTopics();
    publierStatut(ID_PORTE, "actif");
    publierStatut(ID_LAMPE, "actif");
  } else {
    Serial.print("[MQTT] Échec, rc=");
    Serial.println(mqtt.state());
  }
  return ok;
}

void gererReconnexion() {
  static unsigned long derniereTentative = 0;
  if (millis() - derniereTentative < RECONNECT_DELAY_MS) return;
  derniereTentative = millis();

  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("[WiFi] Déconnecté — reconnexion...");
    connecterWifi();
  }
  if (!mqtt.connected()) {
    Serial.println("[MQTT] Déconnecté — reconnexion...");
    connecterMqtt();
  }
}

// ============================================================================
//  Publication helpers
// ============================================================================

void publierJson(const char* identifiant, const char* suffixe, JsonDocument& doc) {
  String t = topic(identifiant, suffixe);
  String payload;
  serializeJson(doc, payload);
  mqtt.publish(t.c_str(), payload.c_str(), /*retain=*/false);
  Serial.print("[MQTT] → " + t + ": ");
  Serial.println(payload);
}

void publierStatut(const char* identifiant, const char* etat) {
  StaticJsonDocument<128> doc;
  doc["etat"] = etat;
  if (strcmp(identifiant, ID_PORTE) == 0)
    doc["etat_verrou"] = porteOuverte ? "ouvert" : "verrouille";
  if (strcmp(identifiant, ID_LAMPE) == 0)
    doc["etat_lumiere"] = lampeAllumee ? "allume" : "eteint";
  publierJson(identifiant, "statut", doc);
}

void publierAlerte(const char* identifiant, const char* type,
                   const char* niveau, const char* description) {
  StaticJsonDocument<256> doc;
  doc["type"]        = type;
  doc["niveau"]      = niveau;
  doc["description"] = description;
  publierJson(identifiant, "alerte", doc);
  Serial.print("[ALERTE] ");
  Serial.println(description);
}

// ============================================================================
//  Contrôle physique
// ============================================================================

void ouvrirPorte(int dureeSec) {
  Serial.println("[PORTE] Ouverture...");
  servo.write(90);           // 90° = ouvert (adapter selon le montage)
  porteOuverte = true;
  tempsOuverturePorte = millis();

  if (dureeSec > 0) {
    // La refermeture se fait dans loop() après dureeSec secondes
    // On mémorise la durée souhaitée via la variable globale
    tempsOuverturePorte = millis() + (unsigned long)dureeSec * 1000UL - DUREE_SERVO_OUVERTE_MS;
  }

  publierStatut(ID_PORTE, "actif");
}

void fermerPorte() {
  Serial.println("[PORTE] Fermeture...");
  servo.write(0);            // 0° = verrouillé
  porteOuverte = false;
  publierStatut(ID_PORTE, "actif");
}

void allumerLampe(int intensite) {
  // Pour un relais simple : LOW = allumé
  // Pour un relais PWM ou gradateur : utiliser analogWrite
  digitalWrite(PIN_RELAY, LOW);
  lampeAllumee = true;
  Serial.print("[LAMPE] Allumée — intensité: ");
  Serial.println(intensite);
  publierStatut(ID_LAMPE, "actif");
}

void eteindreLampe() {
  digitalWrite(PIN_RELAY, HIGH);
  lampeAllumee = false;
  Serial.println("[LAMPE] Éteinte.");
  publierStatut(ID_LAMPE, "actif");
}

void declencherAlarme(bool activer) {
  alarmeActive = activer;
  if (activer) {
    tone(PIN_BUZZER, 2000);
    Serial.println("[BUZZER] Alarme activée.");
  } else {
    noTone(PIN_BUZZER);
    Serial.println("[BUZZER] Alarme désactivée.");
  }
}

// ============================================================================
//  Traitement des commandes reçues via MQTT
// ============================================================================

void traiterCommandePorte(JsonDocument& doc) {
  const char* action   = doc["action"]   | "";
  int         dureeSec = doc["duree_sec"] | 5;

  if (strcmp(action, "ouvrir") == 0) {
    ouvrirPorte(dureeSec);
  } else if (strcmp(action, "fermer") == 0) {
    fermerPorte();
  } else {
    Serial.print("[PORTE] Action inconnue: ");
    Serial.println(action);
  }
}

void traiterCommandeLampe(JsonDocument& doc) {
  const char* action    = doc["action"]    | "";
  int         intensite = doc["intensite"] | 100;

  if (strcmp(action, "allumer") == 0) {
    allumerLampe(intensite);
  } else if (strcmp(action, "eteindre") == 0) {
    eteindreLampe();
  } else {
    Serial.print("[LAMPE] Action inconnue: ");
    Serial.println(action);
  }
}

// ============================================================================
//  Callback MQTT — réception des messages
// ============================================================================

void onMqttMessage(char* topicRaw, byte* payloadBytes, unsigned int length) {
  String t = String(topicRaw);
  String raw;
  for (unsigned int i = 0; i < length; i++) raw += (char)payloadBytes[i];

  Serial.print("[MQTT] ← ");
  Serial.print(t);
  Serial.print(": ");
  Serial.println(raw);

  StaticJsonDocument<512> doc;
  DeserializationError err = deserializeJson(doc, raw);
  if (err) {
    Serial.print("[MQTT] JSON invalide: ");
    Serial.println(err.c_str());
    return;
  }

  // Routage par identifiant extrait du topic
  // Format: smartbureau/{ent}/{bureau}/{identifiant}/commande
  int dernierSlash = t.lastIndexOf('/');
  int avantDernier = t.lastIndexOf('/', dernierSlash - 1);
  String identifiant = t.substring(avantDernier + 1, dernierSlash);

  if (identifiant == ID_PORTE) {
    traiterCommandePorte(doc);
  } else if (identifiant == ID_LAMPE) {
    traiterCommandeLampe(doc);
  } else {
    Serial.print("[MQTT] Identifiant non géré: ");
    Serial.println(identifiant);
  }
}

// ============================================================================
//  Lecture et publication des capteurs
// ============================================================================

void lireEtPublierMQ2() {
  int raw   = analogRead(PIN_MQ2);
  float ppm = raw * (1000.0f / 1023.0f);   // conversion linéaire approximative

  StaticJsonDocument<128> doc;
  doc["valeur"] = ppm;
  doc["unite"]  = "ppm";
  publierJson(ID_MQ2, "donnee", doc);

  if (ppm >= SEUIL_MQ2_PPM) {
    declencherAlarme(true);
    char desc[80];
    snprintf(desc, sizeof(desc), "MQ-2 : %.1f ppm — seuil %d dépassé", ppm, SEUIL_MQ2_PPM);
    publierAlerte(ID_MQ2, "gaz", "critique", desc);
  } else if (alarmeActive) {
    declencherAlarme(false);
  }
}

void lireEtPublierDHT() {
  float temp = dht.readTemperature();
  float hum  = dht.readHumidity();

  if (isnan(temp) || isnan(hum)) {
    Serial.println("[DHT] Erreur lecture capteur.");
    return;
  }

  StaticJsonDocument<128> doc;
  doc["temperature"] = temp;
  doc["humidite"]    = hum;
  doc["unite"]       = "°C";
  publierJson(ID_TEMP, "donnee", doc);

  if (temp >= SEUIL_TEMP_C) {
    char desc[80];
    snprintf(desc, sizeof(desc), "Température : %.1f°C — seuil %.0f°C dépassé", temp, SEUIL_TEMP_C);
    publierAlerte(ID_TEMP, "temperature", "eleve", desc);
  }
}

void lireEtPublierPIR() {
  bool mouvement = digitalRead(PIN_PIR) == HIGH;

  if (mouvement && !pirPrecedent) {
    Serial.println("[PIR] Mouvement détecté.");
    StaticJsonDocument<64> doc;
    doc["valeur"] = 1;
    doc["unite"]  = "bool";
    publierJson(ID_PIR, "donnee", doc);

    // Allumage automatique si mode_auto activé (géré côté backend)
    // Ici on publie juste l'événement; le backend ou l'app décide
  }

  if (!mouvement && pirPrecedent) {
    Serial.println("[PIR] Plus de mouvement.");
    StaticJsonDocument<64> doc;
    doc["valeur"] = 0;
    doc["unite"]  = "bool";
    publierJson(ID_PIR, "donnee", doc);
  }

  pirPrecedent = mouvement;
}

// ============================================================================
//  setup() & loop()
// ============================================================================

void setup() {
  Serial.begin(115200);
  Serial.println("\n=== Smart Bureau ESP8266 ===");

  // Broches
  pinMode(PIN_RELAY,  OUTPUT);
  pinMode(PIN_PIR,    INPUT);
  pinMode(PIN_BUZZER, OUTPUT);
  digitalWrite(PIN_RELAY,  HIGH);   // relais ouvert = lampe éteinte au démarrage
  noTone(PIN_BUZZER);

  // Servo
  servo.attach(PIN_SERVO);
  servo.write(0);   // porte verrouillée au démarrage

  // DHT
  dht.begin();

  // Wi-Fi + MQTT
  connecterWifi();
  mqtt.setServer(MQTT_BROKER, MQTT_PORT);
  mqtt.setCallback(onMqttMessage);
  mqtt.setBufferSize(512);
  connecterMqtt();

  Serial.println("[SETUP] Initialisation terminée.");
}

void loop() {
  // Maintenir les connexions actives
  if (!mqtt.connected() || WiFi.status() != WL_CONNECTED) {
    gererReconnexion();
  }
  mqtt.loop();

  unsigned long maintenant = millis();

  // Refermeture automatique de la porte après la durée configurée
  if (porteOuverte && maintenant >= tempsOuverturePorte + DUREE_SERVO_OUVERTE_MS) {
    fermerPorte();
  }

  // Lecture périodique des capteurs
  if (maintenant - derniereLectureCapteurs >= INTERVALLE_CAPTEURS_MS) {
    derniereLectureCapteurs = maintenant;
    lireEtPublierMQ2();
    lireEtPublierDHT();
    lireEtPublierPIR();
  }
}
