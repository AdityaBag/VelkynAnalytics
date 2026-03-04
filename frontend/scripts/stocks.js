const STOCK_CATALOG = [
    { ticker: "AAPL", market: "NASDAQ", spot: 185 },
    { ticker: "MSFT", market: "NASDAQ", spot: 420 },
    { ticker: "GOOGL", market: "NASDAQ", spot: 175 },
    { ticker: "AMZN", market: "NASDAQ", spot: 180 },
    { ticker: "NVDA", market: "NASDAQ", spot: 130 },
    { ticker: "TSLA", market: "NASDAQ", spot: 210 },
    { ticker: "META", market: "NASDAQ", spot: 485 },
    { ticker: "PLTR", market: "NASDAQ", spot: 25 },
    { ticker: "AI", market: "NYSE", spot: 29 },
    { ticker: "UPST", market: "NASDAQ", spot: 28 },
    { ticker: "JPM", market: "NYSE", spot: 200 },
    { ticker: "BAC", market: "NYSE", spot: 38 },
];

function findStock(ticker) {
    return STOCK_CATALOG.find(s => s.ticker === ticker);
}

function initSingleStockSelector(selectId, marketId, spotId) {
    const select = document.getElementById(selectId);
    if (!select) return;

    select.innerHTML = STOCK_CATALOG
        .map(s => `<option value="${s.ticker}">${s.ticker}</option>`)
        .join("");

    const apply = () => {
        const stock = findStock(select.value);
        if (!stock) return;
        if (marketId) {
            const marketEl = document.getElementById(marketId);
            if (marketEl) marketEl.value = stock.market;
        }
        if (spotId) {
            const spotEl = document.getElementById(spotId);
            if (spotEl) {
                spotEl.value = String(stock.spot);
            }
        }
    };

    select.addEventListener("change", apply);
    select.value = "NVDA";
    apply();
}

function initBatchStockSelector(selectId) {
    const select = document.getElementById(selectId);
    if (!select) return;

    select.innerHTML = STOCK_CATALOG
        .map(s => `<option value="${s.ticker}">${s.ticker} (${s.market})</option>`)
        .join("");

    ["NVDA", "TSLA", "AAPL"].forEach(t => {
        const option = Array.from(select.options).find(o => o.value === t);
        if (option) option.selected = true;
    });
}

window.addEventListener("DOMContentLoaded", () => {
    initSingleStockSelector("mc-ticker", "mc-market", "mc-s0");
    initSingleStockSelector("bs-ticker", "bs-market", "bs-s");
    initSingleStockSelector("bsg-ticker", "bsg-market", "bsg-s");
    initSingleStockSelector("iv-ticker", "iv-market-name", "iv-s");
    initSingleStockSelector("beu-ticker", "beu-market", "beu-s");
    initSingleStockSelector("bam-ticker", "bam-market", "bam-s");
    initSingleStockSelector("bc-ticker", "bc-market", "bc-s");
    initSingleStockSelector("vs-ticker", "vs-market", "vs-s");
    initSingleStockSelector("vsurf-ticker", "vsurf-market", "vsurf-s");
    initSingleStockSelector("multi-ticker", "multi-market", null);
    initSingleStockSelector("sc-ticker", "sc-market", "sc-s");
    initBatchStockSelector("batch-tickers");
});
