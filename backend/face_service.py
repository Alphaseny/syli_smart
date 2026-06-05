"""
Service de reconnaissance faciale — face_recognition (dlib, 128 floats).

Installation sur Windows :
  pip install cmake
  pip install dlib          # nécessite Visual C++ Build Tools (~20 min)
  pip install face_recognition
  pip install Pillow numpy

Ou via wheel pré-compilé (plus rapide) :
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
    logger.info("face_recognition chargé avec succès.")
except ImportError:
    FACE_RECOGNITION_DISPONIBLE = False
    logger.warning(
        "face_recognition non installé. "
        "Lancez : pip install cmake dlib face_recognition"
    )


def extraire_encoding(image_bytes: bytes) -> Optional[list[float]]:
    """
    Extrait l'embedding facial (128 floats) depuis des octets d'image JPEG/PNG.
    Retourne None si aucun visage n'est détecté ou si la bibliothèque est absente.
    """
    if not FACE_RECOGNITION_DISPONIBLE:
        raise RuntimeError("face_recognition n'est pas installé sur ce serveur.")

    try:
        from PIL import Image

        # Convertir en RGB (face_recognition nécessite RGB, pas RGBA/BGR)
        img_pil = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        img_array = np.array(img_pil)

        encodings = face_recognition.face_encodings(img_array)
        if not encodings:
            return None

        # Retourner le premier visage détecté
        return encodings[0].tolist()

    except Exception as exc:
        logger.exception("Erreur lors de l'extraction de l'encoding facial : %s", exc)
        return None


def identifier_visage(
    image_bytes: bytes,
    encodings_connus: list[tuple[int, str, list[float]]],
    tolerance: float = 0.55,
) -> Optional[tuple[int, str]]:
    """
    Identifie le visage dans l'image et retourne (utilisateur_id, nom_label) ou None.

    Args:
        image_bytes       : Image JPEG envoyée par l'ESP32-CAM
        encodings_connus  : Liste de (utilisateur_id, nom_label, encoding_128_floats)
        tolerance         : Seuil de distance (0.55 = strict, 0.6 = standard, 0.65 = souple)
    """
    if not FACE_RECOGNITION_DISPONIBLE:
        raise RuntimeError("face_recognition n'est pas installé sur ce serveur.")

    if not encodings_connus:
        return None

    encoding_cible = extraire_encoding(image_bytes)
    if encoding_cible is None:
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
        logger.info(
            "Visage identifié : %s (distance=%.3f)",
            meilleur_match[1], meilleure_distance
        )
    else:
        logger.info("Visage non reconnu (meilleure distance=%.3f)", meilleure_distance)

    return meilleur_match


def est_disponible() -> bool:
    return FACE_RECOGNITION_DISPONIBLE
