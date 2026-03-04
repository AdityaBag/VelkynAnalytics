"""
main_old.py

Entry point for general analysis (single ticker or batch) using modular engines.
"""
import argparse

from analysis.single_ticker import analyze_ticker, batch_analyze


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Unified Monte Carlo and Black-Scholes option analysis")
    parser.add_argument("--ticker", type=str, default=None, help="Single ticker analysis (e.g., NVDA)")
    parser.add_argument("--batch", action="store_true", help="Run batch analysis on default tickers")
    parser.add_argument("--tickers", nargs='+', default=['NVDA', 'TSLA', 'PLTR', 'AI', 'UPST'], 
                       help="Tickers for batch analysis")
    parser.add_argument("--period", type=str, default='1y', help="Data period (e.g., '1y')")
    parser.add_argument("--M", type=int, default=20000, help="Number of MC simulations")
    parser.add_argument("--n", type=int, default=252, help="Horizon in trading days")
    parser.add_argument("--r", type=float, default=0.01, help="Annual risk-free rate")
    parser.add_argument("--show", action="store_true", help="Show plots (interactive)")
    parser.add_argument("--outdir", default='./results/plots', help="Output directory for plots")
    
    args = parser.parse_args()
    
    if args.ticker:
        analyze_ticker(args.ticker, period=args.period, M=args.M, n=args.n, 
                      r=args.r, show=args.show, outdir=args.outdir)
    elif args.batch:
        batch_analyze(args.tickers, period=args.period, M=args.M, n=args.n, 
                     r=args.r, outdir=args.outdir, show=args.show)
    else:
        print("Please specify --ticker SYMBOL or use --batch for default tickers")
