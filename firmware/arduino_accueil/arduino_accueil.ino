/*
 * ================================================================
 *  SMART BUREAU — Arduino UNO  — ACCUEIL
 *  Matériel géré : RFID RC522, Servo (porte), Ultrason,
 *                  Capteur flamme, Capteur fumée MQ2,
 *                  Buzzer, LED, Capteur son (clap)
 *
 *  Communication avec l'ESP8266 via SoftwareSerial (A1 / A2)
 *    Reçoit de l'ESP : "OUVRIR" ou "FERMER"
 *    Envoie à l'ESP  : JSON { "type":..., "valeur":... }
 * ================================================================
 *
 *  CÂBLAGE :
 *    Arduino A1  ← ESP8266 D7 (TX)           [3.3V OK, pas de résistance]
 *    Arduino A2  → résistances (10kΩ+20kΩ) → ESP8266 D6 (RX)
 *    Arduino GND ←→ ESP8266 GND
 *
 *  BROCHES :
 *    SOUND_PIN   D7    Capteur son
 *    LED_PIN     D13   LED clap
 *    TRIG_PIN    D9    Ultrason TRIG
 *    ECHO_PIN    D10   Ultrason ECHO
 *    SERVO_PIN   D6    Servo porte
 *    FLAMME_PIN  D8    Capteur flamme
 *    FUMEE_PIN   A0    Capteur MQ2 (analogique)
 *    BUZZER_PIN  D5    Buzzer
 *    RFID RST    D3    RFID RC522 RST
 *    RFID SS     D4    RFID RC522 SS/SDA
 *    MOSI        D11   SPI (fixe)
 *    MISO        D12   SPI (fixe)
 *    SCK         D13   SPI (partagé avec LED)
 *    ESP RX      A1    ← reçoit depuis ESP8266
 *    ESP TX      A2    → envoie vers ESP8266
 * ================================================================
 */

#include <SPI.h>
#include <MFRC522.h>
#include <Servo.h>
#include <SoftwareSerial.h>

// ================================================================
//  BROCHES
// ================================================================
const int SOUND_PIN  = 7;
const int LED_PIN    = 13;
const int TRIG_PIN   = 9;
const int ECHO_PIN   = 10;
const int SERVO_PIN  = 6;
const int FLAMME_PIN = 8;
const int FUMEE_PIN  = A0;
const int BUZZER_PIN = 5;

#define RFID_RST_PIN  3
#define RFID_SS_PIN   4

// ================================================================
//  PARAMÈTRES
// ================================================================
const int  DISTANCE_SEUIL  = 20;   // cm — servo s'ouvre si objet plus proche
const int  SEUIL_FUMEE     = 130;  // seuil alerte MQ2 (0-1023)
#define    DELAI_FERMETURE 4000    // ms avant refermeture automatique RFID

// UID du badge RFID autorisé — met MODE_DEBUG 1, scanne ton badge, copie l'UID
const byte UID_AUTORISE[4] = {0xA1, 0xB2, 0xC3, 0xD4};  // ← REMPLACE avec ton vrai UID
#define MODE_DEBUG 1  // ← met à 0 en production

// ================================================================
//  OBJETS
// ================================================================
MFRC522          rfid(RFID_SS_PIN, RFID_RST_PIN);
Servo            monServo;
SoftwareSerial   espSerial(A1, A2);   // RX=A1 (depuis ESP), TX=A2 (vers ESP)

// ================================================================
//  VARIABLES
// ================================================================

// Clap
bool          etatLED      = false;
unsigned long dernierClap  = 0;
bool          capteurOccupe = false;

// Porte
bool          porteOuverte   = false;
unsigned long tempsOuverture = 0;
bool          ouverteParApp  = false;   // true = ouverte par commande MQTT

// Timing capteurs
unsigned long derniereScanUltra = 0;
unsigned long derniereFlamme    = 0;
unsigned long derniereFumee     = 0;
unsigned long derniereAff       = 0;
unsigned long derniereEnvoiESP  = 0;

// ================================================================
//  FONCTIONS
// ================================================================

float mesurerDistance() {
  digitalWrite(TRIG_PIN, LOW);
  delayMicroseconds(4);
  digitalWrite(TRIG_PIN, HIGH);
  delayMicroseconds(10);
  digitalWrite(TRIG_PIN, LOW);
  long duree = pulseIn(ECHO_PIN, HIGH, 25000);
  if (duree == 0) return 999.0;
  return (duree * 0.0343) / 2.0;
}

bool badgeAutorise(byte* uid) {
  for (byte i = 0; i < 4; i++) {
    if (uid[i] != UID_AUTORISE[i]) return false;
  }
  return true;
}

void ouvrirPorte() {
  monServo.write(90);
  porteOuverte   = true;
  tempsOuverture = millis();
  // Signale à l'ESP8266 que la porte est ouverte
  espSerial.println("{\"type\":\"porte\",\"etat\":\"ouvert\"}");
  tone(BUZZER_PIN, 1500, 300);
  Serial.println(F(">>> PORTE OUVERTE"));
}

void fermerPorte() {
  monServo.write(0);
  porteOuverte  = false;
  ouverteParApp = false;
  // Signale à l'ESP8266 que la porte est fermée
  espSerial.println("{\"type\":\"porte\",\"etat\":\"verrouille\"}");
  Serial.println(F(">>> PORTE FERMÉE"));
}

