import { useEffect, useState } from 'react';
import mockBlocks from '../../data/mockBlocks.json';

function Explorer() {
  const [blocks, setBlocks] = useState([]);

  useEffect(() => {
    setBlocks(mockBlocks);
  }, []);

  return (
    <div className="page-container">
      <div className="page-header">
        <h2>Blockchain Explorer</h2>
        <p>Latest finalized blocks.</p>
      </div>

      <div className="block-list">
        {blocks.map((block) => (
          <div
            key={block.blockNumber}
            className="card"
          >
            <h3>Block #{block.blockNumber}</h3>

            <p>Hash: {block.hash}</p>
            <p>Validator: {block.validator}</p>
            <p>Status: {block.status}</p>
            <p>Transactions: {block.transactions}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default Explorer;