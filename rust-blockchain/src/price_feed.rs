use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::{Arc, RwLock};
use std::time::Duration;
use tokio::sync::broadcast;

// ─────────────────────────────────────────────────────────────
// COMMODITY PRICE FEED — pulls real-time futures prices from
// Yahoo Finance's public chart endpoint for commodities only.
//
// Gold/Silver/Oil are seeded by default, but admins can register
// additional custom commodities at runtime (see `add_commodity`).
// The tracked set is dynamic rather than a fixed const list so the
// background refresh loop automatically picks up new ones.
// ─────────────────────────────────────────────────────────────

/// Everything an admin must specify to register a new tradable commodity.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CommodityConfig {
    /// Internal trading symbol used in trades, e.g. "xCOFFEE"
    pub symbol: String,
    /// Yahoo Finance chart symbol used to fetch live prices, e.g. "KC=F"
    pub yahoo_symbol: String,
    /// Human-readable contract name, e.g. "Robusta Coffee Futures"
    pub contract_name: String,
    /// Minimum tradable quantity, in `unit` below
    pub min_quantity: f64,
    /// Unit the quantity/min_quantity are denominated in — e.g. "lb", "kg", "oz",
    /// or any other free-form unit string the admin wants to use
    pub unit: String,
    /// Currency the price is denominated in, e.g. "USD"
    pub currency: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CommodityPrice {
    pub symbol: String,
    pub yahoo_symbol: String,
    pub contract_name: String,
    pub min_quantity: f64,
    pub unit: String,
    pub currency: String,
    pub price: f64,
    pub updated_at: i64,
    /// false until the first successful live fetch completes
    pub live: bool,
}

#[derive(Deserialize)]
struct YahooChartResponse {
    chart: YahooChart,
}

#[derive(Deserialize)]
struct YahooChart {
    result: Option<Vec<YahooResult>>,
}

#[derive(Deserialize)]
struct YahooResult {
    meta: YahooMeta,
}

#[derive(Deserialize)]
struct YahooMeta {
    #[serde(rename = "regularMarketPrice")]
    regular_market_price: Option<f64>,
}

pub struct PriceFeed {
    prices: RwLock<HashMap<String, CommodityPrice>>,
    client: reqwest::Client,
    /// Subscribers (e.g. the /markets/stream SSE endpoint) get pushed
    /// a copy of every price update as soon as it lands.
    pub updates: broadcast::Sender<CommodityPrice>,
}

impl PriceFeed {
    /// Seeds the default commodities (Gold, Silver, Oil) with sane fallback
    /// prices so trading/mining still works even before the first
    /// successful Yahoo Finance fetch completes.
    pub fn new() -> Arc<Self> {
        let (tx, _rx) = broadcast::channel(64);
        let now = chrono::Utc::now().timestamp();

        let seed = [
            ("xGOLD", "GC=F", "Gold Futures", 1.0, "oz", "USD", 2340.0),
            ("xSILVER", "SI=F", "Silver Futures", 1.0, "oz", "USD", 28.0),
            ("xOIL", "CL=F", "WTI Crude Oil Futures", 1.0, "bbl", "USD", 83.0),
        ];

        let mut initial = HashMap::new();
        for (symbol, yahoo_symbol, contract_name, min_quantity, unit, currency, price) in seed {
            initial.insert(
                symbol.to_string(),
                CommodityPrice {
                    symbol: symbol.to_string(),
                    yahoo_symbol: yahoo_symbol.to_string(),
                    contract_name: contract_name.to_string(),
                    min_quantity,
                    unit: unit.to_string(),
                    currency: currency.to_string(),
                    price,
                    updated_at: now,
                    live: false,
                },
            );
        }

        Arc::new(Self {
            prices: RwLock::new(initial),
            client: reqwest::Client::new(),
            updates: tx,
        })
    }

