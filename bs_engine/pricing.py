import numpy as np
from scipy.stats import norm


def bs_d1_d2(S, K, T, r, sigma):
    """Compute d1 and d2 from Black-Scholes formula."""
    if T <= 0 or sigma <= 0:
        return None, None
    d1 = (np.log(S / K) + (r + 0.5 * sigma ** 2) * T) / (sigma * np.sqrt(T))
    d2 = d1 - sigma * np.sqrt(T)
    return d1, d2


def bs_call_price(S, K, T, r, sigma):
    """Analytical Black-Scholes call price."""
    d1, d2 = bs_d1_d2(S, K, T, r, sigma)
    if d1 is None:
        return 0.0
    call = S * norm.cdf(d1) - K * np.exp(-r * T) * norm.cdf(d2)
    return max(0.0, call)


def bs_put_price(S, K, T, r, sigma):
    """Analytical Black-Scholes put price."""
    d1, d2 = bs_d1_d2(S, K, T, r, sigma)
    if d1 is None:
        return 0.0
    put = K * np.exp(-r * T) * norm.cdf(-d2) - S * norm.cdf(-d1)
    return max(0.0, put)
