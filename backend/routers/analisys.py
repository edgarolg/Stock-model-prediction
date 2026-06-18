from fastapi import APIRouter, HTTPException, Query, Depends
from pydantic import BaseModel
from typing import Dict, Any
from sqlalchemy.orm import Session

from backend.database.connection import get_db
from backend.database.models import HybridAnalysisHistory
from backend.services.analysis import analysis_orchestrator
from backend.services.analysis_db import save_hybrid_analysis
from backend.services.news_scraper import news_fetcher
from backend.services.rag import rag_service

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
    
@router.get("/test-rag/{ticker}", tags=["Pruebas y Debug"])
def test_rag_pipeline(ticker: str):
    """
    ENDPOINT DE PRUEBA: 
    Solo ejecuta la descarga de noticias y la búsqueda semántica en ChromaDB.
    Sirve para verificar qué contexto leerá Llama 3 antes de generar una predicción.
    """
    ticker_upper = ticker.upper()
    
    try:
        # 1. Forzamos la descarga y vectorización de noticias frescas
        ingested_count = news_fetcher.fetch_and_ingest_news(ticker=ticker_upper, limit=5)
        
        # 2. Simulamos la consulta que haría el orquestador
        query_context = f"financial state reports and growth metrics of {ticker_upper}"
        news_context = rag_service.query_market_context(
            ticker=ticker_upper, 
            query_text=query_context, 
            top_k=3
        )
        
        return {
            "status": "success",
            "ticker": ticker_upper,
            "noticias_descargadas": ingested_count,
            "contexto_para_llm": news_context,
            "nota": "Este es el texto EXACTO que se inyectará en el prompt de Llama 3."
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Fallo en el pipeline RAG: {str(e)}")
    
@router.post("/run/full-pipeline/{ticker}", tags=["Pruebas y Debug"])
def run_full_pipeline(ticker: str, risk_profile: str = "moderado", db: Session = Depends(get_db)):
    """
    ENDPOINT UNIFICADO DE PRUEBA: 
    Ejecuta TODO el ecosistema de Inteligencia Híbrida de principio a fin.
    Fase 1 (Math) + Auto-Scraping + RAG + Fase 2 (LLM) + Guardado en Base de Datos.
    """
    ticker_upper = ticker.upper()
    print(f"\n==================================================")
    print(f"INICIANDO PIPELINE COMPLETO PARA: {ticker_upper}")
    print(f"==================================================")
    
    try:
        # ---------------------------------------------------------
        # PASO 1: FASE CUANTITATIVA (Cerebro Matemático)
        # ---------------------------------------------------------
        print(f"-> [1/4] Ejecutando modelo LSTM + XGBoost...")
        fase1_results = analysis_orchestrator.get_quantitative_base(ticker=ticker_upper)
        
        pred_base = fase1_results["pred_base_lstm"]
        signals = fase1_results["technical_signals"]
        
        # ---------------------------------------------------------
        # PASO 2 y 3: NOTICIAS (RSS) + RAG + IA (Cerebro Cognitivo)
        # ---------------------------------------------------------
        print(f"-> [2/4] Buscando contexto, leyendo RSS y consultando Llama 3...")
        # Nota: get_qualitative_adjustment ya incluye internamente news_fetcher y rag_service
        fase2_results = analysis_orchestrator.get_qualitative_adjustment(
            ticker=ticker_upper,
            pred_base_usd=pred_base,
            technical_signals=signals
        )
        
        # ---------------------------------------------------------
        # PASO 4: PERSISTENCIA (Guardar en Auditoría)
        # ---------------------------------------------------------
        print(f"-> [3/4] Guardando registro de auditoría en SQLite...")
        
        # 1. Empaquetar las métricas como lo espera tu servicio
        metrics_input = {
            "last_close": signals.get("last_close", pred_base), 
            "pred_lstm": pred_base
        }
        
        # 2. Empaquetar el output de IA
        ai_output = {
            "ajuste_llm": fase2_results["ajuste_llm_porcentual"],
            "confianza": fase2_results["confianza_analisis"],
            "justificacion": fase2_results["justificacion"]
        }

        # 3. Guardar en base de datos
        db_record = save_hybrid_analysis(
            db=db, 
            ticker=ticker_upper, 
            metrics=metrics_input,
            ai_output=ai_output, 
            final_price=fase2_results["precio_final_hibrido"], 
            recomendacion=fase2_results["recomendacion"]
        )
        
        print(f"-> [4/4] Pipeline completado con éxito. ID de DB: {db_record.id}")
        
        # Retornar el informe completo consolidado
        return {
            "status": "success",
            "ticker": ticker_upper,
            "resumen_ejecutivo": {
                "precio_cierre_hoy": signals.get("last_close"),
                "prediccion_base_lstm": pred_base,
                "precio_final_ajustado_ia": fase2_results["precio_final_hibrido"],
                "recomendacion_final": fase2_results["recomendacion"],
                "confianza_del_modelo": fase2_results["confianza_analisis"]
            },
            "justificacion_llm": fase2_results["justificacion"],
            "detalles_tecnicos": {
                "indicadores_usados": signals,
                "ajuste_matematico_aplicado": fase2_results["ajuste_llm_porcentual"],
                "noticias_leidas_por_llm": fase2_results["noticias_evaluadas_count"]
            },
            "auditoria": {
                "database_id": db_record.id,
                "perfil_de_riesgo": risk_profile
            }
        }

    except Exception as e:
        print(f"[ERROR FATAL] El pipeline falló: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Fallo en el pipeline completo: {str(e)}")
    

# =====================================================================
# RUTAS DE HISTORIAL Y AUDITORÍA (BASE DE DATOS)
# =====================================================================

@router.get("/history/all", tags=["Historial y Base de Datos"])
def get_all_analysis_history(skip: int = 0, limit: int = 50, db: Session = Depends(get_db)):
    """
    Obtiene el historial general de todos los análisis realizados en la plataforma.
    Incluye paginación (skip y limit) para no saturar la respuesta.
    """
    records = db.query(HybridAnalysisHistory).order_by(
        HybridAnalysisHistory.execution_date.desc()
    ).offset(skip).limit(limit).all()
    
    return {
        "status": "success",
        "total_returned": len(records),
        "data": records
    }


@router.get("/history/{ticker}/all", tags=["Historial y Base de Datos"])
def get_ticker_history(ticker: str, limit: int = 20, db: Session = Depends(get_db)):
    """
    Obtiene todo el historial de predicciones para una acción específica (Ej: AAPL).
    Ideal para graficar cómo ha cambiado la opinión de la IA a lo largo del tiempo.
    """
    ticker_upper = ticker.upper()
    records = db.query(HybridAnalysisHistory).filter(
        HybridAnalysisHistory.ticker == ticker_upper
    ).order_by(
        HybridAnalysisHistory.execution_date.desc()
    ).limit(limit).all()
    
    if not records:
        raise HTTPException(status_code=404, detail=f"No hay historial guardado para {ticker_upper}")
        
    return {
        "status": "success",
        "ticker": ticker_upper,
        "total_returned": len(records),
        "data": records
    }


@router.get("/history/{ticker}/latest", tags=["Historial y Base de Datos"])
def get_latest_ticker_analysis(ticker: str, db: Session = Depends(get_db)):
    """
    Obtiene ÚNICAMENTE el análisis más reciente de un ticker.
    Este es el endpoint que tu Frontend consumirá para mostrar el estado actual.
    """
    ticker_upper = ticker.upper()
    record = db.query(HybridAnalysisHistory).filter(
        HybridAnalysisHistory.ticker == ticker_upper
    ).order_by(
        HybridAnalysisHistory.execution_date.desc()
    ).first()
    
    if not record:
        raise HTTPException(status_code=404, detail=f"No hay análisis previos para {ticker_upper}. Ejecuta el pipeline primero.")
        
    return {
        "status": "success",
        "ticker": ticker_upper,
        "data": record
    }