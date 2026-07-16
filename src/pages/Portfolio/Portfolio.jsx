import { useState } from 'react';
import { useWallet } from '../../context/WalletContext';
import WalletCard from '../../components/wallet/WalletCard';
import PortfolioChart from '../../components/charts/PortfolioChart';
import { TrendingUp, DollarSign, Shield, Copy, Check, Activity } from 'lucide-react';

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

  // 2. Real-time Staking Metrics Calculations
  const totalStaked = liveTransactions
    .filter((tx) => String(tx.type || '').toLowerCase().includes('stake'))
    .reduce((sum, tx) => sum + Number(tx.amount || 0), 0);

  // Total Portfolio Balance calculation (Liquid Balance + Staked Assets)
  const totalBalance = wallet.balance + totalStaked;
  
  // Static placeholder for growth rate metric (can be integrated with historical backend APIs if available later)
  const monthlyGrowth = 12.4; 

  // 3. Dynamic Asset Construction based on Live Token Configurations
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
          <h3>Wallet Identifier Address</h3>
          
          <div className="address-display">
            <span className="address-text" title={wallet.address}>
              {wallet.address}
            </span>
            {copied && <span className="badge badge-accent">Copied</span>}
          </div>

          <div className="flex gap-3">
            <button type="button" className="btn btn-secondary btn-full gap-2" onClick={handleCopy}>
              {copied ? <Check size={16} /> : <Copy size={16} />}
              {copied ? 'Copied Identity!' : 'Copy Hardware Address'}
            </button>
          </div>
        </div>
      </div>

      {/* Synchronized Live High-Level Grid Matrix */}
      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
        
        {/* Total Balance Metric Block */}
        <div className="card flex align-center gap-4">
          <div className="text-accent flex flex-center" style={{ background: 'var(--accent-dim)', padding: '12px', borderRadius: 'var(--r-md)' }}>
            <DollarSign size={22} />
          </div>
          <div className="stat-block">
            <span className="stat-label">Total Balance</span>
            <span className="stat-value">${Number(totalBalance || 0).toLocaleString()}</span>
          </div>
        </div>

        {/* Staked Assets Metric Block */}
        <div className="card flex align-center gap-4">
          <div className="text-accent flex flex-center" style={{ background: 'var(--accent-dim)', padding: '12px', borderRadius: 'var(--r-md)' }}>
            <Shield size={22} />
          </div>
          <div className="stat-block">
            <span className="stat-label">Staked Assets</span>
            <span className="stat-value">${Number(totalStaked || 0).toLocaleString()}</span>
          </div>
        </div>

        {/* Monthly Growth Metric Block */}
        <div className="card flex align-center gap-4">
          <div className="text-accent flex flex-center" style={{ background: 'var(--accent-dim)', padding: '12px', borderRadius: 'var(--r-md)' }}>
            <TrendingUp size={22} />
          </div>
          <div className="stat-block">
            <span className="stat-label">Monthly Growth</span>
            <span className="stat-value stat-up">+{monthlyGrowth}%</span>
          </div>
        </div>

        {/* Total Transactions Metric Block */}
        <div className="card flex align-center gap-4">
          <div className="text-accent flex flex-center" style={{ background: 'var(--accent-dim)', padding: '12px', borderRadius: 'var(--r-md)' }}>
            <Activity size={22} />
          </div>
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
          <h3>Live Asset Allocation</h3>
          <div className="flex col gap-4">
            {activeAssets.map((asset) => {
              const allocationPct = totalBalance > 0 
                ? ((asset.value / totalBalance) * 100).toFixed(1) 
                : "0.0";
                
              return (
                <div className="flex col gap-2" key={asset.name}>
                  <div className="flex-between">
                    <div>
                      <span className="text-sm" style={{ fontWeight: 600 }}>{asset.name}</span>
                      <p className="text-xs text-muted">{asset.holdings} Units Available</p>
                    </div>
                    <div style={{ textAlign: 'right' }}>
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
              
      {/* Individual Live Asset Cards Breakdown */}
      <div className="grid-auto">
        {activeAssets.map((asset) => (
          <div className="card flex col gap-4" key={asset.name}>
            <div className="flex-between">
              <div>
                <h3 className="text-accent">{asset.name}</h3>
                <span className={`badge ${asset.type === 'Staking' ? 'badge-warning' : 'badge-success'} mt-1`}>
                  {asset.type}
                </span>
              </div>
              <span className="text-xs text-muted font-mono">{asset.holdings} Units</span>
            </div>
            
            <div className="stat-block">
              <span className="stat-label">Asset Valuation</span>
              <span className="stat-value" style={{ fontSize: '1.75rem' }}>
                ${asset.value.toLocaleString()}
              </span>
            </div>

            <div className="divider" style={{ margin: 'var(--sp-2) 0' }}></div>

            <div className="flex-between text-xs text-muted">
              <span>Target Node Ecosystem</span>
              <span className="font-mono text-accent">{asset.networkType}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default Portfolio;
