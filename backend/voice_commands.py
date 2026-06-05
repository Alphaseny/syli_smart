"""
Parseur de commandes vocales — Français et Anglais.

Reconnaît les intentions domotiques depuis une transcription texte
et retourne une action structurée.
"""

import re
from dataclasses import dataclass
from typing import Optional


@dataclass
class CommandeVocale:
    intention: str          # "lampe_allumer" | "lampe_eteindre" | "porte_ouvrir" | "porte_fermer" | "camera_snapshot"
    type_equipement: str    # "lampe" | "porte" | "camera"
    action: str             # "allumer" | "eteindre" | "ouvrir" | "fermer" | "snapshot"
    cible: Optional[str]    # Mot-clé identifiant l'équipement (ex: "bureau", "entrée")
    langue: str             # "fr" | "en"
    texte_original: str


# ── Patterns FR ───────────────────────────────────────────────────────────────

_PATTERNS_FR = [
    # Lampes
    (r"\b(allum[e|es]?|mets|met)\b.*(lumi[eè]re|lampe|lumi[eè]res|lampes|lumi[eè]re)", "lampe", "allumer"),
    (r"\b(éteins|étein[st]|coupe|coupes|coupez)\b.*(lumi[eè]re|lampe|lumi[eè]res|lampes)", "lampe", "eteindre"),
    # Portes
    (r"\b(ouvr[ei]|déverrouillem?|ouvrez)\b.*(porte|portail|accès)", "porte", "ouvrir"),
    (r"\b(ferm[e|es]?|verrouillem?|fermez)\b.*(porte|portail|accès)", "porte", "fermer"),
    # Caméras
    (r"\b(prends?|prendre|fais?|faire)\b.*(photo|snapshot|capture|image)", "camera", "snapshot"),
    (r"\bsnapshot\b", "camera", "snapshot"),
]

# ── Patterns EN ───────────────────────────────────────────────────────────────

_PATTERNS_EN = [
    # Lights
    (r"\b(turn on|switch on|enable|activate|put on)\b.*(light|lamp|lights|lamps|illuminat)", "lampe", "allumer"),
    (r"\b(turn off|switch off|disable|cut|deactivate)\b.*(light|lamp|lights|lamps)", "lampe", "eteindre"),
    # Doors
    (r"\b(open|unlock)\b.*(door|gate|entrance|access)", "porte", "ouvrir"),
    (r"\b(close|shut|lock)\b.*(door|gate|entrance|access)", "porte", "fermer"),
    # Cameras
    (r"\b(take|capture|snap)\b.*(picture|photo|image|snapshot)", "camera", "snapshot"),
    (r"\bsnapshot\b", "camera", "snapshot"),
]

# ── Mots-clés de lieu ─────────────────────────────────────────────────────────

_LIEUX_FR = ["bureau", "salle", "couloir", "entrée", "accueil", "réunion", "direction"]
_LIEUX_EN = ["office", "room", "hall", "entrance", "reception", "meeting", "director"]

_NUMEROS = re.compile(r"\b(\d+|un|deux|trois|quatre|cinq|one|two|three|four|five)\b")


def _extraire_cible(texte: str, mots_lieu: list[str]) -> Optional[str]:
    """Extrait le mot de lieu ou le numéro mentionné dans la commande."""
    t = texte.lower()
    for mot in mots_lieu:
        if mot in t:
            m = _NUMEROS.search(t[t.index(mot):])
            return f"{mot} {m.group()}" if m else mot
    m = _NUMEROS.search(t)
    return m.group() if m else None


def parser_commande(texte: str) -> Optional[CommandeVocale]:
    """
    Parse une transcription vocale et retourne la commande domotique correspondante.
    Retourne None si aucune commande reconnue.
    """
    t = texte.lower().strip()

    # Essai FR
    for pattern, type_eq, action in _PATTERNS_FR:
        if re.search(pattern, t, re.IGNORECASE):
            return CommandeVocale(
                intention=f"{type_eq}_{action}",
                type_equipement=type_eq,
                action=action,
                cible=_extraire_cible(t, _LIEUX_FR),
                langue="fr",
                texte_original=texte,
            )

    # Essai EN
    for pattern, type_eq, action in _PATTERNS_EN:
        if re.search(pattern, t, re.IGNORECASE):
            return CommandeVocale(
                intention=f"{type_eq}_{action}",
                type_equipement=type_eq,
                action=action,
                cible=_extraire_cible(t, _LIEUX_EN),
                langue="en",
                texte_original=texte,
            )

    return None
