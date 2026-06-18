import os
import json
import requests
from typing import List, Dict, Any

class LLMService:
    """
    Servicio encargado de la comunicación directa con Ollama para el análisis
    de sentimiento macroeconómico y la fusión cuantitativa de señales de inversión.
    """

    def __init__(self):
        self.ollama_url = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434/api/generate")
        self.model_name = os.getenv("OLLAMA_MODEL", "llama3")

    def generate_investment_analysis(
        self, 
        ticker: str, 
        pred_base: float, 
        technical_signals: Dict[str, Any], 
        news_context: List[str]
    ) -> Dict[str, Any]:
        """
        Envía la predicción matemática base, las señales técnicas y el contexto RAG de noticias
        a Llama 3 para obtener un ajuste porcentual del precio y la recomendación final estructurada.
        """
        formatted_news = "\n".join([f"- {news}" for news in news_context]) if news_context else "No hay noticias recientes disponibles en el corpus."

        system_prompt = (
            "Eres un Analista Cuantitativo Senior de Riesgos de Wall Street experto en trading algorítmico y modelos híbridos.\n"
            "Tu tarea consiste en recibir una predicción matemática de precio base (Fase 1), señales técnicas de mercado y un contexto extraído de noticias (RAG), "
            "para calcular una modulación cognitiva cualitativa.\n\n"
            
            "REGLAS CRÍTICAS DE OPERACIÓN:\n"
            "1. Determina un 'ajuste_llm_porcentual' que represente el impacto del sentimiento macro y noticias. Debe ser un número FLOTANTE ESTRICTO entre -0.05 y 0.05 (ej. 0.025 significa +2.5%, -0.012 significa -1.2%).\n"
            "2. Está estrictamente PROHIBIDO salirse del rango [-0.05, 0.05]. Si el mercado es neutral, asigna 0.0.\n"
            "3. Define 'confianza_analisis' como un flotante estricto entre 0.0 y 1.0 (ej. 0.85) según la calidad, vigencia del contexto RAG y confluencia técnica.\n"
            "4. Determina la 'recomendacion' basándote en la convergencia de señales. Debe ser EXACTAMENTE una de estas tres cadenas: 'INVERTIR', 'ESPERAR' o 'NO INVERTIR'.\n"
            "5. En 'justificacion', redacta una síntesis analítica y concisa (máximo 3 frases) vinculando las noticias macro con los indicadores técnicos.\n\n"
            
            "RESTRICCIÓN ABSOLUTA DE FORMATO:\n"
            "Responde EXCLUSIVAMENTE con el objeto JSON crudo. No agregues introducciones, explicaciones, ni bloques de código de marcado de tipo ```json```.\n\n"
            
            "EJEMPLO DE SALIDA CORRECTA:\n"
            "{\n"
            "  \"ajuste_llm_porcentual\": 0.025,\n"
            "  \"confianza_analisis\": 0.85,\n"
            "  \"justificacion\": \"El fuerte volumen comprador y el soporte clave en la SMA_50 se alinean con las noticias de crecimiento de ingresos reportadas en el RAG, justificando un ajuste alcista moderado.\",\n"
            "  \"recomendacion\": \"INVERTIR\"\n"
            "}"
        )

        user_prompt = (
            f"### CONTEXTO DE ANÁLISIS PARA: {ticker.upper()}\n"
            f"- Predicción Numérica Base del LSTM (Precio Cierre Mañana): ${pred_base:.2f}\n"
            f"- Estado Técnico Actual: {json.dumps(technical_signals)}\n\n"
            f"### CONTEXTO MACROECONÓMICO DE NOTICIAS (RAG):\n"
            f"{formatted_news}\n\n"
            f"Genera tu veredicto de ajuste financiero en formato JSON siguiendo las reglas estipuladas:"
        )

        payload = {
            "model": self.model_name,
            "prompt": user_prompt,
            "system": system_prompt,
            "format": "json",
            "stream": False
        }

        try:
            response = requests.post(self.ollama_url, json=payload, timeout=120)
            response.raise_for_status()
            
            raw_output = response.json().get("response", "{}")
            analysis_result = json.loads(raw_output)
            
            # Normalización y validación de llaves para evitar caídas en cascada
            ajuste = float(analysis_result.get("ajuste_llm_porcentual", 0.0))
            confianza = float(analysis_result.get("confianza_analisis", 0.5))
            
            return {
                "ajuste_llm_porcentual": max(-0.05, min(0.05, ajuste)),
                "confianza_analisis": max(0.0, min(1.0, confianza)),
                "justificacion": str(analysis_result.get("justificacion", "Análisis cualitativo completado.")),
                "recomendacion": str(analysis_result.get("recomendacion", "ESPERAR")).upper()
            }

        except Exception as e:
            return {
                "ajuste_llm_porcentual": 0.0,
                "confianza_analisis": 0.0,
                "justificacion": f"[FALLBACK] No se pudo procesar el ajuste cognitivo. Detalle: {str(e)}",
                "recomendacion": "ESPERAR"
            }

llm_service = LLMService()