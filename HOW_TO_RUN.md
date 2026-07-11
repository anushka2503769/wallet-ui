# How to Run

This project has two parts:
- React frontend in the repository root
- Rust blockchain backend in `rust-blockchain/`

## Prerequisites

- Node.js 18+ and npm
- Rust toolchain (`rustup`)
- On Windows, LLVM may be required for RocksDB builds

## Run the Rust blockchain backend

Open a terminal in the repo root and run:

```powershell
Set-Location c:\GitHub\wallet-ui\rust-blockchain
cargo run --bin blockchain-node
```

Optional consensus modes:

```powershell
cargo run --bin blockchain-node -- --consensus pow
cargo run --bin blockchain-node -- --consensus pos
```

The backend runs on `http://127.0.0.1:8080`.

## Run the frontend

Open a second terminal in the repo root and run:

```powershell
Set-Location c:\GitHub\wallet-ui
npm install
npm run dev
```

The frontend runs on `http://localhost:5173`.

## Recommended startup order

1. Start the Rust backend first.
2. Start the frontend second.
3. Open the Vite URL in your browser.

## Quick checks

- Backend health and status:

```powershell
curl.exe http://127.0.0.1:8080/consensus/status
```

- Query chain data through the CLI:

```powershell
Set-Location c:\GitHub\wallet-ui\rust-blockchain
cargo run --bin blockchain-cli -- sql --query "SELECT * FROM blocks"
```

## Notes

- The frontend expects the backend to be available at `http://127.0.0.1:8080`.
- If RocksDB reports `CURRENT file corrupted`, reset the local dev ledger and rerun the backend:

```powershell
Set-Location c:\GitHub\wallet-ui\rust-blockchain
Remove-Item -Recurse -Force .\ledger
cargo run --bin blockchain-node
```
