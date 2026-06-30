import { useEffect, useState } from 'react';

function TradeHistory() {
  const [trades, setTrades] = useState([]);

  useEffect(() => {
    fetch('http://127.0.0.1:8080/trade-history')
      .then(res => res.json())
      .then(data => setTrades(data));
  }, []);

  return (
    <div className="page-container">

      <div className="card">
        <h2>Trade History</h2>

        <div className="table-container">
          <table className="data-table">

            <thead>
              <tr>
                <th>Time</th>
                <th>Block</th>
                <th>Asset</th>
                <th>Direction</th>
                <th>Quantity</th>
                <th>Leverage</th>
                <th>Action</th>
                <th>Status</th>
              </tr>
            </thead>

            <tbody>
              {trades.map((trade, index) => (
                <tr key={index}>
                  
                  <td>
                    {trade.block_timestamp
                      ? new Date(trade.block_timestamp * 1000).toLocaleString()
                      : '-'}
                  </td>

                  <td>{trade.block}</td>

                  <td>
                    <strong>{trade.asset}</strong>
                  </td>

                  <td>
                    <span
                      className={
                        trade.direction === 'LONG'
                          ? 'status-open'
                          : 'status-closed'
                      }
                    >
                      {trade.direction}
                    </span>
                  </td>

                  <td>{trade.quantity}</td>

                  <td>
                    {trade.leverage
                      ? `${trade.leverage}x`
                      : '-'}
                  </td>

                  <td>{trade.action}</td>

                  <td>
                    <span
                      className={
                        trade.closed
                          ? 'badge badge-danger'
                          : 'badge badge-success'
                      }
                    >
                      {trade.closed ? 'Closed' : 'Open'}
                    </span>
                  </td>

                </tr>
              ))}
            </tbody>

          </table>
        </div>

      </div>

    </div>
  );
}

export default TradeHistory;