import numpy as np


def simulate_correlated_gbm(
    S0_vec,
    r,
    sigma_vec,
    corr_matrix,
    T,
    M,
    n
):
    """
    Simulate correlated GBM paths for multiple assets using Cholesky decomposition.

    Parameters
    ----------
    S0_vec : array-like, shape (d,)
        Initial prices for d assets.
    r : float
        Risk-free rate.
    sigma_vec : array-like, shape (d,)
        Volatilities for each asset.
    corr_matrix : ndarray, shape (d, d)
        Correlation matrix between assets.
    T : float
        Time to maturity.
    M : int
        Number of Monte Carlo paths.
    n : int
        Number of time steps.

    Returns
    -------
    ndarray, shape (M, n, d)
        Simulated price paths for all assets.
    """

    S0_vec = np.array(S0_vec)
    sigma_vec = np.array(sigma_vec)
    d = len(S0_vec)

    dt = T / n

    # Cholesky decomposition for correlation
    L = np.linalg.cholesky(corr_matrix)

    # Pre-allocate paths
    paths = np.zeros((M, n, d))
    paths[:, 0, :] = S0_vec

    # Drift term
    drift = (r - 0.5 * sigma_vec**2) * dt

    for t in range(1, n):
        # Generate correlated random shocks
        Z = np.random.normal(size=(M, d))
        correlated_Z = Z @ L.T

        # Apply GBM update for each asset
        diffusion = sigma_vec * np.sqrt(dt) * correlated_Z
        paths[:, t, :] = paths[:, t - 1, :] * np.exp(drift + diffusion)

    return paths


def basket_option_payoff(S_T_matrix, weights, K, option_type="call"):
    """
    Compute payoff of a basket option.

    Parameters
    ----------
    S_T_matrix : ndarray, shape (M, d)
        Terminal prices for d assets.
    weights : array-like, shape (d,)
        Portfolio weights for each asset.
    K : float
        Strike price.
    option_type : str
        "call" or "put".

    Returns
    -------
    ndarray, shape (M,)
        Payoff for each path.
    """

    weights = np.array(weights)
    basket_price = S_T_matrix @ weights

    if option_type == "call":
        return np.maximum(basket_price - K, 0.0)
    else:
        return np.maximum(K - basket_price, 0.0)


def price_basket_option(
    S0_vec,
    r,
    sigma_vec,
    corr_matrix,
    T,
    M,
    n,
    weights,
    K,
    option_type="call"
):
    """
    Price a basket option using correlated GBM Monte Carlo.

    Returns
    -------
    dict
        {
            "price": float,
            "paths": ndarray,
            "terminal_prices": ndarray
        }
    """

    paths = simulate_correlated_gbm(
        S0_vec=S0_vec,
        r=r,
        sigma_vec=sigma_vec,
        corr_matrix=corr_matrix,
        T=T,
        M=M,
        n=n
    )

    S_T = paths[:, -1, :]
    payoff = basket_option_payoff(S_T, weights, K, option_type)
    price = np.exp(-r * T) * payoff.mean()

    return {
        "price": float(price),
        "paths": paths,
        "terminal_prices": S_T
    }