    /// Registers a new tradable commodity. Fails if the symbol is already
    /// tracked (including the built-in Gold/Silver/Oil symbols) — this only
    /// adds new commodities, it doesn't redefine existing ones.
    pub fn add_commodity(&self, cfg: CommodityConfig) -> Result<(), String> {
        let mut prices = self.prices.write().unwrap();

        if prices.contains_key(&cfg.symbol) {
            return Err(format!("Commodity '{}' already exists", cfg.symbol));
        }

        let now = chrono::Utc::now().timestamp();

        prices.insert(
            cfg.symbol.clone(),
            CommodityPrice {
                symbol: cfg.symbol,
                yahoo_symbol: cfg.yahoo_symbol,
                contract_name: cfg.contract_name,
                min_quantity: cfg.min_quantity,
                unit: cfg.unit,
                currency: cfg.currency,
                price: 0.0,
                updated_at: now,
                live: false,
            },
        );

        Ok(())
    }

    /// Returns the config (name/min quantity/unit/currency/yahoo symbol) for
    /// every tracked commodity — used to persist custom ones across restarts.
    pub fn list_configs(&self) -> Vec<CommodityConfig> {
        self.prices
            .read()
            .unwrap()
            .values()
            .map(|p| CommodityConfig {
                symbol: p.symbol.clone(),
                yahoo_symbol: p.yahoo_symbol.clone(),
                contract_name: p.contract_name.clone(),
                min_quantity: p.min_quantity,
                unit: p.unit.clone(),
                currency: p.currency.clone(),
            })
            .collect()
    }

    /// Synchronous lookup used by contract execution / block mining.
    /// Falls back to 0.0 for anything that isn't a tracked commodity.
    pub fn get(&self, symbol: &str) -> f64 {
        self.prices
            .read()
            .unwrap()
            .get(symbol)
            .map(|p| p.price)
            .unwrap_or(0.0)
    }

    /// The minimum tradable quantity for a commodity, if it's tracked at all.
    pub fn min_quantity(&self, symbol: &str) -> Option<f64> {
        self.prices.read().unwrap().get(symbol).map(|p| p.min_quantity)
    }

    pub fn snapshot(&self) -> Vec<CommodityPrice> {
        let mut v: Vec<_> = self.prices.read().unwrap().values().cloned().collect();
        v.sort_by(|a, b| a.symbol.cmp(&b.symbol));
        v
    }

    async fn fetch_one(&self, yahoo_symbol: &str) -> Result<f64, String> {
        let url = format!(
            "https://query1.finance.yahoo.com/v8/finance/chart/{}",
            yahoo_symbol
        );

        let resp = self
            .client
            .get(&url)
            .header("User-Agent", "Mozilla/5.0")
            .send()
            .await
            .map_err(|e| e.to_string())?;

        let parsed: YahooChartResponse = resp.json().await.map_err(|e| e.to_string())?;

        parsed
            .chart
            .result
            .and_then(|r| r.into_iter().next())
            .and_then(|r| r.meta.regular_market_price)
            .ok_or_else(|| "no price in Yahoo response".to_string())
    }

    /// Fetches every tracked commodity once (built-in and custom alike) and
    /// updates shared state. A failed fetch for one symbol just keeps its
    /// last known price.
    pub async fn refresh_all(&self) {
        // Snapshot (symbol, yahoo_symbol) pairs first so we're not holding
        // the lock across the network calls below.
        let targets: Vec<(String, String)> = self
            .prices
            .read()
            .unwrap()
            .values()
            .map(|p| (p.symbol.clone(), p.yahoo_symbol.clone()))
            .collect();

        let now = chrono::Utc::now().timestamp();

        for (symbol, yahoo_symbol) in targets {
            match self.fetch_one(&yahoo_symbol).await {
                Ok(price) => {
                    let mut prices = self.prices.write().unwrap();

                    if let Some(entry) = prices.get_mut(&symbol) {
                        entry.price = price;
                        entry.updated_at = now;
                        entry.live = true;

                        // Ignore send errors — just means nobody is subscribed right now.
                        let _ = self.updates.send(entry.clone());
                    }
                }
                Err(e) => {
                    eprintln!(
                        "⚠️  price feed: failed to fetch {symbol} ({yahoo_symbol}): {e}"
                    );
                }
            }
        }
    }

    /// Spawns a background task that keeps prices fresh on an interval.
    pub fn spawn_refresh_loop(self: Arc<Self>, every: Duration) {
        tokio::spawn(async move {
            let mut ticker = tokio::time::interval(every);
            loop {
                ticker.tick().await;
                self.refresh_all().await;
            }
        });
    }
}
