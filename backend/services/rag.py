import os
import chromadb
from chromadb.config import Settings
from typing import List

class RAGService:
    """
    Servicio de Recuperación Aumentada por Generación (RAG) nativo.
    Gestiona la base de datos vectorial ChromaDB en disco para almacenar
    y consultar noticias o reportes macroeconómicos de tickers.
    """

    def __init__(self):
        # Definir la ruta persistente para almacenar los vectores en disco
        self.db_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "../data/vector_store"))
        os.makedirs(self.db_path, exist_ok=True)
        
        # Inicializar el cliente nativo de ChromaDB persistente
        self.chroma_client = chromadb.PersistentClient(path=self.db_path)
        
        # Obtener o crear la colección única para las noticias de StockIntel
        # Usará el modelo de embeddings por defecto de Chroma (all-MiniLM-L6-v2) local, rápido y eficiente
        self.collection = self.chroma_client.get_or_create_collection(name="stock_news_corpus")

    def add_news_to_corpus(self, ticker: str, text_chunk: str, source_metadata: str = "Manual Ingest"):
        """
        Divide e indexa un fragmento de texto/noticia asociándolo a un ticker mediante metadatos.
        """
        if not text_chunk.strip():
            return
            
        # Generar un ID único simple basado en el tamaño actual de la colección o hash
        doc_id = f"news_{ticker.lower()}_{hash(text_chunk) % 10000000}"
        
        # Guardar en ChromaDB indexando por similitud y aplicando filtro por metadato (ticker)
        self.collection.add(
            documents=[text_chunk],
            metadatas=[{"ticker": ticker.upper(), "source": source_metadata}],
            ids=[doc_id]
        )
        print(f"[-] Documento indexado con éxito para [{ticker.upper()}] con ID: {doc_id}")

    def query_market_context(self, ticker: str, query_text: str = "market analysis and financial performance", top_k: int = 3) -> List[str]:
        """
        Busca por similitud de cosenos los fragmentos de noticias más relevantes
        que correspondan estrictamente al ticker consultado (Filtro Metadata).
        """
        try:
            results = self.collection.query(
                query_texts=[query_text],
                n_results=top_k,
                where={"ticker": ticker.upper()}  # Filtro estricto: solo extrae contexto de esta empresa
            )
            
            # Formatear la salida para retornar una lista limpia de strings
            documents = results.get("documents", [[]])
            if documents and len(documents) > 0:
                return documents[0]
            return []
            
        except Exception as e:
            print(f"[WARN] Error al consultar ChromaDB: {e}")
            return []

# Instancia única del servicio lista para ser importada (Singleton)
rag_service = RAGService()