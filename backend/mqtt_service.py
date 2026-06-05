"""
Service MQTT — client singleton pour le backend Smart Bureau.

Cycle de vie :
  start_mqtt()  →  appelé au démarrage de l'application (main.py on_startup)
  stop_mqtt()   →  appelé à l'arrêt         (main.py on_shutdown)

API publique :
  publier_commande(entreprise_id, bureau_id, identifiant_mqtt, commande) → bool
  est_connecte() → bool

Topics utilisés :
  Commande  → smartbureau/{ent}/{bureau}/{id}/commande   (publish)
  Statut    ← smartbureau/{ent}/{bureau}/{id}/statut     (subscribe)
  Donnée    ← smartbureau/{ent}/{bureau}/{id}/donnee     (subscribe)
  Alerte    ← smartbureau/{ent}/{bureau}/{id}/alerte     (subscribe)
"""

import json
import logging
import os
import threading
from datetime import datetime, timezone
from typing import Optional

import paho.mqtt.client as mqtt

logger = logging.getLogger(__name__)

_client: Optional[mqtt.Client] = None
_connected: bool = False
_lock = threading.Lock()


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _topic(entreprise_id: int, bureau_id: int, identifiant: str, suffixe: str) -> str:
    return f"smartbureau/{entreprise_id}/{bureau_id}/{identifiant}/{suffixe}"


# ─── Callbacks MQTT ───────────────────────────────────────────────────────────

def _on_connect(client, userdata, flags, rc):
    global _connected
    if rc == 0:
        _connected = True
        logger.info("MQTT: connecté au broker.")
        client.subscribe("smartbureau/+/+/+/donnee", qos=1)
        client.subscribe("smartbureau/+/+/+/statut",  qos=0)
        client.subscribe("smartbureau/+/+/+/alerte",  qos=1)
    else:
        _connected = False
        logger.error(f"MQTT: échec connexion broker, RC={rc}")


def _on_disconnect(client, userdata, rc):
    global _connected
    _connected = False
    if rc != 0:
        logger.warning(f"MQTT: déconnexion inattendue RC={rc} — reconnexion auto en cours...")


def _on_message(client, userdata, msg):
    """Traite chaque message entrant en provenance d'un ESP8266."""
    try:
        topic = msg.topic
        raw = msg.payload.decode("utf-8", errors="replace")
        payload: dict = json.loads(raw) if raw.strip() else {}
        logger.debug(f"MQTT ← {topic}: {payload}")

        parts = topic.split("/")
        if len(parts) != 5:
            return
        _, ent_id_s, bureau_id_s, identifiant, suffixe = parts
        entreprise_id = int(ent_id_s)
        bureau_id = int(bureau_id_s)

        # Import différé pour éviter les imports circulaires au démarrage
        from database import SessionLocal
        import models

        db = SessionLocal()
        try:
            equip = (
                db.query(models.Equipement)
                .filter(
                    models.Equipement.identifiant_mqtt == identifiant,
                    models.Equipement.entreprise_id == entreprise_id,
                )
                .first()
            )
            if not equip:
                logger.warning(f"MQTT: équipement inconnu '{identifiant}' (entreprise {entreprise_id})")
                return

            # Journal de tout message reçu
            db.add(models.JournalMessageMqtt(
                entreprise_id=entreprise_id,
                bureau_id=bureau_id,
                equipement_id=equip.id,
                sujet_mqtt=topic,
                contenu=payload,
                direction="recu",
            ))

            if suffixe == "donnee":
                _traiter_donnee(db, equip, payload)
            elif suffixe == "statut":
                _traiter_statut(db, equip, payload)
            elif suffixe == "alerte":
                _traiter_alerte_hardware(db, equip, payload)

            db.commit()
        finally:
            db.close()

    except json.JSONDecodeError:
        logger.warning(f"MQTT: payload non-JSON sur {msg.topic}")
    except Exception:
        logger.exception("MQTT: erreur inattendue dans _on_message")


# ─── Traitements métier ───────────────────────────────────────────────────────

