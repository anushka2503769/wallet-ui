const validators = [
 {
    name: 'validator-alpha',
    uptime: '99.8%',
    stake: '$420,000',
    status: 'ONLINE'
  },
  {
    name: 'validator-beta',
    uptime: '98.9%',
    stake: '$310,000',
    status: 'ONLINE'
  },
  {
    name: 'validator-gamma',
    uptime: '97.5%',
    stake: '$280,000',
    status: 'SYNCING'
  }
];

function Validators() {
  return (
    <div className="validators-page">
      <div className="page-header">
        <div>
          <h2>Validator Network</h2>
          <p>Monitor active proof-of-stake validators.</p>
        </div>
      </div>

      <div className="validator-grid">
        {validators.map((validator) => (
          <div className="card validator-card" key={validator.name}>
            <div className="validator-top">
              <h3>{validator.name}</h3>

              <span className="validator-status">
                {validator.status}
              </span>
            </div>

            <div className="validator-stats">
              <div>
                <strong>Uptime</strong>
                <p>{validator.uptime}</p>
              </div>

              <div>
                <strong>Total Stake</strong>
                <p>{validator.stake}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default Validators;