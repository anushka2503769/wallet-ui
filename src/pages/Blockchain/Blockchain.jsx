import { useState, useRef, useEffect } from 'react';
import {
  Layers,
  Send,
  Cpu,
  CheckCircle,
  RefreshCw,
  ShieldCheck,
  Terminal,
  Search,
  Play,
  Square,
  ChevronDown,
  ChevronUp,
  Zap,
  Hash,
  Clock,
  Link2,
  Radio
} from 'lucide-react';

// ─── Constants ───────────────────────────────────────────────
// Use whatever host the page itself was loaded from (localhost, a LAN IP,
// or a Tailscale/VPN address) so this works whether you're on the same
// laptop as the node or viewing it from another machine on the network.
const NODE_URL = `http://${window.location.hostname}:8080`;
const PROXY_URL = `http://${window.location.hostname}:9090`;

// ─── Helpers ─────────────────────────────────────────────────
function shortHash(hash = '') {
  if (!hash) return '—';
  return hash.length > 20 ? `${hash.slice(0, 10)}…${hash.slice(-8)}` : hash;
}

function formatTs(ts) {
  if (!ts) return '—';
  // Accept unix timestamp (number) or ISO string
  const d = typeof ts === 'number' ? new Date(ts * 1000) : new Date(ts);
  return isNaN(d) ? String(ts) : d.toLocaleString();
}

function logColor(line = '') {
  if (line.includes('[PASS]') || line.includes('[OK]') || line.includes('[MINED]'))
    return 'var(--success)';
  if (line.includes('[ERROR]') || line.includes('[FAIL]'))
    return 'var(--danger)';
  if (line.includes('[WARN]'))
    return 'var(--warning)';
  if (line.includes('[DONE]') || line.includes('[COMPLETE]'))
    return 'var(--accent)';
  if (line.includes('[INFO]') || line.includes('[TX]'))
    return 'var(--text-secondary)';
  return 'var(--text-muted)';
}

// ─── Node API calls ──────────────────────────────────────────
async function apiGet(path) {
  const r = await fetch(`${NODE_URL}${path}`, { signal: AbortSignal.timeout(8000) });
  if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
  return r.json();
}

