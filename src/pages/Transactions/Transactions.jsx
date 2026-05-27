import { useEffect, useState } from 'react';
import mockTransactions from '../../data/mockTransactions.json';

function Transactions() {
  const [transactions, setTransactions] = useState([]);

  useEffect(() => {
    setTransactions(mockTransactions);
  }, []);

  return (
    <div className="page-container">
      <div className="page-header">
        <h2>Transaction History</h2>
        <p>Recent blockchain transactions.</p>
      </div>

      <div className="card">
        <table className="table">
          <thead>
            <tr>
              <th>Hash</th>
              <th>Type</th>
              <th>Amount</th>
              <th>Status</th>
              <th>Block</th>
            </tr>
          </thead>

          <tbody>
            {transactions.map((tx) => (
              <tr key={tx.id}>
                <td>{tx.hash}</td>
                <td>{tx.type}</td>
                <td>${tx.amount}</td>
                <td>{tx.status}</td>
                <td>{tx.block}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default Transactions;