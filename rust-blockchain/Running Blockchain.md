# How to run this project (wallet-ui)

This repository contains a React + Vite frontend and a Rust backend node (in `rust-blockchain`).

## Prerequisites

- Node.js (v16+ recommended) and `npm` or `yarn`.
- Rust toolchain (`rustup`, `cargo`).
- On Windows: Visual Studio Build Tools ("Desktop development with C++") for MSVC builds.
- LLVM install (for `libclang`) on Windows; the scripts use `C:\Program Files\LLVM\bin`.

## Frontend (UI)

1. From the repository root, install dependencies:

```bash
npm install
```

2. Start the dev server:

```bash
npm run dev
```

3. The UI will be served by Vite (default: http://localhost:5173). Build and preview:

```bash
npm run build
npm run preview
```

See the frontend scripts in [package.json](package.json#L1).

## Backend (Rust node)

The Rust project is in the `rust-blockchain` folder and provides two binaries: `blockchain-node` (HTTP node) and `blockchain-cli` (command-line helper). See [rust-blockchain/Cargo.toml](rust-blockchain/Cargo.toml#L1).

Recommended (Windows / MSVC): use the provided helper scripts which set up the MSVC environment and `LIBCLANG_PATH` for you.

1. Build (from repo root or inside `rust-blockchain`):

```powershell
cd rust-blockchain
.\build_with_vcvars_and_libclang.cmd
# or (if you prefer PowerShell helper): .\run_build_with_msvc.ps1
```

The build helper will ensure the `stable-x86_64-pc-windows-msvc` toolchain is available and run `cargo build --bins`.

2. Run the node:

```powershell
cd rust-blockchain
.\run_node_with_vcvars.cmd
```

This script calls `vcvars64.bat`, sets `LIBCLANG_PATH`, and runs the compiled `target\debug\blockchain-node.exe`.

Alternative manual commands (if you have an MSVC environment already):

```powershell
# (example)
call "C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\VC\Auxiliary\Build\vcvars64.bat"
set "LIBCLANG_PATH=C:\Program Files\LLVM\bin"
rustup run stable-x86_64-pc-windows-msvc cargo run --bin blockchain-node
```

3. Run the CLI (submit transactions / run helpers):

```powershell
cd rust-blockchain
rustup run stable-x86_64-pc-windows-msvc cargo run --bin blockchain-cli -- <args>
# or run the built exe: target\debug\blockchain-cli.exe
```

4. Default node API endpoint used by the UI and tests: `http://127.0.0.1:8080`.
Example (PowerShell) to submit a transaction:

```powershell
Invoke-RestMethod -Uri 'http://127.0.0.1:8080/tx/submit' -Method Post -ContentType 'application/json' -Body '{"id":"","contract_code":"deadbeef","contract_action":"init"}'
```

## Mining

The node exposes a simple proof-of-work miner at the endpoint `POST /engine/mine`.
When mining, the node searches for a `nonce` such that the block SHA256 (hex) begins with a small difficulty prefix (currently `0000`). The mined block will include a `nonce` field and the resulting `hash`.

Example (PowerShell) to invoke mining:

```powershell
Invoke-RestMethod -Uri 'http://127.0.0.1:8080/engine/mine' -Method Post
```

Notes:
- Mining runs synchronously in the server and may block while finding a nonce. Adjust the difficulty prefix in `rust-blockchain/src/main.rs` if you need faster/slower mining.
- The stored block JSON includes a `nonce` field; deserialization is backward-compatible (missing `nonce` defaults to `0`).

Try this in powershell:

Invoke-RestMethod -Uri "http://127.0.0.1:8080/tx/submit" -Method POST -ContentType "application/json" -Body '{"id":"","contract_code":"00","contract_action":"deploy"}'

Invoke-RestMethod -Uri "http://127.0.0.1:8080/engine/mine" -Method POST -ContentType "application/json" -Body "{}"

## Troubleshooting

- If the node won't start due to a DB lock, use the provided helper to stop the node and remove the lock file:

```powershell
cd rust-blockchain
.\stop_and_restart_node.ps1
```

- If `vcvars64.bat` is in a different Visual Studio location, edit the `.cmd` files to point to the correct path.
- If `libclang` isn't found, install LLVM and set `LIBCLANG_PATH` to its `bin` folder.
- If builds fail, ensure the `stable-x86_64-pc-windows-msvc` toolchain is installed (`rustup toolchain install stable-x86_64-pc-windows-msvc`).

## Useful files

- [package.json](package.json#L1) — frontend scripts and deps
- [README.md](README.md#L1) — quick frontend notes
- [rust-blockchain/run_node_with_vcvars.cmd](rust-blockchain/run_node_with_vcvars.cmd#L1) — run wrapper
- [rust-blockchain/build_with_vcvars_and_libclang.cmd](rust-blockchain/build_with_vcvars_and_libclang.cmd#L1) — build helper
- [rust-blockchain/stop_and_restart_node.ps1](rust-blockchain/stop_and_restart_node.ps1#L1) — stop/remove LOCK/start

## Next steps

- Start the Rust node, then run the frontend dev server and open the UI in your browser.
