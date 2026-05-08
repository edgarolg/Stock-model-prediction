from fastapi import APIRouter
from backend.data.preparation.prepare_dataset import run_pipeline

router = APIRouter()

@router.get("/stock/{ticker}")
def get_stock(ticker: str):
    result = run_pipeline(ticker)
    
    df = result["df_features"]
    
    # Convertir a formato JSON para el frontend
    return {
        "ticker": ticker,
        "data": df[["Close", "RSI", "MACD"]].tail(30).reset_index().to_dict(orient="records")
    }