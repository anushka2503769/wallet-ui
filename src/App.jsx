import { Routes, Route, Navigate } from 'react-router-dom';
import { NavLink } from 'react-router-dom';
import routes, { publicRoutes } from './routes';

import { useState, useEffect } from 'react';
import { useAuth } from './context/AuthContext';

function AppLayout() {
  const [theme, setTheme] = useState('dark');
  const { user, isAdmin, logout } = useAuth();

  useEffect(() => {
    document.documentElement.setAttribute(
      'data-theme',
      theme
    );
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) =>
      prev === 'dark' ? 'light' : 'dark'
    );
  };

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="sidebar-logo">
          <h2>TradeFlow Wallet</h2>
        </div>

        <nav>
          <NavLink
            to="/"
            className="sidebar-link"
          >
            Portfolio
          </NavLink>

          <NavLink
            to="/sendreceive"
            className="sidebar-link"
          >
            Send & Receive
          </NavLink>

          <NavLink
            to="/staking"
            className="sidebar-link"
          >
            Staking
          </NavLink>

          {/* Harness is admin-only — regular users never see this link */}
          {isAdmin && (
            <NavLink
              to="/harness"
              className="sidebar-link"
            >
              Harness
            </NavLink>
          )}

          <NavLink
            to="/markets"
            className="sidebar-link"
          >
            Markets
          </NavLink>

          <NavLink
            to="/open-positions"
            className="sidebar-link"
          >
            Open Positions
          </NavLink>

          <NavLink
            to="/trade-history"
            className="sidebar-link"
          >
            Trade History
          </NavLink>
          <NavLink
            to="/blockchain"
            className="sidebar-link"
          >
            Blockchain
          </NavLink>

          <NavLink
            to="/settings"
            className="sidebar-link"
          >
            Settings
          </NavLink>
        </nav>
      </aside>

      <main className="main-content">
        <header className="header">
          <h3>Blockchain Testing Framework</h3>

          <div className="flex align-center gap-4">
            {user && (
              <span className="text-sm text-muted">
                {user.displayName || user.email} &middot; {isAdmin ? 'Admin' : 'User'}
              </span>
            )}

            <button
              className="theme-toggle"
              onClick={toggleTheme}
            >
              {theme === 'dark' ? '☀️' : '🌙'}
            </button>

            <button className="cute-button" onClick={logout} type="button">
              Log Out
            </button>
          </div>
        </header>

        <div className="page-container">
          <Routes>
            {routes.map((route) => (
              <Route
                key={route.path}
                path={route.path}
                element={route.element}
              />
            ))}
          </Routes>
        </div>
      </main>
    </div>
  );
}

function App() {
  const { isAuthenticated, loading } = useAuth();

  if (loading) return null;

  // Not logged in: only /login and /register render, full-screen,
  // no sidebar. Any other path a logged-out person hits gets
  // redirected to /login by ProtectedRoute inside `routes`.
  if (!isAuthenticated) {
    return (
      <Routes>
        {publicRoutes.map((route) => (
          <Route key={route.path} path={route.path} element={route.element} />
        ))}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  return <AppLayout />;
}

export default App;