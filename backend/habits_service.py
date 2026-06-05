from datetime import datetime, timedelta, timezone
from sqlalchemy.orm import Session
from sqlalchemy import func
import models


def analyser_habitudes_et_suggestions(db: Session, entreprise_id: int) -> list[dict]:
    """
    Analyse les logs MQTT d'allumage des lampes des 7 derniers jours.
    Suggère des configurations d'automatisation d'éclairage.
    """
    maintenant = datetime.now(timezone.utc)
    il_y_a_7_jours = maintenant - timedelta(days=7)

    # Récupérer les messages MQTT envoyés de type commande pour allumer
    messages = (
        db.query(models.JournalMessageMqtt)
        .filter(
            models.JournalMessageMqtt.entreprise_id == entreprise_id,
            models.JournalMessageMqtt.date_reception >= il_y_a_7_jours,
            models.JournalMessageMqtt.sujet_mqtt.like("%/commande%")
        )
        .all()
    )

    # Dictionnaire temporaire pour compter : { (equipement_id, heure): occurrences }
    patrons_allumage = {}

    for msg in messages:
        try:
            contenu = msg.contenu
            if not isinstance(contenu, dict):
                continue
            action = contenu.get("action")
            if action == "allumer":
                local_time = msg.date_reception.replace(tzinfo=timezone.utc)
                heure = local_time.hour
                key = (msg.equipement_id, heure)
                patrons_allumage[key] = patrons_allumage.get(key, 0) + 1
        except Exception:
            continue

    suggestions = []

    # Seuil : au moins 3 allumages à la même heure sur 7 jours
    for (equip_id, heure), count in patrons_allumage.items():
        if count >= 3:
            equip = db.query(models.Equipement).filter(models.Equipement.id == equip_id).first()
            if not equip:
                continue

            suggestions.append({
                "equipement_id": equip_id,
                "identifiant_mqtt": equip.identifiant_mqtt,
                "bureau_id": equip.bureau_id,
                "type": "allumage_auto",
                "heure_suggeree": f"{heure:02d}:00",
                "message": (
                    f"Nous avons remarqué que vous allumez régulièrement la lampe '{equip.identifiant_mqtt}' "
                    f"autour de {heure}h ({count} fois cette semaine). Voulez-vous programmer son allumage automatique à cette heure ?"
                )
            })

    # Si pas d'historique suffisant, générer des suggestions par défaut réalistes
    if not suggestions:
        # Trouver les lampes existantes pour proposer des suggestions types
        lampes = db.query(models.Lampe).join(models.Equipement).filter(
            models.Equipement.entreprise_id == entreprise_id
        ).all()
        for lampe in lampes[:2]:
            suggestions.append({
                "equipement_id": lampe.equipement_id,
                "identifiant_mqtt": lampe.equipement.identifiant_mqtt,
                "bureau_id": lampe.equipement.bureau_id,
                "type": "allumage_auto",
                "heure_suggeree": "08:30",
                "message": (
                    f"Planifiez l'allumage automatique de '{lampe.equipement.identifiant_mqtt}' "
                    f"à 08h30 lors de votre arrivée habituelle au bureau."
                )
            })
            suggestions.append({
                "equipement_id": lampe.equipement_id,
                "identifiant_mqtt": lampe.equipement.identifiant_mqtt,
                "bureau_id": lampe.equipement.bureau_id,
                "type": "extinction_auto",
                "heure_suggeree": "18:30",
                "message": (
                    f"Programmez l'extinction de sécurité de '{lampe.equipement.identifiant_mqtt}' "
                    f"à 18h30 en fin de journée pour économiser l'énergie."
                )
            })

    return suggestions
