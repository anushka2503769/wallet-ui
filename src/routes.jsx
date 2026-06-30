import Dashboard from './pages/Dashboard/Dashboard';
import Portfolio from './pages/Portfolio/Portfolio';
import Transactions from './pages/Transactions/Transactions';
import SendReceive from './pages/SendReceive/SendReceive'
import Explorer from './pages/Explorer/Explorer';
import Staking from './pages/Staking/Staking';
import Harness from './pages/Harness/Harness';
import Settings from './pages/Settings/Settings';
import Markets from './pages/Markets/Markets';
import FuturesTrading from './pages/FuturesTrading/FuturesTrading';
import PerpetualsTrading from './pages/PerpetualsTrading/PerpetualsTrading';
import OptionsTrading from './pages/OptionsTrading/OptionsTrading';
import OpenPositions from './pages/OpenPositions/OpenPositions';
import TradeHistory from './pages/TradeHistory/TradeHistory';

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
    path: '/transactions',
    element: <Transactions />
  },
  {
    path: '/sendreceive',
    element: <SendReceive />
  },
  {
    path: '/explorer',
    element: <Explorer />
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
    path: '/settings',
    element: <Settings />
  },
  {
    path: '/markets',
    element: <Markets />
  },
  {
    path: '/futures',
    element: <FuturesTrading />
  },
  {
    path: '/perpetuals',
    element: <PerpetualsTrading />
  },
  {
    path: '/options',
    element: <OptionsTrading />
  },
  {
    path: '/open-positions',
    element: <OpenPositions />
  },
  {
    path: '/trade-history',
    element: <TradeHistory />
  }
];

export default routes;