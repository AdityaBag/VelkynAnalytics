from scipy.stats import norm
import numpy as np
from .pricing import bs_d1_d2


def bs_delta(S, K, T, r, sigma, option_type='call'):
    """Option Delta (sensitivity to S)."""
    d1, _ = bs_d1_d2(S, K, T, r, sigma)
    if d1 is None:
        return 0.0
    if option_type == 'call':
        return norm.cdf(d1)
    else:
        return norm.cdf(d1) - 1.0


def bs_gamma(S, K, T, r, sigma):
    """Option Gamma (delta sensitivity)."""
    d1, _ = bs_d1_d2(S, K, T, r, sigma)
    if d1 is None or T <= 0 or sigma <= 0:
        return 0.0
    return norm.pdf(d1) / (S * sigma * np.sqrt(T))


def bs_vega(S, K, T, r, sigma):
    """Option Vega (volatility sensitivity per 1% change)."""
    d1, _ = bs_d1_d2(S, K, T, r, sigma)
    if d1 is None or T <= 0:
        return 0.0
    return S * norm.pdf(d1) * np.sqrt(T) / 100.0


def bs_theta(S, K, T, r, sigma, option_type='call'):
    """Option Theta (time decay per day)."""
    d1, d2 = bs_d1_d2(S, K, T, r, sigma)
    if d1 is None or T <= 0 or sigma <= 0:
        return 0.0
    if option_type == 'call':
        theta = (-S * norm.pdf(d1) * sigma / (2 * np.sqrt(T)) 
                 - r * K * np.exp(-r * T) * norm.cdf(d2))
    else:
        theta = (-S * norm.pdf(d1) * sigma / (2 * np.sqrt(T)) 
                 + r * K * np.exp(-r * T) * norm.cdf(-d2))
    return theta / 365.0


def bs_rho(S, K, T, r, sigma, option_type='call'):
    """Option Rho (interest rate sensitivity per 1% change)."""
    d1, d2 = bs_d1_d2(S, K, T, r, sigma)
    if d1 is None or T <= 0:
        return 0.0
    if option_type == 'call':
        return K * T * np.exp(-r * T) * norm.cdf(d2) / 100.0
    else:
        return -K * T * np.exp(-r * T) * norm.cdf(-d2) / 100.0
