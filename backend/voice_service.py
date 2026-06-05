"""
Service de reconnaissance vocale offline — Vosk (FR + EN).

Modèles requis (télécharger via backend/telecharger_modeles.py) :
  backend/models/vosk-fr/  ← vosk-model-fr-0.22
  backend/models/vosk-en/  ← vosk-model-small-en-us-0.15

Formats audio acceptés : WAV 16kHz, 16 bits, mono (PCM)
"""

import io
import json
import logging
import os
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)

MODELS_DIR = Path(__file__).parent / "models"
MODEL_FR_DIR = MODELS_DIR / "vosk-fr"
MODEL_EN_DIR = MODELS_DIR / "vosk-en"

_modele_fr = None
_modele_en = None
_vosk_disponible = False


def _charger_modeles() -> None:
    global _modele_fr, _modele_en, _vosk_disponible
    try:
        from vosk import Model, SetLogLevel
        SetLogLevel(-1)  # Silencer les logs Vosk

        if MODEL_FR_DIR.exists():
            _modele_fr = Model(str(MODEL_FR_DIR))
            logger.info("Vosk: modèle français chargé (%s)", MODEL_FR_DIR)
        else:
            logger.warning("Vosk: modèle français absent → %s", MODEL_FR_DIR)

        if MODEL_EN_DIR.exists():
            _modele_en = Model(str(MODEL_EN_DIR))
            logger.info("Vosk: modèle anglais chargé (%s)", MODEL_EN_DIR)
        else:
            logger.warning("Vosk: modèle anglais absent → %s", MODEL_EN_DIR)

        _vosk_disponible = _modele_fr is not None or _modele_en is not None

    except ImportError:
        logger.warning("Vosk non installé. Lancez : pip install vosk")
        _vosk_disponible = False


# Chargement au démarrage du module
_charger_modeles()


def est_disponible() -> bool:
    return _vosk_disponible


def statut() -> dict:
    return {
        "vosk_disponible": _vosk_disponible,
        "modele_fr": _modele_fr is not None,
        "modele_en": _modele_en is not None,
        "chemin_modeles": str(MODELS_DIR),
    }


def transcrire_audio(audio_bytes: bytes, langue: str = "fr") -> Optional[str]:
    """
    Transcrit un fichier WAV (16kHz, 16-bit, mono) en texte.

    Args:
        audio_bytes : Octets du fichier WAV
        langue      : "fr" ou "en"

    Returns:
        Texte transcrit ou None si échec.
    """
    if not _vosk_disponible:
        raise RuntimeError("Vosk n'est pas installé ou les modèles sont absents.")

    try:
        import wave
        from vosk import KaldiRecognizer

        modele = _modele_fr if langue == "fr" else _modele_en
        if modele is None:
            # Essayer l'autre langue si le modèle demandé est absent
            modele = _modele_en if langue == "fr" else _modele_fr
        if modele is None:
            raise RuntimeError("Aucun modèle Vosk disponible.")

        # Lire le WAV
        wav_io = io.BytesIO(audio_bytes)
        wf = wave.open(wav_io, "rb")

        if wf.getnchannels() != 1:
            raise ValueError("Audio doit être mono (1 canal).")
        if wf.getsampwidth() != 2:
            raise ValueError("Audio doit être 16-bit.")
        if wf.getframerate() not in (16000, 8000):
            raise ValueError(f"Fréquence d'échantillonnage invalide : {wf.getframerate()} Hz (requis : 16000).")

        recognizer = KaldiRecognizer(modele, wf.getframerate())
        recognizer.SetWords(False)

        texte_final = ""
        while True:
            data = wf.readframes(4000)
            if len(data) == 0:
                break
            if recognizer.AcceptWaveform(data):
                result = json.loads(recognizer.Result())
                texte_final += result.get("text", "") + " "

        result_final = json.loads(recognizer.FinalResult())
        texte_final += result_final.get("text", "")

        transcription = texte_final.strip()
        logger.info("Vosk [%s] → \"%s\"", langue, transcription)
        return transcription if transcription else None

    except Exception as exc:
        logger.exception("Erreur transcription Vosk : %s", exc)
        return None
