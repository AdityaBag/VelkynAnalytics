import numpy as np
import math

# ------------------------------------------------------------
# BASE MC PRICER FROM SIMULATED PATHS
# ------------------------------------------------------------

def mc_option_price(S_paths, K, r, T, option_type='call'):
    """Compute Monte Carlo option price from simulated paths."""
    S_terminal = S_paths[:, -1]
    if option_type == 'call':
        payoffs = np.maximum(S_terminal - K, 0.0)
    else:
        payoffs = np.maximum(K - S_terminal, 0.0)
    discount_factor = np.exp(-r * T)
    return discount_factor * payoffs.mean()


# ------------------------------------------------------------
# IMPORTS FOR MC SIMULATION + VARIANCE REDUCTION
# ------------------------------------------------------------

from mc_engine.simulate import simulate_gbm_paths
from mc_engine.variance_reduction import (
    antithetic_normals,
    control_variate_mc_price,
)


# ------------------------------------------------------------
# BASIC MC PRICER (NO VARIANCE REDUCTION)
# ------------------------------------------------------------

def mc_european_call_basic(S0, K, T, r, sigma, M=20000, n=252, seed=12345):
    """
    Basic Monte Carlo European call pricing (no variance reduction).
    Uses the new simulate_gbm_paths which returns ONLY S_paths.
    """
    S_paths = simulate_gbm_paths(
        S0=S0, r=r, sigma=sigma, T=T, M=M, n=n, seed=seed
    )
    return mc_option_price(S_paths, K, r, T, option_type='call')


# ------------------------------------------------------------
# ANTITHETIC VARIATES MC PRICER
# ------------------------------------------------------------

def mc_european_call_antithetic(S0, K, T, r, sigma, M=20000, n=252, seed=12345):
    """
    Monte Carlo European call with antithetic variates.
    We generate Z, build antithetic normals, and simulate GBM directly.
    """
    rng = np.random.default_rng(seed=seed)

    # Base normals
    Z = rng.standard_normal(size=(M, n))

    # Augmented with antithetic variates (shape ~ (2M, n))
    Z_aug = antithetic_normals(Z)

    # Time step
    dt = T / n
    mu_dt = (r - 0.5 * sigma**2) * dt
    sigma_sqrt_dt = sigma * np.sqrt(dt)

    # Log returns under risk-neutral measure
    log_returns = mu_dt + sigma_sqrt_dt * Z_aug

    # Cumulative log prices
    log_S = np.log(S0) + np.cumsum(log_returns, axis=1)

    # Price paths
    S_paths = np.exp(log_S)

    return mc_option_price(S_paths, K, r, T, option_type='call')


# ------------------------------------------------------------
# CONTROL VARIATE MC PRICER
# ------------------------------------------------------------

def mc_european_call_control_variate(S0, K, T, r, sigma, M=20000, n=252, seed=12345):
    """
    Monte Carlo European call with Black–Scholes control variate.
    Uses the new simulate_gbm_paths (returns ONLY S_paths).
    """
    S_paths = simulate_gbm_paths(
        S0=S0, r=r, sigma=sigma, T=T, M=M, n=n, seed=seed
    )
    return control_variate_mc_price(S_paths, K, r, T, sigma, S0)
