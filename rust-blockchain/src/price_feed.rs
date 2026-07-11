use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::{Arc, RwLock};
use std::time::Duration;
use tokio::sync::broadcast;

// ─────────────────────────────────────────────────────────────
// COMMODITY PRICE FEED — pulls real-time futures prices from
// Yahoo Finance's public chart endpoint for commodities only.
// ─────────────────────────────────────────────────────────────

/// (internal symbol, Yahoo Finance chart symbol)
/// Restricted to commodities on purpose — no equities/crypto/FX.
pub const COMMODITIES: &[(&str, &str)] = &[
    ("xGOLD", "GC=F"),   // Gold futures
    ("xSILVER", "SI=F"), // Silver futures
    ("xOIL", "CL=F"),    // WTI Crude Oil futures
];

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CommodityPrice {
    pub symbol: String,
    pub yahoo_symbol: String,
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
    /// Seeds sane fallback prices so trading/mining still works even
    /// before the first successful Yahoo Finance fetch completes.
    pub fn new() -> Arc<Self> {
        let (tx, _rx) = broadcast::channel(64);
        let now = chrono::Utc::now().timestamp();

        let seed = [
            ("xGOLD", "GC=F", 2340.0),
            ("xSILVER", "SI=F", 28.0),
            ("xOIL", "CL=F", 83.0),
        ];

        let mut initial = HashMap::new();
        for (symbol, yahoo_symbol, price) in seed {
            initial.insert(
                symbol.to_string(),
                CommodityPrice {
                    symbol: symbol.to_string(),
                    yahoo_symbol: yahoo_symbol.to_string(),
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

    /// Fetches every tracked commodity once and updates shared state.
    /// A failed fetch for one symbol just keeps its last known price.
    pub async fn refresh_all(&self) {
        let now = chrono::Utc::now().timestamp();

        for (symbol, yahoo_symbol) in COMMODITIES {
            match self.fetch_one(yahoo_symbol).await {
                Ok(price) => {
                    let entry = CommodityPrice {
                        symbol: symbol.to_string(),
                        yahoo_symbol: yahoo_symbol.to_string(),
                        price,
                        updated_at: now,
                        live: true,
                    };

                    self.prices
                        .write()
                        .unwrap()
                        .insert(symbol.to_string(), entry.clone());

                    // Ignore send errors — just means nobody is subscribed right now.
                    let _ = self.updates.send(entry);
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
