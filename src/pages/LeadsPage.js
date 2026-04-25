import React, { useState, useEffect, useRef, useCallback } from 'react';
import { MdSearch, MdAdd, MdClose, MdRefresh, MdPhone, MdCalendarToday, MdExpandMore, MdExpandLess, MdDelete, MdAssignment, MdCheckBox, MdCheckBoxOutlineBlank, MdIndeterminateCheckBox } from 'react-icons/md';
import { FaWhatsapp } from 'react-icons/fa';
import { supabase } from '../supabaseClient';
import { createLead, updateLeadStatus, addFollowup, softDeleteLead, callCustomer } from '../api';
import { formatIST } from '../utils/time';
import { SourceBadge, ProgramBadge } from '../utils/sourceBadge';
import { useAuth } from '../hooks/useAuth';

const AGENTS = ['pujita', 'aditya', 'gautami'];

function SmartfloCallButton({ phone }) {
  const [calling, setCalling]       = useState(false);
  const [agent, setAgent]           = useState('');
  const [dropOpen, setDropOpen]     = useState(false);
  const ref = useRef();

  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setDropOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const handleCall = async () => {
    if (calling) return;
    if (!agent) { alert('Please select an agent first.'); setDropOpen(true); return; }
    setCalling(true);
    try {
      await callCustomer(phone, agent);
      alert(`📞 Calling ${phone} via ${agent}...\nSmartflo will call you first, then connect to the customer.`);
    } catch (err) {
      alert('Call failed: ' + err.message);
    } finally {
      setCalling(false);
    }
  };

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-flex', gap: 2 }}>
      {/* Agent selector */}
      <button
        onClick={() => setDropOpen(o => !o)}
        title="Select agent"
        style={{ background: '#e8f5e9', color: '#2e7d32', border: '1.5px solid #a5d6a7', borderRight: 'none', borderRadius: '6px 0 0 6px', padding: '4px 6px', cursor: 'pointer', fontSize: 11, fontWeight: 700, minWidth: 58 }}
      >
        {agent ? agent.charAt(0).toUpperCase() + agent.slice(1) : '▾ Agent'}
      </button>
      {dropOpen && (
        <div style={{ position: 'absolute', top: '110%', left: 0, zIndex: 100, background: '#fff', border: '1.5px solid #a5d6a7', borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.12)', overflow: 'hidden', minWidth: 100 }}>
          {AGENTS.map(a => (
            <div key={a} onClick={() => { setAgent(a); setDropOpen(false); }}
              style={{ padding: '7px 14px', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: agent === a ? '#16a34a' : '#334155', background: agent === a ? '#f0fdf4' : '#fff' }}>
              {a.charAt(0).toUpperCase() + a.slice(1)}
            </div>
          ))}
        </div>
      )}
      {/* Call button */}
      <button
        title={agent ? `Call via ${agent}` : 'Select agent first'}
        onClick={handleCall}
        disabled={calling}
        style={{ background: calling ? '#f0f9f0' : '#e8f5e9', color: '#2e7d32', border: '1.5px solid #a5d6a7', borderLeft: 'none', borderRadius: '0 6px 6px 0', padding: '4px 6px', cursor: calling ? 'wait' : 'pointer' }}
      >
        <MdPhone size={14} />
      </button>
    </div>
  );
}

const STATUS_OPTIONS = ['new', 'contacted', 'warm', 'converted', 'lost'];
const STATUS_COLORS = {
  new:       { bg: '#fff7ed', color: '#ea580c', border: '#fed7aa' },
  contacted: { bg: '#eff6ff', color: '#2563eb', border: '#bfdbfe' },
  warm:      { bg: '#fef9c3', color: '#ca8a04', border: '#fde68a' },
  converted: { bg: '#f0fdf4', color: '#16a34a', border: '#bbf7d0' },
  lost:      { bg: '#fef2f2', color: '#dc2626', border: '#fecaca' },
};

