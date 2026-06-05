"""
Router WebSocket — mises à jour temps réel de l'état des lampes.

Endpoint : ws://host/api/ws/lights?token=<JWT>

Le client passe son token JWT en query string car les navigateurs
ne permettent pas d'envoyer des headers personnalisés en WebSocket.
"""

import logging
from typing import Optional

from fastapi import APIRouter, Query, WebSocket, WebSocketDisconnect
from jose import JWTError, jwt
from sqlalchemy.orm import Session

import models
from auth import ALGORITHM, JWT_SECRET_KEY
from database import SessionLocal
from ws_manager import lamp_ws_manager

logger = logging.getLogger(__name__)
ws_router = APIRouter(tags=["WebSocket"])


def _utilisateur_depuis_token(token: str, db: Session) -> Optional[models.Utilisateur]:
    """Valide le JWT et retourne l'utilisateur ou None si invalide/inactif."""
    try:
        payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub", "")
        if not email:
            return None
        user = db.query(models.Utilisateur).filter(
            models.Utilisateur.email == email,
            models.Utilisateur.etat == True,
        ).first()
        return user
    except JWTError:
        return None


@ws_router.websocket("/ws/lights")
async def websocket_lights(
    websocket: WebSocket,
    token: str = Query(..., description="Token JWT de l'utilisateur connecté"),
):
    """
    Connexion WebSocket pour recevoir en temps réel les changements d'état des lampes.

    Messages envoyés par le serveur :
      { "type": "lamp_update", "id": int, "etat_lumiere": str, "intensite_pct": int }

    Le client doit envoyer "ping" toutes les 30 s pour maintenir la connexion.
    """
    db = SessionLocal()
    try:
        user = _utilisateur_depuis_token(token, db)
    finally:
        db.close()

    if not user:
        await websocket.close(code=4001, reason="Token invalide ou compte inactif.")
        return

    await lamp_ws_manager.connect(websocket, user.entreprise_id)
    try:
        while True:
            # Maintien de la connexion — le client envoie "ping"
            await websocket.receive_text()
    except WebSocketDisconnect:
        lamp_ws_manager.disconnect(websocket, user.entreprise_id)
