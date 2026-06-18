import yfinance as yf
from datetime import datetime
from backend.services.rag import rag_service

class NewsFetcherService:
    """
    Servicio encargado de scrapear noticias financieras reales de Yahoo Finance
    e inyectarlas directamente en el pipeline de la base de datos vectorial (ChromaDB).
    """

    @staticmethod
    def fetch_and_ingest_news(ticker: str, limit: int = 5) -> int:
        """
        Descarga las últimas noticias del ticker e indexa los fragmentos en el RAG.
        Retorna la cantidad de noticias inyectadas exitosamente.
        """
        ticker_upper = ticker.upper()
        print(f"[-] Descargando contexto macroeconómico (Noticias) para {ticker_upper}...")
        
        try:
            stock = yf.Ticker(ticker_upper)
            news_items = stock.news
            
            if not news_items:
                print(f"[!] No se encontraron noticias recientes en Yahoo Finance para {ticker_upper}.")
                return 0

            ingested_count = 0
            for item in news_items[:limit]:
                # Extraer datos relevantes del payload de Yahoo Finance
                title = item.get("title", "")
                # Algunas noticias traen resumen, otras no.
                summary = item.get("summary", "") 
                publisher = item.get("publisher", "Yahoo Finance")
                
                # Crear el bloque semántico para el LLM
                text_chunk = f"Titular: {title}. Resumen: {summary}".strip()
                
                if len(text_chunk) > 15:  # Evitar inyectar fragmentos vacíos o muy cortos
                    source_meta = f"{publisher} - Ingesta Automática"
                    
                    # Inyectar al Vector Store nativo de StockIntel
                    rag_service.add_news_to_corpus(
                        ticker=ticker_upper,
                        text_chunk=text_chunk,
                        source_metadata=source_meta
                    )
                    ingested_count += 1
                    
            print(f"[-] {ingested_count} noticias indexadas en ChromaDB para {ticker_upper}.")
            return ingested_count
            
        except Exception as e:
            print(f"[ERROR] Fallo crítico al extraer noticias para {ticker_upper}: {str(e)}")
            return 0

news_fetcher = NewsFetcherService()