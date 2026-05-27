function BlockCard({ block }) {
  return (
    <div className="card block-card">
      <div className="block-top">
        <h3>Block #{block.blockNumber}</h3>

        <span className="block-status">
          {block.status}
        </span>
      </div>

      <div className="block-content">
        <div>
          <strong>Hash</strong>
          <p>{block.hash}</p>
        </div>

        <div>
          <strong>Validator</strong>
          <p>{block.validator}</p>
        </div>
      </div>
    </div>
  );
}

export default BlockCard;
