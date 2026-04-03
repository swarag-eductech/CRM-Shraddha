import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  MdDashboard, MdPeople, MdEvent, MdMessage, MdSettings,
  MdLogout, MdSchool, MdToday, MdApps, MdInsertChart, MdPool
} from 'react-icons/md';
import { FaWhatsapp } from 'react-icons/fa';
import { supabase } from '../supabaseClient';
import { useAuth } from '../hooks/useAuth';

const navItems = [
  { id: 'dashboard',  label: 'Dashboard',     icon: <MdDashboard />,  path: '/' },
  { id: 'pool',       label: 'Lead Pool',      icon: <MdPool />,       path: '/pool' },
  { id: 'leads',      label: 'Leads',         icon: <MdPeople />,     path: '/leads' },
  { id: 'kanban',     label: 'Kanban Board',  icon: <MdApps />,       path: '/kanban' },
  { id: 'meetings',   label: 'Meetings',      icon: <MdEvent />,      path: '/meetings' },
  { id: 'todaytasks', label: "Today's Tasks", icon: <MdToday />,      path: '/todaytasks' },
  { id: 'analytics', label: 'Analytics',     icon: <MdInsertChart />, path: '/analytics' },
  { id: 'whatsapp',   label: 'WhatsApp',      icon: <FaWhatsapp />,   path: '/whatsapp' },
  { id: 'messages',   label: 'Messages',      icon: <MdMessage />,    path: '/messages' },
];

export default function Sidebar({ mobileOpen, closeMobile }) {
  const { isAdmin } = useAuth();
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
            <NavLink
              key={item.id}
              to={item.path}
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
              onClick={closeMobile}
            >
              <span className="nav-icon">{item.icon}</span>
              {item.label}
            </NavLink>
          ))}

          <div className="nav-label" style={{ marginTop: 12 }}>System</div>
          <NavLink
            to="/settings"
            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
            onClick={closeMobile}
          >
            <span className="nav-icon"><MdSettings /></span>
            Settings
          </NavLink>
          
          {isAdmin && (
            <NavLink
              to="/admin"
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
              onClick={closeMobile}
            >
              <span className="nav-icon"><MdSchool /></span>
              Admin Control
            </NavLink>
          )}
        </nav>

        <div className="sidebar-footer">
          <button className="nav-item" onClick={async () => {
            await supabase.auth.signOut();
            window.location.href = '/login';
          }}>
            <span className="nav-icon"><MdLogout /></span>
            Logout
          </button>
        </div>
      </aside>
    </>
  );
}
