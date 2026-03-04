import os
import math
import sys
import pathlib

import numpy as np
import pandas as pd
import matplotlib.pyplot as plt

# -------------------------------------------------------------------
# Ensure project root is on sys.path so imports work from anywhere
# -------------------------------------------------------------------
ROOT_DIR = pathlib.Path(__file__).resolve().parents[1]
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

# Data + export engines
from data_engine.yahoo import fetch_ticker_data, estimate_volatility
from export_engine.csv_export import export_simulation_data

# Plot engine
from plot_engine.paths import plot_mc_paths

# Pricing engines
from bs_engine.pricing import bs_call_price
from binomial_engine.pricing import binomial_option_price

# Monte Carlo pricing engines
from mc_engine.pricing import (
    mc_european_call_basic,
    mc_european_call_antithetic,
    mc_european_call_control_variate,
)

# MC path simulator (new version: returns ONLY S_paths)
from mc_engine.simulate import simulate_gbm_paths


def analyze_ticker(ticker, period="1y", M=20000, n=252, r=0.01, show=False, outdir="."):
    """Full analysis for a single ticker."""
    ticker = ticker.upper()

    print(f"\nAnalyzing {ticker}...")
    print(f"Fetching {ticker} data (period={period})...")

    try:
        adj = fetch_ticker_data(ticker, period=period)
        if adj is None or len(adj) == 0:
            print(f"Error: no data for {ticker}")
            return

        sigma_hat = estimate_volatility(adj)
        S0 = float(adj.iloc[-1])
        K = S0
        T = n / 252

        print(f"S0: {S0:.2f}, Sigma: {sigma_hat:.6f}")

        # -----------------------------
        # PRICING ENGINES
        # -----------------------------
        bs_price = bs_call_price(S0, K, T, r, sigma_hat)

        mc_basic = mc_european_call_basic(
            S0=S0, K=K, T=T, r=r, sigma=sigma_hat, M=M, n=n
        )

        mc_anti = mc_european_call_antithetic(
            S0=S0, K=K, T=T, r=r, sigma=sigma_hat, M=M, n=n
        )

        mc_cv = mc_european_call_control_variate(
            S0=S0, K=K, T=T, r=r, sigma=sigma_hat, M=M, n=n
        )

        binomial_price = binomial_option_price(
            S0=S0,
            K=K,
            T=T,
            r=r,
            sigma=sigma_hat,
            N=200,
            option_type="call",
            american=False,
        )

        # -----------------------------
        # SIMULATE PATHS (new engine)
        # -----------------------------
        S_paths = simulate_gbm_paths(
            S0=S0, r=r, sigma=sigma_hat, T=T, M=M, n=n, seed=12345
        )

        print(f"Simulated {M} paths, each with {n} time steps")

        # -----------------------------
        # HISTORICAL PRICE ALIGNMENT
        # -----------------------------
        recent = adj.iloc[-n:].reset_index(drop=True)

        # -----------------------------
        # PLOT AND SAVE
        # -----------------------------
        fig = plot_mc_paths(ticker, S_paths, recent, S0, n, M, sigma_hat, r)

        output_dir = os.path.join(outdir, f"{ticker} Stock Option")
        os.makedirs(output_dir, exist_ok=True)

        out_path = os.path.join(output_dir, f"{ticker}_MC_{n}d_M{M}.png")
        fig.savefig(out_path, dpi=100)
        plt.close(fig)
        print(f"Saved: {out_path}")

        # -----------------------------
        # PRICING COMPARISON TABLE
        # -----------------------------
        print("\nPricing Comparison")
        print("----------------------------")
        print(f"Black–Scholes:               {bs_price:.4f}")
        print(f"Binomial (N=200):            {binomial_price:.4f}")
        print(f"MC (basic):                  {mc_basic:.4f}")
        print(f"MC (antithetic):             {mc_anti:.4f}")
        print(f"MC (control variate):        {mc_cv:.4f}")

        if show:
            plt.show()

    except Exception as e:
        print(f"Error analyzing {ticker}: {e}")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python single_ticker.py <TICKER>")
        sys.exit(1)

    analyze_ticker(sys.argv[1])
