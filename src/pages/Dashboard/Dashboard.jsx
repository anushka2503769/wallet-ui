import { useState } from 'react';
import WalletCard from '../../components/wallet/WalletCard';
import TransactionTable from '../../components/tables/TransactionTable';
import BlockList from '../../components/blockchain/BlockList';
import { useWallet } from '../../context/WalletContext';

import { useNavigate } from 'react-router-dom';
import routes from '../../routes';

function Dashboard() {
  const [copied, setCopied] = useState(false);
  const navigate = useNavigate();
  const { wallet: liveWallet, transactions: liveTransactions, blocks: liveBlocks, loading } = useWallet();
  const wallet = {
    balance: liveWallet?.balance ?? 0,
    address: liveWallet?.address ?? '0x7A91E4B6F93D5A4E9A2F1C83D4AB6C21F5D8E9A7',
    network: liveWallet?.network ?? 'Rust Blockchain Testnet'
  };

  const transactionCount = liveTransactions.length;
  const stakedAmount = liveTransactions
    .filter((tx) => String(tx.type || '').toLowerCase().includes('stake'))
    .reduce((sum, tx) => sum + Number(tx.amount || 0), 0);
  const recentBlocks = liveBlocks.slice(0, 5);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(wallet.address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy address: ', err);
    }
  };

  return (
    <div className="page-container">
      {/* Dynamic Upper Layout Split */}
      <div className="grid-2">
        <WalletCard wallet={wallet} />

        <div className="card flex col gap-4 justify-center">
          <h3>Wallet Address</h3>
          
          {/* Integrated address component framework */}
          <div className="address-display">
            <span className="address-text" title={wallet.address}>
              {wallet.address}
            </span>
          </div>

          <div className="flex gap-3">
            <button className="cute-button btn-full" onClick={handleCopy}>
              {copied ? 'Copied!' : 'Copy Address'}
            </button>
          </div>
        </div>
      </div>

      {/* Grid framework for primary statistics block metrics */}
      <div className="stats-grid">
        <div className="card">
          <div className="stat-block">
            <span className="stat-label">Total Balance</span>
            <span className="stat-value">${Number(wallet.balance || 0).toLocaleString()}</span>
          </div>
        </div>

        <div className="card">
          <div className="stat-block">
            <span className="stat-label">Staked Amount</span>
            <span className="stat-value">${Number(stakedAmount || 0).toLocaleString()}</span>
          </div>
        </div>

        <div className="card">
          <div className="stat-block">
            <span className="stat-label">Blocks Mined</span>
            <span className="stat-value stat-up">{recentBlocks.length}</span>
          </div>
        </div>

        <div className="card">
          <div className="stat-block">
            <span className="stat-label">Total Transactions</span>
            <span className="stat-value">{transactionCount}</span>
          </div>
        </div>
      </div>

      {/* Transaction Control Actions Utility Row */}
      <div className="card flex gap-4">
        <button 
          className="cute-button" 
          style={{ flex: 1 }} 
          onClick={() => navigate('/sendreceive')}
        >
          Send
        </button>
        <button 
          className="cute-button" 
          style={{ flex: 1 }} 
          onClick={() => navigate('/sendreceive')}
        >
          Receive
        </button>
        <button 
          className="cute-button" 
          style={{ flex: 1 }} 
          onClick={() => navigate('/staking')}
        >
          Stake
        </button>
      </div>

      {/* Embedded Dynamic Table Modules */}
      <div className="grid-auto">
        <div className="card flex col gap-4">
          <h3>Recent Transactions</h3>
          <TransactionTable transactions={liveTransactions.slice(0, 5)} />
        </div>

        <div className="card flex col gap-4">
          <h3>Recent Blocks</h3>
          <BlockList blocks={recentBlocks} />
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
