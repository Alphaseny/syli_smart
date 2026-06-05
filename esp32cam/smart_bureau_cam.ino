/**
 * Syli Bureau — Firmware ESP32-CAM (AI Thinker)
 *
 * Fonctionnement :
 *   1. Détecte une présence via le capteur PIR
 *   2. Capture une photo avec la caméra OV2640
 *   3. Envoie la photo au backend FastAPI via HTTP POST
 *   4. Si le visage est reconnu → LED verte + bip court
 *      Si inconnu            → LED rouge + bip long
 *
 * Bibliothèques requises (Boards Manager) :
 *   - esp32 by Espressif Systems (v2.x) → carte "AI Thinker ESP32-CAM"
 *   - ArduinoJson (Benoit Blanchon)
 *
 * Broches AI Thinker ESP32-CAM :
 *   GPIO 4  → LED Flash (caméra)
 *   GPIO 12 → LED Verte (accès accordé)
 *   GPIO 13 → PIR (détecteur de présence)
 *   GPIO 14 → LED Rouge (accès refusé)
 *   GPIO 15 → Buzzer
 */

#include "esp_camera.h"
#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>

// ═══════════════════════════════════════════════════════════════════
// CONFIGURATION — À MODIFIER AVANT DE FLASHER
// ═══════════════════════════════════════════════════════════════════

#define WIFI_SSID        "NomDuWifi"
#define WIFI_PASSWORD    "MotDePasse"
#define BACKEND_URL      "http://192.168.1.100:8000"   // IP du PC serveur
#define CAMERA_API_KEY   "syli-bureau-cam-secret-2024"  // Doit correspondre à .env
#define PORTE_ID         1                              // ID de la porte dans la base
#define NOM_CAMERA       "cam-porte-principale"         // Identifiant MQTT

// ═══════════════════════════════════════════════════════════════════
// BROCHES (AI Thinker ESP32-CAM)
// ═══════════════════════════════════════════════════════════════════

// Caméra OV2640 — NE PAS MODIFIER
#define PWDN_GPIO_NUM   32
#define RESET_GPIO_NUM  -1
#define XCLK_GPIO_NUM    0
#define SIOD_GPIO_NUM   26
#define SIOC_GPIO_NUM   27
#define Y9_GPIO_NUM     35
#define Y8_GPIO_NUM     34
#define Y7_GPIO_NUM     39
#define Y6_GPIO_NUM     36
#define Y5_GPIO_NUM     21
#define Y4_GPIO_NUM     19
#define Y3_GPIO_NUM     18
#define Y2_GPIO_NUM      5
#define VSYNC_GPIO_NUM  25
#define HREF_GPIO_NUM   23
#define PCLK_GPIO_NUM   22

// Périphériques
#define PIN_FLASH    4    // LED Flash intégrée (attention : très lumineuse)
#define PIN_PIR     13    // Capteur PIR (détection présence)
#define PIN_LED_OK  12    // LED Verte (accès accordé)
#define PIN_LED_KO  14    // LED Rouge (accès refusé)
#define PIN_BUZZER  15    // Buzzer

// ═══════════════════════════════════════════════════════════════════
// PARAMÈTRES
// ═══════════════════════════════════════════════════════════════════

#define DELAI_ENTRE_CAPTURES_MS   3000   // Intervalle minimum entre deux captures (ms)
#define TIMEOUT_HTTP_MS           8000   // Timeout requête HTTP (ms)
#define DELAI_ANTI_REBOND_PIR_MS   500   // Anti-rebond PIR (ms)

// ═══════════════════════════════════════════════════════════════════
// VARIABLES GLOBALES
// ═══════════════════════════════════════════════════════════════════

unsigned long derniere_capture_ms = 0;

// ═══════════════════════════════════════════════════════════════════
// INITIALISATION CAMÉRA
// ═══════════════════════════════════════════════════════════════════

