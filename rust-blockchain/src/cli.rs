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

             let v: serde_json::Value = serde_json::from_str(&res)?;
             println!("{}", serde_json::to_string_pretty(&v)?);
        }
    }

    Ok(())
}