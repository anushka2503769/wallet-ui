mod consensus;
use consensus::{ConsensusEngine, ProofOfWork, ProofOfStake, Validator};

mod price_feed;
use price_feed::{PriceFeed, CommodityConfig};

mod p2p;
use p2p::{PeerNetwork, PeerHandshake, BlockAnnouncement};

mod orderbook;
use orderbook::{OrderBook, Order, OrderSide, Fill};

use actix_web::{get, post, web, App, HttpRequest, HttpResponse, HttpServer, Responder};
use chrono::Utc;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::sync::{Arc, Mutex};
use std::path::Path;
use rocksdb::{DB, Options};
use std::any::Any;

use async_trait::async_trait;
use datafusion::arrow::array::{StringArray, UInt64Array, Int64Array, Float64Array};
use datafusion::arrow::datatypes::{DataType, Field, Schema, SchemaRef};
use datafusion::arrow::record_batch::RecordBatch;
use datafusion::datasource::TableProvider;
use datafusion::error::Result;
use datafusion::catalog::Session;
use datafusion::execution::SendableRecordBatchStream;
use datafusion::logical_expr::{Expr, TableType};
use datafusion::physical_expr::EquivalenceProperties;
use datafusion::physical_plan::{
    DisplayAs, DisplayFormatType, ExecutionMode, ExecutionPlan, Partitioning, PlanProperties,
};
use datafusion::physical_plan::stream::RecordBatchStreamAdapter;
use futures::stream;
use serde_json::Value;
use serde_json::json;

use datafusion::prelude::*;

use uuid::Uuid;
use actix_cors::Cors;
use std::collections::HashMap;

// ===================== DATA =====================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TradeData {
    pub asset: String,
    pub quantity: f64,
    pub direction: String,
    pub leverage: Option<f64>,
    /// Limit price for PLACE_BID / PLACE_ASK orders. Ignored by every
    /// other contract action.
    #[serde(default)]
    pub price: Option<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Transaction {
    pub id: String,
    #[serde(default)]
    pub user_id: Option<String>,
    pub contract_code: Option<String>,
    pub contract_action: Option<String>,
    #[serde(default)]
    pub trade: Option<TradeData>,
}

