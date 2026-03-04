import numpy as np
import matplotlib.pyplot as plt
from bs_engine.greeks import bs_delta


def plot_4panel_combined(ticker, S_paths, recent_prices, S0, K, T, r_value, sigma_hat, n, M):
    """
    Create 4-panel combined analysis: Convergence, Paths, Delta, VolSmile.

    IMPORTANT:
    - Panel 2 no longer assumes n+1.
    - It infers lengths from S_paths and recent_prices and forces them to match.
    """

    fig, axes = plt.subplots(2, 2, figsize=(14, 10))

    # =========================
    # Panel 1: Convergence
    # =========================
    S_terminal = S_paths[:, -1]
    payoffs = np.maximum(S_terminal - K, 0.0)
    discount = np.exp(-r_value * T)
    cumulative_payoff = np.cumsum(payoffs)
    m_vals = np.arange(1, len(payoffs) + 1)
    mc_prices = discount * cumulative_payoff / m_vals

    axes[0, 0].plot(m_vals, mc_prices, linewidth=1.5)
    axes[0, 0].axhline(y=mc_prices[-1], color='r', linestyle='--', alpha=0.7)
    axes[0, 0].set_title('Convergence')
    axes[0, 0].set_xlabel('Number of simulations (M)')
    axes[0, 0].set_ylabel('Call price')
    axes[0, 0].grid(True, alpha=0.3)

    # =========================
    # Panel 2: Simulated paths + historical (aligned)
    # =========================
    sim_len = S_paths.shape[1]          # number of simulated steps
    hist_vals = recent_prices.values    # historical series as 1D array

    # We will plot series of length L:
    #   - x: t = 0, 1, ..., L-1
    #   - y_sim: [S0] + first L-1 simulated points
    #   - y_hist: [S0] + last  L-1 historical points
    L = min(sim_len + 1, len(hist_vals))
    t = np.arange(L)

    # sample paths
    idx = np.random.choice(len(S_paths), size=min(100, len(S_paths)), replace=False)

    for i in idx:
        sim_series = np.concatenate(([S0], S_paths[i, :L-1]))
        axes[0, 1].plot(t, sim_series, alpha=0.3, linewidth=0.5)

    hist_tail = hist_vals[-(L-1):]
    hist_series = np.concatenate(([S0], hist_tail))
    axes[0, 1].plot(t, hist_series, color='k', linewidth=2, label='historical')

    axes[0, 1].set_title('100 Simulated Paths (aligned with history)')
    axes[0, 1].set_xlabel('Time (days)')
    axes[0, 1].set_ylabel('Price')
    axes[0, 1].legend()
    axes[0, 1].grid(True, alpha=0.3)

    # =========================
    # Panel 3: Delta sensitivity
    # =========================
    S_range = np.linspace(S0 * 0.8, S0 * 1.2, 50)
    deltas = [bs_delta(S, K, T, r_value, sigma_hat, 'call') for S in S_range]
    axes[1, 0].plot(S_range, deltas, linewidth=2)
    axes[1, 0].axvline(x=S0, color='r', linestyle='--', alpha=0.5, label='S0')
    axes[1, 0].set_title('Delta')
    axes[1, 0].set_xlabel('Spot Price (S)')
    axes[1, 0].set_ylabel('Delta')
    axes[1, 0].legend()
    axes[1, 0].grid(True, alpha=0.3)

    # =========================
    # Panel 4: Volatility smile
    # =========================
    strikes = np.linspace(S0 * 0.8, S0 * 1.2, 30)
    moneyness = strikes / S0
    implied_vol = sigma_hat * (1.0 + 0.3 * (moneyness - 1.0) ** 2)
    axes[1, 1].plot(strikes / S0, implied_vol, linewidth=2, marker='o', markersize=4)
    axes[1, 1].axvline(x=1.0, color='r', linestyle='--', alpha=0.5, label='ATM')
    axes[1, 1].set_title('Volatility Smile')
    axes[1, 1].set_xlabel('Moneyness (K/S0)')
    axes[1, 1].set_ylabel('Implied Vol')
    axes[1, 1].legend()
    axes[1, 1].grid(True, alpha=0.3)

    fig.suptitle(f'{ticker} - Comprehensive Analysis (r={r_value:.3%})', fontsize=14, fontweight='bold')
    fig.tight_layout()

    return fig
