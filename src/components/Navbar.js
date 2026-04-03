import React, { useState, useRef, useEffect } from 'react';
import { MdNotifications, MdSearch, MdMenu, MdDoneAll, MdClose } from 'react-icons/md';
import { useNotifications } from '../hooks/useNotifications';
import { useAuth } from '../hooks/useAuth';

const pageTitles = {
  dashboard:  { title: 'Dashboard',    sub: null },  // personalised per-user below
  leads:      { title: 'Leads',        sub: 'Manage and track all your leads' },
  kanban:     { title: 'Kanban Board', sub: 'Drag and drop leads across stages' },
  meetings:   { title: 'Meetings',     sub: 'Schedule and manage meetings' },
  todaytasks: { title: "Today's Tasks", sub: "Today's follow-ups and meetings" },
  analytics:  { title: 'Analytics',   sub: 'Performance insights & charts' },
  whatsapp:   { title: 'WhatsApp',     sub: 'Send messages and follow-ups' },
  messages:   { title: 'Messages',     sub: 'Internal messages & notes' },
  settings:   { title: 'Settings',     sub: 'Configure your CRM preferences' },
  admin:      { title: 'Admin Control', sub: 'Teacher & Meeting Coordination' },
};

function timeAgo(ts) {
  const diff = Math.floor((Date.now() - new Date(ts)) / 1000);
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export default function Navbar({ activePage, openMobile }) {
  const info = pageTitles[activePage] || pageTitles.dashboard;
  const { notifications, unreadCount, markRead, markAllRead } = useNotifications();
  const { userName, userRole } = useAuth();
  const [open, setOpen] = useState(false);
  const panelRef = useRef(null);

  // Generate initials from name (up to 2 chars)
  const initials = userName
    ? userName.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
    : '??';
  const roleLabel = userRole === 'admin' ? 'Admin' : 'Staff';

  const subtitle = info.sub ?? (userName ? `Welcome back, ${userName}!` : 'Welcome back!');

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <header className="navbar">
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <button className="sidebar-toggle" onClick={openMobile}>
          <MdMenu />
        </button>
        <div className="navbar-left">
          <h1>{info.title}</h1>
          <p>{subtitle}</p>
        </div>
      </div>

      <div className="navbar-right">
        <div className="navbar-icon-btn" title="Search">
          <MdSearch />
        </div>

        {/* Notification Bell */}
        <div style={{ position: 'relative' }} ref={panelRef}>
          <button
            className="navbar-icon-btn"
            title="Notifications"
            style={{ position: 'relative', background: open ? 'rgba(193,107,5,0.1)' : undefined }}
            onClick={() => setOpen((v) => !v)}
          >
            <MdNotifications />
            {unreadCount > 0 && (
              <span style={{
                position: 'absolute', top: 6, right: 6, width: 16, height: 16,
                background: '#ef4444', borderRadius: '50%', fontSize: 9, fontWeight: 800,
                color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                border: '2px solid #fff',
              }}>
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {open && (
            <div style={{
              position: 'absolute', top: 'calc(100% + 8px)', right: 0,
              width: 340, background: '#fff', borderRadius: 14,
              boxShadow: '0 8px 32px rgba(0,0,0,0.14)', zIndex: 9999,
              border: '1px solid rgba(193,107,5,0.12)', overflow: 'hidden',
              animation: 'fadeInUp 0.2s ease',
            }}>
              {/* Header */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderBottom: '1px solid #f9f0e8' }}>
                <div>
                  <h3 style={{ fontSize: 14, fontWeight: 700, margin: 0 }}>Notifications</h3>
                  {unreadCount > 0 && <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: 0 }}>{unreadCount} unread</p>}
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  {unreadCount > 0 && (
                    <button
                      className="btn btn-secondary btn-sm"
                      style={{ fontSize: 11, padding: '4px 10px' }}
                      onClick={markAllRead}
                    >
                      <MdDoneAll style={{ verticalAlign: 'middle' }} /> Mark all read
                    </button>
                  )}
                  <button
                    className="navbar-icon-btn"
                    style={{ width: 28, height: 28, fontSize: 14 }}
                    onClick={() => setOpen(false)}
                  >
                    <MdClose />
                  </button>
                </div>
              </div>

              {/* List */}
              <div style={{ maxHeight: 360, overflowY: 'auto' }}>
                {notifications.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--text-muted)' }}>
                    <MdNotifications style={{ fontSize: 32, opacity: 0.2 }} />
                    <p style={{ fontSize: 13, marginTop: 8 }}>No notifications yet</p>
                  </div>
                ) : (
                  notifications.map((n) => (
                    <div
                      key={n.id}
                      onClick={() => markRead(n.id)}
                      style={{
                        padding: '12px 16px', cursor: 'pointer',
                        background: n.is_read ? '#fff' : 'rgba(193,107,5,0.04)',
                        borderBottom: '1px solid #f9f0e8',
                        display: 'flex', gap: 10, alignItems: 'flex-start',
                        transition: 'background 0.15s',
                      }}
                    >
                      <div style={{
                        width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                        background: n.is_read ? 'rgba(0,0,0,0.04)' : 'rgba(193,107,5,0.12)',
                        color: n.is_read ? 'var(--text-muted)' : 'var(--primary)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15,
                      }}>
                        {n.type === 'meeting_reminder' ? '📅' : n.type === 'followup_reminder' ? '🔔' : n.type === 'daily_followup' ? '📋' : '💬'}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: n.is_read ? 500 : 700, color: '#1a1a1a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {n.title}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {n.message}
                        </div>
                        <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 3 }}>
                          {timeAgo(n.created_at)}
                        </div>
                      </div>
                      {!n.is_read && (
                        <div style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--primary)', flexShrink: 0, marginTop: 4 }} />
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        <div className="navbar-avatar">
          <div className="avatar-circle">{initials}</div>
          <div className="avatar-info">
            <span>{userName || '—'}</span>
            <small>{roleLabel}</small>
          </div>
        </div>
      </div>
    </header>
  );
}
