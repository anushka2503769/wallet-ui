import { useState } from 'react';
import WalletCard from '../../components/wallet/WalletCard';
import TransactionTable from '../../components/tables/TransactionTable';
import BlockList from '../../components/blockchain/BlockList';

import portfolioData from '../../data/mockPortfolio.json';
import transactionData from '../../data/mockTransactions.json';
import blockData from '../../data/mockBlocks.json';

function Dashboard() {
  const [copied, setCopied] = useState(false);

  const wallet = {
    balance: portfolioData.totalValue,
    address: '0x7A91E4B6F93D5A4E9A2F1C83D4AB6C21F5D8E9A7'
  };

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
            <span className="stat-value">${portfolioData.totalValue.toLocaleString()}</span>
          </div>
        </div>

        <div className="card">
          <div className="stat-block">
            <span className="stat-label">Staked Assets</span>
            <span className="stat-value">${portfolioData.stakedValue.toLocaleString()}</span>
          </div>
        </div>

        <div className="card">
          <div className="stat-block">
            <span className="stat-label">Monthly Growth</span>
            <span className="stat-value stat-up">+{portfolioData.monthlyGrowth}%</span>
          </div>
        </div>

        <div className="card">
          <div className="stat-block">
            <span className="stat-label">Total Transactions</span>
            <span className="stat-value">{transactionData.length}</span>
          </div>
        </div>
      </div>

      {/* Transaction Control Actions Utility Row */}
      <div className="card flex gap-4">
        <button className="cute-button" style={{ flex: 1 }}>
          Send
        </button>
        <button className="cute-button" style={{ flex: 1 }}>
          Receive
        </button>
        <button className="cute-button" style={{ flex: 1 }}>
          Stake
        </button>
      </div>

      {/* Embedded Dynamic Table Modules */}
      <div className="grid-auto">
        <div className="card flex col gap-4">
          <h3>Recent Transactions</h3>
          <TransactionTable transactions={transactionData.slice(0, 5)} />
        </div>

        <div className="card flex col gap-4">
          <h3>Recent Blocks</h3>
          <BlockList blocks={blockData.slice(0, 5)} />
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
