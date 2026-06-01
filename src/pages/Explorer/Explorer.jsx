import { useEffect, useState } from 'react';
import mockBlocks from '../../data/mockBlocks.json';

function Explorer() {
  const [blocks, setBlocks] = useState([]);

  useEffect(() => {
    setBlocks(mockBlocks);
  }, []);

  // Maps block status to your core design-system classes
  const getStatusBadgeClass = (status) => {
    switch (status?.toLowerCase()) {
      case 'finalized':
      case 'success':
        return 'badge-success';
      case 'pending':
        return 'badge-warning';
      default:
        return 'badge-muted';
    }
  };

  return (
    <div className="page-container">
      {/* Header System Alignment */}
      <div className="page-header">
        <h2>Blockchain Explorer</h2>
        <p>Latest finalized blocks.</p>
      </div>

      {/* Stacked block list tracking matrix */}
      <div className="block-list">
        {blocks.map((block) => (
          <div key={block.blockNumber} className="card flex col gap-4">
            
            {/* Header section inside card */}
            <div className="flex-between">
              <div>
                <span className="text-xs text-muted font-mono uppercase tracking-wider" style={{ letterSpacing: '0.05em' }}>
                  Block Height
                </span>
                <h3 style={{ marginTop: '2px' }}>#{block.blockNumber}</h3>
              </div>
              <span className={`badge ${getStatusBadgeClass(block.status)}`}>
                {block.status}
              </span>
            </div>

            <div className="divider" style={{ margin: 0 }}></div>

            {/* Core Data Meta Matrix */}
            <div className="grid-auto gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
              
              <div className="stat-block">
                <span className="stat-label">Block Hash</span>
                <span className="font-mono text-sm text-accent truncate" style={{ maxWidth: '240px', display: 'block' }} title={block.hash}>
                  {block.hash}
                </span>
              </div>

              <div className="stat-block">
                <span className="stat-label">Validator Node</span>
                <span className="font-mono text-sm text-muted truncate" style={{ maxWidth: '200px', display: 'block' }} title={block.validator}>
                  {block.validator}
                </span>
              </div>

              <div className="stat-block">
                <span className="stat-label">Transactions Included</span>
                <span className="text-primary" style={{ fontWeight: 600 }}>
                  {block.transactions} txs
                </span>
              </div>

            </div>

          </div>
        ))}
      </div>
    </div>
  );
}

export default Explorer;