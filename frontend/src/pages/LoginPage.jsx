import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { request } from '../utils/api';

export default function LoginPage({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError(null);
    try {
      const data = await request('/auth/token/', 'POST', { username, password });
      onLogin(data.access);
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="container">
      <div className="panel card">
        <h2>Login</h2>
        <form onSubmit={handleSubmit}>
          <label>
            Username
            <input className="input" value={username} onChange={(e) => setUsername(e.target.value)} />
          </label>
          <label>
            Password
            <input
              className="input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          <button className="button" type="submit">Sign in</button>
          {error && <p style={{ color: 'red' }}>{error}</p>}
        </form>
        <p>
          No account? <Link to="/register">Register</Link>
        </p>
      </div>
    </div>
  );
}
