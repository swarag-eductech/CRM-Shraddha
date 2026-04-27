import React, { useState, useEffect } from 'react';
import { FaWhatsapp } from 'react-icons/fa';
import { useLeads } from '../hooks/useLeads';
import { useSearchParams } from 'react-router-dom';

const templates = [
  {
    label: 'Welcome / Enquiry',
    icon: '👋',
    stage: 'Stage 1',
    english: `Hi {name}! 😊\n\nIt was great talking to you today about the *Abacus & Vedic Maths Teaching Program*.\n\nThis program helps you start earning from home (₹20–50k/month potential).\n\n👉 Training + study material + support — everything is included.\n\nSending you the details 👇\n_(Insert brochure / video)_\n\nFeel free to ask if you have any doubts 👍\n\n– Shraddha Institute`,
    marathi: `Hi {name}! 😊\n\nAaj tumshi abacus & vedic maths teaching program babat bolun chhan vatla.\n\nHe program tumhala gharbaslya income start karayla help karto (₹20–50k/month potential).\n\n👉 Training + study material + support sagla include aahe.\n\nMi details pathavtoy 👇\n_(Brochure / video insert kara)_\n\nKahi doubt asel tar nakki vichara 👍\n\n– Shraddha Institute`,
  },
  {
    label: 'Value Build',
    icon: '🔥',
    stage: 'Stage 2',
    english: `Hi {name}! 👇\n\nA quick update to share —\n\nSome of our teachers who started *part-time* are now earning *₹15k–₹30k/month* 👩‍🏫\n\nBest part — no prior teaching experience needed,\nwe provide *step-by-step training*.\n\nAre you interested in starting like this?\n\n👉 _(Reply and I'll guide you 🔥)_\n\n– Shraddha Institute`,
    marathi: `Hi {name}! 👇\n\nEk quick info share karto —\n\nAamche kahi teachers ata part-time start karun monthly *₹15k–₹30k* earn kartay 👩‍🏫\n\nBest part — teaching experience lagat nahi,\nstep-by-step training deto.\n\nTumhala suddha asa start karaycha interest aahe ka?\n\n👉 _(Question = reply milto 🔥)_\n\n– Shraddha Institute`,
  },
  {
    label: 'Meeting Reminder',
    icon: '📅',
    stage: 'Reminder',
    english: `Hello {name}! 🙏\n\nThis is a reminder for your upcoming *Teacher Training* session with *Shraddha Institute*.\n\n🕐 Time: [Date & Time]\n🔗 Link: [Meet Link]\n\nPlease join 2 minutes early with your Abacus tool/notebook.\n\nSee you soon! 😊\n– Shraddha Institute`,
    marathi: `Hello {name}! 🙏\n\nTumchya upcoming *Teacher Training* session chi reminder —\n*Shraddha Institute* sathi.\n\n🕐 Vel: [Date & Time]\n🔗 Link: [Meet Link]\n\nKrupaya 2 minutes aadhi join kara Abacus tool/notebook gheun.\n\nBhetu lvakar! 😊\n– Shraddha Institute`,
  },
  {
    label: 'Follow-Up',
    icon: '🔔',
    stage: 'Stage 3',
    english: `Hi {name} 🙂\n\nYou had a look at the program yesterday…\n\nJust wanted to confirm —\nAre you interested in *joining*\nor do you need more clarity on anything?\n\n– Shraddha Institute`,
    marathi: `Hi {name} 🙂\n\nKal tumhi program baghitla hota…\n\nFakt confirm karaycha hota —\nTumhala join karaycha interest aahe ka\nki ajun kahi clarity pahije?\n\n– Shraddha Institute`,
  },
  {
    label: 'Thinking Leads',
    icon: '💭',
    stage: 'Stage 4',
    english: `Hi {name}! 👍\n\nTotally understand — it's natural to think before making a decision.\n\nBut one thing I'll share —\nmost people keep thinking but never start\nand end up *missing the opportunity*.\n\nIf you can let me know whether you want to start or not,\nI can guide you properly 🙂\n\n– Shraddha Institute`,
    marathi: `Hi {name}! 👍\n\nTotally samajto —\nDecision ghetaana vichar karava lagto.\n\nPan ek goshta sangto —\nmaximum lok vichar kartat pan start kart nahi\naani opportunity miss hote.\n\nTumhala start karaycha aahe ka nahi\nhe clear zal tar mi tumhala proper guide karu shakto 🙂\n\n– Shraddha Institute`,
  },
  {
    label: 'Urgency + Offer',
    icon: '⚡',
    stage: 'Stage 5',
    english: `Hi {name}! 🔥\n\nWanted to give you an update —\nOnly *limited seats* are left for this batch.\n\nIf you confirm *today*,\n👉 I'll give you *bonus training + marketing support* for free.\n\nShould I block your seat?\n\n– Shraddha Institute`,
    marathi: `Hi {name}! 🔥\n\nUpdate dyaycha hota —\nya batch sathi *limited seats* urlya aahet.\n\nAaj confirm kelat tar\n👉 *bonus training + marketing support* free deto.\n\nMi tumchi seat block karu ka?\n\n– Shraddha Institute`,
  },
  {
    label: 'Ghost Reactivation',
    icon: '👻',
    stage: 'Stage 6',
    english: `Hi {name} 🙂\n\nI was following up with you…\n\nYou had shown interest earlier but didn't join —\nwas there a *specific reason*?\n\nI can help 🙂\n\n– Shraddha Institute`,
    marathi: `Hi {name} 🙂\n\nMi tumcha follow-up karto hota…\n\nTumhi interest dakhavla hota pan join nahi kela —\nkahi specific reason hota ka?\n\nMi help karu shakto 🙂\n\n– Shraddha Institute`,
  },
  {
    label: 'Final Close',
    icon: '🎯',
    stage: 'Stage 7',
    english: `Hi {name} 🙂\n\nGiving you the *last update* —\n\nThe batch is closing *today*…\nIf you want to join,\nI can enroll you *right now*.\n\nOtherwise, you'll have to wait for the next batch.\n\n– Shraddha Institute`,
    marathi: `Hi {name} 🙂\n\nLast update detoy —\n\nAaj *batch closing* aahe…\nTumhala join karaycha asel tar\nmi ata pan tumhala *enroll* karu shakto.\n\nNantar next batch wait karava lagel.\n\n– Shraddha Institute`,
  },
];

