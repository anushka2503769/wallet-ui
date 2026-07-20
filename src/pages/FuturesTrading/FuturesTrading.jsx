import { useEffect, useMemo, useState } from 'react';
import { useCommodityFeed } from '../../hooks/useCommodityFeed';

function FuturesTrading() {
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

  const selectedMarket = useMemo(
    () => markets.find((market) => market.symbol === asset) ?? null,
    [markets, asset]
  );

  const numericQuantity = Number(quantity) || 0;
  const notionalValue = selectedMarket && numericQuantity > 0 ? numericQuantity * selectedMarket.price : null;
  const estimatedFee = notionalValue != null ? notionalValue * 0.0025 : null;

  const submitTrade = async (tradeDirection) => {
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

    setSubmitting(tradeDirection);
    setResult(null);

    const tx = {
      id: '',
      contract_code: 'CommodityTrading',
      contract_action: 'OPEN_FUTURES',
      trade: {
        asset,
        quantity: numericQuantity,
        direction: tradeDirection,
        leverage: Number(leverage),
      },
    };

    try {
      await fetch('http://127.0.0.1:8080/tx/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(tx),
      });

      await fetch('http://127.0.0.1:8080/engine/mine', {
        method: 'POST',
      });

      setResult({ ok: true, message: `${tradeDirection} futures position opened on ${asset}.` });
      setQuantity('');
    } catch (error) {
      setResult({ ok: false, message: error.message });
    }

    setSubmitting(null);
  };

  return (
    <div className="page-container">
      <div className="card flex col gap-4">
        <h3>Futures Trading</h3>

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
          <span>Estimated Fee</span>
          <span className="font-mono">
            {estimatedFee != null ? `${selectedMarket?.currency ?? 'USD'} ${estimatedFee.toFixed(2)}` : '—'}
          </span>
        </div>

        <div className="flex gap-4">
          <button
            className="cute-button btn-full"
            disabled={submitting !== null || !selectedMarket}
            onClick={() => submitTrade('LONG')}
          >
            {submitting === 'LONG' ? 'Opening…' : 'Open Long'}
          </button>

          <button
            className="cute-button btn-full"
            disabled={submitting !== null || !selectedMarket}
            onClick={() => submitTrade('SHORT')}
          >
            {submitting === 'SHORT' ? 'Opening…' : 'Open Short'}
          </button>
        </div>

        {result && (
          <div className="text-sm" style={{ color: result.ok ? 'var(--success)' : 'var(--danger)' }}>
            {result.message}
          </div>
        )}
      </div>
    </div>
  );
}

export default FuturesTrading;