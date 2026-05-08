import sys, os
import numpy as np
import pandas as pd
from sklearn.preprocessing import MinMaxScaler

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..')))

# -----------------------------
# LIMPIEZA
# -----------------------------
def _clean(df):
    df = df.dropna(subset=["RSI", "MACD"])
    return df

# -----------------------------
# FEATURES
# -----------------------------
def _add_features(df):

    # RSI simple
    delta = df["Close"].diff()

    gain = delta.where(delta > 0, 0)
    loss = -delta.where(delta < 0, 0)

    avg_gain = gain.rolling(14).mean()
    avg_loss = loss.rolling(14).mean()

    rs = avg_gain / avg_loss

    df["RSI"] = 100 - (100 / (1 + rs))

    # MACD
    ema12 = df["Close"].ewm(span=12).mean()
    ema26 = df["Close"].ewm(span=26).mean()

    df["MACD"] = ema12 - ema26

    df = df.dropna()

    return df

# -----------------------------
# NORMALIZAR
# -----------------------------
def _normalize(df):

  if df.empty:
      raise ValueError("El dataframe está vacío después del preprocessing")

  scaler = MinMaxScaler()

  scaled = scaler.fit_transform(df[["Close", "RSI", "MACD"]])

  return scaled, scaler

# -----------------------------
# SECUENCIAS
# -----------------------------
def _create_sequences(data, window):

    X = []
    y = []

    for i in range(window, len(data)):
        X.append(data[i-window:i])
        y.append(data[i][0])  # Close

    return np.array(X), np.array(y)

# -----------------------------
# PIPELINE
# -----------------------------
def run_pipeline(ticker: str, window: int = 30):

    from backend.data.preparation.data_fetching import get_stock_data

    df_raw = get_stock_data(ticker)

    df_clean = _clean(df_raw)

    df_features = _add_features(df_clean)

    df_scaled, scaler = _normalize(df_features)

    X, y = _create_sequences(df_scaled, window)

    return {
        "ticker": ticker,
        "df_features": df_features,
        "df_scaled": df_scaled,
        "X": X,
        "y": y,
        "scaler": scaler,
    }