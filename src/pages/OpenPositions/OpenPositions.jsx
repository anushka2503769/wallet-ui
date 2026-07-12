import { useEffect, useState } from 'react';

// Use whatever host the page itself was loaded from, so this works whether
// you're on the same laptop as the node or viewing it from another machine.
const NODE_URL = `http://${window.location.hostname}:8080`;

function OpenPositions() {

  const [positions, setPositions] = useState([]);
  const [markets, setMarkets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [closingId, setClosingId] = useState(null);

  function fetchPositions() {
    return fetch(`${NODE_URL}/positions`)
      .then(res => res.json())
      .then(setPositions);
  }

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetchPositions(),
      fetch(`${NODE_URL}/markets`).then(res => res.json()).then(setMarkets),
    ]).finally(() => setLoading(false));

    // Keep prices current while this page is open
    const source = new EventSource(`${NODE_URL}/markets/stream`);
    source.onmessage = (event) => {
      try {
        const entry = JSON.parse(event.data);
        setMarkets((prev) => {
          const next = [...prev];
          const idx = next.findIndex((m) => m.symbol === entry.symbol);
          if (idx === -1) next.push(entry);
          else next[idx] = entry;
          return next;
        });
      } catch (err) {
        console.error('Failed to parse price update', err);
      }
    };

    return () => source.close();
  }, []);

  const closePosition = async (positionId) => {
    setClosingId(positionId);

    try {
      await fetch(
        `${NODE_URL}/tx/submit`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            id: '',
            contract_code: positionId,
            contract_action: 'CLOSE_POSITION'
          })
        }
      );

      await fetch(
        `${NODE_URL}/engine/mine`,
        {
          method: 'POST'
        }
      );

      await fetchPositions();
    } catch (err) {
      console.error('Failed to close position: ', err);
    }

    setClosingId(null);
  };

  return (
    <div className="page-container">

      {loading && <p className="text-muted">Loading positions...</p>}

      {!loading && positions.length === 0 && (
        <div className="card" style={{ textAlign: 'center', padding: 'var(--sp-12)' }}>
          <p>No open positions. Open one from Perpetuals or Options trading.</p>
        </div>
      )}

      <div className="grid-auto">

        {positions.map(position => {
          const livePrice = markets.find(m => m.symbol === position.asset)?.price;

          return (
            <div
              key={position.id}
              className="card flex col gap-2"
            >
              <div className="flex-between">
                <h3>{position.asset}</h3>
                <span className="badge badge-accent">{position.position_type}</span>
              </div>

              <p>
                {position.direction}
              </p>

              <p>
                Qty: {position.quantity}
              </p>

              {position.leverage != null && (
                <p>
                  Leverage: {position.leverage}x
                </p>
              )}

              <div className="flex-between text-sm text-muted">
                <span>Live Price</span>
                <span className="font-mono">
                  {livePrice != null ? `$${livePrice.toFixed(2)}` : 'Loading...'}
                </span>
              </div>

              <button
                className="cute-button"
                disabled={closingId === position.id}
                onClick={() => closePosition(position.id)}
              >
                {closingId === position.id ? 'Closing…' : 'Close Position'}
              </button>

            </div>
          );
        })}

      </div>

    </div>
  );
}

export default OpenPositions;
