"""
Router IoT — Commandes temps réel vers les équipements physiques.

Règles de rôle :
  administrateur → contrôle tous les équipements de son entreprise
  employé        → contrôle UNIQUEMENT les équipements de son bureau assigné

Toutes les commandes de porte nécessitent un code PIN valide.
Chaque action est journalisée (historique_acces + journal_systeme + journal_mqtt).
"""

from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session

import models
import schemas
from auth import require_employe, require_admin
from database import get_db
from mqtt_service import publier_commande, est_connecte
from security import verify_password

iot_router = APIRouter(prefix="/iot", tags=["IoT — Commandes temps réel"])


# ─── Garde partagée : restriction bureau pour les employés ─────────────────────

def _verifier_acces_bureau(utilisateur: models.Utilisateur, bureau_id: int) -> None:
    """Lève 403 si l'employé essaie de contrôler un équipement hors de son bureau."""
    if utilisateur.role == "employe" and utilisateur.bureau_id != bureau_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Accès refusé : vous ne pouvez contrôler que les équipements de votre bureau.",
        )


def _journaliser(
    db: Session,
    utilisateur: models.Utilisateur,
    action: str,
    type_entite: str,
    identifiant_entite: int,
    details: str,
    request: Optional[Request] = None,
) -> None:
    ip = request.client.host if request and request.client else None
    db.add(models.JournalSysteme(
        entreprise_id=utilisateur.entreprise_id,
        utilisateur_id=utilisateur.id,
        action=action,
        type_entite=type_entite,
        identifiant_entite=identifiant_entite,
        details=details,
        adresse_ip=ip,
    ))


def _log_mqtt_envoye(
    db: Session,
    equip: models.Equipement,
    commande: dict,
) -> None:
    topic = (
        f"smartbureau/{equip.entreprise_id}"
        f"/{equip.bureau_id}/{equip.identifiant_mqtt}/commande"
    )
    db.add(models.JournalMessageMqtt(
        entreprise_id=equip.entreprise_id,
        bureau_id=equip.bureau_id,
        equipement_id=equip.id,
        sujet_mqtt=topic,
        contenu=commande,
        direction="envoye",
    ))


def _mqtt_ou_503(
    entreprise_id: int,
    bureau_id: int,
    identifiant_mqtt: str,
    commande: dict,
) -> None:
    """Publie la commande ou lève HTTP 503 si le broker est indisponible."""
    ok = publier_commande(entreprise_id, bureau_id, identifiant_mqtt, commande)
    if not ok:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Broker MQTT non disponible — commande non envoyée.",
        )


# ─── STATUT BROKER ────────────────────────────────────────────────────────────

@iot_router.get("/statut", response_model=schemas.StatutMqtt)
def statut_mqtt(
    _: models.Utilisateur = Depends(require_employe),
):
    """Indique si le backend est connecté au broker MQTT."""
    return {"mqtt_connecte": est_connecte()}


# ─── PORTES ───────────────────────────────────────────────────────────────────

