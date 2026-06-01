import { useState } from "react";

function Staking() {
  const [amount, setAmount] = useState("");

  return (
    <div className="page-container">
      <div className="page-header">
        <h2>Staking Centre</h2>
        <p>
          Simulate Proof-of-Stake validation and
          staking operations.
        </p>
      </div>

      <div className="stats-grid">
        <div className="card">
          <h3>Total Staked</h3>
          <div className="wallet-balance">
            12,500 TFC
          </div>
        </div>

        <div className="card">
          <h3>Estimated APR</h3>
          <div className="wallet-balance">
            6.8%
          </div>
        </div>

        <div className="card">
          <h3>Pending Rewards</h3>
          <div className="wallet-balance">
            312 TFC
          </div>
        </div>
      </div>

      <div className="card">
        <h3>Stake Assets</h3>

        <input
          type="number"
          placeholder="Amount to Stake"
          value={amount}
          onChange={(e) =>
            setAmount(e.target.value)
          }
        />

        <button>
          Simulate Stake
        </button>
      </div>

      <div className="card">
        <h3>Validator Status</h3>

        <p>Consensus: Active</p>
        <p>Validators: 12</p>
        <p>Current Epoch: 245</p>
        <p>Network Health: Healthy</p>
      </div>

      <div className="card">
        <h3>Recent Staking Events</h3>

        <table className="table">
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
              <td>2025-08-01</td>
              <td>Stake</td>
              <td>5000 TFC</td>
              <td>Completed</td>
            </tr>

            <tr>
              <td>2025-08-10</td>
              <td>Reward</td>
              <td>75 TFC</td>
              <td>Completed</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default Staking;