impl Transaction {
    pub fn new(code: Option<String>, action: Option<String>) -> Self {
        let mut tx = Transaction {
            id: Uuid::new_v4().to_string(),
            user_id: None,
            contract_code: code,
            contract_action: action,
            trade: None,
        };

        let mut hasher = Sha256::new();

        let payload = serde_json::to_string(&(
            &tx.contract_code,
            &tx.contract_action
        ))
        .unwrap();

        hasher.update(payload);
        tx.id = format!("{:x}", hasher.finalize());

        tx
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Block {
    pub index: u64,
    pub timestamp: i64,
    pub transactions: Vec<Transaction>,
    pub previous_hash: String,
    pub nonce: u64,
    pub hash: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Position {
    pub id: String,
    pub user_id: Option<String>,
    pub asset: String,
    pub position_type: String,
    pub direction: String,
    pub quantity: f64,
    pub leverage: Option<f64>,
    pub entry_price: Option<f64>,
    pub margin: Option<f64>,
    #[serde(default)]
    pub closed: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Wallet {
    pub user_id: Option<String>,
    pub balance: f64,
}

/// How much of each commodity the trader currently owns, built up by
/// filled buy orders from the trading queue (see orderbook.rs) and drawn
/// down by filled sell orders.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct Holdings {
    pub balances: HashMap<String, f64>,
}

/// Running total of transaction fees collected across every trade —
/// futures/perpetual/option opens and closes, and order book fills.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct Treasury {
    pub collected: f64,
}

#[derive(Deserialize)]
struct SqlRequest {
    sql: String,
}

// ===================== ENGINE =====================
#[derive(Debug)]
pub struct BlockchainEngine {
    pub mempool: Mutex<Vec<Transaction>>,
    pub db: DB,
}

impl BlockchainEngine {
    pub fn new<P: AsRef<Path>>(path: P) -> Self {
        let mut opts = Options::default();
        opts.create_if_missing(true);

        let db = DB::open(&opts, path).unwrap_or_else(|err| {
            panic!(
                "Failed to open RocksDB: {err}. If the local dev ledger is corrupted, delete rust-blockchain/ledger and rerun the node."
            )
        });

        let engine = Self {
            mempool: Mutex::new(vec![]),
            db,
        };

        // genesis block
        if engine.get_latest_block().is_none() {
            let genesis = Block {
                index: 0,
                timestamp: Utc::now().timestamp(),
                transactions: vec![],
                previous_hash: "0".repeat(64),
                nonce: 0,
                hash: "0".repeat(64),
            };

            engine.write_block(&genesis);
        }

        engine
    }

    pub fn get_state(&self, key: &str) -> i32 {
        let db_key = format!("state:{}", key);

        self.db
            .get(db_key.as_bytes())
            .ok()
            .flatten()
            .and_then(|v| String::from_utf8(v.to_vec()).ok())
            .and_then(|s| s.parse::<i32>().ok())
            .unwrap_or(0)
    }

    pub fn put_state(&self, key: &str, value: i32) {
        let db_key = format!("state:{}", key);

        self.db
            .put(db_key.as_bytes(), value.to_string().as_bytes())
            .expect("Failed to write state");
    }

    pub fn write_block(&self, block: &Block) {
        let key = format!("block_{}", block.index);
        let value = serde_json::to_vec(block).unwrap();

        self.db.put(key, value).unwrap();
        self.db
            .put("latest_index", block.index.to_string())
            .unwrap();
    }

    pub fn load_blocks(&self) -> Vec<Block> {
        let mut blocks: Vec<Block> = vec![];

        let iter = self.db.iterator(rocksdb::IteratorMode::Start);

        for item in iter {
            let (key, value) = item.unwrap();

            if key.starts_with(b"block_") {
                if let Ok(block) = serde_json::from_slice::<Block>(&value) {
                    blocks.push(block);
                }
            }
        }

        blocks.sort_by_key(|b| b.index);
        blocks
    }

    pub fn get_latest_block(&self) -> Option<Block> {
        let index = self.db.get("latest_index").ok()??;
        let index_str = String::from_utf8(index).ok()?;

        let block = self.db.get(format!("block_{}", index_str)).ok()??;
        serde_json::from_slice(&block).ok()
    }

    pub fn put_json_state<T: Serialize>(
        &self,
        key: &str,
        value: &T,
    ) {
        let db_key = format!("state:{}", key);

        let json =
            serde_json::to_vec(value).unwrap();

        self.db
            .put(db_key.as_bytes(), json)
            .unwrap();
    }

    pub fn get_json_state<T>(
        &self,
        key: &str,
    ) -> Option<T>
    where
        T: serde::de::DeserializeOwned,
    {
        let db_key = format!("state:{}", key);

        let value =
            self.db.get(db_key.as_bytes()).ok()??;

        serde_json::from_slice(&value).ok()
    }

    /// Wipes all blocks and derived contract state (wallets, holdings,
    /// positions, order books, treasury) so a better chain received from a
    /// peer can be replayed from genesis.
    /// Used only during P2P fork resolution — see `adopt_chain_if_better`.
    pub fn reset_chain_state(&self) {
        let iter = self.db.iterator(rocksdb::IteratorMode::Start);
        let mut keys_to_delete = vec![];

        for item in iter {
            let (key, _) = item.unwrap();

            if key.starts_with(b"block_")
                || key.starts_with(b"state:position_")
                || key.starts_with(b"state:orderbook_")
                || key.starts_with(b"state:fills_")
                || key.starts_with(b"state:wallet_")
                || key.starts_with(b"state:holdings_")
                || key.as_ref() == b"latest_index".as_slice()
                || key.as_ref() == b"state:treasury".as_slice()
            {
                keys_to_delete.push(key.to_vec());
            }
        }

        for key in keys_to_delete {
            let _ = self.db.delete(key);
        }

        // Per-user wallets/holdings are lazily recreated with the default
        // starting balance the first time each user is referenced again
        // (see wallet_key/holdings_key), so there's nothing to re-seed here
        // — just make sure the shared fee treasury starts clean too.
        self.put_json_state("treasury", &Treasury::default());
        self.put_json_state("wallet", &Wallet { balance: 100000.00, user_id: None });
    }

}

// =========== Blocks Table Provider for DataFusion ============

#[derive(Debug, Clone)]
pub struct BlocksTableProvider {
    schema: SchemaRef,
    engine: Arc<BlockchainEngine>,
}

impl BlocksTableProvider {
    pub fn new(engine: Arc<BlockchainEngine>) -> Self {
        let schema = Arc::new(Schema::new(vec![
            Field::new("index", DataType::UInt64, false),
            Field::new("timestamp", DataType::Int64, false),
            Field::new("tx_count", DataType::UInt64, false),
            Field::new("previous_hash", DataType::Utf8, false),
            Field::new("hash", DataType::Utf8, false),
            Field::new("nonce", DataType::UInt64, false),
        ]));

        Self { schema, engine }
    }
}

#[async_trait]
impl TableProvider for BlocksTableProvider {
    fn as_any(&self) -> &dyn Any { self }
    fn schema(&self) -> SchemaRef { self.schema.clone() }
    fn table_type(&self) -> TableType { TableType::Base }

    async fn scan(
        &self,
        _state: &dyn Session,
        _projection: Option<&Vec<usize>>,
        _filters: &[Expr],
        _limit: Option<usize>,
    ) -> Result<Arc<dyn ExecutionPlan>> {
        Ok(Arc::new(BlocksExecutionPlan::new(
            self.schema.clone(),
            self.engine.clone(),
        )))
    }
}

#[derive(Debug, Clone)]
pub struct BlocksExecutionPlan {
    schema: SchemaRef,
    engine: Arc<BlockchainEngine>,
    properties: PlanProperties,
}

impl BlocksExecutionPlan {
    pub fn new(schema: SchemaRef, engine: Arc<BlockchainEngine>) -> Self {
        let properties = PlanProperties::new(
            EquivalenceProperties::new(schema.clone()),
            Partitioning::UnknownPartitioning(1),
            ExecutionMode::Bounded,
        );
        Self { schema, engine, properties }
    }
}

impl DisplayAs for BlocksExecutionPlan {
    fn fmt_as(&self, _t: DisplayFormatType, f: &mut std::fmt::Formatter) -> std::fmt::Result {
        write!(f, "BlocksExecutionPlan")
    }
}

impl ExecutionPlan for BlocksExecutionPlan {
    fn as_any(&self) -> &dyn Any { self }
    fn schema(&self) -> SchemaRef { self.schema.clone() }
    fn properties(&self) -> &PlanProperties { &self.properties }
    fn children(&self) -> Vec<&Arc<dyn ExecutionPlan>> { vec![] }
    fn with_new_children(
        self: Arc<Self>,
        _children: Vec<Arc<dyn ExecutionPlan>>,
    ) -> Result<Arc<dyn ExecutionPlan>> {
        Ok(self)
    }

    fn name(&self) -> &str {
        "BlocksExecutionPlan"
    }

    fn execute(
        &self,
        _partition: usize,
        _context: Arc<datafusion::execution::TaskContext>,
    ) -> Result<SendableRecordBatchStream> {

        let blocks = self.engine.load_blocks();

        let indices: Vec<u64> = blocks.iter().map(|b| b.index).collect();
        let timestamps: Vec<i64> = blocks.iter().map(|b| b.timestamp).collect();
        let tx_counts: Vec<u64> = blocks.iter().map(|b| b.transactions.len() as u64).collect();
        let prev_hashes: Vec<&str> = blocks.iter().map(|b| b.previous_hash.as_str()).collect();
        let hashes: Vec<&str> = blocks.iter().map(|b| b.hash.as_str()).collect();
        let nonces: Vec<u64> = blocks.iter().map(|b| b.nonce).collect();

        let batch = RecordBatch::try_new(
            self.schema.clone(),
            vec![
                Arc::new(UInt64Array::from(indices)),
                Arc::new(Int64Array::from(timestamps)),
                Arc::new(UInt64Array::from(tx_counts)),
                Arc::new(StringArray::from(prev_hashes)),
                Arc::new(StringArray::from(hashes)),
                Arc::new(UInt64Array::from(nonces)),
            ],
        )?;

        Ok(Box::pin(RecordBatchStreamAdapter::new(
            self.schema.clone(),
            stream::iter(vec![Ok(batch)]),
        )))
    }
}

fn batches_to_json(batches: &[RecordBatch]) -> Value {
    let mut rows = vec![];

    for batch in batches {
        let schema = batch.schema();
        let cols = batch.columns();
        let num_rows = batch.num_rows();

        for row in 0..num_rows {
            let mut obj = serde_json::Map::new();

            for (i, field) in schema.fields().iter().enumerate() {
                let array = cols[i].as_ref();

                let value = match array.data_type() {
                    datafusion::arrow::datatypes::DataType::UInt64 => {
                        let arr = array
                            .as_any()
                            .downcast_ref::<datafusion::arrow::array::UInt64Array>()
                            .unwrap();
                        json!(arr.value(row))
                    }

                    datafusion::arrow::datatypes::DataType::Int64 => {
                        let arr = array
                            .as_any()
                            .downcast_ref::<datafusion::arrow::array::Int64Array>()
                            .unwrap();
                        json!(arr.value(row))
                    }

                    datafusion::arrow::datatypes::DataType::Utf8 => {
                        let arr = array
                            .as_any()
                            .downcast_ref::<StringArray>()
                            .unwrap();
                        json!(arr.value(row))
                    }

                    _ => Value::Null,
                };

                obj.insert(field.name().clone(), value);
            }

            rows.push(json!(obj));
        }
    }

    json!(rows)
}

// =========== Transactions Table Provider for DataFusion ============

#[derive(Debug, Clone)]
pub struct TransactionsTableProvider {
    schema: SchemaRef,
    engine: Arc<BlockchainEngine>,
}

impl TransactionsTableProvider {
    pub fn new(engine: Arc<BlockchainEngine>) -> Self {
        let schema = Arc::new(Schema::new(vec![
            Field::new("block_index", DataType::UInt64, false),
            Field::new("tx_id", DataType::Utf8, false),
            Field::new("user_id", DataType::Utf8, true),
            Field::new("contract_code", DataType::Utf8, true),
            Field::new("contract_action", DataType::Utf8, true),
            Field::new("asset", DataType::Utf8, true),
            Field::new("quantity", DataType::Float64, true),
            Field::new("direction", DataType::Utf8, true),
            Field::new("leverage", DataType::Float64, true),
        ]));

        Self { schema, engine }
    }
}

#[async_trait]
impl TableProvider for TransactionsTableProvider {
    fn as_any(&self) -> &dyn Any { self }
    fn schema(&self) -> SchemaRef { self.schema.clone() }
    fn table_type(&self) -> TableType { TableType::Base }

    async fn scan(
        &self,
        _state: &dyn Session,
        _projection: Option<&Vec<usize>>,
        _filters: &[Expr],
        _limit: Option<usize>,
    ) -> Result<Arc<dyn ExecutionPlan>> {
        Ok(Arc::new(TransactionsExecutionPlan::new(
            self.schema.clone(),
            self.engine.clone(),
        )))
    }
}
#[derive(Debug, Clone)]
pub struct TransactionsExecutionPlan {
    schema: SchemaRef,
    engine: Arc<BlockchainEngine>,
    properties: PlanProperties,
}

impl TransactionsExecutionPlan {
    pub fn new(schema: SchemaRef, engine: Arc<BlockchainEngine>) -> Self {
        let properties = PlanProperties::new(
            EquivalenceProperties::new(schema.clone()),
            Partitioning::UnknownPartitioning(1),
            ExecutionMode::Bounded,
        );
        Self { schema, engine, properties }
    }
}

impl DisplayAs for TransactionsExecutionPlan {
    fn fmt_as(&self, _t: DisplayFormatType, f: &mut std::fmt::Formatter) -> std::fmt::Result {
        write!(f, "TransactionsExecutionPlan")
    }
}

impl ExecutionPlan for TransactionsExecutionPlan {
    fn as_any(&self) -> &dyn Any { self }
    fn schema(&self) -> SchemaRef { self.schema.clone() }
    fn properties(&self) -> &PlanProperties { &self.properties }
    fn children(&self) -> Vec<&Arc<dyn ExecutionPlan>> { vec![] }
    fn with_new_children(
        self: Arc<Self>,
        _children: Vec<Arc<dyn ExecutionPlan>>,
    ) -> Result<Arc<dyn ExecutionPlan>> {
        Ok(self)
    }

    fn name(&self) -> &str { "TransactionsExecutionPlan" }

    fn execute(
        &self,
        _partition: usize,
        _context: Arc<datafusion::execution::TaskContext>,
    ) -> Result<SendableRecordBatchStream> {

        let blocks = self.engine.load_blocks();

        let mut block_indices = vec![];
        let mut tx_ids = vec![];
        let mut user_ids = vec![];
        let mut codes = vec![];
        let mut actions = vec![];

        let mut assets = vec![];
        let mut quantities = vec![];
        let mut directions = vec![];
        let mut leverages = vec![];

        for block in blocks {
            for tx in block.transactions {

                block_indices.push(block.index);
                tx_ids.push(tx.id.clone());
                user_ids.push(tx.user_id.clone());
                codes.push(tx.contract_code.clone());
                actions.push(tx.contract_action.clone());

                if let Some(trade) = tx.trade {

                    assets.push(Some(trade.asset));
                    quantities.push(Some(trade.quantity));
                    directions.push(Some(trade.direction));
                    leverages.push(trade.leverage);

                } else {

                    assets.push(None);
                    quantities.push(None);
                    directions.push(None);
                    leverages.push(None);
                }
            }
        }

        let batch = RecordBatch::try_new(
            self.schema.clone(),
            vec![
                Arc::new(UInt64Array::from(block_indices)),
                Arc::new(StringArray::from(tx_ids)),
                Arc::new(StringArray::from(user_ids)),
                Arc::new(StringArray::from(codes)),
                Arc::new(StringArray::from(actions)),
                Arc::new(StringArray::from(assets)),
                Arc::new(Float64Array::from(quantities)),
                Arc::new(StringArray::from(directions)),
                Arc::new(Float64Array::from(leverages))
            ],
        )?;

        Ok(Box::pin(RecordBatchStreamAdapter::new(
            self.schema.clone(),
            stream::iter(vec![Ok(batch)]),
        )))
    }
}

// ==================== Query Engine ====================

pub struct QueryEngine {
    pub ctx: SessionContext,
    pub engine: Arc<BlockchainEngine>,
}

impl QueryEngine {
    pub fn new(engine: Arc<BlockchainEngine>) -> Self {
        Self { ctx: SessionContext::new(), engine }
    }

    pub fn reload_blocks_table(&self) -> Result<()> {
        let provider = Arc::new(BlocksTableProvider::new(self.engine.clone()));

        let _ = self.ctx.deregister_table("blocks");
        self.ctx.register_table("blocks", provider)?;

        Ok(())
    }

    pub fn reload_transactions_table(&self) -> Result<()> {
        let provider = Arc::new(TransactionsTableProvider::new(self.engine.clone()));

        let _ = self.ctx.deregister_table("transactions");
        self.ctx.register_table("transactions", provider)?;

        Ok(())
    }


    pub async fn run_query(
        &self,
        sql: &str,
    ) -> Result<Vec<RecordBatch>>
    {
        let df = self.ctx.sql(sql).await?;

        df.collect().await
    }
}

// ===================== CONTRACT EXECUTION =====================
fn wallet_key(user_id: &str) -> String {
    format!("wallet_{}", user_id)
}

fn holdings_key(user_id: &str) -> String {
    format!("holdings_{}", user_id)
}

/// Deducts a trading fee (in basis points of the notional value) from an
/// already-loaded wallet and credits it to an already-loaded treasury.
/// Caller is responsible for persisting both afterward. Returns the fee
/// amount charged.
fn apply_fee(wallet: &mut Wallet, treasury: &mut Treasury, notional: f64, fee_bps: u64) -> f64 {
    let fee = notional * (fee_bps as f64) / 10_000.0;
    wallet.balance -= fee;
    treasury.collected += fee;
    fee
}

fn execute_contract(
    engine: &BlockchainEngine,
    price_feed: &PriceFeed,
    fee_bps: u64,
    tx: &Transaction,
) -> Result<(), &'static str> {

    match tx.contract_action.as_deref() {

        Some("OPEN_FUTURES") => {

            if let Some(trade) = &tx.trade {

                if let Some(min_qty) = price_feed.min_quantity(&trade.asset) {
                    if trade.quantity < min_qty {
                        return Err("Quantity below minimum for this commodity");
                    }
                }

                let entry_price =
                    get_market_price(price_feed, &trade.asset);
                
                let leverage =
                    trade.leverage.unwrap_or(1.0);

                let margin =
                    (trade.quantity * entry_price)
                    / leverage;

                let user_id = tx.user_id.as_ref().ok_or("User not logged in")?;
                let key = wallet_key(user_id);

                let mut user_wallet = engine
                    .get_json_state::<Wallet>(&key)
                    .unwrap_or(Wallet {
                        user_id: Some(user_id.to_string()),
                        balance: 100000.0,
                    });

                let mut treasury = engine
                    .get_json_state::<Treasury>("treasury")
                    .unwrap_or_default();

                let notional = trade.quantity * entry_price;
                apply_fee(&mut user_wallet, &mut treasury, notional, fee_bps);

                if user_wallet.balance < margin {

                    return Err("Insufficient balance");
                }

                user_wallet.balance -= margin;

                engine.put_json_state(
                    &key,
                    &user_wallet
                );

                engine.put_json_state(
                    "treasury",
                    &treasury
                );

                let position = Position {
                    id: tx.id.clone(),
                    user_id: tx.user_id.clone(),
                    asset: trade.asset.clone(),
                    position_type:
                        "FUTURES".to_string(),
                    direction:
                        trade.direction.clone(),
                    quantity:
                        trade.quantity,
                    leverage:
                        trade.leverage,
                    entry_price:
                        Some(entry_price),
                    margin:
                        Some(margin),
                    closed: false,
                };

                engine.put_json_state(
                    &format!(
                        "position_{}",
                        tx.id
                    ),
                    &position
                );
            }
        }

        Some("OPEN_PERPETUAL") => {

            if let Some(trade) = &tx.trade {

                if let Some(min_qty) = price_feed.min_quantity(&trade.asset) {
                    if trade.quantity < min_qty {
                        return Err("Quantity below minimum for this commodity");
                    }
                }
                
                let entry_price =
                    get_market_price(price_feed, &trade.asset);

                let leverage =
                    trade.leverage.unwrap_or(1.0);

                let margin =
                    (trade.quantity * entry_price)
                    / leverage;

                let user_id = tx.user_id.as_ref().ok_or("User not logged in")?;
                let key = wallet_key(user_id);

                let mut user_wallet = engine
                    .get_json_state::<Wallet>(&key)
                    .unwrap_or(Wallet {
                        user_id: Some(user_id.to_string()),
                        balance: 100000.0,
                    });

                let mut treasury = engine
                    .get_json_state::<Treasury>("treasury")
                    .unwrap_or_default();

                let notional = trade.quantity * entry_price;
                apply_fee(&mut user_wallet, &mut treasury, notional, fee_bps);

                if user_wallet.balance < margin {

                    return Err("Insufficient balance");
                }

                user_wallet.balance -= margin;

                engine.put_json_state(
                    &key,
                    &user_wallet
                );

                engine.put_json_state(
                    "treasury",
                    &treasury
                );

                let position = Position {
                    id: tx.id.clone(),
                    user_id: tx.user_id.clone(),
                    asset: trade.asset.clone(),
                    position_type:
                        "PERPETUAL".to_string(),
                    direction:
                        trade.direction.clone(),
                    quantity:
                        trade.quantity,
                    leverage:
                        trade.leverage,
                    entry_price:
                        Some(entry_price),
                    margin:
                        Some(margin),
                    closed: false,
                };

                engine.put_json_state(
                    &format!(
                        "position_{}",
                        tx.id
                    ),
                    &position
                );
            }
        }

        Some("BUY_OPTION") => {

            if let Some(trade) = &tx.trade {

                if let Some(min_qty) = price_feed.min_quantity(&trade.asset) {
                    if trade.quantity < min_qty {
                        return Err("Quantity below minimum for this commodity");
                    }
                }

                let entry_price =
                    get_market_price(price_feed, &trade.asset);

                let margin =
                    entry_price * trade.quantity;

                let user_id = tx.user_id.as_ref().ok_or("User not logged in")?;
                let key = wallet_key(user_id);

                let mut user_wallet = engine
                    .get_json_state::<Wallet>(&key)
                    .unwrap_or(Wallet {
                        user_id: Some(user_id.to_string()),
                        balance: 100000.0,
                    });

                let mut treasury = engine
                    .get_json_state::<Treasury>("treasury")
                    .unwrap_or_default();

                apply_fee(&mut user_wallet, &mut treasury, margin, fee_bps);

                if user_wallet.balance < margin {
                    return Err("Insufficient balance");
                }

                user_wallet.balance -= margin;

                engine.put_json_state(
                    &key,
                    &user_wallet
                );

                engine.put_json_state(
                    "treasury",
                    &treasury
                );

                let position = Position {
                    id: tx.id.clone(),
                    user_id: tx.user_id.clone(),
                    asset: trade.asset.clone(),
                    position_type:
                        "OPTION".to_string(),
                    direction:
                        trade.direction.clone(),
                    quantity:
                        trade.quantity,
                    leverage:
                        trade.leverage,
                    entry_price:
                        Some(entry_price),
                    margin:
                        Some(margin),
                    closed: false,
                };

                engine.put_json_state(
                    &format!(
                        "position_{}",
                        tx.id
                    ),
                    &position
                );
            }
        }

        Some("CLOSE_POSITION") => {

            if let Some(position_id) = &tx.contract_code {

                let key = format!("state:position_{}", position_id);

                if let Ok(Some(bytes)) = engine.db.get(key.as_bytes()) {

                    if let Ok(mut position) =
                        serde_json::from_slice::<Position>(&bytes)
                    {
                        if position.closed {
                            return Err("Position already closed");
                        }

                        // ==========================
                        // Calculate PnL
                        // ==========================

                        let current_price =
                            get_market_price(
                                price_feed,
                                &position.asset
                            );

                        let leverage =
                            position.leverage.unwrap_or(1.0);

                        let entry_price =
                            position.entry_price.unwrap_or(0.0);

                        let pnl =
                            match position.direction.as_str() {

                                "LONG" | "CALL" => {

                                    (current_price - entry_price)
                                        * position.quantity
                                        * leverage
                                }

                                "SHORT" | "PUT" => {

                                    (entry_price - current_price)
                                        * position.quantity
                                        * leverage
                                }

                                _ => 0.0,
                            };

                        // ==========================
                        // Update wallet
                        // ==========================

                        let owner = position.user_id
                            .as_ref()
                            .ok_or("User not logged in")?;

                        let key = wallet_key(owner);

                        let mut user_wallet = engine
                            .get_json_state::<Wallet>(&key)
                            .unwrap_or(Wallet {
                                user_id: Some(owner.to_string()),
                                balance: 100000.0,
                            });

                        let mut treasury = engine
                            .get_json_state::<Treasury>("treasury")
                            .unwrap_or_default();

                        let notional = position.quantity * current_price;
                        apply_fee(&mut user_wallet, &mut treasury, notional, fee_bps);

                        user_wallet.balance +=
                            position.margin.unwrap_or(0.0)
                            + pnl;

                        engine.put_json_state(
                            &key,
                            &user_wallet
                        );

                        engine.put_json_state(
                            "treasury",
                            &treasury
                        );

                        position.closed = true;

                        engine.put_json_state(
                            &format!("position_{}", position_id),
                            &position,
                        );
                    }
                }
            }
        }

        // ── Trading queue: limit orders that bid (buy) or ask (sell) a
        // commodity, matched price/time-priority against each other. See
        // orderbook.rs for the matching engine itself.
        Some(action @ ("PLACE_BID" | "PLACE_ASK")) => {

            let user_id = tx.user_id.as_ref().ok_or("User not logged in")?;

            let Some(trade) = &tx.trade else {
                return Err("PLACE_BID/PLACE_ASK requires a trade payload");
            };

            let side = if action == "PLACE_BID" { OrderSide::Bid } else { OrderSide::Ask };

            let price = match trade.price {
                Some(p) if p > 0.0 => p,
                _ => return Err("A positive limit price is required to place an order"),
            };

            if trade.quantity <= 0.0 {
                return Err("Order quantity must be greater than 0");
            }

            if let Some(min_qty) = price_feed.min_quantity(&trade.asset) {
                if trade.quantity < min_qty {
                    return Err("Quantity below minimum for this commodity");
                }
            }

            let mut book = engine
                .get_json_state::<OrderBook>(&format!("orderbook_{}", trade.asset))
                .unwrap_or_default();

            let order = Order {
                id: tx.id.clone(),
                asset: trade.asset.clone(),
                side,
                user_id: user_id.clone(),
                price,
                quantity: trade.quantity,
                remaining: trade.quantity,
                timestamp: Utc::now().timestamp(),
                status: "OPEN".to_string(),
            };

            // Reserve whatever this order commits, up front — cash for a
            // bid, the commodity itself for an ask — so it can't be spent
            // twice across multiple simultaneously open orders from the
            // same account.
            match side {
                OrderSide::Bid => {
                    let reserve = price * trade.quantity;
                    let key = wallet_key(user_id);

                    let mut user_wallet = engine
                        .get_json_state::<Wallet>(&key)
                        .unwrap_or(Wallet { user_id: Some(user_id.clone()), balance: 100000.0 });

                    if user_wallet.balance < reserve {
                        return Err("Insufficient balance to place bid");
                    }

                    user_wallet.balance -= reserve;
                    engine.put_json_state(&key, &user_wallet);
                }
                OrderSide::Ask => {
                    let key = holdings_key(user_id);

                    let mut holdings = engine
                        .get_json_state::<Holdings>(&key)
                        .unwrap_or_default();

                    let have = holdings.balances.get(&trade.asset).copied().unwrap_or(0.0);

                    if have < trade.quantity {
                        return Err("Insufficient holdings to place a sell order");
                    }

                    *holdings.balances.entry(trade.asset.clone()).or_insert(0.0) -= trade.quantity;
                    engine.put_json_state(&key, &holdings);
                }
            }

            let fills = book.submit(order);

            // Each fill can involve two DIFFERENT accounts (whoever placed
            // the bid, whoever placed the ask) — so unlike the other trade
            // actions, we can't just load one wallet up front. Settle each
            // side of each fill against its own owner's wallet/holdings,
            // and charge a fee on both legs (maker and taker both pay).
            for fill in &fills {
                let bid_wallet_key = wallet_key(&fill.bid_user_id);
                let bid_holdings_key = holdings_key(&fill.bid_user_id);

                let mut bid_wallet = engine
                    .get_json_state::<Wallet>(&bid_wallet_key)
                    .unwrap_or(Wallet { user_id: Some(fill.bid_user_id.clone()), balance: 100000.0 });
                let mut bid_holdings = engine
                    .get_json_state::<Holdings>(&bid_holdings_key)
                    .unwrap_or_default();
                let mut treasury = engine.get_json_state::<Treasury>("treasury").unwrap_or_default();

                // Buyer leg: receives the commodity, and is refunded any
                // favorable gap between their bid's limit price and the
                // price it actually filled at (zero if their own order was
                // the one resting/setting the price).
                *bid_holdings.balances.entry(fill.asset.clone()).or_insert(0.0) += fill.quantity;
                let refund = (fill.bid_price - fill.price) * fill.quantity;
                let notional = fill.price * fill.quantity;
                apply_fee(&mut bid_wallet, &mut treasury, notional, fee_bps);
                bid_wallet.balance += refund;

                engine.put_json_state(&bid_wallet_key, &bid_wallet);
                engine.put_json_state(&bid_holdings_key, &bid_holdings);

                // Seller leg: receives proceeds at the fill price
                // (holdings were already reserved when their ask was placed).
                let ask_wallet_key = wallet_key(&fill.ask_user_id);

                let mut ask_wallet = engine
                    .get_json_state::<Wallet>(&ask_wallet_key)
                    .unwrap_or(Wallet { user_id: Some(fill.ask_user_id.clone()), balance: 100000.0 });

                apply_fee(&mut ask_wallet, &mut treasury, notional, fee_bps);
                ask_wallet.balance += notional;

                engine.put_json_state(&ask_wallet_key, &ask_wallet);
                engine.put_json_state("treasury", &treasury);
            }

            engine.put_json_state(&format!("orderbook_{}", trade.asset), &book);

            if !fills.is_empty() {
                let mut fill_log = engine
                    .get_json_state::<Vec<Fill>>(&format!("fills_{}", trade.asset))
                    .unwrap_or_default();

                fill_log.extend(fills.into_iter());

                if fill_log.len() > 200 {
                    let excess = fill_log.len() - 200;
                    fill_log.drain(0..excess);
                }

                engine.put_json_state(&format!("fills_{}", trade.asset), &fill_log);
            }
        }

        Some("CANCEL_ORDER") => {

            let user_id = tx.user_id.as_ref().ok_or("User not logged in")?;

            let (Some(order_id), Some(trade)) = (&tx.contract_code, &tx.trade) else {
                return Err("CANCEL_ORDER requires contract_code (order id) and trade.asset");
            };

            let mut book = engine
                .get_json_state::<OrderBook>(&format!("orderbook_{}", trade.asset))
                .unwrap_or_default();

            // Only the account that placed an order can cancel it.
            let owns_order = book
                .bids
                .iter()
                .chain(book.asks.iter())
                .find(|o| &o.id == order_id)
                .map(|o| &o.user_id == user_id);

            match owns_order {
                None => return Err("Order not found"),
                Some(false) => return Err("You do not own this order"),
                Some(true) => {}
            }

            match book.cancel(order_id) {
                Some(order) if order.side == OrderSide::Bid => {
                    let key = wallet_key(user_id);
                    let mut user_wallet = engine
                        .get_json_state::<Wallet>(&key)
                        .unwrap_or(Wallet { user_id: Some(user_id.clone()), balance: 100000.0 });
                    user_wallet.balance += order.remaining * order.price;
                    engine.put_json_state(&key, &user_wallet);
                }
                Some(order) => {
                    let key = holdings_key(user_id);
                    let mut holdings = engine.get_json_state::<Holdings>(&key).unwrap_or_default();
                    *holdings.balances.entry(order.asset.clone()).or_insert(0.0) += order.remaining;
                    engine.put_json_state(&key, &holdings);
                }
                None => {
                    return Err("Order not found");
                }
            }

            engine.put_json_state(&format!("orderbook_{}", trade.asset), &book);
        }

        _ => {}
    }

    Ok(())
}

// ===================== P2P CHAIN SYNC =====================

/// Tries to append a single block received from a peer directly onto our
/// current chain tip. Returns true if it was valid and got appended.
fn try_append_block(
    engine: &BlockchainEngine,
    consensus: &dyn ConsensusEngine,
    price_feed: &PriceFeed,
    fee_bps: u64,
    block: &Block,
) -> bool {
    let latest = match engine.get_latest_block() {
        Some(b) => b,
        None => return false,
    };

    if block.index != latest.index + 1 {
        return false;
    }

    if block.previous_hash != latest.hash {
        return false;
    }

    if !consensus.verify(block) {
        return false;
    }

    // Replay the block's transactions so wallet/position state matches
    // what the peer that mined it already computed.
    for tx in &block.transactions {
        let _ = execute_contract(engine, price_feed, fee_bps, tx);
    }

    engine.write_block(block);
    true
}

/// Validates a candidate chain (usually fetched from a peer) and, if it's
/// longer than ours and fully valid, replaces our chain and replays every
/// transaction from genesis so derived state stays consistent.
///
/// This is a simple "longest valid chain wins" rule — the same idea used
/// by most toy blockchains for fork resolution.
async fn adopt_chain_if_better(
    engine: &BlockchainEngine,
    consensus: &dyn ConsensusEngine,
    price_feed: &PriceFeed,
    fee_bps: u64,
    candidate: Vec<Block>,
) -> bool {
    let current_len = engine.load_blocks().len();

    if candidate.len() <= current_len {
        return false;
    }

    if candidate.first().map(|b| b.index) != Some(0) {
        return false; // must start at genesis
    }

    for pair in candidate.windows(2) {
        let (prev, curr) = (&pair[0], &pair[1]);

        if curr.index != prev.index + 1 {
            return false;
        }

        if curr.previous_hash != prev.hash {
            return false;
        }

        if !consensus.verify(curr) {
            return false;
        }
    }

    engine.reset_chain_state();

    for block in &candidate {
        engine.write_block(block);

        for tx in &block.transactions {
            let _ = execute_contract(engine, price_feed, fee_bps, tx);
        }
    }

    true
}

// ===================== STATE =====================

struct AppState {
    engine: Arc<BlockchainEngine>,
    query_engine: Arc<QueryEngine>,
    consensus: Arc<dyn ConsensusEngine>,  // ← pluggable consensus engine
    price_feed: Arc<PriceFeed>,           // ← live Yahoo Finance commodity prices
    peer_network: Arc<PeerNetwork>,       // ← connected peer nodes
    admin_key: String,                    // ← required in x-admin-key for /admin/* routes
    fee_bps: u64,                         // ← trading fee, in basis points of notional
}

// ===================== ENDPOINTS =====================

#[post("/tx/submit")]
async fn submit_tx(
    data: web::Data<AppState>,
    req: web::Json<Transaction>,
) -> impl Responder {
    let mut tx = req.into_inner();

    if tx.id.is_empty() {
        tx.id = uuid::Uuid::new_v4().to_string();
    }

    data.engine.mempool.lock().unwrap().push(tx.clone());

    HttpResponse::Ok().json(tx)
}

#[get("/mempool")]
async fn mempool(data: web::Data<AppState>) -> impl Responder {
    let pool = data.engine.mempool.lock().unwrap().clone();
    HttpResponse::Ok().json(pool)
}

#[post("/engine/mine")]
async fn mine_block(data: web::Data<AppState>) -> impl Responder {
    let mut pool = data.engine.mempool.lock().unwrap();

    if pool.is_empty() {
        return HttpResponse::BadRequest().body("Mempool is empty.");
    }

    let latest = match data.engine.get_latest_block() {
        Some(b) => b,
        None => {
            return HttpResponse::InternalServerError().body("No latest block found.")
        }
    };

    let transactions = pool.clone();

    for tx in &transactions {
        let _ = execute_contract(&data.engine, &data.price_feed, data.fee_bps, tx);
    }

    let tx_payload = serde_json::to_string(&transactions).unwrap();

    let mut block = Block {
        index: latest.index + 1,
        timestamp: 0,           // consensus.mine() will fill this in
        transactions,
        previous_hash: String::new(), // consensus.mine() will fill this in
        nonce: 0,
        hash: String::new(),
    };

    // Delegate to whichever consensus engine is active (PoW or PoS)
    data.consensus.mine(&mut block, &latest.hash, &tx_payload);

    pool.clear();

    data.engine.write_block(&block);

    data.query_engine.reload_blocks_table()
        .map_err(|e| eprintln!("reload failed: {e}"))
        .ok();

    data.query_engine.reload_transactions_table()
        .map_err(|e| eprintln!("reload failed: {e}"))
        .ok();

    data.peer_network.broadcast_block(&block, None);

    HttpResponse::Ok().json(block)
}

#[get("/query/state/{contract_id}/{_key}")]
async fn query_state(
    data: web::Data<AppState>,
    path: web::Path<(String, String)>,
) -> impl Responder {
    let (contract_id, _key) = path.into_inner();

    let val = data.engine.get_state(&format!("contract_{}", contract_id));

    HttpResponse::Ok().body(val.to_string())
}

#[post("/sql")]
async fn sql_query(
    data: web::Data<AppState>,
    req: web::Json<SqlRequest>,
) -> impl Responder {
    match data.query_engine.run_query(&req.sql).await {
        Ok(batches) => {
            let json = batches_to_json(&batches);
            HttpResponse::Ok().json(json)
        }

        Err(e) => HttpResponse::BadRequest().body(e.to_string()),
    }
}

// Returns which consensus engine is currently active
#[get("/consensus/status")]
async fn consensus_status(data: web::Data<AppState>) -> impl Responder {
    HttpResponse::Ok().json(serde_json::json!({
        "engine": data.consensus.name(),
        "active": true
    }))
}

// Returns all open positions (from state)
#[get("/positions")]
async fn positions(
    data: web::Data<AppState>,
    query: web::Query<HashMap<String, String>>
) -> impl Responder {

    let mut positions = vec![];

    let user_id = query.get("user_id");

    let iter = data.engine.db.iterator(
        rocksdb::IteratorMode::Start
    );

    for item in iter {

        let (key, value) = item.unwrap();

        if !key.starts_with(b"state:position_") {
            continue;
        }

        if let Ok(position) =
            serde_json::from_slice::<Position>(&value)
        {
            
            if position.closed {
                continue;
            }

            if let Some(user_id) = query.get("user_id") {
                if position.user_id.as_ref() != Some(user_id) {
                    continue;
                }
            }

            positions.push(position);
        }
            }

    HttpResponse::Ok().json(positions)
}

// Returns the live commodity price list (Gold, Silver, Oil) sourced
// from Yahoo Finance, refreshed on a background interval.
#[get("/markets")]
async fn markets(data: web::Data<AppState>) -> impl Responder {
    HttpResponse::Ok().json(data.price_feed.snapshot())
}

// Server-Sent Events stream — pushes a price update the instant the
// background feed refreshes any tracked commodity.
#[get("/markets/stream")]
async fn markets_stream(data: web::Data<AppState>) -> impl Responder {
    let rx = data.price_feed.updates.subscribe();

    let stream = futures::stream::unfold(rx, |mut rx| async move {
        match rx.recv().await {
            Ok(update) => {
                let payload = serde_json::to_string(&update).unwrap_or_default();
                let bytes = web::Bytes::from(format!("data: {payload}\n\n"));
                Some((Ok::<_, actix_web::Error>(bytes), rx))
            }
            // Sender dropped or receiver lagged too far behind — end the stream.
            Err(_) => None,
        }
    });

    HttpResponse::Ok()
        .content_type("text/event-stream")
        .streaming(stream)
}

// Returns the current live price for a given commodity asset.
// Falls back to 0.0 for anything outside the tracked commodity set.
fn get_market_price(price_feed: &PriceFeed, asset: &str) -> f64 {
    price_feed.get(asset)
}

// Returns a list of all trades (from blocks)
#[get("/trade-history")]
async fn trade_history(
    data: web::Data<AppState>,
    query: web::Query<HashMap<String, String>>
) -> impl Responder {

    let mut trades = vec![];

    let user_id = query.get("user_id");

    let blocks = data.engine.load_blocks();

    for block in blocks {

        for tx in block.transactions {

            // Only return this user's trades
            if let Some(uid) = user_id {
                if tx.user_id.as_ref() != Some(uid) {
                    continue;
                }
            }

            let closed = if let Some(position) =
                    data.engine.get_json_state::<Position>(
                        &format!("position_{}", tx.id)
                    )
                {
                    position.closed
                } else {
                    false
                };

            if tx.trade.is_some() {

                trades.push(json!({
                    "tx_id": tx.id,
                    "block": block.index,
                    "block_timestamp": block.timestamp,
                    "contract_code": tx.contract_code,
                    "action": tx.contract_action,
                    "asset": tx.trade.as_ref().map(|t| &t.asset),
                    "quantity": tx.trade.as_ref().map(|t| t.quantity),
                    "direction": tx.trade.as_ref().map(|t| &t.direction),
                    "leverage": tx.trade.as_ref().map(|t| t.leverage),
                    "closed": closed,
                }));
            }
        }
    }

    HttpResponse::Ok().json(trades)
}

// tmp endpoint to get wallet balance
#[get("/wallet")]
async fn get_wallet(
    data: web::Data<AppState>,
    query: web::Query<HashMap<String, String>>
) -> impl Responder {

    let Some(user_id) = query.get("user_id") else {
        return HttpResponse::BadRequest().body("User not logged in");
    };

    let key = wallet_key(user_id);

    let wallet = match data.engine.get_json_state::<Wallet>(&key) {
        Some(wallet) => wallet,
        None => {
            return HttpResponse::NotFound().body("Wallet not found");
        }
    };

    HttpResponse::Ok().json(wallet)
}

#[derive(Deserialize)]
struct CreateWalletRequest {
    user_id: String,
}

// Creates a new wallet for a user if one doesn't already exist.
#[post("/wallet/create")]
async fn create_wallet(
    data: web::Data<AppState>,
    req: web::Json<CreateWalletRequest>,
) -> impl Responder {

    let key = wallet_key(&req.user_id);

    if data.engine.get_json_state::<Wallet>(&key).is_none() {
        data.engine.put_json_state(
            &key,
            &Wallet {
                user_id: Some(req.user_id.clone()),
                balance: 100000.0,
            },
        );
    }

    HttpResponse::Ok().finish()
}

// ===================== TRADING QUEUE / FEES ENDPOINTS =====================

// Returns the current resting bids and asks for a commodity — the trading
// queue itself, ready to render as an order book / depth view.
#[get("/orderbook/{asset}")]
async fn get_orderbook(
    data: web::Data<AppState>,
    path: web::Path<String>,
) -> impl Responder {
    let asset = path.into_inner();

    let book = data
        .engine
        .get_json_state::<OrderBook>(&format!("orderbook_{}", asset))
        .unwrap_or_default();

    HttpResponse::Ok().json(book)
}

// Returns recent executed fills (matched trades) for a commodity's queue —
// most recent last, capped to the last 200 per asset.
#[get("/orderbook/{asset}/fills")]
async fn get_orderbook_fills(
    data: web::Data<AppState>,
    path: web::Path<String>,
) -> impl Responder {
    let asset = path.into_inner();

    let fills = data
        .engine
        .get_json_state::<Vec<Fill>>(&format!("fills_{}", asset))
        .unwrap_or_default();

    HttpResponse::Ok().json(fills)
}

// How much of each commodity a user currently holds — built up by filled
// bids and drawn down by filled asks in the trading queue.
#[get("/holdings")]
async fn get_holdings(
    data: web::Data<AppState>,
    query: web::Query<HashMap<String, String>>,
) -> impl Responder {
    let Some(user_id) = query.get("user_id") else {
        return HttpResponse::BadRequest().body("User not logged in");
    };

    let holdings = data
        .engine
        .get_json_state::<Holdings>(&holdings_key(user_id))
        .unwrap_or_default();

    HttpResponse::Ok().json(holdings)
}


#[derive(Deserialize)]
struct HistoryQuery {
    limit: Option<usize>,
}

// Historical (timestamp, price) samples for a commodity, sourced from the
// Yahoo Finance feed — only ever populated for actual tracked commodities.
// Ready to feed straight into a line chart.
#[get("/markets/history/{symbol}")]
async fn markets_history(
    data: web::Data<AppState>,
    path: web::Path<String>,
    query: web::Query<HistoryQuery>,
) -> impl Responder {
    let symbol = path.into_inner();
    HttpResponse::Ok().json(data.price_feed.history(&symbol, query.limit))
}


// The current trading fee rate and how much has been collected so far.
#[get("/fees")]
async fn get_fees(data: web::Data<AppState>) -> impl Responder {
    let treasury = data
        .engine
        .get_json_state::<Treasury>("treasury")
        .unwrap_or_default();

    HttpResponse::Ok().json(serde_json::json!({
        "fee_bps": data.fee_bps,
        "fee_percent": data.fee_bps as f64 / 100.0,
        "treasury_collected": treasury.collected,
    }))
}

// ===================== ADMIN ENDPOINTS =====================

#[derive(Deserialize)]
struct NewCommodityRequest {
    /// Internal trading symbol, e.g. "xCOFFEE"
    symbol: String,
    /// Yahoo Finance chart symbol used for live pricing, e.g. "KC=F"
    yahoo_symbol: String,
    /// Human-readable contract name, e.g. "Robusta Coffee Futures"
    contract_name: String,
    /// Minimum tradable quantity, in `unit` below
    min_quantity: f64,
    /// e.g. "lb", "kg", "oz", or any other unit string
    unit: String,
    /// e.g. "USD"
    currency: String,
}

/// Checks the `x-admin-key` header against the node's configured admin key.
/// Returns true if the request is authorized to hit an /admin/* endpoint.
fn is_admin(req: &HttpRequest, expected_key: &str) -> bool {
    req.headers()
        .get("x-admin-key")
        .and_then(|v| v.to_str().ok())
        .map(|provided| provided == expected_key)
        .unwrap_or(false)
}

// Registers a new custom tradable commodity. Admin-only: requires the
// x-admin-key header to match this node's configured admin key (printed to
// the console at startup, or set explicitly with --admin-key).
#[post("/admin/commodities")]
async fn admin_add_commodity(
    data: web::Data<AppState>,
    http_req: HttpRequest,
    body: web::Json<NewCommodityRequest>,
) -> impl Responder {
    if !is_admin(&http_req, &data.admin_key) {
        return HttpResponse::Unauthorized().body("Invalid or missing x-admin-key header");
    }

    let body = body.into_inner();

    if body.symbol.trim().is_empty() || body.yahoo_symbol.trim().is_empty() {
        return HttpResponse::BadRequest().body("symbol and yahoo_symbol are required");
    }

    if body.contract_name.trim().is_empty() {
        return HttpResponse::BadRequest().body("contract_name is required");
    }

    if body.unit.trim().is_empty() {
        return HttpResponse::BadRequest().body("unit is required (e.g. lb, kg, oz)");
    }

    if body.currency.trim().is_empty() {
        return HttpResponse::BadRequest().body("currency is required (e.g. USD)");
    }

    if body.min_quantity <= 0.0 {
        return HttpResponse::BadRequest().body("min_quantity must be greater than 0");
    }

    let cfg = CommodityConfig {
        symbol: body.symbol.trim().to_string(),
        yahoo_symbol: body.yahoo_symbol.trim().to_string(),
        contract_name: body.contract_name.trim().to_string(),
        min_quantity: body.min_quantity,
        unit: body.unit.trim().to_string(),
        currency: body.currency.trim().to_uppercase(),
    };

    match data.price_feed.add_commodity(cfg) {
        Ok(_) => {
            // Persist so the custom commodity survives a node restart.
            data.engine.put_json_state(
                "custom_commodities",
                &data.price_feed.list_configs(),
            );

            // Fetch its price immediately rather than waiting for the next
            // background refresh (every 15s).
            data.price_feed.refresh_all().await;

            HttpResponse::Ok().json(data.price_feed.snapshot())
        }
        Err(e) => HttpResponse::Conflict().body(e),
    }
}

#[derive(Deserialize)]
struct GrantHoldingsRequest {
    /// The recipient's wallet address (user id)
    user_id: String,
    /// Commodity symbol, e.g. "xGOLD"
    asset: String,
    /// Amount to grant — added on top of whatever they already hold
    quantity: f64,
}

// Grants a quantity of a commodity directly to a user's holdings, no trade
// or counterparty required — e.g. seeding a test account, or crediting
// someone outside the normal buy/sell flow. Admin-only: requires the
// x-admin-key header to match this node's configured admin key.
#[post("/admin/holdings/grant")]
async fn admin_grant_holdings(
    data: web::Data<AppState>,
    http_req: HttpRequest,
    body: web::Json<GrantHoldingsRequest>,
) -> impl Responder {
    if !is_admin(&http_req, &data.admin_key) {
        return HttpResponse::Unauthorized().body("Invalid or missing x-admin-key header");
    }

    let body = body.into_inner();

    if body.user_id.trim().is_empty() {
        return HttpResponse::BadRequest().body("user_id (wallet address) is required");
    }

    if body.asset.trim().is_empty() {
        return HttpResponse::BadRequest().body("asset is required");
    }

    if body.quantity <= 0.0 {
        return HttpResponse::BadRequest().body("quantity must be greater than 0");
    }

    // Only allow granting commodities the node actually tracks — otherwise
    // an admin could credit an asset that can never be priced or traded.
    if data.price_feed.min_quantity(&body.asset).is_none() {
        return HttpResponse::BadRequest()
            .body(format!("'{}' is not a tracked commodity", body.asset));
    }

    let key = holdings_key(&body.user_id);

    let mut holdings = data
        .engine
        .get_json_state::<Holdings>(&key)
        .unwrap_or_default();

    *holdings.balances.entry(body.asset.clone()).or_insert(0.0) += body.quantity;

    data.engine.put_json_state(&key, &holdings);

    HttpResponse::Ok().json(holdings)
}

// ===================== P2P ENDPOINTS =====================

// Connect this node to another node's address. Registers with them and
// pulls their known peers so the mesh grows transitively.
#[post("/p2p/peers/connect")]
async fn p2p_connect(
    data: web::Data<AppState>,
    req: web::Json<PeerHandshake>,
) -> impl Responder {
    if let Err(e) = data.peer_network.connect(&req.address).await {
        return HttpResponse::BadGateway().body(e);
    }

    // Handshake alone only exchanges peer lists — it says nothing about
    // whose chain is ahead. Pull the peer's chain now and adopt it if
    // it's longer, so two already-running nodes reconcile immediately
    // on connect instead of waiting for the next block to be mined.
    let synced = match data.peer_network.fetch_chain(&req.address).await {
        Ok(candidate) => {
            let adopted = adopt_chain_if_better(
                &data.engine,
                data.consensus.as_ref(),
                &data.price_feed,
                data.fee_bps,
                candidate,
            ).await;

            if adopted {
                data.query_engine.reload_blocks_table().ok();
                data.query_engine.reload_transactions_table().ok();
            }

            adopted
        }
        Err(_) => false,
    };

    HttpResponse::Ok().json(serde_json::json!({
        "connected": true,
        "synced": synced,
        "peers": data.peer_network.peers(),
    }))
}

// Called by a remote node to tell us it knows about us — reciprocal
// half of the handshake so both sides end up with each other listed.
#[post("/p2p/peers/register")]
async fn p2p_register(
    data: web::Data<AppState>,
    req: web::Json<PeerHandshake>,
) -> impl Responder {
    data.peer_network.add_peer(&req.address);

    // The peer that connected to us might be the one with more history —
    // check both directions so it doesn't matter who initiated.
    if let Ok(candidate) = data.peer_network.fetch_chain(&req.address).await {
        let adopted = adopt_chain_if_better(
            &data.engine,
            data.consensus.as_ref(),
            &data.price_feed,
            data.fee_bps,
            candidate,
        ).await;

        if adopted {
            data.query_engine.reload_blocks_table().ok();
            data.query_engine.reload_transactions_table().ok();
        }
    }

    HttpResponse::Ok().json(serde_json::json!({ "registered": true }))
}

// Lists every peer this node currently knows about.
#[get("/p2p/peers")]
async fn p2p_peers(data: web::Data<AppState>) -> impl Responder {
    HttpResponse::Ok().json(data.peer_network.peers())
}

// Returns this node's full chain — used by peers to catch up or resolve a fork.
#[get("/p2p/chain")]
async fn p2p_chain(data: web::Data<AppState>) -> impl Responder {
    HttpResponse::Ok().json(data.engine.load_blocks())
}

// Receives a block a peer just mined. If it extends our tip, we append it
// directly and re-broadcast onward. If it doesn't (we're behind, or there's
// a fork), we fall back to pulling the sender's full chain and adopting it
// if it's longer and valid.
#[post("/p2p/blocks/announce")]
async fn p2p_announce_block(
    data: web::Data<AppState>,
    req: web::Json<BlockAnnouncement>,
) -> impl Responder {
    let announcement = req.into_inner();
    data.peer_network.add_peer(&announcement.from);

    let appended = try_append_block(
        &data.engine,
        data.consensus.as_ref(),
        &data.price_feed,
        data.fee_bps,
        &announcement.block,
    );

    if appended {
        data.query_engine.reload_blocks_table().ok();
        data.query_engine.reload_transactions_table().ok();

        // Gossip onward so the rest of the mesh finds out too.
        data.peer_network.broadcast_block(&announcement.block, Some(&announcement.from));

        return HttpResponse::Ok().json(serde_json::json!({ "appended": true }));
    }

    // Didn't extend our tip directly — see if the sender's full chain is
    // longer than ours and worth adopting.
    match data.peer_network.fetch_chain(&announcement.from).await {
        Ok(candidate) => {
            let adopted = adopt_chain_if_better(
                &data.engine,
                data.consensus.as_ref(),
                &data.price_feed,
                data.fee_bps,
                candidate,
            ).await;

            if adopted {
                data.query_engine.reload_blocks_table().ok();
                data.query_engine.reload_transactions_table().ok();
            }

            HttpResponse::Ok().json(serde_json::json!({ "appended": false, "resynced": adopted }))
        }
        Err(e) => HttpResponse::Ok().json(serde_json::json!({ "appended": false, "resynced": false, "error": e })),
    }
}

// Generates a pseudo-random admin key when none is provided via --admin-key,
// so there's never a hardcoded default. Not cryptographically audited —
// fine for local/dev use, but pass a real secret via --admin-key for
// anything more exposed.
fn generate_admin_key() -> String {
    let seed = format!("{:?}-{}", std::time::SystemTime::now(), std::process::id());
    let mut hasher = Sha256::new();
    hasher.update(seed.as_bytes());
    format!("{:x}", hasher.finalize())[..32].to_string()
}

// ===================== MAIN =====================

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    // ── Read --consensus flag from command line ──
    // Usage:
    //   cargo run --bin blockchain-node -- --consensus pow
    //   cargo run --bin blockchain-node -- --consensus pos
    //   (defaults to pow if not specified)
    let args: Vec<String> = std::env::args().collect();
    let consensus_flag = args
        .windows(2)
        .find(|w| w[0] == "--consensus")
        .map(|w| w[1].to_lowercase())
        .unwrap_or_else(|| "pow".to_string());

