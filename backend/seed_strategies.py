import sys
import os

# 1. Le decimos a Python que busque archivos en TODAS tus carpetas posibles
sys.path.append(r"C:\Users\edgar\Documents\VsCode\StockPrediction")
sys.path.append(r"C:\Users\edgar\Documents\VsCode\StockPrediction\backend")

# 2. Intentamos importar tus modelos de cualquier forma posible
try:
    from backend.database.models import Base, InvestmentStrategy
except ModuleNotFoundError:
    from models import Base, InvestmentStrategy

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# 3. RUTA A TU BASE DE DATOS
DATABASE_URL = "sqlite:///C:/Users/edgar/Documents/VsCode/StockPrediction/stockintel.db"

# Creamos la conexión
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def seed_data():
    db = SessionLocal()
    
    try:
        # Asegurarnos de que las tablas existan
        Base.metadata.create_all(bind=engine)
        
        # BORRAR: Eliminamos todas las estrategias existentes para evitar duplicados o idiomas mezclados
        print("Cleaning up old strategies...")
        db.query(InvestmentStrategy).delete()
        db.commit()
        print("✅ Old strategies deleted.")
        
        # INSERTAR: Agregamos las nuevas estrategias en inglés
        print("Seeding investment strategies in English...")
        estrategias = [
            InvestmentStrategy(
                name="Conservative", 
                risk_profile="Low Risk",
                description="Prioritizes capital preservation and stable returns."
            ),
            InvestmentStrategy(
                name="Moderate", 
                risk_profile="Medium Risk",
                description="Seeks a balance between growth and security."
            ),
            InvestmentStrategy(
                name="Aggressive", 
                risk_profile="High Risk",
                description="Seeks to maximize returns by assuming volatility."
            )
        ]
        db.add_all(estrategias)
        db.commit()
        print("✅ Strategies successfully created in your database!")

    except Exception as e:
        print(f"❌ An error occurred: {e}")
        db.rollback() # Revertimos cambios si hay error
    finally:
        db.close()

if __name__ == "__main__":
    seed_data()