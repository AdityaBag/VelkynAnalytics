import pandas as pd

def ticks_to_dataframe(tick_list):
    if len(tick_list) == 0:
        return pd.DataFrame(columns=["time", "price"])

    df = pd.DataFrame(tick_list)

    # Ensure correct types
    df["time"] = pd.to_datetime(df["timestamp"], unit="ms")
    df["price"] = df["price"].astype(float)

    return df[["time", "price"]]


def prepare_for_plot(tick_list, max_points=3000):
    df = ticks_to_dataframe(tick_list)

    if df.empty:
        return df

    # Sort raw ticks by time
    df = df.sort_values("time")

    # Keep last N ticks for performance
    if len(df) > max_points:
        df = df.tail(max_points)

    return df

