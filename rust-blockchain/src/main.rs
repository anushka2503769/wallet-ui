use sha2::{Sha256, Digest};
use chrono::Utc;
use serde::{Serialize, Deserialize};
use std::sync::{Arc, Mutex};
use actix_web::{get, post, web, App, HttpServer, HttpResponse, Responder};
use rocksdb::{DB, Options};

// ==========================================
// Data structures
// ==========================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Transaction {
    pub id: String,
    pub contract_code: Option<String>,
    pub contract_action: Option<String>,
}

impl Transaction {
    pub fn new(code: Option<String>, action: Option<String>) -> Self {
        let mut tx = Transaction { id: String::new(), contract_code: code, contract_action: action };
        let mut hasher = Sha256::new();
        hasher.update(format!("{:?}{:?}", tx.contract_code, tx.contract_action));
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
    #[serde(default)]
    pub nonce: u64,
    pub hash: String,
}

// ==========================================
// Persistent Blockchain Engine (RocksDB-backed)
// ==========================================

pub struct BlockchainEngine {
    pub db: DB,
    pub mempool: Mutex<Vec<Transaction>>,
}

impl BlockchainEngine {
    pub fn new(db_path: &str) -> Self {
        let mut opts = Options::default();
        opts.create_if_missing(true);
        let db = DB::open(&opts, db_path).expect("Failed to open RocksDB");

        let engine = BlockchainEngine {
            db,
            mempool: Mutex::new(Vec::new()),
        };

        // Bootstrap genesis block if necessary
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

    pub fn write_block(&self, block: &Block) {
        let serialized = serde_json::to_vec(block).unwrap();
        self.db.put(format!("block_{}", block.index).as_bytes(), &serialized).unwrap();
        self.db.put(b"latest_index", block.index.to_string().as_bytes()).unwrap();
    }

    pub fn get_latest_block(&self) -> Option<Block> {
        if let Ok(Some(index_bytes)) = self.db.get(b"latest_index") {
            if let Ok(index_str) = String::from_utf8(index_bytes) {
                if let Ok(Some(block_bytes)) = self.db.get(format!("block_{}", index_str).as_bytes()) {
                    if let Ok(block) = serde_json::from_slice::<Block>(&block_bytes) {
                        return Some(block);
                    }
                }
            }
        }
        None
    }

    pub fn put_state(&self, key: &str, value: i32) {
        self.db.put(format!("state_{}", key).as_bytes(), value.to_string().as_bytes()).unwrap();
    }

    pub fn get_state(&self, key: &str) -> i32 {
        if let Ok(Some(bytes)) = self.db.get(format!("state_{}", key).as_bytes()) {
            if let Ok(s) = String::from_utf8(bytes) {
                return s.parse::<i32>().unwrap_or(0);
            }
        }
        0
    }
}

// Lightweight WASM contract execution stub.
// For production you would compile and run a Wasm module using `wasmi` or similar.
fn execute_contract(engine_ref: &BlockchainEngine, tx: &Transaction) -> Result<(), &'static str> {
    if let Some(_code_hex) = &tx.contract_code {
        // Example mutation: set a simple state key for this contract invocation.
        engine_ref.put_state(&format!("contract_{}", tx.id), 1);
    }
    Ok(())
}

// ==========================================
// REST / RPC Server
// ==========================================

struct AppState {
    pub engine: Arc<BlockchainEngine>,
}

#[post("/tx/submit")]
async fn submit_tx(data: web::Data<AppState>, req: web::Json<Transaction>) -> impl Responder {
    let tx = Transaction::new(req.contract_code.clone(), req.contract_action.clone());
    let mut pool = data.engine.mempool.lock().unwrap();
    pool.push(tx.clone());
    HttpResponse::Ok().json(tx)
}

#[post("/engine/mine")]
async fn mine_block(data: web::Data<AppState>) -> impl Responder {
    let mut pool = data.engine.mempool.lock().unwrap();
    if pool.is_empty() { return HttpResponse::BadRequest().body("Mempool is empty."); }

    let latest = match data.engine.get_latest_block() {
        Some(b) => b,
        None => return HttpResponse::InternalServerError().body("No latest block found."),
    };

    let active_txs = pool.clone();
    for tx in &active_txs {
        if let Err(e) = execute_contract(&data.engine, tx) {
            return HttpResponse::InternalServerError().body(e);
        }
    }

    // Simple proof-of-work: find a nonce so that the SHA256 hex begins with `difficulty_prefix`.
    let difficulty_prefix = "0000"; // adjust difficulty as needed (hex prefix)
    let mut nonce: u64 = 0;
    let timestamp = Utc::now().timestamp();
    let block_hash = loop {
        let mut hasher = Sha256::new();
        hasher.update(format!("{}{:?}{}{}{}", latest.index + 1, active_txs, latest.hash, timestamp, nonce));
        let candidate = format!("{:x}", hasher.finalize());
        if candidate.starts_with(difficulty_prefix) {
            break candidate;
        }
        nonce = nonce.wrapping_add(1);
    };

    let new_block = Block {
        index: latest.index + 1,
        timestamp,
        transactions: active_txs,
        previous_hash: latest.hash.clone(),
        nonce,
        hash: block_hash,
    };

    data.engine.write_block(&new_block);
    pool.clear();
    HttpResponse::Ok().json(new_block)
}

#[get("/query/state/{contract_id}/{key}")]
async fn query_state(data: web::Data<AppState>, path: web::Path<(String, String)>) -> impl Responder {
    let (contract, key) = path.into_inner();
    let val = data.engine.get_state(&format!("{}_{}", contract, key));
    HttpResponse::Ok().body(val.to_string())
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    let engine = Arc::new(BlockchainEngine::new("./blockchain_ledger_db"));
    let app_state = web::Data::new(AppState { engine });

    println!("Blockchain node listening at http://127.0.0.1:8080");

    HttpServer::new(move || {
        App::new()
            .app_data(app_state.clone())
            .service(submit_tx)
            .service(mine_block)
            .service(query_state)
    })
    .bind(("127.0.0.1", 8080))?
    .run()
    .await
}
