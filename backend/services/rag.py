import os
import requests
import chromadb
from chromadb import Documents, EmbeddingFunction, Embeddings
from typing import List

class BulletproofOllamaEmbedding(EmbeddingFunction):
    """
    Conector de embeddings personalizado a prueba de fallos.
    Evita los bugs internos de la librería chromadb al hacer la petición HTTP directa.
    """
    def __call__(self, input: Documents) -> Embeddings:
        embeddings = []
        for text in input:
            response = requests.post(
                "http://localhost:11434/api/embeddings",
                json={"model": "nomic-embed-text", "prompt": text},
                timeout=120
            )
            response.raise_for_status()
            embeddings.append(response.json()["embedding"])
        return embeddings


class RAGService:
    """
    Servicio de Recuperación Aumentada por Generación (RAG) nativo.
    Gestiona la base de datos vectorial ChromaDB utilizando nomic-embed-text.
    """

    def __init__(self):
        self.db_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "../data/vector_store"))
        os.makedirs(self.db_path, exist_ok=True)
        
        self.chroma_client = chromadb.PersistentClient(path=self.db_path)
        
        # Le cambiamos el nombre a stock_news_corpus_v3 para que inicie una tabla totalmente limpia
        self.collection = self.chroma_client.get_or_create_collection(
            name="stock_news_corpus_v3",
            embedding_function=BulletproofOllamaEmbedding()
        )

    def add_news_to_corpus(self, ticker: str, text_chunk: str, source_metadata: str = "Manual Ingest"):
        """Divide e indexa un fragmento de texto/noticia."""
        if not text_chunk.strip():
            return
            
        doc_id = f"news_{ticker.lower()}_{hash(text_chunk) % 10000000}"
        
        self.collection.add(
            documents=[text_chunk],
            metadatas=[{"ticker": ticker.upper(), "source": source_metadata}],
            ids=[doc_id]
        )
        print(f"[-] Documento vectorizado e indexado con éxito para [{ticker.upper()}]")

    def query_market_context(self, ticker: str, query_text: str = "market analysis and financial performance", top_k: int = 3) -> List[str]:
        """Busca por similitud matemática las noticias más relevantes."""
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