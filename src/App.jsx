import { Routes, Route } from 'react-router-dom';
import routes from './routes';
import Sidebar from './components/common/Sidebar';
import Header from './components/common/Header';

function App() {
  return (
    <div className="app-layout">
      <Sidebar />

      <div className="main-content">
        <Header />

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
      </div>
    </div>
  );
}

export default App;