"""
Service de reconnaissance faciale — face_recognition (dlib, 128 floats).

Installation sur Windows :
  pip install cmake
  pip install dlib          # necessite Visual C++ Build Tools (~20 min)
  pip install face_recognition
  pip install Pillow numpy

Ou via wheel pre-compile (plus rapide) :
  pip install https://github.com/z-mahmud22/Dlib_Windows_Python3.x/raw/main/dlib-19.22.99-cp311-cp311-win_amd64.whl
  pip install face_recognition
"""

import io
import logging
from typing import Optional

import numpy as np

logger = logging.getLogger(__name__)

try:
    import face_recognition
    FACE_RECOGNITION_DISPONIBLE = True
    logger.info("face_recognition charge avec succes.")
except ImportError:
    FACE_RECOGNITION_DISPONIBLE = False
    logger.warning(
        "face_recognition non installe. "
        "Lancez : pip install cmake dlib face_recognition"
    )


def extraire_encoding(image_bytes: bytes) -> Optional[list[float]]:
    """
    Extrait l'embedding facial (128 floats) depuis des octets d'image JPEG/PNG.
    Retourne None si aucun visage n'est detecte ou si la bibliotheque est absente.
    """
    if not FACE_RECOGNITION_DISPONIBLE:
        raise RuntimeError("face_recognition n'est pas installe sur ce serveur.")

    try:
        from PIL import Image

        img_pil = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        img_array = np.array(img_pil)

        encodings = face_recognition.face_encodings(img_array)
        if not encodings:
            return None

        return encodings[0].tolist()

    except Exception as exc:
        logger.exception("Erreur lors de l'extraction de l'encoding facial : %s", exc)
        return None


def comparer_encodings(
    encoding_cible: list[float],
    encodings_connus: list[tuple[int, str, list[float]]],
    tolerance: float = 0.55,
) -> Optional[tuple[int, str]]:
    """
    Compare un encoding deja extrait contre les encodings connus.
    Retourne (utilisateur_id, nom_label) ou None si non reconnu.
    Permet de distinguer "aucun visage" (extraire_encoding=None) de "non reconnu".
    """
    if not encodings_connus:
        return None

    cible = np.array(encoding_cible)
    meilleure_distance = float("inf")
    meilleur_match: Optional[tuple[int, str]] = None

    for utilisateur_id, nom_label, encoding_connu in encodings_connus:
        connu = np.array(encoding_connu)
        distance = face_recognition.face_distance([connu], cible)[0]
        if distance < tolerance and distance < meilleure_distance:
            meilleure_distance = distance
            meilleur_match = (utilisateur_id, nom_label)

    if meilleur_match:
        logger.info("Visage identifie : %s (distance=%.3f)", meilleur_match[1], meilleure_distance)
    else:
        logger.info("Visage non reconnu (meilleure distance=%.3f)", meilleure_distance)

    return meilleur_match


def identifier_visage(
    image_bytes: bytes,
    encodings_connus: list[tuple[int, str, list[float]]],
    tolerance: float = 0.55,
) -> Optional[tuple[int, str]]:
    """
    Identifie le visage dans l'image et retourne (utilisateur_id, nom_label) ou None.
    Utilise par l'endpoint ESP32-CAM (/identifier).
    """
    if not FACE_RECOGNITION_DISPONIBLE:
        raise RuntimeError("face_recognition n'est pas installe sur ce serveur.")

    encoding_cible = extraire_encoding(image_bytes)
    if encoding_cible is None:
        return None

    return comparer_encodings(encoding_cible, encodings_connus, tolerance)


def est_disponible() -> bool:
    return FACE_RECOGNITION_DISPONIBLE
