import os
from abc import ABC, abstractmethod
import yfinance as yf
import pandas as pd
import requests


# ==========================================
# INTERFAZ BASE (CONTRATO ABSTRACTO)
# ==========================================
class BaseMarketDataProvider(ABC):
    """
    Clase abstracta que define el contrato obligatorio para cualquier
    proveedor de datos de mercado dentro de StockIntel.
    """

    @abstractmethod
    def fetch_history(self, ticker: str, period: str) -> pd.DataFrame:
        """Debe retornar un DataFrame con columnas: Open, High, Low, Close, Volume"""
        pass

    @abstractmethod
    def fetch_info(self, ticker: str) -> dict:
        """Debe retornar un diccionario estandarizado con la metadata de la empresa"""
        pass


# ==========================================
# IMPLEMENTACIÓN 1: YAHOO FINANCE (GRATUITO / DE PREFERENCIA)
# ==========================================
class YahooFinanceProvider(BaseMarketDataProvider):
    """Implementación concreta utilizando la librería yfinance optimizada con headers."""

    def _get_session(self) -> requests.Session:
        """Genera una sesión con Headers de navegador para evitar bloqueos por scraping."""
        session = requests.Session()
        session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        })
        return session

    def fetch_history(self, ticker: str, period: str) -> pd.DataFrame:
        print(f"[-] Descargando historial de {ticker.upper()} desde Yahoo Finance...")
        
        # Forzamos un periodo mínimo de '2y' si se solicita algo menor, 
        # garantizando filas suficientes para la SMA_200 en el pipeline predictivo.
        safe_period = "2y" if period in ["1mo", "3mo", "6mo", "1y"] else period
        
        stock = yf.Ticker(ticker.upper(), session=self._get_session())
        df = stock.history(period=safe_period)

        if df.empty:
            raise ValueError(f"No se encontraron datos en Yahoo Finance para el ticker: {ticker}")

        # Limpieza estructural
        df = df[["Open", "High", "Low", "Close", "Volume"]]
        df.index = pd.to_datetime(df.index)
        df = df.astype(float)
        return df

    def fetch_info(self, ticker: str) -> dict:
        print(f"[-] Descargando metadata de {ticker.upper()} desde Yahoo Finance...")
        stock = yf.Ticker(ticker.upper(), session=self._get_session())
        info = stock.info

        return {
            "ticker": ticker.upper(),
            "name": info.get("longName", f"{ticker.upper()} Corp"),
            "sector": info.get("sector", "N/A"),
            "industry": info.get("industry", "N/A"),
            "current_price": info.get("currentPrice", info.get("regularMarketPrice", None)),
            "market_cap": info.get("marketCap", None),
            "currency": info.get("currency", "USD"),
            "exchange": info.get("exchange", "N/A"),
            "description": info.get("longBusinessSummary", "N/A"),
        }


