from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from backend.database.connection import init_db
load_dotenv()

from backend.routers import analisys
from backend.routers import stocks
from backend.routers import portfolio


# Primero creas la app
app = FastAPI(title="StockIntel API Híbrida")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"], # El puerto de tu Frontend en Vite
    allow_credentials=True,
    allow_methods=["*"], # Permite GET, POST, PUT, DELETE, etc.
    allow_headers=["*"],
)

@app.on_event("startup")
def on_startup():
    init_db()

# Luego agregas los routers
app.include_router(stocks.router)
app.include_router(analisys.router)
app.include_router(portfolio.router)


# Después las rutas normales
@app.get("/")
def root():
    return {"message": "API funcionando"}