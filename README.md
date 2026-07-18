# Wallet UI & Rust Blockchain Core

A decentralized finance (DeFi) wallet dashboard interface integrated with a custom Rust-based blockchain backend. This repository contains both the frontend React application and the underlying blockchain node architecture.

## Project Architecture

The workspace is organized as a monorepo containing the web client and the core blockchain node:

```text
wallet-ui/
├── src/                      # Frontend React Application
│   ├── components/           # Reusable UI parts (Charts, Cards, Tables)
│   ├── context/              # State management (Theme, Wallet data)
│   ├── data/                 # Mock datasets for offline development
│   ├── pages/                # Dashboard views (Portfolio, Staking, Derivatives)
│   └── services/             # API clients & Blockchain provider strategies
├── rust-blockchain/          # Backend Blockchain Core
│   ├── src/                  # Rust engine implementation (P2P, Consensus)
│   ├── ledger/               # Local LevelDB/RocksDB blockchain storage
│   └── blockchain_gui.py     # Python-based diagnostic GUI tool
└── vite.config.js            # Build and development server configuration
