import { useEffect, useMemo, useRef, useState } from 'react';
import { TrendingUp, TrendingDown, Radio, Cpu, LineChart as LineChartIcon, ListOrdered, Percent } from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { useAuth } from '../../context/AuthContext';

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
  const { user } = useAuth();
  // Every trade, order, wallet, and holdings call is scoped to this — the
  // node rejects trades/orders without a user_id with "User not logged in".
  const userId = user?.email || null;

  const [markets, setMarkets] = useState([]);
  const [wallet, setWallet] = useState(null);
  const [connected, setConnected] = useState(false);
  const [mempool, setMempool] = useState([]);

  // Per-symbol flash direction, cleared a moment after each update.
  const [flash, setFlash] = useState({});
  const prevPrices = useRef({});
  const flashTimers = useRef({});

  // Trade form (futures / perpetual / options / close)
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

  // Which commodity the chart / trading queue section below is showing
  const [chartAsset, setChartAsset] = useState('');
  const [priceHistory, setPriceHistory] = useState([]);

  // Trading queue (order book)
  const [orderBook, setOrderBook] = useState({ bids: [], asks: [] });
  const [fills, setFills] = useState([]);
  const [holdings, setHoldings] = useState({ balances: {} });
  const [queueForm, setQueueForm] = useState({ side: 'PLACE_BID', price: '', quantity: '' });
  const [queueBusy, setQueueBusy] = useState(false);
  const [queueResult, setQueueResult] = useState(null);
  const [cancellingId, setCancellingId] = useState(null);

  // Fees — read from the node rather than hardcoded, so this always
  // matches whatever --fee-bps the node was actually started with.
  const [fees, setFees] = useState(null);
  const feeRate = fees ? fees.fee_percent / 100 : 0;

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

    // Keep the chart's own running history moving in near-real-time too,
    // without waiting for the next poll of /markets/history.
    if (entry.symbol === chartAsset) {
      setPriceHistory((prev) => [...prev, { timestamp: entry.updated_at, price: entry.price }].slice(-200));
    }
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
          setChartAsset((prev) => prev || data[0].symbol);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chartAsset]);

  // Pending (unmined) transactions — used for the queue-activity stats below
  async function refreshMempool() {
    try {
      const res = await fetch(`${NODE_URL}/mempool`);
      const data = await res.json();
      setMempool(Array.isArray(data) ? data : []);
    } catch {
      setMempool([]);
    }
  }
  useEffect(() => {
    refreshMempool();
  }, []);

  // Wallet — lazily create one for this user the first time they show up,
  // then fetch its balance. Skipped entirely while logged out.
  function refreshWallet() {
    if (!userId) {
      setWallet(null);
      return;
    }

    fetch(`${NODE_URL}/wallet?user_id=${encodeURIComponent(userId)}`)
      .then((res) => res.json())
      .then(setWallet)
      .catch(console.error);
  }

  useEffect(() => {
    if (!userId) {
      setWallet(null);
      return;
    }

    fetch(`${NODE_URL}/wallet/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId }),
    })
      .catch(() => {})
      .finally(refreshWallet);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  // Fees — global to the node, not per-user
  function refreshFees() {
    fetch(`${NODE_URL}/fees`)
      .then((res) => res.json())
      .then(setFees)
      .catch(console.error);
  }
  useEffect(refreshFees, []);

  // Holdings — per-user, like the wallet
  function refreshHoldings() {
    if (!userId) {
      setHoldings({ balances: {} });
      return;
    }

    fetch(`${NODE_URL}/holdings?user_id=${encodeURIComponent(userId)}`)
      .then((res) => res.json())
      .then(setHoldings)
      .catch(console.error);
  }
  useEffect(refreshHoldings, [userId]);

  // Price history + order book + fills for whichever commodity is selected
  function refreshChartAssetData(asset) {
    if (!asset) return;

    fetch(`${NODE_URL}/markets/history/${asset}?limit=200`)
      .then((res) => res.json())
      .then(setPriceHistory)
      .catch(console.error);

    fetch(`${NODE_URL}/orderbook/${asset}`)
      .then((res) => res.json())
      .then(setOrderBook)
      .catch(console.error);

    fetch(`${NODE_URL}/orderbook/${asset}/fills`)
      .then((res) => res.json())
      .then(setFills)
      .catch(console.error);
  }

  useEffect(() => {
    refreshChartAssetData(chartAsset);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chartAsset]);

  // Order books/fills/history only change when a block gets mined, so a
  // light poll keeps this section current without needing its own SSE feed.
  useEffect(() => {
    const interval = setInterval(() => refreshChartAssetData(chartAsset), 10000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chartAsset]);

  const selectedMarket = markets.find((m) => m.symbol === tradeForm.asset);
  const selectedChartMarket = markets.find((m) => m.symbol === chartAsset);
  const chartHoldingQty = holdings.balances?.[chartAsset] ?? 0;

  const notionalValue = selectedMarket && tradeForm.action !== 'CLOSE_POSITION'
    ? (parseFloat(tradeForm.quantity) || 0) * selectedMarket.price
    : null;
  const estimatedFee = notionalValue != null ? notionalValue * feeRate : null;

  // Rough breakdown of what's sitting in the mempool right now, for the
  // "queue activity" stats — buys/longs vs sells/shorts, still unmined.
  const queueSummary = useMemo(() => {
    const summary = { bid: 0, sell: 0 };

    for (const tx of mempool) {
      const action = String(tx.contract_action || '').toUpperCase();
      const direction = String(tx.trade?.direction || '').toUpperCase();

      if (action === 'CLOSE_POSITION' || action === 'CANCEL_ORDER') continue;

      if (action === 'PLACE_BID') { summary.bid += 1; continue; }
      if (action === 'PLACE_ASK') { summary.sell += 1; continue; }

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

  async function handleSubmitTrade(e) {
    e.preventDefault();

    if (!userId) {
      setTradeResult({ ok: false, data: { error: 'Log in first to submit a trade.' } });
      return;
    }

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
          user_id: userId,
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
          user_id: userId,
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
          user_id: userId,
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
          user_id: userId,
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
    } catch (err) {
      setMinedBlock({ error: err.message });
    }

    setMining(false);

    // Mining is the only thing that actually changes wallet/holdings/order
    // book/treasury state, so refresh everything that could have moved.
    refreshWallet();
    refreshHoldings();
    refreshFees();
    refreshChartAssetData(chartAsset);
    await refreshMempool();
  }

  async function handlePlaceOrder(e) {
    e.preventDefault();
    if (!chartAsset) return;

    if (!userId) {
      setQueueResult({ ok: false, message: 'Log in first to place an order.' });
      return;
    }

    setQueueBusy(true);
    setQueueResult(null);

    const price = parseFloat(queueForm.price) || 0;
    const quantity = parseFloat(queueForm.quantity) || 0;

    if (price <= 0 || quantity <= 0) {
      setQueueResult({ ok: false, message: 'Enter a price and quantity greater than 0.' });
      setQueueBusy(false);
      return;
    }
    // Prevent invalid sell orders
    const owned = holdings.balances?.[chartAsset] ?? 0;

    if (queueForm.side === 'PLACE_ASK' && quantity > owned) {
      setQueueResult({
        ok: false,
        message: `You only own ${owned} ${chartAsset}.`,
      });
      setQueueBusy(false);
      return;
    }
    const estimatedCost = price * quantity;

    if (
      queueForm.side === 'PLACE_BID' &&
      wallet &&
      estimatedCost > wallet.balance
    ) {
      setQueueResult({
        ok: false,
        message: `Insufficient funds. This order requires $${estimatedCost.toFixed(2)}.`,
      });
      setQueueBusy(false);
      return;
    }
    const tx = {
      id: '',
      user_id: userId,
      contract_code: 'CommodityTrading',
      contract_action: queueForm.side, // PLACE_BID or PLACE_ASK
      trade: {
        asset: chartAsset,
        quantity,
        direction: queueForm.side === 'PLACE_BID' ? 'BUY' : 'SELL',
        price,
      },
    };

    try {
      await fetch(`${NODE_URL}/tx/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(tx),
      });

      setQueueResult({
        ok: true,
        message: 'Order submitted to the mempool — mine a block to attempt matching it.',
      });
      setQueueForm((f) => ({ ...f, price: '', quantity: '' }));
      await refreshMempool();
    } catch (err) {
      setQueueResult({ ok: false, message: err.message });
    }

    setQueueBusy(false);
  }

  async function handleCancelOrder(order) {
    if (!userId) {
      setQueueResult({ ok: false, message: 'Log in first to manage orders.' });
      return;
    }

    setCancellingId(order.id);

    const tx = {
      id: '',
      user_id: userId,
      contract_code: order.id,
      contract_action: 'CANCEL_ORDER',
      trade: { asset: chartAsset, quantity: 0, direction: '' },
    };

    try {
      await fetch(`${NODE_URL}/tx/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(tx),
      });
      setQueueResult({ ok: true, message: 'Cancellation submitted — mine a block to apply it.' });
      await refreshMempool();
    } catch (err) {
      setQueueResult({ ok: false, message: err.message });
    }

    setCancellingId(null);
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

      {!userId && (
        <div className="card" style={{ marginBottom: 'var(--sp-6)', borderColor: 'var(--accent)' }}>
          <p className="text-sm" style={{ margin: 0 }}>
            Log in to trade, place orders, and see your wallet/holdings. You can still watch live prices while logged out.
          </p>
        </div>
      )}

      <div className="stats-grid" style={{ marginBottom: 'var(--sp-6)' }}>
        <div className="card">
          <div className="stat-block">
            <span className="stat-label">Wallet Balance</span>
            <span className="stat-value">{userId && wallet ? `$${wallet.balance.toFixed(2)}` : '—'}</span>
          </div>
        </div>

        <div className="card">
          <div className="stat-block">
            <span className="stat-label">
              <Percent size={12} style={{ marginRight: 4, verticalAlign: 'middle' }} />
              Trading Fee
            </span>
            <span className="stat-value">
              {fees ? `${fees.fee_percent.toFixed(2)}%` : '—'}
            </span>
          </div>
        </div>

        <div className="card">
          <div className="stat-block">
            <span className="stat-label">Fees Collected (treasury)</span>
            <span className="stat-value">
              {fees ? `$${fees.treasury_collected.toFixed(2)}` : '—'}
            </span>
          </div>
        </div>

        <div className="card">
          <div className="stat-block">
            <span className="stat-label">Pending Orders</span>
            <span className="stat-value">{mempool.length}</span>
          </div>
        </div>

        <div className="card">
          <div className="stat-block">
            <span className="stat-label">Bid Queue</span>
            <span className="stat-value">{queueSummary.bid}</span>
          </div>
        </div>

        <div className="card">
          <div className="stat-block">
            <span className="stat-label">Sell Queue</span>
            <span className="stat-value">{queueSummary.sell}</span>
          </div>
        </div>
      </div>

      <div className="grid-auto">
        {markets.map((market) => (
          <div
            key={market.symbol}
            className="card"
            onClick={() => setChartAsset(market.symbol)}
            style={{
              cursor: 'pointer',
              transition: 'background-color 0.3s',
              border: chartAsset === market.symbol ? '1px solid var(--accent)' : undefined,
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

      {/* Price movement chart for whichever commodity card is selected above */}
      <div className="card flex col gap-4" style={{ marginTop: 'var(--sp-6)' }}>
        <div className="flex-between">
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)' }}>
            <LineChartIcon size={18} style={{ color: 'var(--accent)' }} />
            <h3 style={{ margin: 0 }}>
              {selectedChartMarket ? `${selectedChartMarket.symbol} Price Movement` : 'Price Movement'}
            </h3>
          </div>
          <span className="text-xs text-muted">
            {priceHistory.length} samples
          </span>
        </div>
        <div className="divider" style={{ margin: 0 }} />

        <div style={{ width: '100%', height: 260 }}>
          {priceHistory.length > 1 ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={priceHistory}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis
                  dataKey="timestamp"
                  tickFormatter={(ts) => new Date(ts * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  tick={{ fontSize: 11 }}
                  minTickGap={40}
                />
                <YAxis
                  domain={['auto', 'auto']}
                  tick={{ fontSize: 11 }}
                  width={70}
                  tickFormatter={(v) => formatPrice(v, selectedChartMarket?.currency)}
                />
                <Tooltip
                  labelFormatter={(ts) => new Date(ts * 1000).toLocaleString()}
                  formatter={(value) => [formatPrice(value, selectedChartMarket?.currency), 'Price']}
                />
                <Line
                  type="monotone"
                  dataKey="price"
                  stroke="var(--accent)"
                  strokeWidth={2}
                  dot={false}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-muted">Not enough history yet — check back after a few price refreshes.</p>
          )}
        </div>
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
                    Estimated fee: {formatPrice(estimatedFee, selectedMarket.currency)}
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
              disabled={tradeBusy || !userId}
            >
              {tradeBusy
                ? 'Submitting...'
                : !userId
                ? 'Log in to trade'
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

        {/* Mine — creates a block priced against whatever the feed says right now */}
        <div className="card flex col gap-4">
          <h3>Create Block</h3>
          <p className="text-sm text-muted">
            Mines a new block. Any pending trades or queue orders in the mempool are
            executed against the live commodity feed at the moment of mining.
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

      {/* Trading queue — bid/ask order book for whichever commodity is selected above */}
      <div className="card flex col gap-4" style={{ marginTop: 'var(--sp-6)' }}>
        <div className="flex-between">
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)' }}>
            <ListOrdered size={18} style={{ color: 'var(--accent)' }} />
            <h3 style={{ margin: 0 }}>
              {chartAsset ? `${chartAsset} Trading Queue` : 'Trading Queue'}
            </h3>
          </div>
          <span className="text-xs text-muted">
            Holdings: {chartHoldingQty} {selectedChartMarket?.unit || ''}
          </span>
        </div>
        <div className="divider" style={{ margin: 0 }} />

        <div className="grid-2">
          {/* Bids */}
          <div className="flex col gap-2">
            <span className="text-xs text-muted" style={{ fontWeight: 600 }}>BIDS (buy orders)</span>
            {orderBook.bids.length === 0 && (
              <p className="text-xs text-muted" style={{ margin: 0 }}>No resting bids.</p>
            )}
            {orderBook.bids.map((order) => {
              const isMine = userId && order.user_id === userId;
              return (
                <div key={order.id} className="flex-between text-xs" style={{ padding: 'var(--sp-2) 0' }}>
                  <span className="font-mono" style={{ color: 'var(--success)' }}>
                    {formatPrice(order.price, selectedChartMarket?.currency)}
                  </span>
                  <span className="font-mono text-muted">{order.remaining} {selectedChartMarket?.unit}</span>
                  <span className="text-xs text-muted">{isMine ? 'You' : 'other trader'}</span>
                  {isMine && (
                    <button
                      className="btn btn-ghost btn-sm"
                      type="button"
                      disabled={cancellingId === order.id}
                      onClick={() => handleCancelOrder(order)}
                    >
                      {cancellingId === order.id ? '…' : 'Cancel'}
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          {/* Asks */}
          <div className="flex col gap-2">
            <span className="text-xs text-muted" style={{ fontWeight: 600 }}>ASKS (sell orders)</span>
            {orderBook.asks.length === 0 && (
              <p className="text-xs text-muted" style={{ margin: 0 }}>No resting asks.</p>
            )}
            {orderBook.asks.map((order) => {
              const isMine = userId && order.user_id === userId;
              return (
                <div key={order.id} className="flex-between text-xs" style={{ padding: 'var(--sp-2) 0' }}>
                  <span className="font-mono" style={{ color: 'var(--danger)' }}>
                    {formatPrice(order.price, selectedChartMarket?.currency)}
                  </span>
                  <span className="font-mono text-muted">{order.remaining} {selectedChartMarket?.unit}</span>
                  <span className="text-xs text-muted">{isMine ? 'You' : 'other trader'}</span>
                  {isMine && (
                    <button
                      className="btn btn-ghost btn-sm"
                      type="button"
                      disabled={cancellingId === order.id}
                      onClick={() => handleCancelOrder(order)}
                    >
                      {cancellingId === order.id ? '…' : 'Cancel'}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="divider" style={{ margin: 0 }} />

        {/* Place order form */}
        <form onSubmit={handlePlaceOrder} className="grid-3" style={{ alignItems: 'end', gap: 'var(--sp-4)' }}>
          <div className="form-group">
            <label className="form-label">Side</label>
            <select
              className="form-input"
              value={queueForm.side}
              onChange={(e) => setQueueForm((f) => ({ ...f, side: e.target.value }))}
            >
              <option value="PLACE_BID">Bid (buy)</option>
              <option value="PLACE_ASK">Ask (sell)</option>
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Limit Price</label>
            <input
              className="form-input"
              type="number"
              step="any"
              placeholder={selectedChartMarket ? formatPrice(selectedChartMarket.price, selectedChartMarket.currency) : '0.00'}
              value={queueForm.price}
              onChange={(e) => setQueueForm((f) => ({ ...f, price: e.target.value }))}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Quantity {selectedChartMarket ? `(${selectedChartMarket.unit})` : ''}</label>
            <input
              className="form-input"
              type="number"
              step="any"
              min={selectedChartMarket?.min_quantity ?? undefined}
              value={queueForm.quantity}
              onChange={(e) => setQueueForm((f) => ({ ...f, quantity: e.target.value }))}
            />
          </div>

          <button
            type="submit"
            className="cute-button btn-full"
            style={{ gridColumn: '1 / -1' }}
            disabled={queueBusy || !chartAsset || !userId}
          >
            {queueBusy ? 'Submitting…' : !userId ? 'Log in to place orders' : `Place ${queueForm.side === 'PLACE_BID' ? 'Bid' : 'Ask'}`}
          </button>
        </form>

        {queueResult && (
          <div className="text-xs" style={{ color: queueResult.ok ? 'var(--success)' : 'var(--danger)' }}>
            {queueResult.message}
          </div>
        )}

        {fills.length > 0 && (
          <>
            <div className="divider" style={{ margin: 0 }} />
            <span className="text-xs text-muted" style={{ fontWeight: 600 }}>RECENT FILLS</span>
            <div className="flex col gap-1">
              {fills.slice().reverse().slice(0, 10).map((fill, i) => (
                <div key={i} className="flex-between text-xs text-muted">
                  <span className="font-mono">{formatPrice(fill.price, selectedChartMarket?.currency)}</span>
                  <span className="font-mono">{fill.quantity} {selectedChartMarket?.unit}</span>
                  <span>{new Date(fill.timestamp * 1000).toLocaleTimeString()}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default Markets;
