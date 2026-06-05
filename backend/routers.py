from datetime import datetime, timedelta, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

import models
import schemas
from auth import (
    ACCESS_TOKEN_EXPIRE_MINUTES,
    authenticate_user,
    create_access_token,
    get_current_active_user,
    require_admin,
    require_employe,
)
from database import get_db
from security import hash_password
import energy_service
import habits_service
import wellness_service

router = APIRouter(prefix="/api")
auth_router = APIRouter(prefix="/auth", tags=["Authentification"])
resource_router = APIRouter(tags=["Smart Bureau"])


# ===========================================================================
# AUTH
# ===========================================================================

@auth_router.post("/token", response_model=schemas.Token)
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = authenticate_user(db, form_data.username, form_data.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email ou mot de passe invalide.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    token = create_access_token(
        data={
            "sub": user.email,
            "role": user.role,
            "entreprise_id": user.entreprise_id,
            "user_id": user.id,
        },
        expires_delta=timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES),
    )
    return {"access_token": token, "token_type": "bearer"}


@auth_router.post("/register", response_model=schemas.UtilisateurRead, status_code=status.HTTP_201_CREATED)
def register_admin(payload: schemas.AdminRegisterCreate, db: Session = Depends(get_db)):
    """Crée une entreprise et son premier administrateur en une seule opération."""
    email = payload.email.strip().lower()
    if db.query(models.Utilisateur).filter(models.Utilisateur.email == email).first():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Cet email est déjà utilisé.")

    entreprise = models.Entreprise(nom_entreprise=payload.nom_entreprise)
    db.add(entreprise)
    db.flush()

    try:
        mot_de_passe_hache = hash_password(payload.mot_de_passe)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))

    admin = models.Utilisateur(
        entreprise_id=entreprise.id,
        bureau_id=None,
        nom=payload.nom,
        prenom=payload.prenom,
        email=email,
        mot_de_passe=mot_de_passe_hache,
        role="administrateur",
        etat=True,
    )
    db.add(admin)
    db.commit()
    db.refresh(admin)
    return admin


@auth_router.get("/me", response_model=schemas.UtilisateurRead)
def get_me(current_user: models.Utilisateur = Depends(get_current_active_user)):
    return current_user


# ===========================================================================
# HELPERS — isolation multi-tenant
# ===========================================================================

def _filtrer_bureau_employe(query, current_user: models.Utilisateur):
    """Restreint automatiquement la requête au bureau de l'employé."""
    if current_user.role == "employe" and current_user.bureau_id:
        from sqlalchemy import and_
        query = query.filter(models.Equipement.bureau_id == current_user.bureau_id)
    return query


def _bureau_ou_404(bureau_id: int, entreprise_id: int, db: Session) -> models.Bureau:
    bureau = db.query(models.Bureau).filter(
        models.Bureau.id == bureau_id,
        models.Bureau.entreprise_id == entreprise_id,
    ).first()
    if not bureau:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Bureau non trouvé.")
    return bureau


def _equipement_ou_404(equip_id: int, entreprise_id: int, db: Session) -> models.Equipement:
    equip = db.query(models.Equipement).filter(
        models.Equipement.id == equip_id,
        models.Equipement.entreprise_id == entreprise_id,
    ).first()
    if not equip:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Équipement non trouvé.")
    return equip


def _utilisateur_ou_404(user_id: int, entreprise_id: int, db: Session) -> models.Utilisateur:
    user = db.query(models.Utilisateur).filter(
        models.Utilisateur.id == user_id,
        models.Utilisateur.entreprise_id == entreprise_id,
    ).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Utilisateur non trouvé.")
    return user


def _porte_ou_404(porte_id: int, entreprise_id: int, db: Session) -> models.Porte:
    porte = (
        db.query(models.Porte)
        .join(models.Equipement)
        .filter(models.Porte.id == porte_id, models.Equipement.entreprise_id == entreprise_id)
        .first()
    )
    if not porte:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Porte non trouvée.")
    return porte


def _verifier_mqtt_unique(identifiant_mqtt: str, db: Session, exclude_id: Optional[int] = None):
    query = db.query(models.Equipement).filter(
        models.Equipement.identifiant_mqtt == identifiant_mqtt
    )
    if exclude_id:
        query = query.filter(models.Equipement.id != exclude_id)
    if query.first():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Identifiant MQTT déjà utilisé.")


def _creer_equipement(
    db: Session,
    entreprise_id: int,
    bureau_id: int,
    type_equipement: str,
    identifiant_mqtt: str,
    etat: str,
    adresse_ip: Optional[str],
) -> models.Equipement:
    _verifier_mqtt_unique(identifiant_mqtt, db)
    equip = models.Equipement(
        entreprise_id=entreprise_id,
        bureau_id=bureau_id,
        type_equipement=type_equipement,
        identifiant_mqtt=identifiant_mqtt,
        etat=etat,
        adresse_ip=adresse_ip,
    )
    db.add(equip)
    db.flush()
    return equip


def _appliquer_update_equipement(equip: models.Equipement, data: dict, db: Session):
    equip_fields = {"identifiant_mqtt", "adresse_ip", "etat"}
    for field, value in data.items():
        if field in equip_fields:
            if field == "identifiant_mqtt":
                _verifier_mqtt_unique(value, db, exclude_id=equip.id)
            setattr(equip, field, value)


# ===========================================================================
# ENTREPRISE
# ===========================================================================

@resource_router.get("/entreprises", response_model=schemas.EntrepriseRead)
def get_entreprise(current_user: models.Utilisateur = Depends(require_employe), db: Session = Depends(get_db)):
    entreprise = db.query(models.Entreprise).filter(models.Entreprise.id == current_user.entreprise_id).first()
    if not entreprise:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Entreprise non trouvée.")
    return entreprise


@resource_router.put("/entreprises", response_model=schemas.EntrepriseRead)
def update_entreprise(
    payload: schemas.EntrepriseUpdate,
    current_user: models.Utilisateur = Depends(require_admin),
    db: Session = Depends(get_db),
):
    entreprise = db.query(models.Entreprise).filter(models.Entreprise.id == current_user.entreprise_id).first()
    if not entreprise:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Entreprise non trouvée.")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(entreprise, field, value)
    db.commit()
    db.refresh(entreprise)
    return entreprise


# ===========================================================================
# BUREAUX
# ===========================================================================

