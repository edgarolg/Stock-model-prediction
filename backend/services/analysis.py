import os
import sys
import json
import time
import joblib
import numpy as np
import pandas as pd
from scipy.signal import savgol_filter
from sklearn.preprocessing import MinMaxScaler
import xgboost as xgb
from tensorflow.keras.models import Sequential, load_model
from tensorflow.keras.layers import Input, LSTM, Dense, Dropout
from tensorflow.keras.callbacks import EarlyStopping

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))

from backend.services.market_data import get_stock_data
from backend.services.technical import calculate_all_indicators, get_latest_signals
from backend.services.rag import rag_service
from backend.services.llm import llm_service
from backend.services.news_scraper import news_fetcher

class AnalysisOrchestrator:
    """
    Orquestador principal de StockIntel. Implementa la arquitectura híbrida
    60% Matemática / 40% IA utilizando persistencia en disco con caducidad semanal
    para evitar saturar la memoria RAM.
    """

    def __init__(self):
        self.lookback_days = 20
        # Directorio donde se guardarán los .keras, .pkl y .json
        self.models_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "../data/models"))
        os.makedirs(self.models_dir, exist_ok=True)
        # Tiempo de caducidad del modelo: 7 días
        self.expiration_days = 7

    def _preprocess_and_denoise(self, df: pd.DataFrame) -> pd.DataFrame:
        """
        Aplica transformaciones estacionarias y reducción de ruido matemático a la serie temporal.
        """
        df = df.copy()
        if len(df) > 15:
            df['smoothed_close'] = savgol_filter(df['Close'], window_length=11, polyorder=2)
        else:
            df['smoothed_close'] = df['Close']

        df['log_return'] = np.log(df['smoothed_close'] / df['smoothed_close'].shift(1))
        df['hl_range'] = (df['High'] - df['Low']) / df['Close']
        df['volume_momentum'] = df['Volume'].pct_change()
        
        for i in range(1, 4):
            df[f'return_lag_{i}'] = df['log_return'].shift(i)
            
        return df.dropna()

    def _is_model_valid(self, ticker: str) -> bool:
        """Verifica si el modelo existe en disco y tiene menos de 1 semana de antigüedad."""
        meta_path = os.path.join(self.models_dir, f"{ticker}_meta.json")
        if not os.path.exists(meta_path):
            return False
            
        try:
            with open(meta_path, "r") as f:
                meta = json.load(f)
            # Calcular cuántos días han pasado desde el entrenamiento
            days_old = (time.time() - meta["timestamp"]) / (24 * 3600)
            return days_old < self.expiration_days
        except Exception:
            return False

    def _train_and_save_models(self, ticker: str, df_processed: pd.DataFrame):
        """Entrena los modelos y los guarda en el disco duro para no gastar RAM."""
        print(f"[!] Entrenando nuevos modelos para {ticker}... Esto puede tardar unos segundos.")
        returns_data = df_processed['log_return'].values.reshape(-1, 1)
        scaler = MinMaxScaler(feature_range=(-1, 1))
        scaled_returns = scaler.fit_transform(returns_data)
        
        X_lstm, y_lstm = [], []
        for i in range(len(scaled_returns) - self.lookback_days):
            X_lstm.append(scaled_returns[i:(i + self.lookback_days)])
            y_lstm.append(scaled_returns[i + self.lookback_days])
        X_lstm, y_lstm = np.array(X_lstm), np.array(y_lstm)

        # Keras 3 Sintaxis
        lstm_model = Sequential([
            Input(shape=(self.lookback_days, 1)),
            LSTM(32, return_sequences=True),
            Dropout(0.2),
            LSTM(16, return_sequences=False),
            Dropout(0.2),
            Dense(1)
        ])
        lstm_model.compile(optimizer='adam', loss='huber')
        
        early_stop = EarlyStopping(monitor='val_loss', patience=5, restore_best_weights=True)
        split = int(len(X_lstm) * 0.8)
        
        lstm_model.fit(
            X_lstm[:split], y_lstm[:split],
            validation_data=(X_lstm[split:], y_lstm[split:]),
            epochs=20, batch_size=32, callbacks=[early_stop], verbose=0
        )

        lstm_preds = lstm_model.predict(X_lstm, verbose=0)
        feature_cols = ['hl_range', 'volume_momentum', 'return_lag_1', 'return_lag_2', 'return_lag_3']
        
        xgb_features = df_processed.iloc[self.lookback_days:][feature_cols].copy()
        xgb_features['lstm_meta_feature'] = lstm_preds
        y_xgb = df_processed.iloc[self.lookback_days:]['log_return'].values

        xgb_model = xgb.XGBRegressor(n_estimators=50, max_depth=3, learning_rate=0.05, random_state=42)
        xgb_model.fit(xgb_features, y_xgb)

        # ================= GUARDAR EN DISCO =================
        lstm_model.save(os.path.join(self.models_dir, f"{ticker}_lstm.keras"))
        joblib.dump(xgb_model, os.path.join(self.models_dir, f"{ticker}_xgb.pkl"))
        joblib.dump(scaler, os.path.join(self.models_dir, f"{ticker}_scaler.pkl"))
        
        meta = {
            "timestamp": time.time(),
            "feature_cols": feature_cols,
            "lookback_days": self.lookback_days
        }
        with open(os.path.join(self.models_dir, f"{ticker}_meta.json"), "w") as f:
            json.dump(meta, f)
        print(f"[-] Modelos de {ticker} guardados exitosamente en disco.")

    def _load_models(self, ticker: str):
        """Carga los modelos desde el disco a la memoria solo para predecir."""
        lstm_model = load_model(os.path.join(self.models_dir, f"{ticker}_lstm.keras"))
        xgb_model = joblib.load(os.path.join(self.models_dir, f"{ticker}_xgb.pkl"))
        scaler = joblib.load(os.path.join(self.models_dir, f"{ticker}_scaler.pkl"))
        with open(os.path.join(self.models_dir, f"{ticker}_meta.json"), "r") as f:
            meta = json.load(f)
        return lstm_model, xgb_model, scaler, meta["feature_cols"]

    def get_quantitative_base(self, ticker: str) -> dict:
        """FASE 1: Inferencia matemática rápida leyendo desde el disco si es posible."""
        ticker_upper = ticker.upper()
        try:
            df = get_stock_data(ticker_upper, period="6mo")
            df_indicators = calculate_all_indicators(df)
            signals = get_latest_signals(df_indicators)
            
            last_close = round(float(df["Close"].iloc[-1]), 2)
            df_processed = self._preprocess_and_denoise(df_indicators)

            # LÓGICA DE CACHÉ
            if not self._is_model_valid(ticker_upper):
                self._train_and_save_models(ticker_upper, df_processed)
            else:
                print(f"[-] Cargando modelo existente de {ticker_upper} desde disco (Ahorrando RAM).")
                
            lstm_model, xgb_model, scaler, feature_cols = self._load_models(ticker_upper)

            last_returns = df_processed['log_return'].values[-self.lookback_days:].reshape(-1, 1)
            last_returns_scaled = scaler.transform(last_returns)
            
            lstm_pred_scaled = lstm_model.predict(np.array([last_returns_scaled]), verbose=0)
            
            last_row = df_processed.iloc[-1]
            xgb_input = pd.DataFrame({col: [last_row[col]] for col in feature_cols})
            xgb_input['lstm_meta_feature'] = lstm_pred_scaled[0]

            predicted_log_return = float(xgb_model.predict(xgb_input)[0])
            pred_base_lstm = round(last_close * np.exp(predicted_log_return), 2)

            return {
                "pred_base_lstm": pred_base_lstm,
                "technical_signals": {
                    "rsi": round(signals.get("rsi", 50.0), 2),
                    "macd": round(signals.get("macd", 0.0), 4),
                    "macd_signal": round(signals.get("macd_signal", 0.0), 4),
                    "macd_histogram": round(signals.get("macd_histogram", 0.0), 4),
                    "sma_20": round(df_indicators["SMA_20"].iloc[-1], 2) if "SMA_20" in df_indicators else last_close,
                    "sma_50": round(df_indicators["SMA_50"].iloc[-1], 2) if "SMA_50" in df_indicators else last_close,
                    "last_close": last_close
                }
            }
        except Exception as e:
            raise RuntimeError(f"Error en Fase 1 Cuantitativa de {ticker_upper}: {str(e)}")

    def get_qualitative_adjustment(self, ticker: str, pred_base_usd: float, technical_signals: dict) -> dict:
        """FASE 2: Inferencia cognitiva (RAG + Ollama) aplicando ponderación estricta 60/40."""
        ticker_upper = ticker.upper()
        
        # Scrapear noticias al momento
        news_fetcher.fetch_and_ingest_news(ticker=ticker_upper, limit=5)
        
        query_context = f"financial state reports and growth metrics of {ticker_upper}"
        news_context = rag_service.query_market_context(ticker=ticker_upper, query_text=query_context, top_k=3)

        llm_verdict = llm_service.generate_investment_analysis(
            ticker=ticker_upper,
            pred_base=pred_base_usd,
            technical_signals=technical_signals,
            news_context=news_context
        )

        ajuste_porcentual = float(llm_verdict.get("ajuste_llm_porcentual", 0.0))
        confianza = float(llm_verdict.get("confianza_analisis", 0.5))
        justificacion = llm_verdict.get("justificacion", "Sin comentarios.")
        recomendacion = llm_verdict.get("recomendacion", "ESPERAR")

        precio_final_ajustado = (pred_base_usd * 0.60) + (pred_base_usd * (1.0 + (ajuste_porcentual * confianza)) * 0.40)

        return {
            "ajuste_llm_porcentual": round(ajuste_porcentual, 4),
            "precio_final_hibrido": round(precio_final_ajustado, 2),
            "confianza_analisis": round(confianza, 2),
            "recomendacion": recomendacion.upper(),
            "justificacion": justificacion,
            "noticias_evaluadas_count": len(news_context)
        }

analysis_orchestrator = AnalysisOrchestrator()