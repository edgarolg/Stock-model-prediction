# 🚀 StockIntel - Roadmap de Desarrollo Operativo

Este documento registra el progreso actual del backend híbrido, las contingencias aplicadas a los proveedores de datos y los pasos necesarios para la persistencia antes de pasar al Frontend.

---

## 🟩 FASE 1: Core del Backend y Modelos de IA (¡Completado!)
* [x] Entrenamiento e integración del modelo matemático predictivo (LSTM).
* [x] Configuración del agente RAG y conexión local con Ollama (Llama 3.2).
* [x] Orquestador híbrido unificado para mezclar datos técnicos e inferencia del LLM.

---

## 🟨 FASE 2: Conectividad de Datos y Estabilización (En Revisión/Testing)
* [x] **Implementación de Interfaces:** Creación de la estructura abstracta `BaseMarketDataProvider` para desacoplar los proveedores de datos.
* [x] **Revisión de Llamadas a las APIs (¡IMPORTANTE!):**
    * *Caso Alpha Vantage:* El pipeline base quedó roto debido a un muro de pago (*Paywall*) implementado por el proveedor sobre el parámetro `outputsize=full`, restringiendo las cuentas gratuitas a 100 días (insuficiente para calcular la `SMA_200` requerida por el LSTM).
    * *Caso Yahoo Finance:* Implementado como proveedor gratuito principal. Sin embargo, genera bloqueos temporales por IP (`Too Many Requests / 429 Rate Limit`) debido al reinicio constante del servidor en desarrollo (`--reload`).
* [ x] **Obtencion de noticias reales:** hacer que se peuden buscar las noticias reales para que en esto se base al LLM.


---

## 🔵 FASE 3: Infraestructura y Persistencia (Punto Actual - Por Iniciar)
* [x] Creación del archivo `requirements.txt` actualizado con dependencias de persistencia.
* [x] Configuración del `.gitignore` para proteger credenciales (`.env`) y evitar subir basura de caché a Git.
* [x ] **Inicialización de la Base de Datos (SQLite Local):**
* [x] **Validación del Flujo de Datos:** Verificar que al consultar el análisis de una acción, los resultados del LSTM y el LLM se guarden automáticamente en la tabla `hybrid_analysis_history`.
* [x] **Endpoints de Gestión:** Crear rutas en FastAPI para permitir al usuario añadir sus estrategias de inversión personalizadas y registrar compras de acciones en su portafolio (`user_investments`).

---

## ⬜ FASE 4: Frontend y Dashboard Visual (Siguiente Paso)
* [x] Definición del Stack tecnológico para la interfaz de usuario.
* [x] Conexión de los formularios de inversión con la base de datos local.
* [x] Creación de gráficos interactivos para comparar el precio real contra la predicción híbrida de la IA.
* [x] Validaciones de nombrs y Stocks por error de usuario.
* [x] Paginas extra, logica de botones de coneccion.
* [x] botones de back, pulir los diseños y que todo sea conecatable entre si.
* [x] Manejar la carga de los datos, para que si tarda mucho en cargar que tenga un loadres.
