#!/usr/bin/env python3
"""
TradeFlow Blockchain GUI
━━━━━━━━━━━━━━━━━━━━━━━
A Python CLI + REST wrapper that replaces the Rust CLI.
Also runs its own mini REST API (Flask) on port 9090 with:
  POST /blocks        – submit a tx then mine a new block
  GET  /blocks        – retrieve all blocks via SQL

Requires:
  pip install requests flask tabulate colorama
"""

import sys
import json
import subprocess
import threading
import textwrap
from datetime import datetime, timezone

try:
    import requests
except ImportError:
    sys.exit("Missing dependency: pip install requests flask tabulate colorama")

try:
    from flask import Flask, request, jsonify
except ImportError:
    sys.exit("Missing dependency: pip install flask")

try:
    from tabulate import tabulate
except ImportError:
    sys.exit("Missing dependency: pip install tabulate")

try:
    from colorama import init as colorama_init, Fore, Style
    colorama_init(autoreset=True)
except ImportError:
    class _Noop:
        def __getattr__(self, _): return ""
    Fore = Style = _Noop()

# ─────────────────────────────────────────────
# CONFIG
# ─────────────────────────────────────────────
NODE_URL   = "http://127.0.0.1:8080"
PROXY_PORT = 9090

# ─────────────────────────────────────────────
# HELPERS
# ─────────────────────────────────────────────

