"""
Variance reduction techniques for Monte Carlo simulation.
This module extends the basic GBM simulator with professional-grade
variance reduction methods used in quantitative finance.

Techniques included:
- Antithetic variates
- Moment matching
- Control variates (using Black–Scholes)
"""

import numpy as np
import math
from bs_engine.pricing import bs_call_price


# ------------------------------------------------------------
# 1. Antithetic Variates
# ------------------------------------------------------------

def antithetic_normals(Z):
    """
    Given a matrix of standard normal draws Z (M x n),
    return an augmented matrix containing Z and -Z.
    This doubles the number of paths but halves variance.
    """
    return np.vstack([Z, -Z])


# ------------------------------------------------------------
# 2. Moment Matching
# ------------------------------------------------------------

def moment_match(Z):
    """
    Adjust Z so that:
    - mean(Z) = 0
    - std(Z) = 1
    This reduces sampling error and stabilizes MC estimates.
    """
    Z_adj = Z - Z.mean()
    Z_adj /= Z_adj.std()
    return Z_adj


# ------------------------------------------------------------
# 3. Control Variates (Black–Scholes)
# ------------------------------------------------------------

def control_variate_mc_price(S_paths, K, r, T, sigma, S0):
    """
    Apply Black–Scholes control variate to reduce MC variance.

    Parameters
    ----------
    S_paths : ndarray (M x (n+1))
        Simulated price paths.
    K : float
        Strike price.
    r : float
        Annual risk-free rate.
    T : float
        Time to maturity in years.
    sigma : float
        Volatility.
    S0 : float
        Initial price.

    Returns
    -------
    float
        Variance-reduced Monte Carlo price.
    """

    # Raw MC payoff
    mc_payoffs = np.maximum(S_paths[:, -1] - K, 0)

    # Black–Scholes closed-form price
    bs_price = bs_call_price(S0, K, T, r, sigma)

    # Expected terminal price under RN measure:
    expected_ST = S0 * math.exp(r * T)

    # Control variate adjustment
    cov = np.cov(mc_payoffs, S_paths[:, -1], ddof=1)[0, 1]
    var_ST = np.var(S_paths[:, -1], ddof=1)
    beta = cov / var_ST

    adjusted_payoffs = mc_payoffs - beta * (S_paths[:, -1] - expected_ST)

    return math.exp(-r * T) * adjusted_payoffs.mean()
