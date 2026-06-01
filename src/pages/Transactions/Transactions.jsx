import { useEffect, useState } from 'react';
import mockTransactions from '../../data/mockTransactions.json';

function Transactions() {
  const [transactions, setTransactions] = useState([]);

  useEffect(() => {
    setTransactions(mockTransactions);
  }, []);

  // Helper utility mapping data payload strings to your global CSS badge rules
  const getStatusBadgeClass = (status) => {
    switch (status?.toLowerCase()) {
      case 'confirmed':
      case 'success':
        return 'badge-success';
      case 'pending':
        return 'badge-warning';
      case 'failed':
        return 'badge-danger';
      default:
        return 'badge-muted';
    }
  };

  return (
    <div className="page-container">
      {/* Structural Page Header Frame */}
      <div className="page-header">
        <h2>Transaction History</h2>
        <p>Recent blockchain transactions.</p>
      </div>

      {/* Surface wrapper with structural padding container overflow rules */}
      <div className="card" style={{ overflowX: 'auto', padding: 0 }}>
        <table className="data-table">
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
              <tr key={tx.id || tx.hash}>
                {/* Applied monospace type engine alongside content truncation bounding rules */}
                <td className="font-mono truncate" style={{ maxWidth: '160px' }} title={tx.hash}>
                  {tx.hash}
                </td>
                
                <td style={{ fontWeight: 500 }}>
                  {tx.type}
                </td>
                
                <td style={{ fontWeight: 600 }}>
                  {typeof tx.amount === 'number' ? `$${tx.amount.toLocaleString()}` : tx.amount}
                </td>
                
                {/* Integrated design-system native badges */}
                <td>
                  <span className={`badge ${getStatusBadgeClass(tx.status)}`}>
                    {tx.status}
                  </span>
                </td>
                
                <td className="font-mono text-muted">
                  #{tx.block}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default Transactions;