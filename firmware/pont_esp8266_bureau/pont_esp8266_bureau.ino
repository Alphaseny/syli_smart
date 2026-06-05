/*
 * ================================================================
 *  SMART BUREAU — ESP8266 — Pont WiFi BUREAU
 *  Ce code tourne sur l'ESP8266 (NodeMCU / Wemos D1 Mini)
 *
 *  Rôle : faire le lien entre HiveMQ (internet) et l'Arduino UNO
 *  Librairies : PubSubClient, ArduinoJson, ESP8266WiFi (inclus)
 *
 *  CÂBLAGE :
 *    ESP8266 D6 (RX/GPIO12) ← Arduino A2 → 10kΩ → [node] → 20kΩ → GND
 *    ESP8266 D7 (TX/GPIO13) → Arduino A1
 *    ESP8266 GND            ← Arduino GND
 * ================================================================
 */

#include <ESP8266WiFi.h>
#include <WiFiClientSecure.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>
#include <SoftwareSerial.h>

// ================================================================
//  À REMPLIR
// ================================================================
const char* WIFI_SSID     = "NOM_DE_TON_WIFI";       // ← ton WiFi bureau
const char* WIFI_PASSWORD = "MOT_DE_PASSE_WIFI";     // ← ton mot de passe WiFi

const char* MQTT_HOST     = "f3bd9e73b3884e43978a2f3cb1e64075.s1.eu.hivemq.cloud";
const int   MQTT_PORT     = 8883;
const char* MQTT_USER     = "syli_smart";
const char* MQTT_PASS     = "Alphasenycamara224";

// Ces valeurs doivent correspondre exactement à ce qui est dans l'app
const int   ENTREPRISE_ID = 1;         // ← ID entreprise dans l'app
const int   BUREAU_ID     = 2;         // ← ID du bureau dans l'app
const char* IDENTIFIANT   = "porte_bureau_01";  // ← identifiant_mqtt dans l'app
// ================================================================

SoftwareSerial arduinoSerial(D6, D7);  // RX=D6, TX=D7

WiFiClientSecure wifiClient;
PubSubClient     mqtt(wifiClient);

char tCommande[120];
char tStatut[120];

String tampon = "";

void construireTopics() {
  snprintf(tCommande, sizeof(tCommande), "smartbureau/%d/%d/%s/commande", ENTREPRISE_ID, BUREAU_ID, IDENTIFIANT);
  snprintf(tStatut,   sizeof(tStatut),   "smartbureau/%d/%d/%s/statut",   ENTREPRISE_ID, BUREAU_ID, IDENTIFIANT);
}

void publierStatut(const char* etatVerrou) {
  StaticJsonDocument<128> doc;
  doc["etat"]        = "actif";
  doc["etat_verrou"] = etatVerrou;
  char buf[128];
  serializeJson(doc, buf);
  mqtt.publish(tStatut, buf, true);
  Serial.print(F("MQTT statut: ")); Serial.println(etatVerrou);
}

// Reçoit une commande de l'app → la transmet à l'Arduino
void onMqttMessage(char* topic, byte* payload, unsigned int length) {
  StaticJsonDocument<256> doc;
  if (deserializeJson(doc, payload, length)) return;

  const char* action = doc["action"];
  if (!action) return;

  Serial.print(F("App → ")); Serial.println(action);

  if (strcmp(action, "ouvrir") == 0) {
    arduinoSerial.println("OUVRIR");

  } else if (strcmp(action, "fermer") == 0) {
    arduinoSerial.println("FERMER");
  }
}

// Reçoit les événements de l'Arduino → publie sur MQTT
void traiterMessageArduino(const String& ligne) {
  if (ligne.length() == 0 || ligne[0] != '{') return;

  StaticJsonDocument<256> doc;
  if (deserializeJson(doc, ligne)) return;

  const char* type = doc["type"];
  if (!type) return;

  Serial.print(F("Arduino → ")); Serial.println(ligne);

  if (strcmp(type, "porte") == 0) {
    const char* etat = doc["etat"] | "verrouille";
    publierStatut(etat);

  } else if (strcmp(type, "acces") == 0) {
    const char* res = doc["resultat"] | "inconnu";
    Serial.print(F("Acces: ")); Serial.println(res);
    // Le résultat (succes/echec/verrouillage) est loggué côté backend via le statut MQTT
  }
}

void connecterWifi() {
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.print(F("WiFi"));
  while (WiFi.status() != WL_CONNECTED) { delay(500); Serial.print('.'); }
  Serial.println(F(" OK : ") + WiFi.localIP().toString());
}

void connecterMqtt() {
  while (!mqtt.connected()) {
    Serial.print(F("MQTT..."));
    String cid = "esp_bureau_" + String(IDENTIFIANT);
    if (mqtt.connect(cid.c_str(), MQTT_USER, MQTT_PASS)) {
      mqtt.subscribe(tCommande);
      publierStatut("verrouille");
      Serial.println(F(" connecte"));
    } else {
      Serial.print(F(" echec rc=")); Serial.println(mqtt.state());
      delay(3000);
    }
  }
}

// ================================================================
//  SETUP
// ================================================================
void setup() {
  Serial.begin(115200);
  arduinoSerial.begin(9600);

  construireTopics();

  wifiClient.setInsecure();
  mqtt.setServer(MQTT_HOST, MQTT_PORT);
  mqtt.setCallback(onMqttMessage);
  mqtt.setBufferSize(512);

  connecterWifi();
  connecterMqtt();

  Serial.println(F("=== ESP8266 Bureau pret ==="));
}

// ================================================================
//  LOOP
// ================================================================
void loop() {
  if (!mqtt.connected()) connecterMqtt();
  mqtt.loop();

  while (arduinoSerial.available()) {
    char c = arduinoSerial.read();
    if (c == '\n') {
      tampon.trim();
      if (tampon.length() > 0) traiterMessageArduino(tampon);
      tampon = "";
    } else {
      if (tampon.length() < 200) tampon += c;
    }
  }
}
