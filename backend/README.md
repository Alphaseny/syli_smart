# Backend FastAPI Smart Bureau

## Description

Backend de l’application Smart Bureau construit avec FastAPI, SQLAlchemy et PostgreSQL. Il expose des API REST pour gérer les utilisateurs, portes, codes d'accès, alertes, caméras, lampes, commandes vocales, détecteurs, tentatives d'accès et journal système.

Le backend inclut un système d'authentification JWT et une gestion de droits basée sur les rôles `admin` et `secretaire`.

## Prérequis

- Python 3.11+ ou compatible
- PostgreSQL installé et accessible
- Un environnement virtuel Python recommandé

## Installation

1. Créer et activer un environnement virtuel

```bash
python -m venv .venv
.\.venv\Scripts\activate
```

2. Installer les dépendances

```bash
pip install -r requirements.txt
```

3. Copier la configuration d'exemple et adapter la connexion PostgreSQL

```bash
copy .env.example .env
```

4. Modifier `.env` si nécessaire

```env
DATABASE_URL=postgresql://postgres:motdepasse@localhost:5432/smart_bureau
JWT_SECRET_KEY=replace-with-a-secure-random-value
ACCESS_TOKEN_EXPIRE_MINUTES=60
```

## Lancer le serveur

```bash
uvicorn backend.main:app --reload
```

> En production, utiliser plutôt :
>
> ```bash
> uvicorn backend.main:app --host 0.0.0.0 --port 8000
> ```

## Points importants

- La base de données est configurée dans `backend/database.py`.
- Si `.env` n'est pas trouvé, un fallback est utilisé :
  `postgresql://postgres:password@localhost:5432/smart_bureau`.
- Les tables sont créées automatiquement au démarrage via `Base.metadata.create_all(bind=engine)`.
- Les routes sont accessibles sous le préfixe `/api`.
- La documentation interactive FastAPI est disponible à :
  - `http://127.0.0.1:8000/docs`
  - `http://127.0.0.1:8000/redoc`

## Authentification

- `POST /api/auth/token` : obtention du JWT (username=email, password)
- `POST /api/auth/register` : création d'un utilisateur (rôle `secretaire` ou premier `admin`)
- `GET /api/auth/me` : informations du compte connecté

## Rôles et permissions

- `admin` : accès complet à la gestion des utilisateurs et des ressources sensibles.
- `secretaire` : accès en lecture à la plupart des ressources, et contrôle des portes, lampes et caméras selon les routes.

## Routes principales

### Utilisateur

- `GET /api/utilisateurs` (admin)
- `GET /api/utilisateurs/{id}` (admin)
- `PUT /api/utilisateurs/{id}` (admin)
- `DELETE /api/utilisateurs/{id}` (admin)

### Portes

- `GET /api/portes` (admin, secretaire)
- `GET /api/portes/{id}` (admin, secretaire)
- `POST /api/portes` (admin)
- `PUT /api/portes/{id}` (admin)
- `DELETE /api/portes/{id}` (admin)

### Codes d'accès

- `GET /api/codes-acces` (admin)
- `GET /api/codes-acces/{id}` (admin)
- `POST /api/codes-acces` (admin)
- `PUT /api/codes-acces/{id}` (admin)
- `DELETE /api/codes-acces/{id}` (admin)

### Historique d'accès

- `GET /api/historique-acces` (admin)
- `GET /api/historique-acces/{id}` (admin)
- `POST /api/historique-acces` (admin)
- `PUT /api/historique-acces/{id}` (admin)
- `DELETE /api/historique-acces/{id}` (admin)

### Alertes

- `GET /api/alertes` (admin, secretaire)
- `GET /api/alertes/{id}` (admin, secretaire)
- `POST /api/alertes` (admin)
- `PUT /api/alertes/{id}` (admin)
- `DELETE /api/alertes/{id}` (admin)

### Caméras

- `GET /api/cameras` (admin, secretaire)
- `GET /api/cameras/{id}` (admin, secretaire)
- `POST /api/cameras` (admin)
- `PUT /api/cameras/{id}` (admin)
- `DELETE /api/cameras/{id}` (admin)

### Lampes

- `GET /api/lampes` (admin, secretaire)
- `GET /api/lampes/{id}` (admin, secretaire)
- `POST /api/lampes` (admin)
- `PUT /api/lampes/{id}` (admin, secretaire)
- `DELETE /api/lampes/{id}` (admin)

### Commandes vocales

- `GET /api/commandes-vocales` (admin, secretaire)
- `GET /api/commandes-vocales/{id}` (admin, secretaire)
- `POST /api/commandes-vocales` (admin)
- `PUT /api/commandes-vocales/{id}` (admin)
- `DELETE /api/commandes-vocales/{id}` (admin)

### Détecteurs

- `GET /api/detecteurs` (admin, secretaire)
- `GET /api/detecteurs/{id}` (admin, secretaire)
- `POST /api/detecteurs` (admin)
- `PUT /api/detecteurs/{id}` (admin)
- `DELETE /api/detecteurs/{id}` (admin)

### Tentatives d'accès

- `GET /api/tentatives-acces` (admin, secretaire)
- `GET /api/tentatives-acces/{id}` (admin, secretaire)
- `POST /api/tentatives-acces` (admin)
- `PUT /api/tentatives-acces/{id}` (admin)
- `DELETE /api/tentatives-acces/{id}` (admin)

### Journal système

- `GET /api/journal-systeme` (admin)
- `GET /api/journal-systeme/{id}` (admin)
- `POST /api/journal-systeme` (admin)
- `PUT /api/journal-systeme/{id}` (admin)
- `DELETE /api/journal-systeme/{id}` (admin)

## Notes de sécurité

- Les mots de passe utilisateur sont hachés avec bcrypt via Passlib.
- L'authentification est gérée par JWT (`python-jose`).
- Les variables sensibles sont externalisées dans `.env`.
- La validation de `DATABASE_URL` bloque les valeurs placeholder.