async function apiPost(path, body = {}) {
  const r = await fetch(`${NODE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(120000),
  });
  if (!r.ok) {
    const text = await r.text();
    throw new Error(`${r.status}: ${text}`);
  }
  return r.json();
}

async function proxyGet(path) {
  const r = await fetch(`${PROXY_URL}${path}`, { signal: AbortSignal.timeout(8000) });
  if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
  return r.json();
}

// ─── Sub-components ──────────────────────────────────────────

function NodeStatusBar({ nodeOnline, checking, onRefresh }) {
  return (
    <div
      className="card flex-between"
      style={{ padding: 'var(--sp-4) var(--sp-6)', marginBottom: 'var(--sp-6)' }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)' }}>
        <div
          style={{
            width: 10,
            height: 10,
            borderRadius: '50%',
            background: nodeOnline ? 'var(--success)' : 'var(--danger)',
            boxShadow: nodeOnline ? '0 0 8px var(--success)' : 'none',
            flexShrink: 0,
          }}
        />
        <span className="font-mono" style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
          {nodeOnline ? `Connected · ${NODE_URL}` : `Node offline · ${NODE_URL}`}
        </span>
        <span className="badge badge-muted" style={{ fontSize: '0.72rem' }}>PoS</span>
      </div>

      <button
        className="btn btn-ghost btn-sm"
        onClick={onRefresh}
        disabled={checking}
        type="button"
        style={{ gap: 6 }}
      >
        <RefreshCw size={14} style={{ animation: checking ? 'spin 1s linear infinite' : 'none' }} />
        {checking ? 'Checking…' : 'Refresh'}
      </button>
    </div>
  );
}

function StatStrip({ blocks, txCount, validators, epoch }) {
  const items = [
    { label: 'Blocks', value: blocks ?? '—', icon: <Layers size={18} />, color: 'var(--accent)' },
    { label: 'Transactions', value: txCount ?? '—', icon: <Send size={18} />, color: 'var(--accent2)' },
    { label: 'Validators', value: validators ?? '—', icon: <ShieldCheck size={18} />, color: 'var(--success)' },
    { label: 'Epoch', value: epoch ?? '—', icon: <Zap size={18} />, color: 'var(--warning)' },
  ];

  return (
    <div className="grid-4" style={{ marginBottom: 'var(--sp-6)' }}>
      {items.map((s) => (
        <div key={s.label} className="card" style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-4)' }}>
          <div
            style={{
              background: `color-mix(in srgb, ${s.color} 15%, transparent)`,
              color: s.color,
              padding: 10,
              borderRadius: 'var(--r-md)',
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
            }}
          >
            {s.icon}
          </div>
          <div className="stat-block">
            <span className="stat-label">{s.label}</span>
            <span className="stat-value font-mono">{s.value}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function BlockCard({ block, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  const txs = block.transactions || [];

  return (
    <div
      className="card"
      style={{ padding: 0, overflow: 'hidden', cursor: 'pointer' }}
      onClick={() => setOpen((o) => !o)}
    >
      {/* Header row */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--sp-4)',
          padding: 'var(--sp-4) var(--sp-5)',
        }}
      >
        <div
          style={{
            background: 'var(--accent-dim)',
            color: 'var(--accent)',
            fontFamily: 'var(--font-mono)',
            fontWeight: 700,
            fontSize: '0.8rem',
            padding: '4px 10px',
            borderRadius: 'var(--r-sm)',
            flexShrink: 0,
          }}
        >
          #{block.index ?? block.blockNumber ?? '?'}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            className="font-mono"
            style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
          >
            {shortHash(block.hash)}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2 }}>
            {formatTs(block.timestamp)}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)', flexShrink: 0 }}>
          {block.validator && (
            <span className="badge badge-accent" style={{ fontSize: '0.72rem' }}>
              {block.validator}
            </span>
          )}
          <span className="badge badge-muted" style={{ fontSize: '0.72rem' }}>
            {txs.length} tx
          </span>
          {open ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
        </div>
      </div>

      {/* Expanded detail */}
      {open && (
        <div
          style={{
            borderTop: '1px solid var(--border)',
            padding: 'var(--sp-4) var(--sp-5)',
            background: 'var(--bg-muted)',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--sp-3) var(--sp-6)' }}>
            <Detail label="Hash" value={block.hash} mono />
            <Detail label="Prev Hash" value={block.previous_hash || block.previousHash} mono />
            <Detail label="Nonce" value={block.nonce ?? 'n/a (PoS)'} mono />
            {block.gas_used != null && <Detail label="Gas Used" value={block.gas_used} mono />}
          </div>

          {txs.length > 0 && (
            <>
              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 'var(--sp-4)', marginBottom: 'var(--sp-2)' }}>
                Transactions
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {txs.map((tx, i) => (
                  <div key={i} className="font-mono" style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                    <span style={{ color: 'var(--accent)' }}>{shortHash(tx.id)}</span>
                    {tx.contract_action && (
                      <span style={{ color: 'var(--text-muted)', marginLeft: 8 }}>action={tx.contract_action}</span>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function Detail({ label, value, mono }) {
  return (
    <div>
      <div style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>
        {label}
      </div>
      <div
        className={mono ? 'font-mono' : ''}
        style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', wordBreak: 'break-all' }}
      >
        {value ?? '—'}
      </div>
    </div>
  );
}

function LogTerminal({ logs, running }) {
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  return (
    <div
      className="font-mono"
      style={{
        background: 'var(--bg-base)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--r-md)',
        padding: 'var(--sp-4)',
        minHeight: 200,
        maxHeight: 340,
        overflowY: 'auto',
        fontSize: '0.82rem',
        lineHeight: 1.6,
      }}
    >
      {logs.length === 0 ? (
        <div style={{ color: 'var(--text-muted)', padding: '40px 0', textAlign: 'center' }}>
          No output yet. Run an action above.
        </div>
      ) : (
        logs.map((line, i) => (
          <div key={i} style={{ color: logColor(line) }}>
            {line}
          </div>
        ))
      )}
      <div ref={bottomRef} />
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────
function Blockchain() {
  // Node state
  const [nodeOnline, setNodeOnline] = useState(false);
  const [checking, setChecking] = useState(false);
  const [chainStats, setChainStats] = useState({ blocks: null, txCount: null, validators: null, epoch: null });

  // Action states
  const [busy, setBusy] = useState(false);
  const [logs, setLogs] = useState([]);
  const [activeTab, setActiveTab] = useState('submit'); // 'submit' | 'explorer' | 'sql' | 'validators'

  // Submit tx form
  const [bytecode, setBytecode] = useState('');
  const [method, setMethod] = useState('');

  // Blocks explorer
  const [blocks, setBlocks] = useState([]);
  const [blocksLoaded, setBlocksLoaded] = useState(false);


  // Contract state query
  const [contractId, setContractId] = useState('');
  const [keySlot, setKeySlot] = useState('');
  const [stateResult, setStateResult] = useState(null);

  // Peer network
  const [peers, setPeers] = useState([]);
  const [peerAddress, setPeerAddress] = useState('');
  const [peerBusy, setPeerBusy] = useState(false);
  const [peerResult, setPeerResult] = useState(null);

  // ── Log helper ──
  function log(...lines) {
    const ts = new Date().toLocaleTimeString();
    setLogs((prev) => [...prev, ...lines.map((l) => `[${ts}] ${l}`)]);
  }

  // ── Node check ──
  async function checkNode() {
    setChecking(true);
    try {
      const data = await apiGet('/consensus/status');
      setNodeOnline(true);
      // Also pull basic stats
      try {
        const sql = await apiPost('/sql', { sql: 'SELECT COUNT(*) as cnt FROM blocks' });
        const txSql = await apiPost('/sql', { sql: 'SELECT COUNT(*) as cnt FROM transactions' });
        setChainStats((prev) => ({
          ...prev,
          blocks: sql?.[0]?.cnt ?? '?',
          txCount: txSql?.[0]?.cnt ?? '?',
          validators: data.validator_count ?? prev.validators ?? '?',
          epoch: data.epoch ?? prev.epoch ?? '?',
        }));
      } catch { /* stats are best-effort */ }
    } catch {
      setNodeOnline(false);
    }
    setChecking(false);
  }

  useEffect(() => { checkNode(); }, []);

  // ── Submit + Mine ──
  async function handleSubmitAndMine() {
    if (!bytecode || !method) return;
    setBusy(true);
    setLogs([]);
    try {
      log('[TX] Submitting transaction to mempool…');
      const tx = await apiPost('/tx/submit', {
        id: '',
        contract_code: bytecode,
        contract_action: method,
      });
      log(`[PASS] Transaction accepted · ID: ${shortHash(tx.id)}`);
      log('[INFO] Requesting PoS block production…');

      const block = await apiPost('/engine/mine');
      log(`[MINED] Block #${block.index} produced by validator: ${block.validator ?? 'PoS validator'}`);
      log(`[DONE] Hash: ${block.hash}`);
      log(`[DONE] ${(block.transactions || []).length} transaction(s) included`);
      setBytecode('');
      setMethod('');
      checkNode();
    } catch (e) {
      log(`[ERROR] ${e.message}`);
    }
    setBusy(false);
  }

  // ── Mine empty block ──
  async function handleMineBlock() {
    setBusy(true);
    setLogs([]);
    try {
      log('[INFO] Requesting new PoS block…');
      const block = await apiPost('/engine/mine');
      log(`[MINED] Block #${block.index} finalized`);
      log(`[DONE] Hash: ${block.hash}`);
      log(`[DONE] Prev: ${block.previous_hash}`);
      checkNode();
    } catch (e) {
      log(`[ERROR] ${e.message}`);
    }
    setBusy(false);
  }

  // ── Fetch blocks ──
  async function fetchBlocks() {
    setBusy(true);
    try {
      const data = await proxyGet('/blocks');
      setBlocks(Array.isArray(data) ? data : []);
      setBlocksLoaded(true);
    } catch {
      // fallback to SQL
      try {
        const data = await apiPost('/sql', { sql: 'SELECT * FROM blocks' });
        setBlocks(Array.isArray(data) ? data : []);
        setBlocksLoaded(true);
      } catch (e) {
        log(`[ERROR] ${e.message}`);
      }
    }
    setBusy(false);
  }


  // ── Contract state ──
  async function handleQueryState() {
    if (!contractId || !keySlot) return;
    setBusy(true);
    setStateResult(null);
    try {
      const r = await fetch(`${NODE_URL}/query/state/${contractId}/${keySlot}`, {
        signal: AbortSignal.timeout(8000),
      });
      setStateResult(await r.text());
    } catch (e) {
      setStateResult(`Error: ${e.message}`);
    }
    setBusy(false);
  }

  // ── Consensus status ──
  async function handleCheckConsensus() {
    setBusy(true);
    setLogs([]);
    try {
      const data = await apiGet('/consensus/status');
      log(`[PASS] Engine: ${data.engine ?? 'PoS'}`);
      log(`[PASS] Active: ${data.active ? 'Yes' : 'No'}`);
      if (data.epoch) log(`[INFO] Epoch: ${data.epoch}`);
      if (data.validator_count) log(`[INFO] Validators: ${data.validator_count}`);
    } catch (e) {
      log(`[ERROR] ${e.message}`);
    }
    setBusy(false);
  }

  // ── Peer network ──
  async function fetchPeers() {
    try {
      const data = await apiGet('/p2p/peers');
      setPeers(Array.isArray(data) ? data : []);
    } catch {
      // Best-effort — node may be offline or on an older build without P2P.
    }
  }

  async function handleConnectPeer() {
    if (!peerAddress) return;
    setPeerBusy(true);
    setPeerResult(null);
    try {
      const data = await apiPost('/p2p/peers/connect', { address: peerAddress });
      setPeerResult({ ok: true, message: `Connected to ${peerAddress}` });
      setPeers(Array.isArray(data.peers) ? data.peers : []);
      setPeerAddress('');
      checkNode(); // in case connecting triggered a chain sync
    } catch (e) {
      setPeerResult({ ok: false, message: e.message });
    }
    setPeerBusy(false);
  }

  // ── Tab data load ──
  useEffect(() => {
    if (activeTab === 'explorer' && !blocksLoaded) {
      fetchBlocks();
    }
    if (activeTab === 'network') {
      fetchPeers();
    }
  }, [activeTab]);

  // ─── Render ───
  const tabs = [
    { id: 'submit', label: 'Submit & Mine', icon: <Send size={15} /> },
    { id: 'explorer', label: 'Block Explorer', icon: <Layers size={15} /> },
    { id: 'validators', label: 'Validators', icon: <ShieldCheck size={15} /> },
    { id: 'network', label: 'Network', icon: <Radio size={15} /> },
  ];

  return (
    <div className="page-container">
      {/* Page header */}
      <div className="page-header">
        <h2>Blockchain Manager</h2>
        <p>
          Submit transactions, produce PoS blocks, inspect the chain, and sync with peer nodes — all from one place.
        </p>
      </div>

      {/* Node status bar */}
      <NodeStatusBar nodeOnline={nodeOnline} checking={checking} onRefresh={checkNode} />

      {/* Stats strip */}
      <StatStrip
        blocks={chainStats.blocks}
        txCount={chainStats.txCount}
        validators={chainStats.validators}
        epoch={chainStats.epoch}
      />

      {/* Tabs */}
      <div
        style={{
          display: 'flex',
          gap: 4,
          borderBottom: '1px solid var(--border)',
          marginBottom: 'var(--sp-6)',
        }}
      >
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setActiveTab(t.id)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '10px 18px',
              fontSize: '0.85rem',
              fontWeight: 600,
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: activeTab === t.id ? 'var(--accent)' : 'var(--text-muted)',
              borderBottom: activeTab === t.id ? '2px solid var(--accent)' : '2px solid transparent',
              marginBottom: -1,
              transition: 'color var(--t-fast)',
              fontFamily: 'var(--font-body)',
            }}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Tab: Submit & Mine ── */}
      {activeTab === 'submit' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-6)' }}>
          <div className="grid-2">
            {/* Transaction form */}
            <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)' }}>
                <Send size={18} style={{ color: 'var(--accent)' }} />
                <h3 style={{ margin: 0 }}>Deploy Transaction</h3>
              </div>
              <div className="divider" style={{ margin: 0 }} />

              <div className="form-group">
                <label className="form-label">Hex Bytecode</label>
                <input
                  className="form-input mono"
                  type="text"
                  placeholder="e.g. deadbeef"
                  value={bytecode}
                  onChange={(e) => setBytecode(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Method / Action</label>
                <input
                  className="form-input"
                  type="text"
                  placeholder="e.g. init"
                  value={method}
                  onChange={(e) => setMethod(e.target.value)}
                />
              </div>

              <button
                className="cute-button btn-full"
                type="button"
                disabled={busy || !bytecode || !method}
                onClick={handleSubmitAndMine}
                style={{ marginTop: 'var(--sp-2)' }}
              >
                <Play size={15} style={{ marginRight: 4 }} />
                Submit & Mine Block
              </button>
            </div>

            {/* Quick actions */}
            <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)' }}>
                <Zap size={18} style={{ color: 'var(--accent2)' }} />
                <h3 style={{ margin: 0 }}>Quick Actions</h3>
              </div>
              <div className="divider" style={{ margin: 0 }} />

              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
                <button
                  className="btn btn-secondary btn-full"
                  type="button"
                  disabled={busy}
                  onClick={handleMineBlock}
                  style={{ padding: '12px 20px', borderRadius: 'var(--r-md)', justifyContent: 'flex-start', gap: 8 }}
                >
                  <Cpu size={15} />
                  Mine Empty Block
                </button>

                <button
                  className="btn btn-ghost btn-full"
                  type="button"
                  disabled={busy}
                  onClick={handleCheckConsensus}
                  style={{ padding: '12px 20px', borderRadius: 'var(--r-md)', justifyContent: 'flex-start', gap: 8 }}
                >
                  <ShieldCheck size={15} />
                  Check Consensus Status
                </button>

                <button
                  className="btn btn-ghost btn-full"
                  type="button"
                  disabled={busy}
                  onClick={checkNode}
                  style={{ padding: '12px 20px', borderRadius: 'var(--r-md)', justifyContent: 'flex-start', gap: 8 }}
                >
                  <RefreshCw size={15} />
                  Refresh Node Stats
                </button>
              </div>

              <div className="divider" style={{ margin: 0 }} />

              {/* PoS consensus indicator */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
                <div className="flex-between text-sm">
                  <span className="text-muted">Consensus Mode</span>
                  <span className="badge badge-accent">Proof of Stake</span>
                </div>
                <div className="flex-between text-sm">
                  <span className="text-muted">Node Status</span>
                  <span className={`badge ${nodeOnline ? 'badge-success' : 'badge-danger'}`}>
                    {nodeOnline ? 'Online' : 'Offline'}
                  </span>
                </div>
                <div className="flex-between text-sm">
                  <span className="text-muted">Hash Verification</span>
                  <span className="badge badge-success">Active</span>
                </div>
              </div>
            </div>
          </div>

          {/* Terminal output */}
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
            <div className="flex-between">
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)' }}>
                <Terminal size={16} style={{ color: 'var(--text-muted)' }} />
                <h3 style={{ margin: 0 }}>Output</h3>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)' }}>
                <span className={`badge ${busy ? 'badge-warning' : 'badge-muted'}`}>
                  {busy ? 'RUNNING' : 'IDLE'}
                </span>
                {logs.length > 0 && (
                  <button className="btn btn-ghost btn-sm" type="button" onClick={() => setLogs([])}>
                    Clear
                  </button>
                )}
              </div>
            </div>
            <LogTerminal logs={logs} running={busy} />
          </div>
        </div>
      )}

      {/* ── Tab: Block Explorer ── */}
      {activeTab === 'explorer' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
          <div className="flex-between">
            <span className="text-muted" style={{ fontSize: '0.85rem' }}>
              {blocksLoaded ? `${blocks.length} block(s) on chain` : 'Load blocks to explore'}
            </span>
            <div style={{ display: 'flex', gap: 'var(--sp-3)' }}>
              <button
                className="cute-button"
                type="button"
                disabled={busy}
                onClick={fetchBlocks}
              >
                <RefreshCw size={14} style={{ marginRight: 4 }} />
                {blocksLoaded ? 'Reload' : 'Load Blocks'}
              </button>
            </div>
          </div>

          {!blocksLoaded && (
            <div className="card" style={{ textAlign: 'center', padding: 'var(--sp-12)' }}>
              <Layers size={36} style={{ color: 'var(--text-muted)', margin: '0 auto var(--sp-4)' }} />
              <p>Click "Load Blocks" to fetch the current chain state.</p>
            </div>
          )}

          {blocksLoaded && blocks.length === 0 && (
            <div className="card" style={{ textAlign: 'center', padding: 'var(--sp-12)' }}>
              <p>No blocks found. Mine the first block using Submit & Mine.</p>
            </div>
          )}

          {blocksLoaded && blocks.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
              {[...blocks].reverse().map((block, i) => (
                <BlockCard key={block.hash || i} block={block} defaultOpen={i === 0} />
              ))}
            </div>
          )}
        </div>
      )}
      {/* ── Tab: Validators ── */}
      {activeTab === 'validators' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-6)' }}>
          <div className="grid-2">
            {/* Validator pool overview */}
            <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)' }}>
                <ShieldCheck size={18} style={{ color: 'var(--accent)' }} />
                <h3 style={{ margin: 0 }}>Validator Pool</h3>
              </div>
              <div className="divider" style={{ margin: 0 }} />

              {/* Validators from consensus.rs mock data */}
              {[
                { address: 'genesis-validator', stake: '—', role: 'Fallback' },
                { address: 'validator-alpha', stake: '420,000', role: 'Active' },
                { address: 'validator-beta', stake: '310,000', role: 'Active' },
                { address: 'validator-gamma', stake: '280,000', role: 'Syncing' },
              ].map((v) => (
                <div
                  key={v.address}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--sp-4)',
                    padding: 'var(--sp-3)',
                    background: 'var(--bg-muted)',
                    borderRadius: 'var(--r-md)',
                  }}
                >
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: '50%',
                      background: 'var(--accent-dim)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <ShieldCheck size={16} style={{ color: 'var(--accent)' }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="font-mono" style={{ fontSize: '0.83rem', color: 'var(--text-primary)', fontWeight: 600 }}>
                      {v.address}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2 }}>
                      Stake: {v.stake} TFC
                    </div>
                  </div>
                  <span className={`badge ${v.role === 'Active' ? 'badge-success' : v.role === 'Syncing' ? 'badge-warning' : 'badge-muted'}`}>
                    {v.role}
                  </span>
                </div>
              ))}
            </div>

            {/* How PoS selection works */}
            <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)' }}>
                <Link2 size={18} style={{ color: 'var(--accent2)' }} />
                <h3 style={{ margin: 0 }}>Selection Mechanism</h3>
              </div>
              <div className="divider" style={{ margin: 0 }} />

              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
                {[
                  {
                    step: '01',
                    title: 'Weighted Random Selection',
                    desc: 'At block production time, a validator is chosen proportional to their staked amount — higher stake means a greater probability of being selected.',
                  },
                  {
                    step: '02',
                    title: 'Hash Without Grinding',
                    desc: 'Unlike PoW, PoS does not iterate nonces. The chosen validator signs the block directly using a SHA-256 of index + prev hash + timestamp + address.',
                  },
                  {
                    step: '03',
                    title: 'Verification',
                    desc: 'Blocks are verified by checking the hash is well-formed (64 valid hex characters). No difficulty target is required.',
                  },
                ].map((item) => (
                  <div key={item.step} style={{ display: 'flex', gap: 'var(--sp-4)' }}>
                    <div
                      className="font-mono"
                      style={{
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        color: 'var(--accent)',
                        background: 'var(--accent-dim)',
                        padding: '4px 8px',
                        borderRadius: 'var(--r-sm)',
                        height: 'fit-content',
                        flexShrink: 0,
                        marginTop: 2,
                      }}
                    >
                      {item.step}
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.88rem', color: 'var(--text-primary)', marginBottom: 4 }}>
                        {item.title}
                      </div>
                      <p style={{ fontSize: '0.82rem', lineHeight: 1.55, margin: 0 }}>{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="divider" style={{ margin: 0 }} />

              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)' }}>
                <div className="flex-between text-sm">
                  <span className="text-muted">Consensus Engine</span>
                  <span className="badge badge-accent font-mono">PoS</span>
                </div>
                <div className="flex-between text-sm">
                  <span className="text-muted">PoW Removed</span>
                  <span className="badge badge-success">Yes</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Tab: Network ── */}
      {activeTab === 'network' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-6)' }}>
          <div className="card flex col gap-4">
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)' }}>
              <Radio size={18} style={{ color: 'var(--accent)' }} />
              <h3 style={{ margin: 0 }}>Connect to a Peer</h3>
            </div>
            <div className="divider" style={{ margin: 0 }} />

            <p className="text-sm text-muted" style={{ margin: 0 }}>
              Connect this node to another blockchain-node instance (e.g. one running on{' '}
              <code className="font-mono">--port 8081</code>). Once connected, blocks mined by
              either node propagate automatically to the other.
            </p>

            <div className="flex gap-3">
              <input
                className="form-input mono"
                style={{ flex: 1 }}
                placeholder="http://127.0.0.1:8081"
                value={peerAddress}
                onChange={(e) => setPeerAddress(e.target.value)}
              />
              <button
                className="cute-button"
                type="button"
                disabled={peerBusy || !peerAddress}
                onClick={handleConnectPeer}
              >
                {peerBusy ? 'Connecting…' : 'Connect'}
              </button>
            </div>

            {peerResult && (
              <div
                className="text-sm"
                style={{ color: peerResult.ok ? 'var(--success)' : 'var(--danger)' }}
              >
                {peerResult.message}
              </div>
            )}
          </div>

          <div className="card flex col gap-4">
            <div className="flex-between">
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)' }}>
                <Link2 size={18} style={{ color: 'var(--accent2)' }} />
                <h3 style={{ margin: 0 }}>Connected Peers ({peers.length})</h3>
              </div>
              <button
                className="btn btn-ghost btn-sm"
                type="button"
                onClick={fetchPeers}
                disabled={peerBusy}
                style={{ gap: 6 }}
              >
                <RefreshCw size={14} />
                Refresh
              </button>
            </div>
            <div className="divider" style={{ margin: 0 }} />

            {peers.length === 0 && (
              <p className="text-sm text-muted" style={{ margin: 0 }}>
                No peers connected yet. This node is running standalone — its blocks
                won't sync anywhere until you connect one above.
              </p>
            )}

            {peers.map((peer) => (
              <div
                key={peer}
                className="flex-between"
                style={{ padding: 'var(--sp-3)', background: 'var(--bg-muted)', borderRadius: 'var(--r-md)' }}
              >
                <span className="font-mono text-sm">{peer}</span>
                <span className="badge badge-success">Connected</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Spin keyframe */}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

export default Blockchain;
 