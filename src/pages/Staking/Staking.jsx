import { useState } from "react";

function Staking() {
  const [amount, setAmount] = useState("");

  return (
    <div className="page-container">
      {/* Structural Page Header Frame */}
      <div className="page-header">
        <h2>Staking Centre</h2>
        <p>
          Simulate Proof-of-Stake validation and staking operations.
        </p>
      </div>

      {/* Primary Analytics Metric Strip */}
      <div className="stats-grid">
        <div className="card">
          <div className="stat-block">
            <span className="stat-label">Total Staked</span>
            <div className="wallet-balance">12,500 TFC</div>
          </div>
        </div>

        <div className="card">
          <div className="stat-block">
            <span className="stat-label">Estimated APR</span>
            <div className="wallet-balance" style={{ color: 'var(--success)' }}>6.8%</div>
          </div>
        </div>

        <div className="card">
          <div className="stat-block">
            <span className="stat-label">Pending Rewards</span>
            <div className="wallet-balance">312 TFC</div>
          </div>
        </div>
      </div>

      {/* Main Interactive Workspace Panels */}
      <div className="grid-2">
        {/* Left Side: Staking Interaction Form */}
        <div className="card flex col gap-4">
          <h3>Stake Assets</h3>
          
          <div className="form-group">
            <label className="form-label">Stake Allocation</label>
            <input
              type="number"
              className="form-input"
              placeholder="0.00 TFC"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>

          <button className="cute-button btn-full" type="button" disabled={!amount}>
            Simulate Stake
          </button>
        </div>

        {/* Right Side: Network Validator Operational Status */}
        <div className="card flex col gap-3">
          <h3>Validator Status</h3>
          <div className="divider" style={{ margin: 'var(--sp-1) 0' }}></div>
          
          <div className="flex-between">
            <span className="text-sm text-muted">Consensus State</span>
            <span className="badge badge-success">Active</span>
          </div>

          <div className="flex-between">
            <span className="text-sm text-muted">Active Validators</span>
            <span className="font-mono text-primary" style={{ fontWeight: 600 }}>12 Nodes</span>
          </div>

          <div className="flex-between">
            <span className="text-sm text-muted">Current Epoch</span>
            <span className="font-mono text-accent" style={{ fontWeight: 600 }}>#245</span>
          </div>

          <div className="flex-between">
            <span className="text-sm text-muted">Network Vitality</span>
            <span className="badge badge-accent">Healthy</span>
          </div>
        </div>
      </div>

      {/* Ledger Historical Log Sheet */}
      <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
        <div style={{ padding: 'var(--sp-6) var(--sp-6) 0 var(--sp-6)' }}>
          <h3>Recent Staking Events</h3>
        </div>
        <div className="divider" style={{ marginBottom: 0 }}></div>
        
        <table className="data-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Action</th>
              <th>Amount</th>
              <th>Status</th>
            </tr>
          </thead>

          <tbody>
            <tr>
              <td className="font-mono text-muted">2025-08-01</td>
              <td style={{ fontWeight: 500 }}>
                <span className="text-accent">↑</span> Stake
              </td>
              <td className="font-mono" style={{ fontWeight: 600 }}>5,000 TFC</td>
              <td>
                <span className="badge badge-success">Completed</span>
              </td>
            </tr>

            <tr>
              <td className="font-mono text-muted">2025-08-10</td>
              <td style={{ fontWeight: 500 }}>
                <span style={{ color: 'var(--success)' }}>⚡</span> Reward
              </td>
              <td className="font-mono" style={{ fontWeight: 600 }}>75 TFC</td>
              <td>
                <span className="badge badge-success">Completed</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default Staking;