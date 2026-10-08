import { useEffect, useState } from 'react';
import { Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import ChatPage from './pages/ChatPage';
import ProfilePage from './pages/ProfilePage';
import { request } from './utils/api';

const TOKEN_KEY = 'messenger_token';

function App() {
  const [token, setToken] = useState(localStorage.getItem(TOKEN_KEY));
  const navigate = useNavigate();

  useEffect(() => {
    if (!token && window.location.pathname !== '/register') {
      navigate('/login');
    }
  }, [token, navigate]);

  const handleAuth = (newToken) => {
    localStorage.setItem(TOKEN_KEY, newToken);
    setToken(newToken);
    navigate('/chat');
  };

  const handleLogout = () => {
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    navigate('/login');
  };

  return (
    <div className="app-shell">
      <header className="header">
        <div className="line header-top">
          <div className="site-brand">
            <span className="site-logo" role="img" aria-label="banana">🍌</span>
            <div>
              <p className="site-subtitle">Ananab</p>
              <h1>Ananab Mass</h1>
            </div>
          </div>
          <div className="header-actions">
            {token && (
              <>
                <button className="button secondary" onClick={() => navigate('/chat')}>Chats</button>
                <button className="button secondary" onClick={() => navigate('/profile')}>Profile</button>
                <button className="button secondary" onClick={handleLogout}>Logout</button>
              </>
            )}
          </div>
        </div>
      </header>
      <Routes>
        <Route path="/login" element={<LoginPage onLogin={handleAuth} />} />
        <Route path="/register" element={<RegisterPage onRegister={handleAuth} />} />
        <Route path="/profile" element={token ? <ProfilePage token={token} /> : <Navigate to="/login" />} />
        <Route path="/chat" element={token ? <ChatPage token={token} /> : <Navigate to="/login" />} />
        <Route path="/*" element={<Navigate to={token ? '/chat' : '/login'} />} />
      </Routes>
    </div>
  );
}

export default App;
