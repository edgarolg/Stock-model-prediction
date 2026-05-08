import sys
import os

# Agregar la raíz del proyecto al path de Python
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..')))

# Ahora sí funciona el import con ruta completa
from backend.data.preparation.data_obtention import stock_data

# Preparar el dataset para el entrenamiento del modelo
# Usamos solo la columna "Close" para predecir el precio de cierre
close_data = stock_data[["Close"]]

print(close_data.head())