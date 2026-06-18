import numpy as np
import pandas as pd
from scipy.signal import savgol_filter
from sklearn.preprocessing import MinMaxScaler
import xgboost as xgb
from tensorflow.keras.models import Sequential
from tensorflow.keras.layers import LSTM, Dense, Dropout
from tensorflow.keras.callbacks import EarlyStopping
import threading

# Diccionarios globales para mantener los modelos y scalers en memoria por cada Stock
# Evita la persistencia en disco y optimiza la velocidad en el backend
_MODELS_REGISTRY = {}
_SCALERS_REGISTRY = {}
_registry_lock = threading.Lock()

class StockPredictionService:
    """
    Servicio especializado en el entrenamiento y predicción aislada por Stock.
    Implementa un ensamble híbrido LSTM + XGBoost optimizado mediante retornos logarítmicos.
    """

    @staticmethod
    def preprocess_and_clean(df: pd.DataFrame) -> pd.DataFrame:
        """
        Aplica ingeniería de características avanzada y eliminación de ruido matemático.
        """
        df = df.copy()
        
        # 1. Reducción de ruido: Filtro Savitzky-Golay sobre el precio de cierre
        # Suaviza la serie temporal sin introducir desfases temporales
        if len(df) > 15:
            df['smoothed_close'] = savgol_filter(df['Close'], window_length=11, polyorder=2)
        else:
            df['smoothed_close'] = df['Close']

        # 2. Variable Objetivo Estacionaria: Retornos Logarítmicos del precio suavizado
        df['log_return'] = np.log(df['smoothed_close'] / df['smoothed_close'].shift(1))
        
        # 3. Características Técnicas Adicionales para XGBoost (Volatilidad y Momento)
        # Asume que RSI, MACD y SMA ya vienen calculados de technical.py, añadimos volatilidad interna:
        df['pct_change'] = df['Close'].pct_change()
        df['hl_range'] = (df['High'] - df['Low']) / df['Close']
        df['volume_momentum'] = df['Volume'].pct_change()
        
        # Rezagos (Lags) para que XGBoost entienda la secuencia temporal reciente
        for i in range(1, 4):
            df[f'return_lag_{i}'] = df['log_return'].shift(i)
            
        return df.dropna()

    @classmethod
    def prepare_lstm_data(cls, target_series: np.ndarray, lookback: int = 20):
        """
        Genera las ventanas de tiempo deslizantes (X) y sus etiquetas (y) para el LSTM.
        """
        X, y = [], []
        for i in range(len(target_series) - lookback):
            X.append(target_series[i:(i + lookback)])
            y.append(target_series[i + lookback])
        return np.array(X), np.array(y)

    @classmethod
    def train_stock_models(cls, ticker: str, historical_df: pd.DataFrame, lookback: int = 20):
        """
        Entrena el modelo híbrido (LSTM + XGBoost) específico para un ticker y lo guarda en memoria.
        """
        df_processed = cls.preprocess_and_clean(historical_df)
        
        if len(df_processed) < (lookback + 10):
            raise ValueError(f"Datos insuficientes para entrenar el modelo de {ticker}. Se requieren más días.")

        # --- FASE 1: ENTRENAMIENTO LSTM (Secuencial - Captura la Macro Tendencia) ---
        returns_data = df_processed['log_return'].values.reshape(-1, 1)
        
        scaler = MinMaxScaler(feature_range=(-1, 1))
        scaled_returns = scaler.fit_transform(returns_data)
        
        X_lstm, y_lstm = cls.prepare_lstm_data(scaled_returns, lookback)
        
        # División Entrenamiento/Validación para control de overfitting
        split = int(len(X_lstm) * 0.8)
        X_train_l, X_val_l = X_lstm[:split], X_lstm[split:]
        y_train_l, y_val_l = y_lstm[:split], y_lstm[split:]

        # Arquitectura LSTM Regularizada
        lstm_model = Sequential([
            LSTM(64, return_sequences=True, input_shape=(lookback, 1)),
            Dropout(0.2),
            LSTM(32, return_sequences=False),
            Dropout(0.2),
            Dense(16, activation='tanh'),
            Dense(1)
        ])
        
        lstm_model.compile(optimizer='adam', loss='huber_loss') # Huber loss es robusto a outliers del mercado
        
        early_stop = EarlyStopping(monitor='val_loss', patience=10, restore_best_weights=True)
        
        lstm_model.fit(
            X_train_l, y_train_l,
            validation_data=(X_val_l, y_val_l),
            epochs=50,
            batch_size=32,
            callbacks=[early_stop],
            verbose=0
        )

        # --- FASE 2: ENTRENAMIENTO XGBOOST (Tabular - Ajuste Fino No Lineal) ---
        # Usamos las predicciones del LSTM en el set de entrenamiento como una característica para XGBoost
        lstm_train_preds = lstm_model.predict(X_lstm, verbose=0)
        
        # Construcción de la matriz de características para XGBoost
        # Combinamos indicadores técnicos y la predicción base del LSTM
        feature_cols = ['hl_range', 'volume_momentum', 'return_lag_1', 'return_lag_2', 'return_lag_3']
        # Asegurar alineación de índices debido al lookback del LSTM
        xgb_features = df_processed.iloc[lookback:][feature_cols].copy()
        xgb_features['lstm_meta_feature'] = lstm_train_preds
        
        y_xgb = df_processed.iloc[lookback:]['log_return'].values

        xgb_model = xgb.XGBRegressor(
            n_estimators=100,
            max_depth=3, # Profundidad baja para evitar ruidos y sobreajustes
            learning_rate=0.03,
            subsample=0.8,
            colsample_bytree=0.8,
            random_state=42
        )
        
        xgb_model.fit(xgb_features, y_xgb)

        # --- GUARDAR EN MEMORIA ENTRYS ---
        with _registry_lock:
            _MODELS_REGISTRY[ticker] = {
                'lstm': lstm_model,
                'xgb': xgb_model,
                'feature_cols': feature_cols,
                'lookback': lookback
            }
            _SCALERS_REGISTRY[ticker] = scaler

    @classmethod
    def predict_next_price(cls, ticker: str, historical_df: pd.DataFrame) -> float:
        """
        Calcula la predicción numérica base para el siguiente día hábil.
        Desnormaliza el retorno matemático y lo transforma en precio real de mercado.
        """
        with _registry_lock:
            if ticker not in _MODELS_REGISTRY:
                # Si el modelo no está en memoria, se entrena automáticamente al vuelo
                cls.train_stock_models(ticker, historical_df)
                
            models = _MODELS_REGISTRY[ticker]
            scaler = _SCALERS_REGISTRY[ticker]

        df_processed = cls.preprocess_and_clean(historical_df)
        lookback = models['lookback']
        
        if len(df_processed) < lookback:
            raise ValueError(f"Historial insuficiente para generar predicción de {ticker}.")

        # Ultimo bloque de datos para alimentar el LSTM
        last_returns = df_processed['log_return'].values[-lookback:].reshape(-1, 1)
        last_returns_scaled = scaler.transform(last_returns)
        X_input_lstm = np.array([last_returns_scaled])

        # 1. Predicción Base LSTM
        lstm_pred_scaled = models['lstm'].predict(X_input_lstm, verbose=0)
        
        # 2. Construcción de features de entrada para XGBoost
        last_row = df_processed.iloc[-1]
        xgb_input_dict = {col: [last_row[col]] for col in models['feature_cols']}
        xgb_input_df = pd.DataFrame(xgb_input_dict)
        xgb_input_df['lstm_meta_feature'] = lstm_pred_scaled[0]

        # 3. Predicción Ensamble Final (Retorno Logarítmico Esperado)
        predicted_log_return = float(models['xgb'].predict(xgb_input_df)[0])

        # --- DESNORMALIZACIÓN MATEMÁTICA A PRECIO REAL ---
        # Formula: Precio_Mañana = Precio_Hoy * e^(Retorno_Logarítmico)
        last_real_price = float(historical_df['Close'].iloc[-1])
        predicted_price = last_real_price * np.exp(predicted_log_return)

        return round(predicted_price, 2)