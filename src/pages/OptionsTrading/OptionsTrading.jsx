import { useEffect, useState } from 'react';

const NODE_URL = 'http://127.0.0.1:8080';

function OptionsTrading() {

  const [asset, setAsset] = useState('xGOLD');
  const [quantity, setQuantity] = useState('');
  const [type, setType] = useState('CALL');

  const [markets, setMarkets] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);

  // Live commodity prices, so cost can be previewed before submitting
  useEffect(() => {
    const source = new EventSource(`${NODE_URL}/markets/stream`);

    fetch(`${NODE_URL}/markets`)
      .then((res) => res.json())
      .then(setMarkets)
      .catch(console.error);

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

  const price = markets.find((m) => m.symbol === asset)?.price ?? null;
  const numericQuantity = Number(quantity) || 0;
  const estimatedCost = price != null && numericQuantity > 0 ? numericQuantity * price : null;

  const submitTrade = async () => {
    if (numericQuantity <= 0) {
      setResult({ ok: false, message: 'Enter a quantity greater than 0.' });
      return;
    }

    setSubmitting(true);
    setResult(null);

    const tx = {
      id:'',
      contract_code:'CommodityTrading',
      contract_action:'BUY_OPTION',

      trade:{
        asset,
        quantity: numericQuantity,
        direction:type,
      }
    };

    try {
      await fetch(
        `${NODE_URL}/tx/submit`,
        {
          method:'POST',
          headers:{
            'Content-Type':'application/json'
          },
          body:JSON.stringify(tx)
        }
      );

      await fetch(
        `${NODE_URL}/engine/mine`,
        {
          method:'POST'
        }
      );

      setResult({ ok: true, message: `${type === 'CALL' ? 'Call' : 'Put'} option bought on ${asset}.` });
      setQuantity('');
    } catch (err) {
      setResult({ ok: false, message: err.message });
    }

    setSubmitting(false);
  };

  return (
    <div className="page-container">

      <div className="card flex col gap-4">

        <h3>Options Trading</h3>

        <select
          className="trading-select"
          value={asset}
          onChange={(e)=>setAsset(e.target.value)}
        >
          <option>xGOLD</option>
          <option>xSILVER</option>
          <option>xOIL</option>
        </select>

        <select
          className="trading-select"
          value={type}
          onChange={(e)=>setType(e.target.value)}
        >
          <option>CALL</option>
          <option>PUT</option>
        </select>

        <input
          className="trading-select"
          type="number"
          placeholder="Quantity"
          value={quantity}
          onChange={(e)=>setQuantity(e.target.value)}
        />

        <div className="flex-between text-sm text-muted">
          <span>Live Price</span>
          <span className="font-mono">{price != null ? `$${price.toFixed(2)}` : 'Loading...'}</span>
        </div>

        <div className="flex-between text-sm text-muted">
          <span>Estimated Cost</span>
          <span className="font-mono">
            {estimatedCost != null ? `$${estimatedCost.toFixed(2)}` : '—'}
          </span>
        </div>

        <button
          className="cute-button"
          disabled={submitting}
          onClick={submitTrade}
        >
          {submitting ? 'Buying…' : 'Buy Option'}
        </button>

        {result && (
          <div
            className="text-sm"
            style={{ color: result.ok ? 'var(--success)' : 'var(--danger)' }}
          >
            {result.message}
          </div>
        )}

      </div>

    </div>
  );
}

export default OptionsTrading;
