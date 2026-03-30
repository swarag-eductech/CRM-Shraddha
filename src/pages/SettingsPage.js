import React, { useState, useEffect } from 'react';
import {
  MdNotifications, MdSecurity, MdPalette, MdPerson,
  MdSave, MdPeople, MdLocationOn, MdSchool
} from 'react-icons/md';
import { FaWhatsapp } from 'react-icons/fa';
import { useLeads } from '../hooks/useLeads';
import { getSettings, updateSettings } from '../api';

function Toggle({ on, onToggle }) {
  return (
    <button className={`toggle ${on ? 'on' : ''}`} onClick={onToggle} type="button" />
  );
}

export default function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState({
    name: 'Shraddha Admin',
    email: 'info@shraddhainstitute.in',
    phone: '9900000000',
    institute: 'Shraddha Institute',
  });

  const [notifs, setNotifs] = useState({
    newLead: true,
    meetingReminder: true,
    whatsappReply: false,
    weeklyReport: true,
  });

  const [toggles, setToggles] = useState({
    darkMode: false,
    compactSidebar: false,
    autoReminder: true,
    twoFactor: false,
  });

  const [waSettings, setWaSettings] = useState({
    apiKey: '',
    defaultMessage: 'Hello {name}! Thank you for your interest in Shraddha Institute.',
    reminderTime: '24',
  });

  // Fetch settings from DB
  useEffect(() => {
    (async () => {
      try {
        const s = await getSettings();
        if (s) {
          setProfile({
            name: s.name || 'Shraddha Admin',
            email: s.admin_email || 'info@shraddhainstitute.in',
            phone: s.admin_phone || '9900000000',
            institute: s.institute_name || 'Shraddha Institute',
          });
          setNotifs({
            newLead: s.new_lead_alert,
            meetingReminder: s.meeting_reminders,
            whatsappReply: s.whatsapp_replies,
            weeklyReport: s.weekly_report,
          });
          setToggles({
            darkMode: s.dark_mode,
            compactSidebar: s.compact_sidebar,
            autoReminder: s.auto_reminders_enabled,
            twoFactor: s.two_factor_auth,
          });
          setWaSettings({
            apiKey: s.whatsapp_api_key || '',
            defaultMessage: s.default_message_template || 'Hello {name}! Thank you for your interest in Shraddha Institute.',
            reminderTime: String(s.auto_reminder_hours || '24'),
          });
        }
      } catch (err) {
        console.error("Failed to load settings:", err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const toggle = (key) => setToggles(t => ({ ...t, [key]: !t[key] }));
  const toggleNotif = (key) => setNotifs(n => ({ ...n, [key]: !n[key] }));

  const { leads, loading: leadsLoading } = useLeads();
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await updateSettings({
        name: profile.name,
        admin_email: profile.email,
        admin_phone: profile.phone,
        institute_name: profile.institute,
        new_lead_alert: notifs.newLead,
        meeting_reminders: notifs.meetingReminder,
        whatsapp_replies: notifs.whatsappReply,
        weekly_report: notifs.weeklyReport,
        dark_mode: toggles.darkMode,
        compact_sidebar: toggles.compactSidebar,
        auto_reminders_enabled: toggles.autoReminder,
        two_factor_auth: toggles.twoFactor,
        whatsapp_api_key: waSettings.apiKey,
        default_message_template: waSettings.defaultMessage,
        auto_reminder_hours: parseInt(waSettings.reminderTime),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      alert("Failed to save settings: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const totalLeads = leads.length;
  const uniqueCities = new Set(leads.map(l => l.city).filter(Boolean)).size;
  const uniquePrograms = new Set(leads.map(l => l.program).filter(Boolean)).size;
  const withEmail = leads.filter(l => l.email).length;

  if (loading) {
    return <div className="skeleton" style={{ height: '100vh', borderRadius: 18 }} />;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div />
        <button className="btn btn-primary" onClick={save} disabled={saving}>
          <MdSave />
          {saving ? 'Saving...' : saved ? 'Saved!' : 'Save Changes'}
        </button>
      </div>

      <div className="settings-grid">

        {/* Profile */}
        <div className="content-card setting-group">
          <h3><MdPerson style={{ color: 'var(--primary)' }} /> Profile Settings</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 8 }}>
              <div style={{
                width: 64, height: 64, borderRadius: '50%', background: 'var(--gradient)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#fff', fontSize: 24, fontWeight: 800, boxShadow: '0 4px 14px rgba(255,102,0,0.3)'
              }}>SA</div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15 }}>{profile.name}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Super Admin</div>
              </div>
            </div>
            {[
              { label: 'Full Name', key: 'name', type: 'text' },
              { label: 'Email Address', key: 'email', type: 'email' },
              { label: 'Phone', key: 'phone', type: 'tel' },
              { label: 'Institute Name', key: 'institute', type: 'text' },
            ].map(f => (
              <div key={f.key} className="form-group">
                <label>{f.label}</label>
                <input type={f.type} className="form-input" value={profile[f.key]}
                  onChange={e => setProfile(p => ({ ...p, [f.key]: e.target.value }))} />
              </div>
            ))}
          </div>
        </div>

        {/* Notifications */}
        <div className="content-card setting-group">
          <h3><MdNotifications style={{ color: 'var(--primary)' }} /> Notifications</h3>
          {[
            { key: 'newLead', label: 'New Lead Alert', desc: 'Get notified when a new lead is added' },
            { key: 'meetingReminder', label: 'Meeting Reminders', desc: 'Reminders 30 mins before meetings' },
            { key: 'whatsappReply', label: 'WhatsApp Replies', desc: 'Alert when a lead replies on WhatsApp' },
            { key: 'weeklyReport', label: 'Weekly Report', desc: 'Receive weekly CRM summary via email' },
          ].map(n => (
            <div key={n.key} className="toggle-row">
              <div className="toggle-info">
                <span>{n.label}</span>
                <small>{n.desc}</small>
              </div>
              <Toggle on={notifs[n.key]} onToggle={() => toggleNotif(n.key)} />
            </div>
          ))}
        </div>

        {/* Appearance */}
        <div className="content-card setting-group">
          <h3><MdPalette style={{ color: 'var(--primary)' }} /> Appearance & UX</h3>
          {[
            { key: 'darkMode', label: 'Dark Mode', desc: 'Switch to dark theme (coming soon)' },
            { key: 'compactSidebar', label: 'Compact Sidebar', desc: 'Show icons only in the sidebar' },
            { key: 'autoReminder', label: 'Auto Reminders', desc: 'Automatically send meeting reminders' },
          ].map(t => (
            <div key={t.key} className="toggle-row">
              <div className="toggle-info">
                <span>{t.label}</span>
                <small>{t.desc}</small>
              </div>
              <Toggle on={toggles[t.key]} onToggle={() => toggle(t.key)} />
            </div>
          ))}

          <div style={{ marginTop: 16 }}>
            <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-dark)', display: 'block', marginBottom: 8 }}>
              Primary Color Theme
            </label>
            <div style={{ display: 'flex', gap: 10 }}>
              {[
                { color: '#ff6600', label: 'Orange' },
                { color: '#7c3aed', label: 'Purple' },
                { color: '#2563eb', label: 'Blue' },
                { color: '#10b981', label: 'Green' },
              ].map(c => (
                <div
                  key={c.color}
                  title={c.label}
                  style={{
                    width: 28, height: 28, borderRadius: '50%',
                    background: c.color, cursor: 'pointer',
                    border: c.color === '#ff6600' ? '3px solid rgba(0,0,0,0.2)' : '2px solid transparent',
                    transition: 'all 0.2s', boxSizing: 'border-box',
                  }}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Security */}
        <div className="content-card setting-group">
          <h3><MdSecurity style={{ color: 'var(--primary)' }} /> Security</h3>
          {[
            { key: 'twoFactor', label: 'Two-Factor Auth', desc: 'Secure login with OTP verification' },
          ].map(t => (
            <div key={t.key} className="toggle-row">
              <div className="toggle-info">
                <span>{t.label}</span>
                <small>{t.desc}</small>
              </div>
              <Toggle on={toggles[t.key]} onToggle={() => toggle(t.key)} />
            </div>
          ))}
          <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div className="form-group">
              <label>Current Password</label>
              <input type="password" className="form-input" placeholder="••••••••" />
            </div>
            <div className="form-group">
              <label>New Password</label>
              <input type="password" className="form-input" placeholder="••••••••" />
            </div>
            <button className="btn btn-primary btn-sm" style={{ width: 'fit-content' }}>
              Update Password
            </button>
          </div>
        </div>

        {/* WhatsApp Settings */}
        <div className="content-card setting-group" style={{ gridColumn: 'span 2' }}>
          <h3><FaWhatsapp style={{ color: '#25D366' }} /> WhatsApp Configuration</h3>
          <div className="form-grid">
            <div className="form-group">
              <label>WhatsApp Business API Key</label>
              <input className="form-input" type="password" placeholder="Enter API key..."
                value={waSettings.apiKey}
                onChange={e => setWaSettings(s => ({ ...s, apiKey: e.target.value }))} />
            </div>
            <div className="form-group">
              <label>Auto-Reminder (hours before meeting)</label>
              <select className="form-input filter-select"
                value={waSettings.reminderTime}
                onChange={e => setWaSettings(s => ({ ...s, reminderTime: e.target.value }))}>
                <option value="1">1 hour before</option>
                <option value="2">2 hours before</option>
                <option value="12">12 hours before</option>
                <option value="24">24 hours before</option>
              </select>
            </div>
            <div className="form-group" style={{ gridColumn: 'span 2' }}>
              <label>Default Message Template</label>
              <textarea className="form-input" rows={3}
                value={waSettings.defaultMessage}
                onChange={e => setWaSettings(s => ({ ...s, defaultMessage: e.target.value }))}
                placeholder="Hello {name}! ..." />
              <small style={{ color: 'var(--text-muted)', fontSize: 11 }}>Use {'{name}'} as a placeholder for the student's name.</small>
            </div>
          </div>
        </div>

      </div>

      {/* Live Database Stats */}
      <div className="content-card">
        <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
          <MdPeople style={{ color: 'var(--primary)' }} /> Live Database Stats
        </h3>
        {leadsLoading ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
            {[1,2,3,4].map(i => <div key={i} className="skeleton" style={{ height: 72, borderRadius: 12 }} />)}
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
            {[
              { label: 'Total Leads', value: totalLeads, icon: <MdPeople />, color: 'linear-gradient(135deg,#ff6600,#f7971e)' },
              { label: 'Unique Cities', value: uniqueCities, icon: <MdLocationOn />, color: 'linear-gradient(135deg,#7c3aed,#a855f7)' },
              { label: 'Programs', value: uniquePrograms, icon: <MdSchool />, color: 'linear-gradient(135deg,#2563eb,#3b82f6)' },
              { label: 'With Email', value: withEmail, icon: <MdPeople />, color: 'linear-gradient(135deg,#10b981,#34d399)' },
            ].map(s => (
              <div key={s.label} style={{ background: 'var(--bg-light)', border: '1px solid var(--border)', borderRadius: 12, padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 38, height: 38, borderRadius: 10, background: s.color, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 18, flexShrink: 0 }}>{s.icon}</div>
                <div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-dark)', lineHeight: 1 }}>{s.value}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{s.label}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* About */}
      <div className="content-card" style={{
        background: 'var(--gradient)', color: '#fff',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12
      }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 16 }}>Shraddha Institute CRM</div>
          <div style={{ fontSize: 12, opacity: 0.8, marginTop: 4 }}>Version 1.0.0 · Built with React · © 2026 Shraddha Institute</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <span style={{ background: 'rgba(255,255,255,0.2)', padding: '4px 12px', borderRadius: 20, fontSize: 12 }}>React 19</span>
          <span style={{ background: 'rgba(255,255,255,0.2)', padding: '4px 12px', borderRadius: 20, fontSize: 12 }}>CRM v1</span>
        </div>
      </div>
    </div>
  );
}
