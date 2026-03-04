import pandas as pd
import os

def export_simulation_data(outdir, filename, data_dict):
    """
    Save simulation results as a CSV file.

    Parameters
    ----------
    outdir : str
        Directory where the CSV will be saved.
    filename : str
        Name of the CSV file (without extension).
    data_dict : dict
        Dictionary containing simulation metrics.
    """
    os.makedirs(outdir, exist_ok=True)
    filepath = os.path.join(outdir, f"{filename}.csv")

    df = pd.DataFrame([data_dict])
    df.to_csv(filepath, index=False)

    print(f"  [DATA SAVED] {filepath}")
