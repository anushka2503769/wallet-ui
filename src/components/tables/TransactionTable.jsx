function TransactionTable({ transactions }) {
  return (
    <div className="card">
      <h3>Transaction History</h3>

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
            <tr key={tx.hash}>
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
  );
}

export default TransactionTable;