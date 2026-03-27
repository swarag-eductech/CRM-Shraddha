import React, { useState } from 'react';
import { FaWhatsapp } from 'react-icons/fa';
import { useLeads } from '../hooks/useLeads';

const templates = [
  {
    label: 'Welcome / Enquiry',
    icon: '👋',
    message: `Hello {name}! 👋\n\nThank you for your interest in *Shraddha Institute*.\n\nWe are proud to offer expert coaching for:\n📚 CA Foundation, Inter & Final\n📊 CMA Foundation, Inter & Final\n⚖️ CS Foundation & Executive\n\nWould you like to schedule a FREE counselling session?\n\nReply *YES* to proceed.\n\n– Shraddha Institute Team`,
  },
  {
    label: 'Meeting Reminder',
    icon: '📅',
    message: `Hello {name}! 🙏\n\nThis is a reminder for your upcoming meeting with *Shraddha Institute*.\n\n🕐 Time: [Date & Time]\n🔗 Link: [Meet Link]\n\nPlease join 2 minutes early.\n\nSee you soon! 😊\n– Shraddha Institute`,
  },
  {
    label: 'Follow-Up',
    icon: '🔔',
    message: `Hi {name}! 😊\n\nWe noticed you showed interest in our courses. We'd love to help you *start your journey* with Shraddha Institute!\n\n✅ Expert Faculty\n✅ Study Material Included\n✅ Online + Offline Classes\n✅ Flexible Batches\n\nLimited seats available! Book now 🎯\n\nCall: 99XXXXXXXX\n– Shraddha Institute`,
  },
  {
    label: 'Converted / Welcome',
    icon: '🎉',
    message: `Congratulations {name}! 🎉\n\nWelcome to the *Shraddha Institute Family*! 🎓\n\nYour enrollment is confirmed. Here's what's next:\n\n📌 Orientation: [Date]\n📌 Batch Start: [Date]\n📌 Study Material: Provided on Day 1\n\nFor queries: 99XXXXXXXX\n\nWishing you great success! 🌟\n– Shraddha Institute`,
  },
];

export default function WhatsAppPage() {
  const { leads, loading: leadsLoading } = useLeads();
  const quickContacts = leads.filter(l => l.name && l.phone).slice(0, 12);
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [message, setMessage] = useState(templates[0].message.replace('{name}', 'Student'));
  const [activeTemplate, setActiveTemplate] = useState(0);

  const applyTemplate = (idx) => {
    setActiveTemplate(idx);
    const msg = templates[idx].message.replace('{name}', name || 'Student');
    setMessage(msg);
  };

  const updateName = (n) => {
    setName(n);
    setMessage(msg => msg.replace(/Hello .+?[!👋🙏😊]/u, (m) => {
      const suffix = m.match(/[!👋🙏😊]/u)?.[0] || '!';
      return `Hello ${n || 'Student'}${suffix}`;
    }));
  };

  const sendWhatsApp = () => {
    if (!phone) return;
    const msg = encodeURIComponent(message);
    const num = phone.startsWith('+') ? phone.replace(/\D/g, '') : `91${phone.replace(/\D/g, '')}`;
    window.open(`https://wa.me/${num}?text=${msg}`, '_blank', 'noopener,noreferrer');
  };

  const sendToContact = (contact) => {
    const msg = encodeURIComponent(templates[activeTemplate].message.replace('{name}', contact.name));
    window.open(`https://wa.me/91${contact.phone}?text=${msg}`, '_blank', 'noopener,noreferrer');
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
          <h2 style={{ fontSize: 16, fontWeight: 700 }}>Compose Message</h2>

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
              {message}
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
            <h2>Quick Send</h2>
            <p>Send the selected template to recent leads</p>
          </div>
          <span style={{
            background: 'rgba(37,211,102,0.1)', color: '#25D366', padding: '5px 12px',
            borderRadius: 20, fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6
          }}>
            <FaWhatsapp /> WhatsApp
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
            <div key={contact.phone} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '12px 16px', background: 'var(--bg-light)',
              borderRadius: 12, border: '1px solid var(--border)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 10, background: 'var(--gradient)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#fff', fontWeight: 700, fontSize: 14
                }}>{contact.name.charAt(0)}</div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{contact.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>+91 {contact.phone}</div>
                </div>
              </div>
              <button className="btn btn-whatsapp btn-sm" onClick={() => sendToContact(contact)}>
                <FaWhatsapp />
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
