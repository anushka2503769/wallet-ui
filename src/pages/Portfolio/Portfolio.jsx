import portfolioData from '../../data/mockPortfolio.json';
import PortfolioChart from '../../components/charts/PortfolioChart';
import { TrendingUp, DollarSign, PieChart, Shield } from 'lucide-react';

function Portfolio() {
  const totalValue = portfolioData.assets.reduce(
    (sum, asset) => sum + asset.value, 
    0
  );
  const totalStaked = 52400;
  const monthlyGrowth = 12.4;

  return (
    <div className="portfolio-page">
      <div className="page-header">
        <div>
          <h2>Portfolio Overview</h2>
          <p>Monitor your tokenized assets and blockchain investments.</p>
        </div>
      </div>

      {/* Grid for top statistics */}
      <div className="stats-grid">
        <div className="card stat-card">
          <div className="stat-icon">
            <DollarSign size={22} />
          </div>
          <div>
            <h4>Total Portfolio Value</h4>
            <h2>${totalValue.toLocaleString()}</h2>
          </div>
        </div>

        <div className="card stat-card">
          <div className="stat-icon">
            <Shield size={22} />
          </div>
          <div>
            <h4>Total Staked</h4>
            <h2>${totalStaked.toLocaleString()}</h2>
          </div>
        </div>

        <div className="card stat-card">
          <div className="stat-icon">
            <TrendingUp size={22} />
          </div>
          <div>
            <h4>Total Assets</h4>
            <h2>{portfolioData.assets.length}</h2>
          </div>
        </div>
      </div> {/* Fixed: Properly closed stats-grid here */}

      {/* Main layout grid for charts and allocation */}
      <div className="portfolio-main-grid">
        <PortfolioChart data={portfolioData.assets} />
        
        <div className="card allocation-card">
          <h3>Asset Allocation</h3>
          <div className="allocation-list">
            {portfolioData.assets.map((asset) => {
              const percentage = ((asset.value / totalValue) * 100).toFixed(1);
              return (
                <div className="allocation-item" key={asset.name}>
                  <div>
                    <h4>{asset.name}</h4>
                    <p>{asset.holdings} Holdings</p>
                  </div>
                  <div className="allocation-right">
                    <strong>${asset.value.toLocaleString()}</strong>
                    <span>{percentage}%</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div> {/* Fixed: Properly closed portfolio-main-grid here */}

      {/* Individual assets grid */}
      <div className="asset-grid">
        {portfolioData.assets.map((asset) => (
          <div className="card asset-card" key={asset.name}>
            <div className="asset-top">
              <div>
                <h3>{asset.name}</h3>
                <p>{asset.holdings} Holdings</p>
              </div>
              <div className="asset-growth positive">
                +4.2%
              </div>
            </div>
            <div className="asset-value">
              ${asset.value.toLocaleString()}
            </div>
            <div className="asset-footer">
              <span>Network: TradeFlow Testnet</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default Portfolio;
