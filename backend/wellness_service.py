from datetime import datetime, timedelta, timezone
from sqlalchemy.orm import Session
import models


def verifier_inactivite_bureau(db: Session, entreprise_id: int, seuil_heures: float = 2.0):
    """
    Vérifie si un collaborateur (notamment senior) n'a eu aucune activité PIR
    détectée dans son bureau assigné depuis plus de seuil_heures.
    Déclenche une notification si c'est le cas.
    """
    maintenant = datetime.now(timezone.utc)
    
    # Ne verifier que pendant les heures ouvrées réelles (09:00 - 18:00) en semaine
    if maintenant.weekday() >= 5 or maintenant.hour < 9 or maintenant.hour >= 18:
        return

    limite_inactivite = maintenant - timedelta(hours=seuil_heures)

    # Récupérer les utilisateurs actifs avec rôle 'senior' ou 'employe'
    utilisateurs = db.query(models.Utilisateur).filter(
        models.Utilisateur.entreprise_id == entreprise_id,
        models.Utilisateur.etat == True,
        models.Utilisateur.role.in_(["senior", "employe"]),
        models.Utilisateur.bureau_id != None
    ).all()

    for user in utilisateurs:
        # Vérifier si l'utilisateur est entré aujourd'hui
        acces_aujourdhui = db.query(models.HistoriqueAcces).join(models.Porte).join(models.Equipement).filter(
            models.HistoriqueAcces.utilisateur_id == user.id,
            models.HistoriqueAcces.resultat == "succes",
            models.HistoriqueAcces.date_acces >= maintenant.replace(hour=0, minute=0, second=0)
        ).first()

        if not acces_aujourdhui:
            # L'employé n'est pas venu aujourd'hui, ne pas lever d'alerte d'inactivité
            continue

        # Trouver le capteur PIR dans son bureau
        pir_equip = db.query(models.Equipement).filter(
            models.Equipement.bureau_id == user.bureau_id,
            models.Equipement.type_equipement == "detecteur_pir"
        ).first()

        if not pir_equip or not pir_equip.detecteur:
            continue

        # Vérifier la date du dernier mouvement
        dernier_mouv = pir_equip.detecteur.date_derniere_lecture
        valeur = pir_equip.detecteur.derniere_valeur

        # Si aucune lecture ou dernière lecture trop ancienne (ou pas de mouvement = 0)
        if not dernier_mouv or (dernier_mouv.replace(tzinfo=timezone.utc) < limite_inactivite):
            # Lever une notification d'inactivité
            titre = "Alerte d'inactivité"
            msg = f"Aucun mouvement détecté dans le bureau de {user.prenom} {user.nom} depuis plus de {seuil_heures} heures."
            
            # Éviter de dupliquer la même notification si elle n'est pas lue
            deja_notifie = db.query(models.Notification).filter(
                models.Notification.utilisateur_id == user.id,
                models.Notification.titre == titre,
                models.Notification.lue == False
            ).first()

            if not deja_notifie:
                nouvelle_notif = models.Notification(
                    utilisateur_id=user.id,
                    titre=titre,
                    message=msg,
                    type="alerte",
                    lue=False
                )
                db.add(nouvelle_notif)
                
                # Aussi lever une Alerte globale pour l'administrateur
                db.add(models.Alerte(
                    entreprise_id=entreprise_id,
                    bureau_id=user.bureau_id,
                    equipement_id=pir_equip.id,
                    type_alerte="inactivite",
                    niveau_urgence="moyen",
                    statut="non_traitee",
                    description=msg
                ))
    db.commit()


def executer_rappels_dus(db: Session):
    """
    Parcourt la table 'rappels' et crée des notifications pour les rappels en attente.
    """
    maintenant = datetime.now(timezone.utc)
    rappels_dus = db.query(models.Rappel).filter(
        models.Rappel.date_rappel <= maintenant,
        models.Rappel.execute == False
    ).all()

    for rappel in rappels_dus:
        # Créer la notification associée
        notif = models.Notification(
            utilisateur_id=rappel.utilisateur_id,
            titre=f"Rappel : {rappel.titre}",
            message=rappel.description or "Rappel planifié",
            type="rappel",
            lue=False
        )
        db.add(notif)
        rappel.execute = True
    db.commit()
