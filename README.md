# Smart Bureau

Système de gestion et de contrôle à distance d'un bureau connecté.  
L'application web permet de piloter en temps réel des équipements physiques (portes, lampes, caméras, capteurs) via des microcontrôleurs ESP8266 et le protocole MQTT.

---

## Architecture générale

```
Navigateur (React)
       ↓  HTTP / REST
Backend (FastAPI)
       ↓  MQTT
Broker Mosquitto
       ↓  Wi-Fi
ESP8266
       ↓  GPIO / UART
Servo · Relais · Capteurs (PIR, MQ-2, DHT)
```

---

## Structure du projet

```
smart_bureau_v/
├── backend/               # API FastAPI + service MQTT
│   ├── main.py            # Point d'entrée, démarrage MQTT
│   ├── models.py          # Modèles SQLAlchemy (13 tables)
│   ├── routers.py         # Endpoints REST CRUD
│   ├── iot_router.py      # Endpoints commandes IoT temps réel
│   ├── mqtt_service.py    # Client MQTT Paho (publish/subscribe)
│   ├── auth.py            # JWT + dépendances rôles
│   ├── schemas.py         # Schémas Pydantic
│   ├── database.py        # Connexion PostgreSQL
│   ├── security.py        # Hachage bcrypt
│   ├── services.py        # Helpers DB
│   ├── mosquitto.conf     # Configuration broker Mosquitto
│   ├── requirements.txt   # Dépendances Python
│   └── .env.example       # Variables d'environnement (modèle)
├── frontend/              # Application React
│   ├── src/
│   │   ├── pages/         # Tableaux de bord, Portes, Lampes, Caméras…
│   │   ├── components/    # Composants UI réutilisables
│   │   ├── contexts/      # AuthContext (JWT + cache)
│   │   ├── hooks/         # useRole, hooks TanStack Query
│   │   ├── services/      # apiClient, auth.service
│   │   └── types/         # Types TypeScript
│   └── package.json
├── esp8266/
│   └── smart_bureau.ino   # Firmware ESP8266 (Wi-Fi + MQTT + GPIO)
├── demarrer.bat           # Lance Mosquitto + FastAPI en un clic
└── README.md
```

---

## Prérequis

| Outil | Version minimale |
|-------|-----------------|
| Python | 3.11+ |
| Node.js | 18+ |
| PostgreSQL | 14+ |
| Mosquitto | 2.x (installé via `demarrer.bat`) |
| Arduino IDE | 2.x (pour le firmware ESP8266) |

---

## Installation

### 1. Cloner le projet

```bash
git clone https://github.com/Alphaseny/syli_smart.git
cd smart_bureau_v
```

### 2. Configurer la base de données

Créer une base PostgreSQL nommée `smart_bureau_v`, puis exécuter dans pgAdmin :

```sql
-- Si les tables existent déjà (réinitialisation)
DROP TABLE IF EXISTS journal_systeme, journal_messages_mqtt, alertes,
  historique_acces, codes_acces, detecteurs, lampes, cameras,
  portes, equipements, utilisateurs, bureaux, entreprises CASCADE;
```

Les tables sont créées automatiquement au premier démarrage du backend.

