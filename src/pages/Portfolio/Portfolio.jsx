import portfolioData from '../../data/mockPortfolio.json';
import PortfolioChart from '../../components/charts/PortfolioChart';
import { TrendingUp, DollarSign, Shield } from 'lucide-react';

function Portfolio() {
  const totalValue = portfolioData.assets.reduce(
    (sum, asset) => sum + asset.value, 
    0
  );
  const totalStaked = 52400;

  return (
    <div className="page-container">
      {/* Page Heading Framework */}
      <div className="page-header">
        <h2>Portfolio Overview</h2>
        <p>Monitor your tokenized assets and blockchain investments.</p>
      </div>

      {/* Grid for core wallet matrix */}
      <div className="stats-grid">
        <div className="card flex align-center gap-4">
          <div className="text-accent flex flex-center" style={{ background: 'var(--accent-dim)', padding: '12px', borderRadius: 'var(--r-md)' }}>
            <DollarSign size={22} />
          </div>
          <div className="stat-block">
            <span className="stat-label">Total Portfolio Value</span>
            <span className="stat-value">${totalValue.toLocaleString()}</span>
          </div>
        </div>

        <div className="card flex align-center gap-4">
          <div className="text-accent flex flex-center" style={{ background: 'var(--accent-dim)', padding: '12px', borderRadius: 'var(--r-md)' }}>
            <Shield size={22} />
          </div>
          <div className="stat-block">
            <span className="stat-label">Total Staked</span>
            <span className="stat-value">${totalStaked.toLocaleString()}</span>
          </div>
        </div>

        <div className="card flex align-center gap-4">
          <div className="text-accent flex flex-center" style={{ background: 'var(--accent-dim)', padding: '12px', borderRadius: 'var(--r-md)' }}>
            <TrendingUp size={22} />
          </div>
          <div className="stat-block">
            <span className="stat-label">Total Assets</span>
            <span className="stat-value">{portfolioData.assets.length}</span>
          </div>
        </div>
      </div>

      {/* Main Grid: Data Visualization & Breakdown mapping */}
      <div className="grid-auto">
      
        <div className="card" style={{ height: '380px', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', inset: '24px', minWidth: 0, minHeight: 0 }}>
            <PortfolioChart data={portfolioData.assets} />
          </div>
        </div>
        
        <div className="card flex col gap-4">
          <h3>Asset Allocation</h3>
          <div className="flex col gap-4">
            {portfolioData.assets.map((asset) => {
              const percentage = ((asset.value / totalValue) * 100).toFixed(1);
              return (
                <div className="flex col gap-2" key={asset.name}>
                  <div className="flex-between">
                    <div>
                      <span className="text-sm" style={{ fontWeight: 600 }}>{asset.name}</span>
                      <p className="text-xs text-muted">{asset.holdings} Holdings</p>
                    </div>
                    <div className="text-right" style={{ textAlign: 'right' }}>
                      <strong className="text-sm">${asset.value.toLocaleString()}</strong>
                      <span className="text-xs text-accent mt-2" style={{ display: 'block', fontWeight: 600 }}>{percentage}%</span>
                    </div>
                  </div>
                  <div className="progress">
                    <div className="progress-fill" style={{ width: `${percentage}%` }}></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
              
      {/* Individual asset grid with structural modifiers */}
      <div className="grid-auto">
        {portfolioData.assets.map((asset) => (
          <div className="card flex col gap-4" key={asset.name}>
            <div className="flex-between">
              <div>
                <h3 className="text-accent">{asset.name}</h3>
                <p className="text-xs text-muted">{asset.holdings} Holdings</p>
              </div>
              <span className="badge badge-success stat-up">
                +4.2%
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
              <span className="font-mono text-accent">TradeFlow Testnet</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default Portfolio;