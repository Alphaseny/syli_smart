import logging
import os

from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from dotenv import load_dotenv

load_dotenv()
logger = logging.getLogger(__name__)


def get_database_url() -> str:
    env_url = os.getenv("DATABASE_URL")
    if not env_url:
        logger.warning("DATABASE_URL non défini. Utilisation du fallback local.")
        env_url = "postgresql://postgres:&&&&@localhost:5432/smart_bureau_v"

    if env_url.strip() == "" or "example" in env_url.lower():
        raise ValueError(
            "DATABASE_URL contient une valeur placeholder invalide. Vérifiez .env ou .env.example."
        )

    # Utilise psycopg v3 (psycopg[binary]) — remplace le schéma générique si besoin
    if env_url.startswith("postgresql://") or env_url.startswith("postgres://"):
        env_url = env_url.replace("postgresql://", "postgresql+psycopg://", 1)
        env_url = env_url.replace("postgres://", "postgresql+psycopg://", 1)

    return env_url


DATABASE_URL = get_database_url()
engine = create_engine(DATABASE_URL, future=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
