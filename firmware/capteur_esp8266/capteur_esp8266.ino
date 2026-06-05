/*
 * Smart Bureau — Capteur universel ESP8266
 * Gère : MQ2 (gaz), PIR (mouvement), DHT11/22 (temp/humidité), flamme
 * Librairies : PubSubClient, ArduinoJson, DHT sensor library (Adafruit)
 *
 * Wiring :
 *   MQ2 analogique → A0
 *   PIR digital    → D3 (GPIO0)
 *   DHT data       → D4 (GPIO2)
 *   Flamme digital → D6 (GPIO12)
 */

#include <ESP8266WiFi.h>
#include <WiFiClientSecure.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>
#include <DHT.h>

// ─── À REMPLIR ────────────────────────────────────────────────────────────────
const char* WIFI_SSID     = "NOM_DE_TON_WIFI";
const char* WIFI_PASSWORD = "MOT_DE_PASSE_WIFI";

const char* MQTT_HOST     = "f3bd9e73b3884e43978a2f3cb1e64075.s1.eu.hivemq.cloud";
const int   MQTT_PORT     = 8883;
const char* MQTT_USER     = "syli_smart";
const char* MQTT_PASS     = "Alphasenycamara224";

const int   ENTREPRISE_ID = 1;
const int   BUREAU_ID     = 1;

// Décommente le capteur que tu utilises et son IDENTIFIANT
// --- MQ2 ---
const char* IDENTIFIANT   = "detecteur_gaz_01";
const char* TYPE_CAPTEUR  = "mq2";
const int   SEUIL_ALERTE  = 400;  // valeur analogique 0-1023

// --- PIR ---
// const char* IDENTIFIANT  = "detecteur_pir_01";
// const char* TYPE_CAPTEUR = "pir";

// --- DHT22 ---
// const char* IDENTIFIANT  = "capteur_temp_01";
// const char* TYPE_CAPTEUR = "temperature_humidite";
// ──────────────────────────────────────────────────────────────────────────────

const int PIN_MQ2   = A0;
const int PIN_PIR   = D3;
const int PIN_DHT   = D4;
const int PIN_FLAMME = D6;

#define DHT_TYPE DHT22
DHT dht(PIN_DHT, DHT_TYPE);

WiFiClientSecure wifiClient;
PubSubClient mqtt(wifiClient);

char topicDonnee[120];
char topicAlerte[120];
char topicStatut[120];

unsigned long derniereEnvoi = 0;
const unsigned long INTERVALLE_MS = 10000;  // envoie les données toutes les 10s

void publierDonnee(float valeur) {
  StaticJsonDocument<128> doc;
  doc["valeur"] = valeur;
  char buf[128];
  serializeJson(doc, buf);
  mqtt.publish(topicDonnee, buf);
}

void publierAlerte(const char* type, const char* niveau, float valeur) {
  StaticJsonDocument<256> doc;
  doc["type"]        = type;
  doc["niveau"]      = niveau;
  char desc[100];
  snprintf(desc, sizeof(desc), "%s: valeur=%.1f — seuil dépassé", TYPE_CAPTEUR, valeur);
  doc["description"] = desc;
  char buf[256];
  serializeJson(doc, buf);
  mqtt.publish(topicAlerte, buf);
}

void lireEtPublierMQ2() {
  int valeur = analogRead(PIN_MQ2);
  publierDonnee((float)valeur);
  if (valeur >= SEUIL_ALERTE) {
    publierAlerte("gaz", valeur >= SEUIL_ALERTE * 1.5 ? "critique" : "eleve", valeur);
  }
}

void lireEtPublierPIR() {
  int detection = digitalRead(PIN_PIR);
  if (detection == HIGH) {
    publierDonnee(1.0);
    publierAlerte("mouvement", "moyen", 1.0);
  }
}

void lireEtPublierDHT() {
  float temp = dht.readTemperature();
  float hum  = dht.readHumidity();
  if (!isnan(temp)) publierDonnee(temp);
}

void connecterWifi() {
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  while (WiFi.status() != WL_CONNECTED) { delay(500); }
  Serial.println("WiFi: " + WiFi.localIP().toString());
}

void connecterMqtt() {
  while (!mqtt.connected()) {
    String cid = "capteur_" + String(IDENTIFIANT);
    if (mqtt.connect(cid.c_str(), MQTT_USER, MQTT_PASS)) {
      // Signaler que le capteur est actif
      StaticJsonDocument<64> doc;
      doc["etat"] = "actif";
      char buf[64]; serializeJson(doc, buf);
      mqtt.publish(topicStatut, buf, true);
      Serial.println("MQTT capteur connecté.");
    } else {
      delay(3000);
    }
  }
}

void setup() {
  Serial.begin(115200);
  pinMode(PIN_PIR, INPUT);
  pinMode(PIN_FLAMME, INPUT);
  dht.begin();

  snprintf(topicDonnee,  sizeof(topicDonnee),  "smartbureau/%d/%d/%s/donnee",  ENTREPRISE_ID, BUREAU_ID, IDENTIFIANT);
  snprintf(topicAlerte,  sizeof(topicAlerte),  "smartbureau/%d/%d/%s/alerte",  ENTREPRISE_ID, BUREAU_ID, IDENTIFIANT);
  snprintf(topicStatut,  sizeof(topicStatut),  "smartbureau/%d/%d/%s/statut",  ENTREPRISE_ID, BUREAU_ID, IDENTIFIANT);

  wifiClient.setInsecure();
  mqtt.setServer(MQTT_HOST, MQTT_PORT);

  connecterWifi();
  connecterMqtt();
}

void loop() {
  if (!mqtt.connected()) connecterMqtt();
  mqtt.loop();

  if (millis() - derniereEnvoi >= INTERVALLE_MS) {
    derniereEnvoi = millis();

    if (strcmp(TYPE_CAPTEUR, "mq2") == 0)                   lireEtPublierMQ2();
    else if (strcmp(TYPE_CAPTEUR, "pir") == 0)               lireEtPublierPIR();
    else if (strcmp(TYPE_CAPTEUR, "temperature_humidite") == 0) lireEtPublierDHT();
  }
}
