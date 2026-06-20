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
        formatted_news = "\n".join([f"- {news}" for news in news_context]) if news_context else "No recent news available in the corpus."

        # Lógica para determinar el contexto del portafolio que le pasaremos a la IA
        if entry_price:
            portfolio_status = f"The user ALREADY OWNS this stock in their portfolio. Entry price (purchase): ${entry_price:.2f}."
        else:
            portfolio_status = "The user DOES NOT CURRENTLY OWN this stock. They are evaluating a possible first-time purchase."

        system_prompt = (
            "You are a Senior Quantitative Risk Analyst on Wall Street, an expert in algorithmic trading and hybrid models.\n"
            "Your task is to receive a base mathematical price prediction (Phase 1), technical signals, news context (RAG), "
            "and the client's portfolio situation to calculate a qualitative cognitive modulation.\n\n"
            
            "CRITICAL OPERATING RULES:\n"
            "1. Determine an 'ajuste_llm_porcentual' representing the impact of macro sentiment and news. It must be a STRICT FLOATING point number between -0.05 and 0.05.\n"
            "2. It is strictly FORBIDDEN to go outside the [-0.05, 0.05] range. If the market is neutral, assign 0.0.\n"
            "3. Define 'confianza_analisis' as a strict float between 0.0 and 1.0 (e.g., 0.85) based on technical quality and confluence.\n"
            "4. Determine the 'recomendacion' ('BUY', 'HOLD', or 'SELL') based on the convergence of signals AND THE PORTFOLIO CONTEXT. "
            "If the user already owns the stock, 'HOLD' means maintaining the position, 'SELL' means do not buy more (or sell if there is extreme risk).\n"
            "5. In 'justificacion', write an analytical synthesis (maximum 3 sentences) linking the news, technical data, their risk profile, and whether the stock is already profitable relative to its entry price. MUST BE WRITTEN IN ENGLISH.\n\n"
            
            "ABSOLUTE FORMAT RESTRICTION:\n"
            "Respond EXCLUSIVELY with the raw JSON object. Do not add introductions, explanations, or markdown code blocks like ```json```.\n\n"
            
            "EXAMPLE OF CORRECT OUTPUT:\n"
            "{\n"
            "  \"ajuste_llm_porcentual\": 0.025,\n"
            "  \"confianza_analisis\": 0.85,\n"
            "  \"justificacion\": \"The stock significantly exceeds its entry price. Given their aggressive profile, support at SMA_50 and positive revenue news justify holding and even expanding the position.\",\n"
            "  \"recomendacion\": \"BUY\"\n"
            "}"
        )

        user_prompt = (
            f"### CLIENT PORTFOLIO CONTEXT\n"
            f"- Situation: {portfolio_status}\n"
            f"- Investor Risk Profile: {risk_profile.upper()}\n\n"
            
            f"### ANALYSIS CONTEXT FOR: {ticker.upper()}\n"
            f"- LSTM Base Numerical Prediction (Tomorrow's Closing Price): ${pred_base:.2f}\n"
            f"- Current Technical Status: {json.dumps(technical_signals)}\n\n"
            
            f"### MACROECONOMIC NEWS CONTEXT (RAG):\n"
            f"{formatted_news}\n\n"
            
            f"Generate your financial adjustment verdict in JSON format following the stipulated rules:"
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