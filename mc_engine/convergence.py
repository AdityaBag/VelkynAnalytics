import numpy as np
import matplotlib.pyplot as plt


def plot_convergence(ticker, S_paths, K, r, T, M, option_type='call'):
    """Plot MC convergence as function of number of simulations."""
    fig, ax = plt.subplots(figsize=(10, 6))

    S_terminal = S_paths[:, -1]
    if option_type == 'call':
        payoffs = np.maximum(S_terminal - K, 0.0)
    else:
        payoffs = np.maximum(K - S_terminal, 0.0)

    discount = np.exp(-r * T)
    cumulative_payoff = np.cumsum(payoffs)
    m_vals = np.arange(1, len(payoffs) + 1)
    mc_prices = discount * cumulative_payoff / m_vals

    ax.plot(m_vals, mc_prices, linewidth=1.5, label='MC estimate')
    ax.axhline(y=mc_prices[-1], color='r', linestyle='--', label=f'Final estimate: {mc_prices[-1]:.4f}')
    ax.set_xlabel('Number of simulations (M)')
    ax.set_ylabel(f'{option_type.capitalize()} price')
    ax.set_title(f'{ticker} - MC Convergence (K={K:.0f})')
    ax.legend()
    ax.grid(True, alpha=0.3)

    return fig
