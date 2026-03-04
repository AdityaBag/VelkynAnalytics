import numpy as np

def simulate_gbm_paths(S0, r, sigma, T, M=20000, n=252, seed=None):
    """
    Simulate GBM price paths under the risk-neutral measure.
    RETURNS ONLY S_paths (shape: M x n)
    """

    # Random generator
    if seed is not None:
        rng = np.random.default_rng(seed)
    else:
        rng = np.random.default_rng()

    # Time step
    dt = T / n

    # Risk-neutral drift per step
    mu_dt = (r - 0.5 * sigma**2) * dt
    sigma_sqrt_dt = sigma * np.sqrt(dt)

    # Standard normal shocks
    Z = rng.standard_normal(size=(M, n))

    # Log returns
    log_returns = mu_dt + sigma_sqrt_dt * Z

    # Cumulative log prices (NO PREPENDED S0)
    log_S = np.log(S0) + np.cumsum(log_returns, axis=1)

    # Convert back to price space
    S_paths = np.exp(log_S)

    return S_paths
