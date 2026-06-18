mod consensus;
use consensus::{ConsensusEngine, ProofOfWork, ProofOfStake, Validator};

use actix_web::{get, post, web, App, HttpResponse, HttpServer, Responder};
use chrono::Utc;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use std::path::Path;
use rocksdb::{DB, Options};
use std::any::Any;

use async_trait::async_trait;
use datafusion::arrow::array::{StringArray, UInt64Array, Int64Array};
use datafusion::arrow::datatypes::{DataType, Field, Schema, SchemaRef};
use datafusion::arrow::record_batch::RecordBatch;
use datafusion::datasource::TableProvider;
use datafusion::error::Result;
use datafusion::catalog::Session;
use datafusion::execution::context::SessionState;
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

// ===================== DATA =====================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Transaction {
    pub id: String,
    pub contract_code: Option<String>,
    pub contract_action: Option<String>,
}

impl Transaction {
    pub fn new(code: Option<String>, action: Option<String>) -> Self {
        let mut tx = Transaction {
            id: String::new(),
            contract_code: code,
            contract_action: action,
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

        let db = DB::open(&opts, path).expect("Failed to open RocksDB");

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
            Field::new("contract_code", DataType::Utf8, true),
            Field::new("contract_action", DataType::Utf8, true),
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
        let mut codes = vec![];
        let mut actions = vec![];

        for block in blocks {
            for tx in block.transactions {
                block_indices.push(block.index);
                tx_ids.push(tx.id.clone());
                codes.push(tx.contract_code.clone());
                actions.push(tx.contract_action.clone());
            }
        }

        let batch = RecordBatch::try_new(
            self.schema.clone(),
            vec![
                Arc::new(UInt64Array::from(block_indices)),
                Arc::new(StringArray::from(tx_ids)),
                Arc::new(StringArray::from(codes)),
                Arc::new(StringArray::from(actions)),
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

fn execute_contract(engine: &BlockchainEngine, tx: &Transaction) -> Result<(), &'static str> {
    if tx.contract_code.is_some() {
        engine.put_state(&format!("contract_{}", tx.id), 1);
    }
    Ok(())
}

// ===================== STATE =====================

struct AppState {
    engine: Arc<BlockchainEngine>,
    query_engine: Arc<QueryEngine>,
    consensus: Arc<dyn ConsensusEngine>,  // ← pluggable consensus engine
}

// ===================== ENDPOINTS =====================

#[post("/tx/submit")]
async fn submit_tx(
    data: web::Data<AppState>,
    req: web::Json<Transaction>,
) -> impl Responder {
    let tx = Transaction::new(req.contract_code.clone(), req.contract_action.clone());

    data.engine.mempool.lock().unwrap().push(tx.clone());

    HttpResponse::Ok().json(tx)
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
        let _ = execute_contract(&data.engine, tx);
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

    let app_state = web::Data::new(AppState { engine, query_engine, consensus });

    println!("Blockchain node running at http://127.0.0.1:8080");

    HttpServer::new(move || {
        App::new()
            .app_data(app_state.clone())
            .service(submit_tx)
            .service(mine_block)
            .service(query_state)
            .service(sql_query)
            .service(consensus_status)
    })
    .bind(("127.0.0.1", 8080))?
    .run()
    .await
}