### 3. Configurer le backend

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate       # Windows
pip install -r requirements.txt
```

Créer le fichier `.env` à partir du modèle :

```bash
copy .env.example .env
```

Éditer `.env` :

```env
DATABASE_URL=postgresql://postgres:VOTRE_MOT_DE_PASSE@localhost:5432/smart_bureau_v
JWT_SECRET_KEY=une-cle-secrete-aleatoire-longue
ACCESS_TOKEN_EXPIRE_MINUTES=60
MQTT_HOST=localhost
MQTT_PORT=1883
MQTT_USERNAME=
MQTT_PASSWORD=
```

### 4. Installer le frontend

```bash
cd frontend
npm install      # ou pnpm install
```

---

## Démarrage

### Option A — Un seul clic (recommandé)

Double-cliquer sur **`demarrer.bat`** à la racine du projet.  
Cela ouvre deux fenêtres : le broker MQTT et le serveur FastAPI.

### Option B — Manuel

**Terminal 1 — Broker MQTT :**
```bash
"C:\Program Files\mosquitto\mosquitto.exe" -c backend/mosquitto.conf -v
```

**Terminal 2 — Backend :**
```bash
cd backend
.venv\Scripts\uvicorn main:app --reload
```

**Terminal 3 — Frontend :**
```bash
cd frontend
npm run dev
```

### URLs

| Service | Adresse |
|---------|---------|
| Application web | http://localhost:5173 |
| API REST | http://localhost:8000 |
| Documentation Swagger | http://localhost:8000/docs |
| Broker MQTT | mqtt://localhost:1883 |

---

## Rôles utilisateurs

| Action | Administrateur | Employé |
|--------|:--------------:|:-------:|
| Gérer les utilisateurs | ✅ | ❌ |
| Gérer les bureaux | ✅ | ❌ |
| Créer / supprimer équipements | ✅ | ❌ |
| Voir tous les équipements | ✅ | Son bureau uniquement |
| Ouvrir une porte (avec PIN) | ✅ | Son bureau uniquement |
| Allumer / éteindre une lampe | ✅ | Son bureau uniquement |
| Snapshot / enregistrement caméra | ✅ | ❌ |
| Voir les alertes | ✅ | ✅ |
| Résoudre / ignorer une alerte | ✅ | ✅ |
| Voir l'historique des accès | ✅ | ✅ |

---

## Endpoints IoT principaux

```
POST /api/iot/portes/{id}/commande       Ouvrir/fermer une porte (PIN requis)
POST /api/iot/lampes/{id}/commande       Allumer/éteindre une lampe
POST /api/iot/cameras/{id}/commande      Snapshot / enregistrement
POST /api/iot/capteurs/{mqtt_id}/donnee  Données capteur depuis ESP8266 (HTTP fallback)
GET  /api/iot/statut                     État de la connexion MQTT
```

---

## Topics MQTT

```
smartbureau/{entreprise_id}/{bureau_id}/{identifiant}/commande   → ESP8266 reçoit
smartbureau/{entreprise_id}/{bureau_id}/{identifiant}/donnee     ← ESP8266 publie
smartbureau/{entreprise_id}/{bureau_id}/{identifiant}/statut     ← ESP8266 publie
smartbureau/{entreprise_id}/{bureau_id}/{identifiant}/alerte     ← ESP8266 publie
```

---

## Firmware ESP8266

Le fichier `esp8266/smart_bureau.ino` contrôle un bureau complet :

| Broche | Composant |
|--------|-----------|
| D2 (GPIO4) | Servo-moteur (serrure) |
| D1 (GPIO5) | Relais (éclairage) |
| D5 (GPIO14) | Capteur PIR (mouvement) |
| A0 | Capteur MQ-2 (gaz/fumée) |
| D6 (GPIO12) | DHT11/22 (température) |
| D7 (GPIO13) | Buzzer (alarme) |

**Avant de flasher**, modifier la section CONFIG dans le fichier `.ino` :

```cpp
#define WIFI_SSID      "VotreWifi"
#define WIFI_PASSWORD  "MotDePasse"
#define MQTT_BROKER    "192.168.x.x"  // IP du PC qui fait tourner le backend
#define ENT_ID         "1"             // ID de l'entreprise en base
#define BUREAU_ID      "1"             // ID du bureau en base
```

**Bibliothèques Arduino requises** (Library Manager) :
- PubSubClient
- ArduinoJson
- DHT sensor library (Adafruit)

---

## Variables d'environnement

| Variable | Description | Exemple |
|----------|-------------|---------|
| `DATABASE_URL` | URL PostgreSQL | `postgresql://postgres:mdp@localhost:5432/smart_bureau_v` |
| `JWT_SECRET_KEY` | Clé secrète JWT (aléatoire, longue) | `abc123...` |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | Durée de vie du token | `60` |
| `MQTT_HOST` | Adresse du broker MQTT | `localhost` |
| `MQTT_PORT` | Port MQTT | `1883` |
| `MQTT_USERNAME` | Utilisateur MQTT (optionnel) | |
| `MQTT_PASSWORD` | Mot de passe MQTT (optionnel) | |

---

## Technologies utilisées

**Backend**
- FastAPI — API REST asynchrone
- SQLAlchemy 2 — ORM Python
- PostgreSQL — Base de données
- Paho-MQTT — Client MQTT
- Mosquitto — Broker MQTT
- bcrypt — Hachage des mots de passe et codes PIN
- JWT (python-jose) — Authentification stateless

**Frontend**
- React 19 + TypeScript
- Vite — Build tool
- TanStack Query — Gestion des requêtes et du cache
- React Router — Navigation
- Tailwind CSS 4 — Styles
- shadcn/ui — Composants UI

**IoT**
- ESP8266 (NodeMCU) — Microcontrôleur Wi-Fi
- MQTT v3.1.1 — Protocole de communication IoT
- Arduino IDE — Développement firmware
