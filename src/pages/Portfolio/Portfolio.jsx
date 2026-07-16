import { useState } from 'react';
import { useWallet } from '../../context/WalletContext';
import WalletCard from '../../components/wallet/WalletCard';
import PortfolioChart from '../../components/charts/PortfolioChart';
import TransactionTable from '../../components/tables/TransactionTable';
import BlockList from '../../components/blockchain/BlockList';

function Portfolio() {
  const [copied, setCopied] = useState(false);
  const { wallet: liveWallet, transactions: liveTransactions, blocks: liveBlocks } = useWallet();

  // 1. Live Core State Mapping
  const wallet = {
    balance: liveWallet?.balance ?? 0,
    address: liveWallet?.address ?? '0x7A91E4B6F93D5A4E9A2F1C83D4AB6C21F5D8E9A7',
    network: liveWallet?.network ?? 'Rust Blockchain Testnet'
  };

  const transactionCount = liveTransactions.length;
  const recentBlocks = liveBlocks.slice(0, 5);

  // 2. Real-time Staking Metrics Calculations
  const totalStaked = liveTransactions
    .filter((tx) => String(tx.type || '').toLowerCase().includes('stake'))
    .reduce((sum, tx) => sum + Number(tx.amount || 0), 0);

  // Total Portfolio Value calculation (Liquid Balance + Staked Assets)
  const totalPortfolioValue = wallet.balance + totalStaked;

  // 3. Dynamic Monthly Growth Calculation
  const calculateMonthlyGrowth = () => {
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    
    // Filter transactions that occurred within the last 30 days
    const recentTx = liveTransactions.filter(tx => {
      const txTime = tx.timestamp ? new Date(tx.timestamp).getTime() : Date.now();
      return txTime >= thirtyDaysAgo;
    });

    // Compute the net delta changes (inflows vs outflows) over these 30 days
    const netChange = recentTx.reduce((acc, tx) => {
      const amount = Number(tx.amount || 0);
      const type = String(tx.type || '').toLowerCase();
      
      if (type.includes('receive') || type.includes('mine') || type.includes('reward')) {
        return acc + amount; // Earned/Received assets add to growth
      }
      if (type.includes('send') || type.includes('pay')) {
        return acc - amount; // Spent assets drop total baseline
      }
      return acc;
    }, 0);

    const startingValue = totalPortfolioValue - netChange;

    // Prevent division by zero if it's a completely fresh wallet setup
    if (startingValue <= 0) return "0.0";
    
    const growthPercentage = ((totalPortfolioValue - startingValue) / startingValue) * 100;
    return growthPercentage.toFixed(1);
  };

  const monthlyGrowth = calculateMonthlyGrowth();

  // 4. Dynamic Asset Construction based on Live Token Configurations
  const baseAssets = [
    {
      name: 'Liquid Flow Token (FLOW)',
      value: wallet.balance,
      holdings: (wallet.balance / 1.25).toFixed(2), 
      networkType: wallet.network,
      type: 'Liquid'
    },
    {
      name: 'Staked Flow Vault (sFLOW)',
      value: totalStaked,
      holdings: (totalStaked / 1.25).toFixed(2),
      networkType: wallet.network,
      type: 'Staking'
    }
  ].filter(asset => asset.value > 0);

  const activeAssets = baseAssets.length > 0 ? baseAssets : [
    { name: 'Native Flow Token', value: 0, holdings: '0.00', networkType: wallet.network, type: 'Liquid' }
  ];

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
      {/* Upper Split Block Frame */}
      <div className="grid-2">
        <WalletCard wallet={wallet} />

        <div className="card flex col gap-4 justify-center">
          <h3>Wallet Address</h3>
          
          <div className="address-display">
            <span className="address-text" title={wallet.address}>
              {wallet.address}
            </span>
            {copied && <span className="badge badge-accent">Copied</span>}
          </div>

          <div className="flex gap-3">
            <button className="cute-button btn-full" onClick={handleCopy}>
              {copied ? 'Copied!' : 'Copy Address'}
            </button>
          </div>
        </div>
      </div>

      {/* Synchronized Live High-Level Grid Matrix */}
      <div className="stats-grid">
        <div className="card">
          <div className="stat-block">
            <span className="stat-label">Total Portfolio Value</span>
            <span className="stat-value">${Number(totalPortfolioValue || 0).toLocaleString()}</span>
          </div>
        </div>

        <div className="card">
          <div className="stat-block">
            <span className="stat-label">Staked Assets</span>
            <span className="stat-value">${Number(totalStaked || 0).toLocaleString()}</span>
          </div>
        </div>

        <div className="card">
          <div className="stat-block">
            <span className="stat-label">Monthly Growth</span>
            <span className={`stat-value ${Number(monthlyGrowth) >= 0 ? 'stat-up' : 'stat-down'}`}>
              {Number(monthlyGrowth) >= 0 ? `+${monthlyGrowth}` : monthlyGrowth}%
            </span>
          </div>
        </div>

        <div className="card">
          <div className="stat-block">
            <span className="stat-label">Total Transactions</span>
            <span className="stat-value">{transactionCount}</span>
          </div>
        </div>
      </div>

      {/* Data Visualization & Breakdown mapping */}
      <div className="grid-auto">
        <div className="card" style={{ height: '380px', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', inset: '24px', minWidth: 0, minHeight: 0 }}>
            <PortfolioChart data={activeAssets} />
          </div>
        </div>
        
        <div className="card flex col gap-4">
          <h3>Asset Allocation</h3>
          <div className="flex col gap-4">
            {activeAssets.map((asset) => {
              const allocationPct = totalPortfolioValue > 0 
                ? ((asset.value / totalPortfolioValue) * 100).toFixed(1) 
                : "0.0";
                
              return (
                <div className="flex col gap-2" key={asset.name}>
                  <div className="flex-between">
                    <div>
                      <span className="text-sm" style={{ fontWeight: 600 }}>{asset.name}</span>
                      <p className="text-xs text-muted">{asset.holdings} Holdings</p>
                    </div>
                    <div className="text-right" style={{ textAlign: 'right' }}>
                      <strong className="text-sm">${asset.value.toLocaleString()}</strong>
                      <span className="text-xs text-accent mt-2" style={{ display: 'block', fontWeight: 600 }}>{allocationPct}%</span>
                    </div>
                  </div>
                  <div className="progress">
                    <div className="progress-fill" style={{ width: `${allocationPct}%` }}></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Cute & Fully Integrated Responsive Table Modules */}
      <div className="grid-auto">
        <div className="card flex col gap-4" style={{ minWidth: 0 }}>
          <h3>Recent Transactions</h3>
          <div 
            style={{ 
              width: '100%', 
              overflowX: 'auto', 
              borderRadius: 'var(--r-md)',
              background: 'var(--bg-surface-dim)'
            }}
          >
            <TransactionTable transactions={liveTransactions.slice(0, 5)} />
          </div>
        </div>

        <div className="card flex col gap-4" style={{ minWidth: 0 }}>
          <h3>Recent Blocks</h3>
          <div 
            style={{ 
              width: '100%', 
              overflowX: 'auto', 
              borderRadius: 'var(--r-md)',
              background: 'var(--bg-surface-dim)'
            }}
          >
            <BlockList blocks={recentBlocks} />
          </div>
        </div>
      </div>
              
      {/* Individual Live Asset Cards Breakdown */}
      <div className="grid-auto">
        {activeAssets.map((asset) => (
          <div className="card flex col gap-4" key={asset.name}>
            <div className="flex-between">
              <div>
                <h3 className="text-accent">{asset.name}</h3>
                <p className="text-xs text-muted">{asset.holdings} Holdings</p>
              </div>
              <span className="badge badge-accent">
                {asset.type}
              </span>
            </div>
            
            <div className="stat-block">
              <span className="stat-label">Asset Valuation</span>
              <span className="stat-value" style={{ fontSize: '1.75rem' }}>
                ${asset.value.toLocaleString()}
              </span>
            </div>

            <div className="divider" style={{ margin: 'var(--sp-2) 0' }}></div>

            <div className="flex-between text-xs text-muted">
              <span>Network</span>
              <span className="font-mono text-accent">{asset.networkType}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default Portfolio;
