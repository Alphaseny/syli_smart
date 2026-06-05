"""
Router Commandes Vocales — Vosk offline (FR + EN).

Endpoint principal :
  POST /api/voix/commande
    Body   : multipart/form-data
      audio  : fichier WAV (16kHz, 16-bit, mono)
      langue : "fr" | "en" (défaut: "fr")
    Retour : { transcription, commande, resultat, equipement_actionne }

Endpoint statut :
  GET /api/voix/statut
"""

import logging
from typing import Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

import models
from auth import require_employe
from database import get_db
from mqtt_service import publier_commande
from voice_commands import parser_commande, CommandeVocale
from voice_service import transcrire_audio, est_disponible, statut as vosk_statut

logger = logging.getLogger(__name__)

voice_router = APIRouter(prefix="/voix", tags=["Commandes vocales"])

MAX_TAILLE_AUDIO = 5 * 1024 * 1024  # 5 Mo


# ─── STATUT ───────────────────────────────────────────────────────────────────

@voice_router.get("/statut")
def statut_voix(_: models.Utilisateur = Depends(require_employe)):
    return vosk_statut()


# ─── COMMANDE VOCALE ──────────────────────────────────────────────────────────

@voice_router.post("/commande")
async def executer_commande_vocale(
    audio: UploadFile = File(..., description="Fichier WAV 16kHz mono 16-bit"),
    langue: str = Form(default="fr", description="'fr' ou 'en'"),
    current_user: models.Utilisateur = Depends(require_employe),
    db: Session = Depends(get_db),
):
    """
    Traite une commande vocale :
    1. Transcrit l'audio avec Vosk (offline)
    2. Parse la commande (FR/EN)
    3. Trouve l'équipement correspondant
    4. Envoie la commande MQTT
    5. Retourne le résultat complet
    """
    if not est_disponible():
        raise HTTPException(
            status_code=503,
            detail="Vosk non disponible. Installez-le et téléchargez les modèles (voir backend/telecharger_modeles.py).",
        )

    if langue not in ("fr", "en"):
        langue = "fr"

    # Lire l'audio
    audio_bytes = await audio.read()
    if len(audio_bytes) > MAX_TAILLE_AUDIO:
        raise HTTPException(status_code=413, detail="Fichier audio trop grand (max 5 Mo).")
    if len(audio_bytes) < 100:
        raise HTTPException(status_code=422, detail="Fichier audio vide ou trop court.")

    # ── Étape 1 : Transcription Vosk ──────────────────────────────────────────
    transcription = transcrire_audio(audio_bytes, langue)

    if not transcription:
        return {
            "transcription": "",
            "commande": None,
            "resultat": "echec_transcription",
            "message": "Aucune parole détectée. Parlez clairement près du microphone.",
            "equipement_actionne": None,
        }

    # ── Étape 2 : Parser la commande ──────────────────────────────────────────
    commande = parser_commande(transcription)

    if not commande:
        return {
            "transcription": transcription,
            "commande": None,
            "resultat": "commande_non_reconnue",
            "message": f"Transcription : « {transcription} » — aucune commande domotique reconnue.",
            "equipement_actionne": None,
        }

    # ── Étape 3 : Trouver l'équipement ────────────────────────────────────────
    equipement = _trouver_equipement(db, commande, current_user)

    if not equipement:
        return {
            "transcription": transcription,
            "commande": commande.intention,
            "resultat": "equipement_non_trouve",
            "message": (
                f"Commande « {commande.action} » reconnue mais aucun équipement "
                f"{'(' + commande.cible + ') ' if commande.cible else ''}trouvé."
            ),
            "equipement_actionne": None,
        }

    # ── Étape 4 : Vérifier accès bureau (employé) ─────────────────────────────
    if current_user.role == "employe" and equipement.bureau_id != current_user.bureau_id:
        raise HTTPException(
            status_code=403,
            detail="Accès refusé : vous ne pouvez contrôler que les équipements de votre bureau.",
        )

    # ── Étape 5 : Envoyer commande MQTT ───────────────────────────────────────
    payload_mqtt = _construire_payload(commande)
    ok = publier_commande(
        current_user.entreprise_id,
        equipement.bureau_id,
        equipement.identifiant_mqtt,
        payload_mqtt,
    )

    # Mettre à jour l'état en base
    _mettre_a_jour_etat(db, equipement, commande)
    db.commit()

    resultat = "succes" if ok else "mqtt_indisponible"
    message = _message_confirmation(commande, equipement.identifiant_mqtt, ok)

    logger.info(
        "Voix [%s] → %s sur %s — %s",
        langue, commande.intention, equipement.identifiant_mqtt, resultat,
    )

    return {
        "transcription": transcription,
        "commande": commande.intention,
        "resultat": resultat,
        "message": message,
        "equipement_actionne": equipement.identifiant_mqtt,
    }


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _trouver_equipement(
    db: Session,
    commande: CommandeVocale,
    user: models.Utilisateur,
) -> Optional[models.Equipement]:
    """
    Trouve le premier équipement correspondant au type et à la cible mentionnée.
    Pour les employés, limité à leur bureau.
    """
    type_map = {"lampe": "lampe", "porte": "porte", "camera": "camera"}
    type_eq = type_map.get(commande.type_equipement)

    query = (
        db.query(models.Equipement)
        .filter(
            models.Equipement.entreprise_id == user.entreprise_id,
            models.Equipement.type_equipement == type_eq,
            models.Equipement.etat == "actif",
        )
    )

    # Restriction bureau pour les employés
    if user.role == "employe" and user.bureau_id:
        query = query.filter(models.Equipement.bureau_id == user.bureau_id)

    # Filtre par cible si mentionnée ("bureau 1", "entrée", etc.)
    if commande.cible:
        cible = commande.cible.lower()
        candidats = query.all()
        for eq in candidats:
            if cible in eq.identifiant_mqtt.lower():
                return eq
        # Chercher dans le nom du bureau
        bureaux = (
            db.query(models.Bureau)
            .filter(models.Bureau.entreprise_id == user.entreprise_id)
            .all()
        )
        for bureau in bureaux:
            if cible in bureau.nom_bureau.lower():
                return query.filter(models.Equipement.bureau_id == bureau.id).first()

    return query.first()


