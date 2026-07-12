use crate::Block;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::sync::{Arc, RwLock};

// ─────────────────────────────────────────────────────────────
// P2P NETWORKING — lightweight HTTP-based gossip so multiple
// blockchain-node instances can stay in sync. Every peer is just
// another node's base URL (e.g. http://192.168.1.12:8080). This
// mirrors the rest of the project's HTTP-first style rather than
// introducing a raw TCP/libp2p layer.
// ─────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PeerHandshake {
    pub address: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BlockAnnouncement {
    pub block: Block,
    pub from: String,
}

pub struct PeerNetwork {
    /// This node's own address, as advertised to peers (e.g. http://127.0.0.1:8080)
    pub self_address: String,
    peers: RwLock<HashSet<String>>,
    client: Client,
}

impl PeerNetwork {
    pub fn new(self_address: String) -> Arc<Self> {
        Arc::new(Self {
            self_address,
            peers: RwLock::new(HashSet::new()),
            client: Client::new(),
        })
    }

    pub fn peers(&self) -> Vec<String> {
        self.peers.read().unwrap().iter().cloned().collect()
    }

    /// Returns true if this was a newly added peer (not already known, not ourselves).
    pub fn add_peer(&self, address: &str) -> bool {
        let address = address.trim_end_matches('/');

        if address.is_empty() || address == self.self_address {
            return false;
        }

        self.peers.write().unwrap().insert(address.to_string())
    }

    pub fn remove_peer(&self, address: &str) {
        self.peers.write().unwrap().remove(address.trim_end_matches('/'));
    }

    /// Connects to a new peer: registers ourselves with them, then asks them
    /// for their known peers so the mesh grows transitively.
    pub async fn connect(self: &Arc<Self>, address: &str) -> Result<(), String> {
        let address = address.trim_end_matches('/').to_string();

        if !self.add_peer(&address) {
            return Ok(()); // already known, or ourselves — nothing to do
        }

        let handshake = PeerHandshake { address: self.self_address.clone() };

        self.client
            .post(format!("{address}/p2p/peers/register"))
            .json(&handshake)
            .send()
            .await
            .map_err(|e| format!("could not reach {address}: {e}"))?;

        // Best-effort: learn about their peers too.
        if let Ok(resp) = self.client.get(format!("{address}/p2p/peers")).send().await {
            if let Ok(their_peers) = resp.json::<Vec<String>>().await {
                for p in their_peers {
                    self.add_peer(&p);
                }
            }
        }

        Ok(())
    }

    /// Broadcasts a block to every known peer, except (optionally) the one
    /// that sent it to us — avoids immediately bouncing it back.
    pub fn broadcast_block(&self, block: &Block, exclude: Option<&str>) {
        let announcement = BlockAnnouncement {
            block: block.clone(),
            from: self.self_address.clone(),
        };

        for peer in self.peers() {
            if Some(peer.as_str()) == exclude {
                continue;
            }

            let client = self.client.clone();
            let announcement = announcement.clone();

            tokio::spawn(async move {
                let _ = client
                    .post(format!("{peer}/p2p/blocks/announce"))
                    .json(&announcement)
                    .send()
                    .await;
            });
        }
    }

    /// Fetches a peer's full chain — used to catch up or resolve a fork.
    pub async fn fetch_chain(&self, peer: &str) -> Result<Vec<Block>, String> {
        let resp = self
            .client
            .get(format!("{peer}/p2p/chain"))
            .send()
            .await
            .map_err(|e| e.to_string())?;

        resp.json::<Vec<Block>>().await.map_err(|e| e.to_string())
    }
}
