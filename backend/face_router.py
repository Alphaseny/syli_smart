"""
Router Reconnaissance Faciale — ouverture de porte par visage.

Endpoints :
  POST   /api/reconnaissance/enregistrer/{utilisateur_id}   Enrôle le visage d'un utilisateur (admin)
  DELETE /api/reconnaissance/supprimer/{utilisateur_id}     Supprime le visage (admin)
  GET    /api/reconnaissance/utilisateurs                   Liste les utilisateurs enrôlés (admin)
  POST   /api/reconnaissance/porte/{porte_id}/identifier    Identifie + ouvre la porte (ESP32-CAM)
  GET    /api/reconnaissance/statut                         Vérifie si face_recognition est installé
"""

import os
import logging
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, File, Header, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

import models
import schemas
from auth import require_admin, require_employe
from database import get_db
from face_service import extraire_encoding, identifier_visage, est_disponible
from mqtt_service import publier_commande

logger = logging.getLogger(__name__)

face_router = APIRouter(prefix="/reconnaissance", tags=["Reconnaissance faciale"])

CAMERA_API_KEY = os.getenv("CAMERA_API_KEY", "changeme-camera-secret")
TOLERANCE_FACIALE = float(os.getenv("FACE_TOLERANCE", "0.55"))


# ─── Vérification clé caméra ──────────────────────────────────────────────────

def _verifier_cle_camera(x_camera_key: str = Header(...)):
    """Vérifie la clé secrète envoyée par l'ESP32-CAM."""
    if x_camera_key != CAMERA_API_KEY:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Clé caméra invalide.",
        )


# ─── STATUT ───────────────────────────────────────────────────────────────────

@face_router.get("/statut")
def statut_reconnaissance(
    _: models.Utilisateur = Depends(require_employe),
):
    return {
        "face_recognition_disponible": est_disponible(),
        "message": (
            "Prêt"
            if est_disponible()
            else "face_recognition non installé — lancez : pip install cmake dlib face_recognition"
        ),
    }


# ─── ENRÔLEMENT (admin) ───────────────────────────────────────────────────────

@face_router.post("/enregistrer/{utilisateur_id}", status_code=status.HTTP_201_CREATED)
async def enregistrer_visage(
    utilisateur_id: int,
    image: UploadFile = File(..., description="Photo du visage (JPEG/PNG)"),
    current_user: models.Utilisateur = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """
    Enrôle le visage d'un utilisateur.
    - Extrait l'embedding 128 floats depuis la photo
    - Stocke en base dans la table encodages_faciaux
    - Un seul encodage par utilisateur (remplace l'ancien si existant)
    """
    if not est_disponible():
        raise HTTPException(
            status_code=503,
            detail="face_recognition non installé sur le serveur.",
        )

    # Vérifier que l'utilisateur appartient à la même entreprise
    utilisateur = db.query(models.Utilisateur).filter(
        models.Utilisateur.id == utilisateur_id,
        models.Utilisateur.entreprise_id == current_user.entreprise_id,
    ).first()
    if not utilisateur:
        raise HTTPException(status_code=404, detail="Utilisateur non trouvé.")

    # Lire l'image
    image_bytes = await image.read()
    if len(image_bytes) > 5 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="Image trop grande (max 5 Mo).")

    # Extraire l'encoding
    encoding = extraire_encoding(image_bytes)
    if encoding is None:
        raise HTTPException(
            status_code=422,
            detail="Aucun visage détecté dans l'image. Vérifiez que le visage est bien visible et éclairé.",
        )

    # Supprimer l'ancien encodage si existant
    db.query(models.EncodageFacial).filter(
        models.EncodageFacial.utilisateur_id == utilisateur_id,
    ).delete()

    # Créer le nouvel encodage
    nom_label = f"{utilisateur.prenom} {utilisateur.nom}"
    nouvel_encodage = models.EncodageFacial(
        entreprise_id=current_user.entreprise_id,
        utilisateur_id=utilisateur_id,
        nom_label=nom_label,
        encoding=encoding,
    )
    db.add(nouvel_encodage)
    db.commit()

    logger.info("Visage enrôlé pour %s (entreprise %d)", nom_label, current_user.entreprise_id)

    return {
        "message": f"Visage de {nom_label} enregistré avec succès.",
        "utilisateur_id": utilisateur_id,
        "dimensions_encoding": len(encoding),
    }


# ─── SUPPRESSION (admin) ──────────────────────────────────────────────────────

