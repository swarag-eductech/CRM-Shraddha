import React, { useState, useEffect } from 'react';
import { FaWhatsapp } from 'react-icons/fa';
import { useLeads } from '../hooks/useLeads';
import { useSearchParams } from 'react-router-dom';

const templates = [
  {
    label: 'Welcome / Enquiry',
    icon: '👋',
    message: `Hello {name}! 👋\n\nThank you for your interest in *Shraddha Institute*.\n\nWe specialize in professional Teacher Training for:\n🧮 *Abacus Mental Math*\n✨ *Vedic Mathematics*\n\nWould you like to schedule a FREE demo session to see our training methodology?\n\nReply *YES* to proceed.\n\n– Shraddha Institute Team`,
  },
  {
    label: 'Meeting Reminder',
    icon: '📅',
    message: `Hello {name}! 🙏\n\nThis is a reminder for your upcoming *Teacher Training* session with *Shraddha Institute*.\n\n🕐 Time: [Date & Time]\n🔗 Link: [Meet Link]\n\nPlease join 2 minutes early with your Abacus tool/notebook.\n\nSee you soon! 😊\n– Shraddha Institute`,
  },
  {
    label: 'Follow-Up',
    icon: '🔔',
    message: `Hi {name}! 😊\n\nWe noticed you enquired about our *Abacus & Vedic Math Teacher Training*.\n\nWhy start your journey now?\n✅ High Demand for Teachers\n✅ Work from Home / Offline\n✅ Certification included\n✅ Business Support Provided\n\nStart your own classes after training! 🎓🎯\n\nCall/WhatsApp: 99XXXXXXXX\n– Shraddha Institute`,
  },
  {
    label: 'Converted / Welcome',
    icon: '🎉',
    message: `Congratulations {name}! 🎉\n\nWelcome to the *Shraddha Institute Teacher Training Program*! 🧮📖\n\nYour enrollment is confirmed. Here's what's next:\n\n📌 Orientation: [Date]\n📌 Batch Start: [Date]\n📌 Training Kits: Sent to your address\n\nFor any support: 99XXXXXXXX\n\nLet's empower students together! 🌟\n– Shraddha Institute`,
  },
];

