from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship
import datetime

Base = declarative_base()

class InvestmentStrategy(Base):
    """
    Tabla para guardar tus diferentes estrategias de Trading/Inversión.
    Ejemplo: 'Estrategia Híbrida LSTM-MACD', 'Buy and Hold a Largo Plazo'.
    """
    __tablename__ = "investment_strategies"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False, unique=True)
    description = Column(Text, nullable=True)
    risk_profile = Column(String(50), default="Moderate") # Low, Moderate, High
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    # Relación inversa: Una estrategia puede estar asignada a muchas inversiones
    investments = relationship("UserInvestment", back_populates="strategy")


class UserInvestment(Base):
    """
    Tabla de Portafolio Real o Simulado (Paper Trading).
    Monitorea qué activos compraste, a qué precio y bajo qué estrategia.
    """
    __tablename__ = "user_investments"

    id = Column(Integer, primary_key=True, index=True)
    ticker = Column(String(10), nullable=False, index=True)
    shares_quantity = Column(Float, nullable=False)        # Cantidad de acciones compradas
    entry_price = Column(Float, nullable=False)           # Precio de compra por acción (USD)
    purchase_date = Column(DateTime, default=datetime.datetime.utcnow)
    status = Column(String(20), default="ACTIVE")         # ACTIVE, CLOSED
    
    # Llave foránea para asociar esta inversión a una estrategia
    strategy_id = Column(Integer, ForeignKey("investment_strategies.id"), nullable=True)
    strategy = relationship("InvestmentStrategy", back_populates="investments")


class HybridAnalysisHistory(Base):
    """
    Historial de ejecuciones del pipeline. 
    Guarda lo que predijo el LSTM y el LLM para auditar al modelo en el futuro.
    """
    __tablename__ = "hybrid_analysis_history"

    id = Column(Integer, primary_key=True, index=True)
    ticker = Column(String(10), nullable=False, index=True)
    execution_date = Column(DateTime, default=datetime.datetime.utcnow)
    
    # Métricas del pipeline
    last_real_close = Column(Float, nullable=False)
    pred_base_lstm = Column(Float, nullable=False)
    ajuste_llm_porcentual = Column(Float, nullable=False)
    precio_final_hibrido = Column(Float, nullable=False)
    
    # Explicabilidad de la IA
    recomendacion = Column(String(20), nullable=False) # COMPRAR, VENDER, ESPERAR
    justificacion = Column(Text, nullable=False)        # El bloque de texto de Llama 3.2
    confianza_analisis = Column(Float, nullable=False)