    // Which port this node listens on — lets you run several nodes on one
    // machine for testing (e.g. --port 8081).
    let port: u16 = args
        .windows(2)
        .find(|w| w[0] == "--port")
        .and_then(|w| w[1].parse().ok())
        .unwrap_or(8080);

    // Which network interface to bind to. Defaults to 127.0.0.1 (local
    // machine only). Set this to 0.0.0.0 to accept connections from other
    // machines — over LAN, a VPN mesh like Tailscale, or with port forwarding.
    let host = args
        .windows(2)
        .find(|w| w[0] == "--host")
        .map(|w| w[1].clone())
        .unwrap_or_else(|| "127.0.0.1".to_string());

    // The address THIS node tells peers to use when reaching back to it.
    // 127.0.0.1 only means something on the machine it's running on, so if
    // peers live elsewhere (LAN, VPN, internet), you must set this to
    // wherever this node is actually reachable, e.g.:
    //   --advertise http://192.168.1.42:8080      (same LAN)
    //   --advertise http://100.101.102.103:8080    (Tailscale/ZeroTier IP)
    //   --advertise http://your-public-ip:8080     (port forwarded)
    let advertise = args
        .windows(2)
        .find(|w| w[0] == "--advertise")
        .map(|w| w[1].clone())
        .unwrap_or_else(|| format!("http://127.0.0.1:{port}"));

