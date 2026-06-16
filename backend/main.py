from fastapi import FastAPI
from dotenv import load_dotenv
from backend.database.connection import init_db
load_dotenv()

from backend.routers import analisys

# Primero creas la app
app = FastAPI(title="StockIntel API Híbrida")


@app.on_event("startup")
def on_startup():
    init_db()
# Luego agregas los routers
app.include_router(analisys.router)

# Después las rutas normales
@app.get("/")
def root():
    return {"message": "API funcionando"}