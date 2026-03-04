"""
run_all_rates.py

Entry point for multi-rate scenario analysis.
"""

from analysis.multi_rate import batch_analyze_with_rate

# Correct folder name: orchestration_engine
from orchestration_engine.run_manager import create_run_folder
from orchestration_engine.metadata import write_metadata
from orchestration_engine.ledger import update_ledger


def main():
    tickers = ['NVDA', 'TSLA', 'PLTR', 'AI', 'UPST']
    M = 20000
    n = 252
    period = '1y'

    rate_scenarios = [
        (0.01, 'r_0.01_educational'),
        (0.045, 'r_0.045_1YTreasury'),
        (0.05, 'r_0.05_SOFR'),
        (0.05, 'r_0.05_FedFundsRate'),
    ]

    print("=" * 70)
    print("MONTE CARLO OPTION ANALYSIS - MULTIPLE INTEREST RATE SCENARIOS")
    print("=" * 70)
    print(f"Tickers: {', '.join(tickers)}")
    print(f"Period: {period}")
    print(f"Simulations: M={M}, Horizon={n} days")
    print("=" * 70)

    run_id, run_path = create_run_folder()

    write_metadata(
        run_path=run_path,
        tickers=tickers,
        rates=[r for (r, _) in rate_scenarios],
        M=M,
        n=n,
        seed=12345,
    )

    all_results = []

    for r_value, r_label in rate_scenarios:
        rate_results = batch_analyze_with_rate(
            r_value, r_label, tickers,
            period=period, M=M, n=n,
            base_outdir=run_path
        )
        all_results.extend(rate_results)

    update_ledger(
        run_id=run_id,
        tickers=tickers,
        rates=[r for (r, _) in rate_scenarios],
        results=all_results
    )

    print("\n" + "=" * 70)
    print("ALL SIMULATIONS COMPLETE!")
    print(f"Batch saved to: {run_path}")
    print("=" * 70)


if __name__ == "__main__":
    main()