bool init_camera() {
  camera_config_t config;
  config.ledc_channel = LEDC_CHANNEL_0;
  config.ledc_timer   = LEDC_TIMER_0;
  config.pin_d0       = Y2_GPIO_NUM;
  config.pin_d1       = Y3_GPIO_NUM;
  config.pin_d2       = Y4_GPIO_NUM;
  config.pin_d3       = Y5_GPIO_NUM;
  config.pin_d4       = Y6_GPIO_NUM;
  config.pin_d5       = Y7_GPIO_NUM;
  config.pin_d6       = Y8_GPIO_NUM;
  config.pin_d7       = Y9_GPIO_NUM;
  config.pin_xclk     = XCLK_GPIO_NUM;
  config.pin_pclk     = PCLK_GPIO_NUM;
  config.pin_vsync    = VSYNC_GPIO_NUM;
  config.pin_href     = HREF_GPIO_NUM;
  config.pin_sscb_sda = SIOD_GPIO_NUM;
  config.pin_sscb_scl = SIOC_GPIO_NUM;
  config.pin_pwdn     = PWDN_GPIO_NUM;
  config.pin_reset    = RESET_GPIO_NUM;
  config.xclk_freq_hz = 20000000;
  config.pixel_format = PIXFORMAT_JPEG;

  // Qualité image : VGA pour la reconnaissance faciale (bon compromis vitesse/précision)
  if (psramFound()) {
    config.frame_size   = FRAMESIZE_VGA;   // 640×480
    config.jpeg_quality = 12;              // 0–63, plus bas = meilleure qualité
    config.fb_count     = 2;
  } else {
    config.frame_size   = FRAMESIZE_QVGA;  // 320×240
    config.jpeg_quality = 15;
    config.fb_count     = 1;
  }

  esp_err_t err = esp_camera_init(&config);
  if (err != ESP_OK) {
    Serial.printf("[CAM] Erreur init caméra : 0x%x\n", err);
    return false;
  }

  // Réglages capteur pour une meilleure reconnaissance faciale
  sensor_t* s = esp_camera_sensor_get();
  s->set_brightness(s, 1);    // Légèrement plus lumineux
  s->set_saturation(s, -1);   // Légèrement désaturé
  s->set_whitebal(s, 1);      // Balance des blancs auto
  s->set_exposure_ctrl(s, 1); // Exposition auto
  s->set_gain_ctrl(s, 1);     // Gain auto

  Serial.println("[CAM] Caméra initialisée.");
  return true;
}

// ═══════════════════════════════════════════════════════════════════
// CONNEXION WI-FI
// ═══════════════════════════════════════════════════════════════════

void connect_wifi() {
  Serial.printf("[WiFi] Connexion à %s ", WIFI_SSID);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  int tentatives = 0;
  while (WiFi.status() != WL_CONNECTED && tentatives < 30) {
    delay(500);
    Serial.print(".");
    tentatives++;
  }
  if (WiFi.status() == WL_CONNECTED) {
    Serial.printf("\n[WiFi] Connecté — IP : %s\n", WiFi.localIP().toString().c_str());
  } else {
    Serial.println("\n[WiFi] Échec connexion — redémarrage...");
    ESP.restart();
  }
}

// ═══════════════════════════════════════════════════════════════════
// CAPTURE + ENVOI AU BACKEND
// ═══════════════════════════════════════════════════════════════════

void capturer_et_identifier() {
  Serial.println("[CAM] Capture en cours...");

  // Petit délai pour laisser le PIR se stabiliser
  delay(DELAI_ANTI_REBOND_PIR_MS);

  camera_fb_t* fb = esp_camera_fb_get();
  if (!fb) {
    Serial.println("[CAM] Erreur : impossible de capturer le frame.");
    signal_erreur();
    return;
  }

  Serial.printf("[CAM] Frame capturé : %u octets\n", fb->len);

  // Vérifier la connexion WiFi
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("[WiFi] Reconnexion...");
    connect_wifi();
  }

  // Construire l'URL
  String url = String(BACKEND_URL)
               + "/api/reconnaissance/porte/"
               + String(PORTE_ID)
               + "/identifier";

  HTTPClient http;
  http.begin(url);
  http.setTimeout(TIMEOUT_HTTP_MS);
  http.addHeader("X-Camera-Key", CAMERA_API_KEY);

  // Envoi multipart/form-data
  String boundary = "----ESP32CAMBoundary";
  String body_debut =
    "--" + boundary + "\r\n"
    "Content-Disposition: form-data; name=\"image\"; filename=\"capture.jpg\"\r\n"
    "Content-Type: image/jpeg\r\n\r\n";
  String body_fin = "\r\n--" + boundary + "--\r\n";

  // Construire le payload complet
  size_t taille_totale = body_debut.length() + fb->len + body_fin.length();
  uint8_t* payload = (uint8_t*)malloc(taille_totale);
  if (!payload) {
    Serial.println("[MEM] Mémoire insuffisante pour le payload.");
    esp_camera_fb_return(fb);
    signal_erreur();
    return;
  }
  memcpy(payload, body_debut.c_str(), body_debut.length());
  memcpy(payload + body_debut.length(), fb->buf, fb->len);
  memcpy(payload + body_debut.length() + fb->len, body_fin.c_str(), body_fin.length());

  http.addHeader("Content-Type", "multipart/form-data; boundary=" + boundary);
  int code_http = http.POST(payload, taille_totale);

  free(payload);
  esp_camera_fb_return(fb);

  // Traiter la réponse
  if (code_http == 200) {
    String reponse = http.getString();
    Serial.println("[HTTP] Réponse : " + reponse);

    StaticJsonDocument<512> doc;
    DeserializationError err = deserializeJson(doc, reponse);

    if (!err) {
      bool autorise = doc["autorise"].as<bool>();
      const char* nom = doc["nom"] | "Inconnu";
      const char* message = doc["message"] | "";

      Serial.printf("[FACE] autorise=%s | %s\n", autorise ? "OUI" : "NON", message);

      if (autorise) {
        signal_acces_accorde(nom);
      } else {
        signal_acces_refuse();
      }
    } else {
      Serial.println("[JSON] Erreur parsing réponse.");
      signal_erreur();
    }
  } else {
    Serial.printf("[HTTP] Erreur code : %d\n", code_http);
    signal_erreur();
  }

  http.end();
}

