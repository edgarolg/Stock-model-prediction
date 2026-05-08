import yfinance as yf

def get_stock_data(ticker: str):

    df = yf.download(ticker, period="5y", auto_adjust=True)

    df.columns = [col[0] if isinstance(col, tuple) else col for col in df.columns]

    return df