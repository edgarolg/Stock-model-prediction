from sqlalchemy.orm import Session
from backend.database.models import HybridAnalysisHistory

def save_hybrid_analysis(db: Session, ticker: str, metrics: dict, ai_output: dict, final_price: float, recomendacion: str) -> HybridAnalysisHistory:
    """
    Guarda el resultado completo del pipeline híbrido en la base de datos.
    
    metrics: dict con 'last_close' y 'pred_lstm'
    ai_output: dict devuelto por Llama 3 con 'ajuste_llm', 'confianza' y 'justificacion'
    """
    db_analysis = HybridAnalysisHistory(
        ticker=ticker.upper(),
        last_real_close=metrics["last_close"],
        pred_base_lstm=metrics["pred_lstm"],
        ajuste_llm_porcentual=ai_output["ajuste_llm"],
        confianza_analisis=ai_output["confianza"],
        precio_final_hibrido=final_price,
        recomendacion=recomendacion, # INVERTIR, ESPERAR, NO INVERTIR
        justificacion=ai_output["justificacion"]
    )
    
    db.add(db_analysis)
    db.commit()
    db.refresh(db_analysis)
    return db_analysis