@resource_router.get("/bureaux", response_model=List[schemas.BureauRead])
def list_bureaux(
    skip: int = 0,
    limit: int = 100,
    current_user: models.Utilisateur = Depends(require_employe),
    db: Session = Depends(get_db),
):
    query = db.query(models.Bureau).filter(
        models.Bureau.entreprise_id == current_user.entreprise_id
    )
    # Les employés ne voient que les bureaux actifs
    if current_user.role == "employe":
        query = query.filter(models.Bureau.etat == True)
    return query.offset(skip).limit(limit).all()


@resource_router.get("/bureaux/{bureau_id}", response_model=schemas.BureauRead)
def get_bureau(
    bureau_id: int,
    current_user: models.Utilisateur = Depends(require_employe),
    db: Session = Depends(get_db),
):
    return _bureau_ou_404(bureau_id, current_user.entreprise_id, db)


@resource_router.post("/bureaux", response_model=schemas.BureauRead, status_code=status.HTTP_201_CREATED)
def create_bureau(
    payload: schemas.BureauCreate,
    current_user: models.Utilisateur = Depends(require_admin),
    db: Session = Depends(get_db),
):
    bureau = models.Bureau(entreprise_id=current_user.entreprise_id, **payload.model_dump())
    db.add(bureau)
    db.commit()
    db.refresh(bureau)
    return bureau


@resource_router.put("/bureaux/{bureau_id}", response_model=schemas.BureauRead)
def update_bureau(
    bureau_id: int,
    payload: schemas.BureauUpdate,
    current_user: models.Utilisateur = Depends(require_admin),
    db: Session = Depends(get_db),
):
    bureau = _bureau_ou_404(bureau_id, current_user.entreprise_id, db)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(bureau, field, value)
    db.commit()
    db.refresh(bureau)
    return bureau


@resource_router.delete("/bureaux/{bureau_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_bureau(
    bureau_id: int,
    current_user: models.Utilisateur = Depends(require_admin),
    db: Session = Depends(get_db),
):
    bureau = _bureau_ou_404(bureau_id, current_user.entreprise_id, db)
    db.delete(bureau)
    db.commit()


# ===========================================================================
# UTILISATEURS
# ===========================================================================

@resource_router.get("/utilisateurs", response_model=List[schemas.UtilisateurRead], dependencies=[Depends(require_admin)])
def list_utilisateurs(skip: int = 0, limit: int = 100, current_user: models.Utilisateur = Depends(require_admin), db: Session = Depends(get_db)):
    return (
        db.query(models.Utilisateur)
        .filter(models.Utilisateur.entreprise_id == current_user.entreprise_id)
        .offset(skip)
        .limit(limit)
        .all()
    )


@resource_router.get("/utilisateurs/{user_id}", response_model=schemas.UtilisateurRead, dependencies=[Depends(require_admin)])
def get_utilisateur(user_id: int, current_user: models.Utilisateur = Depends(require_admin), db: Session = Depends(get_db)):
    return _utilisateur_ou_404(user_id, current_user.entreprise_id, db)


@resource_router.post("/utilisateurs", response_model=schemas.UtilisateurRead, status_code=status.HTTP_201_CREATED)
def create_utilisateur(
    payload: schemas.UtilisateurCreate,
    current_user: models.Utilisateur = Depends(require_admin),
    db: Session = Depends(get_db),
):
    role = payload.role.strip().lower()
    if role not in {"administrateur", "employe"}:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Rôle invalide.")
    if role != "administrateur" and payload.bureau_id is None:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="bureau_id est requis pour ce rôle.")
    if payload.bureau_id:
        _bureau_ou_404(payload.bureau_id, current_user.entreprise_id, db)

    email = payload.email.strip().lower()
    if db.query(models.Utilisateur).filter(models.Utilisateur.email == email).first():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Cet email est déjà utilisé.")

    try:
        mot_de_passe_hache = hash_password(payload.mot_de_passe)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))

    user = models.Utilisateur(
        entreprise_id=current_user.entreprise_id,
        bureau_id=payload.bureau_id,
        nom=payload.nom,
        prenom=payload.prenom,
        email=email,
        mot_de_passe=mot_de_passe_hache,
        role=role,
        etat=True,
        langue_preferee=payload.langue_preferee or "fr",
        autorisations=payload.autorisations,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@resource_router.put("/utilisateurs/{user_id}", response_model=schemas.UtilisateurRead)
def update_utilisateur(
    user_id: int,
    payload: schemas.UtilisateurUpdate,
    current_user: models.Utilisateur = Depends(require_admin),
    db: Session = Depends(get_db),
):
    user = _utilisateur_ou_404(user_id, current_user.entreprise_id, db)
    data = payload.model_dump(exclude_unset=True)

    if "email" in data:
        data["email"] = data["email"].strip().lower()
        if db.query(models.Utilisateur).filter(
            models.Utilisateur.email == data["email"],
            models.Utilisateur.id != user_id,
        ).first():
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Cet email est déjà utilisé.")

    if "mot_de_passe" in data:
        try:
            data["mot_de_passe"] = hash_password(data["mot_de_passe"])
        except ValueError as exc:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))

    if "bureau_id" in data and data["bureau_id"]:
        _bureau_ou_404(data["bureau_id"], current_user.entreprise_id, db)

    for field, value in data.items():
        setattr(user, field, value)
    db.commit()
    db.refresh(user)
    return user


@resource_router.delete("/utilisateurs/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_utilisateur(
    user_id: int,
    current_user: models.Utilisateur = Depends(require_admin),
    db: Session = Depends(get_db),
):
    user = _utilisateur_ou_404(user_id, current_user.entreprise_id, db)
    if user.id == current_user.id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Impossible de désactiver son propre compte.")
    # Désactivation douce — ne supprime pas réellement le compte
    user.etat = False
    db.commit()


# ===========================================================================
# EQUIPEMENTS (table parente)
# ===========================================================================

@resource_router.get("/equipements", response_model=List[schemas.EquipementRead])
def list_equipements(
    skip: int = 0,
    limit: int = 100,
    bureau_id: Optional[int] = None,
    current_user: models.Utilisateur = Depends(require_employe),
    db: Session = Depends(get_db),
):
    query = db.query(models.Equipement).filter(models.Equipement.entreprise_id == current_user.entreprise_id)
    if bureau_id:
        query = query.filter(models.Equipement.bureau_id == bureau_id)
    # Employé : restreint à son bureau
    elif current_user.role == "employe" and current_user.bureau_id:
        query = query.filter(models.Equipement.bureau_id == current_user.bureau_id)
    return query.offset(skip).limit(limit).all()


