import { useEffect, useMemo, useRef, useState } from 'react';
import { request, getWsUrl } from '../utils/api';

export default function ChatPage({ token }) {
  const [chats, setChats] = useState([]);
  const [activeChat, setActiveChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [search, setSearch] = useState('');
  const [messageText, setMessageText] = useState('');
  const [notifications, setNotifications] = useState([]);
  const [typingUsers, setTypingUsers] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [newChatName, setNewChatName] = useState('');
  const [newChatIsGroup, setNewChatIsGroup] = useState(false);
  const [userQuery, setUserQuery] = useState('');
  const [userResults, setUserResults] = useState([]);
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [error, setError] = useState('');
  const [attachmentFile, setAttachmentFile] = useState(null);
  const [attachmentPreview, setAttachmentPreview] = useState('');
  const wsRef = useRef(null);

  const normalizeMediaUrl = (url) => {
    if (!url) return '';
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    return url.startsWith('/') ? url : `/${url}`;
  };

  useEffect(() => {
    loadProfile();
    loadChats();
    loadNotifications();
  }, [token]);

  useEffect(() => {
    if (!activeChat) return;
    loadMessages(activeChat.id);
    connectWebSocket(activeChat.id);
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [activeChat, token]);

  const chatWsUrl = useMemo(
    () => (activeChat ? getWsUrl(activeChat.id, token) : null),
    [activeChat, token]
  );

  async function loadProfile() {
    try {
      const profile = await request('/auth/profile/', 'GET', null, token);
      setCurrentUser(profile);
    } catch (err) {
      console.error(err);
    }
  }

  async function loadChats() {
    try {
      const data = await request('/chat/chats/', 'GET', null, token);
      setChats(data);
    } catch (err) {
      console.error(err);
    }
  }

  async function loadNotifications() {
    try {
      const data = await request('/chat/notifications/', 'GET', null, token);
      setNotifications(data);
    } catch (err) {
      console.error(err);
    }
  }

  async function loadMessages(chatId) {
    try {
      const data = await request(`/chat/chats/${chatId}/messages/`, 'GET', null, token);
      setMessages(data);
    } catch (err) {
      console.error(err);
    }
  }

  async function searchUsers() {
    if (!userQuery.trim()) {
      setUserResults([]);
      return;
    }

    try {
      const result = await request(`/auth/users/?q=${encodeURIComponent(userQuery)}`, 'GET', null, token);
      setUserResults(result.filter((user) => user.id !== currentUser?.id));
    } catch (err) {
      console.error(err);
    }
  }

  function connectWebSocket(chatId) {
    if (!chatWsUrl) return;

    const socket = new WebSocket(chatWsUrl);
    wsRef.current = socket;

    socket.addEventListener('open', () => {
      console.log('WS connected', chatId);
    });

    socket.addEventListener('message', (event) => {
      const payload = JSON.parse(event.data);
      handleSocketEvent(payload);
    });

    socket.addEventListener('close', () => {
      console.log('WS disconnected');
    });

    socket.addEventListener('error', (error) => {
      console.error('WS error', error);
    });
  }

  function handleSocketEvent(payload) {
    if (payload.type === 'chat.message') {
      setMessages((prev) => [...prev, payload.message]);
    }

    if (payload.type === 'chat.typing') {
      setTypingUsers((prev) => {
        if (payload.is_typing) {
          return Array.from(new Set([...prev, payload.user]));
        }
        return prev.filter((user) => user !== payload.user);
      });
    }

    if (payload.type === 'chat.read') {
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === payload.message_id
            ? { ...msg, status: { ...msg.status, read: payload.read } }
            : msg
        )
      );
    }

    if (payload.type === 'chat.reaction') {
      setMessages((prev) =>
        prev.map((msg) => {
          if (msg.id !== payload.message_id) return msg;
          const reactions = payload.removed
            ? msg.reactions.filter(
                (reaction) => !(reaction.user === payload.user && reaction.emoji === payload.reaction?.emoji)
              )
            : [...msg.reactions, payload.reaction];
          return { ...msg, reactions };
        })
      );
    }
  }

  const handleChatSelect = (chat) => {
    setActiveChat(chat);
    setTypingUsers([]);
  };

  const handleSendMessage = async () => {
    if (!messageText.trim() && !attachmentFile) return;
    if (!activeChat) return;

    try {
      let body;
      let method = 'POST';

      if (attachmentFile) {
        body = new FormData();
        if (messageText.trim()) {
          body.append('content', messageText);
        }
        body.append('attachment', attachmentFile);
      } else {
        body = { content: messageText };
      }

      const data = await request(`/chat/chats/${activeChat.id}/messages/`, method, body, token);
      setMessages((prev) => [...prev, data]);
      setMessageText('');
      setAttachmentFile(null);
      setAttachmentPreview('');
      setError('');
    } catch (err) {
      console.error(err);
      setError(err.message);
    }
  };

  const handleStickerClick = async (sticker) => {
    if (!activeChat) return;
    try {
      const data = await request(`/chat/chats/${activeChat.id}/messages/`, 'POST', { content: sticker }, token);
      setMessages((prev) => [...prev, data]);
      setError('');
    } catch (err) {
      console.error(err);
      setError(err.message);
    }
  };

  const handleTyping = () => {
    if (!wsRef.current) return;
    wsRef.current.send(JSON.stringify({ type: 'typing.start' }));
    setTimeout(() => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'typing.stop' }));
      }
    }, 1000);
  };

  const toggleUserSelection = (userId) => {
    setSelectedUsers((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const handleAttachmentChange = (event) => {
    const file = event.target.files?.[0] || null;
    setAttachmentFile(file);
    if (file) {
      setAttachmentPreview(URL.createObjectURL(file));
    } else {
      setAttachmentPreview('');
    }
  };

  const handleCreateChat = async () => {
    if (!selectedUsers.length) {
      setError('Add at least one participant.');
      return;
    }
    setError('');

    try {
      const body = {
        name: newChatName,
        is_group: newChatIsGroup,
        participant_ids: selectedUsers,
      };
      const chat = await request('/chat/chats/', 'POST', body, token);
      setChats((prev) => [chat, ...prev]);
      setActiveChat(chat);
      setNewChatName('');
      setNewChatIsGroup(false);
      setSelectedUsers([]);
      setUserQuery('');
      setUserResults([]);
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="container">
      <div className="sidebar card">
        <div className="chat-toolbar">
          <div>
            <h2>Chats</h2>
            <p className="subtitle">Fast conversations with your team</p>
          </div>
          <button className="button secondary" onClick={loadChats}>Refresh</button>
        </div>
        <div className="card">
          <strong>Create chat</strong>
          <label>
            Chat name
            <input
              className="input"
              value={newChatName}
              onChange={(e) => setNewChatName(e.target.value)}
              placeholder="Optional group chat name"
            />
          </label>
          <label>
            Group chat
            <select
              className="select"
              value={newChatIsGroup ? 'group' : 'direct'}
              onChange={(e) => setNewChatIsGroup(e.target.value === 'group')}
            >
              <option value="direct">Direct chat</option>
              <option value="group">Group chat</option>
            </select>
          </label>
          <label>
            Find users
            <input
              className="input"
              value={userQuery}
              onChange={(e) => {
                setUserQuery(e.target.value);
                setError('');
              }}
              onBlur={searchUsers}
              placeholder="Search usernames"
            />
          </label>
          {userResults.length > 0 && (
            <div className="message-list user-search-list" style={{ maxHeight: 160, overflowY: 'auto' }}>
              {userResults.map((user) => (
                <div key={user.id} className="user-card" onClick={() => toggleUserSelection(user.id)}>
                  <div className="user-card-left">
                    <div className="avatar avatar-small">
                      {user.avatar ? <img src={user.avatar} alt={user.username} /> : <span>{user.username?.[0]?.toUpperCase()}</span>}
                    </div>
                    <span>{user.username}</span>
                  </div>
                  <span>{selectedUsers.includes(user.id) ? 'Selected' : 'Add'}</span>
                </div>
              ))}
            </div>
          )}
          <button className="button" onClick={handleCreateChat}>Create chat</button>
          {error && <p style={{ color: 'red' }}>{error}</p>}
        </div>
        <div className="list-item">
          <input
            className="input"
            placeholder="Search chats"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div>
          {chats
            .filter((chat) => (chat.name || '').toLowerCase().includes(search.toLowerCase()))
            .map((chat) => (
              <div
                key={chat.id}
                className={`list-item ${activeChat?.id === chat.id ? 'active' : ''}`}
                onClick={() => handleChatSelect(chat)}
              >
                <div className="chat-card-top">
                  <div className="chat-avatar-row">
                    {chat.participants?.slice(0, 2).map((user) => (
                      <div key={user.id} className="avatar avatar-small">
                        {user.avatar ? <img src={user.avatar} alt={user.username} /> : <span>{user.username?.[0]?.toUpperCase()}</span>}
                      </div>
                    ))}
                  </div>
                  <div>
                    <strong>{chat.name || `Chat ${chat.id}`}</strong>
                    <div className="subtitle">{(chat.participants?.length ?? 0)} members</div>
                  </div>
                </div>
                {chat.last_message && <p className="chat-preview">{chat.last_message.sender.username}: {chat.last_message.content}</p>}
              </div>
            ))}
        </div>
        <div className="card">
          <h3>Notifications</h3>
          {notifications.length ? (
            notifications.map((note) => (
              <div key={note.id} className="list-item">
                <div>{note.title}</div>
                <div>{note.body}</div>
              </div>
            ))
          ) : (
            <p>No notifications</p>
          )}
        </div>
      </div>

      <div className="panel">
        {activeChat ? (
          <>
            <div className="card">
              <h2>{activeChat.name || `Chat ${activeChat.id}`}</h2>
              <div className="chat-participants">
                {activeChat.participants?.map((user) => (
                  <div key={user.id} className="avatar avatar-small">
                    {user.avatar ? <img src={user.avatar} alt={user.username} /> : <span>{user.username?.[0]?.toUpperCase()}</span>}
                  </div>
                ))}
                <span className="subtitle">{activeChat.participants?.length ?? 0} members</span>
              </div>
              <div>{typingUsers.length ? `${typingUsers.join(', ')} typing...` : 'No typing activity'}</div>
            </div>
            <div className="card message-list">
              {messages.map((message) => {
                const outgoing = currentUser?.id === message.sender.id;
                return (
                  <div key={message.id} className={`message ${outgoing ? 'outgoing' : 'incoming'}`}>
                    <div className="message-header">
                      <div className="avatar avatar-small">
                        {message.sender.avatar ? <img src={normalizeMediaUrl(message.sender.avatar)} alt={message.sender.username} /> : <span>{message.sender.username?.[0]?.toUpperCase()}</span>}
                      </div>
                      <div>
                        <strong>{message.sender.username}</strong>
                        <div className="message-meta">
                          {new Date(message.created_at).toLocaleTimeString()}
                        </div>
                      </div>
                    </div>
                    <div className="message-body">
                      {message.content}
                      {message.attachment && (
                        <div className="message-attachment">
                          <img src={normalizeMediaUrl(message.attachment)} alt="attachment" />
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="sticker-bar">
              <button type="button" className="sticker-button" onClick={() => handleStickerClick('🍌')}>🍌</button>
              <button type="button" className="sticker-button" onClick={() => handleStickerClick('😎')}>😎</button>
              <button type="button" className="sticker-button" onClick={() => handleStickerClick('🔥')}>🔥</button>
              <button type="button" className="sticker-button" onClick={() => handleStickerClick('💜')}>💜</button>
            </div>
            <div className="panel-footer">
              <label className="attachment-label">
                <input type="file" accept="image/*" onChange={handleAttachmentChange} />
                Attach image
              </label>
              <input
                className="input"
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                onInput={handleTyping}
                placeholder="Type a message..."
              />
              <button className="button" onClick={handleSendMessage}>Send</button>
            </div>
            {attachmentPreview && (
              <div className="attachment-preview">
                <img src={attachmentPreview} alt="Attachment preview" />
              </div>
            )}
            {error && <p className="error-text">{error}</p>}
          </>
        ) : (
          <div className="card">
            <h2>Select a chat</h2>
            <p>Choose a conversation to start messaging.</p>
          </div>
        )}
      </div>
    </div>
  );
}
