import React, { useState, useEffect } from 'react';
import { MdEvent, MdAdd, MdClose, MdVideocam, MdDelete, MdRefresh, MdPhone } from 'react-icons/md';
import { FaWhatsapp } from 'react-icons/fa';
import { supabase } from '../supabaseClient';
import { scheduleMeeting, deleteMeeting as deleteMeetingApi, addLeadsToMeeting, updateMeeting } from '../api';
import { formatIST } from '../utils/time';

function formatDateTime(dt) {
  if (!dt) return '—';
  return formatIST(dt).exact;
}

export default function MeetingsPage() {
  const [leads, setLeads] = useState([]);
  const [meetings, setMeetings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ 
    hostLeadId: '', 
    traineeLeadIds: [],
    leadIds: [],        // used only in edit mode (populated from existing meeting)
    meetingDatetime: '', 
    meetingLink: '' 
  });
  const [error, setError] = useState('');
  
  // Modal for adding leads to an existing meeting
  const [addLeadsModal, setAddLeadsModal] = useState({ open: false, meetingId: null, selectedLeadIds: [] });
  // Modal for viewing leads
  const [viewLeadsModal, setViewLeadsModal] = useState({ open: false, leads: [] });
  // Real-time tick
  const [tick, setTick] = useState(Date.now());
  const [editingMeeting, setEditingMeeting] = useState(null); // The meeting object being edited

  const fetchAll = async () => {
    setLoading(true);
    const [leadRes, meetRes] = await Promise.all([
      supabase.from('ttp_leads').select('id, name, phone, email').order('name'),
      supabase
        .from('ttp_meetings')
        .select('*, ttp_meeting_leads(ttp_leads(id, name, phone))')
        .eq('is_deleted', false)
        .order('meeting_datetime', { ascending: true }),
    ]);
    setLoading(false);
    if (!leadRes.error) setLeads(leadRes.data || []);
    if (!meetRes.error) setMeetings(meetRes.data || []);
  };

  useEffect(() => {
    fetchAll();
    const ch = supabase
      .channel('meetings_page_rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ttp_meetings' }, () => fetchAll())
      .subscribe();
      
    const interval = setInterval(() => setTick(Date.now()), 30000); // 30s refresh
    
    return () => {
      supabase.removeChannel(ch);
      clearInterval(interval);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.hostLeadId || !form.meetingDatetime) return;
    setSaving(true);
    setError('');
    try {
      // Build full participant list: host + trainees (deduplicated)
      const computedLeadIds = [...new Set([form.hostLeadId, ...form.traineeLeadIds].filter(Boolean))];

      const hostLead = leads.find(l => l.id === form.hostLeadId);
      const firstTrainee = leads.find(l => l.id === form.traineeLeadIds[0]);
      
      const traineeEmails = leads
        .filter(l => form.traineeLeadIds.includes(l.id))
        .map(l => l.email)
        .filter(Boolean);

      await scheduleMeeting({
        leadIds: computedLeadIds,
        meetingDatetime: form.meetingDatetime,
        meetingLink: form.meetingLink,
        hostEmail: hostLead?.email || null,
        traineeEmails,
        userName: (firstTrainee || hostLead)?.name || 'Lead',
        userPhone: (firstTrainee || hostLead)?.phone || '',
      });
      setForm({ hostLeadId: '', traineeLeadIds: [], leadIds: [], meetingDatetime: '', meetingLink: '' });
      setShowForm(false);
      fetchAll();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (form.leadIds.length === 0 || !form.meetingDatetime) return;
    setSaving(true);
    setError('');
    try {
      await updateMeeting({
        meetingId: editingMeeting.id,
        leadIds: form.leadIds,
        meetingDatetime: form.meetingDatetime,
        meetingLink: form.meetingLink,
      });
      setForm({ leadIds: [], hostLeadId: '', traineeLeadIds: [], meetingDatetime: '', meetingLink: '' });
      setEditingMeeting(null);
      fetchAll();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const openEdit = (m) => {
    setEditingMeeting(m);
    const dt = new Date(m.meeting_datetime);
    const istOffset = 5.5 * 60 * 60 * 1000;
    const istTime = new Date(dt.getTime() + istOffset);
    const localStr = istTime.toISOString().slice(0, 16);
    
    setForm({
      hostLeadId: '',
      traineeLeadIds: [],
      leadIds: m.ttp_meeting_leads?.map(ml => ml.ttp_leads?.id).filter(Boolean) || [],
      meetingDatetime: localStr,
      meetingLink: m.meeting_link || ''
    });
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this meeting?')) return;
    await deleteMeetingApi(id);
    setMeetings((ms) => ms.filter((m) => m.id !== id));
  };

  const handleAddLeadsSubmit = async (e) => {
    e.preventDefault();
    if (!addLeadsModal.meetingId || addLeadsModal.selectedLeadIds.length === 0) return;
    setSaving(true);
    try {
      await addLeadsToMeeting(addLeadsModal.meetingId, addLeadsModal.selectedLeadIds);
      setAddLeadsModal({ open: false, meetingId: null, selectedLeadIds: [] });
      fetchAll();
    } catch (err) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  const getMeetingStatus = (dt) => {
    const meetingTime = new Date(dt);
    const now = new Date();
    // Use true minutes difference (meetingTime and now are properly evaluated with local vs UTC logic correctly since format is IS0/UTC)
    const diff = (meetingTime - now) / 60000;

    if (diff > 0) return "Upcoming";
    if (diff <= 0 && diff > -60) return "In Progress";
    return "Completed";
  };

  const upcomingMs = meetings.filter((m) => {
    const s = getMeetingStatus(m.meeting_datetime);
    return s === "Upcoming" || s === "In Progress";
  });
  const pastMs = meetings.filter((m) => getMeetingStatus(m.meeting_datetime) === "Completed");

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 20 }} className="meetings-layout">
      <style>{`@media(max-width:900px){.meetings-layout{grid-template-columns:1fr!important}}`}</style>

      {/* ── LEFT ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* Schedule Form Card */}
        <div className="content-card">
          <div className="section-header">
            <div>
              <h2>Schedule Meeting</h2>
              <p>Book a meeting with a lead</p>
            </div>
            <button className="btn btn-primary btn-sm" onClick={() => setShowForm(!showForm)}>
              {showForm ? <MdClose /> : <MdAdd />} {showForm ? 'Close' : 'New Meeting'}
            </button>
          </div>

          {showForm && (
            <form onSubmit={editingMeeting ? handleEditSubmit : handleSubmit} style={{ animation: 'fadeInUp 0.3s ease', marginTop: 16 }}>
              {error && (
                <div style={{
                  background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)',
                  borderRadius: 8, padding: '10px 14px', marginBottom: 14, fontSize: 13, color: '#dc2626',
                }}>
                  {error}
                </div>
              )}
              <h3>{editingMeeting ? 'Reschedule Meeting' : 'Schedule New Meeting'}</h3>
              <div className="form-grid">
                {editingMeeting ? (
                  /* ── EDIT MODE: single participants multi-select ── */
                  <div className="form-group" style={{ gridColumn: 'span 2' }}>
                    <label>Participants <small style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(Hold Ctrl to select multiple)</small></label>
                    <select
                      multiple
                      className="form-input"
                      value={form.leadIds}
                      onChange={(e) => {
                        const vals = Array.from(e.target.selectedOptions, o => o.value);
                        setForm(f => ({ ...f, leadIds: vals }));
                      }}
                      style={{ height: '110px' }}
                    >
                      {leads.map(l => (
                        <option key={l.id} value={l.id}>
                          {l.name}{l.phone ? ` — ${l.phone}` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  /* ── NEW MEETING MODE: Host + Trainees ── */
                  <>
                    <div className="form-group">
                      <label>Organizing Host *</label>
                      <select
                        className="form-input"
                        value={form.hostLeadId}
                        onChange={(e) => {
                          const id = e.target.value;
                          setForm(f => ({
                            ...f,
                            hostLeadId: id,
                            traineeLeadIds: f.traineeLeadIds.filter(lid => lid !== id),
                          }));
                        }}
                        required
                      >
                        <option value="">-- Select Host --</option>
                        {leads.map(l => (
                          <option key={l.id} value={l.id}>
                            {l.name}{l.phone ? ` (${l.phone})` : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="form-group">
                      <label>Trainees / Attendees <small style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(Hold Ctrl to select multiple)</small></label>
                      <select
                        multiple
                        className="form-input"
                        value={form.traineeLeadIds}
                        onChange={(e) => {
                          const vals = Array.from(e.target.selectedOptions, o => o.value);
                          setForm(f => ({ ...f, traineeLeadIds: vals }));
                        }}
                        style={{ height: '110px' }}
                      >
                        {leads.filter(l => l.id !== form.hostLeadId).map(l => (
                          <option key={l.id} value={l.id}>
                            {l.name}{l.phone ? ` — ${l.phone}` : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                    {/* Preview: show which leads will be linked */}
                    {(form.hostLeadId || form.traineeLeadIds.length > 0) && (
                      <div style={{
                        gridColumn: 'span 2',
                        padding: '8px 12px',
                        background: 'rgba(234,88,12,0.06)',
                        borderRadius: 8,
                        fontSize: 12,
                        color: 'var(--text-muted)',
                        lineHeight: 1.8,
                      }}>
                        <span style={{ fontWeight: 600, color: 'var(--primary)' }}>Will be linked: </span>
                        {[form.hostLeadId, ...form.traineeLeadIds].filter(Boolean).map(id => {
                          const l = leads.find(x => x.id === id);
                          return l ? (
                            <span key={id} style={{
                              display: 'inline-flex', alignItems: 'center', gap: 4,
                              background: '#fff', border: '1px solid rgba(234,88,12,0.3)',
                              borderRadius: 12, padding: '1px 8px', marginRight: 6, color: '#ea580c',
                            }}>
                              {id === form.hostLeadId ? '👤 ' : '🎓 '}{l.name}
                            </span>
                          ) : null;
                        })}
                      </div>
                    )}
                  </>
                )}
                <div className="form-group">
                  <label>Date &amp; Time *</label>
                  <input
                    type="datetime-local"
                    className="form-input"
                    value={form.meetingDatetime}
                    onChange={(e) => setForm(f => ({ ...f, meetingDatetime: e.target.value }))}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Meet / Zoom Link <small style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(auto-generated if blank)</small></label>
                  <input
                    className="form-input"
                    placeholder="https://meet.google.com/..."
                    value={form.meetingLink}
                    onChange={(e) => setForm(f => ({ ...f, meetingLink: e.target.value }))}
                  />
                </div>
              </div>
              <div className="form-actions">
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  <MdEvent /> {saving ? 'Saving…' : (editingMeeting ? 'Update Meeting' : 'Schedule Meeting')}
                </button>
                <button type="button" className="btn btn-secondary" onClick={() => { setShowForm(false); setEditingMeeting(null); setForm({ hostLeadId: '', traineeLeadIds: [], leadIds: [], meetingDatetime: '', meetingLink: '' }); }}>
                  Cancel
                </button>
              </div>
            </form>
          )}

          {!showForm && (
            <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-muted)' }}>
              <MdEvent style={{ fontSize: 40, opacity: 0.3 }} />
              <p style={{ marginTop: 8, fontSize: 14 }}>Click "New Meeting" to schedule a session</p>
            </div>
          )}
        </div>

        {/* Upcoming Meetings */}
        <div className="content-card">
          <div className="section-header">
            <div>
              <h2>Upcoming &amp; Ongoing</h2>
              <p>{upcomingMs.length} active meetings</p>
            </div>
            <button className="btn btn-secondary btn-sm" onClick={fetchAll} disabled={loading}>
              <MdRefresh /> Refresh
            </button>
          </div>

          {loading ? (
            [1, 2, 3].map((i) => (
              <div key={i} style={{ display: 'flex', gap: 12, padding: '14px 0', borderBottom: '1px solid #f9f0e8', alignItems: 'center' }}>
                <div className="skeleton" style={{ width: 44, height: 44, borderRadius: 12, flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div className="skeleton" style={{ width: '40%', height: 13, borderRadius: 4, marginBottom: 6 }} />
                  <div className="skeleton" style={{ width: '60%', height: 11, borderRadius: 4 }} />
                </div>
              </div>
            ))
          ) : upcomingMs.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">📅</div>
              <p>No active meetings. Schedule one above.</p>
            </div>
          ) : (
            upcomingMs.map((m) => {
              const meetingLeads = m.ttp_meeting_leads || [];
              const status = getMeetingStatus(m.meeting_datetime);
              const now = new Date();
              const diffMin = Math.round((new Date(m.meeting_datetime) - now) / 60000);
              const soon = diffMin <= 30 && diffMin > 0;
              
              const statusColor = status === "In Progress" ? "#ea580c" : "#2563eb";
              
              return (
                <div
                  key={m.id}
                  className="meeting-item"
                  style={{ borderLeft: soon ? '3px solid #ea580c' : '3px solid transparent' }}
                >
                  <div
                    className="meeting-avatar"
                    style={soon ? { background: '#fff7ed', color: '#ea580c' } : {}}
                  >
                    <MdEvent />
                  </div>
                  <div className="meeting-info">
                    <h4>
                      {meetingLeads.length === 0
                        ? 'No Leads'
                        : meetingLeads.slice(0, 3).map(ml => ml.ttp_leads?.name).filter(Boolean).join(', ')}
                      {meetingLeads.length > 3 ? ` +${meetingLeads.length - 3} more` : ''}
                    </h4>
                    
                    <span style={{ 
                      display: 'inline-block', padding: '2px 8px', borderRadius: '12px',
                      fontSize: '11px', fontWeight: 'bold', background: `${statusColor}22`, color: statusColor,
                      marginBottom: '4px'
                    }}>
                      {status}
                    </span>

                    <p>🕐 {formatDateTime(m.meeting_datetime)}</p>
                    {soon && (
                      <p style={{ color: '#ea580c', fontWeight: 700, fontSize: 12 }}>
                        Starting in {diffMin} min
                      </p>
                    )}
                    {m.meeting_link && (
                      <a
                        href={m.meeting_link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="meeting-link"
                      >
                        <MdVideocam style={{ verticalAlign: 'middle' }} /> Join Meeting
                      </a>
                    )}
                  </div>
                  <div className="meeting-actions">
                    <button 
                      className="btn btn-secondary btn-sm"
                      onClick={() => setViewLeadsModal({ open: true, leads: meetingLeads })}
                    >
                      View Leads
                    </button>
                    <button 
                      className="btn btn-secondary btn-sm"
                      onClick={() => setAddLeadsModal({ open: true, meetingId: m.id, selectedLeadIds: [] })}
                    >
                      <MdAdd /> Add
                    </button>
                    <button 
                      className="btn btn-secondary btn-sm"
                      onClick={() => openEdit(m)}
                    >
                      Edit
                    </button>
                    <button
                      className="btn btn-danger btn-icon btn-sm"
                      onClick={() => handleDelete(m.id)}
                      title="Delete"
                    >
                      <MdDelete />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ── RIGHT ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* Stats */}
        <div className="content-card">
          <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>Meeting Stats</h2>
          {[
            { label: 'Total Scheduled', value: meetings.length, color: 'var(--primary)' },
            { label: 'Upcoming', value: upcomingMs.length, color: '#2563eb' },
            { label: 'Completed', value: pastMs.length, color: '#16a34a' },
            { label: '30m Reminders Sent', value: meetings.filter((m) => m.reminder_30_sent).length, color: '#ca8a04' },
          ].map((s) => (
            <div
              key={s.label}
              style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '12px 0', borderBottom: '1px solid #f9f0e8',
              }}
            >
              <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{s.label}</span>
              <span style={{ fontSize: 20, fontWeight: 800, color: s.color }}>{s.value}</span>
            </div>
          ))}
        </div>

        {/* Past Meetings */}
        {pastMs.length > 0 && (
          <div className="content-card">
            <div className="section-header">
              <h2>Completed Meetings</h2>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{pastMs.length} done</span>
            </div>
            {pastMs.slice(0, 10).map((m) => {
              const meetingLeads = m.ttp_meeting_leads || [];
              return (
                <div
                  key={m.id}
                  style={{
                    padding: '12px 0', borderBottom: '1px solid #f9f0e8',
                    display: 'flex', alignItems: 'center', gap: 12,
                  }}
                >
                  <div style={{
                    width: 36, height: 36, borderRadius: 10,
                    background: 'rgba(16,185,129,0.1)', display: 'flex',
                    alignItems: 'center', justifyContent: 'center',
                    color: '#16a34a', fontSize: 16, flexShrink: 0,
                  }}>
                    ✓
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{meetingLeads.length} Lead(s)</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      {formatDateTime(m.meeting_datetime)}
                    </div>
                  </div>
                  <button
                    className="btn btn-danger btn-icon btn-sm"
                    onClick={() => handleDelete(m.id)}
                    title="Delete"
                    style={{ padding: '4px', minWidth: 'auto' }}
                  >
                    <MdDelete size={14} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* MODALS */}
      {viewLeadsModal.open && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', padding: 24, borderRadius: 12, width: '90%', maxWidth: 400 }}>
            <h3>Meeting Leads</h3>
            <ul style={{ margin: '16px 0', paddingLeft: 20 }}>
              {viewLeadsModal.leads.map(ml => {
                const l = ml.ttp_leads || {};
                return (
                  <li key={l.id || Math.random()} style={{ marginBottom: 8 }}>
                    <strong>{l.name}</strong> {l.phone ? `(${l.phone})` : ''}
                  </li>
                );
              })}
            </ul>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={() => setViewLeadsModal({ open: false, leads: [] })}>Close</button>
            </div>
          </div>
        </div>
      )}

      {addLeadsModal.open && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', padding: 24, borderRadius: 12, width: '90%', maxWidth: 400 }}>
            <h3>Add Leads to Meeting</h3>
            <form onSubmit={handleAddLeadsSubmit} style={{ marginTop: 16 }}>
              <div className="form-group">
                <label>Select Additional Leads</label>
                <select
                  multiple
                  className="form-input"
                  style={{ height: 120 }}
                  value={addLeadsModal.selectedLeadIds}
                  onChange={(e) => {
                    const vals = Array.from(e.target.selectedOptions, option => option.value);
                    setAddLeadsModal(m => ({ ...m, selectedLeadIds: vals }));
                  }}
                  required
                >
                  {leads.map(l => (
                    <option key={l.id} value={l.id}>{l.name}</option>
                  ))}
                </select>
              </div>
              <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 16 }}>
                <button type="button" className="btn btn-secondary" onClick={() => setAddLeadsModal({ open: false, meetingId: null, selectedLeadIds: [] })}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Adding...' : 'Add Leads'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
