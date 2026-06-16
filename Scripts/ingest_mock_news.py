import os
import sys

# Inyección de PATH
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from backend.services.rag import rag_service

def load_sample_data():
    print("=== Indexando noticias de prueba en ChromaDB ===")
    
    # Noticias simuladas de AAPL (Sentimiento Alcista/Bajista mixto)
    noticias_aapl = [
        "Apple Inc. reporta un incremento del 15% en las ventas de su nuevo dispositivo con Inteligencia Artificial integrada, superando las expectativas de Wall Street.",
        "Preocupación en la cadena de suministro asiática podría retrasar los envíos globales de iPad y Mac de Apple para el próximo trimestre según analistas.",
        "Los analistas de Goldman Sachs elevan el precio objetivo de AAPL debido a un crecimiento sólido en su división de servicios y suscripciones en la nube."
    ]
    
    for noticia in noticias_aapl:
        rag_service.add_news_to_corpus(ticker="AAPL", text_chunk=noticia, source_metadata="Reuters Mock")
        
    print("=== Ingesta completada con éxito ===")

if __name__ == "__main__":
    load_sample_data()