    // Comma-separated list of peer node addresses to connect to at startup,
    // e.g. --peers http://127.0.0.1:8081,http://192.168.1.12:8080
    let bootstrap_peers: Vec<String> = args
        .windows(2)
        .find(|w| w[0] == "--peers")
        .map(|w| {
            w[1].split(',')
                .map(|s| s.trim().to_string())
                .filter(|s| !s.is_empty())
                .collect()
        })
        .unwrap_or_default();

    // Secret required in the x-admin-key header to hit /admin/* endpoints
    // (currently just registering custom commodities). If not provided,
    // one is generated and printed once at startup — pass --admin-key to
    // set a stable one across restarts.
    let admin_key = args
        .windows(2)
        .find(|w| w[0] == "--admin-key")
        .map(|w| w[1].clone())
        .unwrap_or_else(generate_admin_key);

    // Trading fee, in basis points (1 bps = 0.01%) of a trade's notional
    // value. Charged on every futures/perpetual/option open and close, and
    // on every order book fill. Defaults to 10 bps (0.10%). This must match
    // across every node in the network — like --consensus, it's baked into
    // deterministic contract execution, so peers with different fee rates
    // would disagree about wallet balances after replaying the same blocks.
    let fee_bps: u64 = args
        .windows(2)
        .find(|w| w[0] == "--fee-bps")
        .and_then(|w| w[1].parse().ok())
        .unwrap_or(10);

