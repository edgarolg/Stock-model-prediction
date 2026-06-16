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
            "Eres un Analista Cuantitativo Senior de Riesgos en Wall Street especializado en modelado híbrido.\n"
            "Tu tarea es evaluar la predicción de precio base de un modelo matemático y modularla combinando "
            "indicadores técnicos y un contexto de noticias financieras recientes (RAG).\n\n"
            
            "REGLAS CRÍTICAS DE NEGOCIO:\n"
            "1. Debes estimar un 'ajuste' que refleje el impacto del sentimiento macro (noticias) e indicadores.\n"
            "2. El valor de 'ajuste' DEBE SER UN NÚMERO FLOTANTE ESTRICTO ENTRE -0.05 Y +0.05 (representando una desviación de entre -5% y +5%).\n"
            "3. No puedes salirte bajo ningún concepto de este rango [-0.05, 0.05].\n"
            "4. 'confianza_final' debe ser un flotante entre 0.0 y 1.0 que mida la solidez de las noticias y coherencia técnica.\n"
            "5. 'recomendacion' debe ser exactamente una de estas tres opciones en mayúsculas: 'INVERTIR', 'ESPERAR' o 'NO INVERTIR'.\n\n"
            
            "OBLIGACIÓN DE FORMATO:\n"
            "Debes responder ÚNICAMENTE con una estructura JSON válida que contenga exactamente estas llaves:\n"
            "{\n"
            "  \"ajuste\": float,\n"
            "  \"confianza_final\": float,\n"
            "  \"razon\": \"string breve detallando el porqué de tu ajuste basado en las noticias y técnico\",\n"
            "  \"recomendacion\": \"string\"\n"
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