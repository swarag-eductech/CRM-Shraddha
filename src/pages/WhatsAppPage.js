import React, { useState, useEffect, useRef } from 'react';
import { FaWhatsapp } from 'react-icons/fa';
import { MdAttachFile, MdLink, MdClose, MdPictureAsPdf, MdImage, MdVideoLibrary } from 'react-icons/md';
import { useLeads } from '../hooks/useLeads';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '../supabaseClient';

const templates = [
  {
    label: 'Welcome / Enquiry',
    icon: '👋',
    stage: 'Stage 1',
    english: `Hi {name}! 😊\n\nIt was great talking to you today about the *Abacus & Vedic Maths Teaching Program*.\n\nThis program helps you start earning from home (₹20–50k/month potential).\n\n👉 Training + study material + support — everything is included.\n\nSending you the details 👇\n_(Insert brochure / video)_\n\nFeel free to ask if you have any doubts 👍\n\n– Shraddha Institute`,
    marathi: `Hi {name}! 😊\n\nAaj tumshi abacus & vedic maths teaching program babat bolun chhan vatla.\n\nHe program tumhala gharbaslya income start karayla help karto (₹20–50k/month potential).\n\n👉 Training + study material + support sagla include aahe.\n\nMi details pathavtoy 👇\n_(Brochure / video insert kara)_\n\nKahi doubt asel tar nakki vichara 👍\n\n– Shraddha Institute`,
  },
  {
    label: 'Workshop Invite',
    icon: '🎓',
    stage: 'Special',
    english: `Hi {name}! 🌟\n\nSuvransasdhi! 🌟\nDo you want to start your own class or build a stable income from home?\n\n👉 The Abacus & Vedic Maths Teacher Training Workshop is for you!\n\n📚 In this FREE online workshop you’ll learn:\n✅ What Abacus and Vedic Maths really are\n✅ How you can build a career with them\n✅ How to start your own class/institute\n✅ Simple marketing tricks to attract students\n✅ The full support system from Shraddha Institute\n\n💡 No experience needed\n💡 Start working from home\n\n📅 Date: 03/05/2026 (Sunday)\n⏰ Time: 5:00 PM\n📍 Platform: Zoom (Online)\n\n🎁 Bonus: special offer and guidance for attendees\n\n👉 Limited seats — reserve your spot today!\n\nJoin the workshop here: [Zoom Link]\n\n– Shraddha Institute`,
    marathi: `Hi {name}! 🌟\n\nसुवर्णसंधी! 🌟\nतुम्हाला स्वतःचा क्लास सुरू करायचा आहे का किंवा घरबसल्या stable income source निर्माण करायचा आहे का?\n\n👉 मग Abacus आणि Vedic Maths Teacher Training Workshop तुमच्यासाठीच आहे!\n\n📚 या FREE Online Workshop मध्ये तुम्हाला कळणार –\n✅ Abacus आणि Vedic Maths म्हणजे नेमकं काय?\n✅ यात करिअर कसं घडवू शकता?\n✅ स्वतःचा क्लास / इंस्टिट्यूट कसा सुरू करायचा?\n✅ विद्यार्थ्यांना attract करण्यासाठी सोप्या marketing tricks\n✅ Shraddha Institute कडून मिळणारे full support system\n\n💡 Zero experience असलं तरी चालेल!\n💡 घरबसल्या काम सुरू करण्याची संधी!\n\n📅 Date: 03/05/2026 (Sunday)\n⏰ Time: संध्याकाळी 5:00\n📍 Platform: Zoom (Online)\n\n🎁 Bonus: Workshop attend करणाऱ्यांना खास ऑफर आणि guidance मिळणार!\n\n👉 Limited Seats – आजच आपली जागा reserve करा!\n\nTo join the video meeting, click this link: https://meet.google.com/fnq-jrrq-noq\n\n– Shraddha Institute`,
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
  // Media attachment
  const [mediaTab, setMediaTab] = useState('upload'); // 'upload' | 'link'
  const [mediaFile, setMediaFile] = useState(null);   // { file, previewUrl, type, name }
  const [mediaLink, setMediaLink] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadedUrl, setUploadedUrl] = useState('');
  const fileInputRef = useRef(null);
  // Recipients
  const [recipientMode, setRecipientMode] = useState('manual'); // 'manual' | 'multi'
  const [selectedLeads, setSelectedLeads] = useState([]);
  const [leadSearch, setLeadSearch] = useState('');

  const MEDIA_TYPES = {
    'image/jpeg': 'image', 'image/png': 'image', 'image/gif': 'image', 'image/webp': 'image',
    'video/mp4': 'video', 'video/quicktime': 'video', 'video/webm': 'video',
    'application/pdf': 'pdf',
  };

  const handleMediaFile = async (e) => {
    const file = e.target.files?.[0];
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (!file) return;
    const type = MEDIA_TYPES[file.type];
    if (!type) { alert('Unsupported format. Use JPG, PNG, GIF, WEBP, MP4, WEBM or PDF.'); return; }
    if (file.size > 20 * 1024 * 1024) { alert('File too large. Maximum 20 MB allowed.'); return; }
    const previewUrl = type === 'image' ? URL.createObjectURL(file) : null;
    setMediaFile({ file, previewUrl, type, name: file.name });
    setUploadedUrl('');
    // Auto-upload immediately so Send can be synchronous
    setUploading(true);
    try {
      const ext = file.name.split('.').pop();
      const path = `whatsapp/${Date.now()}.${ext}`;
      const { error } = await supabase.storage
        .from('crm-attachments')
        .upload(path, file, { contentType: file.type });
      if (error) throw error;
      const { data } = supabase.storage.from('crm-attachments').getPublicUrl(path);
      setUploadedUrl(data.publicUrl);
    } catch (err) {
      alert('Upload failed: ' + err.message);
      setMediaFile(null);
    } finally {
      setUploading(false);
    }
  };

  const removeMediaFile = () => {
    if (mediaFile?.previewUrl) URL.revokeObjectURL(mediaFile.previewUrl);
    setMediaFile(null);
    setUploadedUrl('');
  };

  const uploadMedia = async () => {
    if (!mediaFile) return '';
    setUploading(true);
    try {
      const ext = mediaFile.file.name.split('.').pop();
      const path = `whatsapp/${Date.now()}.${ext}`;
      const { error } = await supabase.storage
        .from('crm-attachments')
        .upload(path, mediaFile.file, { contentType: mediaFile.file.type });
      if (error) throw error;
      const { data } = supabase.storage.from('crm-attachments').getPublicUrl(path);
      setUploadedUrl(data.publicUrl);
      return data.publicUrl;
    } catch (err) {
      alert('Upload failed: ' + err.message);
      return '';
    } finally {
      setUploading(false);
    }
  };

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
    if (uploading) return;
    const mediaUrl = mediaTab === 'link' ? mediaLink.trim() : uploadedUrl;
    const buildMsg = (recipientName) => {
      let msg = message.replace('{name}', recipientName || 'Ma\'am');
      if (mediaUrl) msg += '\n\n' + mediaUrl;
      return encodeURIComponent(msg);
    };
    if (recipientMode === 'multi') {
      if (selectedLeads.length === 0) return;
      selectedLeads.forEach(lead => {
        const firstName = (lead.name || '').split(' ')[0] || 'Ma\'am';
        const digits = (lead.phone || '').replace(/\D/g, '').slice(-10);
        window.open(`https://wa.me/91${digits}?text=${buildMsg(firstName)}`, '_blank', 'noopener,noreferrer');
      });
    } else {
      if (!phone) return;
      const num = phone.startsWith('+') ? phone.replace(/\D/g, '') : `91${phone.replace(/\D/g, '')}`;
      window.open(`https://wa.me/${num}?text=${buildMsg(name)}`, '_blank', 'noopener,noreferrer');
    }
  };

  const selectLead = (contact) => {
    if (recipientMode === 'multi') {
      setSelectedLeads(prev =>
        prev.find(l => l.id === contact.id) ? prev.filter(l => l.id !== contact.id) : [...prev, contact]
      );
    } else {
      setName(contact.name);
      setPhone((contact.phone || '').replace(/\D/g, '').slice(-10));
      setMessage(templates[activeTemplate][lang].replace('{name}', contact.name));
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
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
          <h2 style={{ fontSize: 16, fontWeight: 700 }}>Compose Message</h2>

          {/* ── Recipients ── */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-dark)' }}>Recipients</label>
              <div style={{ display: 'flex', background: 'var(--bg-light)', borderRadius: 8, padding: 3, gap: 2 }}>
                {[{ id: 'manual', label: 'Manual' },
                  { id: 'multi',  label: `Select Leads${selectedLeads.length > 0 ? ` (${selectedLeads.length})` : ''}` }
                ].map(tab => (
                  <button key={tab.id} onClick={() => setRecipientMode(tab.id)} style={{
                    padding: '4px 14px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 700,
                    background: recipientMode === tab.id ? '#fff' : 'transparent',
                    color: recipientMode === tab.id ? 'var(--primary)' : 'var(--text-muted)',
                    boxShadow: recipientMode === tab.id ? '0 1px 4px rgba(0,0,0,0.1)' : 'none',
                    transition: 'all 0.15s',
                  }}>{tab.label}</button>
                ))}
              </div>
            </div>

            {recipientMode === 'manual' ? (
              <>
                <div className="form-group" style={{ marginBottom: 10 }}>
                  <label>Recipient Name</label>
                  <input className="form-input" placeholder="Student name (optional)"
                    value={name} onChange={e => updateName(e.target.value)} />
                </div>
                <div className="form-group">
                  <label>Phone Number *</label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <div style={{
                      padding: '11px 14px', background: 'var(--bg-light)', border: '1.5px solid var(--border)',
                      borderRadius: 'var(--radius-sm)', fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', whiteSpace: 'nowrap'
                    }}>+91</div>
                    <input className="form-input" placeholder="10-digit number" style={{ flex: 1 }}
                      value={phone} onChange={e => setPhone(e.target.value)} maxLength={10} />
                  </div>
                </div>
              </>
            ) : (
              <div>
                <input className="form-input" placeholder="🔍 Search leads by name or phone…"
                  style={{ marginBottom: 8, height: 38, fontSize: 12 }}
                  value={leadSearch} onChange={e => setLeadSearch(e.target.value)} />
                {(() => {
                  const filtered = leads.filter(l => l.name && l.phone && (
                    !leadSearch ||
                    l.name.toLowerCase().includes(leadSearch.toLowerCase()) ||
                    l.phone.includes(leadSearch)
                  ));
                  const allSelected = filtered.length > 0 && filtered.every(l => selectedLeads.find(s => s.id === l.id));
                  return (
                    <div style={{ maxHeight: 220, overflowY: 'auto', border: '1.5px solid var(--border)', borderRadius: 10 }}>
                      {/* Select All row */}
                      <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--border)',
                        display: 'flex', alignItems: 'center', gap: 8, background: 'var(--bg-light)',
                        position: 'sticky', top: 0, zIndex: 1 }}>
                        <input type="checkbox" checked={allSelected}
                          onChange={e => setSelectedLeads(e.target.checked
                            ? [...selectedLeads.filter(s => !filtered.find(f => f.id === s.id)), ...filtered]
                            : selectedLeads.filter(s => !filtered.find(f => f.id === s.id))
                          )}
                          style={{ cursor: 'pointer', accentColor: 'var(--primary)', width: 14, height: 14 }}
                        />
                        <span style={{ fontSize: 12, fontWeight: 700, flex: 1 }}>
                          {selectedLeads.length > 0
                            ? `${selectedLeads.length} lead${selectedLeads.length > 1 ? 's' : ''} selected`
                            : `Select All (${filtered.length})`}
                        </span>
                        {selectedLeads.length > 0 && (
                          <button onClick={() => setSelectedLeads([])} style={{
                            background: 'none', border: 'none', cursor: 'pointer',
                            color: 'var(--primary)', fontSize: 11, fontWeight: 700, padding: 0
                          }}>Clear all</button>
                        )}
                      </div>
                      {filtered.length === 0 ? (
                        <div style={{ padding: 20, textAlign: 'center', fontSize: 12, color: 'var(--text-muted)' }}>No leads found</div>
                      ) : filtered.map(lead => {
                        const isSel = !!selectedLeads.find(s => s.id === lead.id);
                        return (
                          <div key={lead.id}
                            onClick={() => setSelectedLeads(prev =>
                              isSel ? prev.filter(l => l.id !== lead.id) : [...prev, lead]
                            )}
                            style={{
                              padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 10,
                              cursor: 'pointer', borderBottom: '1px solid rgba(0,0,0,0.03)',
                              background: isSel ? 'rgba(255,102,0,0.05)' : 'transparent', transition: 'background 0.12s',
                            }}>
                            <input type="checkbox" checked={isSel} readOnly
                              style={{ cursor: 'pointer', accentColor: 'var(--primary)', width: 14, height: 14 }} />
                            <div style={{ width: 30, height: 30, borderRadius: 8, background: 'var(--gradient)',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              color: '#fff', fontWeight: 700, fontSize: 13, flexShrink: 0 }}>
                              {(lead.name || '?').charAt(0).toUpperCase()}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{lead.name}</div>
                              <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>+91 {lead.phone}</div>
                            </div>
                            {isSel && <span style={{ color: 'var(--primary)', fontSize: 14, fontWeight: 700 }}>✓</span>}
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>
            )}
          </div>

          <div className="form-group" style={{ flex: 1 }}>
            <label>Message</label>
            <textarea className="form-input" rows={8}
              value={message} onChange={e => setMessage(e.target.value)} />
          </div>

          {/* ── Media Attachment ── */}
          <div style={{ border: '1.5px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
            {/* Tab bar */}
            <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', background: 'var(--bg-light)' }}>
              {[{ id: 'upload', icon: <MdAttachFile size={14}/>, label: 'Upload File' },
                { id: 'link',   icon: <MdLink size={14}/>,       label: 'Add Link'    }].map(tab => (
                <button key={tab.id} onClick={() => setMediaTab(tab.id)} style={{
                  flex: 1, padding: '9px 0', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                  background: mediaTab === tab.id ? '#fff' : 'transparent',
                  color: mediaTab === tab.id ? 'var(--primary)' : 'var(--text-muted)',
                  borderBottom: mediaTab === tab.id ? '2px solid var(--primary)' : '2px solid transparent',
                }}>{tab.icon}{tab.label}</button>
              ))}
            </div>

            <div style={{ padding: '12px 14px' }}>
              {mediaTab === 'upload' ? (
                mediaFile ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    {mediaFile.type === 'image' && (
                      <img src={mediaFile.previewUrl} alt="preview" style={{ width: 48, height: 48, borderRadius: 8, objectFit: 'cover' }} />
                    )}
                    {mediaFile.type === 'video' && (
                      <div style={{ width: 48, height: 48, borderRadius: 8, background: '#1e293b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <MdVideoLibrary size={22} color="#fff" />
                      </div>
                    )}
                    {mediaFile.type === 'pdf' && (
                      <div style={{ width: 48, height: 48, borderRadius: 8, background: '#e53935', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <MdPictureAsPdf size={22} color="#fff" />
                      </div>
                    )}
                    <div style={{ flex: 1, fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-muted)' }}>
                      {uploadedUrl ? <span style={{ color: '#22c55e', fontWeight: 700 }}>✓ Uploaded</span> : mediaFile.name}
                    </div>
                    <button onClick={removeMediaFile} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}>
                      <MdClose size={18} />
                    </button>
                  </div>
                ) : (
                  <div>
                    <input ref={fileInputRef} type="file"
                      accept="image/jpeg,image/png,image/gif,image/webp,video/mp4,video/quicktime,video/webm,application/pdf"
                      style={{ display: 'none' }} onChange={handleMediaFile} />
                    <button type="button" onClick={() => fileInputRef.current?.click()}
                      style={{ width: '100%', padding: '10px', border: '2px dashed var(--border)', borderRadius: 10,
                        background: 'transparent', cursor: 'pointer', fontSize: 12, color: 'var(--text-muted)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                      <MdImage size={16} /> <MdVideoLibrary size={16} /> <MdPictureAsPdf size={16} />
                      &nbsp;Click to attach Banner / Video / PDF (max 20 MB)
                    </button>
                  </div>
                )
              ) : (
                <input className="form-input" style={{ height: 40, fontSize: 12 }}
                  placeholder="Paste YouTube, Drive, or any public link…"
                  value={mediaLink} onChange={e => setMediaLink(e.target.value)} />
              )}
            </div>
          </div>

          {(() => {
            const disabled = uploading || (recipientMode === 'multi' ? selectedLeads.length === 0 : !phone);
            const label = uploading ? 'Uploading…'
              : recipientMode === 'multi' && selectedLeads.length > 0
                ? `Send to ${selectedLeads.length} Lead${selectedLeads.length > 1 ? 's' : ''} on WhatsApp`
                : 'Send on WhatsApp';
            return (
              <button className="btn btn-whatsapp" onClick={sendWhatsApp}
                disabled={disabled}
                style={{ justifyContent: 'center', opacity: disabled ? 0.55 : 1 }}>
                <FaWhatsapp style={{ fontSize: 18 }} />
                {label}
              </button>
            );
          })()}
        </div>

        {/* Preview */}
        <div className="content-card">
          <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>Message Preview</h2>
          <div className="wa-preview">
            <div className="wa-bubble">
              {/* Media preview in bubble */}
              {mediaTab === 'upload' && mediaFile && mediaFile.type === 'image' && (
                <img src={mediaFile.previewUrl} alt="attachment preview"
                  style={{ width: '100%', borderRadius: 8, marginBottom: 8, display: 'block' }} />
              )}
              {mediaTab === 'upload' && mediaFile && mediaFile.type !== 'image' && (
                <div style={{ background: 'rgba(0,0,0,0.07)', borderRadius: 8, padding: '8px 10px',
                  marginBottom: 8, fontSize: 11, display: 'flex', alignItems: 'center', gap: 6 }}>
                  {mediaFile.type === 'video' ? <MdVideoLibrary size={16}/> : <MdPictureAsPdf size={16}/>}
                  {mediaFile.name}
                </div>
              )}
              {mediaTab === 'link' && mediaLink && (
                <div style={{ background: 'rgba(0,0,0,0.07)', borderRadius: 8, padding: '8px 10px',
                  marginBottom: 8, fontSize: 11, wordBreak: 'break-all', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <MdLink size={14}/> {mediaLink}
                </div>
              )}
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
