from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
from backend.database.connection import Base

class InvestmentStrategy(Base):
    """
    Tabla para guardar los perfiles de riesgo y estrategias de inversión.
    Se alinea con los perfiles: Conservador, Moderado, Agresivo.
    """
    __tablename__ = "investment_strategies"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False, unique=True) # E.g., 'Estrategia Conservadora ETF'
    description = Column(Text, nullable=True)
    risk_profile = Column(String(50), default="Moderado") # Conservador, Moderado, Agresivo
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    # Relación inversa: Una estrategia puede estar asignada a muchas inversiones de usuarios
    investments = relationship("UserInvestment", back_populates="strategy")


class UserInvestment(Base):
    """
    Tabla de Portafolio Real o Simulado (Paper Trading).
    Monitorea activos comprados, precios de entrada y estrategia vinculada.
    """
    __tablename__ = "user_investments"

    id = Column(Integer, primary_key=True, index=True)
    ticker = Column(String(10), nullable=False, index=True)
    shares_quantity = Column(Float, nullable=False)        # Cantidad de acciones
    entry_price = Column(Float, nullable=False)           # Precio de compra (USD)
    purchase_date = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    status = Column(String(20), default="ACTIVE")         # ACTIVE, CLOSED
    
    # Llave foránea para asociar esta inversión a una estrategia/perfil
    strategy_id = Column(Integer, ForeignKey("investment_strategies.id"), nullable=True)
    strategy = relationship("InvestmentStrategy", back_populates="investments")


class HybridAnalysisHistory(Base):
    """
    Historial de ejecuciones del Pipeline Híbrido de StockIntel.
    Guarda las métricas exactas del LSTM, XGBoost y las salidas de Llama 3 para auditoría.
    """
    __tablename__ = "hybrid_analysis_history"

    id = Column(Integer, primary_key=True, index=True)
    ticker = Column(String(10), nullable=False, index=True)
    execution_date = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    
    # --- MÉTRICAS DE ENTRADA Y PRECCIONES BASE ---
    last_real_close = Column(Float, nullable=False)       # Precio de cierre de mercado actual ($)
    pred_base_lstm = Column(Float, nullable=False)        # Predicción numérica base del modelo matemático
    
    # --- AJUSTES DEL LLM (LLAMA 3) ---
    ajuste_llm_porcentual = Column(Float, nullable=False) # El delta % que sugirió el LLM
    confianza_analisis = Column(Float, nullable=False)    # Confianza devuelta por Llama 3 (0.0 a 1.0)
    
    # --- RESULTADO FINAL DEL PIPELINE ---
    precio_final_hibrido = Column(Float, nullable=False)  # Precio final usando la fórmula de pesos
    recomendacion = Column(String(20), nullable=False)     # INVERTIR, ESPERAR, NO INVERTIR
    justificacion = Column(Text, nullable=False)          # Bloque de texto explicativo (RAG + Razonamiento)