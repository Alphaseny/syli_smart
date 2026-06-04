from typing import Any, Dict, Optional

from fastapi import HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

import models


def get_instance(db: Session, model: Any, object_id: int):
    instance = db.query(model).filter(model.id == object_id).first()
    if instance is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ressource introuvable")
    return instance


def create_instance(db: Session, model: Any, payload: Dict[str, Any]):
    instance = model(**payload)
    db.add(instance)
    db.commit()
    db.refresh(instance)
    return instance


def update_instance(db: Session, db_instance: Any, payload: Dict[str, Any]):
    for key, value in payload.items():
        setattr(db_instance, key, value)
    db.add(db_instance)
    db.commit()
    db.refresh(db_instance)
    return db_instance


def delete_instance(db: Session, db_instance: Any):
    db.delete(db_instance)
    db.commit()
    return {"detail": "Ressource supprimée"}


def get_user_by_email(db: Session, email: str) -> Optional[models.Utilisateur]:
    clean_email = email.strip().lower()
    return (
        db.query(models.Utilisateur)
        .filter(func.lower(models.Utilisateur.email) == clean_email)
        .first()
)
