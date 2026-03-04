import numpy as np


def simulate_gbm_variable_days(
    S0,
    r,
    sigma,
    days,
    M,
    seed=None
):
    """
    Simulate GBM paths for an arbitrary number of days.
    This generalizes the fixed 252-day engine.

    Parameters
    ----------
    S0 : float
        Initial price.
    r : float
        Risk-free rate.
    sigma : float
        Volatility.
    days : int
        Number of days to simulate (time steps).
    M : int
        Number of Monte Carlo paths.
    seed : int or None
        Random seed for reproducibility.

    Returns
    -------
    ndarray, shape (M, days)
        Simulated price paths.
    """

    if seed is not None:
        np.random.seed(seed)

    T = days / 252  # convert days to years
    dt = T / days

    # Pre-allocate
    paths = np.zeros((M, days))
    paths[:, 0] = S0

    drift = (r - 0.5 * sigma**2) * dt
    diffusion_scale = sigma * np.sqrt(dt)

    for t in range(1, days):
        Z = np.random.normal(size=M)
        paths[:, t] = paths[:, t - 1] * np.exp(drift + diffusion_scale * Z)

    return paths


def simulate_multiple_horizons(
    S0,
    r,
    sigma,
    horizons,
    M,
    seed=None
):
    """
    Simulate GBM paths for multiple horizons in one call.

    Parameters
    ----------
    horizons : list of int
        Example: [30, 90, 180, 252]

    Returns
    -------
    dict
        horizon -> simulated paths
    """

    results = {}

    for h in horizons:
        results[h] = simulate_gbm_variable_days(
            S0=S0,
            r=r,
            sigma=sigma,
            days=h,
            M=M,
            seed=seed
        )

    return results