export default function WhatsAppPage() {
  const [searchParams] = useSearchParams();
  const { leads, loading: leadsLoading } = useLeads();
  const quickContacts = leads.filter(l => l.name && l.phone).slice(0, 12);
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [activeTemplate, setActiveTemplate] = useState(0);
  const [lang, setLang] = useState('marathi');
  const [message, setMessage] = useState(templates[0].marathi.replace('{name}', 'Ma\'am'));

  // Effect to handle URL parameters
  useEffect(() => {
    const pName = searchParams.get('name');
    const pPhone = searchParams.get('phone');
    const pTpl = searchParams.get('template');

    if (pName || pPhone) {
      if (pName) setName(pName);
      if (pPhone) setPhone(pPhone.replace(/\D/g, '').slice(-10));

      const tIdx = pTpl ? parseInt(pTpl) : 0;
      const tpl = (!isNaN(tIdx) && templates[tIdx]) ? templates[tIdx] : templates[activeTemplate];
      setActiveTemplate(!isNaN(tIdx) && templates[tIdx] ? tIdx : activeTemplate);
      setMessage(tpl[lang].replace('{name}', pName || 'Ma\'am'));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const applyTemplate = (idx, langOverride) => {
    const useLang = langOverride || lang;
    setActiveTemplate(idx);
    setMessage(templates[idx][useLang].replace('{name}', name || 'Ma\'am'));
  };

  const switchLang = (newLang) => {
    setLang(newLang);
    setMessage(templates[activeTemplate][newLang].replace('{name}', name || 'Ma\'am'));
  };

  const updateName = (n) => {
    setName(n);
    setMessage(templates[activeTemplate][lang].replace('{name}', n || 'Ma\'am'));
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
        {/* Language Toggle */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 14, alignItems: 'center' }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>Language:</span>
          {['english', 'marathi'].map(l => (
            <button key={l} onClick={() => switchLang(l)} style={{
              padding: '5px 16px', borderRadius: 20, border: '1.5px solid',
              borderColor: lang === l ? 'var(--primary)' : 'var(--border)',
              background: lang === l ? 'var(--primary)' : '#fff',
              color: lang === l ? '#fff' : 'var(--text-muted)',
              fontWeight: 700, fontSize: 12, cursor: 'pointer', transition: 'all 0.18s',
            }}>
              {l === 'english' ? '🇬🇧 English' : '🇮🇳 Marathi'}
            </button>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 10 }}>
          {templates.map((t, i) => (
            <button key={t.label} onClick={() => applyTemplate(i)} style={{
              padding: '12px 14px', borderRadius: 12, cursor: 'pointer', transition: 'all 0.2s',
              textAlign: 'left', border: '2px solid',
              borderColor: activeTemplate === i ? 'var(--primary)' : 'var(--border)',
              background: activeTemplate === i ? 'rgba(255,102,0,0.05)' : '#fff',
              lineHeight: 1.4,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                <span style={{ fontSize: 18 }}>{t.icon}</span>
                <span style={{ fontSize: 10, fontWeight: 700, color: activeTemplate === i ? 'var(--primary)' : '#94a3b8',
                  background: activeTemplate === i ? 'rgba(255,102,0,0.1)' : '#f1f5f9',
                  padding: '1px 7px', borderRadius: 10 }}>{t.stage}</span>
              </div>
              <div style={{ fontSize: 12, fontWeight: 600, color: activeTemplate === i ? 'var(--primary)' : 'var(--text-dark)' }}>
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
