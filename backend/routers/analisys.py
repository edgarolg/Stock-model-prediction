from fastapi import APIRouter, HTTPException, Query, Depends
from pydantic import BaseModel
from typing import Dict, Any
from sqlalchemy.orm import Session

# Inyección de la sesión de Base de Datos
from backend.database.connection import get_db

# Servicios de datos de mercado y técnicos (Pasos 2 completos)
from backend.services.market_data import get_stock_data, get_stock_info
from backend.services.technical import calculate_all_indicators, get_latest_signals

# Orquestador del pipeline y persistencia (Pasos 3, 4, 5)
from backend.services.analysis import analysis_orchestrator
from backend.services.analysis_db import save_hybrid_analysis

router = APIRouter(prefix="/stocks", tags=["stocks"])

# ==========================================
# ESQUEMAS PYDANTIC
# ==========================================
class QualitativeAnalysisRequest(BaseModel):
    """Esquema para recibir los datos de la Fase 1 y pasarlos a la Fase 2"""
    pred_base_lstm: float
    technical_signals: Dict[str, Any]
    risk_profile: str = "moderado"  # conservador, moderado, agresivo


# ==========================================
# RUTAS BÁSICAS DE MERCADO E INDICADORES
# ==========================================
@router.get("/{ticker}/info")
def stock_info(ticker: str):
    """
    Retorna información general de una empresa.
    Ejemplo: GET /stocks/AAPL/info
    """
    try:
        info = get_stock_info(ticker.upper())
        return info
    except Exception as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/{ticker}/history")
def stock_history(
    ticker: str,
    period: str = Query(default="6mo", description="Período: 1mo, 3mo, 6mo, 1y, 2y")
):
    """
    Retorna el historial de precios OHLCV de un ticker.
    Ejemplo: GET /stocks/AAPL/history?period=3mo
    """
    try:
        df = get_stock_data(ticker.upper(), period=period)

        records = []
        for date, row in df.iterrows():
            records.append({
                "date": date.strftime("%Y-%m-%d"),
                "open": round(float(row["Open"]), 2),
                "high": round(float(row["High"]), 2),
                "low": round(float(row["Low"]), 2),
                "close": round(float(row["Close"]), 2),
                "volume": int(row["Volume"]),
            })

        return {
            "ticker": ticker.upper(),
            "period": period,
            "total_records": len(records),
            "data": records,
        }
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{ticker}/indicators")
def stock_indicators(
    ticker: str,
    period: str = Query(default="6mo", description="Período de datos para calcular indicadores")
):
    """
    Retorna los indicadores técnicos calculados (RSI, MACD, SMA) para un ticker.
    Ejemplo: GET /stocks/AAPL/indicators?period=1y
    """
    try:
        df = get_stock_data(ticker.upper(), period=period)
        df = calculate_all_indicators(df)
        signals = get_latest_signals(df)

        history = []
        for date, row in df.iterrows():
            history.append({
                "date": date.strftime("%Y-%m-%d"),
                "close": round(float(row["Close"]), 2),
                "sma_20": round(float(row["SMA_20"]), 2) if not __import__("math").isnan(row.get("SMA_20", float("nan"))) else None,
                "sma_50": round(float(row["SMA_50"]), 2) if not __import__("math").isnan(row.get("SMA_50", float("nan"))) else None,
                "rsi": round(float(row["RSI"]), 2) if not __import__("math").isnan(row.get("RSI", float("nan"))) else None,
                "macd": round(float(row["MACD"]), 4) if not __import__("math").isnan(row.get("MACD", float("nan"))) else None,
                "macd_signal": round(float(row["MACD_Signal"]), 4) if not __import__("math").isnan(row.get("MACD_Signal", float("nan"))) else None,
                "macd_histogram": round(float(row["MACD_Histogram"]), 4) if not __import__("math").isnan(row.get("MACD_Histogram", float("nan"))) else None,
            })

        return {
            "ticker": ticker.upper(),
            "period": period,
            "latest_signals": signals,
            "history": history,
        }
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ==========================================
# RUTAS DEL PIPELINE HÍBRIDO (DOS FASES)
# ==========================================
@router.get("/{ticker}/quantitative")
def get_quantitative_analysis(ticker: str):
    """
    FASE 1 (RÁPIDA): Inferencia cuantitativa de alta velocidad.
    Descarga el historial, calcula indicadores y ejecuta la predicción con LSTM.
    Usar esta ruta para pintar gráficos de inmediato en React.
    """
    try:
        result = analysis_orchestrator.get_quantitative_base(ticker=ticker)
        return result
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error en el pipeline cuantitativo base: {str(e)}")