@resource_router.get("/equipements/{equip_id}", response_model=schemas.EquipementRead)
def get_equipement(
    equip_id: int,
    current_user: models.Utilisateur = Depends(require_employe),
    db: Session = Depends(get_db),
):
    return _equipement_ou_404(equip_id, current_user.entreprise_id, db)


@resource_router.post("/equipements", response_model=schemas.EquipementRead, status_code=status.HTTP_201_CREATED)
def create_equipement(
    payload: schemas.EquipementCreate,
    current_user: models.Utilisateur = Depends(require_admin),
    db: Session = Depends(get_db),
):
    _bureau_ou_404(payload.bureau_id, current_user.entreprise_id, db)
    equip = _creer_equipement(
        db,
        entreprise_id=current_user.entreprise_id,
        bureau_id=payload.bureau_id,
        type_equipement=payload.type_equipement,
        identifiant_mqtt=payload.identifiant_mqtt,
        etat=payload.etat,
        adresse_ip=payload.adresse_ip,
    )
    db.commit()
    db.refresh(equip)
    return equip


@resource_router.put("/equipements/{equip_id}", response_model=schemas.EquipementRead)
def update_equipement(
    equip_id: int,
    payload: schemas.EquipementUpdate,
    current_user: models.Utilisateur = Depends(require_admin),
    db: Session = Depends(get_db),
):
    equip = _equipement_ou_404(equip_id, current_user.entreprise_id, db)
    data = payload.model_dump(exclude_unset=True)
    _appliquer_update_equipement(equip, data, db)
    db.commit()
    db.refresh(equip)
    return equip


@resource_router.delete("/equipements/{equip_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_equipement(
    equip_id: int,
    current_user: models.Utilisateur = Depends(require_admin),
    db: Session = Depends(get_db),
):
    equip = _equipement_ou_404(equip_id, current_user.entreprise_id, db)
    db.delete(equip)
    db.commit()


# ===========================================================================
# CAMERAS
# ===========================================================================

def _camera_ou_404(camera_id: int, entreprise_id: int, db: Session) -> models.Camera:
    camera = (
        db.query(models.Camera)
        .join(models.Equipement)
        .filter(models.Camera.id == camera_id, models.Equipement.entreprise_id == entreprise_id)
        .first()
    )
    if not camera:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Caméra non trouvée.")
    return camera


@resource_router.get("/cameras", response_model=List[schemas.CameraRead])
def list_cameras(
    skip: int = 0,
    limit: int = 100,
    current_user: models.Utilisateur = Depends(require_employe),
    db: Session = Depends(get_db),
):
    query = (
        db.query(models.Camera)
        .join(models.Equipement)
        .filter(models.Equipement.entreprise_id == current_user.entreprise_id)
    )
    query = _filtrer_bureau_employe(query, current_user)
    return query.offset(skip).limit(limit).all()


@resource_router.get("/cameras/{camera_id}", response_model=schemas.CameraRead)
def get_camera(
    camera_id: int,
    current_user: models.Utilisateur = Depends(require_employe),
    db: Session = Depends(get_db),
):
    return _camera_ou_404(camera_id, current_user.entreprise_id, db)


@resource_router.post("/cameras", response_model=schemas.CameraRead, status_code=status.HTTP_201_CREATED)
def create_camera(
    payload: schemas.CameraCreate,
    current_user: models.Utilisateur = Depends(require_admin),
    db: Session = Depends(get_db),
):
    _bureau_ou_404(payload.bureau_id, current_user.entreprise_id, db)
    equip = _creer_equipement(
        db,
        entreprise_id=current_user.entreprise_id,
        bureau_id=payload.bureau_id,
        type_equipement="camera",
        identifiant_mqtt=payload.identifiant_mqtt,
        etat=payload.etat,
        adresse_ip=payload.adresse_ip,
    )
    camera = models.Camera(
        equipement_id=equip.id,
        resolution=payload.resolution,
        lien_flux_video=payload.lien_flux_video,
        lien_snapshot=payload.lien_snapshot,
        enregistrement_actif=payload.enregistrement_actif,
    )
    db.add(camera)
    db.commit()
    db.refresh(camera)
    return camera


@resource_router.put("/cameras/{camera_id}", response_model=schemas.CameraRead)
def update_camera(
    camera_id: int,
    payload: schemas.CameraUpdate,
    current_user: models.Utilisateur = Depends(require_admin),
    db: Session = Depends(get_db),
):
    camera = _camera_ou_404(camera_id, current_user.entreprise_id, db)
    data = payload.model_dump(exclude_unset=True)
    equip_fields = {"identifiant_mqtt", "adresse_ip", "etat"}
    camera_fields = {"resolution", "lien_flux_video", "lien_snapshot", "enregistrement_actif"}

    equip_data = {k: v for k, v in data.items() if k in equip_fields}
    cam_data = {k: v for k, v in data.items() if k in camera_fields}

    _appliquer_update_equipement(camera.equipement, equip_data, db)
    for field, value in cam_data.items():
        setattr(camera, field, value)

    db.commit()
    db.refresh(camera)
    return camera


@resource_router.delete("/cameras/{camera_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_camera(
    camera_id: int,
    current_user: models.Utilisateur = Depends(require_admin),
    db: Session = Depends(get_db),
):
    camera = _camera_ou_404(camera_id, current_user.entreprise_id, db)
    db.delete(camera.equipement)  # CASCADE supprime la caméra
    db.commit()


# ===========================================================================
# PORTES
# ===========================================================================

@resource_router.get("/portes", response_model=List[schemas.PorteRead])
def list_portes(
    skip: int = 0,
    limit: int = 100,
    current_user: models.Utilisateur = Depends(require_employe),
    db: Session = Depends(get_db),
):
    query = (
        db.query(models.Porte)
        .join(models.Equipement)
        .filter(models.Equipement.entreprise_id == current_user.entreprise_id)
    )
    query = _filtrer_bureau_employe(query, current_user)
    return query.offset(skip).limit(limit).all()


