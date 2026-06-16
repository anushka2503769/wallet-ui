use crate::Block;
use sha2::{Digest, Sha256};
use chrono::Utc;
use serde_json;

// ─────────────────────────────────────────────────────────────
// CONSENSUS TRAIT — both PoW and PoS implement this interface
// ─────────────────────────────────────────────────────────────
pub trait ConsensusEngine: Send + Sync {
    /// Takes an unfinished block and fills in hash, nonce, timestamp
    fn mine(&self, block: &mut Block, prev_hash: &str, tx_payload: &str);

    /// Returns true if the block's hash is valid for this consensus type
    fn verify(&self, block: &Block) -> bool;

    /// Human-readable name shown in API responses
    fn name(&self) -> &'static str;
}

// ─────────────────────────────────────────────────────────────
// PROOF OF WORK
// Keep trying different nonces until hash starts with N zeros
// ─────────────────────────────────────────────────────────────
pub struct ProofOfWork {
    pub difficulty: usize,
}

impl ConsensusEngine for ProofOfWork {
    fn name(&self) -> &'static str {
        "PoW"
    }

    fn mine(&self, block: &mut Block, prev_hash: &str, tx_payload: &str) {
        let prefix = "0".repeat(self.difficulty);
        let timestamp = Utc::now().timestamp();

        block.timestamp = timestamp;
        block.previous_hash = prev_hash.to_string();
        block.nonce = 0;

        loop {
            let input = format!(
                "{}{}{}{}{}",
                block.index, tx_payload, prev_hash, timestamp, block.nonce
            );

            let mut hasher = Sha256::new();
            hasher.update(&input);
            let candidate = format!("{:x}", hasher.finalize());

            if candidate.starts_with(&prefix) {
                block.hash = candidate;
                return;
            }

            block.nonce = block.nonce.wrapping_add(1);
        }
    }

    fn verify(&self, block: &Block) -> bool {
        let prefix = "0".repeat(self.difficulty);

        let tx_payload = serde_json::to_string(&block.transactions).unwrap_or_default();

        let input = format!(
            "{}{}{}{}{}",
            block.index, tx_payload, block.previous_hash, block.timestamp, block.nonce
        );

        let mut hasher = Sha256::new();
        hasher.update(&input);
        let expected = format!("{:x}", hasher.finalize());

        block.hash == expected && block.hash.starts_with(&prefix)
    }
}

// ─────────────────────────────────────────────────────────────
// PROOF OF STAKE
// A validator is chosen based on their stake weight.
// No hash-grinding needed — the chosen validator signs the block.
// ─────────────────────────────────────────────────────────────
pub struct Validator {
    pub address: String,
    pub stake: u64,
}

pub struct ProofOfStake {
    pub validators: Vec<Validator>,
}

impl ProofOfStake {
    /// Weighted random selection: higher stake = more likely to be chosen
    fn select_validator(&self, seed: u64) -> Option<&Validator> {
        if self.validators.is_empty() {
            return None;
        }

        let total_stake: u64 = self.validators.iter().map(|v| v.stake).sum();

        if total_stake == 0 {
            return None;
        }

        let mut pick = seed % total_stake;

        for v in &self.validators {
            if pick < v.stake {
                return Some(v);
            }
            pick -= v.stake;
        }

        self.validators.last()
    }
}

impl ConsensusEngine for ProofOfStake {
    fn name(&self) -> &'static str {
        "PoS"
    }

    fn mine(&self, block: &mut Block, prev_hash: &str, _tx_payload: &str) {
        let seed = Utc::now().timestamp() as u64 ^ block.index;

        let validator_address = self
            .select_validator(seed)
            .map(|v| v.address.clone())
            .unwrap_or_else(|| "genesis-validator".to_string());

        let timestamp = Utc::now().timestamp();

        block.timestamp = timestamp;
        block.previous_hash = prev_hash.to_string();
        block.nonce = 0; // PoS does not grind nonces

        let mut hasher = Sha256::new();
        hasher.update(format!(
            "{}{}{}{}",
            block.index, prev_hash, timestamp, validator_address
        ));
        block.hash = format!("{:x}", hasher.finalize());
    }

    fn verify(&self, block: &Block) -> bool {
        // Valid if hash is well-formed (64 hex characters)
        block.hash.len() == 64 && block.hash.chars().all(|c| c.is_ascii_hexdigit())
    }
}
