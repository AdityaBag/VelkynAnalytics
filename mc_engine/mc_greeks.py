import numpy as np


def mc_delta_pathwise(S_paths, K, r, T, option_type="call"):
    """
    Monte Carlo Delta using the Pathwise Derivative Method.
    Works only for differentiable payoffs (e.g., European call/put).

    Parameters
    ----------
    S_paths : ndarray, shape (M, n)
        Simulated price paths.
    K : float
        Strike price.
    r : float
        Risk-free rate.
    T : float
        Time to maturity.
    option_type : str
        "call" or "put".

    Returns
    -------
    delta_estimate : float
        Monte Carlo estimate of Delta.
    """

    S_T = S_paths[:, -1]

    if option_type == "call":
        indicator = (S_T > K).astype(float)
    else:
        indicator = (S_T < K).astype(float)

    # Infer S0 from the first path
    S0 = S_paths[0, 0]

    # Pathwise derivative: dS_T/dS0 = S_T / S0
    dS_dS0 = S_T / S0

    discounted = np.exp(-r * T) * indicator * dS_dS0
    return float(discounted.mean())


def mc_vega_likelihood_ratio(S_paths, K, r, T, sigma, option_type="call"):
    """
    Monte Carlo Vega using the Likelihood Ratio Method (LRM).
    Works for any payoff (even non-differentiable).

    Parameters
    ----------
    S_paths : ndarray, shape (M, n)
        Simulated price paths.
    K : float
        Strike price.
    r : float
        Risk-free rate.
    T : float
        Time to maturity.
    sigma : float
        Volatility.
    option_type : str
        "call" or "put".

    Returns
    -------
    vega_estimate : float
        Monte Carlo estimate of Vega.
    """

    S_T = S_paths[:, -1]

    if option_type == "call":
        payoff = np.maximum(S_T - K, 0.0)
    else:
        payoff = np.maximum(K - S_T, 0.0)

    log_ST = np.log(S_T)
    S0 = S_paths[0, 0]
    mu = np.log(S0) + (r - 0.5 * sigma**2) * T

    # LRM weight
    weight = (log_ST - mu) / sigma

    discounted = np.exp(-r * T) * payoff * weight
    return float(discounted.mean())


def mc_gamma_likelihood_ratio(S_paths, K, r, T, sigma, option_type="call"):
    """
    Monte Carlo Gamma using the Likelihood Ratio Method (LRM).
    More stable than finite differences.

    Parameters
    ----------
    S_paths : ndarray
        Simulated price paths.
    K : float
        Strike price.
    r : float
        Risk-free rate.
    T : float
        Time to maturity.
    sigma : float
        Volatility.
    option_type : str
        "call" or "put".

    Returns
    -------
    gamma_estimate : float
        Monte Carlo estimate of Gamma.
    """

    S_T = S_paths[:, -1]

    if option_type == "call":
        payoff = np.maximum(S_T - K, 0.0)
    else:
        payoff = np.maximum(K - S_T, 0.0)

    log_ST = np.log(S_T)
    S0 = S_paths[0, 0]
    mu = np.log(S0) + (r - 0.5 * sigma**2) * T

    w1 = (log_ST - mu) / sigma
    w2 = (w1**2 - 1)

    discounted = np.exp(-r * T) * payoff * w2 / (S0**2)
    return float(discounted.mean())


def mc_greeks_all(S_paths, K, r, T, sigma, option_type="call"):
    """
    Compute all MC Greeks at once.

    Returns
    -------
    dict with delta, vega, gamma
    """

    return {
        "delta": mc_delta_pathwise(S_paths, K, r, T, option_type),
        "vega": mc_vega_likelihood_ratio(S_paths, K, r, T, sigma, option_type),
        "gamma": mc_gamma_likelihood_ratio(S_paths, K, r, T, sigma, option_type),
    }