@router.post("/{ticker}/qualitative")
def get_qualitative_analysis(ticker: str, payload: QualitativeAnalysisRequest, db: Session = Depends(get_db)):
    """
    FASE 2 (LENTA): Inferencia cualitativa cognitiva (RAG + Ollama).
    Recibe por POST los datos calculados en la Fase 1.
    Ejecuta búsqueda en ChromaDB, alimenta a Llama 3.2, calcula los pesos finales 
    y guarda el registro de auditoría en la Base de Datos.
    """
    try:
        # Llamada real al servicio orquestador cualitativo (Paso 3 y 4 internos)
        # Nota: El orquestador te devolverá el precio final combinado, el ajuste del llm y la justificación.
        result_qualitative = analysis_orchestrator.get_qualitative_adjustment(
            ticker=ticker,
            pred_base_usd=payload.pred_base_lstm,
            technical_signals=payload.technical_signals
        )
        
        # Obtenemos el último precio real para la base de datos
        # (Esto puede venir desde tu payload si lo agregas, o lo consultamos rápido)
        last_close = payload.technical_signals.get("last_close", payload.pred_base_lstm)

        # -----------------------------------------------------------------
        # Capa de Decisión según Perfil de Riesgo
        # -----------------------------------------------------------------
        precio_final_hibrido = result_qualitative["precio_final_hibrido"]
        rendimiento_esperado = (precio_final_hibrido / last_close) - 1
        risk_profile = payload.risk_profile.lower()

        if risk_profile == "conservador":
            recomendacion = "INVERTIR" if rendimiento_esperado > 0.05 else "ESPERAR"
            if rendimiento_esperado < -0.02: recomendacion = "NO INVERTIR"
        elif risk_profile == "agresivo":
            recomendacion = "INVERTIR" if rendimiento_esperado > 0.01 else "ESPERAR"
            if rendimiento_esperado < -0.08: recomendacion = "NO INVERTIR"
        else: # Moderado (Default)
            recomendacion = "INVERTIR" if rendimiento_esperado > 0.03 else "ESPERAR"
            if rendimiento_esperado < -0.05: recomendacion = "NO INVERTIR"

        # -----------------------------------------------------------------
        # PERSISTENCIA EN BASE DE DATOS
        # Aquí consolidamos y guardamos el log final de la predicción
        # -----------------------------------------------------------------
        metrics_input = {
            "last_close": last_close, 
            "pred_lstm": payload.pred_base_lstm
        }
        ai_output = {
            "ajuste_llm": result_qualitative["ajuste_llm_porcentual"],
            "confianza": result_qualitative["confianza_analisis"],
            "justificacion": result_qualitative["justificacion"]
        }

        db_record = save_hybrid_analysis(
            db=db,
            ticker=ticker,
            metrics=metrics_input,
            ai_output=ai_output,
            final_price=precio_final_hibrido,
            recomendacion=recomendacion
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
        raise HTTPException(status_code=500, detail=f"Error en el pipeline cognitivo e inserción a DB: {str(e)}")


@router.get("/predict/{ticker}")
def run_hybrid_analysis(
    ticker: str, 
    risk_profile: str = Query("moderado", enum=["conservador", "moderado", "agresivo"]), 
    db: Session = Depends(get_db)
):
    """
    Ruta Monolítica Alternativa: Hace FASE 1 y FASE 2 en un solo viaje HTTP.
    Ideal para scripts de prueba locales o peticiones donde el cliente prefiere esperar el proceso completo.
    """
    try:
        # 1. Ejecutar bloque Cuantitativo (Fase 1 simulada o directa)
        quant_result = analysis_orchestrator.get_quantitative_base(ticker=ticker)
        last_close = quant_result["last_close"]
        pred_lstm = quant_result["pred_base_lstm"]
        signals = quant_result["technical_signals"]
        
        # 2. Ejecutar bloque Cualitativo (Fase 2 directa)
        result_qualitative = analysis_orchestrator.get_qualitative_adjustment(
            ticker=ticker,
            pred_base_usd=pred_lstm,
            technical_signals=signals
        )
        
        # 3. Aplicar perfil de riesgo
        precio_final_hibrido = result_qualitative["precio_final_hibrido"]
        rendimiento_esperado = (precio_final_hibrido / last_close) - 1
        
        if risk_profile == "conservador":
            recomendacion = "INVERTIR" if rendimiento_esperado > 0.05 else "ESPERAR"
            if rendimiento_esperado < -0.02: recomendacion = "NO INVERTIR"
        elif risk_profile == "agresivo":
            recomendacion = "INVERTIR" if rendimiento_esperado > 0.01 else "ESPERAR"
            if rendimiento_esperado < -0.08: recomendacion = "NO INVERTIR"
        else:
            recomendacion = "INVERTIR" if rendimiento_esperado > 0.03 else "ESPERAR"
            if rendimiento_esperado < -0.05: recomendacion = "NO INVERTIR"
            
        # 4. Guardar en Base de Datos
        metrics_input = {"last_close": last_close, "pred_lstm": pred_lstm}
        ai_output = {
            "ajuste_llm": result_qualitative["ajuste_llm_porcentual"],
            "confianza": result_qualitative["confianza_analisis"],
            "justificacion": result_qualitative["justificacion"]
        }
        
        db_record = save_hybrid_analysis(
            db=db, ticker=ticker, metrics=metrics_input, 
            ai_output=ai_output, final_price=precio_final_hibrido, recomendacion=recomendacion
        )
        
        return {
            "status": "success",
            "analysis_id": db_record.id,
            "ticker": db_record.ticker,
            "risk_profile_applied": risk_profile,
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
        raise HTTPException(status_code=500, detail=f"Error en pipeline monolítico: {str(e)}")