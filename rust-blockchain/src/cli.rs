use clap::{Parser, Subcommand};
use serde_json::json;

#[derive(Parser)]
#[command(name = "blockchain-cli")]
struct Cli {
    #[command(subcommand)]
    command: Commands,
}

#[derive(Subcommand)]
enum Commands {
    Deploy {
        #[arg(short = 'b', long)]
        hex_bytecode: String,

        #[arg(short, long)]
        method: String,
    },

    Mine,

    QueryState {
        #[arg(short, long)]
        contract_id: String,

        #[arg(short, long)]
        key_slot: String,
    },

    Sql {
        #[arg(short, long)]
        query: String,
    },

    /// Show current live commodity prices (Gold, Silver, Oil) once.
    Prices,

    /// Continuously poll live commodity prices and print updates as they land.
    Watch {
        #[arg(short, long, default_value_t = 5)]
        interval: u64,
    },

    /// Submit a commodity trade transaction, priced against the live feed
    /// once it's picked up by the next mined block.
    Trade {
        /// Commodity symbol, e.g. xGOLD, xSILVER, xOIL
        #[arg(short, long)]
        asset: String,

        /// One of: open-futures, open-perpetual, buy-option, close-position
        #[arg(short = 'A', long)]
        action: String,

        #[arg(short, long, default_value_t = 1.0)]
        quantity: f64,

        #[arg(short, long, default_value = "long")]
        direction: String,

        #[arg(short, long)]
        leverage: Option<f64>,

        /// Required for close-position: the position id to close
        #[arg(short, long)]
        position_id: Option<String>,
    },

}


fn print_block(res: &str) {
    let v: serde_json::Value = serde_json::from_str(res).unwrap();

    println!("\n✅ Block Mined Successfully\n");

    println!("Block #{}", v["index"]);
    println!(
        "Time: {}",
        chrono::DateTime::<chrono::Utc>::from_timestamp(v["timestamp"].as_i64().unwrap(), 0)
            .unwrap()
            .to_rfc3339()
    );

    println!("Nonce: {}", v["nonce"]);
    println!("Hash: {}", v["hash"]);
    println!("Previous Hash: {}\n", v["previous_hash"]);

    println!("Transactions:");

    for tx in v["transactions"].as_array().unwrap() {
        println!("  - {}", &tx["id"].as_str().unwrap()[..16]);
        println!("    Contract: {}", tx["contract_code"]);
        println!("    Action: {}", tx["contract_action"]);
    }

    println!();
}

fn print_markets(res: &str) {
    let v: serde_json::Value = match serde_json::from_str(res) {
        Ok(v) => v,
        Err(_) => {
            println!("⚠️ Unexpected response:\n{res}");
            return;
        }
    };

    let empty = vec![];
    let entries = v.as_array().unwrap_or(&empty);

    println!("\n💰 Live Commodity Prices (Yahoo Finance)\n");
    println!("{:<10} {:<12} {:>12}  {}", "SYMBOL", "YAHOO", "PRICE", "STATUS");
    println!("{}", "-".repeat(50));

    for entry in entries {
        let symbol = entry["symbol"].as_str().unwrap_or("?");
        let yahoo_symbol = entry["yahoo_symbol"].as_str().unwrap_or("?");
        let price = entry["price"].as_f64().unwrap_or(0.0);
        let live = entry["live"].as_bool().unwrap_or(false);

        let status = if live { "live" } else { "seed (not yet fetched)" };

        println!("{:<10} {:<12} {:>12.2}  {}", symbol, yahoo_symbol, price, status);
    }

    println!();
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let cli = Cli::parse();

    let client = reqwest::Client::new();
    let base_url = "http://127.0.0.1:8080";

    match cli.command {
        Commands::Deploy { hex_bytecode, method } => {
            let res = client
                .post(format!("{}/tx/submit", base_url))
                .json(&json!({
                    "id": "",
                    "contract_code": hex_bytecode,
                    "contract_action": method
                }))
                .send()
                .await?
                .text()
                .await?;

            println!("{res}");
        }

        Commands::Mine => {
            let res = client
                .post(format!("{}/engine/mine", base_url))
                .send()
                .await?
                .text()
                .await?;

            match serde_json::from_str::<serde_json::Value>(&res) {
                Ok(_) => print_block(&res),
                Err(_) => println!("⚠️ Node response:\n{res}"),
            }
        }

        Commands::QueryState { contract_id, key_slot } => {
            let res = client
                .get(format!(
                    "{}/query/state/{}/{}",
                    base_url, contract_id, key_slot
                ))
                .send()
                .await?
                .text()
                .await?;

            println!("{res}");
        }

        Commands::Sql { query } => {
            let res = client
                .post(format!("{}/sql", base_url))
                .json(&json!({ "sql": query }))
                .send()
                .await?
                .text()
                .await?;

            println!("RAW RESPONSE:");
            println!("{}", res);

             let v: serde_json::Value = serde_json::from_str(&res)?;
             println!("{}", serde_json::to_string_pretty(&v)?);
        }

        Commands::Prices => {
            let res = client
                .get(format!("{}/markets", base_url))
                .send()
                .await?
                .text()
                .await?;

            print_markets(&res);
        }

        Commands::Watch { interval } => {
            println!("Watching live commodity prices every {interval}s (Ctrl+C to stop)...");

            loop {
                let res = client
                    .get(format!("{}/markets", base_url))
                    .send()
                    .await?
                    .text()
                    .await?;

                // Clear the screen so the table refreshes in place.
                print!("\x1B[2J\x1B[1;1H");
                print_markets(&res);

                tokio::time::sleep(std::time::Duration::from_secs(interval)).await;
            }
        }

        Commands::Trade { asset, action, quantity, direction, leverage, position_id } => {
            let contract_action = match action.to_lowercase().as_str() {
                "open-futures" | "open_futures" => "OPEN_FUTURES",
                "open-perpetual" | "open_perpetual" => "OPEN_PERPETUAL",
                "buy-option" | "buy_option" => "BUY_OPTION",
                "close-position" | "close_position" => "CLOSE_POSITION",
                other => {
                    println!(
                        "⚠️ Unknown action '{other}'. Expected one of: open-futures, open-perpetual, buy-option, close-position"
                    );
                    return Ok(());
                }
            };

            let body = json!({
                "id": "",
                "contract_code": position_id,
                "contract_action": contract_action,
                "trade": {
                    "asset": asset,
                    "quantity": quantity,
                    "direction": direction,
                    "leverage": leverage
                }
            });

            let res = client
                .post(format!("{}/tx/submit", base_url))
                .json(&body)
                .send()
                .await?
                .text()
                .await?;

            println!("Trade submitted to mempool:");
            println!("{res}");
            println!("\nRun `blockchain-cli mine` to mine it into a block at the current live price.");
        }
    }

    Ok(())
}