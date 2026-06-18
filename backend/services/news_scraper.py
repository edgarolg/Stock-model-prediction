import requests
import xml.etree.ElementTree as ET
from backend.services.rag import rag_service

class NewsFetcherService:
    """
    Servicio encargado de scrapear noticias financieras mediante el Feed RSS oficial de Yahoo Finance.
    Es a prueba de bloqueos e inyecta el texto directamente en ChromaDB.
    """

    @staticmethod
    def fetch_and_ingest_news(ticker: str, limit: int = 5) -> int:
        ticker_upper = ticker.upper()
        print(f"[-] Descargando contexto macroeconómico (RSS) para {ticker_upper}...")
        
        try:
            # URL oficial del feed RSS de Yahoo Finance
            rss_url = f"https://feeds.finance.yahoo.com/rss/2.0/headline?s={ticker_upper}&region=US&lang=en-US"
            
            # Hacemos la petición engañando al servidor para que crea que somos un navegador web
            headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'}
            response = requests.get(rss_url, headers=headers, timeout=15)
            response.raise_for_status()
            
            # Parsear el XML (RSS) nativamente con Python
            root = ET.fromstring(response.text)
            items = root.findall('.//item')
            
            if not items:
                print(f"[!] No se encontraron noticias RSS para {ticker_upper}.")
                return 0

            ingested_count = 0
            for item in items[:limit]:
                # Extraer título y descripción
                title = item.find('title').text if item.find('title') is not None else ""
                description = item.find('description').text if item.find('description') is not None else ""
                
                # Crear el bloque semántico
                text_chunk = f"Titular: {title}. Resumen: {description}".strip()
                
                if len(text_chunk) > 15:
                    source_meta = "Yahoo Finance RSS"
                    
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
            print(f"[ERROR] Fallo crítico al extraer noticias RSS para {ticker_upper}: {str(e)}")
            return 0

news_fetcher = NewsFetcherService()