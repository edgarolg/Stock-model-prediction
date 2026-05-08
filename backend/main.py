from fastapi import FastAPI
from backend.routers import stocks

# Primero creas la app
app = FastAPI()

# Luego agregas los routers
app.include_router(stocks.router)

# Después las rutas normales
@app.get("/")
def root():
    return {"message": "API funcionando"}