def _traiter_donnee(db, equip, payload: dict):
    """Met à jour la dernière valeur d'un capteur et déclenche une alerte si seuil dépassé."""
    import models

    valeur = payload.get("valeur")
    if valeur is None or not equip.detecteur:
        return

    det = equip.detecteur
    det.derniere_valeur = float(valeur)
    det.date_derniere_lecture = datetime.now(timezone.utc)

    if det.seuil_alerte and float(valeur) >= float(det.seuil_alerte):
        _TYPE_MAP = {
            "mq2": "gaz",
            "flamme": "incendie",
            "pir": "mouvement",
            "temperature_humidite": "temperature",
            "ultrason": "autre",
        }
        ratio = float(valeur) / float(det.seuil_alerte)
        niveau = "critique" if ratio >= 1.5 else "eleve"

        db.add(models.Alerte(
            entreprise_id=equip.entreprise_id,
            bureau_id=equip.bureau_id,
            equipement_id=equip.id,
            type_alerte=_TYPE_MAP.get(det.type_detecteur, "autre"),
            niveau_urgence=niveau,
            statut="non_traitee",
            description=(
                f"{det.type_detecteur.upper()} : valeur={valeur} {det.unite_mesure or ''}"
                f" — seuil {det.seuil_alerte} dépassé"
            ),
        ))
        logger.warning(
            f"MQTT: alerte {niveau} créée pour {equip.identifiant_mqtt} "
            f"(valeur={valeur}, seuil={det.seuil_alerte})"
        )


def _traiter_statut(db, equip, payload: dict):
    """Met à jour l'état de l'équipement selon le statut rapporté par l'ESP8266."""
    etat = payload.get("etat")
    if etat in ("actif", "inactif", "en_panne", "maintenance"):
        equip.etat = etat

    # Synchronisation état porte
    if equip.porte:
        etat_verrou = payload.get("etat_verrou")
        if etat_verrou in ("ouvert", "verrouille", "en_attente"):
            equip.porte.etat_verrou = etat_verrou

    # Synchronisation état lampe + diffusion WebSocket
    if equip.lampe:
        etat_lumiere = payload.get("etat_lumiere")
        if etat_lumiere in ("allume", "eteint"):
            equip.lampe.etat_lumiere = etat_lumiere
            from ws_manager import lamp_ws_manager
            lamp_ws_manager.broadcast_from_thread(
                equip.entreprise_id,
                {
                    "type": "lamp_update",
                    "id": equip.lampe.id,
                    "etat_lumiere": etat_lumiere,
                    "intensite_pct": equip.lampe.intensite_pct,
                },
            )


def _traiter_alerte_hardware(db, equip, payload: dict):
    """Crée une alerte à partir d'un message d'urgence envoyé par l'ESP8266."""
    import models

    db.add(models.Alerte(
        entreprise_id=equip.entreprise_id,
        bureau_id=equip.bureau_id,
        equipement_id=equip.id,
        type_alerte=payload.get("type", "autre"),
        niveau_urgence=payload.get("niveau", "critique"),
        statut="non_traitee",
        description=payload.get("description", "Alerte matérielle détectée par l'ESP8266"),
    ))
    logger.warning(f"MQTT: alerte matérielle reçue de {equip.identifiant_mqtt}")


# ─── API publique ─────────────────────────────────────────────────────────────

def start_mqtt() -> None:
    """Démarre le client MQTT en arrière-plan. Échec non bloquant."""
    global _client

    host = os.getenv("MQTT_HOST", "localhost")
    port = int(os.getenv("MQTT_PORT", "1883"))
    username = os.getenv("MQTT_USERNAME", "")
    password = os.getenv("MQTT_PASSWORD", "")

    _client = mqtt.Client(
        client_id="smartbureau_backend",
        clean_session=True,
        protocol=mqtt.MQTTv311,
    )
    _client.on_connect    = _on_connect
    _client.on_disconnect = _on_disconnect
    _client.on_message    = _on_message

    if username:
        _client.username_pw_set(username, password)

    try:
        _client.connect(host, port, keepalive=60)
        _client.loop_start()
        logger.info(f"MQTT: client démarré → {host}:{port}")
    except Exception:
        logger.exception(
            "MQTT: impossible de se connecter au broker. "
            "Le système fonctionne en mode dégradé (sans IoT)."
        )


def stop_mqtt() -> None:
    global _client
    if _client:
        _client.loop_stop()
        _client.disconnect()
        logger.info("MQTT: client arrêté proprement.")


def publier_commande(
    entreprise_id: int,
    bureau_id: int,
    identifiant_mqtt: str,
    commande: dict,
) -> bool:
    """
    Publie une commande vers un ESP8266.
    Retourne True si la publication a réussi, False sinon.
    """
    global _client, _connected

    if not _client or not _connected:
        logger.error(f"MQTT: non connecté — commande non envoyée vers '{identifiant_mqtt}'.")
        return False

    t = _topic(entreprise_id, bureau_id, identifiant_mqtt, "commande")
    result = _client.publish(t, json.dumps(commande, ensure_ascii=False), qos=1)
    ok = result.rc == mqtt.MQTT_ERR_SUCCESS

    if ok:
        logger.info(f"MQTT → {t}: {commande}")
    else:
        logger.error(f"MQTT: échec publication → {t}")

    return ok


def est_connecte() -> bool:
    return _connected
