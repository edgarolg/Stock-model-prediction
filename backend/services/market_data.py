import yfinance as yf
import pandas as pd
from datetime import datetime, timedelta


def get_stock_data(ticker: str, period: str = "6mo") -> pd.DataFrame:
    """
    Descarga datos históricos de un ticker desde Yahoo Finance.

    Args:
        ticker: Símbolo del stock (ej. "AAPL", "TSLA")
        period: Período de tiempo. Opciones: 1d, 5d, 1mo, 3mo, 6mo, 1y, 2y, 5y, 10y, ytd, max

    Returns:
        DataFrame con columnas: Open, High, Low, Close, Volume
    """
    stock = yf.Ticker(ticker)
    df = stock.history(period=period)

    if df.empty:
        raise ValueError(f"No se encontraron datos para el ticker: {ticker}")

    # Limpiamos columnas que no necesitamos
    df = df[["Open", "High", "Low", "Close", "Volume"]]
    df.index = pd.to_datetime(df.index)

    return df


def get_stock_info(ticker: str) -> dict:
    """
    Obtiene información general de una empresa (nombre, sector, precio actual, etc.)

    Args:
        ticker: Símbolo del stock

    Returns:
        Diccionario con metadata de la empresa
    """
    stock = yf.Ticker(ticker)
    info = stock.info

    return {
        "ticker": ticker.upper(),
        "name": info.get("longName", "N/A"),
        "sector": info.get("sector", "N/A"),
        "industry": info.get("industry", "N/A"),
        "current_price": info.get("currentPrice", info.get("regularMarketPrice", None)),
        "market_cap": info.get("marketCap", None),
        "currency": info.get("currency", "USD"),
        "exchange": info.get("exchange", "N/A"),
        "description": info.get("longBusinessSummary", "N/A"),
    }