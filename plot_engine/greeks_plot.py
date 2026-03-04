import numpy as np
import matplotlib.pyplot as plt
from bs_engine.greeks import bs_delta, bs_gamma, bs_vega, bs_theta


def plot_greeks_sensitivity(ticker, S0, K, T, r, sigma_hat, option_type='call'):
    """Plot Greeks across different spot prices."""
    S_range = np.linspace(S0 * 0.8, S0 * 1.2, 50)

    deltas = [bs_delta(S, K, T, r, sigma_hat, option_type) for S in S_range]
    gammas = [bs_gamma(S, K, T, r, sigma_hat) for S in S_range]
    vegas = [bs_vega(S, K, T, r, sigma_hat) for S in S_range]
    thetas = [bs_theta(S, K, T, r, sigma_hat, option_type) for S in S_range]

    fig, axes = plt.subplots(2, 2, figsize=(12, 10))

    axes[0, 0].plot(S_range, deltas, linewidth=2)
    axes[0, 0].axvline(x=S0, color='r', linestyle='--', alpha=0.5, label='S0')
    axes[0, 0].set_title('Delta')
    axes[0, 0].set_ylabel('Delta')
    axes[0, 0].legend()
    axes[0, 0].grid(True, alpha=0.3)

    axes[0, 1].plot(S_range, gammas, linewidth=2, color='orange')
    axes[0, 1].axvline(x=S0, color='r', linestyle='--', alpha=0.5, label='S0')
    axes[0, 1].set_title('Gamma')
    axes[0, 1].set_ylabel('Gamma')
    axes[0, 1].legend()
    axes[0, 1].grid(True, alpha=0.3)

    axes[1, 0].plot(S_range, vegas, linewidth=2, color='green')
    axes[1, 0].axvline(x=S0, color='r', linestyle='--', alpha=0.5, label='S0')
    axes[1, 0].set_title('Vega')
    axes[1, 0].set_ylabel('Vega')
    axes[1, 0].set_xlabel('Spot Price (S)')
    axes[1, 0].legend()
    axes[1, 0].grid(True, alpha=0.3)

    axes[1, 1].plot(S_range, thetas, linewidth=2, color='purple')
    axes[1, 1].axvline(x=S0, color='r', linestyle='--', alpha=0.5, label='S0')
    axes[1, 1].set_title('Theta')
    axes[1, 1].set_ylabel('Theta (daily)')
    axes[1, 1].set_xlabel('Spot Price (S)')
    axes[1, 1].legend()
    axes[1, 1].grid(True, alpha=0.3)

    fig.suptitle(f'{ticker} - Greeks Sensitivity', fontsize=14)
    fig.tight_layout()

    return fig