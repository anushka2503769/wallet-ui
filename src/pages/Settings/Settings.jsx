import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

function Settings() {
  const { user, updateProfile, changePassword, logout } = useAuth();
  const navigate = useNavigate();

  const [theme, setTheme] = useState("dark");
  const [notifications, setNotifications] = useState(true);
  const [twoFA, setTwoFA] = useState(false);
  const [copied, setCopied] = useState(false);

  // State to hold the profile picture URL (null defaults to 'N')
  const [avatarUrl, setAvatarUrl] = useState(null);

  // Reference to the hidden file input element
  const fileInputRef = useRef(null);

  // Profile form — pre-filled with whatever was set at registration
  const [profileForm, setProfileForm] = useState({
    displayName: user?.displayName || "",
    email: user?.email || ""
  });
  const [profileMessage, setProfileMessage] = useState(null);
  const [profileError, setProfileError] = useState(null);

  // Password form
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: ""
  });
  const [passwordMessage, setPasswordMessage] = useState(null);
  const [passwordError, setPasswordError] = useState(null);

  // Keep the form in sync if the user object changes (e.g. after a save)
  useEffect(() => {
    setProfileForm({
      displayName: user?.displayName || "",
      email: user?.email || ""
    });
  }, [user]);

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

  const handleProfileChange = (e) => {
    setProfileForm({ ...profileForm, [e.target.name]: e.target.value });
  };

  const handleSaveProfile = () => {
    setProfileMessage(null);
    setProfileError(null);

    try {
      updateProfile(profileForm);
      setProfileMessage("Profile updated.");
    } catch (err) {
      setProfileError(err.message);
    }
  };

  const handlePasswordChange = (e) => {
    setPasswordForm({ ...passwordForm, [e.target.name]: e.target.value });
  };

  const handleChangePassword = () => {
    setPasswordMessage(null);
    setPasswordError(null);

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordError("New passwords do not match.");
      return;
    }

    try {
      changePassword(passwordForm);
      setPasswordMessage("Password changed.");
      setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
    } catch (err) {
      setPasswordError(err.message);
    }
  };

  const handleLogout = () => {
    logout();
    navigate("/login");
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
              {!avatarUrl && (profileForm.displayName?.[0]?.toUpperCase() || "?")}
            </div>

            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={handleAvatarButtonClick}
            >
              Change Profile Picture
            </button>
          </div>

          {profileError && (
            <p className="text-sm" style={{ color: "var(--danger)" }}>{profileError}</p>
          )}
          {profileMessage && (
            <p className="text-sm" style={{ color: "var(--success)" }}>{profileMessage}</p>
          )}

          <div className="form-group">
            <label className="form-label">Display Name</label>
            <input
              className="form-input"
              type="text"
              name="displayName"
              value={profileForm.displayName}
              onChange={handleProfileChange}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Email</label>
            <input
              className="form-input"
              type="email"
              name="email"
              value={profileForm.email}
              onChange={handleProfileChange}
            />
          </div>

          <button type="button" className="btn btn-primary mt-2" onClick={handleSaveProfile}>
            Save Changes
          </button>
        </div>

        {/* Password */}
        <div className="card flex col gap-4">
          <h2>Password</h2>

          {passwordError && (
            <p className="text-sm" style={{ color: "var(--danger)" }}>{passwordError}</p>
          )}
          {passwordMessage && (
            <p className="text-sm" style={{ color: "var(--success)" }}>{passwordMessage}</p>
          )}

          <div className="form-group">
            <label className="form-label">Current Password</label>
            <input
              className="form-input"
              type="password"
              name="currentPassword"
              placeholder="••••••••"
              value={passwordForm.currentPassword}
              onChange={handlePasswordChange}
            />
          </div>

          <div className="form-group">
            <label className="form-label">New Password</label>
            <input
              className="form-input"
              type="password"
              name="newPassword"
              placeholder="Enter new password"
              value={passwordForm.newPassword}
              onChange={handlePasswordChange}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Confirm Password</label>
            <input
              className="form-input"
              type="password"
              name="confirmPassword"
              placeholder="Confirm password"
              value={passwordForm.confirmPassword}
              onChange={handlePasswordChange}
            />
          </div>

          <button type="button" className="btn btn-primary mt-2" onClick={handleChangePassword}>
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
          <button type="button" className="btn btn-danger btn-full mt-2" onClick={handleLogout}>
            Logout
          </button>
        </div>

      </div>
    </div>
  );
}

export default Settings;