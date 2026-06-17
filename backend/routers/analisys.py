from fastapi import APIRouter, HTTPException, Query, Depends
from pydantic import BaseModel
from typing import Dict, Any
from sqlalchemy.orm import Session

from backend.database.connection import get_db
from backend.database.models import HybridAnalysisHistory
from backend.services.analysis import analysis_orchestrator
from backend.services.analysis_db import save_hybrid_analysis

router = APIRouter(prefix="/analysis", tags=["AI Hybrid Intelligence"])

class QualitativeAnalysisRequest(BaseModel):
    """Contenedor de transferencia para iniciar la computación cognitiva (Fase 2)"""
    pred_base_lstm: float
    technical_signals: Dict[str, Any]
    risk_profile: str = "moderado"

@router.get("/run/quantitative/{ticker}")
def run_quantitative_phase(ticker: str):
    """
    FASE 1: Inferencia Matemática Rápida.
    Calcula de inmediato la predicción numérica base para no bloquear la interfaz React.
    """
    try:
        return analysis_orchestrator.get_quantitative_base(ticker=ticker)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Fallo en Fase 1 Cuantitativa: {str(e)}")

@router.post("/run/qualitative/{ticker}")
def run_qualitative_phase(ticker: str, payload: QualitativeAnalysisRequest, db: Session = Depends(get_db)):
    """
    FASE 2: Inferencia Cognitiva (RAG + Ollama) & Persistencia Extensiva.
    Recibe los datos cuantitativos previas, inyecta el contexto de ChromaDB,
    genera la justificación, calcula el precio definitivo y guarda la auditoría en BD.
    """
    try:
        # Ejecución del pipeline cualitativo con Llama
        result_qualitative = analysis_orchestrator.get_qualitative_adjustment(
            ticker=ticker,
            pred_base_usd=payload.pred_base_lstm,
            technical_signals=payload.technical_signals
        )
        
        last_close = payload.technical_signals.get("last_close", payload.pred_base_lstm)
        precio_final_hibrido = result_qualitative["precio_final_hibrido"]
        rendimiento_esperado = (precio_final_hibrido / last_close) - 1
        risk_profile = payload.risk_profile.lower()

        # Matriz de decisión según tu Perfil de Riesgo corporativo
        if risk_profile == "conservador":
            recomendacion = "INVERTIR" if rendimiento_esperado > 0.05 else "ESPERAR"
            if rendimiento_esperado < -0.02: recomendacion = "NO INVERTIR"
        elif risk_profile == "agresivo":
            recomendacion = "INVERTIR" if rendimiento_esperado > 0.01 else "ESPERAR"
            if rendimiento_esperado < -0.08: recomendacion = "NO INVERTIR"
        else:  # Moderado
            recomendacion = "INVERTIR" if rendimiento_esperado > 0.03 else "ESPERAR"
            if rendimiento_esperado < -0.05: recomendacion = "NO INVERTIR"

        # Formateo de payloads estructurados para la persistencia
        metrics_input = {"last_close": last_close, "pred_lstm": payload.pred_base_lstm}
        ai_output = {
            "ajuste_llm": result_qualitative["ajuste_llm_porcentual"],
            "confianza": result_qualitative["confianza_analisis"],
            "justificacion": result_qualitative["justificacion"]
        }

        # Commitear logs en caliente dentro de la Base de Datos
        db_record = save_hybrid_analysis(
            db=db, ticker=ticker, metrics=metrics_input,
            ai_output=ai_output, final_price=precio_final_hibrido, recomendacion=recomendacion
        )

        return {
            "status": "success",
            "analysis_id": db_record.id,
            "ticker": db_record.ticker,
            "risk_profile_applied": risk_profile,
            "execution_date": db_record.execution_date,
            "results": {
                "last_real_close": db_record.last_real_close,
                "pred_base_lstm": db_record.pred_base_lstm,
                "precio_final_hibrido": db_record.precio_final_hibrido,
                "rendimiento_esperado_pct": round(rendimiento_esperado * 100, 2)
            },
            "decision": {
                "recomendacion": db_record.recomendacion,
                "confianza_llama": db_record.confianza_analisis,
                "justificacion": db_record.justificacion
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Fallo en Fase 2 Cognitiva/Persistencia: {str(e)}")

@router.get("/history", tags=["Auditoría & Control"])
def get_analysis_history(limit: int = Query(default=20, max=100), db: Session = Depends(get_db)):
    """
    Controlador de Auditoría Central de la IA.
    Retorna los registros cronológicos de las decisiones tomadas por el sistema.
    """
    try:
        registros = db.query(HybridAnalysisHistory).order_by(HybridAnalysisHistory.execution_date.desc()).limit(limit).all()
        return {
            "count": len(registros),
            "records": [
                {
                    "id": r.id,
                    "ticker": r.ticker,
                    "execution_date": r.execution_date,
                    "last_real_close": r.last_real_close,
                    "pred_base_lstm": r.pred_base_lstm,
                    "precio_final_hibrido": r.precio_final_hibrido,
                    "recomendacion": r.recomendacion,
                    "justificacion": r.justificacion
                } for r in registros
            ]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al leer logs históricos de la DB: {str(e)}")