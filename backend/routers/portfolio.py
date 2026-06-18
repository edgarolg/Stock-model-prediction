from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

from backend.database.connection import get_db
from backend.database.models import InvestmentStrategy, UserInvestment

router = APIRouter(prefix="/portfolio", tags=["Gestión de Portafolio"])

# ==========================================
# 1. ESQUEMAS PYDANTIC (Validación de entrada)
# ==========================================
class StrategyCreate(BaseModel):
    name: str
    description: Optional[str] = None
    risk_profile: str = "Moderado" # Conservador, Moderado, Agresivo

class InvestmentCreate(BaseModel):
    ticker: str
    shares_quantity: float
    entry_price: float
    strategy_id: Optional[int] = None

# ==========================================
# 2. ENDPOINTS PARA ESTRATEGIAS
# ==========================================
@router.post("/strategies", summary="Crear una nueva estrategia de inversión")
def create_strategy(strategy: StrategyCreate, db: Session = Depends(get_db)):
    """Crea un perfil o estrategia (Ej: 'Fondo de Retiro', 'Trading Agresivo')."""
    db_strategy = InvestmentStrategy(
        name=strategy.name,
        description=strategy.description,
        risk_profile=strategy.risk_profile
    )
    db.add(db_strategy)
    db.commit()
    db.refresh(db_strategy)
    return {"status": "success", "data": db_strategy}

@router.get("/strategies", summary="Ver todas las estrategias")
def get_strategies(db: Session = Depends(get_db)):
    strategies = db.query(InvestmentStrategy).all()
    return {"status": "success", "data": strategies}

# ==========================================
# 3. ENDPOINTS PARA INVERSIONES (COMPRAS)
# ==========================================
@router.post("/investments", summary="Registrar compra de acciones")
def add_investment(inv: InvestmentCreate, db: Session = Depends(get_db)):
    """Añade una acción comprada al portafolio del usuario."""
    # Verificar que la estrategia exista si se proporcionó una
    if inv.strategy_id:
        strat = db.query(InvestmentStrategy).filter(InvestmentStrategy.id == inv.strategy_id).first()
        if not strat:
            raise HTTPException(status_code=404, detail="La estrategia indicada no existe.")

    db_investment = UserInvestment(
        ticker=inv.ticker.upper(),
        shares_quantity=inv.shares_quantity,
        entry_price=inv.entry_price,
        strategy_id=inv.strategy_id,
        status="ACTIVE"
    )
    db.add(db_investment)
    db.commit()
    db.refresh(db_investment)
    return {"status": "success", "data": db_investment}

@router.get("/investments/active", summary="Ver portafolio activo")
def get_active_investments(db: Session = Depends(get_db)):
    """Obtiene todas las acciones que el usuario posee actualmente."""
    investments = db.query(UserInvestment).filter(UserInvestment.status == "ACTIVE").all()
    return {"status": "success", "total_positions": len(investments), "data": investments}