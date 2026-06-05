"""
Caméras de surveillance — streaming en temps réel et contrôle de santé.

Endpoints :
  POST  /api/cameras/{id}/ping      Vérifie connectivité + maj état + alerte si panne
  GET   /api/cameras/{id}/snapshot  Proxy snapshot JPEG  (Bearer token)
  GET   /api/cameras/{id}/stream    Proxy flux MJPEG     (?token=<JWT>)
"""

import logging

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import Response, StreamingResponse
from jose import JWTError, jwt
from sqlalchemy.orm import Session

import models
from auth import JWT_SECRET_KEY, ALGORITHM, require_employe
from database import get_db
from services import get_user_by_email

logger = logging.getLogger(__name__)

camera_stream_router = APIRouter(prefix="/cameras", tags=["Caméras – streaming"])

_TIMEOUT_S = 5.0  # secondes avant de considérer la caméra hors ligne


# ---------------------------------------------------------------------------
# Utilitaires internes
# ---------------------------------------------------------------------------

def _obtenir_camera(camera_id: int, entreprise_id: int, db: Session) -> models.Camera:
    camera = (
        db.query(models.Camera)
        .join(models.Equipement)
        .filter(
            models.Camera.id == camera_id,
            models.Equipement.entreprise_id == entreprise_id,
        )
        .first()
    )
    if not camera:
        raise HTTPException(status_code=404, detail="Caméra non trouvée.")
    return camera


async def _utilisateur_token_query(
    token: str = Query(...),
    db: Session = Depends(get_db),
) -> models.Utilisateur:
    """
    Valide le JWT passé en query param ?token=...
    Obligatoire pour le flux MJPEG car les balises <img> ne peuvent pas envoyer
    d'en-tête Authorization.
    """
    exc = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Token invalide ou expiré.",
    )
    try:
        payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=[ALGORITHM])
        email: str | None = payload.get("sub")
        if not email:
            raise exc
    except JWTError:
        raise exc

    user = get_user_by_email(db, email)
    if not user or not user.etat:
        raise exc
    return user


# ---------------------------------------------------------------------------
# Ping / état de la caméra
# ---------------------------------------------------------------------------

@camera_stream_router.post("/{camera_id}/ping")
async def ping_camera(
    camera_id: int,
    current_user: models.Utilisateur = Depends(require_employe),
    db: Session = Depends(get_db),
):
    """
    Teste la connectivité réseau de la caméra.
    Met à jour son état en base et crée une alerte si elle vient de passer hors ligne.
    """
    camera = _obtenir_camera(camera_id, current_user.entreprise_id, db)
    adresse_ip = camera.equipement.adresse_ip

    if not adresse_ip:
        return {
            "camera_id": camera_id,
            "en_ligne": False,
            "raison": "Aucune adresse IP configurée.",
        }

    url_test = camera.lien_snapshot or f"http://{adresse_ip}/capture"
    en_ligne = False
    raison = ""

    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT_S) as client:
            r = await client.get(url_test)
            en_ligne = r.status_code < 400
            raison = "OK" if en_ligne else f"HTTP {r.status_code}"
    except httpx.TimeoutException:
        raison = "Délai dépassé"
    except httpx.ConnectError:
        raison = "Connexion refusée"
    except Exception as exc:
        raison = str(exc)[:120]

    etait_actif = camera.equipement.etat == "actif"
    camera.equipement.etat = "actif" if en_ligne else "inactif"

    if not en_ligne and etait_actif:
        db.add(
            models.Alerte(
                entreprise_id=camera.equipement.entreprise_id,
                bureau_id=camera.equipement.bureau_id,
                equipement_id=camera.equipement.id,
                type_alerte="panne_camera",
                niveau_urgence="eleve",
                statut="non_traitee",
                description=(
                    f"Caméra « {camera.equipement.identifiant_mqtt} » hors ligne — {raison}"
                ),
            )
        )
        logger.warning("Caméra %d mise hors ligne : %s", camera_id, raison)

    db.commit()
    return {"camera_id": camera_id, "en_ligne": en_ligne, "raison": raison}


# ---------------------------------------------------------------------------
# Proxy snapshot JPEG  (authentification : Bearer token)
# ---------------------------------------------------------------------------

@camera_stream_router.get("/{camera_id}/snapshot")
async def snapshot_proxy(
    camera_id: int,
    current_user: models.Utilisateur = Depends(require_employe),
    db: Session = Depends(get_db),
):
    """Récupère un snapshot JPEG depuis la caméra et le retransmet au navigateur."""
    camera = _obtenir_camera(camera_id, current_user.entreprise_id, db)

    if not camera.equipement.adresse_ip:
        raise HTTPException(status_code=503, detail="Aucune adresse IP configurée.")

    url = camera.lien_snapshot or f"http://{camera.equipement.adresse_ip}/capture"

    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT_S) as client:
            r = await client.get(url)
            r.raise_for_status()
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Caméra inaccessible : {exc}")

    return Response(
        content=r.content,
        media_type=r.headers.get("content-type", "image/jpeg"),
        headers={"Cache-Control": "no-cache, no-store, must-revalidate"},
    )


# ---------------------------------------------------------------------------
# Proxy flux MJPEG  (authentification : ?token=<JWT>)
# ---------------------------------------------------------------------------

@camera_stream_router.get("/{camera_id}/stream")
async def stream_mjpeg(
    camera_id: int,
    current_user: models.Utilisateur = Depends(_utilisateur_token_query),
    db: Session = Depends(get_db),
):
    """
    Relaye le flux MJPEG de la caméra Jortan vers le navigateur.
    Authentification via ?token=<JWT> car les balises <img> ne peuvent pas
    transmettre d'en-tête Authorization.
    """
    camera = _obtenir_camera(camera_id, current_user.entreprise_id, db)

    if not camera.equipement.adresse_ip:
        raise HTTPException(
            status_code=503,
            detail="Aucune adresse IP configurée pour le streaming.",
        )

    stream_url = camera.lien_flux_video or f"http://{camera.equipement.adresse_ip}/stream"

    async def generer_flux():
        try:
            async with httpx.AsyncClient(
                timeout=httpx.Timeout(connect=_TIMEOUT_S, read=None, write=5.0, pool=5.0),
            ) as client:
                async with client.stream("GET", stream_url) as response:
                    if response.status_code >= 400:
                        logger.warning(
                            "Flux caméra %d : HTTP %d", camera_id, response.status_code
                        )
                        return
                    async for chunk in response.aiter_bytes(chunk_size=8192):
                        yield chunk
        except Exception as exc:
            logger.info("Flux caméra %d interrompu : %s", camera_id, exc)

    return StreamingResponse(
        generer_flux(),
        media_type="multipart/x-mixed-replace; boundary=frame",
        headers={"Cache-Control": "no-cache", "Connection": "keep-alive"},
    )
