import os
import sys
import pickle
import numpy as np
import pandas as pd
from sklearn.preprocessing import MinMaxScaler

# Inyección de PATH para asegurar que detecte el módulo 'backend' desde cualquier nivel
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))

from backend.services.market_data import get_stock_data
from backend.services.technical import calculate_all_indicators


def prepare_and_save_data(ticker: str, period: str = "2y", lookback_days: int = 30, train_split: float = 0.8):
    """
    Descarga, limpia, genera características, normaliza y crea secuencias temporales
    para el entrenamiento del modelo LSTM y XGBoost.
    Guarda los escaladores en el backend y los datasets procesados en el entorno de finetuning.
    """
    print(f"=== Iniciando preparación de datos para: {ticker} ===")
    
    # 1. Asegurar la existencia de los directorios de salida
    models_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../backend/data/models"))
    dataset_out_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "dataset"))
    
    os.makedirs(models_dir, exist_ok=True)
    os.makedirs(dataset_out_dir, exist_ok=True)

    # 2. Obtención de Datos Crudos
    try:
        df_raw = get_stock_data(ticker.upper(), period=period)
        print(f"[-] Datos descargados exitosamente. Registros iniciales: {len(df_raw)}")
    except Exception as e:
        print(f"[ERROR] No se pudieron obtener datos para el ticker {ticker}: {e}")
        return

    # 3. Limpieza Estricta y Eliminación de Duplicados
    df_clean = df_raw.copy()
    df_clean = df_clean.loc[~df_clean.index.duplicated(keep='first')]
    df_clean = df_clean.ffill().bfill()  # Interpolación segura de NaNs

    # 4. Ingeniería de Características (Reutilizando tu servicio técnico)
    df_features = calculate_all_indicators(df_clean)
    
    # IMPORTANTE: Los indicadores como SMA_200 generan NaNs al inicio por falta de historial.
    # Debemos eliminar esas filas para no corromper el escalador.
    df_features = df_features.dropna()
    print(f"[-] Características calculadas (SMA, RSI, MACD). Registros útiles post-limpieza: {len(df_features)}")

    # Columnas seleccionadas para el entrenamiento del modelo
    feature_cols = [
        "Open", "High", "Low", "Close", "Volume", 
        "SMA_20", "SMA_50", "SMA_200", 
        "RSI", "MACD", "MACD_Signal", "MACD_Histogram"
    ]
    
    # Filtrar solo las columnas que usaremos
    df_final = df_features[feature_cols].copy()

    # 5. Normalización de Datos (Arquitectura Doble Escalador)
    feature_scaler = MinMaxScaler(feature_range=(0, 1))
    target_scaler = MinMaxScaler(feature_range=(0, 1))

    # Escalar variables de entrada (X) y objetivo (y = Close)
    scaled_features = feature_scaler.fit_transform(df_final)
    scaled_target = target_scaler.fit_transform(df_final[["Close"]])

    # Guardar los escaladores en disco para que FastAPI los consuma en producción
    feature_scaler_path = os.path.join(models_dir, f"{ticker.lower()}_feature_scaler.pkl")
    target_scaler_path = os.path.join(models_dir, f"{ticker.lower()}_target_scaler.pkl")

    with open(feature_scaler_path, "wb") as f:
        pickle.dump(feature_scaler, f)
    with open(target_scaler_path, "wb") as f:
        pickle.dump(target_scaler, f)
        
    print(f"[-] Escaladores guardados en: {models_dir}/")

    # 6. Creación de Secuencias Temporales (Ventana Deslizable para LSTM)
    X, y = [], []
    for i in range(lookback_days, len(scaled_features)):
        # Tomamos los 'lookback_days' anteriores como matriz de características
        X.append(scaled_features[i - lookback_days:i])
        # El objetivo es el precio de cierre del día actual (día lookback_days + 1)
        y.append(scaled_target[i])

    X, y = np.array(X), np.array(y)
    print(f"[-] Secuencias temporales creadas. Formato de X: {X.shape}, Formato de y: {y.shape}")

    # 7. Split Temporal Cronológico (Evita Data Leakage del futuro)
    split_index = int(len(X) * train_split)
    
    X_train, X_test = X[:split_index], X[split_index:]
    y_train, y_test = y[:split_index], y[split_index:]

    print(f"[-] División cronológica realizada ({int(train_split*100)}% / {int((1-train_split)*100)}%)")
    print(f"    -> Train: {X_train.shape[0]} muestras")
    print(f"    -> Test:  {X_test.shape[0]} muestras")

    # 8. Guardar conjuntos de datos finales en formato numpy binario (.npy) para carga ultra rápida
    np.save(os.path.join(dataset_out_dir, f"{ticker.lower()}_X_train.npy"), X_train)
    np.save(os.path.join(dataset_out_dir, f"{ticker.lower()}_X_test.npy"), X_test)
    np.save(os.path.join(dataset_out_dir, f"{ticker.lower()}_y_train.npy"), y_train)
    np.save(os.path.join(dataset_out_dir, f"{ticker.lower()}_y_test.npy"), y_test)
    
    print(f"=== Proceso completado con éxito para {ticker}. Archivos listos para train.py ===\n")


if __name__ == "__main__":
    # Ticker de prueba inicial (puedes cambiarlo o pasar por argumentos de consola)
    ticker_ejemplo = "AAPL"
    prepare_and_save_data(ticker=ticker_ejemplo, period = "2y", lookback_days = 30)