// ═══════════════════════════════════════════════════════════════════
// SIGNAUX VISUELS / SONORES
// ═══════════════════════════════════════════════════════════════════

void signal_acces_accorde(const char* nom) {
  Serial.printf("[OK] Bonjour %s !\n", nom);
  // LED Verte 3× + bip court
  for (int i = 0; i < 3; i++) {
    digitalWrite(PIN_LED_OK, HIGH);
    tone(PIN_BUZZER, 1000, 100);
    delay(200);
    digitalWrite(PIN_LED_OK, LOW);
    delay(100);
  }
}

void signal_acces_refuse() {
  Serial.println("[KO] Accès refusé.");
  // LED Rouge + bip long
  digitalWrite(PIN_LED_KO, HIGH);
  tone(PIN_BUZZER, 400, 1000);
  delay(1500);
  digitalWrite(PIN_LED_KO, LOW);
}

void signal_erreur() {
  // Double bip + LED rouge clignotante
  for (int i = 0; i < 2; i++) {
    digitalWrite(PIN_LED_KO, HIGH);
    tone(PIN_BUZZER, 200, 200);
    delay(300);
    digitalWrite(PIN_LED_KO, LOW);
    delay(200);
  }
}

// ═══════════════════════════════════════════════════════════════════
// SETUP & LOOP
// ═══════════════════════════════════════════════════════════════════

void setup() {
  Serial.begin(115200);
  Serial.println("\n[BOOT] Syli Bureau — ESP32-CAM Reconnaissance Faciale");

  // Broches
  pinMode(PIN_FLASH,  OUTPUT); digitalWrite(PIN_FLASH,  LOW);
  pinMode(PIN_LED_OK, OUTPUT); digitalWrite(PIN_LED_OK, LOW);
  pinMode(PIN_LED_KO, OUTPUT); digitalWrite(PIN_LED_KO, LOW);
  pinMode(PIN_BUZZER, OUTPUT);
  pinMode(PIN_PIR,    INPUT);

  // Caméra
  if (!init_camera()) {
    Serial.println("[BOOT] Caméra KO — redémarrage dans 5s...");
    delay(5000);
    ESP.restart();
  }

  // Wi-Fi
  connect_wifi();

  // Signal de démarrage OK
  digitalWrite(PIN_LED_OK, HIGH);
  tone(PIN_BUZZER, 1200, 300);
  delay(500);
  digitalWrite(PIN_LED_OK, LOW);

  Serial.println("[BOOT] Système prêt — en attente de détection...");
}

void loop() {
  // Reconnecter le Wi-Fi si nécessaire
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("[WiFi] Reconnexion...");
    connect_wifi();
  }

  // Détection PIR
  if (digitalRead(PIN_PIR) == HIGH) {
    unsigned long maintenant = millis();

    // Anti-rebond : éviter les captures trop rapprochées
    if (maintenant - derniere_capture_ms >= DELAI_ENTRE_CAPTURES_MS) {
      derniere_capture_ms = maintenant;
      Serial.println("[PIR] Présence détectée !");
      capturer_et_identifier();
    }
  }

  delay(50);
}
