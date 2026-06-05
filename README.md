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
- **Modifier son profil** (nom, email, mot de passe)
- **Gérer les paramètres de l'entreprise** (admin uniquement)

---

## Qui peut faire quoi

| Action                                 | Administrateur |       Employé        |
| -------------------------------------- | :------------: | :------------------: |
| Gérer les utilisateurs et bureaux      |       ✅       |          ❌          |
| Voir et contrôler tous les équipements |       ✅       | Son bureau seulement |
| Ouvrir une porte (code PIN requis)     |       ✅       | Son bureau seulement |
| Allumer / éteindre une lampe           |       ✅       | Son bureau seulement |
| Caméras (snapshot, enregistrement)     |       ✅       |          ❌          |
| Voir et traiter les alertes            |       ✅       |          ✅          |
| Voir l'historique des accès            |       ✅       |          ✅          |
| Modifier son profil                    |       ✅       |          ✅          |
| Modifier les infos de l'entreprise     |       ✅       |          ❌          |

---

## Technologies utilisées

| Partie            | Technologie                           |
| ----------------- | ------------------------------------- |
| Interface web     | React 19 + TypeScript                 |
| Serveur API       | FastAPI (Python)                      |
| Base de données   | PostgreSQL — hébergé sur **Supabase** |
| Communication IoT | MQTT (Mosquitto)                      |
| Microcontrôleur   | ESP8266                               |

---

## Installation rapide

### Prérequis

- Python 3.11+
- Node.js 18+
- Un projet **Supabase** (gratuit sur supabase.com) **ou** PostgreSQL local

### 1 — Backend

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
```

Éditer le fichier `.env` :

```env
# Supabase (pooler — remplacer par vos valeurs depuis le dashboard Supabase)
DATABASE_URL=postgresql://postgres.PROJET_ID:MOT_DE_PASSE@aws-0-REGION.pooler.supabase.com:6543/postgres

# OU PostgreSQL local
# DATABASE_URL=postgresql://postgres:mot_de_passe@localhost:5432/smart_bureau_v

JWT_SECRET_KEY=une-cle-longue-et-aleatoire-minimum-32-caracteres
ACCESS_TOKEN_EXPIRE_MINUTES=60
MQTT_HOST=localhost
MQTT_PORT=1883
```

> **Supabase :** l'URL du pooler se trouve dans  
> _Dashboard → Settings → Database → Connection pooling → URI (Transaction mode)_

### 2 — Frontend

```bash
cd frontend
npm install
```

---

## Démarrer le système

Double-cliquer sur **`demarrer.bat`** à la racine du projet.

Cela ouvre automatiquement :

- Le broker MQTT (Mosquitto)
- Le serveur backend (FastAPI)

Puis démarrer le frontend dans un terminal :

```bash
cd frontend
npm run dev
```

Ouvrir **http://localhost:5173** dans le navigateur.

| Service            | Adresse                    |
| ------------------ | -------------------------- |
| Application web    | http://localhost:5173      |
| API REST + Swagger | http://localhost:8000/docs |
| Broker MQTT        | mqtt://localhost:1883      |

---

## Première utilisation

1. Ouvrir l'application et cliquer sur **"S'inscrire"**
2. Créer votre entreprise et votre compte administrateur
3. Dans **Bureaux**, créer vos bureaux
4. Dans **Portes / Lampes / Caméras**, ajouter vos équipements avec leur identifiant MQTT
5. Flasher l'ESP8266 avec le firmware `esp8266/smart_bureau.ino`
6. Dans **Paramètres**, modifier votre profil ou les infos de l'entreprise

---

## Matériel IoT (ESP8266)

Ouvrir `esp8266/smart_bureau.ino` dans l'Arduino IDE et renseigner :

```cpp
#define WIFI_SSID     "NomDuWifi"
#define WIFI_PASSWORD "MotDePasse"
#define MQTT_BROKER   "192.168.x.x"  // IP du PC qui fait tourner le backend
#define ENT_ID        "1"             // ID de l'entreprise
#define BUREAU_ID     "1"             // ID du bureau contrôlé
```

| Broche ESP8266 | Équipement                  |
| -------------- | --------------------------- |
| D2             | Servo (serrure de porte)    |
| D1             | Relais (lampe)              |
| D5             | Capteur de mouvement (PIR)  |
| A0             | Capteur de fumée/gaz (MQ-2) |
| D6             | Capteur température (DHT11) |
| D7             | Buzzer d'alarme             |

**Bibliothèques Arduino requises** (Library Manager) : `PubSubClient`, `ArduinoJson`, `DHT sensor library`