function StatusBadge({ status, leadId, onUpdated }) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const ref = useRef();
  const st = STATUS_COLORS[status] || STATUS_COLORS.new;

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleChange = async (newStatus) => {
    setOpen(false); setSaving(true);
    try { await updateLeadStatus(leadId, newStatus); onUpdated(leadId, newStatus); }
    catch (err) { alert('Failed: ' + err.message); }
    finally { setSaving(false); }
  };

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-block' }}>
      <span onClick={() => !saving && setOpen(o => !o)} style={{
        background: st.bg, color: st.color, border: `1.5px solid ${st.border}`,
        padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700,
        cursor: saving ? 'wait' : 'pointer', display: 'flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap',
      }}>
        {saving ? '...' : status.charAt(0).toUpperCase() + status.slice(1)}
        {!saving && (open ? <MdExpandLess size={12} /> : <MdExpandMore size={12} />)}
      </span>
      {open && (
        <div style={{ position: 'absolute', top: '110%', left: 0, zIndex: 50, background: '#fff', borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.13)', border: '1px solid #f0e8de', overflow: 'hidden', minWidth: 130 }}>
          {STATUS_OPTIONS.map(s => {
            const c = STATUS_COLORS[s];
            return (
              <div key={s} onClick={() => handleChange(s)} style={{ padding: '8px 12px', fontSize: 12, cursor: 'pointer', background: s === status ? '#fff7ed' : '#fff' }}
                onMouseEnter={e => e.currentTarget.style.background = '#fff7ed'}
                onMouseLeave={e => e.currentTarget.style.background = s === status ? '#fff7ed' : '#fff'}>
                <span style={{ background: c.bg, color: c.color, border: `1.5px solid ${c.border}`, padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 700 }}>
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function FollowupModal({ lead, onClose }) {
  const [followups, setFollowups] = useState([]);
  const [loadingF, setLoadingF] = useState(true);
  const [form, setForm] = useState({ note: '', nextFollowupAt: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [extending, setExtending] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('ttp_followups').select('*').eq('lead_id', lead.id).order('followup_number', { ascending: true });
      setFollowups(data || []); setLoadingF(false);
    })();
  }, [lead.id]);

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!form.nextFollowupAt) return;
    setSaving(true); setError('');
    try {
      const newF = await addFollowup({ leadId: lead.id, note: form.note, nextFollowupAt: form.nextFollowupAt, extend: extending });
      setFollowups(prev => [...prev, newF]);
      setForm({ note: '', nextFollowupAt: '' });
      setExtending(false);
    } catch (err) { setError(err.message); }
    finally { setSaving(false); }
  };

  const fmtDT = (dt) => dt ? new Date(dt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—';

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 520 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Follow-ups — {lead.name}</h3>
          <button className="modal-close" onClick={onClose}><MdClose /></button>
        </div>
        {loadingF ? <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Loading...</p> : (
          <div style={{ marginBottom: 16 }}>
            {followups.length === 0
              ? <p style={{ color: 'var(--text-muted)', fontSize: 13, textAlign: 'center', padding: '12px 0' }}>No follow-ups yet.</p>
              : followups.map((f, i) => (
                <div key={f.id} style={{ background: '#fff7ed', border: '1.5px solid #fed7aa', borderRadius: 10, padding: '10px 14px', marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#ea580c', background: '#ffedd5', padding: '2px 8px', borderRadius: 8 }}>#{f.followup_number || i + 1}</span>
                    <p style={{ margin: '6px 0 2px', fontSize: 13, fontWeight: 600 }}>{fmtDT(f.next_followup_at)}</p>
                    {f.note && <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)' }}>{f.note}</p>}
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 8, background: f.reminder_sent ? '#f0fdf4' : '#fef9c3', color: f.reminder_sent ? '#16a34a' : '#ca8a04', border: `1px solid ${f.reminder_sent ? '#bbf7d0' : '#fde68a'}` }}>
                    {f.reminder_sent ? 'Reminded' : 'Pending'}
                  </span>
                </div>
              ))
            }
          </div>
        )}
        {followups.length < 3 || extending ? (
          <form onSubmit={handleAdd}>
            <div style={{ background: '#f9f4ef', borderRadius: 10, padding: 14, border: '1.5px solid #f0e8de' }}>
              <p style={{ margin: '0 0 10px', fontSize: 12, fontWeight: 700, color: 'var(--text-muted)' }}>
                {extending ? `EXTENDED FOLLOW-UP #${followups.length + 1}` : `ADD FOLLOW-UP ${followups.length + 1} OF 3`}
              </p>
              {extending && (
                <div style={{ background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 8, padding: '8px 12px', marginBottom: 10, fontSize: 12, color: '#92400e' }}>
                  ⚡ Extended mode — adding beyond the 3-follow-up limit
                </div>
              )}
              {error && <p style={{ color: '#dc2626', fontSize: 12, margin: '0 0 8px' }}>⚠ {error}</p>}
              <div className="form-group" style={{ marginBottom: 10 }}>
                <label>Date & Time *</label>
                <input type="datetime-local" className="form-input" value={form.nextFollowupAt} onChange={e => setForm(f => ({ ...f, nextFollowupAt: e.target.value }))} required />
              </div>
              <div className="form-group" style={{ marginBottom: 12 }}>
                <label>Note</label>
                <textarea className="form-input" rows={2} placeholder="Optional note..." value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} />
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving...' : '+ Add Follow-up'}</button>
                {extending && <button type="button" className="btn btn-secondary" onClick={() => setExtending(false)}>Cancel</button>}
              </div>
            </div>
          </form>
        ) : (
          <div style={{ background: '#fff7ed', border: '1.5px solid #fed7aa', borderRadius: 10, padding: '14px 16px', textAlign: 'center' }}>
            <p style={{ fontSize: 13, color: '#ea580c', fontWeight: 600, margin: '0 0 10px' }}>✓ Maximum 3 follow-ups reached</p>
            <button
              className="btn btn-secondary btn-sm"
              style={{ fontSize: 12, borderColor: '#fed7aa', color: '#ea580c' }}
              onClick={() => setExtending(true)}
            >
              ⚡ Extend Follow-up
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function LeadReportModal({ lead, onClose }) {
  const [followups, setFollowups] = useState([]);
  const [loadingF, setLoadingF] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('ttp_followups')
        .select('*')
        .eq('lead_id', lead.id)
        .order('followup_number', { ascending: true });
      setFollowups(data || []);
      setLoadingF(false);
    })();
  }, [lead.id]);

  const fmtDT = (dt) => dt
    ? new Date(dt).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : '—';

  const PROGRAM_LABELS = {
    student_abacus_class: '🧮 Abacus Student',
    student_vedic_math: '🔢 Vedic Math',
    ttp_teacher_training: '👩‍🏫 TTP Training',
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 600, maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>📋 Lead Report — {lead.name}</h3>
          <button className="modal-close" onClick={onClose}><MdClose /></button>
        </div>

        {/* Lead Info Card */}
        <div style={{ background: '#fff7ed', border: '1.5px solid #fed7aa', borderRadius: 12, padding: '14px 18px', marginBottom: 20 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 20px' }}>
            {[
              { label: 'Name', value: lead.name || '—' },
              { label: 'Phone', value: lead.phone || '—' },
              { label: 'Email', value: lead.email || '—' },
              { label: 'City', value: lead.city || '—' },
              { label: 'Program', value: PROGRAM_LABELS[lead.lead_program] || lead.lead_program || '—' },
              { label: 'Source', value: lead.source || '—' },
              { label: 'Status', value: (lead.status || 'new').charAt(0).toUpperCase() + (lead.status || 'new').slice(1) },
              { label: 'Added On', value: fmtDT(lead.created_at) },
            ].map(({ label, value }) => (
              <div key={label}>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#ea580c', textTransform: 'uppercase', marginBottom: 2 }}>{label}</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#1a1a1a' }}>{value}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Followup Timeline */}
        <div style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>
            Follow-up History ({loadingF ? '…' : followups.length} entries)
          </div>
          {loadingF ? (
            <p style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', padding: '12px 0' }}>Loading history…</p>
          ) : followups.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--text-muted)', fontSize: 13 }}>
              <div style={{ fontSize: 30, marginBottom: 8 }}>📭</div>
              No follow-ups recorded yet.
            </div>
          ) : (
            <div style={{ position: 'relative', paddingLeft: 24 }}>
              {/* Vertical timeline line */}
              <div style={{ position: 'absolute', left: 8, top: 0, bottom: 0, width: 2, background: '#fed7aa', borderRadius: 2 }} />
              {followups.map((f, i) => {
                const isDone = f.reminder_sent;
                const isDeleted = f.is_deleted;
                return (
                  <div key={f.id} style={{ position: 'relative', marginBottom: 14, opacity: isDeleted ? 0.45 : 1 }}>
                    {/* Circle dot on timeline */}
                    <div style={{
                      position: 'absolute', left: -20, top: 8,
                      width: 12, height: 12, borderRadius: '50%',
                      background: isDone ? '#16a34a' : '#ea580c',
                      border: '2px solid #fff',
                      boxShadow: `0 0 0 2px ${isDone ? '#bbf7d0' : '#fed7aa'}`,
                    }} />
                    <div style={{
                      background: isDone ? '#f0fdf4' : '#fff7ed',
                      border: `1.5px solid ${isDone ? '#bbf7d0' : '#fed7aa'}`,
                      borderRadius: 10, padding: '10px 14px',
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{
                            fontSize: 11, fontWeight: 700,
                            background: isDone ? '#dcfce7' : '#ffedd5',
                            color: isDone ? '#16a34a' : '#ea580c',
                            padding: '2px 8px', borderRadius: 8,
                          }}>#{f.followup_number || i + 1}</span>
                          <span style={{ fontSize: 13, fontWeight: 700, color: '#1a1a1a' }}>{fmtDT(f.next_followup_at)}</span>
                        </div>
                        <span style={{
                          fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 8,
                          background: isDone ? '#f0fdf4' : '#fef9c3',
                          color: isDone ? '#16a34a' : '#ca8a04',
                          border: `1px solid ${isDone ? '#bbf7d0' : '#fde68a'}`,
                        }}>
                          {isDeleted ? '🗑 Deleted' : isDone ? '✓ Reminder Sent' : '⏳ Pending'}
                        </span>
                      </div>
                      {f.note && (
                        <p style={{ margin: '8px 0 0', fontSize: 13, color: '#374151', lineHeight: 1.5, background: 'rgba(255,255,255,0.6)', borderRadius: 6, padding: '6px 10px' }}>
                          💬 {f.note}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Summary footer */}
        {!loadingF && followups.length > 0 && (
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 16, padding: '12px 14px', background: '#f9f4ef', borderRadius: 10, border: '1.5px solid #f0e8de' }}>
            {[
              { label: 'Total', value: followups.length, color: '#ea580c' },
              { label: 'Reminded', value: followups.filter(f => f.reminder_sent).length, color: '#16a34a' },
              { label: 'Pending', value: followups.filter(f => !f.reminder_sent && !f.is_deleted).length, color: '#ca8a04' },
            ].map(({ label, value, color }) => (
              <div key={label} style={{ textAlign: 'center', flex: 1 }}>
                <div style={{ fontSize: 20, fontWeight: 800, color }}>{value}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>{label}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function BulkReportModal({ leads, onClose }) {
  const [followupsMap, setFollowupsMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState({});

  useEffect(() => {
    (async () => {
      const ids = leads.map(l => l.id);
      const { data } = await supabase
        .from('ttp_followups')
        .select('*')
        .in('lead_id', ids)
        .order('followup_number', { ascending: true });
      const map = {};
      (data || []).forEach(f => {
        if (!map[f.lead_id]) map[f.lead_id] = [];
        map[f.lead_id].push(f);
      });
      setFollowupsMap(map);
      // auto-expand all by default
      const exp = {};
      ids.forEach(id => { exp[id] = true; });
      setExpanded(exp);
      setLoading(false);
    })();
  }, [leads]);

  const fmtDT = (dt) => dt
    ? new Date(dt).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : '—';

  const PROGRAM_LABELS = {
    student_abacus_class: '🧮 Abacus Student',
    student_vedic_math: '🔢 Vedic Math',
    ttp_teacher_training: '👩‍🏫 TTP Training',
  };

  const totalFollowups = Object.values(followupsMap).reduce((s, arr) => s + arr.length, 0);
  const totalReminded  = Object.values(followupsMap).reduce((s, arr) => s + arr.filter(f => f.reminder_sent).length, 0);
  const totalPending   = Object.values(followupsMap).reduce((s, arr) => s + arr.filter(f => !f.reminder_sent && !f.is_deleted).length, 0);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 680, maxHeight: '92vh', overflowY: 'auto', padding: 0 }} onClick={e => e.stopPropagation()}>
        {/* Sticky header */}
        <div style={{ position: 'sticky', top: 0, zIndex: 10, background: '#fff', borderBottom: '1.5px solid #f0e8de', padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>📋 Bulk Report — {leads.length} Lead{leads.length !== 1 ? 's' : ''}</h3>
            {!loading && <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--text-muted)' }}>{totalFollowups} total follow-ups across all selected leads</p>}
          </div>
          <button className="modal-close" onClick={onClose}><MdClose /></button>
        </div>

        <div style={{ padding: '16px 20px' }}>
          {/* Overall summary */}
          {!loading && (
            <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
              {[
                { label: 'Leads Selected', value: leads.length, bg: '#fff7ed', color: '#ea580c', border: '#fed7aa' },
                { label: 'Total Follow-ups', value: totalFollowups, bg: '#eff6ff', color: '#2563eb', border: '#bfdbfe' },
                { label: 'Reminded', value: totalReminded, bg: '#f0fdf4', color: '#16a34a', border: '#bbf7d0' },
                { label: 'Pending', value: totalPending, bg: '#fef9c3', color: '#ca8a04', border: '#fde68a' },
              ].map(({ label, value, bg, color, border }) => (
                <div key={label} style={{ flex: 1, textAlign: 'center', background: bg, border: `1.5px solid ${border}`, borderRadius: 10, padding: '10px 6px' }}>
                  <div style={{ fontSize: 22, fontWeight: 800, color }}>{value}</div>
                  <div style={{ fontSize: 10, fontWeight: 700, color, opacity: 0.8, textTransform: 'uppercase' }}>{label}</div>
                </div>
              ))}
            </div>
          )}

          {loading ? (
            <div style={{ textAlign: 'center', padding: '30px 0', color: 'var(--text-muted)', fontSize: 14 }}>Loading follow-up history…</div>
          ) : (
            leads.map((lead, idx) => {
              const fups = followupsMap[lead.id] || [];
              const isOpen = expanded[lead.id];
              const st = STATUS_COLORS[lead.status] || STATUS_COLORS.new;
              return (
                <div key={lead.id} style={{ marginBottom: 12, border: '1.5px solid #f0e8de', borderRadius: 12, overflow: 'hidden' }}>
                  {/* Lead header row */}
                  <div
                    onClick={() => setExpanded(e => ({ ...e, [lead.id]: !e[lead.id] }))}
                    style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', background: '#fff7ed', cursor: 'pointer', userSelect: 'none' }}
                  >
                    <div style={{ width: 36, height: 36, borderRadius: 9, background: 'var(--gradient)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 14, fontWeight: 700, flexShrink: 0 }}>
                      {idx + 1}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: 14, color: '#1a1a1a' }}>{lead.name || '—'}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'monospace' }}>{lead.phone || '—'}{lead.city ? ` · ${lead.city}` : ''}</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                      <span style={{ fontSize: 11, background: st.bg, color: st.color, border: `1.5px solid ${st.border}`, padding: '2px 8px', borderRadius: 8, fontWeight: 700 }}>
                        {(lead.status || 'new').charAt(0).toUpperCase() + (lead.status || 'new').slice(1)}
                      </span>
                      <span style={{ fontSize: 11, fontWeight: 700, color: '#ea580c', background: '#ffedd5', padding: '2px 8px', borderRadius: 8 }}>
                        {fups.length} follow-up{fups.length !== 1 ? 's' : ''}
                      </span>
                      {isOpen ? <MdExpandLess size={18} style={{ color: 'var(--text-muted)' }} /> : <MdExpandMore size={18} style={{ color: 'var(--text-muted)' }} />}
                    </div>
                  </div>

                  {/* Followup timeline (collapsible) */}
                  {isOpen && (
                    <div style={{ padding: '12px 16px', background: '#fff' }}>
                      {fups.length === 0 ? (
                        <p style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', padding: '8px 0' }}>No follow-ups recorded.</p>
                      ) : (
                        <div style={{ position: 'relative', paddingLeft: 22 }}>
                          <div style={{ position: 'absolute', left: 7, top: 0, bottom: 0, width: 2, background: '#fed7aa', borderRadius: 2 }} />
                          {fups.map((f, fi) => {
                            const isDone = f.reminder_sent;
                            return (
                              <div key={f.id} style={{ position: 'relative', marginBottom: 10 }}>
                                <div style={{ position: 'absolute', left: -19, top: 7, width: 10, height: 10, borderRadius: '50%', background: isDone ? '#16a34a' : '#ea580c', border: '2px solid #fff', boxShadow: `0 0 0 2px ${isDone ? '#bbf7d0' : '#fed7aa'}` }} />
                                <div style={{ background: isDone ? '#f0fdf4' : '#fff7ed', border: `1.5px solid ${isDone ? '#bbf7d0' : '#fed7aa'}`, borderRadius: 8, padding: '8px 12px' }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 4 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                      <span style={{ fontSize: 10, fontWeight: 700, background: isDone ? '#dcfce7' : '#ffedd5', color: isDone ? '#16a34a' : '#ea580c', padding: '1px 6px', borderRadius: 6 }}>#{f.followup_number || fi + 1}</span>
                                      <span style={{ fontSize: 12, fontWeight: 700 }}>{fmtDT(f.next_followup_at)}</span>
                                    </div>
                                    <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 6, background: isDone ? '#f0fdf4' : '#fef9c3', color: isDone ? '#16a34a' : '#ca8a04', border: `1px solid ${isDone ? '#bbf7d0' : '#fde68a'}` }}>
                                      {f.is_deleted ? '🗑 Deleted' : isDone ? '✓ Reminded' : '⏳ Pending'}
                                    </span>
                                  </div>
                                  {f.note && <p style={{ margin: '6px 0 0', fontSize: 12, color: '#374151', lineHeight: 1.5 }}>💬 {f.note}</p>}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                      <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid #f0e8de', display: 'flex', gap: 8, fontSize: 11, color: 'var(--text-muted)', flexWrap: 'wrap' }}>
                        <span>📧 {lead.email || '—'}</span>
                        <span>🏷 {PROGRAM_LABELS[lead.lead_program] || lead.lead_program || '—'}</span>
                        <span>📌 {lead.source || '—'}</span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

function AddLeadModal({ onClose, onAdd }) {
  const [form, setForm] = useState({ name: '', phone: '', email: '', city: '', source: 'manual', lead_program: 'student_abacus_class', campaign: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.phone.trim()) return;
    setSaving(true); setError('');
    try { const lead = await createLead(form); onAdd(lead); onClose(); }
    catch (err) { setError(err.message); setSaving(false); }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Add New Lead</h3>
          <button className="modal-close" onClick={onClose}><MdClose /></button>
        </div>
        {error && <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 8, padding: '10px 14px', marginBottom: 14, fontSize: 13, color: '#dc2626' }}>⚠️ {error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="form-grid">
            <div className="form-group">
              <label>Full Name *</label>
              <input className="form-input" placeholder="Enter full name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
            </div>
            <div className="form-group">
              <label>Phone *</label>
              <input className="form-input" placeholder="10-digit mobile" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} required maxLength={15} />
            </div>
            <div className="form-group">
              <label>Email</label>
              <input type="email" className="form-input" placeholder="email@example.com" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
            </div>
            <div className="form-group">
              <label>City</label>
              <input className="form-input" placeholder="City name" value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} />
            </div>
            <div className="form-group">
              <label>Source</label>
              <select className="form-input" value={form.source} onChange={e => setForm(f => ({ ...f, source: e.target.value }))}>
                <option value="manual">✏️ Manual</option>
                <option value="boosted_campaign">📢 Boosted Campaign</option>
                <option value="landing_page">🌐 Landing Page</option>
                <option value="website">💻 Website</option>
                <option value="intrakt">💬 WhatsApp</option>
              </select>
            </div>
            <div className="form-group">
              <label>Program</label>
              <select className="form-input" value={form.lead_program} onChange={e => setForm(f => ({ ...f, lead_program: e.target.value }))}>
                <option value="student_abacus_class">🧮 Abacus Student</option>
                <option value="student_vedic_math">🔢 Vedic Math Student</option>
                <option value="ttp_teacher_training">👩‍🏫 TTP Teacher Training</option>
              </select>
            </div>
          </div>
          <div className="form-actions" style={{ marginTop: 20 }}>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving...' : 'Add Lead'}</button>
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={saving}>Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function LeadsPage() {
  const { userId, isAdmin, loading: authLoading } = useAuth();
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [programFilter, setProgramFilter] = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [followupLead, setFollowupLead] = useState(null);
  const [reportLead, setReportLead] = useState(null);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [showBulkReport, setShowBulkReport] = useState(false);

  const toggleSelect = (id) => setSelectedIds(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const toggleSelectAll = () => {
    if (selectedIds.size === filtered.length && filtered.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map(l => l.id)));
    }
  };

  const fetchLeads = useCallback(async () => {
    if (authLoading) return;
    setLoading(true); setError('');
    let query = supabase
      .from('ttp_leads')
      .select('id, name, phone, email, city, source, lead_program, status, assigned_user_id, created_at, ttp_followups(id, followup_number, reminder_sent)')
      .eq('is_deleted', false)
      .order('created_at', { ascending: false })
      .limit(300);
    if (!isAdmin && userId) {
      query = query.eq('assigned_user_id', userId);
    }
    const { data, error: err } = await query;
    setLoading(false);
    if (err) { setError(err.message); return; }
    setLeads(data || []);
  }, [userId, isAdmin, authLoading]);

  const handleDeleteLead = async (leadId, leadName) => {
    if (!window.confirm(`Delete lead "${leadName}"? This cannot be undone.`)) return;
    try {
      await softDeleteLead(leadId);
      setLeads(prev => prev.filter(l => l.id !== leadId));
    } catch (err) { alert('Delete failed: ' + err.message); }
  };

  useEffect(() => {
    fetchLeads();
    const ch = supabase
      .channel('leads_page')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ttp_leads' }, () => fetchLeads())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ttp_followups' }, () => fetchLeads())
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, [fetchLeads]);

  const handleStatusUpdate = (leadId, newStatus) => {
    setLeads(prev => prev.map(l => l.id === leadId ? { ...l, status: newStatus } : l));
  };

  const counts = STATUS_OPTIONS.reduce((acc, s) => { acc[s] = leads.filter(l => l.status === s).length; return acc; }, { all: leads.length });

  const filtered = leads.filter(l => {
    const q = search.toLowerCase();
    const matchSearch = !q || (l.name || '').toLowerCase().includes(q) || (l.phone || '').includes(q) || (l.city || '').toLowerCase().includes(q) || (l.email || '').toLowerCase().includes(q);
    const matchStatus = statusFilter === 'all' || l.status === statusFilter;
    const matchProgram = programFilter === 'all' || l.lead_program === programFilter;
    return matchSearch && matchStatus && matchProgram;
  });

  const cities = [...new Set(leads.map(l => l.city).filter(Boolean))].sort();

  return (
    <div>
      {/* Program filter */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginRight: 2 }}>PROGRAM:</span>
        {[{ key: 'all', label: 'All Programs' }, { key: 'student_abacus_class', label: '🧮 Abacus' }, { key: 'student_vedic_math', label: '🔢 Vedic Math' }, { key: 'ttp_teacher_training', label: '👩‍🏫 TTP Training' }].map(({ key, label }) => {
          const active = programFilter === key;
          const cnt = key === 'all' ? leads.length : leads.filter(l => l.lead_program === key).length;
          return (
            <button key={key} onClick={() => setProgramFilter(key)} style={{
              padding: '5px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer',
              border: active ? 'none' : '1.5px solid var(--border)',
              background: active ? 'var(--gradient)' : '#fff',
              color: active ? '#fff' : 'var(--text-muted)',
              boxShadow: active ? '0 2px 8px rgba(255,102,0,0.15)' : 'none',
            }}>
              {label} <span style={{ opacity: 0.7 }}>{cnt}</span>
            </button>
          );
        })}
      </div>

      {/* Status pill filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
        {[{ key: 'all', label: 'All' }, ...STATUS_OPTIONS.map(s => ({ key: s, label: s.charAt(0).toUpperCase() + s.slice(1) }))].map(({ key, label }) => {
          const cnt = counts[key] ?? 0;
          const active = statusFilter === key;
          const c = key === 'all' ? null : STATUS_COLORS[key];
          return (
            <button key={key} onClick={() => setStatusFilter(key)} style={{
              padding: '7px 16px', borderRadius: 20, fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s',
              border: active ? 'none' : `1.5px solid ${c ? c.border : 'var(--border)'}`,
              background: active ? (c ? c.bg : 'var(--gradient)') : '#fff',
              color: active ? (c ? c.color : '#fff') : 'var(--text-muted)',
              boxShadow: active ? '0 2px 8px rgba(255,102,0,0.15)' : 'none',
            }}>
              {label} <span style={{ opacity: 0.7, marginLeft: 2 }}>{cnt}</span>
            </button>
          );
        })}
      </div>

      <div className="content-card">
        <div className="section-header" style={{ marginBottom: 16 }}>
          <div>
            <h2>Leads</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>{loading ? 'Loading from database...' : `${filtered.length} of ${leads.length} leads`}</p>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn btn-secondary btn-sm" onClick={fetchLeads} disabled={loading}><MdRefresh /> Refresh</button>
            <button className="btn btn-primary" onClick={() => setShowModal(true)}><MdAdd /> Add Lead</button>
          </div>
        </div>

        {error && (
          <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 10, padding: '12px 16px', marginBottom: 16, fontSize: 13, color: '#dc2626', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>⚠️ {error}</span>
            <button className="btn btn-secondary btn-sm" onClick={fetchLeads}>Retry</button>
          </div>
        )}

        <div className="toolbar" style={{ marginBottom: 16 }}>
          <div className="search-input-wrapper" style={{ flex: 1 }}>
            <MdSearch className="search-icon" />
            <input className="search-input" placeholder="Search name, phone, city, email..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          {search && <button className="btn btn-secondary btn-sm" onClick={() => setSearch('')}><MdClose /> Clear</button>}
        </div>

        {/* Bulk action bar */}
        {selectedIds.size > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', background: '#eff6ff', border: '1.5px solid #bfdbfe', borderRadius: 10, marginBottom: 14, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#2563eb' }}>{selectedIds.size} lead{selectedIds.size !== 1 ? 's' : ''} selected</span>
            <button
              className="btn btn-primary btn-sm"
              onClick={() => setShowBulkReport(true)}
              style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#2563eb', color: '#fff', border: 'none' }}
            >
              <MdAssignment size={15} /> Bulk Report
            </button>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => setSelectedIds(new Set())}
              style={{ marginLeft: 'auto' }}
            >
              <MdClose size={13} /> Clear
            </button>
          </div>
        )}

        {cities.length > 0 && (
          <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, alignSelf: 'center' }}>CITIES:</span>
            {cities.slice(0, 10).map(city => (
              <button key={city} onClick={() => setSearch(search === city ? '' : city)} style={{
                padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, cursor: 'pointer',
                border: '1.5px solid #f0e8de', background: search === city ? '#fff7ed' : '#fff',
                color: search === city ? '#ea580c' : 'var(--text-muted)',
              }}>{city}</button>
            ))}
          </div>
        )}

        {/* ── Desktop table ── */}
        <div className="table-wrapper leads-table-view">
          {loading ? (
            <div style={{ padding: '24px 0' }}>
              {[1,2,3,4,5].map(i => (
                <div key={i} style={{ display: 'flex', gap: 16, padding: '12px 16px', borderBottom: '1px solid #f9f0e8' }}>
                  <div className="skeleton" style={{ width: 34, height: 34, borderRadius: 8 }} />
                  <div style={{ flex: 1, display: 'flex', gap: 16, alignItems: 'center' }}>
                    {[20, 14, 22, 10, 12, 16].map((w, j) => <div key={j} className="skeleton" style={{ width: `${w}%`, height: 14, borderRadius: 6 }} />)}
                  </div>
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">{leads.length === 0 ? '📋' : '🔍'}</div>
              <p>{leads.length === 0 ? 'No leads yet. Add your first lead!' : 'No leads match the current filter.'}</p>
            </div>
          ) : (
            <table className="crm-table">
              <thead>
                <tr>
                  <th style={{ width: 36, textAlign: 'center', cursor: 'pointer' }} onClick={toggleSelectAll}>
                    {selectedIds.size === 0
                      ? <MdCheckBoxOutlineBlank size={18} style={{ color: 'var(--text-muted)', verticalAlign: 'middle' }} />
                      : selectedIds.size === filtered.length
                        ? <MdCheckBox size={18} style={{ color: '#2563eb', verticalAlign: 'middle' }} />
                        : <MdIndeterminateCheckBox size={18} style={{ color: '#2563eb', verticalAlign: 'middle' }} />}
                  </th>
                  <th style={{ width: 32 }}>#</th><th>Name</th><th>Phone</th><th style={{ maxWidth: 110 }}>Email</th><th>City</th><th>Source</th><th>Program</th><th>Follow-ups</th><th>Status</th><th>Added</th><th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((lead, i) => {
                  const followupCount = lead.ttp_followups?.length || 0;
                  const hasPending = lead.ttp_followups?.some(f => !f.reminder_sent);
                  return (
                    <tr key={lead.id} style={{ background: selectedIds.has(lead.id) ? '#eff6ff' : undefined }}>
                      <td style={{ textAlign: 'center', cursor: 'pointer', paddingRight: 0 }} onClick={() => toggleSelect(lead.id)}>
                        {selectedIds.has(lead.id)
                          ? <MdCheckBox size={17} style={{ color: '#2563eb', verticalAlign: 'middle' }} />
                          : <MdCheckBoxOutlineBlank size={17} style={{ color: '#d1d5db', verticalAlign: 'middle' }} />}
                      </td>
                      <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>{i + 1}</td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                          <div style={{ width: 28, height: 28, borderRadius: 8, background: 'var(--gradient)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 12, fontWeight: 700, flexShrink: 0 }}>
                            {(lead.name || '?').charAt(0).toUpperCase()}
                          </div>
                          <span style={{ fontWeight: 600, fontSize: 13 }}>{lead.name || '—'}</span>
                        </div>
                      </td>
                      <td><div style={{ display: 'flex', alignItems: 'center', gap: 5, fontFamily: 'monospace', fontSize: 13 }}><MdPhone size={13} style={{ color: 'var(--text-muted)' }} />{lead.phone || '—'}</div></td>
                      <td style={{ fontSize: 11, color: 'var(--text-muted)', maxWidth: 110, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {lead.email ? <a href={`mailto:${lead.email}`} style={{ color: '#2563eb', textDecoration: 'none' }}>{lead.email}</a> : '—'}
                      </td>
                      <td style={{ fontSize: 13 }}>{lead.city || '—'}</td>
                      <td><SourceBadge source={lead.source} /></td>
                      <td><ProgramBadge program={lead.lead_program} /></td>
                      <td>
                        <button onClick={() => setFollowupLead(lead)} style={{
                          display: 'flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 20,
                          border: `1.5px solid ${followupCount > 0 ? '#fed7aa' : '#e5e7eb'}`, background: followupCount > 0 ? '#fff7ed' : '#f9fafb',
                          color: followupCount > 0 ? '#ea580c' : 'var(--text-muted)', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                        }}>
                          <MdCalendarToday size={12} />{followupCount}/3
                          {hasPending && <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#ea580c', flexShrink: 0 }} />}
                        </button>
                      </td>
                      <td><StatusBadge status={lead.status || 'new'} leadId={lead.id} onUpdated={handleStatusUpdate} /></td>
                      <td style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                        {(() => { const { shortDT, relative } = formatIST(lead.created_at); return (
                          <div title={shortDT}>
                            <div style={{ fontWeight: 600, color: 'var(--text-dark)', fontSize: 11 }}>{shortDT}</div>
                            <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{relative}</div>
                          </div>
                        ); })()}
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'nowrap', alignItems: 'center' }}>
                          <button
                            className="btn btn-sm"
                            title="Lead Report"
                            onClick={() => setReportLead(lead)}
                            style={{ background: '#eff6ff', color: '#2563eb', border: '1.5px solid #bfdbfe', padding: '4px 6px' }}
                          >
                            <MdAssignment size={14} />
                          </button>
                          <button
                            className="btn btn-sm"
                            title="Add Follow-up"
                            onClick={() => setFollowupLead(lead)}
                            style={{ background: '#fff7ed', color: '#ea580c', border: '1.5px solid #fed7aa', padding: '4px 6px' }}
                          >
                            <MdCalendarToday size={14} />
                          </button>
                          {lead.phone && (
                            <button className="btn btn-whatsapp btn-sm" title="WhatsApp" style={{ padding: '4px 6px' }}
                              onClick={() => { window.location.href = `/whatsapp?name=${encodeURIComponent(lead.name)}&phone=${encodeURIComponent(lead.phone)}&template=0`; }}>
                              <FaWhatsapp size={14} />
                            </button>
                          )}
                          {lead.phone && <SmartfloCallButton phone={lead.phone} />}
                          <button
                            className="btn btn-sm"
                            title="Delete Lead"
                            onClick={() => handleDeleteLead(lead.id, lead.name)}
                            style={{ background: '#fef2f2', color: '#dc2626', border: '1.5px solid #fecaca', padding: '4px 6px' }}
                          >
                            <MdDelete size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* ── Mobile cards ── */}
        <div className="leads-mobile-cards">
          {loading ? (
            [1,2,3,4].map(i => (
              <div key={i} className="skeleton" style={{ height: 110, borderRadius: 12 }} />
            ))
          ) : filtered.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">{leads.length === 0 ? '📋' : '🔍'}</div>
              <p>{leads.length === 0 ? 'No leads yet. Add your first lead!' : 'No leads match the current filter.'}</p>
            </div>
          ) : (
            filtered.map((lead, i) => {
              const followupCount = lead.ttp_followups?.length || 0;
              const hasPending = lead.ttp_followups?.some(f => !f.reminder_sent);
              const { shortDT } = formatIST(lead.created_at);
              return (
                <div key={lead.id} className="lead-mobile-card" style={{ outline: selectedIds.has(lead.id) ? '2px solid #2563eb' : undefined }}>
                  {/* Card header */}
                  <div className="lead-card-header">
                    <div
                      onClick={() => toggleSelect(lead.id)}
                      style={{ cursor: 'pointer', paddingRight: 6, flexShrink: 0, display: 'flex', alignItems: 'center' }}
                    >
                      {selectedIds.has(lead.id)
                        ? <MdCheckBox size={20} style={{ color: '#2563eb' }} />
                        : <MdCheckBoxOutlineBlank size={20} style={{ color: '#d1d5db' }} />}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
                      <div style={{ width: 38, height: 38, borderRadius: 10, background: 'var(--gradient)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 15, fontWeight: 700, flexShrink: 0 }}>
                        {(lead.name || '?').charAt(0).toUpperCase()}
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-dark)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{lead.name || '—'}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'monospace' }}>{lead.phone || '—'}</div>
                      </div>
                    </div>
                    <StatusBadge status={lead.status || 'new'} leadId={lead.id} onUpdated={handleStatusUpdate} />
                  </div>

                  {/* Card meta row */}
                  <div className="lead-card-meta">
                    {lead.city && <span className="lead-card-meta-pill">📍 {lead.city}</span>}
                    <ProgramBadge program={lead.lead_program} />
                    <SourceBadge source={lead.source} />
                    <span style={{ fontSize: 10, color: 'var(--text-muted)', marginLeft: 'auto' }}>{shortDT}</span>
                  </div>

                  {/* Card actions */}
                  <div className="lead-card-actions">
                    <button                      className="btn btn-sm"
                      title="Lead Report"
                      onClick={() => setReportLead(lead)}
                      style={{ background: '#eff6ff', color: '#2563eb', border: '1.5px solid #bfdbfe', padding: '6px 10px' }}
                    >
                      <MdAssignment size={16} />
                    </button>
                    <button                      className="btn btn-secondary btn-sm"
                      style={{ flex: 1, justifyContent: 'center' }}
                      onClick={() => setFollowupLead(lead)}
                    >
                      <MdCalendarToday size={13} />
                      <span>Follow-up</span>
                      <span style={{ background: followupCount > 0 ? '#fed7aa' : '#e5e7eb', color: followupCount > 0 ? '#ea580c' : 'var(--text-muted)', borderRadius: 8, padding: '1px 6px', fontSize: 10, fontWeight: 700 }}>
                        {followupCount}/3{hasPending && ' •'}
                      </span>
                    </button>
                    {lead.phone && (
                      <button
                        className="btn btn-whatsapp btn-sm"
                        title="WhatsApp"
                        onClick={() => { window.location.href = `/whatsapp?name=${encodeURIComponent(lead.name)}&phone=${encodeURIComponent(lead.phone)}&template=0`; }}
                      >
                        <FaWhatsapp size={16} />
                      </button>
                    )}
                    {lead.phone && <SmartfloCallButton phone={lead.phone} />}
                    <button
                      className="btn btn-sm"
                      title="Delete Lead"
                      onClick={() => handleDeleteLead(lead.id, lead.name)}
                      style={{ background: '#fef2f2', color: '#dc2626', border: '1.5px solid #fecaca', padding: '6px 10px' }}
                    >
                      <MdDelete size={16} />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {showModal && <AddLeadModal onClose={() => setShowModal(false)} onAdd={(lead) => setLeads(ls => [{ ...lead, ttp_followups: [] }, ...ls])} />}
      {followupLead && <FollowupModal lead={followupLead} onClose={() => setFollowupLead(null)} />}
      {reportLead && <LeadReportModal lead={reportLead} onClose={() => setReportLead(null)} />}
      {showBulkReport && (
        <BulkReportModal
          leads={filtered.filter(l => selectedIds.has(l.id))}
          onClose={() => setShowBulkReport(false)}
        />
      )}
    </div>
  );
}
