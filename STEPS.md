# StockIntel — Roadmap de Desarrollo

> Estado actual: Step 2 completado ✅
> Stack: FastAPI + Ollama (Llama 3) + ChromaDB + React + Vite

---

## ✅ Step 1 — Scaffolding y entorno
**Estado: COMPLETADO**

Qué se hizo:
- Estructura de carpetas del proyecto
- Archivos de configuración (.env.example, .gitignore, requirements.txt)
- Scripts de setup automático (setup.sh, setup_ollama.sh)
- FastAPI base con CORS configurado
- Primer commit y push a GitHub

---

## ✅ Step 2 — Datos de mercado e indicadores técnicos
**Estado: COMPLETADO**

Qué se hizo:
- `backend/services/market_data.py` — descarga datos OHLCV con yfinance
- `backend/services/technical.py` — RSI, MACD, SMA con pandas
- `backend/routers/stocks.py` — endpoints REST expuestos en FastAPI

Endpoints disponibles:
- GET /stocks/{ticker}/info
- GET /stocks/{ticker}/history
- GET /stocks/{ticker}/indicators

---

## 🔄 Step 3 — Conexión con Ollama (LLM local)
**Estado: PENDIENTE**
**Archivos a crear:**
- `backend/services/llm.py`

### Qué vas a construir
Un wrapper que conecta tu FastAPI con Ollama para enviarle prompts
y recibir respuestas de Llama 3 de forma local, sin ninguna API externa.

### Qué aprenderás
- Cómo funciona la API HTTP de Ollama (corre en localhost:11434)
- Qué es un "prompt estructurado" y cómo pedirle a un LLM que responda en JSON
- Cómo manejar streaming vs respuesta completa
- Por qué usamos temperatura baja (0.1-0.3) para análisis financiero

### Qué esperar al terminar
- Un servicio `llm.py` con una función `ask_llama(prompt)` que regresa texto
- Una función `analyze_stock_with_llm(ticker, indicators)` que construye
  un prompt financiero y regresa un JSON con análisis
- Un endpoint nuevo: POST /llm/analyze que acepta un ticker y regresa
  la opinión de Llama 3 sobre ese stock

### Prueba de que funciona
```
POST /llm/analyze
Body: { "ticker": "AAPL" }

Respuesta esperada:
{
  "ticker": "AAPL",
  "analisis": "Apple muestra señales...",
  "sentimiento": "POSITIVO",
  "confianza": 0.72
}
```

---

## 🔄 Step 4 — Pipeline RAG con ChromaDB
**Estado: PENDIENTE**
**Archivos a crear:**
- `backend/services/rag.py`
- `scripts/build_rag_index.py`
- `backend/data/corpus/` — documentos .txt que alimentan el RAG

### Qué vas a construir
Un sistema RAG (Retrieval-Augmented Generation) que:
1. Toma documentos de texto (noticias, reportes, análisis)
2. Los convierte en vectores usando nomic-embed-text (modelo local de Ollama)
3. Los guarda en ChromaDB (base de datos vectorial local)
4. Cuando preguntas por un stock, busca los N documentos más relevantes
5. Esos documentos se inyectan al prompt de Llama 3 como contexto

### Qué aprenderás
- Qué es un embedding y por qué los textos similares tienen vectores cercanos
- Cómo funciona la búsqueda por similitud coseno
- Qué es un vector store y cómo ChromaDB lo implementa
- Cómo se construye un prompt RAG: [contexto recuperado] + [pregunta del usuario]
- La diferencia entre RAG y fine-tuning (RAG actualiza el conocimiento sin reentrenar)

### Qué esperar al terminar
- Script `build_rag_index.py` que indexa todos los .txt del corpus
- Servicio `rag.py` con función `retrieve_context(query, top_k=3)`
  que regresa los fragmentos de texto más relevantes
- ChromaDB corriendo localmente en `backend/data/vector_store/`
- Llama 3 ahora responde con contexto real de tus documentos

### Prueba de que funciona
```
# Primero corres el indexador:
python scripts/build_rag_index.py

# Luego el endpoint usa el contexto automáticamente:
GET /stocks/AAPL/indicators
→ La respuesta de Llama 3 ahora incluye info de tus documentos
```

---

## 🔄 Step 5 — Router de análisis completo (orquestador)
**Estado: PENDIENTE**
**Archivos a crear:**
- `backend/routers/analysis.py`
- `backend/models/schemas.py` — modelos Pydantic para validación

### Qué vas a construir
El cerebro del sistema: un endpoint que orquesta todo el pipeline completo.

Flujo interno:
```
GET /analysis/{ticker}
        ↓
1. Descarga datos (market_data.py)
2. Calcula indicadores técnicos (technical.py)
3. Recupera contexto del RAG (rag.py)
4. Construye prompt con indicadores + contexto RAG
5. Llama 3 genera análisis en JSON (llm.py)
6. Se aplica la fórmula híbrida: 60% señal matemática + 40% LLM
7. Decisión final: INVERTIR / ESPERAR / NO INVERTIR
        ↓
Respuesta JSON completa
```

### Qué aprenderás
- Cómo orquestar múltiples servicios en un solo endpoint
- Qué son los modelos Pydantic y por qué validan los datos de entrada/salida
- Cómo implementar la fórmula híbrida: `final = pred_base + (ajuste × confianza_llm)`
- Cómo aplicar perfiles de riesgo (conservador / moderado / agresivo)
  para cambiar los umbrales de decisión

