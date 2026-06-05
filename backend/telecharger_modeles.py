"""
Script de téléchargement des modèles Vosk (FR + EN).
Exécuter une seule fois avant de démarrer le serveur.

Usage :
  cd backend
  .venv\\Scripts\\python telecharger_modeles.py
"""

import os
import urllib.request
import zipfile
from pathlib import Path

MODELS_DIR = Path(__file__).parent / "models"

MODELES = {
    "vosk-fr": {
        "url": "https://alphacephei.com/vosk/models/vosk-model-small-fr-0.22.zip",
        "dest": MODELS_DIR / "vosk-fr",
        "taille": "~43 Mo",
    },
    "vosk-en": {
        "url": "https://alphacephei.com/vosk/models/vosk-model-small-en-us-0.15.zip",
        "dest": MODELS_DIR / "vosk-en",
        "taille": "~40 Mo",
    },
}


def telecharger_avec_progression(url: str, dest_fichier: Path) -> None:
    def _afficher(nb_blocs, taille_bloc, taille_totale):
        if taille_totale > 0:
            pct = min(100, int(nb_blocs * taille_bloc * 100 / taille_totale))
            print(f"\r  Téléchargement : {pct}%", end="", flush=True)

    urllib.request.urlretrieve(url, dest_fichier, reporthook=_afficher)
    print()


def telecharger_modele(nom: str, config: dict) -> None:
    dest: Path = config["dest"]

    if dest.exists():
        print(f"[OK] {nom} déjà présent → {dest}")
        return

    print(f"\n[↓] Téléchargement {nom} ({config['taille']}) ...")
    MODELS_DIR.mkdir(parents=True, exist_ok=True)

    zip_path = MODELS_DIR / f"{nom}.zip"
    telecharger_avec_progression(config["url"], zip_path)

    print(f"  Extraction → {MODELS_DIR} ...")
    with zipfile.ZipFile(zip_path, "r") as zf:
        # Le zip contient un dossier racine avec un nom different
        noms = zf.namelist()
        dossier_racine = noms[0].split("/")[0]
        zf.extractall(MODELS_DIR)

    # Renommer le dossier extrait avec le nom attendu par voice_service.py
    dossier_extrait = MODELS_DIR / dossier_racine
    if dossier_extrait.exists() and dossier_extrait != dest:
        dossier_extrait.rename(dest)

    zip_path.unlink(missing_ok=True)
    print(f"  [OK] {nom} installé → {dest}")


if __name__ == "__main__":
    print("=" * 55)
    print("  Téléchargement des modèles Vosk — Syli Bureau")
    print("=" * 55)

    for nom, config in MODELES.items():
        try:
            telecharger_modele(nom, config)
        except Exception as e:
            print(f"  [ERREUR] {nom} : {e}")

    print("\n[✓] Terminé. Redémarrez le serveur backend.")
    print(f"    Modèles dans : {MODELS_DIR.resolve()}")
