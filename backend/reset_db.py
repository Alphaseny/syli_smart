"""Script de réinitialisation complète de la base de données."""
from database import Base, engine
import models  # noqa: F401 — charge tous les modèles pour que Base les connaisse

print("Suppression de toutes les tables...")
Base.metadata.drop_all(bind=engine)
print("Recréation de toutes les tables...")
Base.metadata.create_all(bind=engine)
print("Base de données réinitialisée avec succès.")
