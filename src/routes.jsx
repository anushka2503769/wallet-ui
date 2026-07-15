import Dashboard from './pages/Dashboard/Dashboard';
import Portfolio from './pages/Portfolio/Portfolio';
import SendReceive from './pages/SendReceive/SendReceive'
import Staking from './pages/Staking/Staking';
import Harness from './pages/Harness/Harness';
import Settings from './pages/Settings/Settings';
import Markets from './pages/Markets/Markets';
import OpenPositions from './pages/OpenPositions/OpenPositions';
import TradeHistory from './pages/TradeHistory/TradeHistory';
import Blockchain from './pages/Blockchain/Blockchain';

const routes = [
  {
    path: '/',
    element: <Dashboard />
  },
  {
    path: '/portfolio',
    element: <Portfolio />
  },
  {
    path: '/sendreceive',
    element: <SendReceive />
  },
  {
    path: '/staking',
    element: <Staking />
  },
  {
    path: '/harness',
    element: <Harness />
  },
  {
    path: '/markets',
    element: <Markets />
  },
  {
    path: '/open-positions',
    element: <OpenPositions />
  },
  {
    path: '/trade-history',
    element: <TradeHistory />
  },
  {
    path: '/blockchain',
    element: <Blockchain />
  },
  {
    path: '/settings',
    element: <Settings />
  },
];

export default routes;