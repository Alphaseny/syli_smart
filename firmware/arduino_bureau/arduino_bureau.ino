/*
 * ================================================================
 *  SMART BUREAU — Arduino UNO — BUREAU
 *  Matériel géré : Clavier 4x4, LCD 16x2 I2C,
 *                  Servo (porte), LED verte, LED rouge
 *
 *  Communication avec l'ESP8266 via SoftwareSerial (A1 / A2)
 *    Reçoit de l'ESP : "OUVRIR", "FERMER", "NOUVEAU_CODE:xxxx"
 *    Envoie à l'ESP  : JSON { "type":..., ... }
 * ================================================================
 *
 *  CÂBLAGE :
 *    Arduino A1  ← ESP8266 D7 (TX)
 *    Arduino A2  → résistances (10kΩ+20kΩ) → ESP8266 D6 (RX)
 *    Arduino GND ←→ ESP8266 GND
 *
 *  BROCHES :
 *    Keypad lignes   D2 D3 D4 D5
 *    Keypad colonnes D6 D7 D8 D9
 *    Servo           D11
 *    LED verte       D12
 *    LED rouge       D13
 *    LCD SDA         A4   (I2C fixe)
 *    LCD SCL         A5   (I2C fixe)
 *    ESP RX          A1   ← depuis ESP8266
 *    ESP TX          A2   → vers ESP8266
 * ================================================================
 */

#include <Keypad.h>
#include <Wire.h>
#include <LiquidCrystal_I2C.h>
#include <Servo.h>
#include <SoftwareSerial.h>

// ================================================================
//  CONFIGURATION
// ================================================================
String CODE_SECRET    = "1234";   // Code PIN local (peut être changé via app)
const int MAX_TENTATIVES = 5;
const int DUREE_OUVERTURE_MS = 5000;   // ms avant refermeture automatique

// ================================================================
//  BROCHES
// ================================================================
const int LED_VERTE = 12;
const int LED_ROUGE = 13;
const int SERVO_PIN = 11;

// Keypad 4x4
const byte ROWS = 4;
const byte COLS = 4;
char keys[ROWS][COLS] = {
  {'1','2','3','A'},
  {'4','5','6','B'},
  {'7','8','9','C'},
  {'*','0','#','D'}
};
byte rowPins[ROWS] = {2, 3, 4, 5};
byte colPins[COLS] = {6, 7, 8, 9};

// ================================================================
//  OBJETS
// ================================================================
Keypad             keypad = Keypad(makeKeymap(keys), rowPins, colPins, ROWS, COLS);
LiquidCrystal_I2C  lcd(0x27, 16, 2);
Servo              maPorte;
SoftwareSerial     espSerial(A1, A2);   // RX=A1, TX=A2

// ================================================================
//  VARIABLES
// ================================================================
String        saisie          = "";
int           tentatives      = 0;
bool          verrouille      = false;
unsigned long tempsVerrouillage = 0;
const unsigned long DUREE_VERROUILLAGE = 30000;  // 30s si trop de tentatives

bool          porteOuverte    = false;
unsigned long tempsOuverture  = 0;

// ================================================================
//  FONCTIONS
// ================================================================

void ouvrirPorte() {
  maPorte.write(90);
  porteOuverte  = true;
  tempsOuverture = millis();
  digitalWrite(LED_VERTE, HIGH);
  digitalWrite(LED_ROUGE, LOW);
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("  ACCES ACCORDE ");
  lcd.setCursor(0, 1);
  lcd.print("  Porte ouverte ");
  espSerial.println("{\"type\":\"porte\",\"etat\":\"ouvert\"}");
  Serial.println(F("Porte ouverte"));
}

void fermerPorte() {
  maPorte.write(0);
  porteOuverte = false;
  digitalWrite(LED_VERTE, LOW);
  afficherAccueil();
  espSerial.println("{\"type\":\"porte\",\"etat\":\"verrouille\"}");
  Serial.println(F("Porte fermée"));
}

void refuserAcces() {
  digitalWrite(LED_ROUGE, HIGH);
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("  ACCES REFUSE  ");
  lcd.setCursor(0, 1);
  lcd.print("Code incorrect  ");
  espSerial.println("{\"type\":\"acces\",\"resultat\":\"echec\"}");
  delay(2000);
  digitalWrite(LED_ROUGE, LOW);
}