    let consensus: Arc<dyn ConsensusEngine> = match consensus_flag.as_str() {
        "pos" => {
            println!("Consensus: Proof of Stake (PoS)");
            Arc::new(ProofOfStake {
                validators: vec![
                    Validator { address: "validator-alpha".to_string(), stake: 5000 },
                    Validator { address: "validator-beta".to_string(),  stake: 3000 },
                    Validator { address: "validator-gamma".to_string(), stake: 2000 },
                ],
            })
        }
        _ => {
            println!("Consensus: Proof of Work (PoW, difficulty=4)");
            Arc::new(ProofOfWork { difficulty: 4 })
        }
    };

    let engine = Arc::new(BlockchainEngine::new("./ledger"));

    let query_engine = Arc::new(QueryEngine::new(engine.clone()));

    query_engine
        .reload_blocks_table()
        .unwrap();

    query_engine
        .reload_transactions_table()
        .unwrap();

    // ── Real-time commodity price feed (Yahoo Finance) ──
    // Gold, Silver, and Oil are tracked by default; admins can register
    // additional custom commodities at runtime via POST /admin/commodities.
    let price_feed = PriceFeed::new();

    println!("Fetching initial commodity prices from Yahoo Finance...");
    price_feed.refresh_all().await;

    // Restore any custom commodities an admin registered in a previous run.
    if let Some(saved) = engine.get_json_state::<Vec<CommodityConfig>>("custom_commodities") {
        let mut restored_any = false;

        for cfg in saved {
            if price_feed.add_commodity(cfg).is_ok() {
                restored_any = true;
            }
        }

        if restored_any {
            println!("Restored custom commodities from a previous run.");
            price_feed.refresh_all().await;
        }
    }

