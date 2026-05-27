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

        <div className="card">
          <h3>Blockchain Status</h3>
          <p>Network: Online</p>
          <p>Consensus: Active</p>
          <p>Validators: 12</p>
        </div>
      </div>

      <TransactionTable transactions={transactions} />

      <BlockList blocks={blocks} />
    </div>
  );
}

export default Dashboard;