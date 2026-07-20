import { useEffect, useMemo, useRef, useState } from 'react';
import { LineChart, Line, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { TrendingUp, TrendingDown, Radio, Cpu } from 'lucide-react';

// Use whatever host the page itself was loaded from (localhost, a LAN IP,
// or a Tailscale/VPN address) so this works whether you're on the same
// laptop as the node or viewing it from another machine on the network.
const NODE_URL = `http://${window.location.hostname}:8080`;

function formatUpdatedAt(ts) {
  if (!ts) return '—';
  return new Date(ts * 1000).toLocaleTimeString();
}

// Formats a price in whatever currency the commodity is denominated in
// (built-ins are USD, but a custom commodity could be anything).
function formatPrice(value, currency) {
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: currency || 'USD',
    }).format(value);
  } catch {
    // Intl throws on an invalid/unrecognized currency code — fall back
    // to just tagging the raw code on instead of crashing the page.
    return `${Number(value).toFixed(2)} ${currency || ''}`.trim();
  }
}

function Markets() {
  const [markets, setMarkets] = useState([]);
  const [wallet, setWallet] = useState(null);
  const [connected, setConnected] = useState(false);
  const [mempool, setMempool] = useState([]);

  // Per-symbol flash direction, cleared a moment after each update.
  const [flash, setFlash] = useState({});
  const prevPrices = useRef({});
  const flashTimers = useRef({});
  const priceHistory = useRef({});
  const [historyTick, setHistoryTick] = useState(0);

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
  const tradeFeeRate = 0.0025;

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

    const timestamp = entry.updated_at ?? Math.floor(Date.now() / 1000);
    const history = priceHistory.current[entry.symbol] ?? [];
    priceHistory.current[entry.symbol] = [...history, { timestamp, price: entry.price }].slice(-24);
    setHistoryTick((value) => value + 1);

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
        data.forEach((m) => {
          priceHistory.current[m.symbol] = [{ timestamp: m.updated_at ?? Math.floor(Date.now() / 1000), price: m.price }];
        });
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

  useEffect(() => {
    refreshMempool();
  }, []);

  // Wallet
  useEffect(() => {
    fetch(`${NODE_URL}/wallet`)
      .then((res) => res.json())
      .then(setWallet)
      .catch(console.error);
  }, []);

  const selectedMarket = markets.find((m) => m.symbol === tradeForm.asset);
  const selectedHistory = selectedMarket ? (priceHistory.current[selectedMarket.symbol] ?? []) : [];
  const chartData = selectedHistory.map((point) => ({
    time: new Date(point.timestamp * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    price: Number(point.price) || 0,
  }));
  const notionalValue = selectedMarket && tradeForm.action !== 'CLOSE_POSITION'
    ? (parseFloat(tradeForm.quantity) || 0) * selectedMarket.price
    : null;
  const estimatedFee = notionalValue != null ? notionalValue * tradeFeeRate : null;

  const queueSummary = useMemo(() => {
    const summary = { bid: 0, sell: 0 };

    for (const tx of mempool) {
      const action = String(tx.contract_action || '').toUpperCase();
      const direction = String(tx.trade?.direction || '').toUpperCase();

      if (action === 'CLOSE_POSITION') continue;

      if (action === 'BUY_OPTION') {
        if (direction === 'PUT') summary.sell += 1;
        else summary.bid += 1;
        continue;
      }

      if (direction === 'SHORT' || direction === 'PUT') summary.sell += 1;
      else summary.bid += 1;
    }

    return summary;
  }, [mempool]);

  async function refreshMempool() {
    try {
      const res = await fetch(`${NODE_URL}/mempool`);
      const data = await res.json();
      setMempool(Array.isArray(data) ? data : []);
    } catch {
      setMempool([]);
    }
  }

  async function handleSubmitTrade(e) {
    e.preventDefault();

    setTradeBusy(true);
    setTradeResult(null);

    // Client-side minimum-quantity check — the node enforces this too, but
    // catching it here saves a round trip and gives a clearer message.
    if (tradeForm.action !== 'CLOSE_POSITION' && selectedMarket) {
      const qty = parseFloat(tradeForm.quantity) || 0;
      if (qty < selectedMarket.min_quantity) {
        setTradeResult({
          ok: false,
          data: {
            error: `Minimum quantity for ${selectedMarket.symbol} is ${selectedMarket.min_quantity} ${selectedMarket.unit}.`,
          },
        });
        setTradeBusy(false);
        return;
      }
    }

    try {

      let tx;

      if (tradeForm.action === 'OPEN_FUTURES') {

        tx = {
          id: '',
          contract_code: 'CommodityTrading',
          contract_action: 'OPEN_FUTURES',

          trade: {
            asset: tradeForm.asset,
            quantity: parseFloat(tradeForm.quantity) || 1,
            direction: tradeForm.direction,
            leverage: parseFloat(tradeForm.leverage) || 1,
          },
        };

      } else if (tradeForm.action === 'OPEN_PERPETUAL') {

        tx = {
          id: '',
          contract_code: 'CommodityTrading',
          contract_action: 'OPEN_PERPETUAL',

          trade: {
            asset: tradeForm.asset,
            quantity: parseFloat(tradeForm.quantity) || 1,
            direction: tradeForm.direction,
            leverage: parseFloat(tradeForm.leverage) || 1,
          },
        };

      } else if (tradeForm.action === 'BUY_OPTION') {

        tx = {
          id: '',
          contract_code: 'CommodityTrading',
          contract_action: 'BUY_OPTION',

          trade: {
            asset: tradeForm.asset,
            quantity: parseFloat(tradeForm.quantity) || 1,
            direction: tradeForm.direction, // CALL or PUT
          },
        };

      } else if (tradeForm.action === 'CLOSE_POSITION') {

        tx = {
          id: '',
          contract_code: tradeForm.positionId,
          contract_action: 'CLOSE_POSITION',
        };

      }

      const res = await fetch(`${NODE_URL}/tx/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(tx),
      });

      const data = await res.json();

      setTradeResult({
        ok: res.ok,
        data,
      });

      await refreshMempool();

    } catch (err) {

      setTradeResult({
        ok: false,
        data: {
          error: err.message,
        },
      });

    }

    setTradeBusy(false);
  }

  async function handleMineBlock() {
    setMining(true);
    setMinedBlock(null);

    try {
      const res = await fetch(`${NODE_URL}/engine/mine`, { method: 'POST' });
      setMinedBlock(await res.json());
      await refreshMempool();
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
          <p>Live prices streamed from Yahoo Finance — Gold, Silver, and Oil by default, plus any custom commodities an admin has added.</p>
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
              <div>
                <h3 style={{ marginBottom: 2 }}>{market.symbol}</h3>
                <p className="text-xs text-muted" style={{ margin: 0 }}>
                  {market.contract_name || market.yahoo_symbol}
                </p>
              </div>
              {flash[market.symbol] === 'up' && <TrendingUp size={16} style={{ color: 'var(--success)' }} />}
              {flash[market.symbol] === 'down' && <TrendingDown size={16} style={{ color: 'var(--danger)' }} />}
            </div>

            <div className="stat-block">
              <span className="stat-label">Price ({market.yahoo_symbol})</span>
              <span className="stat-value">{formatPrice(market.price, market.currency)}</span>
            </div>

            <div className="flex-between text-xs text-muted" style={{ marginTop: 'var(--sp-2)' }}>
              <span>Min: {market.min_quantity} {market.unit}</span>
              <span>{market.live ? 'Live' : 'Seed value'}</span>
            </div>

            <div className="flex-between text-xs text-muted" style={{ marginTop: 'var(--sp-1)' }}>
              <span>{market.currency}</span>
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

            {/* Asset */}

            {tradeForm.action !== 'CLOSE_POSITION' && (
              <div className="form-group">

                <label className="form-label">
                  Asset
                </label>

                <select
                  className="form-input"
                  value={tradeForm.asset}
                  onChange={(e) =>
                    setTradeForm((f) => ({
                      ...f,
                      asset: e.target.value
                    }))
                  }
                >
                  {markets.map((m) => (
                    <option
                      key={m.symbol}
                      value={m.symbol}
                    >
                      {m.symbol} — {m.contract_name} — {formatPrice(m.price, m.currency)}
                    </option>
                  ))}
                </select>

                {selectedMarket && (
                  <p className="text-xs text-muted" style={{ margin: '4px 0 0' }}>
                    Minimum quantity: {selectedMarket.min_quantity} {selectedMarket.unit}
                  </p>
                )}

              </div>
            )}

            {/* Action */}

            <div className="form-group">

              <label className="form-label">
                Action
              </label>

              <select
                className="form-input"
                value={tradeForm.action}
                onChange={(e) =>
                  setTradeForm((f) => ({
                    ...f,
                    action: e.target.value
                  }))
                }
              >
                <option value="OPEN_FUTURES">
                  Open Futures
                </option>

                <option value="OPEN_PERPETUAL">
                  Open Perpetual
                </option>

                <option value="BUY_OPTION">
                  Buy Option
                </option>

                <option value="CLOSE_POSITION">
                  Close Position
                </option>

              </select>

            </div>

            {/* Quantity */}

            {tradeForm.action !== 'CLOSE_POSITION' && (
              <div className="form-group">

                <label className="form-label">
                  Quantity {selectedMarket ? `(${selectedMarket.unit})` : ''}
                </label>

                <input
                  className="form-input"
                  type="number"
                  step="any"
                  min={selectedMarket?.min_quantity ?? undefined}
                  value={tradeForm.quantity}
                  onChange={(e) =>
                    setTradeForm((f) => ({
                      ...f,
                      quantity: e.target.value
                    }))
                  }
                />

                {estimatedFee != null && selectedMarket && (
                  <p className="text-xs text-muted" style={{ margin: '4px 0 0' }}>
                    Estimated fee: {selectedMarket.currency} {estimatedFee.toFixed(2)}
                  </p>
                )}

              </div>
            )}

            {/* Futures / Perpetual Direction */}

            {(tradeForm.action === 'OPEN_FUTURES' ||
              tradeForm.action === 'OPEN_PERPETUAL') && (

              <div className="form-group">

                <label className="form-label">
                  Direction
                </label>

                <select
                  className="form-input"
                  value={tradeForm.direction}
                  onChange={(e) =>
                    setTradeForm((f) => ({
                      ...f,
                      direction: e.target.value
                    }))
                  }
                >
                  <option value="LONG">
                    Long
                  </option>

                  <option value="SHORT">
                    Short
                  </option>

                </select>

              </div>
            )}

            {/* Option Type */}

            {tradeForm.action === 'BUY_OPTION' && (

              <div className="form-group">

                <label className="form-label">
                  Option Type
                </label>

                <select
                  className="form-input"
                  value={tradeForm.direction}
                  onChange={(e) =>
                    setTradeForm((f) => ({
                      ...f,
                      direction: e.target.value
                    }))
                  }
                >
                  <option value="CALL">
                    Call
                  </option>

                  <option value="PUT">
                    Put
                  </option>

                </select>

              </div>
            )}

            {/* Perpetual Leverage */}

            {(tradeForm.action === 'OPEN_PERPETUAL' || 
            tradeForm.action === 'OPEN_FUTURES') && (

              <div className="form-group">

                <label className="form-label">
                  Leverage
                </label>

                <select
                  className="form-input"
                  value={tradeForm.leverage}
                  onChange={(e) =>
                    setTradeForm((f) => ({
                      ...f,
                      leverage: e.target.value
                    }))
                  }
                >
                  <option value="1">1x</option>
                  <option value="5">5x</option>
                  <option value="10">10x</option>
                  <option value="20">20x</option>
                </select>

              </div>
            )}

            {/* Close Position */}

            {tradeForm.action === 'CLOSE_POSITION' && (

              <div className="form-group">

                <label className="form-label">
                  Position ID
                </label>

                <input
                  className="form-input mono"
                  type="text"
                  placeholder="Position ID"
                  value={tradeForm.positionId}
                  onChange={(e) =>
                    setTradeForm((f) => ({
                      ...f,
                      positionId: e.target.value
                    }))
                  }
                />

              </div>
            )}

            <button
              type="submit"
              className="cute-button btn-full"
              disabled={tradeBusy}
            >
              {tradeBusy
                ? 'Submitting...'
                : 'Submit Trade to Mempool'}
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

        <div className="card flex col gap-4">
          <h3>Market Activity</h3>

          <div className="grid-3">
            <div className="stat-block">
              <span className="stat-label">Bid Queue</span>
              <span className="stat-value">{queueSummary.bid}</span>
            </div>

            <div className="stat-block">
              <span className="stat-label">Sell Queue</span>
              <span className="stat-value">{queueSummary.sell}</span>
            </div>

            <div className="stat-block">
              <span className="stat-label">Pending Orders</span>
              <span className="stat-value">{mempool.length}</span>
            </div>
          </div>

          <div style={{ height: 240 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} key={historyTick}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="time" hide />
                <YAxis domain={["dataMin", "dataMax"]} width={60} />
                <Tooltip />
                <Line
                  type="monotone"
                  dataKey="price"
                  stroke="var(--accent)"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
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
