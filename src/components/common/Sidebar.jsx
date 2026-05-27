import { NavLink } from 'react-router-dom';

const links = [
  {
    path: '/',
    label: 'Dashboard',
    icon: LayoutDashboard
  },
  {
    path: '/portfolio',
    label: 'Portfolio',
    icon: Wallet
  },
  {
    path: '/transactions',
    label: 'Transactions',
    icon: ArrowLeftRight
  },
  {
    path: '/explorer',
    label: 'Explorer',
    icon: Blocks
  },
  {
    path: '/staking',
    label: 'Staking',
    icon: ShieldCheck
  },
  {
    path: '/harness',
    label: 'Harness',
    icon: FlaskConical
  },
  {
    path: '/settings',
    label: 'Settings',
    icon: Settings
  }
];

function Sidebar() {
  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <h2>TradeFlow Wallet</h2>
      </div>

      <nav>
        {links.map((link) => {
          const Icon = link.icon;

          return (
            <NavLink
              key={link.path}
              to={link.path}
              className="sidebar-link"
            >
              <Icon size={18} />
              <span>{link.label}</span>
            </NavLink>
          );
        })}
      </nav>
    </aside>
  );
}

export default Sidebar;