import numpy as np
import matplotlib.pyplot as plt
from bs_engine.pricing import bs_call_price


def plot_volatility_smile(ticker, S0, T, r, sigma_hat, option_type='call'):
    """Illustrate volatility smile concept."""
    strikes = np.linspace(S0 * 0.8, S0 * 1.2, 30)

    # For illustration: assume implied vol increases away from ATM (smile)
    moneyness = strikes / S0
    implied_vol = sigma_hat * (1.0 + 0.3 * (moneyness - 1.0) ** 2)

    # Compute prices with implied vol
    prices = np.array([bs_call_price(S0, K, T, r, iv) for K, iv in zip(strikes, implied_vol)])

    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(12, 5))

    ax1.plot(strikes / S0, implied_vol, linewidth=2, marker='o', markersize=4)
    ax1.axvline(x=1.0, color='r', linestyle='--', alpha=0.5, label='ATM')
    ax1.set_xlabel('Moneyness (K/S0)')
    ax1.set_ylabel('Implied Volatility')
    ax1.set_title('Volatility Smile')
    ax1.legend()
    ax1.grid(True, alpha=0.3)

    ax2.plot(strikes, prices, linewidth=2, marker='o', markersize=4, color='orange')
    ax2.axvline(x=S0, color='r', linestyle='--', alpha=0.5, label='ATM')
    ax2.set_xlabel('Strike Price (K)')
    ax2.set_ylabel('Call Price')
    ax2.set_title(f'{ticker} Call Price Curve')
    ax2.legend()
    ax2.grid(True, alpha=0.3)

    fig.suptitle(f'{ticker} - Volatility Smile (Illustration)', fontsize=14)
    fig.tight_layout()

    return fig