    // Keep prices fresh every 15s in the background for the lifetime of the node.
    price_feed.clone().spawn_refresh_loop(std::time::Duration::from_secs(15));

    // ── P2P networking ──
    let self_address = advertise;
    let peer_network = PeerNetwork::new(self_address.clone());

    for peer_addr in &bootstrap_peers {
        println!("Connecting to peer {peer_addr}...");

        if let Err(e) = peer_network.connect(peer_addr).await {
            eprintln!("⚠️  p2p: failed to connect to {peer_addr}: {e}");
            continue;
        }

        match peer_network.fetch_chain(peer_addr).await {
            Ok(candidate) => {
                if adopt_chain_if_better(&engine, consensus.as_ref(), &price_feed, fee_bps, candidate).await {
                    println!("🔗 Synced chain from {peer_addr}");
                    query_engine.reload_blocks_table().ok();
                    query_engine.reload_transactions_table().ok();
                }
            }
            Err(e) => eprintln!("⚠️  p2p: failed to fetch chain from {peer_addr}: {e}"),
        }
    }

    let app_state = web::Data::new(AppState {
        engine,
        query_engine,
        consensus,
        price_feed,
        peer_network,
        admin_key: admin_key.clone(),
        fee_bps,
    });

    println!("Blockchain node listening on {host}:{port}");
    println!("Advertising itself to peers as {self_address}");
    println!("🔑 Admin key: {admin_key}");
    println!("   Pass this as the x-admin-key header to use /admin/* endpoints.");
    println!("   Set --admin-key <key> to use a stable one across restarts.");
    println!("💸 Trading fee: {fee_bps} bps ({:.2}%)", fee_bps as f64 / 100.0);

    HttpServer::new(move || {
        App::new()
            .wrap(
        // Permissive CORS: this node is meant to be reached from the
        // frontend running on a different machine/address (e.g. over
        // Tailscale), so the origin isn't known in advance. Fine for a
        // personal/dev setup; tighten this to specific origins before
        // exposing the node to the public internet.
        Cors::permissive()
            )
            .app_data(app_state.clone())
            .service(submit_tx)
            .service(mine_block)
            .service(mempool)
            .service(query_state)
            .service(sql_query)
            .service(consensus_status)
            .service(positions)
            .service(markets)
            .service(markets_stream)
            .service(trade_history)
            .service(get_wallet)
            .service(create_wallet)
            .service(p2p_connect)
            .service(p2p_register)
            .service(p2p_peers)
            .service(p2p_chain)
            .service(p2p_announce_block)
            .service(admin_add_commodity)
            .service(admin_grant_holdings)
            .service(get_orderbook)
            .service(get_orderbook_fills)
            .service(get_holdings)
            .service(markets_history)
            .service(get_fees)
    })
    .bind((host.as_str(), port))?
    .run()
    .await
}