@face_router.delete("/supprimer/{utilisateur_id}", status_code=status.HTTP_204_NO_CONTENT)
def supprimer_visage(
    utilisateur_id: int,
    current_user: models.Utilisateur = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Supprime l'encodage facial d'un utilisateur."""
    supprime = db.query(models.EncodageFacial).filter(
        models.EncodageFacial.utilisateur_id == utilisateur_id,
        models.EncodageFacial.entreprise_id == current_user.entreprise_id,
    ).delete()
    db.commit()
    if not supprime:
        raise HTTPException(status_code=404, detail="Aucun encodage trouvé pour cet utilisateur.")


# ─── LISTE DES UTILISATEURS ENRÔLÉS (admin) ───────────────────────────────────

@face_router.get("/utilisateurs")
def lister_utilisateurs_enrolles(
    current_user: models.Utilisateur = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Retourne la liste des utilisateurs dont le visage est enregistré."""
    encodages = db.query(models.EncodageFacial).filter(
        models.EncodageFacial.entreprise_id == current_user.entreprise_id,
    ).all()
    return [
        {
            "utilisateur_id": e.utilisateur_id,
            "nom_label": e.nom_label,
            "date_enregistrement": e.date_creation.isoformat(),
        }
        for e in encodages
    ]


# ─── IDENTIFICATION + OUVERTURE PORTE (ESP32-CAM) ────────────────────────────

@face_router.post("/porte/{porte_id}/identifier")
async def identifier_et_ouvrir(
    porte_id: int,
    image: UploadFile = File(..., description="Frame JPEG capturée par l'ESP32-CAM"),
    _: None = Depends(_verifier_cle_camera),
    db: Session = Depends(get_db),
):
    """
    Endpoint appelé par l'ESP32-CAM (sans JWT).
    1. Identifie le visage dans la frame JPEG
    2. Vérifie que l'utilisateur identifié a accès à cette porte
    3. Envoie la commande MQTT pour ouvrir le servo
    4. Journalise l'accès

    Header requis : X-Camera-Key: <CAMERA_API_KEY>
    """
    if not est_disponible():
        raise HTTPException(status_code=503, detail="face_recognition non installé.")

    # Récupérer la porte et son équipement
    porte = db.query(models.Porte).join(models.Equipement).filter(
        models.Porte.id == porte_id,
    ).first()
    if not porte:
        raise HTTPException(status_code=404, detail="Porte non trouvée.")

    entreprise_id = porte.equipement.entreprise_id
    bureau_id = porte.equipement.bureau_id

    # Charger tous les encodages de l'entreprise
    encodages_db = db.query(models.EncodageFacial).filter(
        models.EncodageFacial.entreprise_id == entreprise_id,
    ).all()

    encodages = [
        (e.utilisateur_id, e.nom_label, e.encoding)
        for e in encodages_db
    ]

    # Lire l'image envoyée par l'ESP32-CAM
    image_bytes = await image.read()

    # Identifier
    resultat = identifier_visage(image_bytes, encodages, tolerance=TOLERANCE_FACIALE)

    if resultat is None:
        # Visage non reconnu → journaliser le refus
        db.add(models.HistoriqueAcces(
            porte_id=porte_id,
            utilisateur_id=None,
            methode_ouverture="reconnaissance_faciale",
            resultat="refuse",
            date_acces=datetime.now(timezone.utc),
        ))
        db.commit()
        return {
            "autorise": False,
            "utilisateur_id": None,
            "nom": None,
            "message": "Visage non reconnu — accès refusé.",
            "commande_mqtt_envoyee": False,
        }

    utilisateur_id, nom_label = resultat

    # Vérifier que l'utilisateur est actif
    utilisateur = db.query(models.Utilisateur).filter(
        models.Utilisateur.id == utilisateur_id,
        models.Utilisateur.etat == True,
    ).first()

    if not utilisateur:
        return {
            "autorise": False,
            "utilisateur_id": utilisateur_id,
            "nom": nom_label,
            "message": "Compte désactivé — accès refusé.",
            "commande_mqtt_envoyee": False,
        }

    # Vérifier l'accès au bureau (employé limité à son bureau)
    if utilisateur.role == "employe" and utilisateur.bureau_id != bureau_id:
        db.add(models.HistoriqueAcces(
            porte_id=porte_id,
            utilisateur_id=utilisateur_id,
            methode_ouverture="reconnaissance_faciale",
            resultat="refuse",
            date_acces=datetime.now(timezone.utc),
        ))
        db.commit()
        return {
            "autorise": False,
            "utilisateur_id": utilisateur_id,
            "nom": nom_label,
            "message": f"{nom_label} n'a pas accès à ce bureau.",
            "commande_mqtt_envoyee": False,
        }

    # ✅ Accès accordé — envoyer commande MQTT
    commande_envoyee = publier_commande(
        entreprise_id,
        bureau_id,
        porte.equipement.identifiant_mqtt,
        {"action": "ouvrir", "source": "reconnaissance_faciale"},
    )

    # Mettre à jour l'état de la porte
    porte.etat_verrou = "ouvert"
    porte.derniere_ouverture = datetime.now(timezone.utc)

    # Journaliser l'accès accordé
    db.add(models.HistoriqueAcces(
        porte_id=porte_id,
        utilisateur_id=utilisateur_id,
        methode_ouverture="reconnaissance_faciale",
        resultat="succes",
        date_acces=datetime.now(timezone.utc),
    ))
    db.add(models.JournalSysteme(
        entreprise_id=entreprise_id,
        utilisateur_id=utilisateur_id,
        action="porte_ouvrir",
        type_entite="porte",
        identifiant_entite=porte_id,
        details=f"Ouverture par reconnaissance faciale — {nom_label}",
    ))
    db.commit()

    logger.info("Porte %d ouverte par reconnaissance faciale : %s", porte_id, nom_label)

    return {
        "autorise": True,
        "utilisateur_id": utilisateur_id,
        "nom": nom_label,
        "message": f"Bonjour {nom_label} — accès accordé.",
        "commande_mqtt_envoyee": commande_envoyee,
    }
