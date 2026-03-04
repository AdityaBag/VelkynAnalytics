import os
import shutil
import numpy as np
import matplotlib.pyplot as plt

from data_engine.yahoo import fetch_ticker_data, estimate_volatility
from plot_engine.paths import plot_mc_paths
from mc_engine.convergence import plot_convergence
from plot_engine.greeks_plot import plot_greeks_sensitivity
from vol_engine.smile import plot_volatility_smile
from plot_engine.combined import plot_4panel_combined
from export_engine.csv_export import export_simulation_data

from mc_engine.simulate import simulate_gbm_paths


def analyze_ticker_with_rate(
    ticker, r_value, r_label,
    period='1y', M=20000, n=252,
    show=False, base_outdir='./results/plots'
):
    """Run full analysis for a single ticker with a specific interest rate."""
    ticker = ticker.upper()
    print(f"  {ticker} (r={r_value})...", end=' ')

    try:
        # FETCH DATA
        adj = fetch_ticker_data(ticker, period=period)
        if adj is None or len(adj) == 0:
            print("ERROR: no data")
            return None

        sigma_hat = estimate_volatility(adj)
        S0 = float(adj.iloc[-1])
        K = S0
        T = n / 252.0

        # BLACK–SCHOLES + GREEKS
        from bs_engine.pricing import bs_call_price
        bs_price = bs_call_price(S0, K, T, r_value, sigma_hat)

        from bs_engine.greeks import bs_delta, bs_gamma, bs_vega, bs_theta, bs_rho
        delta = bs_delta(S0, K, T, r_value, sigma_hat)
        gamma = bs_gamma(S0, K, T, r_value, sigma_hat)
        vega  = bs_vega(S0, K, T, r_value, sigma_hat)
        theta = bs_theta(S0, K, T, r_value, sigma_hat)
        rho   = bs_rho(S0, K, T, r_value, sigma_hat)

        # NEW ENGINE: simulate_gbm_paths returns ONLY S_paths
        S_paths = simulate_gbm_paths(
            S0=S0,
            r=r_value,
            sigma=sigma_hat,
            T=T,
            M=M,
            n=n,
            seed=12345
        )

        # EXPORT DATA
        data_dict = {
            "ticker": ticker,
            "rate": r_value,
            "rate_label": r_label,
            "S0": S0,
            "K": K,
            "T": T,
            "volatility": sigma_hat,
            "bs_price": bs_price,
            "delta": delta,
            "gamma": gamma,
            "vega": vega,
            "theta": theta,
            "rho": rho,
            "mean_terminal_price": float(S_paths[:, -1].mean()),
            "std_terminal_price": float(S_paths[:, -1].std()),
            "M": M,
            "n": n,
        }

        # HISTORICAL ALIGNMENT
        recent = adj.iloc[-n:].reset_index(drop=True)

        # DIRECTORY STRUCTURE
        stock_folder = os.path.join(base_outdir, f"{ticker} Stock Option")
        r_folder = os.path.join(stock_folder, r_label)
        os.makedirs(r_folder, exist_ok=True)

        data_folder = os.path.join(r_folder, "data")
        os.makedirs(data_folder, exist_ok=True)

        export_simulation_data(
            outdir=data_folder,
            filename=f"{ticker}_{r_label}",
            data_dict=data_dict
        )

        # PLOTS
        plots = [
            (plot_mc_paths(ticker, S_paths, recent, S0, n, M, sigma_hat, r_value),
             f"{ticker}_MC_{n}d_M{M}.png"),

            (plot_convergence(ticker, S_paths, K, r_value, T, M, 'call'),
             f"{ticker}_02_Convergence_M{M}.png"),

            (plot_greeks_sensitivity(ticker, S0, K, T, r_value, sigma_hat, 'call'),
             f"{ticker}_03_Greeks_M{M}.png"),

            (plot_volatility_smile(ticker, S0, T, r_value, sigma_hat, 'call'),
             f"{ticker}_04_VolatilitySmile_M{M}.png"),

            (plot_4panel_combined(ticker, S_paths, recent, S0, K, T, r_value, sigma_hat, n, M),
             f"{ticker}_GBM_analysis_M{M}.png"),
        ]

        for fig, filename in plots:
            out_path = os.path.join(r_folder, filename)
            fig.savefig(out_path, dpi=100)
            plt.close(fig)

        print("OK")
        return data_dict

    except Exception as e:
        print(f"ERROR: {e}")
        return None


def batch_analyze_with_rate(
    r_value, r_label, tickers,
    period='1y', M=20000, n=252,
    base_outdir='./results/plots'
):
    print(f"\nRunning full analysis with r={r_value} ({r_label})...")

    results = []
    for ticker in tickers:
        data = analyze_ticker_with_rate(
            ticker, r_value, r_label,
            period=period, M=M, n=n,
            base_outdir=base_outdir
        )
        if data is not None:
            results.append(data)

    print("  Complete!")
    return results