void afficherAccueil() {
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print(" Smart Bureau   ");
  lcd.setCursor(0, 1);
  lcd.print(" Entrez le code:");
}

void afficherVerrouille() {
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("  VERROUILLE !  ");
  lcd.setCursor(0, 1);
  lcd.print("Attendez 30 sec ");
  digitalWrite(LED_ROUGE, HIGH);
}

// Lit et exécute les commandes reçues de l'ESP8266
void lireCommandeESP() {
  if (!espSerial.available()) return;
  String cmd = espSerial.readStringUntil('\n');
  cmd.trim();
  Serial.print(F("ESP → ")); Serial.println(cmd);

  if (cmd == "OUVRIR") {
    lcd.clear();
    lcd.print("Ouverture app...");
    ouvrirPorte();

  } else if (cmd == "FERMER") {
    fermerPorte();

  } else if (cmd.startsWith("NOUVEAU_CODE:")) {
    // L'app peut changer le code PIN à distance
    String nouveauCode = cmd.substring(13);
    if (nouveauCode.length() >= 4) {
      CODE_SECRET = nouveauCode;
      Serial.println(F("Code PIN mis à jour via app"));
      espSerial.println("{\"type\":\"info\",\"msg\":\"code_mis_a_jour\"}");
    }
  }
}

// Traite la saisie du clavier
void traiterSaisie() {
  char touche = keypad.getKey();
  if (!touche) return;

  if (verrouille) {
    lcd.clear();
    lcd.print("Systeme bloque!");
    delay(1000);
    afficherVerrouille();
    return;
  }

  Serial.println(touche);

  if (touche == '#') {
    // Validation du code
    if (saisie == CODE_SECRET) {
      tentatives = 0;
      verrouille = false;
      ouvrirPorte();
      espSerial.println("{\"type\":\"acces\",\"resultat\":\"succes\"}");
    } else {
      tentatives++;
      Serial.print(F("Tentative ")); Serial.println(tentatives);
      refuserAcces();

      if (tentatives >= MAX_TENTATIVES) {
        verrouille = true;
        tempsVerrouillage = millis();
        afficherVerrouille();
        espSerial.println("{\"type\":\"acces\",\"resultat\":\"verrouillage\"}");
      } else {
        afficherAccueil();
      }
    }
    saisie = "";

  } else if (touche == '*') {
    // Effacer la saisie
    saisie = "";
    afficherAccueil();

  } else {
    // Chiffre saisi — affiche des étoiles
    saisie += touche;
    lcd.setCursor(0, 1);
    lcd.print("Code: ");
    for (int i = 0; i < (int)saisie.length(); i++) lcd.print('*');
    lcd.print("          ");
  }
}

// ================================================================
//  SETUP
// ================================================================
void setup() {
  Serial.begin(9600);
  espSerial.begin(9600);

  pinMode(LED_VERTE, OUTPUT);
  pinMode(LED_ROUGE, OUTPUT);
  digitalWrite(LED_VERTE, LOW);
  digitalWrite(LED_ROUGE, LOW);

  maPorte.attach(SERVO_PIN);
  maPorte.write(0);

  lcd.init();
  lcd.backlight();
  afficherAccueil();

  Serial.println(F("=== Bureau Smart Bureau pret ==="));
}

// ================================================================
//  LOOP
// ================================================================
void loop() {
  unsigned long maintenant = millis();

  // Commandes depuis l'app (via ESP8266)
  lireCommandeESP();

  // Déverrouillage automatique après 30s
  if (verrouille && (maintenant - tempsVerrouillage >= DUREE_VERROUILLAGE)) {
    verrouille = false;
    tentatives = 0;
    digitalWrite(LED_ROUGE, LOW);
    afficherAccueil();
    Serial.println(F("Système déverrouillé"));
  }

  // Refermeture automatique de la porte
  if (porteOuverte && (maintenant - tempsOuverture >= DUREE_OUVERTURE_MS)) {
    fermerPorte();
  }

  // Saisie clavier
  traiterSaisie();
}