def _construire_payload(commande: CommandeVocale) -> dict:
    if commande.type_equipement == "lampe":
        return {"action": commande.action, "source": "voix"}
    if commande.type_equipement == "porte":
        return {"action": commande.action, "source": "voix"}
    if commande.type_equipement == "camera":
        return {"action": commande.action}
    return {}


def _mettre_a_jour_etat(db: Session, equipement: models.Equipement, commande: CommandeVocale) -> None:
    if commande.type_equipement == "lampe" and equipement.lampe:
        equipement.lampe.etat_lumiere = "allume" if commande.action == "allumer" else "eteint"
    elif commande.type_equipement == "porte" and equipement.porte:
        equipement.porte.etat_verrou = "ouvert" if commande.action == "ouvrir" else "verrouille"


def _message_confirmation(commande: CommandeVocale, identifiant: str, ok: bool) -> str:
    if not ok:
        return f"Commande {commande.action} envoyée mais le broker MQTT est indisponible."
    msgs = {
        "lampe_allumer": f"Lampe {identifiant} allumée.",
        "lampe_eteindre": f"Lampe {identifiant} éteinte.",
        "porte_ouvrir": f"Porte {identifiant} ouverte.",
        "porte_fermer": f"Porte {identifiant} fermée.",
        "camera_snapshot": f"Snapshot déclenché sur {identifiant}.",
    }
    return msgs.get(commande.intention, f"Commande {commande.action} exécutée sur {identifiant}.")
