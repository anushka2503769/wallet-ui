import { useState } from "react";

function Staking() {
  const [amount, setAmount] = useState("");
  
  // Track metrics in component state to reflect updates dynamically
  const [totalStaked, setTotalStaked] = useState(12500);
  const [pendingRewards, setPendingRewards] = useState(312);

  // Initialize event history list inside the state framework
  const [events, setEvents] = useState([
    { id: 1, date: "2025-08-10", action: "Reward", icon: "⚡", iconColor: "var(--success)", amount: 75, status: "Completed" },
    { id: 2, date: "2025-08-01", action: "Stake", icon: "↑", iconColor: "var(--accent)", amount: 5000, status: "Completed" }
  ]);

  const handleSimulateStake = () => {
    const numericAmount = parseFloat(amount);
    if (isNaN(numericAmount) || numericAmount <= 0) return;

    // Get today's local date in YYYY-MM-DD format
    const today = new Date().toISOString().split('T')[0];

    // Create a new event node object
    const newEvent = {
      id: Date.now(),
      date: today,
      action: "Stake",
      icon: "↑",
      iconColor: "var(--accent)",
      amount: numericAmount,
      status: "Completed"
    };

    // Update state variables to trigger page re-render instantly
    setTotalStaked(prev => prev + numericAmount);
    setEvents(prevEvents => [newEvent, ...prevEvents]);
    setAmount(""); // Clear form input text box
  };

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
            <div className="wallet-balance">{totalStaked.toLocaleString()} TFC</div>
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
            <div className="wallet-balance">{pendingRewards.toLocaleString()} TFC</div>
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

          <button 
            className="cute-button btn-full" 
            type="button" 
            disabled={!amount}
            onClick={handleSimulateStake}
          >
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
            {events.map((event) => (
              <tr key={event.id}>
                <td className="font-mono text-muted">{event.date}</td>
                <td style={{ fontWeight: 500 }}>
                  <span style={{ color: event.iconColor }}>{event.icon}</span> {event.action}
                </td>
                <td className="font-mono" style={{ fontWeight: 600 }}>
                  {event.amount.toLocaleString()} TFC
                </td>
                <td>
                  <span className="badge badge-success">{event.status}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default Staking;
