use clap::{Parser, Subcommand};
use serde_json::json;

#[derive(Parser)]
#[command(name = "blockchain-cli")]
#[command(about = "Asynchronous CLI for the blockchain node", long_about = None)]
struct Cli {
    #[command(subcommand)]
    command: Commands,
}

#[derive(Subcommand)]
enum Commands {
    /// Submit a smart contract deployment bytecode script directly into mempool
    Deploy {
        #[arg(short = 'b', long)]
        hex_bytecode: String,
        #[arg(short = 'm', long)]
        method: String,
    },
    /// Command the network interface instance to instantly trigger a mining sequence event
    Mine,
    /// Inspect the latest internal storage state mapping metrics for a given key address slot
    QueryState {
        #[arg(short, long)]
        contract_id: String,
        #[arg(short, long)]
        key_slot: String,
    },
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let cli = Cli::parse();
    let client = reqwest::Client::new();
    let base_url = "http://127.0.0.1:8080";

    match &cli.command {
        Commands::Deploy { hex_bytecode, method } => {
            let payload = json!({
                "id": "",
                "contract_code": hex_bytecode,
                "contract_action": method
            });
            let res = client.post(format!("{}/tx/submit", base_url))
                .json(&payload)
                .send()
                .await?
                .text()
                .await?;
            println!("Deployment Request Submitted:\n{}", res);
        }
        Commands::Mine => {
            let res = client.post(format!("{}/engine/mine", base_url))
                .send()
                .await?
                .text()
                .await?;
            println!("Mining Operation Finalized:\n{}", res);
        }
        Commands::QueryState { contract_id, key_slot } => {
            let res = client.get(format!("{}/query/state/{}/{}", base_url, contract_id, key_slot))
                .send()
                .await?
                .text()
                .await?;
            println!("Ledger Value for [{}][{}]: {}", contract_id, key_slot, res);
        }
    }

    Ok(())
}
