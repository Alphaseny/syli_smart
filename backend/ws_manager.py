"""
Gestionnaire WebSocket pour les mises à jour temps réel des lampes.

Usage :
  - Côté async (routes FastAPI) : await lamp_ws_manager.broadcast(entreprise_id, data)
  - Côté sync  (callbacks MQTT) : lamp_ws_manager.broadcast_from_thread(entreprise_id, data)
"""

import asyncio
import logging
from typing import Optional

from fastapi import WebSocket

logger = logging.getLogger(__name__)


class LampWebSocketManager:
    def __init__(self) -> None:
        # { entreprise_id: [WebSocket, ...] }
        self._connections: dict[int, list[WebSocket]] = {}
        self._loop: Optional[asyncio.AbstractEventLoop] = None

    def set_loop(self, loop: asyncio.AbstractEventLoop) -> None:
        """Enregistre la boucle asyncio principale (appelé au startup)."""
        self._loop = loop

    async def connect(self, ws: WebSocket, entreprise_id: int) -> None:
        await ws.accept()
        self._connections.setdefault(entreprise_id, []).append(ws)
        logger.info(f"WS: nouveau client connecté (entreprise {entreprise_id}) "
                    f"— {len(self._connections[entreprise_id])} connexion(s) active(s)")

    def disconnect(self, ws: WebSocket, entreprise_id: int) -> None:
        conns = self._connections.get(entreprise_id, [])
        if ws in conns:
            conns.remove(ws)
        logger.info(f"WS: client déconnecté (entreprise {entreprise_id})")

    async def broadcast(self, entreprise_id: int, data: dict) -> None:
        """Diffuse un message à tous les clients de l'entreprise (contexte async)."""
        conns = list(self._connections.get(entreprise_id, []))
        morts = []
        for ws in conns:
            try:
                await ws.send_json(data)
            except Exception:
                morts.append(ws)
        for ws in morts:
            self.disconnect(ws, entreprise_id)

    def broadcast_from_thread(self, entreprise_id: int, data: dict) -> None:
        """Diffuse depuis un thread synchrone (callback MQTT)."""
        if self._loop and self._loop.is_running():
            asyncio.run_coroutine_threadsafe(
                self.broadcast(entreprise_id, data),
                self._loop,
            )


# Singleton partagé par tous les modules
lamp_ws_manager = LampWebSocketManager()
