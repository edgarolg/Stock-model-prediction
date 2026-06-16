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
    Orquestador principal encargado de unificar la predicción cuantitativa (LSTM)
    con el análisis cualitativo y de contexto macroeconómico (RAG + Ollama LLM).
    """

    def __init__(self):
        self.models_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "../data/models"))

    def execute_hybrid_analysis(self, ticker: str, lookback_days: int = 30) -> dict:
        """
        Ejecuta el flujo completo de inferencia híbrida para un ticker.
        Garantiza validaciones robustas frente a dataframes vacíos por Rate Limit.
        """
        ticker_upper = ticker.upper()
        print(f"=== Iniciando Pipeline Híbrido en Vivo para: {ticker_upper} ===")

        # 1. Cargar el Modelo LSTM y Escaladores desde disco
        model_path = os.path.join(self.models_dir, f"{ticker_upper.lower()}_lstm_model.keras")
        feat_scaler_path = os.path.join(self.models_dir, f"{ticker_upper.lower()}_feature_scaler.pkl")
        target_scaler_path = os.path.join(self.models_dir, f"{ticker_upper.lower()}_target_scaler.pkl")

        if not os.path.exists(model_path):
            raise FileNotFoundError(f"El modelo LSTM para {ticker_upper} no ha sido entrenado o no se encuentra en {self.models_dir}")

        model = tf.keras.models.load_model(model_path)
        with open(feat_scaler_path, "rb") as f:
            feature_scaler = pickle.load(f)
        with open(target_scaler_path, "rb") as f:
            target_scaler = pickle.load(f)

        # 2. Descargar datos actuales y validar integridad antes del cálculo
        df_raw = get_stock_data(ticker_upper, period="2y ")
        
        if df_raw is None or df_raw.empty:
            raise ValueError(f"Alpha Vantage no retornó datos para {ticker_upper}. Es muy probable que hayas alcanzado el límite de 25 peticiones por día de tu API Key gratuita o el Ticker sea inválido.")
        
        
        filas_crudas = len(df_raw)

        # Calcular indicadores técnicos
        df_features = calculate_all_indicators(df_raw)
        filas_con_indicadores = len(df_features)
        
        # Filtrar valores nulos (aquí es donde se eliminan las primeras 200 filas por la SMA_200)
        df_features_clean = df_features.dropna()
        filas_finales = len(df_features_clean)

        # Si se vacía, arrojamos un error con el diagnóstico exacto incrustado en el JSON de FastAPI
        if df_features_clean.empty:
            raise ValueError(
                f"El DataFrame histórico se vació tras calcular indicadores técnicos. "
                f"[DIAGNÓSTICO] Filas Crudas recibidas: {filas_crudas} | "
                f"Filas con Indicadores: {filas_con_indicadores} | Filas finales tras dropna: {filas_finales}. "
                f"Esto ocurre porque la SMA_200 requiere al menos 200 filas históricas de mercado para calcularse y el proveedor entregó menos."
            )


        # Capturar el último precio real con seguridad posicional
        last_real_close = float(df_features["Close"].iloc[-1])

        # Extraer las señales técnicas formateadas para el LLM
        technical_signals = get_latest_signals(df_features)

        # 3. Preparar Ventana Temporal (Lookback) para el LSTM
        feature_cols = [
            "Open", "High", "Low", "Close", "Volume", 
            "SMA_20", "SMA_50", "SMA_200", 
            "RSI", "MACD", "MACD_Signal", "MACD_Histogram"
        ]
        
        df_window = df_features[feature_cols].tail(lookback_days)
        
        if len(df_window) < lookback_days:
            raise ValueError(f"Historial insuficiente para la inferencia. Se requieren {lookback_days} días hábiles de mercado y solo se obtuvieron {len(df_window)} filas válidas.")

        # Normalizar la ventana usando el escalador cargado
        scaled_window = feature_scaler.transform(df_window)
        # Redimensionar al formato tridimensional que exige el LSTM: (1, 30, 12)
        lstm_input = np.expand_dims(scaled_window, axis=0)

        # 4. Inferencia Cuantitativa (Predicción Matemática)
        scaled_prediction = model.predict(lstm_input, verbose=0)
        pred_base_usd = float(target_scaler.inverse_transform(scaled_prediction)[0][0])

        # 5. Recuperación RAG (Contexto de Noticias Financieras Indexadas)
        query_context = f"trends financial status of {ticker_upper} RSI {technical_signals.get('rsi_signal')}"
        news_context = rag_service.query_market_context(ticker=ticker_upper, query_text=query_context, top_k=3)

        # 6. Razonamiento y Ajuste por el LLM (Llama 3.2 local via Ollama)
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

        # 7. Ejecución de la Fórmula de Fusión Cuantitativa (60% Matemático / 40% Sentimiento)
        precio_final_ajustado = (pred_base_usd * 0.60) + (pred_base_usd * (1.0 + ajuste_porcentual) * 0.40)

        print(f"[-] Predicción Cuantitativa Base: ${pred_base_usd:.2f}")
        print(f"[-] Ajuste Sugerido por LLM: {ajuste_porcentual * 100:+.2f}%")
        print(f"[-] Precio Híbrido Final: ${precio_final_ajustado:.2f}")
        print(f"=== Pipeline Finalizado con Éxito ===")
        
        return {
            "ticker": ticker_upper,
            "last_real_close": round(last_real_close, 2),
            "pred_base_lstm": round(pred_base_usd, 2),
            "ajuste_llm_porcentual": round(ajuste_porcentual, 4),
            "precio_final_hibrido": round(precio_final_ajustado, 2),
            "confianza_analisis": round(confianza, 2),
            "recomendacion": recomendacion.upper(),
            "justificacion": razon,
            "noticias_evaluadas_count": len(news_context)
        }


analysis_orchestrator = AnalysisOrchestrator()