@resource_router.get("/portes/{porte_id}", response_model=schemas.PorteRead)
def get_porte(
    porte_id: int,
    current_user: models.Utilisateur = Depends(require_employe),
    db: Session = Depends(get_db),
):
    return _porte_ou_404(porte_id, current_user.entreprise_id, db)


@resource_router.post("/portes", response_model=schemas.PorteRead, status_code=status.HTTP_201_CREATED)
def create_porte(
    payload: schemas.PorteCreate,
    current_user: models.Utilisateur = Depends(require_admin),
    db: Session = Depends(get_db),
):
    _bureau_ou_404(payload.bureau_id, current_user.entreprise_id, db)
    equip = _creer_equipement(
        db,
        entreprise_id=current_user.entreprise_id,
        bureau_id=payload.bureau_id,
        type_equipement="porte",
        identifiant_mqtt=payload.identifiant_mqtt,
        etat=payload.etat,
        adresse_ip=payload.adresse_ip,
    )
    porte = models.Porte(
        equipement_id=equip.id,
        etat_verrou=payload.etat_verrou,
        mode_ouverture=payload.mode_ouverture,
        duree_ouverture_sec=payload.duree_ouverture_sec,
    )
    db.add(porte)
    db.commit()
    db.refresh(porte)
    return porte


@resource_router.put("/portes/{porte_id}", response_model=schemas.PorteRead)
def update_porte(
    porte_id: int,
    payload: schemas.PorteUpdate,
    current_user: models.Utilisateur = Depends(require_admin),
    db: Session = Depends(get_db),
):
    porte = _porte_ou_404(porte_id, current_user.entreprise_id, db)
    data = payload.model_dump(exclude_unset=True)
    equip_fields = {"identifiant_mqtt", "adresse_ip", "etat"}
    porte_fields = {"etat_verrou", "mode_ouverture", "duree_ouverture_sec", "derniere_ouverture"}

    _appliquer_update_equipement(porte.equipement, {k: v for k, v in data.items() if k in equip_fields}, db)
    for field, value in data.items():
        if field in porte_fields:
            setattr(porte, field, value)

    db.commit()
    db.refresh(porte)
    return porte


@resource_router.delete("/portes/{porte_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_porte(
    porte_id: int,
    current_user: models.Utilisateur = Depends(require_admin),
    db: Session = Depends(get_db),
):
    porte = _porte_ou_404(porte_id, current_user.entreprise_id, db)
    db.delete(porte.equipement)
    db.commit()


# ===========================================================================
# LAMPES
# ===========================================================================

def _lampe_ou_404(lampe_id: int, entreprise_id: int, db: Session) -> models.Lampe:
    lampe = (
        db.query(models.Lampe)
        .join(models.Equipement)
        .filter(models.Lampe.id == lampe_id, models.Equipement.entreprise_id == entreprise_id)
        .first()
    )
    if not lampe:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lampe non trouvée.")
    return lampe


@resource_router.get("/lampes", response_model=List[schemas.LampeRead])
def list_lampes(
    skip: int = 0,
    limit: int = 100,
    current_user: models.Utilisateur = Depends(require_employe),
    db: Session = Depends(get_db),
):
    query = (
        db.query(models.Lampe)
        .join(models.Equipement)
        .filter(models.Equipement.entreprise_id == current_user.entreprise_id)
    )
    query = _filtrer_bureau_employe(query, current_user)
    return query.offset(skip).limit(limit).all()


@resource_router.get("/lampes/{lampe_id}", response_model=schemas.LampeRead)
def get_lampe(
    lampe_id: int,
    current_user: models.Utilisateur = Depends(require_employe),
    db: Session = Depends(get_db),
):
    return _lampe_ou_404(lampe_id, current_user.entreprise_id, db)


@resource_router.post("/lampes", response_model=schemas.LampeRead, status_code=status.HTTP_201_CREATED)
def create_lampe(
    payload: schemas.LampeCreate,
    current_user: models.Utilisateur = Depends(require_admin),
    db: Session = Depends(get_db),
):
    _bureau_ou_404(payload.bureau_id, current_user.entreprise_id, db)
    equip = _creer_equipement(
        db,
        entreprise_id=current_user.entreprise_id,
        bureau_id=payload.bureau_id,
        type_equipement="lampe",
        identifiant_mqtt=payload.identifiant_mqtt,
        etat=payload.etat,
        adresse_ip=payload.adresse_ip,
    )
    lampe = models.Lampe(
        equipement_id=equip.id,
        etat_lumiere=payload.etat_lumiere,
        mode_auto=payload.mode_auto,
    )
    db.add(lampe)
    db.commit()
    db.refresh(lampe)
    return lampe


@resource_router.put("/lampes/{lampe_id}", response_model=schemas.LampeRead)
def update_lampe(
    lampe_id: int,
    payload: schemas.LampeUpdate,
    current_user: models.Utilisateur = Depends(require_employe),
    db: Session = Depends(get_db),
):
    lampe = _lampe_ou_404(lampe_id, current_user.entreprise_id, db)
    data = payload.model_dump(exclude_unset=True)
    equip_fields = {"identifiant_mqtt", "adresse_ip", "etat"}
    lampe_fields = {"etat_lumiere", "mode_auto"}

    _appliquer_update_equipement(lampe.equipement, {k: v for k, v in data.items() if k in equip_fields}, db)
    for field, value in data.items():
        if field in lampe_fields:
            setattr(lampe, field, value)

    db.commit()
    db.refresh(lampe)
    return lampe


@resource_router.delete("/lampes/{lampe_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_lampe(
    lampe_id: int,
    current_user: models.Utilisateur = Depends(require_admin),
    db: Session = Depends(get_db),
):
    lampe = _lampe_ou_404(lampe_id, current_user.entreprise_id, db)
    db.delete(lampe.equipement)
    db.commit()


# ===========================================================================
# DETECTEURS
# ===========================================================================

_DETECTEUR_TYPE_TO_EQUIP = {
    "mq2": "detecteur_mq2",
    "flamme": "detecteur_flamme",
    "pir": "detecteur_pir",
    "ultrason": "detecteur_ultrason",
    "temperature_humidite": "capteur_temperature",
}


def _detecteur_ou_404(detecteur_id: int, entreprise_id: int, db: Session) -> models.Detecteur:
    det = (
        db.query(models.Detecteur)
        .join(models.Equipement)
        .filter(models.Detecteur.id == detecteur_id, models.Equipement.entreprise_id == entreprise_id)
        .first()
    )
    if not det:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Détecteur non trouvé.")
    return det


