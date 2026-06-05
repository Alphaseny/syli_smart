"""
Service de reconnaissance faciale — DeepFace (pas de compilation C++ nécessaire).

Installation :
  pip install deepface tf-keras opencv-python-headless numpy Pillow
"""

import io
import logging
from typing import Optional

import numpy as np

logger = logging.getLogger(__name__)

try:
    from deepface import DeepFace
    import cv2
    FACE_RECOGNITION_DISPONIBLE = True
    logger.info("DeepFace chargé avec succès.")
except ImportError:
    FACE_RECOGNITION_DISPONIBLE = False
    logger.warning(
        "DeepFace non installé. "
        "Lancez : pip install deepface tf-keras opencv-python-headless"
    )

MODEL_NAME = "Facenet"  # Facenet = embeddings 128 floats, rapide et précis
DETECTOR = "opencv"     # opencv = rapide, pas de deps lourdes


def _bytes_to_array(image_bytes: bytes):
    """Convertit des octets image en tableau numpy BGR (format OpenCV)."""
    arr = np.frombuffer(image_bytes, np.uint8)
    img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    return img


def extraire_encoding(image_bytes: bytes) -> Optional[list[float]]:
    """
    Extrait l'embedding facial depuis une image JPEG/PNG.
    Retourne une liste de floats ou None si aucun visage détecté.
    """
    if not FACE_RECOGNITION_DISPONIBLE:
        raise RuntimeError("DeepFace n'est pas installé sur ce serveur.")

    try:
        img = _bytes_to_array(image_bytes)
        if img is None:
            return None

        result = DeepFace.represent(
            img_path=img,
            model_name=MODEL_NAME,
            detector_backend=DETECTOR,
            enforce_detection=True,
        )
        if not result:
            return None

        return result[0]["embedding"]

    except Exception as exc:
        logger.warning("Extraction encoding : %s", exc)
        return None


def comparer_encodings(
    encoding_cible: list[float],
    encodings_connus: list[tuple[int, str, list[float]]],
    tolerance: float = 0.55,
) -> Optional[tuple[int, str]]:
    """
    Compare un embedding contre une liste d'embeddings connus.
    Retourne (utilisateur_id, nom_label) ou None si non reconnu.
    La tolérance est une distance cosinus : plus elle est basse, plus c'est strict.
    """
    if not encodings_connus:
        return None

    cible = np.array(encoding_cible)
    cible_norm = cible / (np.linalg.norm(cible) + 1e-10)

    meilleure_distance = float("inf")
    meilleur_match: Optional[tuple[int, str]] = None

    for utilisateur_id, nom_label, encoding_connu in encodings_connus:
        connu = np.array(encoding_connu)
        connu_norm = connu / (np.linalg.norm(connu) + 1e-10)
        # Distance cosinus : 0 = identique, 1 = opposé
        distance = float(1.0 - np.dot(cible_norm, connu_norm))
        if distance < tolerance and distance < meilleure_distance:
            meilleure_distance = distance
            meilleur_match = (utilisateur_id, nom_label)

    if meilleur_match:
        logger.info("Visage identifié : %s (distance=%.3f)", meilleur_match[1], meilleure_distance)
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
    """
    if not FACE_RECOGNITION_DISPONIBLE:
        raise RuntimeError("DeepFace n'est pas installé sur ce serveur.")

    encoding_cible = extraire_encoding(image_bytes)
    if encoding_cible is None:
        return None

    return comparer_encodings(encoding_cible, encodings_connus, tolerance)


def est_disponible() -> bool:
    return FACE_RECOGNITION_DISPONIBLE