### Qué esperar al terminar
El endpoint principal de StockIntel:
```
GET /analysis/AAPL?risk_profile=moderado

Respuesta:
{
  "ticker": "AAPL",
  "precio_actual": 189.45,
  "decision": "INVERTIR",
  "confianza_final": 0.74,
  "señal_matematica": 0.68,
  "ajuste_llm": 0.12,
  "rsi": 45.2,
  "rsi_señal": "NEUTRAL",
  "macd_trend": "ALCISTA",
  "razon": "RSI en zona neutral con MACD cruzando al alza...",
  "recomendacion": "Entrada gradual recomendada",
  "perfil_riesgo": "moderado"
}
```

---

## 🔄 Step 6 — Frontend React (Bloomberg terminal)
**Estado: PENDIENTE**
**Archivos a crear:**
- `frontend/` — proyecto Vite + React completo
- `frontend/src/api/client.js` — cliente HTTP hacia el backend
- `frontend/src/components/` — componentes de UI

### Qué vas a construir
La interfaz visual de StockIntel con estética de terminal Bloomberg:
- Fondo negro, texto verde/cyan, fuente monospace (IBM Plex Mono)
- Dashboard principal con búsqueda de ticker
- Gráfica de precio histórico con SMA superpuestas (Recharts)
- Indicadores RSI y MACD en gráficas separadas
- Panel de análisis IA con la decisión final y razonamiento
- Indicador visual: 🟢 INVERTIR / 🟡 ESPERAR / 🔴 NO INVERTIR

### Qué aprenderás
- Cómo conectar React con una API FastAPI (fetch / axios)
- Cómo usar Recharts para gráficas financieras
- Cómo estructurar componentes en una app de datos en tiempo real
- Cómo manejar estados de carga y errores en la UI

### Tecnologías
- React 18 + Vite (ya tienes la carpeta frontend/ lista)
- Recharts — gráficas
- IBM Plex Mono — tipografía terminal
- Tailwind CSS (opcional) o CSS puro

### Qué esperar al terminar
Una app web funcional en http://localhost:5173 donde:
1. Escribes un ticker (ej. TSLA)
2. Ves la gráfica de precios con indicadores
3. Presionas "Analizar" y aparece la decisión de la IA
4. Todo con estética Bloomberg terminal

---

## 🔄 Step 7 — Fine-tuning con LoRA (opcional / offline)
**Estado: PENDIENTE — requiere GPU**
**Archivos a crear:**
- `scripts/finetune/prepare_dataset.py`
- `scripts/finetune/train.py`
- `scripts/finetune/dataset/train.jsonl`

### Qué vas a construir
Un pipeline de fine-tuning que adapta Llama 3 específicamente para
análisis financiero, usando LoRA (Low-Rank Adaptation) con Unsloth.

Este step es OPCIONAL. El sistema ya funciona bien con RAG.
Fine-tuning es para mejorar aún más la calidad de las respuestas
sin necesitar documentos en el corpus RAG.

### Qué aprenderás
- Qué es fine-tuning y en qué se diferencia de RAG
- Qué es LoRA / QLoRA y por qué permiten entrenar con menos VRAM
- Cómo preparar un dataset JSONL con pares (prompt, respuesta ideal)
- Cómo usar Unsloth para entrenar eficientemente
- Cómo cargar y usar el adaptador LoRA entrenado en Ollama

### Requisitos
- GPU con al menos 8GB VRAM (NVIDIA recomendado)
- Las dependencias están comentadas en requirements.txt
  (torch, unsloth, transformers, trl, peft, bitsandbytes)

### Qué esperar al terminar
- Un archivo `adapter/` con los pesos LoRA entrenados
- Llama 3 responde con vocabulario y formato específico de finanzas
- Menor necesidad de prompts elaborados para obtener JSON correcto

---

## Resumen del estado

| Step | Descripción                        | Estado      |
|------|------------------------------------|-------------|
| 1    | Scaffolding y entorno              | ✅ Completo  |
| 2    | Datos de mercado e indicadores     | ✅ Completo  |
| 3    | Conexión con Ollama (LLM local)    | 🔄 Pendiente |
| 4    | Pipeline RAG con ChromaDB          | 🔄 Pendiente |
| 5    | Router de análisis (orquestador)   | 🔄 Pendiente |
| 6    | Frontend React Bloomberg           | 🔄 Pendiente |
| 7    | Fine-tuning LoRA (opcional/GPU)    | 🔄 Pendiente |

---

## Arquitectura final del sistema

```
[React Frontend :5173]
        ↓ HTTP
[FastAPI Backend :8000]
        ↓
   ┌────┴────┐
   ↓         ↓
[Indicadores] [/analysis/{ticker}]
técnicos          ↓
(RSI/MACD/SMA)   ├── market_data.py
                 ├── technical.py
                 ├── rag.py → ChromaDB → nomic-embed-text
                 └── llm.py → Ollama → Llama 3
                              ↓
                    { ajuste, confianza, razon }
                              ↓
              60% señal matemática + 40% LLM
                              ↓
              INVERTIR / ESPERAR / NO INVERTIR
```