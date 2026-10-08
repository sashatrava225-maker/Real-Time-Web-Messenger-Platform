const API_BASE = '/api';

function getAuthHeaders(token) {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function request(path, method = 'GET', body = null, token = null) {
  const headers = {
    ...getAuthHeaders(token),
  };

  const config = { method, headers };
  if (body) {
    if (body instanceof FormData) {
      config.body = body;
    } else {
      headers['Content-Type'] = 'application/json';
      config.body = JSON.stringify(body);
    }
  }

  const res = await fetch(`${API_BASE}${path}`, config);
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (!res.ok) {
    const errorMessage = data?.detail || data?.error || data?.message || `${res.status} ${res.statusText}`;
    throw new Error(errorMessage || 'API request failed');
  }
  return data;
}

export function getWsUrl(chatId, token) {
  const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
  const host = window.location.hostname;
  const port = 8001;
  return `${protocol}://${host}:${port}/ws/chat/${chatId}/?token=${token}`;
}
