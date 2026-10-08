import { useEffect, useState } from 'react';
import { request } from '../utils/api';

export default function ProfilePage({ token }) {
  const [profile, setProfile] = useState(null);
  const [form, setForm] = useState({ first_name: '', last_name: '', status: '', bio: '' });
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    async function loadProfile() {
      try {
        const data = await request('/auth/profile/', 'GET', null, token);
        setProfile(data);
        setForm({
          first_name: data.first_name || '',
          last_name: data.last_name || '',
          status: data.status || '',
          bio: data.bio || '',
        });
        setAvatarPreview(data.avatar || '');
      } catch (error) {
        setMessage(`Помилка завантаження профілю: ${error.message}`);
      }
    }
    loadProfile();
  }, [token]);

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
    setMessage('');
    try {
      const body = new FormData();
      body.append('first_name', form.first_name);
      body.append('last_name', form.last_name);
      body.append('status', form.status);
      body.append('bio', form.bio);
      if (avatarFile) {
        body.append('avatar', avatarFile);
      }

      const data = await request('/auth/profile/', 'PATCH', body, token);
      setProfile(data);
      setAvatarPreview(data.avatar || avatarPreview);
      setMessage('Профіль успішно збережено.');
    } catch (error) {
      setMessage(`Помилка: ${error.message || 'неможливо зберегти профіль'}`);
    }
  };

  return (
    <div className="container profile-container">
      <div className="panel card profile-card">
        <h2>Профіль</h2>
        {profile ? (
          <form onSubmit={handleSubmit} className="profile-form">
            <div className="profile-banner">
              <div className="avatar avatar-large">
                {avatarPreview ? (
                  <img src={avatarPreview} alt="Avatar preview" />
                ) : (
                  <span>{profile.username?.[0]?.toUpperCase() || 'U'}</span>
                )}
              </div>
              <div>
                <p className="profile-username">{profile.username}</p>
                <p className="profile-email">{profile.email}</p>
              </div>
            </div>
            <label>
              Завантажити аватарку
              <input className="input" type="file" accept="image/*" onChange={handleFileChange} />
            </label>
            <label>
              Ім'я
              <input className="input" name="first_name" value={form.first_name} onChange={handleChange} />
            </label>
            <label>
              Прізвище
              <input className="input" name="last_name" value={form.last_name} onChange={handleChange} />
            </label>
            <label>
              Статус
              <input className="input" name="status" value={form.status} onChange={handleChange} />
            </label>
            <label>
              Біо
              <textarea className="textarea" name="bio" value={form.bio} onChange={handleChange} rows="4" />
            </label>
            <button className="button" type="submit">Зберегти профіль</button>
            {message && <p className="info-text">{message}</p>}
          </form>
        ) : (
          <p>Завантаження профілю...</p>
        )}
      </div>
    </div>
  );
}
