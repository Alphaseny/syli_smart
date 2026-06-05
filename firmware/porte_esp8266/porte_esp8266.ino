/*
 * Smart Bureau — Porte ESP8266
 * Librairies : PubSubClient, ArduinoJson, Servo
 *
 * Wiring :
 *   Servo signal → D2 (GPIO4)
 *   Buzzer       → D5 (GPIO14)  [optionnel]
 */

#include <ESP8266WiFi.h>
#include <WiFiClientSecure.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>
#include <Servo.h>

// ─── À REMPLIR ────────────────────────────────────────────────────────────────
const char* WIFI_SSID     = "NOM_DE_TON_WIFI";
const char* WIFI_PASSWORD = "MOT_DE_PASSE_WIFI";

const char* MQTT_HOST     = "f3bd9e73b3884e43978a2f3cb1e64075.s1.eu.hivemq.cloud";
const int   MQTT_PORT     = 8883;
const char* MQTT_USER     = "syli_smart";
const char* MQTT_PASS     = "Alphasenycamara224";

const int   ENTREPRISE_ID = 1;
const int   BUREAU_ID     = 1;
const char* IDENTIFIANT   = "porte_entree_01";  // identifiant_mqtt dans l'app

const int   DUREE_OUVERTURE_MS = 5000;  // doit correspondre à duree_ouverture_sec × 1000
// ──────────────────────────────────────────────────────────────────────────────

const int PIN_SERVO  = D2;
const int PIN_BUZZER = D5;

const int ANGLE_OUVERT    = 90;
const int ANGLE_VERROUILLE = 0;

Servo servo;
WiFiClientSecure wifiClient;
PubSubClient mqtt(wifiClient);

char topicCommande[120];
char topicStatut[120];

bool porteOuverte = false;
unsigned long heureOuverture = 0;

void publierStatut(const char* etatVerrou) {
  StaticJsonDocument<128> doc;
  doc["etat"]        = "actif";
  doc["etat_verrou"] = etatVerrou;
  char buf[128];
  serializeJson(doc, buf);
  mqtt.publish(topicStatut, buf, true);
}

void ouvrirPorte() {
  servo.write(ANGLE_OUVERT);
  porteOuverte = true;
  heureOuverture = millis();
  publierStatut("ouvert");
  Serial.println("Porte ouverte");
  // Bip d'accès accordé
  tone(PIN_BUZZER, 1000, 200);
}

void verrouillerPorte() {
  servo.write(ANGLE_VERROUILLE);
  porteOuverte = false;
  publierStatut("verrouille");
  Serial.println("Porte verrouillée");
}

void onMessage(char* topic, byte* payload, unsigned int length) {
  StaticJsonDocument<256> doc;
  if (deserializeJson(doc, payload, length)) return;

  const char* action = doc["action"];
  if (!action) return;

  if (strcmp(action, "ouvrir") == 0) {
    ouvrirPorte();
  } else if (strcmp(action, "fermer") == 0) {
    verrouillerPorte();
  }
}

void connecterWifi() {
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  while (WiFi.status() != WL_CONNECTED) { delay(500); }
  Serial.println("WiFi connecté: " + WiFi.localIP().toString());
}

void connecterMqtt() {
  while (!mqtt.connected()) {
    String cid = "porte_" + String(IDENTIFIANT);
    if (mqtt.connect(cid.c_str(), MQTT_USER, MQTT_PASS)) {
      mqtt.subscribe(topicCommande);
      publierStatut("verrouille");
      Serial.println("MQTT connecté.");
    } else {
      delay(3000);
    }
  }
}

void setup() {
  Serial.begin(115200);
  pinMode(PIN_BUZZER, OUTPUT);

  servo.attach(PIN_SERVO);
  servo.write(ANGLE_VERROUILLE);

  snprintf(topicCommande, sizeof(topicCommande),
           "smartbureau/%d/%d/%s/commande", ENTREPRISE_ID, BUREAU_ID, IDENTIFIANT);
  snprintf(topicStatut, sizeof(topicStatut),
           "smartbureau/%d/%d/%s/statut", ENTREPRISE_ID, BUREAU_ID, IDENTIFIANT);

  wifiClient.setInsecure();
  mqtt.setServer(MQTT_HOST, MQTT_PORT);
  mqtt.setCallback(onMessage);

  connecterWifi();
  connecterMqtt();
}

void loop() {
  if (!mqtt.connected()) connecterMqtt();
  mqtt.loop();

  // Refermer automatiquement après DUREE_OUVERTURE_MS
  if (porteOuverte && (millis() - heureOuverture >= DUREE_OUVERTURE_MS)) {
    verrouillerPorte();
  }
}