@resource_router.get("/detecteurs", response_model=List[schemas.DetecteurRead])
def list_detecteurs(
    skip: int = 0,
    limit: int = 100,
    current_user: models.Utilisateur = Depends(require_employe),
    db: Session = Depends(get_db),
):
    query = (
        db.query(models.Detecteur)
        .join(models.Equipement)
        .filter(models.Equipement.entreprise_id == current_user.entreprise_id)
    )
    query = _filtrer_bureau_employe(query, current_user)
    return query.offset(skip).limit(limit).all()


@resource_router.get("/detecteurs/{detecteur_id}", response_model=schemas.DetecteurRead)
def get_detecteur(
    detecteur_id: int,
    current_user: models.Utilisateur = Depends(require_employe),
    db: Session = Depends(get_db),
):
    return _detecteur_ou_404(detecteur_id, current_user.entreprise_id, db)


@resource_router.post("/detecteurs", response_model=schemas.DetecteurRead, status_code=status.HTTP_201_CREATED)
def create_detecteur(
    payload: schemas.DetecteurCreate,
    current_user: models.Utilisateur = Depends(require_admin),
    db: Session = Depends(get_db),
):
    _bureau_ou_404(payload.bureau_id, current_user.entreprise_id, db)
    type_equip = _DETECTEUR_TYPE_TO_EQUIP.get(payload.type_detecteur, "autre")
    equip = _creer_equipement(
        db,
        entreprise_id=current_user.entreprise_id,
        bureau_id=payload.bureau_id,
        type_equipement=type_equip,
        identifiant_mqtt=payload.identifiant_mqtt,
        etat=payload.etat,
        adresse_ip=payload.adresse_ip,
    )
    det = models.Detecteur(
        equipement_id=equip.id,
        type_detecteur=payload.type_detecteur,
        seuil_alerte=payload.seuil_alerte,
        unite_mesure=payload.unite_mesure,
    )
    db.add(det)
    db.commit()
    db.refresh(det)
    return det


@resource_router.put("/detecteurs/{detecteur_id}", response_model=schemas.DetecteurRead)
def update_detecteur(
    detecteur_id: int,
    payload: schemas.DetecteurUpdate,
    current_user: models.Utilisateur = Depends(require_admin),
    db: Session = Depends(get_db),
):
    det = _detecteur_ou_404(detecteur_id, current_user.entreprise_id, db)
    data = payload.model_dump(exclude_unset=True)
    equip_fields = {"identifiant_mqtt", "adresse_ip", "etat"}
    det_fields = {"type_detecteur", "seuil_alerte", "unite_mesure", "derniere_valeur", "date_derniere_lecture"}

    _appliquer_update_equipement(det.equipement, {k: v for k, v in data.items() if k in equip_fields}, db)
    for field, value in data.items():
        if field in det_fields:
            setattr(det, field, value)

    db.commit()
    db.refresh(det)
    return det


@resource_router.delete("/detecteurs/{detecteur_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_detecteur(
    detecteur_id: int,
    current_user: models.Utilisateur = Depends(require_admin),
    db: Session = Depends(get_db),
):
    det = _detecteur_ou_404(detecteur_id, current_user.entreprise_id, db)
    db.delete(det.equipement)
    db.commit()


# ===========================================================================
# CODES D'ACCES
# ===========================================================================

def _code_ou_404(code_id: int, entreprise_id: int, db: Session) -> models.CodeAcces:
    code = (
        db.query(models.CodeAcces)
        .join(models.Porte)
        .join(models.Equipement)
        .filter(models.CodeAcces.id == code_id, models.Equipement.entreprise_id == entreprise_id)
        .first()
    )
    if not code:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Code d'accès non trouvé.")
    return code


@resource_router.get("/codes-acces", response_model=List[schemas.CodeAccesRead], dependencies=[Depends(require_admin)])
def list_codes_acces(skip: int = 0, limit: int = 100, current_user: models.Utilisateur = Depends(require_admin), db: Session = Depends(get_db)):
    return (
        db.query(models.CodeAcces)
        .join(models.Porte)
        .join(models.Equipement)
        .filter(models.Equipement.entreprise_id == current_user.entreprise_id)
        .offset(skip)
        .limit(limit)
        .all()
    )


@resource_router.get("/codes-acces/{code_id}", response_model=schemas.CodeAccesRead, dependencies=[Depends(require_admin)])
def get_code_acces(code_id: int, current_user: models.Utilisateur = Depends(require_admin), db: Session = Depends(get_db)):
    return _code_ou_404(code_id, current_user.entreprise_id, db)


@resource_router.post("/codes-acces", response_model=schemas.CodeAccesRead, status_code=status.HTTP_201_CREATED)
def create_code_acces(
    payload: schemas.CodeAccesCreate,
    current_user: models.Utilisateur = Depends(require_admin),
    db: Session = Depends(get_db),
):
    _porte_ou_404(payload.porte_id, current_user.entreprise_id, db)
    if payload.utilisateur_id:
        _utilisateur_ou_404(payload.utilisateur_id, current_user.entreprise_id, db)

    try:
        code_hache = hash_password(payload.code_pin)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))

    code = models.CodeAcces(
        porte_id=payload.porte_id,
        utilisateur_id=payload.utilisateur_id,
        code_hache=code_hache,
        etat=True,
        nombre_utilisations=0,
        limite_utilisations=payload.limite_utilisations,
        expire_le=payload.expire_le,
    )
    db.add(code)
    db.commit()
    db.refresh(code)
    return code


@resource_router.put("/codes-acces/{code_id}", response_model=schemas.CodeAccesRead)
def update_code_acces(
    code_id: int,
    payload: schemas.CodeAccesUpdate,
    current_user: models.Utilisateur = Depends(require_admin),
    db: Session = Depends(get_db),
):
    code = _code_ou_404(code_id, current_user.entreprise_id, db)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(code, field, value)
    db.commit()
    db.refresh(code)
    return code


@resource_router.delete("/codes-acces/{code_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_code_acces(
    code_id: int,
    current_user: models.Utilisateur = Depends(require_admin),
    db: Session = Depends(get_db),
):
    code = _code_ou_404(code_id, current_user.entreprise_id, db)
    db.delete(code)
    db.commit()


# ===========================================================================
# HISTORIQUE D'ACCES
# ===========================================================================

