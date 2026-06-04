from datetime import datetime
from typing import Any, List, Optional

from pydantic import BaseModel, Field


class ConfiguredBaseModel(BaseModel):
    model_config = {"from_attributes": True}


# ==================== AUTH ====================

class Token(ConfiguredBaseModel):
    access_token: str
    token_type: str


class TokenData(ConfiguredBaseModel):
    email: Optional[str] = None
    role: Optional[str] = None
    entreprise_id: Optional[int] = None
    user_id: Optional[int] = None


# ==================== ENTREPRISES ====================

class EntrepriseCreate(ConfiguredBaseModel):
    nom_entreprise: str
    image_entreprise: Optional[str] = None


class EntrepriseUpdate(ConfiguredBaseModel):
    nom_entreprise: Optional[str] = None
    image_entreprise: Optional[str] = None
    etat: Optional[bool] = None


class EntrepriseRead(ConfiguredBaseModel):
    id: int
    nom_entreprise: str
    image_entreprise: Optional[str] = None
    etat: bool
    date_creation: datetime


# ==================== BUREAUX ====================

class BureauCreate(ConfiguredBaseModel):
    nom_bureau: str
    etage: Optional[str] = None
    etat: bool = True


class BureauUpdate(ConfiguredBaseModel):
    nom_bureau: Optional[str] = None
    etage: Optional[str] = None
    etat: Optional[bool] = None


class BureauRead(ConfiguredBaseModel):
    id: int
    entreprise_id: int
    nom_bureau: str
    etage: Optional[str] = None
    etat: bool
    date_creation: datetime


# ==================== UTILISATEURS ====================

class AdminRegisterCreate(ConfiguredBaseModel):
    """Inscription admin + création entreprise en une seule requête."""
    nom_entreprise: str
    nom: str
    prenom: str
    email: str
    mot_de_passe: str


class UtilisateurCreate(ConfiguredBaseModel):
    nom: str
    prenom: str
    email: str
    mot_de_passe: str
    role: str  # 'administrateur' | 'employe'
    bureau_id: Optional[int] = None  # requis pour 'employe'


class UtilisateurUpdate(ConfiguredBaseModel):
    nom: Optional[str] = None
    prenom: Optional[str] = None
    email: Optional[str] = None
    mot_de_passe: Optional[str] = None
    bureau_id: Optional[int] = None
    etat: Optional[bool] = None


class UtilisateurRead(ConfiguredBaseModel):
    id: int
    entreprise_id: int
    bureau_id: Optional[int] = None
    nom: str
    prenom: str
    email: str
    role: str
    etat: bool
    date_creation: datetime


# ==================== EQUIPEMENTS ====================

class EquipementCreate(ConfiguredBaseModel):
    bureau_id: int
    type_equipement: str  # camera, porte, lampe, detecteur_mq2, ...
    identifiant_mqtt: str
    etat: str = "inactif"  # actif, inactif, en_panne, maintenance
    adresse_ip: Optional[str] = None


class EquipementUpdate(ConfiguredBaseModel):
    type_equipement: Optional[str] = None
    identifiant_mqtt: Optional[str] = None
    etat: Optional[str] = None
    adresse_ip: Optional[str] = None


class EquipementRead(ConfiguredBaseModel):
    id: int
    entreprise_id: int
    bureau_id: int
    type_equipement: str
    identifiant_mqtt: str
    etat: str
    adresse_ip: Optional[str] = None
    date_creation: datetime


# ==================== CAMERAS ====================

class CameraCreate(ConfiguredBaseModel):
    bureau_id: int
    identifiant_mqtt: str
    adresse_ip: Optional[str] = None
    etat: str = "inactif"
    resolution: str = "640x480"
    lien_flux_video: Optional[str] = None
    lien_snapshot: Optional[str] = None
    enregistrement_actif: bool = False


class CameraUpdate(ConfiguredBaseModel):
    identifiant_mqtt: Optional[str] = None
    adresse_ip: Optional[str] = None
    etat: Optional[str] = None
    resolution: Optional[str] = None
    lien_flux_video: Optional[str] = None
    lien_snapshot: Optional[str] = None
    enregistrement_actif: Optional[bool] = None


class CameraRead(ConfiguredBaseModel):
    id: int
    equipement_id: int
    resolution: str
    lien_flux_video: Optional[str] = None
    lien_snapshot: Optional[str] = None
    enregistrement_actif: bool
    equipement: EquipementRead


# ==================== PORTES ====================

class PorteCreate(ConfiguredBaseModel):
    bureau_id: int
    identifiant_mqtt: str
    adresse_ip: Optional[str] = None
    etat: str = "inactif"
    etat_verrou: str = "verrouille"  # ouvert, verrouille, en_attente
    mode_ouverture: str = "manuel"   # manuel, automatique, distance
    duree_ouverture_sec: int = 5


class PorteUpdate(ConfiguredBaseModel):
    identifiant_mqtt: Optional[str] = None
    adresse_ip: Optional[str] = None
    etat: Optional[str] = None
    etat_verrou: Optional[str] = None
    mode_ouverture: Optional[str] = None
    duree_ouverture_sec: Optional[int] = None
    derniere_ouverture: Optional[datetime] = None


class PorteRead(ConfiguredBaseModel):
    id: int
    equipement_id: int
    etat_verrou: str
    mode_ouverture: str
    duree_ouverture_sec: int
    derniere_ouverture: Optional[datetime] = None
    equipement: EquipementRead


# ==================== LAMPES ====================

