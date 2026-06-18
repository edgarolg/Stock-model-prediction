import os
import sys
import numpy as np
import tensorflow as tf
from tensorflow.keras.models import Sequential
from tensorflow.keras.layers import LSTM, Dense, Dropout
from tensorflow.keras.callbacks import EarlyStopping, ModelCheckpoint
import matplotlib.pyplot as plt

# Asegurar la inyección de PATH para consistencia del proyecto
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))


def train_lstm_model(ticker: str, epochs: int = 100, batch_size: int = 16):
    """
    Carga los datasets pre-procesados (.npy), construye la arquitectura
    de la Red Neuronal Recurrente LSTM, la entrena con regularización,
    evalúa las métricas y exporta los pesos finales al Backend.
    """
    print(f"=== Iniciando entrenamiento de Red Neuronal para: {ticker.upper()} ===")
    
    # 1. Rutas de directorios
    dataset_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "dataset"))
    models_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../backend/data/models"))
    os.makedirs(models_dir, exist_ok=True)

    # Nombres de archivos .npy generados en el paso de limpieza
    X_train_path = os.path.join(dataset_dir, f"{ticker.lower()}_X_train.npy")
    X_test_path = os.path.join(dataset_dir, f"{ticker.lower()}_X_test.npy")
    y_train_path = os.path.join(dataset_dir, f"{ticker.lower()}_y_train.npy")
    y_test_path = os.path.join(dataset_dir, f"{ticker.lower()}_y_test.npy")

    # Validar que existan los datos procesados
    if not (os.path.exists(X_train_path) and os.path.exists(X_test_path)):
        raise FileNotFoundError(f"[ERROR] No se encontraron los archivos binarios .npy en '{dataset_dir}'. Ejecuta prepare_dataset.py primero.")

    # 2. Cargar los arrays de NumPy
    X_train = np.load(X_train_path)
    X_test = np.load(X_test_path)
    y_train = np.load(y_train_path)
    y_test = np.load(y_test_path)

    print(f"[-] Datos cargados con éxito.")
    print(f"    -> Tensores de Entrenamiento: {X_train.shape}")
    print(f"    -> Tensores de Validación:    {X_test.shape}")

    # Extraer dimensiones: (muestras, ventanas_de_tiempo, numero_de_características)
    timesteps = X_train.shape[1]
    features = X_train.shape[2]

    # 3. Definir la Arquitectura de la Red Neuronal (LSTM Profundo)
    model = Sequential([
        # Primera capa LSTM: Retorna secuencias para alimentar la siguiente capa recurrente
        LSTM(units=64, return_sequences=True, input_shape=(timesteps, features)),
        Dropout(0.2), # Mitiga el sobreajuste (overfitting) apagando neuronas aleatoriamente
        
        # Segunda capa LSTM: Procesa la secuencia refinada y colapsa el output
        LSTM(units=32, return_sequences=False),
        Dropout(0.2),
        
        # Capas Densas de toma de decisiones
        Dense(units=16, activation="relu"),
        # Capa de salida lineal (un solo valor continuo: la predicción del precio del día siguiente)
        Dense(units=1, activation="linear")
    ])

    # Compilación utilizando el optimizador Adam y el Error Cuadrático Medio como función de pérdida
    model.compile(optimizer="adam", loss="mean_squared_error", metrics=["mae"])
    model.summary()

    # 4. Configuración de Callbacks inteligentes para el entrenamiento
    output_model_path = os.path.join(models_dir, f"{ticker.lower()}_lstm_model.keras")
    
    callbacks = [
        # Detiene el entrenamiento si la pérdida de validación deja de mejorar durante 7 épocas consecutivas
        EarlyStopping(monitor="val_loss", patience=40, restore_best_weights=True, verbose=1),
        # Guarda únicamente la mejor iteración del modelo en disco
        ModelCheckpoint(filepath=output_model_path, monitor="val_loss", save_best_only=True, verbose=1)
    ]

    # 5. Ejecutar Entrenamiento (Fit)
    print("[-] Entrenando el modelo...")
    history = model.fit(
        X_train, y_train,
        validation_data=(X_test, y_test),
        epochs=epochs,
        batch_size=batch_size,
        callbacks=callbacks,
        verbose=1
    )

    print(f"\n=== Modelo guardado exitosamente en: {output_model_path} ===")

    # 6. Evaluación rápida en el set de testeo independiente
    eval_metrics = model.evaluate(X_test, y_test, verbose=0)
    print(f"[-] Métricas Finales en Test - MSE: {eval_metrics[0]:.6f} | MAE: {eval_metrics[1]:.6f}")
