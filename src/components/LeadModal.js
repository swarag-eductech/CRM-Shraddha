import React, { useState, useEffect } from 'react';
import { MdClose, MdPhone, MdAdd, MdCheckCircle, MdCancel, MdDelete, MdBlock, MdMessage, MdTimeline } from 'react-icons/md';
import { FaWhatsapp } from 'react-icons/fa';
import { supabase } from '../supabaseClient';
import { addFollowup, updateLeadStatus, softDeleteFollowup, dismissFollowup, getLeadTimeline, addMessage } from '../api';
import { formatIST } from '../utils/time';
import { SourceBadge } from '../utils/sourceBadge';

function formatDT(dt) {
  if (!dt) return null;
  return formatIST(dt).shortDT;
}

export default function LeadModal({ lead, onClose, onUpdated }) {
  const [followups, setFollowups] = useState([]);
  const [loadingF, setLoadingF] = useState(true);
  const [form, setForm] = useState({ note: '', nextFollowupAt: '' });
  const [saving, setSaving] = useState(false);
  const [statusSaving, setStatusSaving] = useState(false);
  const [error, setError] = useState('');
  const [extending, setExtending] = useState(false);
  const [activeTab, setActiveTab] = useState('followups'); // 'followups' | 'timeline' | 'messages'
  const [timeline, setTimeline] = useState([]);
  const [loadingTL, setLoadingTL] = useState(false);
  const [messages, setMessages] = useState([]);
  const [newMsg, setNewMsg] = useState('');

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('ttp_followups')
        .select('*')
        .eq('lead_id', lead.id)
        .eq('is_deleted', false)
        .order('followup_number', { ascending: true });
      setFollowups(data || []);
      setLoadingF(false);
    })();

    // Preload messages
    (async () => {
      const { data } = await supabase.from('ttp_messages').select('*').eq('lead_id', lead.id).order('created_at', { ascending: true });
      setMessages(data || []);
    })();
  }, [lead.id]);

  const handleAddFollowup = async (e) => {
    e.preventDefault();
    if (!form.nextFollowupAt) return;
    setSaving(true); setError('');
    try {
      const newF = await addFollowup({
        leadId: lead.id,
        note: form.note,
        nextFollowupAt: form.nextFollowupAt,
        extend: extending,
      });
      setFollowups((prev) => [...prev, newF]);
      setForm({ note: '', nextFollowupAt: '' });
      setExtending(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDismissFollowup = async (followupId) => {
    try {
      await dismissFollowup(followupId);
      setFollowups(prev => prev.map(f => f.id === followupId ? { ...f, dismissed: true } : f));
    } catch (err) { alert('Dismiss failed: ' + err.message); }
  };

  const handleDeleteFollowup = async (followupId) => {
    if (!window.confirm('Delete this follow-up?')) return;
    try {
      await softDeleteFollowup(followupId);
      setFollowups(prev => prev.filter(f => f.id !== followupId));
    } catch (err) { alert('Delete failed: ' + err.message); }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMsg.trim()) return;
    try {
      const msg = await addMessage({ leadId: lead.id, messageText: newMsg.trim(), direction: 'outgoing' });
      setMessages(prev => [...prev, msg]);
      setNewMsg('');
    } catch (err) { alert('Failed to send message: ' + err.message); }
  };

  const handleLoadTimeline = async () => {
    if (loadingTL) return;
    setLoadingTL(true);
    const items = await getLeadTimeline(lead.id);
    setTimeline(items);
    setLoadingTL(false);
  };

  const handleStatus = async (status) => {
    setStatusSaving(true);
    try {
      await updateLeadStatus(lead.id, status);
      onUpdated({ ...lead, status });
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setStatusSaving(false);
    }
  };

  const canAdd = followups.length < 3 || extending;

  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 10000,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 16, animation: 'fadeIn 0.15s ease',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#fff', borderRadius: 18, width: '100%', maxWidth: 520,
          boxShadow: '0 24px 80px rgba(0,0,0,0.18)', overflow: 'hidden',
          animation: 'fadeInUp 0.25s ease',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ background: 'linear-gradient(135deg,#ff6600,#f7971e)', padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 12, justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(255,255,255,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 16, fontWeight: 800 }}>
              {(lead.name || '?').charAt(0).toUpperCase()}
            </div>
            <div>
              <div style={{ color: '#fff', fontWeight: 800, fontSize: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                {lead.name || '—'}
                {lead.source && <SourceBadge source={lead.source} />}
              </div>
              {lead.phone && (
                <div style={{ color: 'rgba(255,255,255,0.85)', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <MdPhone size={12} /> {lead.phone}
                  {lead.city && ` · ${lead.city}`}
                </div>
              )}
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: 8, width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', cursor: 'pointer', fontSize: 18 }}>
            <MdClose />
          </button>
        </div>

        <div style={{ padding: '16px 20px', maxHeight: '65vh', overflowY: 'auto' }}>
          {/* Quick status actions */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
            <button className="btn btn-sm" disabled={statusSaving || lead.status === 'converted'}
              style={{ flex: 1, background: '#10b981', color: '#fff', border: 'none', justifyContent: 'center', opacity: lead.status === 'converted' ? 0.5 : 1 }}
              onClick={() => handleStatus('converted')}>
              <MdCheckCircle /> Mark Converted
            </button>
            <button className="btn btn-sm" disabled={statusSaving || lead.status === 'dead'}
              style={{ flex: 1, background: '#ef4444', color: '#fff', border: 'none', justifyContent: 'center', opacity: lead.status === 'dead' ? 0.5 : 1 }}
              onClick={() => handleStatus('dead')}>
              <MdCancel /> Mark Dead
            </button>
            {lead.phone && (
              <button className="btn btn-whatsapp btn-sm"
                onClick={() => {
                  const msg = encodeURIComponent(`Hello ${lead.name}! Following up from Shraddha Institute 🙏`);
                  window.open(`https://wa.me/91${lead.phone}?text=${msg}`, '_blank', 'noopener,noreferrer');
                }}>
                <FaWhatsapp />
              </button>
            )}
          </div>

          {/* Tabs */}
          <div style={{ display: 'flex', gap: 0, marginBottom: 14, borderBottom: '2px solid #f0e8de' }}>
            {[
              { key: 'followups', label: 'Follow-ups', icon: <MdAdd size={13} /> },
              { key: 'messages', label: 'Messages', icon: <MdMessage size={13} /> },
              { key: 'timeline', label: 'Timeline', icon: <MdTimeline size={13} /> },
            ].map(tab => (
              <button key={tab.key}
                onClick={() => { setActiveTab(tab.key); if (tab.key === 'timeline') handleLoadTimeline(); }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 5, padding: '7px 14px',
                  background: 'none', border: 'none',
                  borderBottom: activeTab === tab.key ? '2px solid #ff6600' : '2px solid transparent',
                  marginBottom: -2, color: activeTab === tab.key ? '#ff6600' : 'var(--text-muted)',
                  fontWeight: activeTab === tab.key ? 700 : 500, fontSize: 12, cursor: 'pointer',
                }}>
                {tab.icon} {tab.label}
              </button>
            ))}
          </div>
          {/* ── Follow-ups Tab ──────────────────────────────────────── */}
          {activeTab === 'followups' && (
            <>
              <h4 style={{ margin: '0 0 10px', fontSize: 13, fontWeight: 700, color: 'var(--text-muted)' }}>
                FOLLOW-UPS ({followups.filter(f => !f.dismissed).length}/3)
              </h4>
              {loadingF ? (
                <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>Loading…</p>
              ) : followups.length === 0 ? (
                <p style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', padding: '8px 0' }}>No follow-ups yet.</p>
              ) : (
                <div style={{ marginBottom: 14 }}>
                  {followups.map((f, i) => {
                    const dt = f.next_followup_at ? new Date(f.next_followup_at) : null;
                    const now = new Date();
                    const isOverdue = dt && dt < now && f.status !== 'completed';
                    const { shortDT } = formatIST(f.next_followup_at);
                    return (
                      <div key={f.id} style={{
                        background: f.dismissed ? '#f9fafb' : isOverdue ? '#fef2f2' : '#fff7ed',
                        border: `1.5px solid ${f.dismissed ? '#e5e7eb' : isOverdue ? '#fca5a5' : '#fed7aa'}`,
                        borderRadius: 10, padding: '10px 12px', marginBottom: 8,
                        opacity: f.dismissed ? 0.55 : 1,
                        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8,
                      }}>
                        <div style={{ flex: 1 }}>
                          <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 7px', borderRadius: 6, background: isOverdue ? '#fee2e2' : '#ffedd5', color: isOverdue ? '#dc2626' : '#ea580c' }}>
                            #{f.followup_number || i + 1}
                          </span>
                          {isOverdue && <span style={{ fontSize: 10, color: '#dc2626', fontWeight: 700, marginLeft: 6 }}>⚠ OVERDUE</span>}
                          {f.dismissed && <span style={{ fontSize: 10, color: '#6b7280', fontWeight: 700, marginLeft: 6 }}>DISMISSED</span>}
                          <p style={{ margin: '5px 0 1px', fontSize: 12, fontWeight: 600 }}>{shortDT}</p>
                          {f.note && <p style={{ margin: 0, fontSize: 11, color: 'var(--text-muted)' }}>{f.note}</p>}
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-end', flexShrink: 0 }}>
                          <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 8, background: f.reminder_sent ? '#f0fdf4' : '#fef9c3', color: f.reminder_sent ? '#16a34a' : '#ca8a04', border: `1px solid ${f.reminder_sent ? '#bbf7d0' : '#fde68a'}` }}>
                            {f.reminder_sent ? 'Reminded' : 'Pending'}
                          </span>
                          {!f.dismissed && (
                            <button title="Dismiss" onClick={() => handleDismissFollowup(f.id)}
                              style={{ background: '#fff7ed', border: '1px solid #fed7aa', color: '#ea580c', borderRadius: 6, padding: '2px 7px', fontSize: 10, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3 }}>
                              <MdBlock size={10} /> Dismiss
                            </button>
                          )}
                          <button title="Delete" onClick={() => handleDeleteFollowup(f.id)}
                            style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', borderRadius: 6, padding: '2px 7px', fontSize: 10, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3 }}>
                            <MdDelete size={10} /> Delete
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              {canAdd ? (
                <form onSubmit={handleAddFollowup}>
                  <div style={{ background: '#f9f4ef', borderRadius: 10, padding: 14, border: '1.5px solid #f0e8de' }}>
                    <p style={{ margin: '0 0 10px', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)' }}>
                      {extending ? `EXTENDED FOLLOW-UP #${followups.length + 1}` : `ADD FOLLOW-UP ${followups.filter(f => !f.dismissed).length + 1} OF 3`}
                    </p>
                    {error && <p style={{ color: '#dc2626', fontSize: 11, margin: '0 0 8px' }}>⚠ {error}</p>}
                    <div style={{ marginBottom: 8 }}>
                      <label style={{ fontSize: 11, fontWeight: 600, display: 'block', marginBottom: 4 }}>Date &amp; Time *</label>
                      <input type="datetime-local" className="form-input" value={form.nextFollowupAt} onChange={(e) => setForm((f) => ({ ...f, nextFollowupAt: e.target.value }))} required style={{ fontSize: 12 }} />
                    </div>
                    <div style={{ marginBottom: 10 }}>
                      <label style={{ fontSize: 11, fontWeight: 600, display: 'block', marginBottom: 4 }}>Note</label>
                      <textarea className="form-input" rows={2} placeholder="Optional note…" value={form.note} onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} style={{ fontSize: 12 }} />
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button type="submit" className="btn btn-primary btn-sm" disabled={saving} style={{ flex: 1, justifyContent: 'center' }}>
                        <MdAdd /> {saving ? 'Saving…' : 'Add Follow-up'}
                      </button>
                      {extending && <button type="button" className="btn btn-secondary btn-sm" onClick={() => setExtending(false)}>Cancel</button>}
                    </div>
                  </div>
                </form>
              ) : (
                <div style={{ background: '#fff7ed', border: '1.5px solid #fed7aa', borderRadius: 10, padding: '12px 14px', textAlign: 'center' }}>
                  <p style={{ fontSize: 12, color: '#ea580c', fontWeight: 600, margin: '0 0 8px' }}>✓ Maximum 3 follow-ups reached</p>
                  <button className="btn btn-secondary btn-sm" style={{ fontSize: 11 }} onClick={() => setExtending(true)}>⚡ Extend Follow-up</button>
                </div>
              )}
            </>
          )}

          {/* ── Messages Tab ─────────────────────────────────────────── */}
          {activeTab === 'messages' && (
            <div>
              <div style={{ minHeight: 160, maxHeight: 280, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12, padding: '4px 0' }}>
                {messages.length === 0 && (
                  <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 12, paddingTop: 32 }}>No messages yet.</div>
                )}
                {messages.map(m => (
                  <div key={m.id} style={{ display: 'flex', justifyContent: m.direction === 'outgoing' ? 'flex-end' : 'flex-start' }}>
                    <div style={{
                      maxWidth: '75%', padding: '8px 12px',
                      borderRadius: m.direction === 'outgoing' ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                      background: m.direction === 'outgoing' ? '#fff7ed' : '#f0fdf4',
                      border: m.direction === 'outgoing' ? '1.5px solid #fed7aa' : '1.5px solid #bbf7d0',
                      color: m.direction === 'outgoing' ? '#92400e' : '#166534', fontSize: 12,
                    }}>
                      <div>{m.message_text}</div>
                      <div style={{ fontSize: 10, opacity: 0.65, marginTop: 3 }}>{formatIST(m.created_at).timeOnly}</div>
                    </div>
                  </div>
                ))}
              </div>
              <form onSubmit={handleSendMessage} style={{ display: 'flex', gap: 8 }}>
                <input className="form-input" placeholder="Type a note / message..." value={newMsg}
                  onChange={e => setNewMsg(e.target.value)} style={{ flex: 1, fontSize: 12 }} />
                <button type="submit" className="btn btn-primary btn-sm" disabled={!newMsg.trim()}>Send</button>
              </form>
            </div>
          )}

          {/* ── Timeline Tab ─────────────────────────────────────────── */}
          {activeTab === 'timeline' && (
            <div style={{ paddingLeft: 4 }}>
              {loadingTL && <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>Loading timeline…</p>}
              {!loadingTL && timeline.length === 0 && (
                <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 12, paddingTop: 24 }}>No activity yet.</div>
              )}
              {timeline.map((item, i) => {
                const { shortDT } = formatIST(item._at);
                let icon = '📄'; let label = ''; let detail = '';
                if (item._type === 'message') {
                  icon = item.direction === 'incoming' ? '💬' : '✏️';
                  label = item.direction === 'incoming' ? 'WhatsApp Message' : 'Note Sent';
                  detail = item.message_text;
                } else if (item._type === 'followup') {
                  icon = '📅'; label = `Follow-up #${item.followup_number}`;
                  detail = item.note || `Scheduled: ${formatIST(item.next_followup_at).shortDT}`;
                } else if (item._type === 'meeting') {
                  icon = '📈'; label = 'Meeting';
                  detail = `At: ${formatIST(item.meeting_datetime).shortDT}`;
                } else if (item._type === 'activity') {
                  icon = '⚡'; label = item.type || 'Activity'; detail = item.description;
                }
                return (
                  <div key={i} style={{ display: 'flex', gap: 10, paddingBottom: 12, borderLeft: '2px solid #f0e8de', marginLeft: 10, paddingLeft: 14, position: 'relative' }}>
                    <div style={{ position: 'absolute', left: -10, top: 0, width: 18, height: 18, borderRadius: '50%', background: '#fff7ed', border: '2px solid #f0e8de', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11 }}>{icon}</div>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 700 }}>{label}</div>
                      {detail && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>{detail}</div>}
                      <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>{shortDT}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