export default function WhatsAppPage() {
  const [searchParams] = useSearchParams();
  const { leads, loading: leadsLoading } = useLeads();
  const quickContacts = leads.filter(l => l.name && l.phone).slice(0, 12);
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [activeTemplate, setActiveTemplate] = useState(0);
  const [message, setMessage] = useState(templates[0].message.replace('{name}', 'Student'));

  // Effect to handle URL parameters
  useEffect(() => {
    const pName = searchParams.get('name');
    const pPhone = searchParams.get('phone');
    const pTpl = searchParams.get('template');

    if (pName || pPhone) {
      if (pName) setName(pName);
      if (pPhone) setPhone(pPhone.replace(/\D/g, '').slice(-10));
      
      const tIdx = pTpl ? parseInt(pTpl) : 0;
      if (!isNaN(tIdx) && templates[tIdx]) {
        setActiveTemplate(tIdx);
        setMessage(templates[tIdx].message.replace('{name}', pName || 'Student'));
      } else {
        setMessage(templates[activeTemplate].message.replace('{name}', pName || 'Student'));
      }
    }
  }, [searchParams, activeTemplate]);

  const applyTemplate = (idx) => {
    setActiveTemplate(idx);
    const msg = templates[idx].message.replace('{name}', name || 'Student');
    setMessage(msg);
  };

  const updateName = (n) => {
    setName(n);
    // Simple regex to replace the greeting part while keeping the emoji/punctuation
    setMessage(msg => msg.replace(/^(Hello|Hi|Congratulations)\s+[^!\n?]+([!👋🙏😊🎉])/u, `$1 ${n || 'Student'}$2`));
  };

  const sendWhatsApp = () => {
    if (!phone) return;
    const msg = encodeURIComponent(message);
    const num = phone.startsWith('+') ? phone.replace(/\D/g, '') : `91${phone.replace(/\D/g, '')}`;
    window.open(`https://wa.me/${num}?text=${msg}`, '_blank', 'noopener,noreferrer');
  };

  const selectLead = (contact) => {
    setName(contact.name);
    setPhone(contact.phone.replace(/\D/g, '').slice(-10));
    const msg = templates[activeTemplate].message.replace('{name}', contact.name);
    setMessage(msg);
    // Scroll to top of compose section
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Templates */}
      <div className="content-card">
        <div className="section-header">
          <div>
            <h2>Message Templates</h2>
            <p>Pick a template to get started</p>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
          {templates.map((t, i) => (
            <button key={t.label} onClick={() => applyTemplate(i)} style={{
              padding: '14px 16px', borderRadius: 12, cursor: 'pointer', transition: 'all 0.2s',
              textAlign: 'left', border: '2px solid',
              borderColor: activeTemplate === i ? 'var(--primary)' : 'var(--border)',
              background: activeTemplate === i ? 'rgba(255,102,0,0.05)' : '#fff',
              lineHeight: 1.4,
            }}>
              <div style={{ fontSize: 22, marginBottom: 6 }}>{t.icon}</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: activeTemplate === i ? 'var(--primary)' : 'var(--text-dark)' }}>
                {t.label}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Compose + Preview */}
      <div className="wa-compose">
        {/* Compose */}
        <div className="content-card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ fontSize: 16, fontWeight: 700 }}>Compose Message</h2>
            {leads.length > 0 && (
              <div style={{ position: 'relative' }}>
                <select 
                  className="form-input" 
                  style={{ padding: '4px 10px', fontSize: 11, width: 'auto', height: 'auto', background: '#fff7ed', borderColor: '#fed7aa', fontWeight: 600 }}
                  onChange={(e) => {
                    const l = leads.find(lead => lead.id === e.target.value);
                    if (l) selectLead(l);
                  }}
                  value=""
                >
                  <option value="" disabled>🔍 Select Lead</option>
                  {leads.map(l => (
                    <option key={l.id} value={l.id}>{l.name} ({l.phone})</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div className="form-group">
            <label>Recipient Name</label>
            <input className="form-input" placeholder="Student name (optional)"
              value={name} onChange={e => updateName(e.target.value)} />
          </div>

          <div className="form-group">
            <label>Phone Number *</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <div style={{
                padding: '11px 14px', background: 'var(--bg-light)', border: '1.5px solid var(--border)',
                borderRadius: 'var(--radius-sm)', fontSize: 13, fontWeight: 600, color: 'var(--text-muted)',
                whiteSpace: 'nowrap'
              }}>+91</div>
              <input className="form-input" placeholder="10-digit number" style={{ flex: 1 }}
                value={phone} onChange={e => setPhone(e.target.value)} maxLength={10} />
            </div>
          </div>

          <div className="form-group" style={{ flex: 1 }}>
            <label>Message</label>
            <textarea className="form-input" rows={8}
              value={message} onChange={e => setMessage(e.target.value)} />
          </div>

          <button className="btn btn-whatsapp" onClick={sendWhatsApp}
            style={{ justifyContent: 'center', opacity: phone ? 1 : 0.6 }}>
            <FaWhatsapp style={{ fontSize: 18 }} />
            Send on WhatsApp
          </button>
        </div>

        {/* Preview */}
        <div className="content-card">
          <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>Message Preview</h2>
          <div className="wa-preview">
            <div className="wa-bubble">
              <div style={{ whiteSpace: 'pre-wrap' }}>{message}</div>
              <div className="wa-time">
                {new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })} ✓✓
              </div>
            </div>
          </div>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 12, textAlign: 'center' }}>
            This is a preview of how your message will appear
          </p>
        </div>
      </div>

      {/* Quick Send to Contacts */}
      <div className="content-card">
        <div className="section-header">
          <div>
            <h2>Quick Select</h2>
            <p>Load lead details into the compose form</p>
          </div>
          <span style={{
            background: 'rgba(37,211,102,0.1)', color: '#25D366', padding: '5px 12px',
            borderRadius: 20, fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6
          }}>
            <FaWhatsapp /> Quick Select
          </span>
        </div>
        {leadsLoading ? (
          <div style={{ padding: '16px 0', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {[1,2,3,4,5,6].map(i => <div key={i} className="skeleton" style={{ width: 240, height: 62, borderRadius: 12 }} />)}
          </div>
        ) : quickContacts.length === 0 ? (
          <div className="empty-state"><div className="empty-icon">👥</div><p>No leads in database yet.</p></div>
        ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12 }}>
          {quickContacts.map(contact => (
            <div key={contact.id || contact.phone} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '12px 16px', background: 'var(--bg-light)',
              borderRadius: 12, border: '1px solid var(--border)',
              cursor: 'pointer'
            }} onClick={() => selectLead(contact)}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 10, background: 'var(--gradient)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#fff', fontWeight: 700, fontSize: 14
                }}>{(contact.name || '?').charAt(0)}</div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{contact.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>+91 {contact.phone}</div>
                </div>
              </div>
              <button className="btn btn-primary btn-sm" style={{ padding: '4px 8px', fontSize: 10 }}>
                Select
              </button>
            </div>
          ))}
        </div>
        )}
      </div>

      {/* Tips */}
      <div className="content-card" style={{ background: 'linear-gradient(135deg, rgba(37,211,102,0.06), rgba(18,140,126,0.06))', border: '1px solid rgba(37,211,102,0.2)' }}>
        <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 12, color: '#128C7E' }}>
          <FaWhatsapp style={{ marginRight: 8 }} />WhatsApp Tips
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10 }}>
          {[
            { icon: '⏰', tip: 'Send messages between 10 AM – 7 PM for best response rates' },
            { icon: '✏️', tip: 'Personalize with student name for 3x higher engagement' },
            { icon: '📲', tip: 'Keep messages under 200 words for mobile readability' },
            { icon: '🎯', tip: 'Follow up within 24 hours of initial enquiry' },
          ].map(t => (
            <div key={t.tip} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <span style={{ fontSize: 18 }}>{t.icon}</span>
              <span style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>{t.tip}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
