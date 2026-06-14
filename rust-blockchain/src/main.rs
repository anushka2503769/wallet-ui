use actix_web::{get, post, web, App, HttpResponse, HttpServer, Responder};
use chrono::Utc;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::HashMap;
use std::sync::{Arc, Mutex};

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

// ===================== ENGINE =====================

pub struct BlockchainEngine {
    pub mempool: Mutex<Vec<Transaction>>,
    pub state: Mutex<HashMap<String, Vec<u8>>>,
}

impl BlockchainEngine {
    pub fn new() -> Self {
        let engine = Self {
            mempool: Mutex::new(vec![]),
            state: Mutex::new(HashMap::new()),
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

    pub fn put_state(&self, key: &str, value: i32) {
        self.state
            .lock()
            .unwrap()
            .insert(key.to_string(), value.to_string().into_bytes());
    }

    pub fn get_state(&self, key: &str) -> i32 {
        self.state
            .lock()
            .unwrap()
            .get(key)
            .and_then(|b| String::from_utf8(b.clone()).ok())
            .and_then(|s| s.parse().ok())
            .unwrap_or(0)
    }

    pub fn write_block(&self, block: &Block) {
        let mut store = self.state.lock().unwrap();

        store.insert(
            format!("block_{}", block.index),
            serde_json::to_vec(block).unwrap(),
        );

        store.insert(
            "latest_index".to_string(),
            block.index.to_string().into_bytes(),
        );
    }

    pub fn get_latest_block(&self) -> Option<Block> {
        let store = self.state.lock().unwrap();

        let index_bytes = store.get("latest_index")?;
        let index_str = String::from_utf8(index_bytes.clone()).ok()?;

        let block_bytes = store.get(&format!("block_{}", index_str))?;

        serde_json::from_slice(block_bytes).ok()
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

    let difficulty_prefix = "0000";
    let timestamp = Utc::now().timestamp();
    let mut nonce = 0u64;

    let tx_payload = serde_json::to_string(&transactions).unwrap();

    let hash = loop {
        let mut hasher = Sha256::new();

        let input = format!(
            "{}{}{}{}{}",
            latest.index + 1,
            tx_payload,
            latest.hash,
            timestamp,
            nonce
        );

        hasher.update(input);

        let candidate = format!("{:x}", hasher.finalize());

        if candidate.starts_with(difficulty_prefix) {
            break candidate;
        }

        nonce = nonce.wrapping_add(1);
    };

    let block = Block {
        index: latest.index + 1,
        timestamp,
        transactions,
        previous_hash: latest.hash,
        nonce,
        hash,
    };

    data.engine.write_block(&block);
    pool.clear();

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

// ===================== MAIN =====================

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    let engine = Arc::new(BlockchainEngine::new());

    let app_state = web::Data::new(AppState { engine });

    println!("Blockchain node running at http://127.0.0.1:8080");

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