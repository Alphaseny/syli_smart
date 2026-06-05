import random
from datetime import datetime, timedelta, timezone
from sqlalchemy.orm import Session
from sqlalchemy import func
import models


def simuler_consommation_7_jours(db: Session, entreprise_id: int):
    """Génère des données de consommation réalistes pour les 7 derniers jours si elles n'existent pas."""
    # Vérifier s'il y a déjà de la consommation
    existe = db.query(models.ConsommationEnergie).filter(
        models.ConsommationEnergie.entreprise_id == entreprise_id
    ).first()
    if existe:
        return

    # Récupérer toutes les lampes de l'entreprise
    lampes = (
        db.query(models.Lampe)
        .join(models.Equipement)
        .filter(models.Equipement.entreprise_id == entreprise_id)
        .all()
    )

    if not lampes:
        return

    maintenant = datetime.now(timezone.utc)
    # Pour chaque jour sur les 7 derniers jours
    for jour_offset in range(7):
        date_jour = maintenant - timedelta(days=jour_offset)
        # Générer pour chaque heure ouvrée (08:00 à 18:00)
        for heure in range(8, 19):
            date_heure = date_jour.replace(hour=heure, minute=0, second=0, microsecond=0)
            for lampe in lampes:
                # Simuler une consommation aléatoire mais réaliste (0.01 à 0.06 kWh)
                valeur = random.uniform(0.015, 0.055)
                # Légère réduction le weekend
                if date_heure.weekday() >= 5:
                    valeur *= 0.1  # presque rien allumé

                conso = models.ConsommationEnergie(
                    entreprise_id=entreprise_id,
                    bureau_id=lampe.equipement.bureau_id,
                    equipement_id=lampe.equipement.id,
                    date_heure=date_heure,
                    valeur_kwh=valeur
                )
                db.add(conso)
    db.commit()


def obtenir_stats_consommation(db: Session, entreprise_id: int, periode: str = "semaine"):
    """
    Retourne la consommation totale et le détail par pièce/bureau.
    periode : "jour" | "semaine" | "mois"
    """
    maintenant = datetime.now(timezone.utc)
    if periode == "jour":
        debut = maintenant - timedelta(days=1)
    elif periode == "mois":
        debut = maintenant - timedelta(days=30)
    else:  # semaine par défaut
        debut = maintenant - timedelta(days=7)

    # Consommation totale par bureau
    stats_bureau = (
        db.query(
            models.Bureau.nom_bureau,
            func.sum(models.ConsommationEnergie.valeur_kwh).label("total")
        )
        .join(models.ConsommationEnergie, models.ConsommationEnergie.bureau_id == models.Bureau.id)
        .filter(models.ConsommationEnergie.entreprise_id == entreprise_id)
        .filter(models.ConsommationEnergie.date_heure >= debut)
        .group_by(models.Bureau.nom_bureau)
        .all()
    )

    # Consommation totale par équipement (lampe)
    stats_equip = (
        db.query(
            models.Equipement.identifiant_mqtt,
            func.sum(models.ConsommationEnergie.valeur_kwh).label("total")
        )
        .join(models.ConsommationEnergie, models.ConsommationEnergie.equipement_id == models.Equipement.id)
        .filter(models.ConsommationEnergie.entreprise_id == entreprise_id)
        .filter(models.ConsommationEnergie.date_heure >= debut)
        .group_by(models.Equipement.identifiant_mqtt)
        .all()
    )

    detail_bureau = {row[0]: float(row[1]) for row in stats_bureau}
    detail_equip = {row[0]: float(row[1]) for row in stats_equip}
    total_conso = sum(detail_bureau.values())

    return {
        "total_kwh": round(total_conso, 2),
        "par_bureau": detail_bureau,
        "par_equipement": detail_equip,
    }


def generer_recommandations(db: Session, entreprise_id: int) -> list[str]:
    """Génère des conseils d'optimisation d'énergie personnalisés."""
    bureaux = db.query(models.Bureau).filter(
        models.Bureau.entreprise_id == entreprise_id,
        models.Bureau.etat == True
    ).all()

    recommandations = []
    for bureau in bureaux:
        # Trouver les lampes de ce bureau
        lampes = db.query(models.Lampe).join(models.Equipement).filter(
            models.Equipement.bureau_id == bureau.id
        ).all()
        
        for lampe in lampes:
            if lampe.etat_lumiere == "allume" and lampe.intensite_pct > 75:
                pourcentage_economie = int(lampe.intensite_pct * 0.15)
                recommandations.append(
                    f"Vous économiseriez environ {pourcentage_economie}% sur l'équipement '{lampe.equipement.identifiant_mqtt}' "
                    f"en réduisant son intensité à 60% dans le '{bureau.nom_bureau}'."
                )

    # Recommandation globale si aucune
    if not recommandations:
        recommandations.append(
            "Activez le mode 'Économie d'énergie' général pour réduire automatiquement l'intensité de 20% après 18h."
        )

    return recommandations[:3]


def verifier_surconsommation_alerte(db: Session, entreprise_id: int, seuil_journalier: float = 25.0):
    """Vérifie la consommation journalière globale et génère une alerte si elle dépasse le seuil."""
    maintenant = datetime.now(timezone.utc)
    debut_jour = maintenant.replace(hour=0, minute=0, second=0, microsecond=0)

    total_aujourdhui = (
        db.query(func.sum(models.ConsommationEnergie.valeur_kwh))
        .filter(
            models.ConsommationEnergie.entreprise_id == entreprise_id,
            models.ConsommationEnergie.date_heure >= debut_jour
        )
        .scalar()
    ) or 0.0

    if float(total_aujourdhui) > seuil_journalier:
        # Vérifier si une alerte de surconsommation existe déjà aujourd'hui
        existe = db.query(models.Alerte).filter(
            models.Alerte.entreprise_id == entreprise_id,
            models.Alerte.type_alerte == "surconsommation",
            models.Alerte.date_alerte >= debut_jour
        ).first()

        if not existe:
            # Récupérer le premier bureau pour l'alerte
            bureau = db.query(models.Bureau).filter(models.Bureau.entreprise_id == entreprise_id).first()
            bureau_id = bureau.id if bureau else 1

            nouvelle_alerte = models.Alerte(
                entreprise_id=entreprise_id,
                bureau_id=bureau_id,
                type_alerte="surconsommation",
                niveau_urgence="moyen",
                statut="non_traitee",
                description=f"Alerte de surconsommation globale : {round(float(total_aujourdhui), 2)} kWh consommés aujourd'hui (seuil = {seuil_journalier} kWh)."
            )
            db.add(nouvelle_alerte)
            db.commit()
