import os
import chromadb
from chromadb.utils import embedding_functions
from typing import List

class RAGService:
    """
    Servicio de Recuperación Aumentada por Generación (RAG) nativo.
    Gestiona la base de datos vectorial ChromaDB utilizando nomic-embed-text.
    """

    def __init__(self):
        self.db_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "../data/vector_store"))
        os.makedirs(self.db_path, exist_ok=True)
        
        self.chroma_client = chromadb.PersistentClient(path=self.db_path)
        
        # Configuración explícita del pipeline de embeddings usando nomic-embed-text mediante Ollama
        self.nomic_embedding_function = embedding_functions.OllamaEmbeddingFunction(
            url=os.getenv("OLLAMA_BASE_URL", "http://localhost:11434"),
            model_name="nomic-embed-text"
        )
        
        self.collection = self.chroma_client.get_or_create_collection(
            name="stock_news_corpus",
            embedding_function=self.nomic_embedding_function
        )

    def add_news_to_corpus(self, ticker: str, text_chunk: str, source_metadata: str = "Manual Ingest"):
        """
        Divide e indexa un fragmento de texto/noticia asociándolo a un ticker mediante metadatos.
        """
        if not text_chunk.strip():
            return
            
        doc_id = f"news_{ticker.lower()}_{hash(text_chunk) % 10000000}"
        
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
                where={"ticker": ticker.upper()}
            )
            
            documents = results.get("documents", [[]])
            if documents and len(documents) > 0:
                return documents[0]
            return []
            
        except Exception as e:
            print(f"[WARN] Error al consultar ChromaDB: {e}")
            return []

rag_service = RAGService()