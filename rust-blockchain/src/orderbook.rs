use serde::{Deserialize, Serialize};

// ─────────────────────────────────────────────────────────────
// ORDER BOOK — a plain price/time-priority limit order matching
// engine. This module only matches orders against each other; it
// knows nothing about wallets, holdings, or fees — that settlement
// happens in main.rs after a match is found, using the Fill records
// this produces. Keeping it pure makes the matching logic easy to
// reason about (and to keep deterministic across nodes replaying
// the same transactions during P2P sync).
// ─────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum OrderSide {
    Bid,
    Ask,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Order {
    pub id: String,
    pub asset: String,
    pub side: OrderSide,
    /// Limit price — the worst price this order is willing to trade at.
    pub price: f64,
    /// Original quantity requested.
    pub quantity: f64,
    /// Quantity still unfilled. Starts equal to `quantity`.
    pub remaining: f64,
    pub timestamp: i64,
    /// "OPEN" | "PARTIAL" | "FILLED" | "CANCELLED"
    pub status: String,
}

/// A single match between a resting order and an incoming one. The fill
/// price is always the RESTING order's price (the maker sets the price,
/// standard price/time priority convention) — but both sides' own limit
/// prices are included so settlement can work out any refund owed to a
/// bidder whose limit was better than the price they actually paid.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Fill {
    pub asset: String,
    pub price: f64,
    pub quantity: f64,
    pub timestamp: i64,
    pub bid_order_id: String,
    pub bid_price: f64,
    pub ask_order_id: String,
    pub ask_price: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct OrderBook {
    /// Resting buy orders, best (highest) price first.
    pub bids: Vec<Order>,
    /// Resting sell orders, best (lowest) price first.
    pub asks: Vec<Order>,
}

impl OrderBook {
    /// Matches a new order against the opposite side of the book. Any
    /// unfilled remainder is left resting in the book in price/time order.
    /// Returns every fill produced, in the order they happened.
    pub fn submit(&mut self, mut order: Order) -> Vec<Fill> {
        let mut fills = vec![];

        match order.side {
            OrderSide::Bid => {
                while order.remaining > 1e-9 {
                    let is_match = match self.asks.first() {
                        Some(best) => best.price <= order.price,
                        None => false,
                    };

                    if !is_match {
                        break;
                    }

                    let best = &mut self.asks[0];
                    let fill_qty = order.remaining.min(best.remaining);

                    fills.push(Fill {
                        asset: order.asset.clone(),
                        price: best.price,
                        quantity: fill_qty,
                        timestamp: order.timestamp,
                        bid_order_id: order.id.clone(),
                        bid_price: order.price,
                        ask_order_id: best.id.clone(),
                        ask_price: best.price,
                    });

                    order.remaining -= fill_qty;
                    best.remaining -= fill_qty;

                    if best.remaining <= 1e-9 {
                        best.status = "FILLED".to_string();
                        self.asks.remove(0);
                    } else {
                        best.status = "PARTIAL".to_string();
                    }
                }

                if order.remaining > 1e-9 {
                    order.status = if order.remaining < order.quantity {
                        "PARTIAL".to_string()
                    } else {
                        "OPEN".to_string()
                    };
                    self.insert_bid(order);
                }
            }

            OrderSide::Ask => {
                while order.remaining > 1e-9 {
                    let is_match = match self.bids.first() {
                        Some(best) => best.price >= order.price,
                        None => false,
                    };

                    if !is_match {
                        break;
                    }

                    let best = &mut self.bids[0];
                    let fill_qty = order.remaining.min(best.remaining);

                    fills.push(Fill {
                        asset: order.asset.clone(),
                        price: best.price,
                        quantity: fill_qty,
                        timestamp: order.timestamp,
                        bid_order_id: best.id.clone(),
                        bid_price: best.price,
                        ask_order_id: order.id.clone(),
                        ask_price: order.price,
                    });

                    order.remaining -= fill_qty;
                    best.remaining -= fill_qty;

                    if best.remaining <= 1e-9 {
                        best.status = "FILLED".to_string();
                        self.bids.remove(0);
                    } else {
                        best.status = "PARTIAL".to_string();
                    }
                }

                if order.remaining > 1e-9 {
                    order.status = if order.remaining < order.quantity {
                        "PARTIAL".to_string()
                    } else {
                        "OPEN".to_string()
                    };
                    self.insert_ask(order);
                }
            }
        }

        fills
    }

    /// Cancels an order by id (either side). Returns the order as it stood
    /// right before cancellation (so the caller can refund whatever
    /// remaining quantity/cash was reserved for it), or None if not found.
    pub fn cancel(&mut self, order_id: &str) -> Option<Order> {
        if let Some(pos) = self.bids.iter().position(|o| o.id == order_id) {
            let mut order = self.bids.remove(pos);
            order.status = "CANCELLED".to_string();
            return Some(order);
        }

        if let Some(pos) = self.asks.iter().position(|o| o.id == order_id) {
            let mut order = self.asks.remove(pos);
            order.status = "CANCELLED".to_string();
            return Some(order);
        }

        None
    }

    fn insert_bid(&mut self, order: Order) {
        // Highest price first; ties broken by earlier timestamp (time priority).
        let pos = self
            .bids
            .iter()
            .position(|o| o.price < order.price || (o.price == order.price && o.timestamp > order.timestamp))
            .unwrap_or(self.bids.len());
        self.bids.insert(pos, order);
    }

    fn insert_ask(&mut self, order: Order) {
        // Lowest price first; ties broken by earlier timestamp.
        let pos = self
            .asks
            .iter()
            .position(|o| o.price > order.price || (o.price == order.price && o.timestamp > order.timestamp))
            .unwrap_or(self.asks.len());
        self.asks.insert(pos, order);
    }
}
