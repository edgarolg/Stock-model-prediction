from fastapi import APIRouter, HTTPException, Query
from backend.services.market_data import get_stock_data, get_stock_info
from backend.services.technical import calculate_all_indicators, get_latest_signals
from backend.routers.analysis import analysis_orchestrator

router = APIRouter(prefix="/stocks", tags=["stocks"])


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

        # Convertimos el DataFrame a lista de dicts para JSON
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

        # Historial de indicadores para graficar en el frontend
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
    
@router.get("/{ticker}/analysis")
def get_hybrid_stock_analysis(ticker: str):
    """
    Ejecuta el pipeline predictivo completo de StockIntel:
    Funde la red neuronal LSTM (60%) con el análisis cognitivo de Llama 3.2 + RAG (40%).
    """
    try:
        # Llama de forma directa al orquestador que unifica todo el sistema
        result = analysis_orchestrator.execute_hybrid_analysis(ticker=ticker)
        return result
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error interno en el pipeline híbrido: {str(e)}")