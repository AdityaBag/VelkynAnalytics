import numpy as np
from mc_engine.simulate import simulate_gbm_paths
from mc_engine.mc_greeks import mc_greeks_all
from mc_engine.terminal_distribution import compute_terminal_distribution


def run_scenario(
    S0,
    K,
    r,
    sigma,
    T,
    M,
    n,
    shock_r=0.0,
    shock_sigma=0.0,
    shock_mu=0.0,
    option_type="call"
):
    """
    Run a single scenario with shocks applied to r, sigma, or drift.

    Parameters
    ----------
    S0 : float
        Initial price.
    K : float
        Strike price.
    r : float
        Base risk-free rate.
    sigma : float
        Base volatility.
    T : float
        Time to maturity.
    M : int
        Number of Monte Carlo paths.
    n : int
        Number of time steps.
    shock_r : float
        Additive shock to interest rate.
    shock_sigma : float
        Additive shock to volatility.
    shock_mu : float
        Additive drift shock (rarely used in risk-neutral pricing).
    option_type : str
        "call" or "put".

    Returns
    -------
    dict
        {
            "paths": ndarray,
            "terminal_stats": dict,
            "mc_greeks": dict,
            "scenario_params": dict
        }
    """

    # Apply shocks
    r_new = r + shock_r
    sigma_new = sigma + shock_sigma
    mu_new = r_new + shock_mu  # drift shock applied here

    # Simulate paths under shocked parameters
    S_paths = simulate_gbm_paths(
        S0=S0,
        r=r_new,
        sigma=sigma_new,
        T=T,
        M=M,
        n=n
    )

    # Compute terminal distribution
    terminal_stats = compute_terminal_distribution(S_paths)

    # Compute MC Greeks
    greeks = mc_greeks_all(
        S_paths=S_paths,
        K=K,
        r=r_new,
        T=T,
        sigma=sigma_new,
        option_type=option_type
    )

    return {
        "paths": S_paths,
        "terminal_stats": terminal_stats,
        "mc_greeks": greeks,
        "scenario_params": {
            "r": r_new,
            "sigma": sigma_new,
            "mu": mu_new,
            "shock_r": shock_r,
            "shock_sigma": shock_sigma,
            "shock_mu": shock_mu
        }
    }


def run_multiple_scenarios(
    S0,
    K,
    r,
    sigma,
    T,
    M,
    n,
    scenarios,
    option_type="call"
):
    """
    Run multiple scenarios in a batch.

    Parameters
    ----------
    scenarios : list of dict
        Example:
        [
            {"shock_r": 0.01},
            {"shock_sigma": 0.05},
            {"shock_r": -0.01, "shock_sigma": 0.02}
        ]

    Returns
    -------
    dict
        scenario_name -> scenario_result
    """

    results = {}

    for i, sc in enumerate(scenarios):
        shock_r = sc.get("shock_r", 0.0)
        shock_sigma = sc.get("shock_sigma", 0.0)
        shock_mu = sc.get("shock_mu", 0.0)

        scenario_name = f"scenario_{i+1}"

        results[scenario_name] = run_scenario(
            S0=S0,
            K=K,
            r=r,
            sigma=sigma,
            T=T,
            M=M,
            n=n,
            shock_r=shock_r,
            shock_sigma=shock_sigma,
            shock_mu=shock_mu,
            option_type=option_type
        )

    return results
