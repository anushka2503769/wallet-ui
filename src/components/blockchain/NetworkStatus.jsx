function NetworkStatus() {
  return (
    <div className="card network-status-card">
      <h3>Network Status</h3>

      <div className="network-status-grid">
        <div>
          <strong>Status</strong>
          <p>Operational</p>
        </div>

        <div>
          <strong>Consensus</strong>
          <p>Casper Proof-of-Stake</p>
        </div>

        <div>
          <strong>Hashing</strong>
          <p>Keccak-256</p>
        </div>

        <div>
          <strong>Connected Nodes</strong>
          <p>24</p>
        </div>
      </div>
    </div>
  );
}

export default NetworkStatus;
