import os
from datetime import datetime, timedelta, timezone
from typing import Optional

from dotenv import load_dotenv
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from sqlalchemy.orm import Session

load_dotenv()

import models
import schemas
from database import get_db
from security import verify_password
from services import get_user_by_email

JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY")
if not JWT_SECRET_KEY:
    raise RuntimeError("JWT_SECRET_KEY doit être défini dans l'environnement. Ajoutez-le au fichier .env.")

ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "60"))

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/token")


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, JWT_SECRET_KEY, algorithm=ALGORITHM)


def authenticate_user(db: Session, email: str, password: str) -> Optional[models.Utilisateur]:
    user = get_user_by_email(db, email)
    if not user or not verify_password(password, user.mot_de_passe):
        return None
    if not user.etat:
        return None
    return user


def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> models.Utilisateur:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Impossible d'authentifier l'utilisateur.",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=[ALGORITHM])
        email: Optional[str] = payload.get("sub")
        if email is None:
            raise credentials_exception
        token_data = schemas.TokenData(
            email=email,
            role=payload.get("role"),
            entreprise_id=payload.get("entreprise_id"),
            user_id=payload.get("user_id"),
        )
    except JWTError:
        raise credentials_exception

    user = get_user_by_email(db, token_data.email)
    if user is None:
        raise credentials_exception
    return user


def get_current_active_user(current_user: models.Utilisateur = Depends(get_current_user)) -> models.Utilisateur:
    if not current_user.etat:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Compte désactivé.")
    return current_user


def require_admin(current_user: models.Utilisateur = Depends(get_current_active_user)) -> models.Utilisateur:
    if current_user.role != "administrateur":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Accès administrateur requis.")
    return current_user


def require_employe(current_user: models.Utilisateur = Depends(get_current_active_user)) -> models.Utilisateur:
    if current_user.role not in {"administrateur", "employe"}:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Accès réservé aux utilisateurs authentifiés.")
    return current_user
