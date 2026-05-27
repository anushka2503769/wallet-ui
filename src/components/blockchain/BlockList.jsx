function BlockList({ blocks }) {
  return (
    <div className="card">
      <h3>Latest Blocks</h3>

      <div className="block-list">
        {blocks.map((block) => (
          <div className="block-item" key={block.hash}>
            <div>
              <strong>#{block.blockNumber}</strong>
            </div>

            <div>{block.hash}</div>

            <div>{block.validator}</div>

            <div>{block.status}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default BlockList;