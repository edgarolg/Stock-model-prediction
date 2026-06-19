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

# 3. RUTA A TU BASE DE DATOS (Nota como usamos '/' en lugar de '\' para evitar errores de SQLite)
DATABASE_URL = "sqlite:///C:/Users/edgar/Documents/VsCode/StockPrediction/stockintel.db"

# Creamos la conexión
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def seed_data():
    db = SessionLocal()
    
    try:
        # Asegurarnos de que las tablas existan
        Base.metadata.create_all(bind=engine)
        
        if db.query(InvestmentStrategy).count() == 0:
            print("Sembrando estrategias de inversión en stockintel.db...")
            estrategias = [
                InvestmentStrategy(
                    name="Conservador", 
                    risk_profile="Bajo Riesgo",
                    description="Prioriza la preservación del capital y retornos estables."
                ),
                InvestmentStrategy(
                    name="Moderado", 
                    risk_profile="Riesgo Medio",
                    description="Busca un equilibrio entre crecimiento y seguridad."
                ),
                InvestmentStrategy(
                    name="Agresivo", 
                    risk_profile="Alto Riesgo",
                    description="Busca maximizar rendimientos asumiendo volatilidad."
                )
            ]
            db.add_all(estrategias)
            db.commit()
            print("✅ ¡Estrategias creadas con éxito en tu base de datos!")
        else:
            print("⚠️ Las estrategias ya estaban registradas.")
    except Exception as e:
        print(f"❌ Ocurrió un error: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    seed_data()