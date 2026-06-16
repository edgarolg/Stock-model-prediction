import os
import sys
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

class AnalysisOrchestrator:
    """
    Orquestador principal. Dividido en dos fases (Matemática e IA) 
    para soportar carga asíncrona en el frontend (React).
    """

    def __init__(self):
        self.models_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "../data/models"))

    def get_quantitative_base(self, ticker: str, lookback_days: int = 30) -> dict:
        """
        FASE 1: Rápida. Descarga datos, calcula indicadores e infiere con LSTM.
        Ideal para mostrar datos de inmediato en el dashboard de React.
        """
        ticker_upper = ticker.upper()
        print(f"=== [FASE 1] Iniciando Análisis Cuantitativo para: {ticker_upper} ===")

        # 1. Cargar el Modelo LSTM y Escaladores
        model_path = os.path.join(self.models_dir, f"{ticker_upper.lower()}_lstm_model.keras")
        feat_scaler_path = os.path.join(self.models_dir, f"{ticker_upper.lower()}_feature_scaler.pkl")
        target_scaler_path = os.path.join(self.models_dir, f"{ticker_upper.lower()}_target_scaler.pkl")

        if not os.path.exists(model_path):
            raise FileNotFoundError(f"El modelo LSTM para {ticker_upper} no se encuentra.")

        model = tf.keras.models.load_model(model_path)
        with open(feat_scaler_path, "rb") as f:
            feature_scaler = pickle.load(f)
        with open(target_scaler_path, "rb") as f:
            target_scaler = pickle.load(f)

        # 2. Descargar y procesar datos
        df_raw = get_stock_data(ticker_upper, period="2y")
        
        if df_raw is None or df_raw.empty:
            raise ValueError(f"Sin datos para {ticker_upper}.")
        
        # Calcular indicadores técnicos
        df_features = calculate_all_indicators(df_raw)
        df_features_clean = df_features.dropna()

        if df_features_clean.empty:
            raise ValueError("El DataFrame histórico se vació tras calcular indicadores (Faltan datos de SMA_200).")

        last_real_close = float(df_features["Close"].iloc[-1])
        technical_signals = get_latest_signals(df_features)

        # 3. Preparar Ventana y Predecir
        feature_cols = [
            "Open", "High", "Low", "Close", "Volume", 
            "SMA_20", "SMA_50", "SMA_200", 
            "RSI", "MACD", "MACD_Signal", "MACD_Histogram"
        ]
        
        df_window = df_features[feature_cols].tail(lookback_days)
        if len(df_window) < lookback_days:
            raise ValueError("Historial insuficiente para la inferencia.")

        scaled_window = feature_scaler.transform(df_window)
        lstm_input = np.expand_dims(scaled_window, axis=0)

        scaled_prediction = model.predict(lstm_input, verbose=0)
        pred_base_usd = float(target_scaler.inverse_transform(scaled_prediction)[0][0])

        return {
            "ticker": ticker_upper,
            "last_real_close": round(last_real_close, 2),
            "pred_base_lstm": round(pred_base_usd, 2),
            "technical_signals": technical_signals # Necesario para la Fase 2
        }

    def get_qualitative_adjustment(self, ticker: str, pred_base_usd: float, technical_signals: dict) -> dict:
        """
        FASE 2: Lenta (IA). Utiliza RAG y Llama 3 para ajustar la predicción base.
        Se ejecuta en segundo plano mientras el frontend muestra los datos de Fase 1.
        """
        ticker_upper = ticker.upper()
        print(f"=== [FASE 2] Iniciando Análisis IA (RAG + LLM) para: {ticker_upper} ===")

        # 1. Recuperación RAG
        query_context = f"trends financial status of {ticker_upper} RSI {technical_signals.get('rsi_signal')}"
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

        # 3. Fusión final
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