def _historique_ou_404(hist_id: int, entreprise_id: int, db: Session) -> models.HistoriqueAcces:
    hist = (
        db.query(models.HistoriqueAcces)
        .join(models.Porte)
        .join(models.Equipement)
        .filter(models.HistoriqueAcces.id == hist_id, models.Equipement.entreprise_id == entreprise_id)
        .first()
    )
    if not hist:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Historique non trouvé.")
    return hist


@resource_router.get("/historique-acces", response_model=List[schemas.HistoriqueAccesRead])
def list_historique_acces(
    skip: int = 0,
    limit: int = 100,
    porte_id: Optional[int] = None,
    current_user: models.Utilisateur = Depends(require_employe),
    db: Session = Depends(get_db),
):
    query = (
        db.query(models.HistoriqueAcces)
        .join(models.Porte)
        .join(models.Equipement)
        .filter(models.Equipement.entreprise_id == current_user.entreprise_id)
    )
    if porte_id:
        query = query.filter(models.HistoriqueAcces.porte_id == porte_id)
    return query.order_by(models.HistoriqueAcces.date_acces.desc()).offset(skip).limit(limit).all()


@resource_router.get("/historique-acces/{hist_id}", response_model=schemas.HistoriqueAccesRead)
def get_historique_acces(
    hist_id: int,
    current_user: models.Utilisateur = Depends(require_employe),
    db: Session = Depends(get_db),
):
    return _historique_ou_404(hist_id, current_user.entreprise_id, db)


@resource_router.post("/historique-acces", response_model=schemas.HistoriqueAccesRead, status_code=status.HTTP_201_CREATED)
def create_historique_acces(
    payload: schemas.HistoriqueAccesCreate,
    current_user: models.Utilisateur = Depends(require_employe),
    db: Session = Depends(get_db),
):
    _porte_ou_404(payload.porte_id, current_user.entreprise_id, db)
    hist = models.HistoriqueAcces(
        porte_id=payload.porte_id,
        utilisateur_id=payload.utilisateur_id,
        methode_ouverture=payload.methode_ouverture,
        resultat=payload.resultat,
    )
    db.add(hist)
    db.commit()
    db.refresh(hist)
    return hist


@resource_router.delete("/historique-acces/{hist_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_historique_acces(
    hist_id: int,
    current_user: models.Utilisateur = Depends(require_admin),
    db: Session = Depends(get_db),
):
    hist = _historique_ou_404(hist_id, current_user.entreprise_id, db)
    db.delete(hist)
    db.commit()


# ===========================================================================
# ALERTES
# ===========================================================================

def _alerte_ou_404(alerte_id: int, entreprise_id: int, db: Session) -> models.Alerte:
    alerte = db.query(models.Alerte).filter(
        models.Alerte.id == alerte_id,
        models.Alerte.entreprise_id == entreprise_id,
    ).first()
    if not alerte:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Alerte non trouvée.")
    return alerte


@resource_router.get("/alertes", response_model=List[schemas.AlerteRead])
def list_alertes(
    skip: int = 0,
    limit: int = 100,
    statut: Optional[str] = None,
    current_user: models.Utilisateur = Depends(require_employe),
    db: Session = Depends(get_db),
):
    query = db.query(models.Alerte).filter(models.Alerte.entreprise_id == current_user.entreprise_id)
    if statut:
        query = query.filter(models.Alerte.statut == statut)
    return query.order_by(models.Alerte.date_alerte.desc()).offset(skip).limit(limit).all()


@resource_router.get("/alertes/{alerte_id}", response_model=schemas.AlerteRead)
def get_alerte(
    alerte_id: int,
    current_user: models.Utilisateur = Depends(require_employe),
    db: Session = Depends(get_db),
):
    return _alerte_ou_404(alerte_id, current_user.entreprise_id, db)


@resource_router.post("/alertes", response_model=schemas.AlerteRead, status_code=status.HTTP_201_CREATED)
def create_alerte(
    payload: schemas.AlerteCreate,
    current_user: models.Utilisateur = Depends(require_employe),
    db: Session = Depends(get_db),
):
    _bureau_ou_404(payload.bureau_id, current_user.entreprise_id, db)
    if payload.equipement_id:
        _equipement_ou_404(payload.equipement_id, current_user.entreprise_id, db)

    alerte = models.Alerte(
        entreprise_id=current_user.entreprise_id,
        bureau_id=payload.bureau_id,
        equipement_id=payload.equipement_id,
        type_alerte=payload.type_alerte,
        niveau_urgence=payload.niveau_urgence,
        statut="non_traitee",
        description=payload.description,
    )
    db.add(alerte)
    db.commit()
    db.refresh(alerte)
    return alerte


@resource_router.put("/alertes/{alerte_id}", response_model=schemas.AlerteRead)
def update_alerte(
    alerte_id: int,
    payload: schemas.AlerteUpdate,
    current_user: models.Utilisateur = Depends(require_employe),
    db: Session = Depends(get_db),
):
    alerte = _alerte_ou_404(alerte_id, current_user.entreprise_id, db)
    data = payload.model_dump(exclude_unset=True)

    if data.get("statut") in ("resolue", "ignoree"):
        if "traite_par" not in data:
            data["traite_par"] = current_user.id
        if "date_traitement" not in data:
            data["date_traitement"] = datetime.now(timezone.utc)

    for field, value in data.items():
        setattr(alerte, field, value)
    db.commit()
    db.refresh(alerte)
    return alerte


@resource_router.delete("/alertes/{alerte_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_alerte(
    alerte_id: int,
    current_user: models.Utilisateur = Depends(require_admin),
    db: Session = Depends(get_db),
):
    alerte = _alerte_ou_404(alerte_id, current_user.entreprise_id, db)
    db.delete(alerte)
    db.commit()


# ===========================================================================
# JOURNAL MQTT
# ===========================================================================

