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
        # Configuraciones leídas del entorno con fallbacks seguros de desarrollo
        self.ollama_url = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434/api/generate")
        self.model_name = os.getenv("OLLAMA_MODEL", "llama3.2") # Se recomienda Llama 3.1 o 3.2 (8B o 3B)

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
        
        # Unificar el contexto de noticias recuperado por el RAG
        formatted_news = "\n".join([f"- {news}" for news in news_context]) if news_context else "No hay noticias recientes disponibles en el corpus."

        # System Prompt: Configura el rol, las restricciones matemáticas y la estructura de salida obligatoria
        system_prompt = (
            "Eres un Analista Cuantitativo Senior de Riesgos de Wall Street experto en trading algorítmico y modelos híbridos.\n"
            "Tu tarea consiste en recibir una predicción matemática de precio base (Fase 1), señales técnicas de mercado y un contexto extraído de noticias (RAG), "
            "para calcular una modulación cognitiva cualitativa.\n\n"
            
            "REGLAS CRÍTICAS DE OPERACIÓN:\n"
            "1. Determina un 'ajuste_llm_porcentual' que represente el impacto del sentimiento macro y noticias. Debe ser un número FLOTANTE ESTRICTO entre -5.0 y 5.0 (ej. 2.5 significa +2.5%, -1.2 significa -1.2%).\n"
            "2. Está estrictamente PROHIBIDO salirse del rango [-5.0, 5.0]. Si el mercado es neutral, asigna 0.0.\n"
            "3. Define 'confianza_analisis' como un flotante estricto entre 0.0 y 1.0 (ej. 0.85) según la calidad, vigencia del contexto RAG y confluencia técnica.\n"
            "4. Determina la 'recomendacion' basándote en la convergencia de señales. Debe ser EXACTAMENTE una de estas tres cadenas: 'INVERTIR', 'ESPERAR' o 'NO INVERTIR'.\n"
            "5. En 'justificacion', redacta una síntesis analítica y concisa (máximo 3 frases) vinculando las noticias macro con los indicadores técnicos.\n\n"
            
            "RESTRICCIÓN ABSOLUTA DE FORMATO:\n"
            "Responde EXCLUSIVAMENTE con el objeto JSON crudo. No agregues introducciones, explicaciones, ni bloques de código de marcado de tipo ```json ```.\n\n"
            
            "EJEMPLO DE SALIDA CORRECTA:\n"
            "{\n"
            "  \"ajuste_llm_porcentual\": 2.5,\n"
            "  \"confianza_analisis\": 0.85,\n"
            "  \"justificacion\": \"El fuerte volumen comprador y el soporte clave en la SMA_50 se alinean con las noticias de crecimiento de ingresos reportadas en el RAG, justificando un ajuste alcista moderado.\",\n"
            "  \"recomendacion\": \"INVERTIR\"\n"
            "}"
        )

        # User Prompt: Inyección dinámica de las variables calculadas en tiempo de ejecución
        user_prompt = (
            f"### CONTEXTO DE ANÁLISIS PARA: {ticker.upper()}\n"
            f"- Predicción Numérica Base del LSTM (Precio Cierre Mañana): ${pred_base:.2f}\n"
            f"- Estado Técnico Actual: {json.dumps(technical_signals)}\n\n"
            f"### CONTEXTO MACROECONÓMICO DE NOTICIAS (RAG):\n"
            f"{formatted_news}\n\n"
            f"Genera tu veredicto de ajuste financiero en formato JSON siguiendo las reglas estipuladas:"
        )

        # Payload estructurado nativo de Ollama utilizando 'system' y forzando format='json'
        payload = {
            "model": self.model_name,
            "prompt": user_prompt,
            "system": system_prompt,
            "format": "json", # Fuerza al decoding a rechazar respuestas que no sean JSON válido
            "stream": False   # Desactiva el streaming para obtener la respuesta completa de un golpe
        }

        try:
            response = requests.post(self.ollama_url, json=payload, timeout=120)
            response.raise_for_status()
            
            # Obtener el campo 'response' de Ollama que contiene el string de nuestro JSON
            response_json = response.json()
            raw_output = response_json.get("response", "{}")
            
            # Parsear el string devuelto a un diccionario real de Python
            analysis_result = json.loads(raw_output)
            
            # Validación e Inyección de Seguridad en el Backend para garantizar las reglas
            analysis_result["ajuste"] = max(-0.05, min(0.05, float(analysis_result.get("ajuste", 0.0))))
            analysis_result["confianza_final"] = max(0.0, min(1.0, float(analysis_result.get("confianza_final", 0.5))))
            
            recomendacion_valida = analysis_result.get("recomendacion", "ESPERAR").upper()
            if recomendacion_valida not in ["INVERTIR", "ESPERAR", "NO INVERTIR"]:
                recomendacion_valida = "ESPERAR"
            analysis_result["recomendacion"] = recomendacion_valida

            return analysis_result

        except json.JSONDecodeError:
            # Fallback seguro en caso de que ocurra una anomalía de formateo extraña
            return {
                "ajuste": 0.0,
                "confianza_final": 0.5,
                "razon": "[FALLBACK] Error de formateo en la respuesta del modelo de lenguaje local.",
                "recomendacion": "ESPERAR"
            }
        except Exception as e:
            # Fallback seguro por si Ollama está apagado o hay timeouts de red
            return {
                "ajuste": 0.0,
                "confianza_final": 0.0,
                "razon": f"[FALLBACK] No se pudo conectar con el motor local de Ollama. Detalle: {str(e)}",
                "recomendacion": "ESPERAR"
            }


# Instancia única del servicio lista para ser importada (Singleton Pattern)
llm_service = LLMService()