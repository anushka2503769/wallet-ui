import { useState, useEffect } from "react";

function Settings() {
  // Theme and UI Configuration States
  const [theme, setTheme] = useState("dark");
  const [network, setNetwork] = useState("mainnet");
  const [slippage, setSlippage] = useState("0.5");
  const [customRpc, setCustomRpc] = useState("");
  const [biometrics, setBiometrics] = useState(true);

  // --- ADD THIS HOOK TO TRANSLATE STATE TO GLOBAL DOM CLASS ---
  useEffect(() => {
    // Option A: If your variables.css switches style variables using a [data-theme="light"] attribute
    document.documentElement.setAttribute("data-theme", theme);
    
    // Option B: If your layout handles themes using an active utility selector (.light-theme vs .dark-theme)
    // document.body.className = `${theme}-theme`;
  }, [theme]);
  // -------------------------------------------------------------

  return (
    <div className="page-container">
      <div className="page-header">
        <h2>Settings</h2>
        <p>Manage wallet preferences, algorithmic security rules, and network connectivity profiles.</p>
      </div>

      <div className="grid-auto">
        {/* Panel 1: Personalization & Themes */}
        <div className="card flex col gap-4">
          <div>
            <h3>Appearance</h3>
            <p className="text-sm text-muted mt-2">Customize the client interface layout context.</p>
          </div>
          <div className="divider" style={{ margin: 0 }}></div>

          <div className="flex col gap-2">
            <label className="form-label">Active Theme Mode</label>
            <div className="tabs">
              <button 
                type="button"
                className={`tab-btn ${theme === "dark" ? "active" : ""}`}
                onClick={() => setTheme("dark")}
              >
                🌙 Dark Mode
              </button>
              <button 
                type="button"
                className={`tab-btn ${theme === "light" ? "active" : ""}`}
                onClick={() => setTheme("light")}
              >
                ☀️ Light Mode
              </button>
            </div>
          </div>
        </div>

        {/* Panel 2: Network Ecosystem Profile */}
        <div className="card flex col gap-4">
          <div>
            <h3>Network Node Provider</h3>
            <p className="text-sm text-muted mt-2">Switch default blockchain connections or hook custom relays.</p>
          </div>
          <div className="divider" style={{ margin: 0 }}></div>

          <div className="flex col gap-2">
            <label className="form-label">Target Network Environment</label>
            <div className="tabs">
              <button 
                type="button"
                className={`tab-btn ${network === "mainnet" ? "active" : ""}`}
                onClick={() => setNetwork("mainnet")}
              >
                TradeFlow Mainnet
              </button>
              <button 
                type="button"
                className={`tab-btn ${network === "testnet" ? "active" : ""}`}
                onClick={() => setNetwork("testnet")}
              >
                Harness Testnet v2
              </button>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Custom RPC Endpoint Override</label>
            <input 
              type="text" 
              className="form-input mono" 
              placeholder="https://rpc.tradeflow.network"
              value={customRpc}
              onChange={(e) => setCustomRpc(e.target.value)}
            />
          </div>
        </div>

        {/* Panel 3: Trade and Transaction Handling */}
        <div className="card flex col gap-4">
          <div>
            <h3>Trading Engine Constraints</h3>
            <p className="text-sm text-muted mt-2">Set guardrails for asset routing and slippage tolerances.</p>
          </div>
          <div className="divider" style={{ margin: 0 }}></div>

          <div className="form-group">
            <label className="form-label">Max Slippage Tolerance (%)</label>
            <div className="flex gap-2">
              {["0.1", "0.5", "1.0"].map((val) => (
                <button
                  key={val}
                  type="button"
                  className={`btn btn-sm ${slippage === val ? "btn-primary" : "btn-ghost"}`}
                  onClick={() => setSlippage(val)}
                  style={{ flex: 1 }}
                >
                  {val}%
                </button>
              ))}
              <input 
                type="number" 
                className="form-input btn-sm text-center" 
                style={{ width: "80px" }}
                placeholder="Custom"
                value={slippage}
                onChange={(e) => setSlippage(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Panel 4: Security Credentials & Key Export */}
        <div className="card flex col gap-4">
          <div>
            <h3>Security & Hardware Vault</h3>
            <p className="text-sm text-muted mt-2">Manage programmatic authorization keys and signature rules.</p>
          </div>
          <div className="divider" style={{ margin: 0 }}></div>

          <div className="flex-between text-sm">
            <span className="text-muted">Biometric Quick Signing</span>
            <button 
              type="button"
              className={`btn btn-sm ${biometrics ? "btn-primary" : "btn-secondary"}`}
              onClick={() => setBiometrics(!biometrics)}
            >
              {biometrics ? "Enabled" : "Disabled"}
            </button>
          </div>

          <div className="flex col gap-2">
            <label className="form-label">Public Address</label>
            <div className="address-display">
              <span className="address-text">0x71C7656EC7ab88b098defB751B7401B5f6d1476B</span>
              <span className="badge badge-accent">Copied</span>
            </div>
          </div>

          <div className="divider" style={{ margin: 0 }}></div>

          <div className="flex gap-3">
            <button className="cute-button btn-full" type="button">
              Backup Secret Phrase
            </button>
            <button className="btn btn-danger btn-full" type="button" style={{ borderRadius: "14px" }}>
              Nuke Key Storage
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Settings;