@resource_router.get("/journal-mqtt", response_model=List[schemas.JournalMqttRead], dependencies=[Depends(require_admin)])
def list_journal_mqtt(skip: int = 0, limit: int = 100, current_user: models.Utilisateur = Depends(require_admin), db: Session = Depends(get_db)):
    return (
        db.query(models.JournalMessageMqtt)
        .filter(models.JournalMessageMqtt.entreprise_id == current_user.entreprise_id)
        .order_by(models.JournalMessageMqtt.date_reception.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )


@resource_router.get("/journal-mqtt/{msg_id}", response_model=schemas.JournalMqttRead, dependencies=[Depends(require_admin)])
def get_journal_mqtt(msg_id: int, current_user: models.Utilisateur = Depends(require_admin), db: Session = Depends(get_db)):
    msg = db.query(models.JournalMessageMqtt).filter(
        models.JournalMessageMqtt.id == msg_id,
        models.JournalMessageMqtt.entreprise_id == current_user.entreprise_id,
    ).first()
    if not msg:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Message MQTT non trouvé.")
    return msg


@resource_router.post("/journal-mqtt", response_model=schemas.JournalMqttRead, status_code=status.HTTP_201_CREATED)
def create_journal_mqtt(
    payload: schemas.JournalMqttCreate,
    current_user: models.Utilisateur = Depends(require_employe),
    db: Session = Depends(get_db),
):
    _bureau_ou_404(payload.bureau_id, current_user.entreprise_id, db)
    if payload.equipement_id:
        _equipement_ou_404(payload.equipement_id, current_user.entreprise_id, db)

    msg = models.JournalMessageMqtt(
        entreprise_id=current_user.entreprise_id,
        bureau_id=payload.bureau_id,
        equipement_id=payload.equipement_id,
        sujet_mqtt=payload.sujet_mqtt,
        contenu=payload.contenu,
        direction=payload.direction,
    )
    db.add(msg)
    db.commit()
    db.refresh(msg)
    return msg


@resource_router.delete("/journal-mqtt/{msg_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_journal_mqtt(
    msg_id: int,
    current_user: models.Utilisateur = Depends(require_admin),
    db: Session = Depends(get_db),
):
    msg = db.query(models.JournalMessageMqtt).filter(
        models.JournalMessageMqtt.id == msg_id,
        models.JournalMessageMqtt.entreprise_id == current_user.entreprise_id,
    ).first()
    if not msg:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Message MQTT non trouvé.")
    db.delete(msg)
    db.commit()


# ===========================================================================
# JOURNAL SYSTEME
# ===========================================================================

@resource_router.get("/journal-systeme", response_model=List[schemas.JournalSystemeRead], dependencies=[Depends(require_admin)])
def list_journal_systeme(skip: int = 0, limit: int = 100, current_user: models.Utilisateur = Depends(require_admin), db: Session = Depends(get_db)):
    return (
        db.query(models.JournalSysteme)
        .filter(models.JournalSysteme.entreprise_id == current_user.entreprise_id)
        .order_by(models.JournalSysteme.date_action.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )


@resource_router.get("/journal-systeme/{entry_id}", response_model=schemas.JournalSystemeRead, dependencies=[Depends(require_admin)])
def get_journal_systeme(entry_id: int, current_user: models.Utilisateur = Depends(require_admin), db: Session = Depends(get_db)):
    entry = db.query(models.JournalSysteme).filter(
        models.JournalSysteme.id == entry_id,
        models.JournalSysteme.entreprise_id == current_user.entreprise_id,
    ).first()
    if not entry:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Entrée non trouvée.")
    return entry


@resource_router.post("/journal-systeme", response_model=schemas.JournalSystemeRead, status_code=status.HTTP_201_CREATED)
def create_journal_systeme(
    payload: schemas.JournalSystemeCreate,
    current_user: models.Utilisateur = Depends(require_employe),
    db: Session = Depends(get_db),
):
    entry = models.JournalSysteme(
        entreprise_id=payload.entreprise_id or current_user.entreprise_id,
        utilisateur_id=payload.utilisateur_id or current_user.id,
        action=payload.action,
        type_entite=payload.type_entite,
        identifiant_entite=payload.identifiant_entite,
        details=payload.details,
        adresse_ip=payload.adresse_ip,
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry


@resource_router.delete("/journal-systeme/{entry_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_journal_systeme(
    entry_id: int,
    current_user: models.Utilisateur = Depends(require_admin),
    db: Session = Depends(get_db),
):
    entry = db.query(models.JournalSysteme).filter(
        models.JournalSysteme.id == entry_id,
        models.JournalSysteme.entreprise_id == current_user.entreprise_id,
    ).first()
    if not entry:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Entrée non trouvée.")
    db.delete(entry)
    db.commit()


# ===========================================================================
# CARTES RFID
# ===========================================================================

@resource_router.get("/cartes-rfid", response_model=List[schemas.CarteRfidRead], dependencies=[Depends(require_employe)])
def list_cartes_rfid(current_user: models.Utilisateur = Depends(require_employe), db: Session = Depends(get_db)):
    return db.query(models.CarteRfid).filter(models.CarteRfid.entreprise_id == current_user.entreprise_id).all()


@resource_router.post("/cartes-rfid", response_model=schemas.CarteRfidRead, status_code=status.HTTP_201_CREATED, dependencies=[Depends(require_admin)])
def create_carte_rfid(payload: schemas.CarteRfidCreate, current_user: models.Utilisateur = Depends(require_admin), db: Session = Depends(get_db)):
    carte = models.CarteRfid(
        entreprise_id=current_user.entreprise_id,
        uid_carte=payload.uid_carte,
        utilisateur_id=payload.utilisateur_id,
        etat=True
    )
    db.add(carte)
    db.commit()
    db.refresh(carte)
    return carte


@resource_router.put("/cartes-rfid/{carte_id}", response_model=schemas.CarteRfidRead, dependencies=[Depends(require_admin)])
def update_carte_rfid(carte_id: int, payload: schemas.CarteRfidUpdate, current_user: models.Utilisateur = Depends(require_admin), db: Session = Depends(get_db)):
    carte = db.query(models.CarteRfid).filter(
        models.CarteRfid.id == carte_id,
        models.CarteRfid.entreprise_id == current_user.entreprise_id
    ).first()
    if not carte:
        raise HTTPException(status_code=404, detail="Carte RFID non trouvée.")
    
    data = payload.model_dump(exclude_unset=True)
    for k, v in data.items():
        setattr(carte, k, v)
    db.commit()
    db.refresh(carte)
    return carte


@resource_router.delete("/cartes-rfid/{carte_id}", status_code=status.HTTP_204_NO_CONTENT, dependencies=[Depends(require_admin)])
def delete_carte_rfid(carte_id: int, current_user: models.Utilisateur = Depends(require_admin), db: Session = Depends(get_db)):
    carte = db.query(models.CarteRfid).filter(
        models.CarteRfid.id == carte_id,
        models.CarteRfid.entreprise_id == current_user.entreprise_id
    ).first()
    if not carte:
        raise HTTPException(status_code=404, detail="Carte RFID non trouvée.")
    db.delete(carte)
    db.commit()


# ===========================================================================
# NOTIFICATIONS
# ===========================================================================

@resource_router.get("/notifications", response_model=List[schemas.NotificationRead])
def list_notifications(current_user: models.Utilisateur = Depends(require_employe), db: Session = Depends(get_db)):
    wellness_service.executer_rappels_dus(db)
    wellness_service.verifier_inactivite_bureau(db, current_user.entreprise_id)
    
    return (
        db.query(models.Notification)
        .filter(models.Notification.utilisateur_id == current_user.id)
        .order_by(models.Notification.date_creation.desc())
        .all()
    )


@resource_router.put("/notifications/{notif_id}/read", response_model=schemas.NotificationRead)
def mark_notification_read(notif_id: int, current_user: models.Utilisateur = Depends(require_employe), db: Session = Depends(get_db)):
    notif = db.query(models.Notification).filter(
        models.Notification.id == notif_id,
        models.Notification.utilisateur_id == current_user.id
    ).first()
    if not notif:
        raise HTTPException(status_code=404, detail="Notification non trouvée.")
    notif.lue = True
    db.commit()
    db.refresh(notif)
    return notif


@resource_router.put("/notifications/read-all")
def mark_all_notifications_read(current_user: models.Utilisateur = Depends(require_employe), db: Session = Depends(get_db)):
    db.query(models.Notification).filter(
        models.Notification.utilisateur_id == current_user.id,
        models.Notification.lue == False
    ).update({"lue": True})
    db.commit()
    return {"message": "Toutes les notifications ont été marquées comme lues."}


# ===========================================================================
# RAPPELS
# ===========================================================================

@resource_router.get("/rappels", response_model=List[schemas.RappelRead])
def list_rappels(current_user: models.Utilisateur = Depends(require_employe), db: Session = Depends(get_db)):
    return db.query(models.Rappel).filter(models.Rappel.utilisateur_id == current_user.id).all()


@resource_router.post("/rappels", response_model=schemas.RappelRead, status_code=status.HTTP_201_CREATED)
def create_rappel(payload: schemas.RappelCreate, current_user: models.Utilisateur = Depends(require_employe), db: Session = Depends(get_db)):
    _bureau_ou_404(payload.bureau_id, current_user.entreprise_id, db)
    rappel = models.Rappel(
        utilisateur_id=payload.utilisateur_id,
        bureau_id=payload.bureau_id,
        titre=payload.titre,
        description=payload.description,
        date_rappel=payload.date_rappel,
        execute=False
    )
    db.add(rappel)
    db.commit()
    db.refresh(rappel)
    return rappel


@resource_router.put("/rappels/{rappel_id}", response_model=schemas.RappelRead)
def update_rappel(rappel_id: int, payload: schemas.RappelUpdate, current_user: models.Utilisateur = Depends(require_employe), db: Session = Depends(get_db)):
    rappel = db.query(models.Rappel).filter(
        models.Rappel.id == rappel_id,
        models.Rappel.utilisateur_id == current_user.id
    ).first()
    if not rappel:
        raise HTTPException(status_code=404, detail="Rappel non trouvé.")
    
    data = payload.model_dump(exclude_unset=True)
    for k, v in data.items():
        setattr(rappel, k, v)
    db.commit()
    db.refresh(rappel)
    return rappel


@resource_router.delete("/rappels/{rappel_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_rappel(rappel_id: int, current_user: models.Utilisateur = Depends(require_employe), db: Session = Depends(get_db)):
    rappel = db.query(models.Rappel).filter(
        models.Rappel.id == rappel_id,
        models.Rappel.utilisateur_id == current_user.id
    ).first()
    if not rappel:
        raise HTTPException(status_code=404, detail="Rappel non trouvé.")
    db.delete(rappel)
    db.commit()


# ===========================================================================
# STATISTIQUES ENERGIE & HABITUDES
# ===========================================================================

@resource_router.get("/stats/energie")
def get_energy_stats(periode: str = "semaine", current_user: models.Utilisateur = Depends(require_employe), db: Session = Depends(get_db)):
    energy_service.simuler_consommation_7_jours(db, current_user.entreprise_id)
    energy_service.verifier_surconsommation_alerte(db, current_user.entreprise_id)
    stats = energy_service.obtenir_stats_consommation(db, current_user.entreprise_id, periode)
    conseils = energy_service.generer_recommandations(db, current_user.entreprise_id)
    return {
        "periode": periode,
        "consommation": stats,
        "recommandations": conseils
    }


@resource_router.get("/stats/habits")
def get_habits_suggestions(current_user: models.Utilisateur = Depends(require_employe), db: Session = Depends(get_db)):
    return habits_service.analyser_habitudes_et_suggestions(db, current_user.entreprise_id)


# ===========================================================================
# EXPORT HISTORIQUE ACCES CSV
# ===========================================================================

@resource_router.get("/historique-acces/export")
def export_historique_acces(current_user: models.Utilisateur = Depends(require_employe), db: Session = Depends(get_db)):
    from fastapi.responses import StreamingResponse
    import csv
    import io

    historique = (
        db.query(models.HistoriqueAcces)
        .join(models.Porte)
        .join(models.Equipement)
        .filter(models.Equipement.entreprise_id == current_user.entreprise_id)
        .order_by(models.HistoriqueAcces.date_acces.desc())
        .all()
    )

    output = io.StringIO()
    writer = csv.writer(output, delimiter=";")
    writer.writerow(["ID", "Porte", "Utilisateur", "Méthode", "Résultat", "Date"])
    for row in historique:
        user_name = f"{row.utilisateur.prenom} {row.utilisateur.nom}" if row.utilisateur else "Inconnu"
        writer.writerow([
            row.id,
            row.porte.equipement.identifiant_mqtt,
            user_name,
            row.methode_ouverture,
            row.resultat,
            row.date_acces.isoformat()
        ])

    output.seek(0)
    return StreamingResponse(
        io.BytesIO(output.getvalue().encode("utf-8-sig")),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=historique_acces.csv"}
    )


# ===========================================================================
router.include_router(auth_router)
router.include_router(resource_router)
