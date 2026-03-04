import matplotlib.pyplot as plt
import numpy as np


def plot_mc_paths(
    ticker,
    S_paths,
    recent_prices,  # unused, kept for signature compatibility
    S0,
    n,
    M,
    sigma_hat,
    annual_r,
    plot_paths=100
):
    """
    Monte Carlo path plot (2 panels: log-price and price).

    IMPORTANT:
    - Does NOT use recent_prices at all.
    - Only uses simulated paths, so x and y ALWAYS match.
    """

    sim_len = S_paths.shape[1]
    t = np.arange(sim_len)

    num_paths_to_plot = min(plot_paths, S_paths.shape[0])
    idx = np.random.choice(S_paths.shape[0], size=num_paths_to_plot, replace=False)

    fig, axes = plt.subplots(2, 1, figsize=(12, 8))

    # Panel 1: log paths
    for i in idx:
        axes[0].plot(t, np.log(S_paths[i]), alpha=0.6)

    axes[0].set_title('log paths')
    axes[0].set_xlabel('Time (days)')
    axes[0].set_ylabel('log price (ln USD)')

    # Panel 2: price paths
    for i in idx:
        axes[1].plot(t, S_paths[i], alpha=0.6)

    axes[1].set_title('paths')
    axes[1].set_xlabel('Time (days)')
    axes[1].set_ylabel('price (USD)')

    fig.suptitle(
        f'{ticker} risk-neutral MC simulated paths; horizon = {sim_len} days',
        fontsize=13
    )

    caption = (
        f"Ticker: {ticker}. MC sims: M={M}. Plotted sample paths: {num_paths_to_plot}. "
        f"Horizon: {sim_len} days. Estimated daily sigma: {sigma_hat:.6f}. "
        f"Risk-free r={annual_r:.3%}."
    )
    fig.text(0.5, 0.01, caption, ha='center', fontsize=9)
    fig.tight_layout(rect=[0, 0.03, 1, 0.95])

    return fig
