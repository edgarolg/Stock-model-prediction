from fastapi import FastAPI

from backend.routers.stocks import router
app = FastAPI()

app.include_router(router, prefix="/api/stocks")

@app.get("/")
def root():
    return {"message": "API funcionando"}