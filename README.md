# Syli Bureau

Application web de gestion d'un bureau connecté.  
Contrôlez à distance vos portes, lampes et caméras depuis n'importe quel navigateur.

---

## Ce que fait l'application

- **Ouvrir / fermer une porte** à distance avec un code PIN
- **Allumer / éteindre les lampes** en un clic
- **Surveiller les caméras** et prendre des snapshots
- **Recevoir des alertes** automatiques (fumée, intrusion, température)
- **Gérer les utilisateurs** et leurs accès par bureau

---

## Qui peut faire quoi

| Action | Administrateur | Employé |
|--------|:-:|:-:|
| Gérer les utilisateurs et bureaux | ✅ | ❌ |
| Voir et contrôler tous les équipements | ✅ | Son bureau seulement |
| Ouvrir une porte (code PIN requis) | ✅ | Son bureau seulement |
| Allumer / éteindre une lampe | ✅ | Son bureau seulement |
| Caméras (snapshot, enregistrement) | ✅ | ❌ |
| Voir et traiter les alertes | ✅ | ✅ |
| Voir l'historique des accès | ✅ | ✅ |

---

## Technologies utilisées

| Partie | Technologie |
|--------|------------|
| Interface web | React + TypeScript |
| Serveur API | FastAPI (Python) |
| Base de données | PostgreSQL |
| Communication IoT | MQTT (Mosquitto) |
| Microcontrôleur | ESP8266 |

---

## Installation rapide

### Prérequis
- Python 3.11+
- Node.js 18+
- PostgreSQL

### 1 — Base de données

Créer une base nommée `smart_bureau_v` dans PostgreSQL.

### 2 — Backend

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env   # puis éditer le fichier .env
```

Contenu du fichier `.env` :

```
DATABASE_URL=postgresql://postgres:VOTRE_MOT_DE_PASSE@localhost:5432/smart_bureau_v
JWT_SECRET_KEY=une-cle-longue-et-aleatoire
MQTT_HOST=localhost
MQTT_PORT=1883
```

### 3 — Frontend

```bash
cd frontend
npm install
```

---

## Démarrer le système

Double-cliquer sur **`demarrer.bat`** à la racine du projet.

Deux fenêtres s'ouvrent automatiquement :
- Le broker MQTT (Mosquitto)
- Le serveur backend (FastAPI)

Puis démarrer le frontend :

```bash
cd frontend
npm run dev
```

Ouvrir **http://localhost:5173** dans le navigateur.

---

## Matériel IoT (ESP8266)

Ouvrir `esp8266/smart_bureau.ino` dans l'Arduino IDE et renseigner :

```cpp
#define WIFI_SSID    "NomDuWifi"
#define WIFI_PASSWORD "MotDePasse"
#define MQTT_BROKER  "192.168.x.x"  // adresse IP du PC qui fait tourner le backend
#define ENT_ID       "1"             // ID de votre entreprise
#define BUREAU_ID    "1"             // ID du bureau contrôlé
```

| Broche ESP8266 | Équipement |
|---|---|
| D2 | Servo (serrure de porte) |
| D1 | Relais (lampe) |
| D5 | Capteur de mouvement (PIR) |
| A0 | Capteur de fumée/gaz (MQ-2) |
| D6 | Capteur température (DHT11) |
| D7 | Buzzer d'alarme |
