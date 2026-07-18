import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { LogIn } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [formData, setFormData] = useState({ email: '', password: '' });
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      login(formData);
      navigate('/');
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-screen">
      <div className="card auth-card">
        <div className="flex align-center gap-2 mb-6">
          <LogIn size={20} className="text-accent" />
          <h3>Log In</h3>
        </div>

        {error && (
          <p className="text-sm" style={{ color: 'var(--danger)', marginBottom: 'var(--sp-4)' }}>
            {error}
          </p>
        )}

        <form onSubmit={handleSubmit} className="flex col gap-4">
          <div className="form-group">
            <label className="form-label">Email</label>
            <input
              type="email"
              name="email"
              className="form-input"
              placeholder="you@example.com"
              value={formData.email}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Password</label>
            <input
              type="password"
              name="password"
              className="form-input"
              placeholder="••••••••"
              value={formData.password}
              onChange={handleChange}
              required
            />
          </div>

          <button className="cute-button btn-full" type="submit" disabled={submitting}>
            {submitting ? 'Logging in...' : 'Log In'}
          </button>
        </form>

        <p className="text-sm text-muted" style={{ marginTop: 'var(--sp-4)', textAlign: 'center' }}>
          Don't have an account? <Link to="/register" className="text-accent">Register</Link>
        </p>
      </div>
    </div>
  );
}

export default Login;