# ==========================================
# IMPLEMENTACIÓN 2: ALPHA VANTAGE (PREMIUM)
# ==========================================
class AlphaVantageProvider(BaseMarketDataProvider):
    """Implementación oficial utilizando la API de Alpha Vantage."""

    def __init__(self):
        self.api_key = os.getenv("ALPHA_VANTAGE_API_KEY")
        if not self.api_key:
            raise ValueError("[ERROR] ALPHA_VANTAGE_API_KEY no está configurada en las variables de entorno.")
        self.base_url = "https://www.alphavantage.co/query"

    def fetch_history(self, ticker: str, period: str) -> pd.DataFrame:
        print(f"[-] Descargando historial de {ticker.upper()} desde Alpha Vantage...")
        params = {
            "function": "TIME_SERIES_DAILY",
            "symbol": ticker.upper(),
            "outputsize": "full",  # Requiere cuenta Premium para esta opción
            "apikey": self.api_key
        }
        
        response = requests.get(self.base_url, params=params)
        data = response.json()

        if "Error Message" in data:
            raise ValueError(f"Alpha Vantage Error: Ticker {ticker} inválido o no soportado.")
        if "Information" in data:
            raise ValueError(f"Alpha Vantage Limit/Paywall: {data['Information']}")
        
        time_series_key = "Time Series (Daily)"
        if time_series_key not in data:
            raise ValueError(f"No se pudieron estructurar datos de Alpha Vantage para {ticker}. Respuesta inválida.")

        raw_dict = data[time_series_key]
        df = pd.DataFrame.from_dict(raw_dict, orient='index')
        
        df = df.rename(columns={
            "1. open": "Open",
            "2. high": "High",
            "3. low": "Low",
            "4. close": "Close",
            "5. volume": "Volume"
        })
        
        df = df[["Open", "High", "Low", "Close", "Volume"]].astype(float)
        df.index = pd.to_datetime(df.index)
        df = df.sort_index()

        period_map = {"1mo": 30, "3mo": 90, "6mo": 180, "1y": 365, "2y": 730, "max": 2000}
        days_requested = period_map.get(period, 730)
        days_to_keep = days_requested + 250
        
        return df.tail(days_to_keep)

    def fetch_info(self, ticker: str) -> dict:
        print(f"[-] Descargando metadata de {ticker.upper()} desde Alpha Vantage...")
        params = {
            "function": "OVERVIEW",
            "symbol": ticker.upper(),
            "apikey": self.api_key
        }
        
        response = requests.get(self.base_url, params=params)
        info = response.json()

        if not info or "Symbol" not in info:
            quote_params = {"function": "GLOBAL_QUOTE", "symbol": ticker.upper(), "apikey": self.api_key}
            quote_resp = requests.get(self.base_url, params=quote_params).json()
            quote = quote_resp.get("Global Quote", {})
            
            return {
                "ticker": ticker.upper(),
                "name": f"{ticker.upper()} Corp",
                "sector": "N/A",
                "industry": "N/A",
                "current_price": float(quote.get("05. price", 0.0)) if quote.get("05. price") else None,
                "market_cap": None,
                "currency": "USD",
                "exchange": "N/A",
                "description": "Metadata detallada no disponible en el plan actual de Alpha Vantage.",
            }

        return {
            "ticker": info.get("Symbol", ticker.upper()),
            "name": info.get("Name", "N/A"),
            "sector": info.get("Sector", "N/A"),
            "industry": info.get("Industry", "N/A"),
            "current_price": None, 
            "market_cap": int(info.get("MarketCapitalization", 0)) if info.get("MarketCapitalization", "").isdigit() else None,
            "currency": info.get("Currency", "USD"),
            "exchange": info.get("Exchange", "N/A"),
            "description": info.get("Description", "N/A"),
        }


# ==========================================
# FACTORY Y SINGLETON PARA FASTAPI
# ==========================================
_provider_instance = None


def get_market_provider() -> BaseMarketDataProvider:
    """
    Inicializa y retorna el proveedor configurado en las variables de entorno.
    Utiliza un patrón Singleton para evitar instanciaciones redundantes.
    """
    global _provider_instance
    if _provider_instance is None:
        provider_type = os.getenv("MARKET_DATA_PROVIDER", "yfinance").lower()

        if provider_type == "alphavantage":
            _provider_instance = AlphaVantageProvider()
        else:
            _provider_instance = YahooFinanceProvider()

    return _provider_instance


# ==========================================
# WRAPPERS COMPATIBLES CON TU CÓDIGO ACTUAL
# ==========================================
def get_stock_data(ticker: str, period: str = "2y") -> pd.DataFrame:
    """Wrapper compatible que delega la petición al proveedor activo."""
    provider = get_market_provider()
    return provider.fetch_history(ticker, period)


def get_stock_info(ticker: str) -> dict:
    """Wrapper compatible que delega la petición al proveedor activo."""
    provider = get_market_provider()
    return provider.fetch_info(ticker)