import { useEffect, useState } from 'react';
import { useCommodityFeed } from '../../hooks/useCommodityFeed';

// Use whatever host the page itself was loaded from, so this works whether
// you're on the same laptop as the node or viewing it from another machine.
const NODE_URL = `http://${window.location.hostname}:8080`;

function PerpetualsTrading() {
  const { markets } = useCommodityFeed();

  const [asset, setAsset] = useState('xGOLD');
  const [quantity, setQuantity] = useState('');
  const [leverage, setLeverage] = useState(1);
  const [submitting, setSubmitting] = useState(null);
  const [result, setResult] = useState(null);

  useEffect(() => {
    if (markets.length && !markets.some((market) => market.symbol === asset)) {
      setAsset(markets[0].symbol);
    }
  }, [markets, asset]);

  const selectedMarket = markets.find((market) => market.symbol === asset) ?? null;
  const price = selectedMarket?.price ?? null;
  const numericQuantity = Number(quantity) || 0;
  const requiredMargin =
    price != null && numericQuantity > 0 ? (numericQuantity * price) / leverage : null;
  const estimatedFee = requiredMargin != null ? requiredMargin * 0.0025 : null;

  const submitTrade = async (direction) => {
    if (!selectedMarket) {
      setResult({ ok: false, message: 'Select a live commodity first.' });
      return;
    }

    if (numericQuantity < selectedMarket.min_quantity) {
      setResult({
        ok: false,
        message: `Minimum quantity for ${selectedMarket.symbol} is ${selectedMarket.min_quantity} ${selectedMarket.unit}.`,
      });
      return;
    }

    if (numericQuantity <= 0) {
      setResult({ ok: false, message: 'Enter a quantity greater than 0.' });
      return;
    }

    setSubmitting(direction);
    setResult(null);

    const tx = {
      id: '',
      contract_code: 'CommodityTrading',
      contract_action: 'OPEN_PERPETUAL',
      trade: {
        asset,
        quantity: numericQuantity,
        direction,
        leverage: Number(leverage),
      },
    };

    try {
      await fetch(`${NODE_URL}/tx/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(tx),
      });

      await fetch(`${NODE_URL}/engine/mine`, {
        method: 'POST',
      });

      setResult({ ok: true, message: `${direction === 'LONG' ? 'Long' : 'Short'} perpetual position opened on ${asset}.` });
      setQuantity('');
    } catch (err) {
      setResult({ ok: false, message: err.message });
    }

    setSubmitting(null);
  };

  return (
    <div className="page-container">
      <div className="card flex col gap-4">
        <h3>Perpetual Trading</h3>

        <select
          className="trading-select"
          value={asset}
          onChange={(e) => setAsset(e.target.value)}
          disabled={!markets.length}
        >
          {!markets.length && <option>Loading commodities...</option>}
          {markets.map((market) => (
            <option key={market.symbol} value={market.symbol}>
              {market.symbol} — {market.contract_name}
            </option>
          ))}
        </select>

        {selectedMarket && (
          <div className="flex-between text-sm text-muted">
            <span>
              Min {selectedMarket.min_quantity} {selectedMarket.unit}
            </span>
            <span>
              Currency {selectedMarket.currency}
            </span>
          </div>
        )}

        <select
          className="trading-select"
          value={leverage}
          onChange={(e) => setLeverage(Number(e.target.value))}
        >
          <option value={1}>1x</option>
          <option value={5}>5x</option>
          <option value={10}>10x</option>
          <option value={20}>20x</option>
        </select>

        <input
          className="trading-select"
          type="number"
          min={selectedMarket?.min_quantity ?? 0}
          placeholder="Quantity"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
        />

        <div className="flex-between text-sm text-muted">
          <span>Live Price</span>
          <span className="font-mono">{price != null ? `$${price.toFixed(2)}` : 'Loading...'}</span>
        </div>

        <div className="flex-between text-sm text-muted">
          <span>Required Margin</span>
          <span className="font-mono">
            {requiredMargin != null ? `$${requiredMargin.toFixed(2)}` : '—'}
          </span>
        </div>

        <div className="flex-between text-sm text-muted">
          <span>Estimated Fee</span>
          <span className="font-mono">
            {estimatedFee != null ? `${selectedMarket?.currency ?? 'USD'} ${estimatedFee.toFixed(2)}` : '—'}
          </span>
        </div>

        <div className="flex gap-4">
          <button
            className="cute-button btn-full long-button"
            disabled={submitting !== null || !selectedMarket}
            onClick={() => submitTrade('LONG')}
          >
            {submitting === 'LONG' ? 'Opening…' : 'Open Long'}
          </button>

          <button
            className="cute-button btn-full short-button"
            disabled={submitting !== null || !selectedMarket}
            onClick={() => submitTrade('SHORT')}
          >
            {submitting === 'SHORT' ? 'Opening…' : 'Open Short'}
          </button>
        </div>

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

export default PerpetualsTrading;
