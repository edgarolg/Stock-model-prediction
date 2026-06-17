import os
import sys
import random
import pickle
import numpy as np
import pandas as pd
import tensorflow as tf
from dotenv import load_dotenv

# Forzar la carga del archivo .env buscando en la raíz del proyecto
load_dotenv(os.path.abspath(os.path.join(os.path.dirname(__file__), "../../.env")))

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))

from backend.services.market_data import get_stock_data
from backend.services.technical import calculate_all_indicators, get_latest_signals
from backend.services.rag import rag_service
from backend.services.llm import llm_service

# Importamos los scripts de finetuning para el Auto-Entrenamiento
from Scripts.finetune.prepare_dataset import prepare_and_save_data
from Scripts.finetune.train import train_lstm_model

class AnalysisOrchestrator:
    """
    Orquestador principal. Dividido en dos fases (Matemática e IA) 
    para soportar carga asíncrona en el frontend (React).
    """

    def __init__(self):
        self.models_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "../data/models"))
        self.lookback_days = 30 # Debe coincidir con prepare_dataset.py

    def get_quantitative_base(self, ticker: str) -> dict:
        """
        FASE 1: Rápida. Descarga datos, calcula indicadores e infiere con LSTM.
        Si el modelo no existe, activa el pipeline de auto-entrenamiento.
        """
        ticker_upper = ticker.upper()
        ticker_lower = ticker.lower()
        print(f"=== [FASE 1] Iniciando Análisis Cuantitativo para: {ticker_upper} ===")

        try:
            # 1. Obtener datos históricos recientes e indicadores
            df = get_stock_data(ticker_upper, period="2y") # Usamos 2y para asegurar suficientes datos limpios
            df = calculate_all_indicators(df)
            signals = get_latest_signals(df)
            
            if df.empty:
                raise ValueError(f"No se encontraron datos de mercado históricos para {ticker_upper}")

            last_close = round(float(df["Close"].iloc[-1]), 2)

            # Rutas de los artefactos del modelo
            model_path = os.path.join(self.models_dir, f"{ticker_lower}_lstm_model.keras")
            feature_scaler_path = os.path.join(self.models_dir, f"{ticker_lower}_feature_scaler.pkl")
            target_scaler_path = os.path.join(self.models_dir, f"{ticker_lower}_target_scaler.pkl")

            # 2. AUTO-ENTRENAMIENTO (Lazy Training)
            archivos_existen = os.path.exists(model_path) and os.path.exists(feature_scaler_path) and os.path.exists(target_scaler_path)
            
            if not archivos_existen:
                print(f"[!] Modelos no encontrados para {ticker_upper}. Iniciando auto-entrenamiento On-the-Fly...")
                # Llamamos a tus scripts. Puedes subir las épocas a 50, EarlyStopping lo detendrá si es necesario.
                prepare_and_save_data(ticker=ticker_upper, period="2y", lookback_days=self.lookback_days)
                train_lstm_model(ticker=ticker_upper, epochs=50, batch_size=16)
                print(f"[-] Auto-entrenamiento completado. Retomando inferencia...")

            # 3. LÓGICA DE INFERENCIA REAL
            print("[-] Cargando modelo y escaladores desde el disco...")
            with open(feature_scaler_path, "rb") as f:
                feature_scaler = pickle.load(f)
            with open(target_scaler_path, "rb") as f:
                target_scaler = pickle.load(f)

            model = tf.keras.models.load_model(model_path)

            # Preparar exactamente las mismas columnas usadas en prepare_dataset.py
            feature_cols = [
                "Open", "High", "Low", "Close", "Volume", 
                "SMA_20", "SMA_50", "SMA_200", 
                "RSI", "MACD", "MACD_Signal", "MACD_Histogram"
            ]
            
            df_features = df[feature_cols].copy()
            df_features = df_features.dropna() # Limpiar NaNs de las SMA

            if len(df_features) < self.lookback_days:
                raise ValueError(f"Historial insuficiente post-limpieza. Se requieren {self.lookback_days} días útiles.")

            # Extraer la última ventana de tiempo para predecir el "mañana"
            last_window = df_features.tail(self.lookback_days)
            scaled_input = feature_scaler.transform(last_window)
            
            # Reshape para Keras: (1 muestra, 30 timesteps, n_features)
            X_inference = np.array([scaled_input])
            
            # Predicción y Desnormalización (Usando el Target Scaler)
            scaled_pred = model.predict(X_inference, verbose=0)
            pred_base_lstm = float(target_scaler.inverse_transform(scaled_pred)[0][0])
            pred_base_lstm = round(pred_base_lstm, 2)
            
            print(f"[-] Predicción Matemática (LSTM) generada: ${pred_base_lstm}")

            # 4. Formatear la respuesta
            return {
                "status": "success",
                "ticker": ticker_upper,
                "last_close": last_close,
                "pred_base_lstm": pred_base_lstm,
                "technical_signals": {
                    "rsi": round(signals.get("rsi", 50.0), 2),
                    "macd": round(signals.get("macd", 0.0), 4),
                    "macd_signal": round(signals.get("macd_signal", 0.0), 4),
                    "macd_histogram": round(signals.get("macd_histogram", 0.0), 4),
                    "sma_20": round(df["SMA_20"].iloc[-1], 2) if "SMA_20" in df else last_close,
                    "sma_50": round(df["SMA_50"].iloc[-1], 2) if "SMA_50" in df else last_close,
                    "last_close": last_close
                }
            }

        except Exception as e:
            raise RuntimeError(f"Fallo interno en el cálculo cuantitativo de {ticker_upper}: {str(e)}")

    def get_qualitative_adjustment(self, ticker: str, pred_base_usd: float, technical_signals: dict) -> dict:
        """
        FASE 2: Lenta (IA). Utiliza RAG y Llama 3 para ajustar la predicción base.
        """
        ticker_upper = ticker.upper()
        print(f"=== [FASE 2] Iniciando Análisis IA (RAG + LLM) para: {ticker_upper} ===")

        # 1. Recuperación RAG
        query_context = f"trends financial status of {ticker_upper} RSI {technical_signals.get('rsi')}"
        news_context = rag_service.query_market_context(ticker=ticker_upper, query_text=query_context, top_k=3)

        # 2. Inferencia con LLM local
        llm_verdict = llm_service.generate_investment_analysis(
            ticker=ticker_upper,
            pred_base=pred_base_usd,
            technical_signals=technical_signals,
            news_context=news_context
        )

        ajuste_porcentual = float(llm_verdict.get("ajuste", 0.0))
        confianza = float(llm_verdict.get("confianza_final", 0.5))
        razon = llm_verdict.get("razon", "Sin justificación provista.")
        recomendacion = llm_verdict.get("recomendacion", "ESPERAR")

        # 3. Fusión final (60% Math / 40% IA)
        precio_final_ajustado = (pred_base_usd * 0.60) + (pred_base_usd * (1.0 + ajuste_porcentual) * 0.40)

        print(f"[-] Pred Base Recibida: ${pred_base_usd:.2f} | Ajuste IA: {ajuste_porcentual * 100:+.2f}%")
        print(f"=== Pipeline IA Finalizado ===")

        return {
            "ajuste_llm_porcentual": round(ajuste_porcentual, 4),
            "precio_final_hibrido": round(precio_final_ajustado, 2),
            "confianza_analisis": round(confianza, 2),
            "recomendacion": recomendacion.upper(),
            "justificacion": razon,
            "noticias_evaluadas_count": len(news_context)
        }

analysis_orchestrator = AnalysisOrchestrator()