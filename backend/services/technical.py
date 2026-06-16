import pandas as pd
import numpy as np


def calculate_sma(df: pd.DataFrame, windows: list[int] = [20, 50, 200]) -> pd.DataFrame:
    """
    Calcula Simple Moving Averages (Medias Móviles Simples).
    Rellena de forma segura los valores nulos iniciales y previene
    warnings de 'Downcasting' en versiones nuevas de Pandas.
    """
    result = df.copy()
    
    for window in windows:
        # 1. Calculamos la media. Si no hay datos suficientes, Pandas pondrá NaNs numéricos por defecto.
        result[f"SMA_{window}"] = result["Close"].rolling(window=window).mean()
        
        # 2. Rellenamos los vacíos con el precio de cierre y forzamos el tipo float
        # para evitar el FutureWarning de object dtype downcasting.
        result[f"SMA_{window}"] = result[f"SMA_{window}"].fillna(result["Close"]).astype(float)
        
    return result

def calculate_rsi(df: pd.DataFrame, period: int = 14) -> pd.DataFrame:
    """
    Calcula el RSI (Relative Strength Index).

    El RSI mide la velocidad y magnitud de los cambios de precio.
    - RSI > 70: El activo está sobrecomprado (posible bajada)
    - RSI < 30: El activo está sobrevendido (posible subida)
    - RSI entre 30-70: Zona neutral

    Fórmula:
        RSI = 100 - (100 / (1 + RS))
        RS  = Promedio de ganancias / Promedio de pérdidas

    Args:
        df: DataFrame con columna 'Close'
        period: Período de cálculo (estándar = 14 días)

    Returns:
        DataFrame con columna 'RSI'
    """
    result = df.copy()

    delta = result["Close"].diff()

    gain = delta.clip(lower=0)
    loss = -delta.clip(upper=0)

    avg_gain = gain.rolling(window=period).mean()
    avg_loss = loss.rolling(window=period).mean()

    rs = avg_gain / avg_loss
    result["RSI"] = 100 - (100 / (1 + rs))

    return result


def calculate_macd(
    df: pd.DataFrame,
    fast: int = 12,
    slow: int = 26,
    signal: int = 9
) -> pd.DataFrame:
    """
    Calcula el MACD (Moving Average Convergence Divergence).

    El MACD muestra la relación entre dos EMAs (medias móviles exponenciales).
    Se usa para identificar cambios de tendencia y momentum.

    Componentes:
        - MACD Line    = EMA(12) - EMA(26)
        - Signal Line  = EMA(9) de la MACD Line
        - Histogram    = MACD Line - Signal Line

    Interpretación:
        - MACD cruza Signal hacia arriba → señal de compra
        - MACD cruza Signal hacia abajo  → señal de venta
        - Histograma positivo → momentum alcista
        - Histograma negativo → momentum bajista

    Args:
        df: DataFrame con columna 'Close'
        fast: Período EMA rápida (default 12)
        slow: Período EMA lenta (default 26)
        signal: Período de la línea de señal (default 9)

    Returns:
        DataFrame con columnas MACD, MACD_Signal, MACD_Histogram
    """
    result = df.copy()

    ema_fast = result["Close"].ewm(span=fast, adjust=False).mean()
    ema_slow = result["Close"].ewm(span=slow, adjust=False).mean()

    result["MACD"] = ema_fast - ema_slow
    result["MACD_Signal"] = result["MACD"].ewm(span=signal, adjust=False).mean()
    result["MACD_Histogram"] = result["MACD"] - result["MACD_Signal"]

    return result


def calculate_all_indicators(df: pd.DataFrame) -> pd.DataFrame:
    """
    Aplica todos los indicadores técnicos al DataFrame de una vez.

    Args:
        df: DataFrame con columnas OHLCV (Open, High, Low, Close, Volume)

    Returns:
        DataFrame completo con todos los indicadores calculados
    """
    df = calculate_sma(df)
    df = calculate_rsi(df)
    df = calculate_macd(df)
    return df


def get_latest_signals(df: pd.DataFrame) -> dict:
    """
    Extrae los valores más recientes de todos los indicadores
    y genera señales de trading básicas.

    Args:
        df: DataFrame con indicadores ya calculados

    Returns:
        Diccionario con los últimos valores y señales
    """
    latest = df.iloc[-1]

    rsi_value = latest.get("RSI", None)
    macd_value = latest.get("MACD", None)
    signal_value = latest.get("MACD_Signal", None)

    # Señal RSI
    if rsi_value is not None:
        if rsi_value > 70:
            rsi_signal = "SOBRECOMPRADO"
        elif rsi_value < 30:
            rsi_signal = "SOBREVENDIDO"
        else:
            rsi_signal = "NEUTRAL"
    else:
        rsi_signal = "N/A"

    # Señal MACD
    if macd_value is not None and signal_value is not None:
        macd_signal = "ALCISTA" if macd_value > signal_value else "BAJISTA"
    else:
        macd_signal = "N/A"

    return {
        "close": round(float(latest["Close"]), 2),
        "sma_20": round(float(latest["SMA_20"]), 2) if not pd.isna(latest.get("SMA_20")) else None,
        "sma_50": round(float(latest["SMA_50"]), 2) if not pd.isna(latest.get("SMA_50")) else None,
        "sma_200": round(float(latest["SMA_200"]), 2) if not pd.isna(latest.get("SMA_200")) else None,
        "rsi": round(float(rsi_value), 2) if rsi_value is not None else None,
        "rsi_signal": rsi_signal,
        "macd": round(float(macd_value), 4) if macd_value is not None else None,
        "macd_signal_line": round(float(signal_value), 4) if signal_value is not None else None,
        "macd_histogram": round(float(latest.get("MACD_Histogram", 0)), 4),
        "macd_trend": macd_signal,
    }