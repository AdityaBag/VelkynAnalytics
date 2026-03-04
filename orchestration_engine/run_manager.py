import os
from datetime import datetime


def create_run_folder(base_dir: str = "./results/batches"):
    """
    Create a timestamped batch folder for a single full run.

    Returns
    -------
    run_id : str
        Identifier like 'batch_2026-02-16_19-20-05'.
    run_path : str
        Full path to the created batch folder.
    """
    timestamp = datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
    run_id = f"batch_{timestamp}"
    run_path = os.path.join(base_dir, run_id)

    os.makedirs(run_path, exist_ok=True)
    return run_id, run_path
