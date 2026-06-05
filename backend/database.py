import logging
import os

from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

load_dotenv()
logger = logging.getLogger(__name__)


def obtenir_url_base() -> str:
    url = os.getenv("DATABASE_URL", "").strip()

    if not url:
        logger.warning("DATABASE_URL non défini — fallback local.")
        url = "postgresql://postgres:password@localhost:5432/smart_bureau_v"

    # Forcer psycopg v3 (installé) — jamais psycopg2
    url = url.replace("postgresql+psycopg2://", "postgresql+psycopg://")
    if url.startswith("postgresql://"):
        url = url.replace("postgresql://", "postgresql+psycopg://", 1)
    elif url.startswith("postgres://"):
        url = url.replace("postgres://", "postgresql+psycopg://", 1)

    # Ajouter SSL automatiquement pour les bases distantes (Supabase, etc.)
    is_local = "localhost" in url or "127.0.0.1" in url
    if not is_local and "sslmode" not in url:
        sep = "&" if "?" in url else "?"
        url += f"{sep}sslmode=require"

    return url


DATABASE_URL = obtenir_url_base()

is_local = "localhost" in DATABASE_URL or "127.0.0.1" in DATABASE_URL

engine = create_engine(
    DATABASE_URL,
    future=True,
    pool_pre_ping=True,
    pool_size=5,
    max_overflow=10,
    # PgBouncer (pooler Supabase) en mode transaction ne supporte pas
    # les prepared statements — on les désactive pour les connexions distantes.
    connect_args={} if is_local else {"prepare_threshold": None},
)

SessionLocal = sessionmaker(
    bind=engine,
    autoflush=False,
    autocommit=False,
    future=True,
)


class Base(DeclarativeBase):
    pass


def get_db():
    """Dépendance FastAPI — fournit une session de base de données."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
