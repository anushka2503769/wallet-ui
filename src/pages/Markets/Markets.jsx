import { useEffect, useRef, useState } from 'react';
import { TrendingUp, TrendingDown, Radio, Cpu } from 'lucide-react';

// Use whatever host the page itself was loaded from (localhost, a LAN IP,
// or a Tailscale/VPN address) so this works whether you're on the same
// laptop as the node or viewing it from another machine on the network.
const NODE_URL = `http://${window.location.hostname}:8080`;

function formatUpdatedAt(ts) {
  if (!ts) return '—';
  return new Date(ts * 1000).toLocaleTimeString();
}

function Markets() {
  const [markets, setMarkets] = useState([]);
  const [wallet, setWallet] = useState(null);
  const [connected, setConnected] = useState(false);

  // Per-symbol flash direction, cleared a moment after each update.
  const [flash, setFlash] = useState({});
  const prevPrices = useRef({});
  const flashTimers = useRef({});

  // Trade form
  const [tradeForm, setTradeForm] = useState({
    asset: '',
    action: 'OPEN_FUTURES',
    quantity: '1',
    direction: 'long',
    leverage: '',
    positionId: '',
  });
  const [tradeBusy, setTradeBusy] = useState(false);
  const [tradeResult, setTradeResult] = useState(null);

  // Mining
  const [mining, setMining] = useState(false);
  const [minedBlock, setMinedBlock] = useState(null);

  function applyUpdate(entry) {
    const prevPrice = prevPrices.current[entry.symbol];

    if (prevPrice != null && prevPrice !== entry.price) {
      const direction = entry.price > prevPrice ? 'up' : 'down';
      setFlash((f) => ({ ...f, [entry.symbol]: direction }));
      clearTimeout(flashTimers.current[entry.symbol]);
      flashTimers.current[entry.symbol] = setTimeout(() => {
        setFlash((f) => ({ ...f, [entry.symbol]: null }));
      }, 1200);
    }
    prevPrices.current[entry.symbol] = entry.price;

    setMarkets((prev) => {
      const next = [...prev];
      const idx = next.findIndex((m) => m.symbol === entry.symbol);
      if (idx === -1) next.push(entry);
      else next[idx] = entry;
      return next.sort((a, b) => a.symbol.localeCompare(b.symbol));
    });
  }

  // Initial snapshot
  useEffect(() => {
    fetch(`${NODE_URL}/markets`)
      .then((res) => res.json())
      .then((data) => {
        setMarkets(data);
        data.forEach((m) => { prevPrices.current[m.symbol] = m.price; });
        if (data.length) {
          setTradeForm((f) => (f.asset ? f : { ...f, asset: data[0].symbol }));
        }
      })
      .catch(console.error);
  }, []);

  // Live updates over SSE — pushed the instant the node refreshes a commodity price
  useEffect(() => {
    const source = new EventSource(`${NODE_URL}/markets/stream`);

    source.onopen = () => setConnected(true);
    source.onerror = () => setConnected(false);
    source.onmessage = (event) => {
      try {
        applyUpdate(JSON.parse(event.data));
      } catch (err) {
        console.error('Failed to parse price update', err);
      }
    };

    return () => source.close();
  }, []);

  // Wallet
  useEffect(() => {
    fetch(`${NODE_URL}/wallet`)
      .then((res) => res.json())
      .then(setWallet)
      .catch(console.error);
  }, []);

  async function handleSubmitTrade(e) {
    e.preventDefault();
    if (!tradeForm.asset) return;

    setTradeBusy(true);
    setTradeResult(null);

    try {
      const res = await fetch(`${NODE_URL}/tx/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: '',
          contract_code: tradeForm.positionId || '',
          contract_action: tradeForm.action,
          trade: {
            asset: tradeForm.asset,
            quantity: parseFloat(tradeForm.quantity) || 0,
            direction: tradeForm.direction,
            leverage: tradeForm.leverage ? parseFloat(tradeForm.leverage) : null,
          },
        }),
      });
      const data = await res.json();
      setTradeResult({ ok: res.ok, data });
    } catch (err) {
      setTradeResult({ ok: false, data: { error: err.message } });
    }

    setTradeBusy(false);
  }

  async function handleMineBlock() {
    setMining(true);
    setMinedBlock(null);

    try {
      const res = await fetch(`${NODE_URL}/engine/mine`, { method: 'POST' });
      setMinedBlock(await res.json());
    } catch (err) {
      setMinedBlock({ error: err.message });
    }

    setMining(false);
  }

  return (
    <div className="page-container">
      <div className="page-header flex-between">
        <div>
          <h2>Commodity Markets</h2>
          <p>Live Gold, Silver, and Oil prices streamed from Yahoo Finance.</p>
        </div>
        <span className={`badge ${connected ? 'badge-success' : 'badge-danger'}`}>
          <Radio size={12} style={{ marginRight: 4 }} />
          {connected ? 'Live' : 'Disconnected'}
        </span>
      </div>

      <h1 style={{ marginBottom: 'var(--sp-4)' }}>
        Wallet Balance: ${wallet ? wallet.balance.toFixed(2) : 'Loading...'}
      </h1>

      <div className="grid-auto">
        {markets.map((market) => (
          <div
            key={market.symbol}
            className="card"
            style={{
              transition: 'background-color 0.3s',
              backgroundColor:
                flash[market.symbol] === 'up'
                  ? 'color-mix(in srgb, var(--success) 12%, transparent)'
                  : flash[market.symbol] === 'down'
                  ? 'color-mix(in srgb, var(--danger) 12%, transparent)'
                  : undefined,
            }}
          >
            <div className="flex-between">
              <h3>{market.symbol}</h3>
              {flash[market.symbol] === 'up' && <TrendingUp size={16} style={{ color: 'var(--success)' }} />}
              {flash[market.symbol] === 'down' && <TrendingDown size={16} style={{ color: 'var(--danger)' }} />}
            </div>

            <div className="stat-block">
              <span className="stat-label">Price ({market.yahoo_symbol})</span>
              <span className="stat-value">${market.price.toFixed(2)}</span>
            </div>

            <div className="flex-between text-xs text-muted" style={{ marginTop: 'var(--sp-2)' }}>
              <span>{market.live ? 'Live' : 'Seed value'}</span>
              <span>{formatUpdatedAt(market.updated_at)}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="grid-2" style={{ marginTop: 'var(--sp-6)' }}>
        {/* Trade form — submits against the live commodity feed */}
        <div className="card flex col gap-4">
          <h3>Trade Commodity</h3>

          <form onSubmit={handleSubmitTrade} className="flex col gap-4">
            <div className="form-group">
              <label className="form-label">Asset</label>
              <select
                className="form-input"
                value={tradeForm.asset}
                onChange={(e) => setTradeForm((f) => ({ ...f, asset: e.target.value }))}
              >
                {markets.map((m) => (
                  <option key={m.symbol} value={m.symbol}>
                    {m.symbol} — ${m.price.toFixed(2)}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Action</label>
              <select
                className="form-input"
                value={tradeForm.action}
                onChange={(e) => setTradeForm((f) => ({ ...f, action: e.target.value }))}
              >
                <option value="OPEN_FUTURES">Open Futures</option>
                <option value="OPEN_PERPETUAL">Open Perpetual</option>
                <option value="BUY_OPTION">Buy Option</option>
                <option value="CLOSE_POSITION">Close Position</option>
              </select>
            </div>

            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Quantity</label>
                <input
                  className="form-input"
                  type="number"
                  step="any"
                  value={tradeForm.quantity}
                  onChange={(e) => setTradeForm((f) => ({ ...f, quantity: e.target.value }))}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Direction</label>
                <select
                  className="form-input"
                  value={tradeForm.direction}
                  onChange={(e) => setTradeForm((f) => ({ ...f, direction: e.target.value }))}
                >
                  <option value="long">Long</option>
                  <option value="short">Short</option>
                </select>
              </div>
            </div>

            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Leverage (optional)</label>
                <input
                  className="form-input"
                  type="number"
                  step="any"
                  placeholder="e.g. 5"
                  value={tradeForm.leverage}
                  onChange={(e) => setTradeForm((f) => ({ ...f, leverage: e.target.value }))}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Position ID (close only)</label>
                <input
                  className="form-input mono"
                  type="text"
                  placeholder="required for close"
                  value={tradeForm.positionId}
                  onChange={(e) => setTradeForm((f) => ({ ...f, positionId: e.target.value }))}
                />
              </div>
            </div>

            <button
              type="submit"
              className="cute-button btn-full"
              disabled={tradeBusy || !tradeForm.asset}
            >
              {tradeBusy ? 'Submitting…' : 'Submit Trade to Mempool'}
            </button>
          </form>

          {tradeResult && (
            <pre
              className="text-xs"
              style={{
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-all',
                color: tradeResult.ok ? 'var(--text-secondary)' : 'var(--danger)',
                margin: 0,
              }}
            >
              {JSON.stringify(tradeResult.data, null, 2)}
            </pre>
          )}
        </div>

        {/* Mine — creates a block priced against whatever the feed says right now */}
        <div className="card flex col gap-4">
          <h3>Create Block</h3>
          <p className="text-sm text-muted">
            Mines a new block. Any pending trades in the mempool are priced against the
            live commodity feed at the moment of mining.
          </p>

          <button
            className="btn btn-secondary btn-full"
            type="button"
            onClick={handleMineBlock}
            disabled={mining}
          >
            <Cpu size={15} style={{ marginRight: 6 }} />
            {mining ? 'Mining…' : 'Mine Block Now'}
          </button>

          {minedBlock && !minedBlock.error && (
            <div className="flex col gap-2 text-xs text-muted">
              <div className="flex-between">
                <span>Block</span>
                <span className="font-mono">#{minedBlock.index}</span>
              </div>
              <div className="flex-between">
                <span>Hash</span>
                <span className="font-mono">{(minedBlock.hash || '').slice(0, 18)}…</span>
              </div>
              <div className="flex-between">
                <span>Transactions</span>
                <span className="font-mono">{(minedBlock.transactions || []).length}</span>
              </div>
            </div>
          )}

          {minedBlock?.error && (
            <div className="text-xs" style={{ color: 'var(--danger)' }}>
              {minedBlock.error}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Markets;
