import Portfolio from './pages/Portfolio/Portfolio';
import SendReceive from './pages/SendReceive/SendReceive'
import Staking from './pages/Staking/Staking';
import Harness from './pages/Harness/Harness';
import Settings from './pages/Settings/Settings';
import Markets from './pages/Markets/Markets';
import FuturesTrading from './pages/FuturesTrading/FuturesTrading';
import OptionsTrading from './pages/OptionsTrading/OptionsTrading';
import PerpetualsTrading from './pages/PerpetualsTrading/PerpetualsTrading';
import OpenPositions from './pages/OpenPositions/OpenPositions';
import TradeHistory from './pages/TradeHistory/TradeHistory';
import Blockchain from './pages/Blockchain/Blockchain';
import Login from './pages/Login/Login';
import Register from './pages/Register/Register';

import ProtectedRoute from './components/common/ProtectedRoute';

// Public routes — no login required
export const publicRoutes = [
  {
    path: '/login',
    element: <Login />
  },
  {
    path: '/register',
    element: <Register />
  },
];

// Everything else requires login. Harness additionally requires
// the admin role — everyone else gets redirected to "/" if they
// try to open it directly.
const routes = [
  {
    // NOTE: Dashboard.jsx doesn't exist in this project, so '/' points
    // at Portfolio directly. There's no separate /portfolio route
    // anymore — that was rendering the exact same page as '/' and
    // showing up twice in the sidebar. Swap this back to <Dashboard />
    // (and re-add a distinct /portfolio route) once Dashboard exists.
    path: '/',
    element: <ProtectedRoute><Portfolio /></ProtectedRoute>
  },
  {
    path: '/sendreceive',
    element: <ProtectedRoute><SendReceive /></ProtectedRoute>
  },
  {
    path: '/staking',
    element: <ProtectedRoute><Staking /></ProtectedRoute>
  },
  {
    path: '/harness',
    element: <ProtectedRoute adminOnly><Harness /></ProtectedRoute>
  },
  {
    path: '/markets',
    element: <ProtectedRoute><Markets /></ProtectedRoute>
  },
  {
    path: '/futures',
    element: <ProtectedRoute><FuturesTrading /></ProtectedRoute>
  },
  {
    path: '/options',
    element: <ProtectedRoute><OptionsTrading /></ProtectedRoute>
  },
  {
    path: '/perpetuals',
    element: <ProtectedRoute><PerpetualsTrading /></ProtectedRoute>
  },
  {
    path: '/open-positions',
    element: <ProtectedRoute><OpenPositions /></ProtectedRoute>
  },
  {
    path: '/trade-history',
    element: <ProtectedRoute><TradeHistory /></ProtectedRoute>
  },
  {
    path: '/blockchain',
    element: <ProtectedRoute><Blockchain /></ProtectedRoute>
  },
  {
    path: '/settings',
    element: <ProtectedRoute><Settings /></ProtectedRoute>
  },
];

export default routes;