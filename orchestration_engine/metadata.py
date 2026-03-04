import json
import platform
from datetime import datetime


def write_metadata(run_path: str,
                   tickers,
                   rates,
                   M: int,
                   n: int,
                   seed: int):
    """
    Write a metadata.json file into the run folder describing this batch run.
    """
    metadata = {
        "timestamp": datetime.now().isoformat(),
        "tickers": list(tickers),
        "rates": list(rates),
        "M": M,
        "n": n,
        "seed": seed,
        "system": {
            "python_version": platform.python_version(),
            "platform": platform.platform(),
        },
    }

    out_path = f"{run_path}/metadata.json"
    with open(out_path, "w") as f:
        json.dump(metadata, f, indent=4)