@iot_router.post(
    "/portes/{porte_id}/commande",
    response_model=schemas.CommandePorteResponse,
    summary="Ouvrir / fermer une porte (PIN requis)",
)
def commander_porte(
    porte_id: int,
    payload: schemas.CommandePorte,
    request: Request,
    current_user: models.Utilisateur = Depends(require_employe),
    db: Session = Depends(get_db),
):
    """
    Workflow :
    1. Vérification tenant + bureau (employé limité à son bureau)
    2. Validation du code PIN contre les codes actifs de cette porte
    3. Publication MQTT → ESP8266
    4. Mise à jour de l'état en base + journalisation
    """
    if payload.action not in ("ouvrir", "fermer"):
        raise HTTPException(status_code=422, detail="action doit être 'ouvrir' ou 'fermer'.")

    porte: Optional[models.Porte] = (
        db.query(models.Porte)
        .join(models.Equipement)
        .filter(
            models.Porte.id == porte_id,
            models.Equipement.entreprise_id == current_user.entreprise_id,
        )
        .first()
    )
    if not porte:
        raise HTTPException(status_code=404, detail="Porte non trouvée.")

    _verifier_acces_bureau(current_user, porte.equipement.bureau_id)

    if porte.equipement.etat not in ("actif",):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"La porte est '{porte.equipement.etat}' — commande refusée.",
        )

    # ── Validation PIN ──────────────────────────────────────────────────────
    now = datetime.now(timezone.utc)
    code_valide = None

    for code in porte.codes_acces:
        if not code.etat:
            continue
        if code.expire_le and code.expire_le.replace(tzinfo=timezone.utc) < now:
            continue
        if code.limite_utilisations and code.nombre_utilisations >= code.limite_utilisations:
            continue
        if verify_password(payload.code_pin, code.code_hache):
            code_valide = code
            break

    # Journal de la tentative (succès ou échec)
    db.add(models.HistoriqueAcces(
        porte_id=porte_id,
        utilisateur_id=current_user.id,
        methode_ouverture="application",
        resultat="succes" if code_valide else "echec",
    ))

    if not code_valide:
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Code PIN invalide ou expiré.",
        )

    # ── Incrémentation compteur ─────────────────────────────────────────────
    code_valide.nombre_utilisations += 1

    # ── Publication MQTT ────────────────────────────────────────────────────
    commande = {
        "action": payload.action,
        "duree_sec": porte.duree_ouverture_sec,
    }
    _mqtt_ou_503(
        current_user.entreprise_id,
        porte.equipement.bureau_id,
        porte.equipement.identifiant_mqtt,
        commande,
    )

    # ── Mise à jour DB ──────────────────────────────────────────────────────
    porte.etat_verrou = "ouvert" if payload.action == "ouvrir" else "verrouille"
    if payload.action == "ouvrir":
        porte.derniere_ouverture = now

    _log_mqtt_envoye(db, porte.equipement, commande)
    _journaliser(
        db, current_user,
        f"porte_{payload.action}",
        "porte", porte_id,
        f"Porte id={porte_id} — action={payload.action} via application",
        request,
    )
    db.commit()

    return {
        "message": f"Porte {'ouverte' if payload.action == 'ouvrir' else 'verrouillée'} avec succès.",
        "etat_verrou": porte.etat_verrou,
    }


# ─── LAMPES ───────────────────────────────────────────────────────────────────

@iot_router.post(
    "/lampes/{lampe_id}/commande",
    response_model=schemas.CommandeLampeResponse,
    summary="Allumer / éteindre une lampe",
)
def commander_lampe(
    lampe_id: int,
    payload: schemas.CommandeLampe,
    request: Request,
    current_user: models.Utilisateur = Depends(require_employe),
    db: Session = Depends(get_db),
):
    """
    Contrôle d'une lampe via MQTT.
    - Admin : toutes les lampes de l'entreprise
    - Employé : uniquement les lampes de son bureau
    """
    if payload.action not in ("allumer", "eteindre"):
        raise HTTPException(status_code=422, detail="action doit être 'allumer' ou 'eteindre'.")

    lampe: Optional[models.Lampe] = (
        db.query(models.Lampe)
        .join(models.Equipement)
        .filter(
            models.Lampe.id == lampe_id,
            models.Equipement.entreprise_id == current_user.entreprise_id,
        )
        .first()
    )
    if not lampe:
        raise HTTPException(status_code=404, detail="Lampe non trouvée.")

    _verifier_acces_bureau(current_user, lampe.equipement.bureau_id)

    if lampe.equipement.etat not in ("actif",):
        raise HTTPException(
            status_code=409,
            detail=f"La lampe est '{lampe.equipement.etat}' — commande refusée.",
        )

    intensite = payload.intensite_pct if payload.intensite_pct is not None else lampe.intensite_pct
    commande = {"action": payload.action, "intensite": intensite}

    _mqtt_ou_503(
        current_user.entreprise_id,
        lampe.equipement.bureau_id,
        lampe.equipement.identifiant_mqtt,
        commande,
    )

    lampe.etat_lumiere = "allume" if payload.action == "allumer" else "eteint"
    lampe.intensite_pct = intensite

    _log_mqtt_envoye(db, lampe.equipement, commande)
    _journaliser(
        db, current_user,
        f"lampe_{payload.action}",
        "lampe", lampe_id,
        f"Lampe id={lampe_id} — {payload.action}, intensité={intensite}%",
        request,
    )
    db.commit()

    return {
        "message": f"Lampe {'allumée' if payload.action == 'allumer' else 'éteinte'} avec succès.",
        "etat_lumiere": lampe.etat_lumiere,
    }


# ─── CAMERAS ─────────────────────────────────────────────────────────────────

