import React from 'react';
import {
  MdDashboard, MdPeople, MdEvent, MdMessage, MdSettings,
  MdLogout, MdSchool, MdToday, MdApps, MdInsertChart
} from 'react-icons/md';
import { FaWhatsapp } from 'react-icons/fa';

const navItems = [
  { id: 'dashboard',  label: 'Dashboard',     icon: <MdDashboard />,  badge: null },
  { id: 'leads',      label: 'Leads',         icon: <MdPeople />,     badge: null },
  { id: 'kanban',     label: 'Kanban Board',  icon: <MdApps />,       badge: null },
  { id: 'meetings',   label: 'Meetings',      icon: <MdEvent />,      badge: null },
  { id: 'todaytasks', label: "Today's Tasks", icon: <MdToday />,      badge: null },
  { id: 'analytics', label: 'Analytics',     icon: <MdInsertChart />, badge: null },
  { id: 'whatsapp',   label: 'WhatsApp',      icon: <FaWhatsapp />,   badge: null },
  { id: 'messages',   label: 'Messages',      icon: <MdMessage />,    badge: null },
];

export default function Sidebar({ activePage, setActivePage, mobileOpen, closeMobile }) {
  const handleNav = (id) => {
    setActivePage(id);
    if (closeMobile) closeMobile();
  };

  return (
    <>
      <div className={`sidebar-overlay ${mobileOpen ? 'active' : ''}`} onClick={closeMobile} />
      <aside className={`sidebar ${mobileOpen ? 'mobile-open' : ''}`}>
        <div className="sidebar-logo">
          <div className="sidebar-logo-inner">
            <div className="logo-icon">
              <MdSchool style={{ color: '#fff', fontSize: 22 }} />
            </div>
            <div className="logo-text">
              <h2>Shraddha</h2>
              <span>Institute CRM</span>
            </div>
          </div>
        </div>

        <nav className="sidebar-nav">
          <div className="nav-label">Main Menu</div>
          {navItems.map((item) => (
            <button
              key={item.id}
              className={`nav-item ${activePage === item.id ? 'active' : ''}`}
              onClick={() => handleNav(item.id)}
            >
              <span className="nav-icon">{item.icon}</span>
              {item.label}
              {item.badge && <span className="nav-badge">{item.badge}</span>}
            </button>
          ))}

          <div className="nav-label" style={{ marginTop: 12 }}>System</div>
          <button
            className={`nav-item ${activePage === 'settings' ? 'active' : ''}`}
            onClick={() => handleNav('settings')}
          >
            <span className="nav-icon"><MdSettings /></span>
            Settings
          </button>
        </nav>

        <div className="sidebar-footer">
          <button className="nav-item" onClick={() => alert('Logged out!')}>
            <span className="nav-icon"><MdLogout /></span>
            Logout
          </button>
        </div>
      </aside>
    </>
  );
}
