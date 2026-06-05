/*
 * Smart Bureau — Lampe ESP8266
 * Librairies requises (Arduino Library Manager) :
 *   - PubSubClient (Nick O'Leary)
 *   - ArduinoJson  (Benoit Blanchon)
 *   - ESP8266WiFi  (inclus avec ESP8266 board package)
 *   - WiFiClientSecure (inclus)
 *
 * Wiring : Relais signal → D1 (GPIO5)
 */

#include <ESP8266WiFi.h>
#include <WiFiClientSecure.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>

// ─── À REMPLIR ────────────────────────────────────────────────────────────────
const char* WIFI_SSID     = "NOM_DE_TON_WIFI";
const char* WIFI_PASSWORD = "MOT_DE_PASSE_WIFI";

const char* MQTT_HOST     = "f3bd9e73b3884e43978a2f3cb1e64075.s1.eu.hivemq.cloud";
const int   MQTT_PORT     = 8883;
const char* MQTT_USER     = "syli_smart";
const char* MQTT_PASS     = "Alphasenycamara224";

// Ces valeurs doivent correspondre exactement à ce qui est dans l'app
const int   ENTREPRISE_ID = 1;
const int   BUREAU_ID     = 1;
const char* IDENTIFIANT   = "lampe_bureau_01";  // identifiant_mqtt dans l'app
// ──────────────────────────────────────────────────────────────────────────────

const int PIN_RELAIS = D1;  // GPIO5

WiFiClientSecure wifiClient;
PubSubClient mqtt(wifiClient);

char topicCommande[120];
char topicStatut[120];

void connecterWifi() {
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.print("WiFi...");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println(" connecté. IP: " + WiFi.localIP().toString());
}

void publierStatut(const char* etatLumiere) {
  StaticJsonDocument<128> doc;
  doc["etat"]        = "actif";
  doc["etat_lumiere"] = etatLumiere;
  char buf[128];
  serializeJson(doc, buf);
  mqtt.publish(topicStatut, buf, true);  // retain=true
}

void onMessage(char* topic, byte* payload, unsigned int length) {
  StaticJsonDocument<256> doc;
  if (deserializeJson(doc, payload, length)) return;

  const char* action = doc["action"];
  if (!action) return;

  if (strcmp(action, "allumer") == 0) {
    digitalWrite(PIN_RELAIS, HIGH);
    publierStatut("allume");
    Serial.println("Lampe allumée");
  } else if (strcmp(action, "eteindre") == 0) {
    digitalWrite(PIN_RELAIS, LOW);
    publierStatut("eteint");
    Serial.println("Lampe éteinte");
  }
}

void connecterMqtt() {
  while (!mqtt.connected()) {
    Serial.print("MQTT...");
    String clientId = "lampe_" + String(IDENTIFIANT);
    if (mqtt.connect(clientId.c_str(), MQTT_USER, MQTT_PASS)) {
      Serial.println(" connecté.");
      mqtt.subscribe(topicCommande);
      publierStatut("eteint");
    } else {
      Serial.print(" échec rc="); Serial.println(mqtt.state());
      delay(3000);
    }
  }
}

void setup() {
  Serial.begin(115200);
  pinMode(PIN_RELAIS, OUTPUT);
  digitalWrite(PIN_RELAIS, LOW);

  snprintf(topicCommande, sizeof(topicCommande),
           "smartbureau/%d/%d/%s/commande", ENTREPRISE_ID, BUREAU_ID, IDENTIFIANT);
  snprintf(topicStatut, sizeof(topicStatut),
           "smartbureau/%d/%d/%s/statut", ENTREPRISE_ID, BUREAU_ID, IDENTIFIANT);

  wifiClient.setInsecure();  // pour simplifier ; remplacer par CA cert en prod
  mqtt.setServer(MQTT_HOST, MQTT_PORT);
  mqtt.setCallback(onMessage);

  connecterWifi();
  connecterMqtt();
}

void loop() {
  if (!mqtt.connected()) connecterMqtt();
  mqtt.loop();
}
