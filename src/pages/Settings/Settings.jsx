import { useState, useEffect, useRef } from "react";

function Settings() {
  const [theme, setTheme] = useState("dark");
  const [notifications, setNotifications] = useState(true);
  const [twoFA, setTwoFA] = useState(false);
  const [copied, setCopied] = useState(false);
  
  // State to hold the profile picture URL (null defaults to 'N')
  const [avatarUrl, setAvatarUrl] = useState(null);
  
  // Reference to the hidden file input element
  const fileInputRef = useRef(null);

  // Synchronize state value with document element attribute for real-time theme swapping
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  // Handle clipboard actions safely
  const handleCopy = async () => {
    const address = "0x7A91E4B6F93D5A4E9A2F1C83D4AB6C21F5D8E9A7";
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy address: ", err);
    }
  };

  // Trigger the hidden file input when the cute button is clicked
  const handleAvatarButtonClick = () => {
    fileInputRef.current.click();
  };

  // Process the uploaded file and create a temporary preview URL
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setAvatarUrl(url);
    }
  };

  return (
    <div className="page-container">
      {/* Page Header */}
      <div className="page-header mb-4">
        <h1>Account Settings</h1>
        <p>Manage your account preferences and wallet settings.</p>
      </div>

      {/* Main Responsive Grid Layout */}
      <div className="grid-auto">

        {/* Profile */}
        <div className="card flex col gap-4">
          <h2>Profile Information</h2>

          <div className="flex align-center gap-4 mt-2 mb-2">
            {/* Hidden native input file explorer selector */}
            <input 
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept="image/*"
              style={{ display: "none" }}
            />

            {/* Dynamic Avatar Container */}
            <div 
              className="flex-center font-mono text-inverse"
              style={{ 
                width: "48px", 
                height: "48px", 
                borderRadius: "var(--r-full)", 
                background: avatarUrl ? `url(${avatarUrl}) center/cover no-repeat` : "var(--accent)",
                fontWeight: "700",
                overflow: "hidden"
              }}
            >
              {!avatarUrl && "N"}
            </div>
            
            <button 
              type="button" 
              className="btn btn-secondary btn-sm"
              onClick={handleAvatarButtonClick}
            >
              Change Profile Picture
            </button>
          </div>

          <div className="form-group">
            <label className="form-label">Display Name</label>
            <input
              className="form-input"
              type="text"
              defaultValue="John Doe"
            />
          </div>

          <div className="form-group">
            <label className="form-label">Email</label>
            <input
              className="form-input"
              type="email"
              defaultValue="john@example.com"
            />
          </div>

          <button type="button" className="btn btn-primary mt-2">
            Save Changes
          </button>
        </div>

        {/* Password */}
        <div className="card flex col gap-4">
          <h2>Password</h2>

          <div className="form-group">
            <label className="form-label">Current Password</label>
            <input
              className="form-input"
              type="password"
              placeholder="••••••••"
            />
          </div>

          <div className="form-group">
            <label className="form-label">New Password</label>
            <input
              className="form-input"
              type="password"
              placeholder="Enter new password"
            />
          </div>

          <div className="form-group">
            <label className="form-label">Confirm Password</label>
            <input
              className="form-input"
              type="password"
              placeholder="Confirm password"
            />
          </div>

          <button type="button" className="btn btn-primary mt-2">
            Change Password
          </button>
        </div>

        {/* Wallet */}
        <div className="card flex col gap-4">
          <h2>Wallet Information</h2>

          <div className="form-group">
            <label className="form-label">Wallet Address</label>
            
            <div className="address-display">
              <div className="address-text">
                0x7A91E4B6F93D5A4E9A2F1C83D4AB6C21F5D8E9A7
              </div>
              {copied && <span className="badge badge-accent">Copied</span>}
            </div>

            <button 
              type="button" 
              className="btn btn-secondary btn-full mt-2"
              onClick={handleCopy}
            >
              {copied ? "Copied Address!" : "Copy Address"}
            </button>
          </div>
        </div>

        {/* Appearance */}
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

        {/* Notifications */}
        <div className="card flex col gap-4">
          <h2>Notifications</h2>

          <div className="flex-between py-2">
            <span className="text-sm">Email Notifications</span>
            <input
              type="checkbox"
              style={{ accentColor: "var(--accent)", width: "16px", height: "16px" }}
              checked={notifications}
              onChange={() => setNotifications(!notifications)}
            />
          </div>

          <div className="flex-between py-2">
            <span className="text-sm">Transaction Alerts</span>
            <input 
              type="checkbox" 
              style={{ accentColor: "var(--accent)", width: "16px", height: "16px" }}
              defaultChecked 
            />
          </div>

          <div className="flex-between py-2">
            <span className="text-sm">Security Alerts</span>
            <input 
              type="checkbox" 
              style={{ accentColor: "var(--accent)", width: "16px", height: "16px" }}
              defaultChecked 
            />
          </div>
        </div>

        {/* Security */}
        <div className="card flex col gap-4">
          <h2>Security</h2>

          <div className="flex-between mb-2">
            <span className="text-sm">Two-Factor Authentication</span>
            <input
              type="checkbox"
              style={{ accentColor: "var(--accent)", width: "16px", height: "16px" }}
              checked={twoFA}
              onChange={() => setTwoFA(!twoFA)}
            />
          </div>

          <button type="button" className="btn btn-secondary btn-full">
            Manage Recovery Codes
          </button>

          <button type="button" className="btn btn-secondary btn-full">
            View Active Sessions
          </button>
        </div>

        {/* Logout */}
        <div className="card flex col gap-4" style={{ borderColor: "var(--danger)" }}>
          <h2>Account Actions</h2>
          <p className="text-sm text-muted">
            Sign out of your wallet on this device securely.
          </p>
          <button type="button" className="btn btn-danger btn-full mt-2">
            Logout
          </button>
        </div>

      </div>
    </div>
  );
}

export default Settings;