@iot_router.post(
    "/cameras/{camera_id}/commande",
    response_model=schemas.CommandeCameraResponse,
    summary="Snapshot / démarrer-arrêter enregistrement (admin seulement)",
    dependencies=[Depends(require_admin)],
)
def commander_camera(
    camera_id: int,
    payload: schemas.CommandeCamera,
    request: Request,
    current_user: models.Utilisateur = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """
    Commandes disponibles : snapshot | enregistrement_on | enregistrement_off.
    Réservé aux administrateurs.
    """
    if payload.action not in ("snapshot", "enregistrement_on", "enregistrement_off"):
        raise HTTPException(
            status_code=422,
            detail="action doit être 'snapshot', 'enregistrement_on' ou 'enregistrement_off'.",
        )

    camera: Optional[models.Camera] = (
        db.query(models.Camera)
        .join(models.Equipement)
        .filter(
            models.Camera.id == camera_id,
            models.Equipement.entreprise_id == current_user.entreprise_id,
        )
        .first()
    )
    if not camera:
        raise HTTPException(status_code=404, detail="Caméra non trouvée.")

    if camera.equipement.etat not in ("actif",):
        raise HTTPException(
            status_code=409,
            detail=f"La caméra est '{camera.equipement.etat}' — commande refusée.",
        )

    commande = {"action": payload.action}
    _mqtt_ou_503(
        current_user.entreprise_id,
        camera.equipement.bureau_id,
        camera.equipement.identifiant_mqtt,
        commande,
    )

    if payload.action == "enregistrement_on":
        camera.enregistrement_actif = True
    elif payload.action == "enregistrement_off":
        camera.enregistrement_actif = False

    _log_mqtt_envoye(db, camera.equipement, commande)
    _journaliser(
        db, current_user,
        f"camera_{payload.action}",
        "camera", camera_id,
        f"Caméra id={camera_id} — commande={payload.action}",
        request,
    )
    db.commit()

    return {"message": f"Commande '{payload.action}' envoyée à la caméra."}


# ─── CAPTEUR — Endpoint HTTP fallback pour ESP8266 ────────────────────────────

@iot_router.post(
    "/capteurs/{identifiant_mqtt}/donnee",
    summary="Réception donnée capteur (HTTP fallback, sans JWT)",
    status_code=status.HTTP_200_OK,
)
def recevoir_donnee_capteur(
    identifiant_mqtt: str,
    payload: schemas.DonneeCapteur,
    db: Session = Depends(get_db),
):
    """
    Endpoint HTTP utilisé par les ESP8266 qui ne peuvent pas MQTT directement.
    Aucune authentification JWT — isolé par identifiant_mqtt unique.

    L'ESP8266 envoie :
      POST /api/iot/capteurs/mq2-bureau-1/donnee
      Body: {"valeur": 450.5, "unite": "ppm"}
    """
    equip = (
        db.query(models.Equipement)
        .filter(models.Equipement.identifiant_mqtt == identifiant_mqtt)
        .first()
    )
    if not equip or not equip.detecteur:
        raise HTTPException(status_code=404, detail="Capteur non trouvé.")

    det = equip.detecteur
    det.derniere_valeur = payload.valeur
    det.date_derniere_lecture = datetime.now(timezone.utc)

    if det.seuil_alerte and payload.valeur >= float(det.seuil_alerte):
        _TYPE_MAP = {
            "mq2": "gaz",
            "flamme": "incendie",
            "pir": "mouvement",
            "temperature_humidite": "temperature",
            "ultrason": "autre",
        }
        ratio = payload.valeur / float(det.seuil_alerte)
        niveau = "critique" if ratio >= 1.5 else "eleve"
        db.add(models.Alerte(
            entreprise_id=equip.entreprise_id,
            bureau_id=equip.bureau_id,
            equipement_id=equip.id,
            type_alerte=_TYPE_MAP.get(det.type_detecteur, "autre"),
            niveau_urgence=niveau,
            statut="non_traitee",
            description=(
                f"{det.type_detecteur.upper()} : {payload.valeur} {payload.unite or det.unite_mesure or ''}"
                f" — seuil {det.seuil_alerte} dépassé (HTTP fallback)"
            ),
        ))

    db.commit()
    return {"ok": True, "identifiant": identifiant_mqtt, "valeur": payload.valeur}