// Lit et exécute les commandes reçues de l'ESP8266
void lireCommandeESP() {
  if (!espSerial.available()) return;
  String cmd = espSerial.readStringUntil('\n');
  cmd.trim();
  Serial.print(F("ESP → ")); Serial.println(cmd);

  if (cmd == "OUVRIR") {
    ouverteParApp = true;
    ouvrirPorte();
  } else if (cmd == "FERMER") {
    fermerPorte();
  }
}

// ================================================================
//  SETUP
// ================================================================
void setup() {
  Serial.begin(9600);
  espSerial.begin(9600);

  pinMode(SOUND_PIN,  INPUT);
  pinMode(LED_PIN,    OUTPUT);
  pinMode(TRIG_PIN,   OUTPUT);
  pinMode(ECHO_PIN,   INPUT);
  pinMode(FLAMME_PIN, INPUT);
  pinMode(BUZZER_PIN, OUTPUT);
  digitalWrite(LED_PIN,    LOW);
  digitalWrite(BUZZER_PIN, LOW);
  digitalWrite(TRIG_PIN,   LOW);

  monServo.attach(SERVO_PIN);
  monServo.write(0);
  delay(500);

  SPI.begin();
  rfid.PCD_Init();

  Serial.println(F("=== Accueil Smart Bureau pret ==="));
  if (MODE_DEBUG) Serial.println(F("MODE DEBUG — scannez un badge pour voir son UID"));
}

// ================================================================
//  LOOP
// ================================================================
void loop() {
  unsigned long maintenant = millis();

  // ─── Commandes reçues depuis l'app (via ESP8266) ────────────
  lireCommandeESP();

  // ─── 1. Clap → LED ──────────────────────────────────────────
  int son = digitalRead(SOUND_PIN);
  if (son == HIGH && !capteurOccupe) {
    if (maintenant - dernierClap > 350) {
      etatLED = !etatLED;
      digitalWrite(LED_PIN, etatLED);
      Serial.println(F("CLAP !"));
      dernierClap = maintenant;
    }
    capteurOccupe = true;
  }
  if (son == LOW) capteurOccupe = false;

  // ─── 2. Ultrason → Servo (si porte non ouverte par app) ─────
  if (maintenant - derniereScanUltra > 200) {
    float distance = mesurerDistance();
    if (!porteOuverte) {
      if (distance > 0 && distance < DISTANCE_SEUIL) {
        monServo.write(90);
      } else {
        monServo.write(0);
      }
    }
    derniereScanUltra = maintenant;
  }

  // ─── 3. Flamme → Buzzer + alerte ESP ────────────────────────
  if (maintenant - derniereFlamme > 300) {
    int flamme = digitalRead(FLAMME_PIN);
    if (flamme == HIGH) {
      tone(BUZZER_PIN, 1000);
      espSerial.println("{\"type\":\"flamme\",\"valeur\":1}");
      Serial.println(F("FLAMME DETECTEE !"));
    } else {
      noTone(BUZZER_PIN);
    }
    derniereFlamme = maintenant;
  }

  // ─── 4. Fumée MQ2 → Buzzer + données ESP ────────────────────
  if (maintenant - derniereFumee > 500) {
    int fumee = analogRead(FUMEE_PIN);
    if (fumee > SEUIL_FUMEE) {
      tone(BUZZER_PIN, 800);
      Serial.print(F("FUMEE ! val=")); Serial.println(fumee);
    } else {
      noTone(BUZZER_PIN);
    }
    // Envoie la valeur fumée à l'ESP toutes les 10s
    if (maintenant - derniereEnvoiESP > 10000) {
      String msg = "{\"type\":\"fumee\",\"valeur\":" + String(fumee) + "}";
      espSerial.println(msg);
      derniereEnvoiESP = maintenant;
    }
    derniereFumee = maintenant;
  }

  // ─── 5. Refermeture automatique porte (après délai) ─────────
  if (porteOuverte && (maintenant - tempsOuverture >= DELAI_FERMETURE)) {
    fermerPorte();
  }

  // ─── 6. RFID → Ouverture porte ──────────────────────────────
  if (rfid.PICC_IsNewCardPresent() && rfid.PICC_ReadCardSerial()) {
    byte uidLu[4];
    for (byte i = 0; i < 4; i++) uidLu[i] = rfid.uid.uidByte[i];

    if (MODE_DEBUG) {
      Serial.print(F("UID: "));
      for (byte i = 0; i < 4; i++) {
        if (uidLu[i] < 0x10) Serial.print("0");
        Serial.print(uidLu[i], HEX);
        if (i < 3) Serial.print(":");
      }
      Serial.println();
    }

    if (badgeAutorise(uidLu)) {
      Serial.println(F("BADGE OK → ouverture"));
      ouverteParApp = false;
      ouvrirPorte();
      // Notifie l'app que l'accès a été accordé par badge
      espSerial.println("{\"type\":\"rfid\",\"resultat\":\"succes\"}");
    } else {
      Serial.println(F("BADGE REFUSE"));
      tone(BUZZER_PIN, 400, 500);
      espSerial.println("{\"type\":\"rfid\",\"resultat\":\"echec\"}");
    }

    rfid.PICC_HaltA();
    rfid.PCD_StopCrypto1();
    delay(1000);
  }
}
