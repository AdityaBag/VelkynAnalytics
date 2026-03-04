import json
import os
from datetime import datetime
import pandas as pd

LEDGER_PATH = "./results/run_history.json"


def update_ledger(run_id: str, tickers, rates, results):
    """
    Append a summary entry for this run into a global run_history.json ledger.
    Also export a flattened CSV with one row per simulation result.
    """

    # Create the metadata entry for this run
    entry = {
        "run_id": run_id,
        "timestamp": datetime.now().isoformat(),
        "num_tickers": len(tickers),
        "num_rates": len(rates),
        "total_jobs": len(tickers) * len(rates),
        "results": results,   # ⭐ NEW: store simulation results
    }

    # Load existing ledger or create new
    if os.path.exists(LEDGER_PATH):
        with open(LEDGER_PATH, "r") as f:
            try:
                ledger = json.load(f)
            except json.JSONDecodeError:
                ledger = []
    else:
        ledger = []

    # Append this run
    ledger.append(entry)

    # Ensure directory exists
    os.makedirs(os.path.dirname(LEDGER_PATH), exist_ok=True)

    # Write updated ledger (JSON)
    with open(LEDGER_PATH, "w") as f:
        json.dump(ledger, f, indent=4)

    # ⭐ NEW: Export flattened CSV of all simulation results
    try:
        # Flatten all results across all runs
        flat_rows = []
        for run in ledger:
            run_id = run["run_id"]
            timestamp = run["timestamp"]

            for res in run.get("results", []):
                row = res.copy()
                row["run_id"] = run_id
                row["timestamp"] = timestamp
                flat_rows.append(row)

        df = pd.DataFrame(flat_rows)

        # CSV version
        df.to_csv("./results/run_history.csv", index=False)

    except Exception as e:
        print(f"Warning: Could not export ledger to CSV: {e}")
