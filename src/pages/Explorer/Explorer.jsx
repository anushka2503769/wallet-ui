import { useWallet } from '../../context/WalletContext';
import BlockList from '../../components/blockchain/BlockList';

function Explorer() {
  const { blocks } = useWallet();

  return (
    <div className="explorer-page">
      <div className="page-header">
        <div>
          <h2>Blockchain Explorer</h2>
          <p>Track blockchain activity and validator confirmations.</p>
        </div>
      </div>

      <div className="explorer-stats-grid">
        <div className="card explorer-stat">
          <h4>Current Height</h4>
          <h2>12,047</h2>
        </div>

        <div className="card explorer-stat">
          <h4>Transactions Per Second</h4>
          <h2>1,240 TPS</h2>
        </div>

        <div className="card explorer-stat">
          <h4>Network Status</h4>
          <h2>Operational</h2>
        </div>

        <div className="card explorer-stat">
          <h4>Consensus</h4>
          <h2>Casper PoS</h2>
        </div>
      </div>

      <BlockList blocks={blocks} />

      <div className="card chain-health-card">
        <h3>Chain Health</h3>

        <div className="health-grid">
          <div>
            <strong>Finalized Blocks</strong>
            <p>99.91%</p>
          </div>

          <div>
            <strong>Validator Participation</strong>
            <p>12 / 12 Active</p>
          </div>

          <div>
            <strong>Average Finality</strong>
            <p>1.8s</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Explorer;