def ts_to_str(ts: int) -> str:
    try:
        return datetime.fromtimestamp(ts, tz=timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")
    except Exception:
        return str(ts)


def ok(msg: str):
    print(Fore.GREEN + "✔ " + Style.RESET_ALL + msg)


def err(msg: str):
    print(Fore.RED + "✘ " + Style.RESET_ALL + msg)


def info(msg: str):
    print(Fore.CYAN + "→ " + Style.RESET_ALL + msg)


def divider(title=""):
    width = 60
    if title:
        pad = (width - len(title) - 2) // 2
        print(Fore.YELLOW + "─" * pad + f" {title} " + "─" * pad + Style.RESET_ALL)
    else:
        print(Fore.YELLOW + "─" * width + Style.RESET_ALL)


def node_post(path: str, payload: dict = None):
    try:
        r = requests.post(f"{NODE_URL}{path}", json=payload, timeout=120)
        return r
    except requests.ConnectionError:
        err(f"Cannot connect to node at {NODE_URL}. Is it running?")
        return None


def node_get(path: str):
    try:
        r = requests.get(f"{NODE_URL}{path}", timeout=10)
        return r
    except requests.ConnectionError:
        err(f"Cannot connect to node at {NODE_URL}. Is it running?")
        return None


def node_sql(query: str):
    r = node_post("/sql", {"sql": query})
    if r is None:
        return None
    if r.status_code != 200:
        err(f"SQL error: {r.text}")
        return None
    return r.json()


# ─────────────────────────────────────────────
# NODE LAUNCHER
# ─────────────────────────────────────────────

_node_proc  = None
_node_ready = threading.Event()   # set when HTTP /consensus/status returns 200


def _stream_node_output(proc):
    """
    Background thread: pipes the node's stdout/stderr to the terminal
    and sets _node_ready once the 'running at' line appears.
    """
    ready_marker = b"running at"
    for raw_line in iter(proc.stdout.readline, b""):
        line = raw_line.decode(errors="replace").rstrip()
        print(Fore.YELLOW + "[node] " + Style.RESET_ALL + line)
        if ready_marker in raw_line.lower():
            _node_ready.set()
    # process exited — make sure we don't block waiters forever
    _node_ready.set()


def _wait_for_node(timeout: int = 120):
    """
    Poll GET /consensus/status until the node answers or we time out.
    Shows a simple progress indicator while waiting.
    """
    import time
    deadline = time.time() + timeout
    dots = 0
    while time.time() < deadline:
        try:
            r = requests.get(f"{NODE_URL}/consensus/status", timeout=3)
            if r.status_code == 200:
                return True
        except Exception:
            pass
        dots = (dots + 1) % 4
        print(f"\r{Fore.CYAN}  Waiting for node{'.' * dots}   {Style.RESET_ALL}", end="", flush=True)
        time.sleep(2)
    print()
    return False


def start_node(consensus: str = "pow"):
    global _node_proc
    _node_ready.clear()

    # ── Already running? ──────────────────────────────────────────────
    if _node_proc and _node_proc.poll() is None:
        info("Node process is already running.")
        return

    # Check if something else is already listening on 8080
    try:
        r = requests.get(f"{NODE_URL}/consensus/status", timeout=3)
        if r.status_code == 200:
            ok("Node is already up and responding on port 8080.")
            return
    except Exception:
        pass  # not running yet — that's fine

    # ── Ask where the project lives ───────────────────────────────────
    divider("START NODE")
    print(f"  Consensus : {consensus.upper()}")
    print(f"  Command   : cargo run --bin blockchain-node -- --consensus {consensus}")
    print()
    project_dir = input(
        "Path to your rust-blockchain project folder\n"
        "(leave blank to use current directory): "
    ).strip() or None

    answer = input("Launch node now? [y/N] ").strip().lower()
    if answer != "y":
        info("Skipped. Start the node manually:")
        print(f"  cd <rust-blockchain>")
        print(f"  cargo run --bin blockchain-node -- --consensus {consensus}")
        return

    cmd = ["cargo", "run", "--bin", "blockchain-node", "--", "--consensus", consensus]

    try:
        _node_proc = subprocess.Popen(
            cmd,
            cwd=project_dir,           # None = current dir, which is fine
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,  # merge stderr → stdout
        )
    except FileNotFoundError:
        err("'cargo' not found. Make sure Rust is installed and on your PATH.")
        return

    ok(f"Node process started (PID {_node_proc.pid}).")
    info("Streaming node output below — this may take 30–60 s on first compile:")
    print()

    # Stream output in background thread
    t = threading.Thread(target=_stream_node_output, args=(_node_proc,), daemon=True)
    t.start()

    # Block until HTTP is up (or timeout)
    info("Waiting for node HTTP server to become ready …")
    if _wait_for_node(timeout=180):
        print()
        ok("Node is ready!  http://127.0.0.1:8080")
    else:
        print()
        err("Timed out waiting for node. It may still be compiling — check output above.")
        info("Try other menu options once you see 'running at http://127.0.0.1:8080' above.")


def stop_node():
    global _node_proc
    if _node_proc and _node_proc.poll() is None:
        _node_proc.terminate()
        ok("Node process terminated.")
        _node_proc = None
    else:
        info("No managed node process is running.")


# ─────────────────────────────────────────────
# FEATURE FUNCTIONS
# ─────────────────────────────────────────────

def deploy_transaction():
    """Submit a transaction (deploy contract) to the mempool."""
    divider("DEPLOY TRANSACTION")
    bytecode = input("Hex bytecode (e.g. deadbeef): ").strip()
    method   = input("Method/action  (e.g. init):   ").strip()

    if not bytecode or not method:
        err("Both bytecode and method are required.")
        return

    r = node_post("/tx/submit", {
        "id": "",
        "contract_code": bytecode,
        "contract_action": method
    })
    if r is None:
        return

    if r.status_code == 200:
        tx = r.json()
        ok("Transaction submitted to mempool.")
        print(f"  TX ID      : {tx.get('id', 'n/a')}")
        print(f"  Contract   : {tx.get('contract_code', 'n/a')}")
        print(f"  Action     : {tx.get('contract_action', 'n/a')}")
    else:
        err(f"Failed ({r.status_code}): {r.text}")


def mine_block():
    """Mine pending mempool transactions into a new block."""
    divider("MINE BLOCK")
    info("Mining … (PoW may take a few seconds)")

    r = node_post("/engine/mine")
    if r is None:
        return

    if r.status_code == 200:
        b = r.json()
        ok("Block mined successfully!\n")
        print(f"  Block #    : {b['index']}")
        print(f"  Time       : {ts_to_str(b['timestamp'])}")
        print(f"  Nonce      : {b['nonce']}")
        print(f"  Hash       : {b['hash']}")
        print(f"  Prev Hash  : {b['previous_hash']}")
        txs = b.get("transactions", [])
        if txs:
            print(f"\n  Transactions ({len(txs)}):")
            for tx in txs:
                print(f"    • {tx['id'][:16]}…  action={tx.get('contract_action','–')}")
    else:
        err(f"Mine failed: {r.text}")


def view_consensus_status():
    """GET /consensus/status"""
    divider("CONSENSUS STATUS")
    r = node_get("/consensus/status")
    if r is None:
        return
    if r.status_code == 200:
        data = r.json()
        engine = data.get("engine", "?")
        active = data.get("active", False)
        label = "Proof of Work (PoW)" if engine == "PoW" else "Proof of Stake (PoS)"
        ok(f"Active engine : {label}")
        print(f"  Status      : {'Active' if active else 'Inactive'}")
    else:
        err(f"Could not fetch status: {r.text}")


def query_state():
    """GET /query/state/{contract_id}/{key_slot}"""
    divider("QUERY CONTRACT STATE")
    contract_id = input("Contract ID  : ").strip()
    key_slot     = input("Key slot     : ").strip()

    if not contract_id or not key_slot:
        err("Both fields are required.")
        return

    r = node_get(f"/query/state/{contract_id}/{key_slot}")
    if r is None:
        return
    ok(f"State value: {r.text}")


def sql_query_interactive():
    """POST /sql with user-supplied query."""
    divider("SQL QUERY")
    print("Examples:")
    print("  SELECT * FROM blocks")
    print("  SELECT COUNT(*) FROM blocks")
    print("  SELECT hash, nonce FROM blocks WHERE tx_count > 0")
    print("  SELECT * FROM transactions")
    print("  SELECT * FROM transactions WHERE contract_action = 'init'")
    print()
    query = input("SQL> ").strip()
    if not query:
        err("Empty query.")
        return
    _run_and_print_sql(query)


def _run_and_print_sql(query: str):
    rows = node_sql(query)
    if rows is None:
        return
    if not rows:
        info("Query returned no rows.")
        return

    # rows is a list of dicts
    if isinstance(rows, list) and rows:
        headers = list(rows[0].keys())
        table   = [[row.get(h, "") for h in headers] for row in rows]
        print()
        print(tabulate(table, headers=headers, tablefmt="rounded_outline"))
        print(f"\n  {len(rows)} row(s) returned.")
    else:
        print(json.dumps(rows, indent=2))


def view_all_blocks():
    """Pretty-print all blocks via SQL."""
    divider("ALL BLOCKS")
    _run_and_print_sql("SELECT * FROM blocks")


def view_all_transactions():
    """Pretty-print all transactions via SQL."""
    divider("ALL TRANSACTIONS")
    _run_and_print_sql("SELECT * FROM transactions")


def quick_workflow():
    """Deploy + Mine in one go (convenience shortcut)."""
    divider("QUICK WORKFLOW  (Deploy → Mine)")
    bytecode = input("Hex bytecode (e.g. deadbeef): ").strip() or "deadbeef"
    method   = input("Method/action  (e.g. init):   ").strip() or "init"

    info("Step 1/2 – Submitting transaction …")
    r = node_post("/tx/submit", {
        "id": "",
        "contract_code": bytecode,
        "contract_action": method
    })
    if r is None or r.status_code != 200:
        err(f"Submit failed: {r.text if r else 'no response'}")
        return
    tx = r.json()
    ok(f"TX submitted → {tx.get('id','?')[:16]}…")

    info("Step 2/2 – Mining block …")
    r2 = node_post("/engine/mine")
    if r2 is None:
        return
    if r2.status_code == 200:
        b = r2.json()
        ok(f"Block #{b['index']} mined  |  hash={b['hash'][:20]}…")
    else:
        err(f"Mine failed: {r2.text}")


# ─────────────────────────────────────────────
# PYTHON REST PROXY (Flask, port 9090)
# ─────────────────────────────────────────────

flask_app = Flask(__name__)
_flask_thread = None


@flask_app.route("/blocks", methods=["POST"])
def proxy_create_block():
    """
    POST /blocks
    Body: { "contract_code": "...", "contract_action": "..." }
    Submits tx then mines immediately — returns the new block.
    """
    body = request.get_json(force=True, silent=True) or {}
    code   = body.get("contract_code", "")
    action = body.get("contract_action", "")

    # 1. Submit tx
    r1 = requests.post(f"{NODE_URL}/tx/submit", json={
        "id": "",
        "contract_code": code,
        "contract_action": action
    }, timeout=30)
    if r1.status_code != 200:
        return jsonify({"error": "tx submit failed", "detail": r1.text}), 502

    # 2. Mine
    r2 = requests.post(f"{NODE_URL}/engine/mine", timeout=120)
    if r2.status_code != 200:
        return jsonify({"error": "mine failed", "detail": r2.text}), 502

    return jsonify(r2.json()), 201


@flask_app.route("/blocks", methods=["GET"])
def proxy_get_blocks():
    """
    GET /blocks
    Returns all blocks as JSON (via the SQL engine).
    """
    try:
        r = requests.post(f"{NODE_URL}/sql",
                          json={"sql": "SELECT * FROM blocks"},
                          timeout=10)
        if r.status_code != 200:
            return jsonify({"error": r.text}), 502
        return jsonify(r.json()), 200
    except requests.ConnectionError:
        return jsonify({"error": "node unavailable"}), 503


def _run_flask():
    flask_app.run(host="0.0.0.0", port=PROXY_PORT, use_reloader=False, debug=False)


def start_proxy_server():
    global _flask_thread
    if _flask_thread and _flask_thread.is_alive():
        info(f"Python REST proxy already running on port {PROXY_PORT}.")
        return
    _flask_thread = threading.Thread(target=_run_flask, daemon=True)
    _flask_thread.start()
    ok(f"Python REST proxy started on http://127.0.0.1:{PROXY_PORT}")
    print("  POST /blocks  { contract_code, contract_action }  → mine a new block")
    print("  GET  /blocks                                       → retrieve all blocks")


# ─────────────────────────────────────────────
# MAIN MENU
# ─────────────────────────────────────────────

MENU = [
    ("1",  "Start blockchain node (PoW)",              lambda: start_node("pow")),
    ("2",  "Start blockchain node (PoS)",              lambda: start_node("pos")),
    ("3",  "Stop managed node process",                stop_node),
    ("",   "",                                         None),
    ("4",  "Deploy / submit transaction",              deploy_transaction),
    ("5",  "Mine pending transactions → new block",    mine_block),
    ("6",  "Quick workflow  (deploy + mine in one go)",quick_workflow),
    ("",   "",                                         None),
    ("7",  "View all blocks",                          view_all_blocks),
    ("8",  "View all transactions",                    view_all_transactions),
    ("9",  "SQL query (custom)",                       sql_query_interactive),
    ("10", "Query contract state",                     query_state),
    ("11", "Check consensus status",                   view_consensus_status),
    ("",   "",                                         None),
    ("12", "Start Python REST proxy  (port 9090)",     start_proxy_server),
    ("",   "",                                         None),
    ("q",  "Quit",                                     None),
]


def print_menu():
    print()
    divider("TradeFlow Blockchain Manager")
    for key, label, _ in MENU:
        if key == "":
            print()
        else:
            print(f"  {Fore.CYAN}{key:>2}{Style.RESET_ALL}  {label}")
    divider()
    print()


def main():
    print(Fore.MAGENTA + textwrap.dedent("""
    ████████╗██████╗  █████╗ ██████╗ ███████╗
       ██╔══╝██╔══██╗██╔══██╗██╔══██╗██╔════╝
       ██║   ██████╔╝███████║██║  ██║█████╗
       ██║   ██╔══██╗██╔══██║██║  ██║██╔══╝
       ██║   ██║  ██║██║  ██║██████╔╝███████╗
       ╚═╝   ╚═╝  ╚═╝╚═╝  ╚═╝╚═════╝ ╚══════╝
         F L O W   B L O C K C H A I N   G U I
    """) + Style.RESET_ALL)

    # Auto-start the proxy so it's ready immediately
    start_proxy_server()

    while True:
        print_menu()
        choice = input("Select option: ").strip().lower()

        if choice in ("q", "quit", "exit"):
            info("Goodbye.")
            break

        matched = False
        for key, _, fn in MENU:
            if key == choice and fn is not None:
                matched = True
                try:
                    fn()
                except KeyboardInterrupt:
                    print()
                    info("Interrupted.")
                except Exception as exc:
                    err(f"Unexpected error: {exc}")
                break

        if not matched and choice:
            err(f"Unknown option '{choice}'. Try again.")

        input(Fore.YELLOW + "\n[Press Enter to return to menu]" + Style.RESET_ALL)


if __name__ == "__main__":
    main()
