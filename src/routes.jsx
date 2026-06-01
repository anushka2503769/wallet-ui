import Dashboard from './pages/Dashboard/Dashboard';
import Portfolio from './pages/Portfolio/Portfolio';
import Transactions from './pages/Transactions/Transactions';
import SendReceive from './pages/SendReceive/SendReceive'
import Explorer from './pages/Explorer/Explorer';
import Staking from './pages/Staking/Staking';
import Harness from './pages/Harness/Harness';
import Settings from './pages/Settings/Settings';

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
  }
];

export default routes;