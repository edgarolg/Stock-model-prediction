from fastapi import APIRouter, HTTPException, Query
from backend.services.market_data import get_stock_data, get_stock_info
from backend.services.technical import calculate_all_indicators, get_latest_signals

router = APIRouter(prefix="/stocks", tags=["Market Data"])

@router.get("/{ticker}/info")
def stock_info(ticker: str):
    """Retorna los metadatos generales de una empresa para los encabezados del frontend."""
    try:
        return get_stock_info(ticker.upper())
    except Exception as e:
        raise HTTPException(status_code=404, detail=str(e))

@router.get("/{ticker}/history")
def stock_history(
    ticker: str,
    period: str = Query(default="6mo", description="Período de velas: 1mo, 3mo, 6mo, 1y, 2y")
):
    """Retorna el histórico de precios OHLCV estructurado para las gráficas de Recharts."""
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
        return {"ticker": ticker.upper(), "period": period, "data": records}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{ticker}/indicators")
def stock_indicators(
    ticker: str,
    period: str = Query(default="6mo")
):
    """Retorna las líneas de indicadores técnicos calculados (RSI, MACD, SMAs)."""
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
            })
        return {"ticker": ticker.upper(), "latest_signals": signals, "history": history}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))