import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

# Si no hay una DB configurada en el .env, usamos SQLite local por defecto
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./stockintel.db")

# Configuración necesaria para que SQLite no choque con los hilos concurrentes de FastAPI
connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}

engine = create_engine(DATABASE_URL, connect_args=connect_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Base compartida para todos los modelos del sistema
Base = declarative_base()

def init_db():
    """Crea todas las tablas en la base de datos si no existen."""
    print("[-] Inicializando Base de Datos y mapeando tablas en StockIntel...")
    from backend.database.models import Base as ModelBase
    ModelBase.metadata.create_all(bind=engine)

def get_db():
    """
    Dependency Injection para FastAPI. 
    Abre una sesión de DB por petición y la cierra automáticamente al terminar.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()