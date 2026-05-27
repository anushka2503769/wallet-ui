import { Moon, Sun } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';

function Header() {
  const { theme, toggleTheme } = useTheme();

  return (
    <header className="header">
      <div>
        <h1>Blockchain Wallet Dashboard</h1>
      </div>

      <button className="theme-toggle" onClick={toggleTheme}>
        {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
      </button>
    </header>
  );
}

export default Header;