import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { request } from '../utils/api';

export default function RegisterPage({ onRegister }) {
  const [form, setForm] = useState({ username: '', email: '', password: '' });
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState('');
  const [error, setError] = useState(null);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (event) => {
    const file = event.target.files?.[0] || null;
    setAvatarFile(file);
    if (file) {
      setAvatarPreview(URL.createObjectURL(file));
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError(null);
    try {
      const data = new FormData();
      data.append('username', form.username);
      data.append('email', form.email);
      data.append('password', form.password);
      if (avatarFile) {
        data.append('avatar', avatarFile);
      }

      await request('/auth/register/', 'POST', data);
      const login = await request('/auth/token/', 'POST', {
        username: form.username,
        password: form.password,
      });
      onRegister(login.access);
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="container">
      <div className="panel card">
        <h2>Створити акаунт</h2>
        <form onSubmit={handleSubmit} className="profile-form">
          <label>
            Аватарка
            <input className="input" type="file" accept="image/*" onChange={handleFileChange} />
          </label>
          {avatarPreview && (
            <div className="avatar avatar-large" style={{ marginBottom: '1rem' }}>
              <img src={avatarPreview} alt="Avatar preview" />
            </div>
          )}
          <label>
            Ім'я користувача
            <input className="input" name="username" value={form.username} onChange={handleChange} />
          </label>
          <label>
            Email
            <input className="input" name="email" value={form.email} onChange={handleChange} />
          </label>
          <label>
            Пароль
            <input className="input" type="password" name="password" value={form.password} onChange={handleChange} />
          </label>
          <button className="button" type="submit">Створити акаунт</button>
          {error && <p style={{ color: '#f87171' }}>{error}</p>}
        </form>
        <p>
          Вже є акаунт? <Link to="/login">Увійти</Link>
        </p>
      </div>
    </div>
  );
}
