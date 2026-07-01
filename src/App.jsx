import { Routes, Route } from 'react-router-dom';
import { NavLink } from 'react-router-dom';
import routes from './routes';

import { useState, useEffect } from 'react';

function App() {
  const [theme, setTheme] = useState('dark');

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
            Dashboard
          </NavLink>

          <NavLink
            to="/portfolio"
            className="sidebar-link"
          >
            Portfolio
          </NavLink>

          <NavLink
            to="/transactions"
            className="sidebar-link"
          >
            Transactions
          </NavLink>

          <NavLink
            to="/sendreceive"
            className="sidebar-link"
          >
            Send & Receive
          </NavLink>

          <NavLink
            to="/explorer"
            className="sidebar-link"
          >
            Explorer
          </NavLink>

          <NavLink
            to="/staking"
            className="sidebar-link"
          >
            Staking
          </NavLink>

          <NavLink
            to="/harness"
            className="sidebar-link"
          >
            Harness
          </NavLink>

          <NavLink
            to="/markets"
            className="sidebar-link"
          >
            Markets
          </NavLink>

          <NavLink
            to="/futures"
            className="sidebar-link"
          >
            Futures Trading
          </NavLink>

          <NavLink
            to="/perpetuals"
            className="sidebar-link"
          >
            Perpetuals Trading
          </NavLink>

          <NavLink
            to="/options"
            className="sidebar-link"
          >
            Options Trading
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

          <button
            className="theme-toggle"
            onClick={toggleTheme}
          >
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>
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

export default App;