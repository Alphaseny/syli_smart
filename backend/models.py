from sqlalchemy import (
    BigInteger, Boolean, Column, DateTime, ForeignKey,
    Integer, Numeric, SmallInteger, String, Text, func,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship

from database import Base


class Entreprise(Base):
    __tablename__ = "entreprises"

    id = Column(Integer, primary_key=True, index=True)
    nom_entreprise = Column(String(150), nullable=False)
    image_entreprise = Column(Text, nullable=True)
    etat = Column(Boolean, nullable=False, default=True)
    date_creation = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    bureaux = relationship("Bureau", back_populates="entreprise", cascade="all, delete-orphan")
    utilisateurs = relationship("Utilisateur", back_populates="entreprise", cascade="all, delete-orphan")
    equipements = relationship("Equipement", back_populates="entreprise", cascade="all, delete-orphan")
    alertes = relationship("Alerte", back_populates="entreprise", cascade="all, delete-orphan")
    journal_mqtt = relationship("JournalMessageMqtt", back_populates="entreprise", cascade="all, delete-orphan")
    journal_systeme = relationship("JournalSysteme", back_populates="entreprise", cascade="all, delete-orphan")


class Bureau(Base):
    __tablename__ = "bureaux"

    id = Column(Integer, primary_key=True, index=True)
    entreprise_id = Column(Integer, ForeignKey("entreprises.id", ondelete="CASCADE"), nullable=False)
    nom_bureau = Column(String(100), nullable=False)
    etage = Column(String(20), nullable=True)
    etat = Column(Boolean, nullable=False, default=True)
    date_creation = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    entreprise = relationship("Entreprise", back_populates="bureaux")
    utilisateurs = relationship("Utilisateur", back_populates="bureau")
    equipements = relationship("Equipement", back_populates="bureau", cascade="all, delete-orphan")
    alertes = relationship("Alerte", back_populates="bureau", cascade="all, delete-orphan")
    journal_mqtt = relationship("JournalMessageMqtt", back_populates="bureau", cascade="all, delete-orphan")


class Utilisateur(Base):
    __tablename__ = "utilisateurs"

    id = Column(Integer, primary_key=True, index=True)
    entreprise_id = Column(Integer, ForeignKey("entreprises.id", ondelete="CASCADE"), nullable=False)
    bureau_id = Column(Integer, ForeignKey("bureaux.id", ondelete="SET NULL"), nullable=True)
    nom = Column(String(100), nullable=False)
    prenom = Column(String(100), nullable=False)
    email = Column(String(150), unique=True, nullable=False)
    mot_de_passe = Column(String(255), nullable=False)
    role = Column(String(30), nullable=False)  # 'administrateur' | 'employe'
    etat = Column(Boolean, nullable=False, default=True)
    langue_preferee = Column(String(10), nullable=False, default="fr")
    autorisations = Column(JSONB, nullable=True)
    date_creation = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    entreprise = relationship("Entreprise", back_populates="utilisateurs")
    bureau = relationship("Bureau", back_populates="utilisateurs")
    codes_acces = relationship("CodeAcces", back_populates="utilisateur")
    historique_acces = relationship("HistoriqueAcces", back_populates="utilisateur")
    alertes_traitees = relationship(
        "Alerte", back_populates="traite_par_utilisateur", foreign_keys="[Alerte.traite_par]"
    )
    journal_systeme = relationship("JournalSysteme", back_populates="utilisateur")
    encodages_faciaux = relationship("EncodageFacial", back_populates="utilisateur", cascade="all, delete-orphan")
    cartes_rfid = relationship("CarteRfid", back_populates="utilisateur", cascade="all, delete-orphan")
    notifications = relationship("Notification", back_populates="utilisateur", cascade="all, delete-orphan")
    rappels = relationship("Rappel", back_populates="utilisateur", cascade="all, delete-orphan")


class EncodageFacial(Base):
    """Stocke l'embedding facial (128 floats) d'un utilisateur pour l'ouverture de porte."""
    __tablename__ = "encodages_faciaux"

    id = Column(Integer, primary_key=True, index=True)
    entreprise_id = Column(Integer, ForeignKey("entreprises.id", ondelete="CASCADE"), nullable=False)
    utilisateur_id = Column(Integer, ForeignKey("utilisateurs.id", ondelete="CASCADE"), nullable=False)
    nom_label = Column(String(200), nullable=False)          # Nom affiché lors de l'identification
    encoding = Column(JSONB, nullable=False)                  # Vecteur 128 floats (face_recognition)
    date_creation = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    utilisateur = relationship("Utilisateur", back_populates="encodages_faciaux")


class Equipement(Base):
    __tablename__ = "equipements"

    id = Column(Integer, primary_key=True, index=True)
    entreprise_id = Column(Integer, ForeignKey("entreprises.id", ondelete="CASCADE"), nullable=False)
    bureau_id = Column(Integer, ForeignKey("bureaux.id", ondelete="CASCADE"), nullable=False)
    type_equipement = Column(String(50), nullable=False)
    identifiant_mqtt = Column(String(100), unique=True, nullable=False)
    etat = Column(String(30), nullable=False, default="inactif")
    adresse_ip = Column(String(45), nullable=True)
    date_creation = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    entreprise = relationship("Entreprise", back_populates="equipements")
    bureau = relationship("Bureau", back_populates="equipements")
    camera = relationship("Camera", back_populates="equipement", uselist=False, cascade="all, delete-orphan")
    porte = relationship("Porte", back_populates="equipement", uselist=False, cascade="all, delete-orphan")
    lampe = relationship("Lampe", back_populates="equipement", uselist=False, cascade="all, delete-orphan")
    detecteur = relationship("Detecteur", back_populates="equipement", uselist=False, cascade="all, delete-orphan")
    alertes = relationship("Alerte", back_populates="equipement")
    journal_mqtt = relationship("JournalMessageMqtt", back_populates="equipement")


class Camera(Base):
    __tablename__ = "cameras"

    id = Column(Integer, primary_key=True, index=True)
    equipement_id = Column(Integer, ForeignKey("equipements.id", ondelete="CASCADE"), unique=True, nullable=False)
    resolution = Column(String(20), nullable=False, default="640x480")
    lien_flux_video = Column(Text, nullable=True)
    lien_snapshot = Column(Text, nullable=True)
    enregistrement_actif = Column(Boolean, nullable=False, default=False)

    equipement = relationship("Equipement", back_populates="camera")


class Porte(Base):
    __tablename__ = "portes"

    id = Column(Integer, primary_key=True, index=True)
    equipement_id = Column(Integer, ForeignKey("equipements.id", ondelete="CASCADE"), unique=True, nullable=False)
    etat_verrou = Column(String(20), nullable=False, default="verrouille")
    mode_ouverture = Column(String(20), nullable=False, default="manuel")
    duree_ouverture_sec = Column(SmallInteger, nullable=False, default=5)
    derniere_ouverture = Column(DateTime(timezone=True), nullable=True)
    tentatives_echouees = Column(Integer, nullable=False, default=0)
    verrouille_jusqu_a = Column(DateTime(timezone=True), nullable=True)

    equipement = relationship("Equipement", back_populates="porte")
    codes_acces = relationship("CodeAcces", back_populates="porte", cascade="all, delete-orphan")
    historique_acces = relationship("HistoriqueAcces", back_populates="porte", cascade="all, delete-orphan")


class Lampe(Base):
    __tablename__ = "lampes"

    id = Column(Integer, primary_key=True, index=True)
    equipement_id = Column(Integer, ForeignKey("equipements.id", ondelete="CASCADE"), unique=True, nullable=False)
    etat_lumiere = Column(String(20), nullable=False, default="eteint")
    mode_auto = Column(Boolean, nullable=False, default=False)

    equipement = relationship("Equipement", back_populates="lampe")


class Detecteur(Base):
    __tablename__ = "detecteurs"

    id = Column(Integer, primary_key=True, index=True)
    equipement_id = Column(Integer, ForeignKey("equipements.id", ondelete="CASCADE"), unique=True, nullable=False)
    type_detecteur = Column(String(30), nullable=False)
    seuil_alerte = Column(Numeric(10, 4), nullable=True)
    unite_mesure = Column(String(20), nullable=True)
    derniere_valeur = Column(Numeric(10, 4), nullable=True)
    date_derniere_lecture = Column(DateTime(timezone=True), nullable=True)

    equipement = relationship("Equipement", back_populates="detecteur")


class CodeAcces(Base):
    __tablename__ = "codes_acces"

    id = Column(Integer, primary_key=True, index=True)
    porte_id = Column(Integer, ForeignKey("portes.id", ondelete="CASCADE"), nullable=False)
    utilisateur_id = Column(Integer, ForeignKey("utilisateurs.id", ondelete="SET NULL"), nullable=True)
    code_hache = Column(String(255), nullable=False)
    etat = Column(Boolean, nullable=False, default=True)
    nombre_utilisations = Column(Integer, nullable=False, default=0)
    limite_utilisations = Column(Integer, nullable=True)
    expire_le = Column(DateTime(timezone=True), nullable=True)
    date_creation = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    porte = relationship("Porte", back_populates="codes_acces")
    utilisateur = relationship("Utilisateur", back_populates="codes_acces")


class HistoriqueAcces(Base):
    __tablename__ = "historique_acces"

    id = Column(Integer, primary_key=True, index=True)
    porte_id = Column(Integer, ForeignKey("portes.id", ondelete="CASCADE"), nullable=False)
    utilisateur_id = Column(Integer, ForeignKey("utilisateurs.id", ondelete="SET NULL"), nullable=True)
    methode_ouverture = Column(String(30), nullable=False)  # code_pin, application, mqtt, manuel
    resultat = Column(String(20), nullable=False)  # succes, echec, timeout
    date_acces = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    porte = relationship("Porte", back_populates="historique_acces")
    utilisateur = relationship("Utilisateur", back_populates="historique_acces")


class Alerte(Base):
    __tablename__ = "alertes"

    id = Column(Integer, primary_key=True, index=True)
    entreprise_id = Column(Integer, ForeignKey("entreprises.id", ondelete="CASCADE"), nullable=False)
    bureau_id = Column(Integer, ForeignKey("bureaux.id", ondelete="CASCADE"), nullable=False)
    equipement_id = Column(Integer, ForeignKey("equipements.id", ondelete="SET NULL"), nullable=True)
    type_alerte = Column(String(50), nullable=False)
    niveau_urgence = Column(String(20), nullable=False, default="moyen")
    statut = Column(String(20), nullable=False, default="non_traitee")
    description = Column(Text, nullable=False)
    traite_par = Column(Integer, ForeignKey("utilisateurs.id", ondelete="SET NULL"), nullable=True)
    date_alerte = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    date_traitement = Column(DateTime(timezone=True), nullable=True)

    entreprise = relationship("Entreprise", back_populates="alertes")
    bureau = relationship("Bureau", back_populates="alertes")
    equipement = relationship("Equipement", back_populates="alertes")
    traite_par_utilisateur = relationship(
        "Utilisateur", back_populates="alertes_traitees", foreign_keys="[Alerte.traite_par]"
    )


class JournalMessageMqtt(Base):
    __tablename__ = "journal_messages_mqtt"

    id = Column(BigInteger, primary_key=True, index=True)
    entreprise_id = Column(Integer, ForeignKey("entreprises.id", ondelete="CASCADE"), nullable=False)
    bureau_id = Column(Integer, ForeignKey("bureaux.id", ondelete="CASCADE"), nullable=False)
    equipement_id = Column(Integer, ForeignKey("equipements.id", ondelete="SET NULL"), nullable=True)
    sujet_mqtt = Column(Text, nullable=False)
    contenu = Column(JSONB, nullable=True)
    direction = Column(String(10), nullable=False)  # recu | envoye
    date_reception = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    entreprise = relationship("Entreprise", back_populates="journal_mqtt")
    bureau = relationship("Bureau", back_populates="journal_mqtt")
    equipement = relationship("Equipement", back_populates="journal_mqtt")


class JournalSysteme(Base):
    __tablename__ = "journal_systeme"

    id = Column(BigInteger, primary_key=True, index=True)
    entreprise_id = Column(Integer, ForeignKey("entreprises.id", ondelete="CASCADE"), nullable=True)
    utilisateur_id = Column(Integer, ForeignKey("utilisateurs.id", ondelete="SET NULL"), nullable=True)
    action = Column(String(100), nullable=False)
    type_entite = Column(String(50), nullable=True)
    identifiant_entite = Column(Integer, nullable=True)
    details = Column(Text, nullable=True)
    adresse_ip = Column(String(45), nullable=True)
    date_action = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    entreprise = relationship("Entreprise", back_populates="journal_systeme")
    utilisateur = relationship("Utilisateur", back_populates="journal_systeme")


class CarteRfid(Base):
    __tablename__ = "cartes_rfid"

    id = Column(Integer, primary_key=True, index=True)
    entreprise_id = Column(Integer, ForeignKey("entreprises.id", ondelete="CASCADE"), nullable=False)
    utilisateur_id = Column(Integer, ForeignKey("utilisateurs.id", ondelete="SET NULL"), nullable=True)
    uid_carte = Column(String(50), unique=True, nullable=False)
    etat = Column(Boolean, nullable=False, default=True)
    date_creation = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    entreprise = relationship("Entreprise")
    utilisateur = relationship("Utilisateur", back_populates="cartes_rfid")


class ConsommationEnergie(Base):
    __tablename__ = "consommations_energie"

    id = Column(Integer, primary_key=True, index=True)
    entreprise_id = Column(Integer, ForeignKey("entreprises.id", ondelete="CASCADE"), nullable=False)
    bureau_id = Column(Integer, ForeignKey("bureaux.id", ondelete="CASCADE"), nullable=False)
    equipement_id = Column(Integer, ForeignKey("equipements.id", ondelete="CASCADE"), nullable=False)
    date_heure = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    valeur_kwh = Column(Numeric(10, 4), nullable=False)

    entreprise = relationship("Entreprise")
    bureau = relationship("Bureau")
    equipement = relationship("Equipement")


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)
    utilisateur_id = Column(Integer, ForeignKey("utilisateurs.id", ondelete="CASCADE"), nullable=False)
    titre = Column(String(150), nullable=False)
    message = Column(Text, nullable=False)
    lue = Column(Boolean, nullable=False, default=False)
    type = Column(String(30), nullable=False)  # 'alerte' | 'securite' | 'rappel'
    date_creation = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    utilisateur = relationship("Utilisateur", back_populates="notifications")


class Rappel(Base):
    __tablename__ = "rappels"

    id = Column(Integer, primary_key=True, index=True)
    utilisateur_id = Column(Integer, ForeignKey("utilisateurs.id", ondelete="CASCADE"), nullable=False)
    bureau_id = Column(Integer, ForeignKey("bureaux.id", ondelete="CASCADE"), nullable=False)
    titre = Column(String(150), nullable=False)
    description = Column(Text, nullable=True)
    date_rappel = Column(DateTime(timezone=True), nullable=False)
    type_rapel = Column(String(20), nullable=False)
    execute = Column(Boolean, nullable=False, default=False)
    date_creation = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    utilisateur = relationship("Utilisateur", back_populates="rappels")
    bureau = relationship("Bureau")
