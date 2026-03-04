import yfinance as yf
import numpy as np


def fetch_ticker_data(ticker, period='1y'):
    """Download ticker data from Yahoo Finance."""
    data = yf.download(ticker, period=period, interval='1d', progress=False)
    if 'Adj Close' in data.columns:
        adj = data['Adj Close']
    else:
        adj = data.select_dtypes('number').iloc[:, 0]
    return adj


def estimate_volatility(adj_prices):
    """Estimate daily volatility from log returns."""
    logrets = np.log(adj_prices).diff().dropna()
    return float(logrets.std(ddof=1))
