import { useWallet } from '../../context/WalletContext';
import WalletCard from '../../components/wallet/WalletCard';
import TransactionTable from '../../components/tables/TransactionTable';
import BlockList from '../../components/blockchain/BlockList';

function Dashboard() {
  const { wallet, transactions, blocks } = useWallet();

  return (
    <div className="dashboard-page">
      <div className="dashboard-grid">
        <WalletCard wallet={wallet} />

        <div className="stats-grid">
          <div className="card">
            <h3>Total Balance</h3>
            <div className="wallet-balance">
              $103,400
            </div>
          </div>

          <div className="card">
            <h3>Staked Assets</h3>
            <div className="wallet-balance">
              $52,400
            </div>
          </div>

          <div className="card">
            <h3>Transactions</h3>
            <div className="wallet-balance">
              124
            </div>
          </div>
        </div>
      </div>

      <TransactionTable transactions={transactions} />

      <BlockList blocks={blocks} />
    </div>
    
  );
}

export default Dashboard;