import numpy as np
import matplotlib.pyplot as plt
from scipy.stats import gaussian_kde


def compute_terminal_distribution(S_paths):
    """
    Extract terminal prices and compute summary statistics.

    Parameters
    ----------
    S_paths : ndarray, shape (M, n)
        Simulated price paths.

    Returns
    -------
    dict
        {
            "S_T": ndarray of terminal prices,
            "mean": float,
            "std": float,
            "min": float,
            "max": float,
            "p05": float,
            "p50": float,
            "p95": float
        }
    """

    S_T = S_paths[:, -1]

    return {
        "S_T": S_T,
        "mean": float(np.mean(S_T)),
        "std": float(np.std(S_T)),
        "min": float(np.min(S_T)),
        "max": float(np.max(S_T)),
        "p05": float(np.percentile(S_T, 5)),
        "p50": float(np.percentile(S_T, 50)),
        "p95": float(np.percentile(S_T, 95)),
    }


def plot_terminal_distribution(ticker, S_paths, bins=50):
    """
    Plot histogram + KDE of terminal prices.

    Parameters
    ----------
    ticker : str
        Asset ticker.
    S_paths : ndarray
        Simulated price paths.
    bins : int
        Number of histogram bins.

    Returns
    -------
    fig : matplotlib.figure.Figure
        The generated figure.
    """

    S_T = S_paths[:, -1]

    fig, ax = plt.subplots(figsize=(10, 6))

    # Histogram
    ax.hist(S_T, bins=bins, density=True, alpha=0.6, color='skyblue', label='Histogram')

    # KDE
    kde = gaussian_kde(S_T)
    x_vals = np.linspace(min(S_T), max(S_T), 300)
    ax.plot(x_vals, kde(x_vals), color='darkblue', linewidth=2, label='KDE')

    # Labels
    ax.set_title(f"{ticker} - Terminal Price Distribution", fontsize=14)
    ax.set_xlabel("Terminal Price (S_T)")
    ax.set_ylabel("Density")
    ax.grid(True, alpha=0.3)
    ax.legend()

    return fig


def terminal_distribution_all(S_paths, ticker):
    """
    Compute stats + return figure in one call.

    Parameters
    ----------
    S_paths : ndarray
        Simulated price paths.
    ticker : str
        Asset ticker.

    Returns
    -------
    dict
        {
            "stats": summary statistics,
            "figure": matplotlib figure
        }
    """

    stats = compute_terminal_distribution(S_paths)
    fig = plot_terminal_distribution(ticker, S_paths)

    return {
        "stats": stats,
        "figure": fig
    }
