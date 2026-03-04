import math


def binomial_option_price(
    S0: float,
    K: float,
    T: float,
    r: float,
    sigma: float,
    N: int,
    option_type: str = "call",
    american: bool = False,
):
    """
    Cox-Ross-Rubinstein (CRR) binomial tree option pricer.

    Parameters
    ----------
    S0 : float
        Spot price
    K : float
        Strike price
    T : float
        Time to maturity (in years)
    r : float
        Risk-free rate (annual, continuously compounded)
    sigma : float
        Volatility (annual)
    N : int
        Number of time steps
    option_type : str
        "call" or "put"
    american : bool
        If True, price American option; otherwise European.

    Returns
    -------
    float
        Option price.
    """

    dt = T / N
    # CRR parameters
    u = math.exp(sigma * math.sqrt(dt))
    d = 1.0 / u
    disc = math.exp(-r * dt)
    p = (math.exp(r * dt) - d) / (u - d)

    if not (0.0 <= p <= 1.0):
        raise ValueError(f"Arbitrage condition violated: p={p:.4f}")

    # Terminal stock prices
    ST = [S0 * (u ** j) * (d ** (N - j)) for j in range(N + 1)]

    # Terminal option values
    if option_type == "call":
        values = [max(s - K, 0.0) for s in ST]
    elif option_type == "put":
        values = [max(K - s, 0.0) for s in ST]
    else:
        raise ValueError("option_type must be 'call' or 'put'")

    # Backward induction
    for step in range(N - 1, -1, -1):
        new_values = []
        for j in range(step + 1):
            hold = disc * (p * values[j + 1] + (1 - p) * values[j])

            if american:
                # Early exercise value
                S_ij = S0 * (u ** j) * (d ** (step - j))
                if option_type == "call":
                    exercise = max(S_ij - K, 0.0)
                else:
                    exercise = max(K - S_ij, 0.0)
                new_values.append(max(hold, exercise))
            else:
                new_values.append(hold)

        values = new_values

    return values[0]