class LampeCreate(ConfiguredBaseModel):
    bureau_id: int
    identifiant_mqtt: str
    adresse_ip: Optional[str] = None
    etat: str = "inactif"
    etat_lumiere: str = "eteint"  # allume, eteint
    intensite_pct: int = Field(default=100, ge=0, le=100)
    mode_auto: bool = False


class LampeUpdate(ConfiguredBaseModel):
    identifiant_mqtt: Optional[str] = None
    adresse_ip: Optional[str] = None
    etat: Optional[str] = None
    etat_lumiere: Optional[str] = None
    intensite_pct: Optional[int] = Field(default=None, ge=0, le=100)
    mode_auto: Optional[bool] = None


class LampeRead(ConfiguredBaseModel):
    id: int
    equipement_id: int
    etat_lumiere: str
    intensite_pct: int
    mode_auto: bool
    equipement: EquipementRead


# ==================== DETECTEURS ====================

class DetecteurCreate(ConfiguredBaseModel):
    bureau_id: int
    identifiant_mqtt: str
    adresse_ip: Optional[str] = None
    etat: str = "inactif"
    type_detecteur: str  # mq2, flamme, pir, ultrason, temperature_humidite
    seuil_alerte: Optional[float] = None
    unite_mesure: Optional[str] = None


class DetecteurUpdate(ConfiguredBaseModel):
    identifiant_mqtt: Optional[str] = None
    adresse_ip: Optional[str] = None
    etat: Optional[str] = None
    type_detecteur: Optional[str] = None
    seuil_alerte: Optional[float] = None
    unite_mesure: Optional[str] = None
    derniere_valeur: Optional[float] = None
    date_derniere_lecture: Optional[datetime] = None


class DetecteurRead(ConfiguredBaseModel):
    id: int
    equipement_id: int
    type_detecteur: str
    seuil_alerte: Optional[float] = None
    unite_mesure: Optional[str] = None
    derniere_valeur: Optional[float] = None
    date_derniere_lecture: Optional[datetime] = None
    equipement: EquipementRead


# ==================== CODES D'ACCES ====================

class CodeAccesCreate(ConfiguredBaseModel):
    porte_id: int
    utilisateur_id: Optional[int] = None
    code_pin: str  # PIN en clair — sera haché avant stockage
    limite_utilisations: Optional[int] = None
    expire_le: Optional[datetime] = None


class CodeAccesUpdate(ConfiguredBaseModel):
    etat: Optional[bool] = None
    limite_utilisations: Optional[int] = None
    expire_le: Optional[datetime] = None


class CodeAccesRead(ConfiguredBaseModel):
    id: int
    porte_id: int
    utilisateur_id: Optional[int] = None
    etat: bool
    nombre_utilisations: int
    limite_utilisations: Optional[int] = None
    expire_le: Optional[datetime] = None
    date_creation: datetime


# ==================== HISTORIQUE ACCES ====================

class HistoriqueAccesCreate(ConfiguredBaseModel):
    porte_id: int
    utilisateur_id: Optional[int] = None
    methode_ouverture: str  # code_pin, application, mqtt, manuel
    resultat: str           # succes, echec, timeout


class HistoriqueAccesRead(ConfiguredBaseModel):
    id: int
    porte_id: int
    utilisateur_id: Optional[int] = None
    methode_ouverture: str
    resultat: str
    date_acces: datetime


# ==================== ALERTES ====================

class AlerteCreate(ConfiguredBaseModel):
    bureau_id: int
    equipement_id: Optional[int] = None
    type_alerte: str        # incendie, intrusion, gaz, temperature, mouvement, erreur_code, equipement_hors_ligne, autre
    niveau_urgence: str = "moyen"  # faible, moyen, eleve, critique
    description: str


class AlerteUpdate(ConfiguredBaseModel):
    statut: Optional[str] = None       # non_traitee, en_cours, resolue, ignoree
    niveau_urgence: Optional[str] = None
    traite_par: Optional[int] = None
    date_traitement: Optional[datetime] = None


class AlerteRead(ConfiguredBaseModel):
    id: int
    entreprise_id: int
    bureau_id: int
    equipement_id: Optional[int] = None
    type_alerte: str
    niveau_urgence: str
    statut: str
    description: str
    traite_par: Optional[int] = None
    date_alerte: datetime
    date_traitement: Optional[datetime] = None


# ==================== JOURNAL MQTT ====================

class JournalMqttCreate(ConfiguredBaseModel):
    bureau_id: int
    equipement_id: Optional[int] = None
    sujet_mqtt: str
    contenu: Optional[Any] = None
    direction: str  # recu, envoye


class JournalMqttRead(ConfiguredBaseModel):
    id: int
    entreprise_id: int
    bureau_id: int
    equipement_id: Optional[int] = None
    sujet_mqtt: str
    contenu: Optional[Any] = None
    direction: str
    date_reception: datetime


# ==================== JOURNAL SYSTEME ====================

class JournalSystemeCreate(ConfiguredBaseModel):
    action: str
    type_entite: Optional[str] = None
    identifiant_entite: Optional[int] = None
    details: Optional[str] = None
    adresse_ip: Optional[str] = None
    utilisateur_id: Optional[int] = None
    entreprise_id: Optional[int] = None


class JournalSystemeRead(ConfiguredBaseModel):
    id: int
    entreprise_id: Optional[int] = None
    utilisateur_id: Optional[int] = None
    action: str
    type_entite: Optional[str] = None
    identifiant_entite: Optional[int] = None
    details: Optional[str] = None
    adresse_ip: Optional[str] = None
    date_action: datetime
