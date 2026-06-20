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
        news_context: List[str],
        entry_price: float = None,
        risk_profile: str = "Moderate"
    ) -> Dict[str, Any]:
        """
        Envía la predicción matemática base, las señales técnicas, el contexto RAG de noticias
        y el estado actual del portafolio del usuario a Llama 3 para obtener un ajuste y recomendación.
        """
        formatted_news = "\n".join([f"- {news}" for news in news_context]) if news_context else "No hay noticias recientes disponibles en el corpus."

        # Lógica para determinar el contexto del portafolio que le pasaremos a la IA
        if entry_price:
            portfolio_status = f"El usuario YA POSEE esta acción en su portafolio. Precio de entrada (compra): ${entry_price:.2f}."
        else:
            portfolio_status = "El usuario NO POSEE esta acción actualmente. Está evaluando una posible primera compra."

        system_prompt = (
            "Eres un Analista Cuantitativo Senior de Riesgos de Wall Street experto en trading algorítmico y modelos híbridos.\n"
            "Tu tarea consiste en recibir una predicción matemática de precio base (Fase 1), señales técnicas, contexto de noticias (RAG), "
            "y la situación del portafolio del cliente para calcular una modulación cognitiva cualitativa.\n\n"
            
            "REGLAS CRÍTICAS DE OPERACIÓN:\n"
            "1. Determina un 'ajuste_llm_porcentual' que represente el impacto del sentimiento macro y noticias. Debe ser un número FLOTANTE ESTRICTO entre -0.05 y 0.05.\n"
            "2. Está estrictamente PROHIBIDO salirse del rango [-0.05, 0.05]. Si el mercado es neutral, asigna 0.0.\n"
            "3. Define 'confianza_analisis' como un flotante estricto entre 0.0 y 1.0 (ej. 0.85) según la calidad y confluencia técnica.\n"
            "4. Determina la 'recomendacion' ('INVERTIR', 'ESPERAR' o 'NO INVERTIR') basándote en la convergencia de señales Y EN EL CONTEXTO DEL PORTAFOLIO. "
            "Si el usuario ya posee la acción, 'ESPERAR' significa mantener la posición (Hold), 'NO INVERTIR' significa no comprar más (o vender si hay riesgo extremo).\n"
            "5. En 'justificacion', redacta una síntesis analítica (máximo 3 frases) vinculando las noticias, lo técnico, su perfil de riesgo y si la acción ya es rentable respecto a su precio de entrada.\n\n"
            
            "RESTRICCIÓN ABSOLUTA DE FORMATO:\n"
            "Responde EXCLUSIVAMENTE con el objeto JSON crudo. No agregues introducciones, explicaciones, ni bloques de código de marcado de tipo ```json```.\n\n"
            
            "EJEMPLO DE SALIDA CORRECTA:\n"
            "{\n"
            "  \"ajuste_llm_porcentual\": 0.025,\n"
            "  \"confianza_analisis\": 0.85,\n"
            "  \"justificacion\": \"La acción supera ampliamente su precio de entrada. Dado su perfil agresivo, el soporte en SMA_50 y las noticias positivas de ingresos justifican mantener e incluso ampliar la posición.\",\n"
            "  \"recomendacion\": \"INVERTIR\"\n"
            "}"
        )

        user_prompt = (
            f"### CONTEXTO DEL PORTAFOLIO DEL CLIENTE\n"
            f"- Situación: {portfolio_status}\n"
            f"- Perfil de Riesgo del Inversor: {risk_profile.upper()}\n\n"
            
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
                "justificacion": str(analysis_result.get("justificacion", "Qualitative analysis completed successfully.")),
                "recomendacion": str(analysis_result.get("recomendacion", "HOLD")).upper() # <-- CAMBIADO A HOLD
            }

        except Exception as e:
            return {
                "ajuste_llm_porcentual": 0.0,
                "confianza_analisis": 0.0,
                "justificacion": f"LLM Error: {str(e)}",
                "recomendacion": "HOLD"
            }

llm_service = LLMService()