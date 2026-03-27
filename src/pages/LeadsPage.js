import React, { useState, useEffect, useRef } from 'react';
import { MdSearch, MdAdd, MdClose, MdRefresh, MdPhone, MdCalendarToday, MdExpandMore, MdExpandLess, MdDelete } from 'react-icons/md';
import { FaWhatsapp } from 'react-icons/fa';
import { supabase } from '../supabaseClient';
import { createLead, updateLeadStatus, addFollowup, softDeleteLead } from '../api';
import { formatIST } from '../utils/time';
import { SourceBadge } from '../utils/sourceBadge';

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

function AddLeadModal({ onClose, onAdd }) {
  const [form, setForm] = useState({ name: '', phone: '', email: '', city: '', source: 'manual' });
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
                <option value="landing_page">🌐 Landing Page</option>
                <option value="website">💻 Website</option>
                <option value="intrakt">💬 WhatsApp</option>
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
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [followupLead, setFollowupLead] = useState(null);

  const fetchLeads = async () => {
    setLoading(true); setError('');
    const { data, error: err } = await supabase
      .from('ttp_leads')
      .select('*, ttp_followups(id, followup_number, next_followup_at, status, reminder_sent, dismissed, is_deleted)')
      .eq('is_deleted', false)
      .order('created_at', { ascending: false });
    setLoading(false);
    if (err) { setError(err.message); return; }
    setLeads(data || []);
  };

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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleStatusUpdate = (leadId, newStatus) => {
    setLeads(prev => prev.map(l => l.id === leadId ? { ...l, status: newStatus } : l));
  };

  const counts = STATUS_OPTIONS.reduce((acc, s) => { acc[s] = leads.filter(l => l.status === s).length; return acc; }, { all: leads.length });

  const filtered = leads.filter(l => {
    const q = search.toLowerCase();
    const matchSearch = !q || (l.name || '').toLowerCase().includes(q) || (l.phone || '').includes(q) || (l.city || '').toLowerCase().includes(q) || (l.email || '').toLowerCase().includes(q);
    const matchStatus = statusFilter === 'all' || l.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const cities = [...new Set(leads.map(l => l.city).filter(Boolean))].sort();

  return (
    <div>
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

        <div className="table-wrapper">
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
                  <th>#</th><th>Name</th><th>Phone</th><th>Email</th><th>City</th><th>Source</th><th>Follow-ups</th><th>Status</th><th>Added</th><th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((lead, i) => {
                  const followupCount = lead.ttp_followups?.length || 0;
                  const hasPending = lead.ttp_followups?.some(f => !f.reminder_sent);
                  return (
                    <tr key={lead.id}>
                      <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>{i + 1}</td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{ width: 34, height: 34, borderRadius: 9, background: 'var(--gradient)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 13, fontWeight: 700, flexShrink: 0 }}>
                            {(lead.name || '?').charAt(0).toUpperCase()}
                          </div>
                          <span style={{ fontWeight: 600, fontSize: 14 }}>{lead.name || '—'}</span>
                        </div>
                      </td>
                      <td><div style={{ display: 'flex', alignItems: 'center', gap: 5, fontFamily: 'monospace', fontSize: 13 }}><MdPhone size={13} style={{ color: 'var(--text-muted)' }} />{lead.phone || '—'}</div></td>
                      <td style={{ fontSize: 12, color: 'var(--text-muted)', maxWidth: 130, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {lead.email ? <a href={`mailto:${lead.email}`} style={{ color: '#2563eb', textDecoration: 'none' }}>{lead.email}</a> : '—'}
                      </td>
                      <td style={{ fontSize: 13 }}>{lead.city || '—'}</td>
                      <td><SourceBadge source={lead.source} /></td>
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
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button className="btn btn-secondary btn-sm" onClick={() => setFollowupLead(lead)}>+ Follow-up</button>
                          {lead.phone && (
                            <button className="btn btn-whatsapp btn-sm" title="WhatsApp"
                              onClick={() => { const msg = encodeURIComponent(`Hello ${lead.name}! 👋\nThank you for your interest in Shraddha Institute.\n– Team Shraddha`); window.open(`https://wa.me/91${lead.phone}?text=${msg}`, '_blank', 'noopener,noreferrer'); }}>
                              <FaWhatsapp />
                            </button>
                          )}
                          <button
                            className="btn btn-sm"
                            title="Delete Lead"
                            onClick={() => handleDeleteLead(lead.id, lead.name)}
                            style={{ background: '#fef2f2', color: '#dc2626', border: '1.5px solid #fecaca', padding: '4px 8px' }}
                          >
                            <MdDelete />
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
      </div>

      {showModal && <AddLeadModal onClose={() => setShowModal(false)} onAdd={(lead) => setLeads(ls => [{ ...lead, ttp_followups: [] }, ...ls])} />}
      {followupLead && <FollowupModal lead={followupLead} onClose={() => setFollowupLead(null)} />}
    </div>
  );
}
