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
    meetingLink: '',
    meetingType: 'orientation',
    meetingProgram: 'ttp_teacher_training',
  });
  const [error, setError] = useState('');
  
  // Modal for adding leads to an existing meeting
  const [addLeadsModal, setAddLeadsModal] = useState({ open: false, meetingId: null, selectedLeadIds: [] });
  // Modal for viewing leads
  const [viewLeadsModal, setViewLeadsModal] = useState({ open: false, leads: [] });
  // Attendance modal
  const [attendanceModal, setAttendanceModal] = useState({ open: false, meeting: null });
  const [attendanceRows, setAttendanceRows] = useState([]);
  const [attendanceLoading, setAttendanceLoading] = useState(false);
  const [attendanceSaving, setAttendanceSaving] = useState(false);
  // Real-time tick (60s — matches cron cadence)
  const [tick, setTick] = useState(Date.now());
  const [editingMeeting, setEditingMeeting] = useState(null); // The meeting object being edited
  // Reminder stats (live count from ttp_meeting_notifications)
  const [reminderSentCount, setReminderSentCount] = useState(0);

  const fetchAll = async () => {
    setLoading(true);
    const [leadRes, meetRes, notifRes] = await Promise.all([
      supabase.from('ttp_leads').select('id, name, phone, email').order('name'),
      supabase
        .from('ttp_meetings')
        .select('*, ttp_meeting_leads(ttp_leads(id, name, phone))')
        .eq('is_deleted', false)
        .order('meeting_datetime', { ascending: true }),
      supabase
        .from('ttp_meeting_notifications')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'sent'),
    ]);
    setLoading(false);
    if (!leadRes.error) setLeads(leadRes.data || []);
    if (!meetRes.error) setMeetings(meetRes.data || []);
    setReminderSentCount(notifRes.count || 0);
  };

  useEffect(() => {
    fetchAll();
    const ch = supabase
      .channel('meetings_page_rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ttp_meetings' }, () => fetchAll())
      .subscribe();

    // Also subscribe to ttp_meeting_notifications so stats update the moment cron sends a reminder
    const chNotif = supabase
      .channel('meeting_notifs_rt')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'ttp_meeting_notifications' }, () => fetchAll())
      .subscribe();

    // Tick every 60s — recalculates countdown timers and meeting status live
    const interval = setInterval(() => setTick(Date.now()), 60000);

    return () => {
      supabase.removeChannel(ch);
      supabase.removeChannel(chNotif);
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
        hostName: hostLead?.name || '',
        hostPhone: hostLead?.phone || '',
        traineeEmails,
        userName: (firstTrainee || hostLead)?.name || 'Lead',
        userPhone: (firstTrainee || hostLead)?.phone || '',
        meetingType: form.meetingType,
        meetingProgram: form.meetingProgram,
      });
      setForm({ hostLeadId: '', traineeLeadIds: [], leadIds: [], meetingDatetime: '', meetingLink: '', meetingType: 'orientation', meetingProgram: 'ttp_teacher_training' });
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

  const openAttendance = async (meeting) => {
    setAttendanceModal({ open: true, meeting });
    setAttendanceLoading(true);
    setAttendanceRows([]);
    const { data, error } = await supabase
      .from('meeting_attendance')
      .select('*')
      .eq('meeting_id', meeting.id)
      .order('user_name');
    setAttendanceLoading(false);
    if (!error) setAttendanceRows(data || []);
  };

  const saveAttendance = async () => {
    setAttendanceSaving(true);
    for (const row of attendanceRows) {
      await supabase
        .from('meeting_attendance')
        .update({ status: row.status, marked_at: row.status === 'present' ? new Date().toISOString() : null })
        .eq('id', row.id);
    }
    setAttendanceSaving(false);
  };

  const getMeetingStatus = (dt, _tick) => {
    const meetingTime = new Date(dt);
    const now = new Date();
    // Use true minutes difference (meetingTime and now are properly evaluated with local vs UTC logic correctly since format is IS0/UTC)
    const diff = (meetingTime - now) / 60000;

    if (diff > 0) return "Upcoming";
    if (diff <= 0 && diff > -60) return "In Progress";
    return "Completed";
  };

  // tick is referenced here so React re-evaluates status every 60s
  const upcomingMs = meetings.filter((m) => {
    const s = getMeetingStatus(m.meeting_datetime, tick);
    return s === "Upcoming" || s === "In Progress";
  });
  const pastMs = meetings.filter((m) => getMeetingStatus(m.meeting_datetime, tick) === "Completed");

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
                      <label>Meeting Type *</label>
                      <select
                        className="form-input"
                        value={form.meetingType}
                        onChange={(e) => setForm(f => ({ ...f, meetingType: e.target.value }))}
                        required
                      >
                        <option value="orientation">👋 Orientation Training</option>
                        <option value="marketing">📈 Marketing Session</option>
                        <option value="doubt">❓ Doubt Clearing</option>
                      </select>
                    </div>
                    <div className="form-group">
                      <label>Training Program *</label>
                      <select
                        className="form-input"
                        value={form.meetingProgram}
                        onChange={(e) => setForm(f => ({ ...f, meetingProgram: e.target.value }))}
                        required
                      >
                        <option value="ttp_teacher_training">🎓 TTP Teacher Training</option>
                        <option value="abacus">🧮 Abacus Teacher Training</option>
                        <option value="vedic_math">📐 Vedic Math Teacher Training</option>
                      </select>
                    </div>
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
                <button type="button" className="btn btn-secondary" onClick={() => { setShowForm(false); setEditingMeeting(null); setForm({ hostLeadId: '', traineeLeadIds: [], leadIds: [], meetingDatetime: '', meetingLink: '', meetingType: 'orientation', meetingProgram: 'ttp_teacher_training' }); }}>
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
              const status = getMeetingStatus(m.meeting_datetime, tick);
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
                    {/* Reminder badge strip — updates in real-time as cron fires */}
                    <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', marginTop: 5 }}>
                      {[
                        { key: 'reminder_3day_sent',  label: '3D' },
                        { key: 'reminder_2day_sent',  label: '2D' },
                        { key: 'reminder_1day_sent',  label: '1D' },
                        { key: 'reminder_1hour_sent', label: '1hr' },
                        { key: 'reminder_30_sent',    label: '30m' },
                        { key: 'reminder_15_sent',    label: '15m' },
                        { key: 'reminder_5_sent',     label: '5m'  },
                      ].map(r => (
                        <span key={r.key} title={r.key.replace('reminder_','').replace('_sent','') + ' reminder'} style={{
                          fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 4,
                          background: m[r.key] ? '#dcfce7' : '#f3f4f6',
                          color: m[r.key] ? '#16a34a' : '#9ca3af',
                          border: `1px solid ${m[r.key] ? '#bbf7d0' : '#e5e7eb'}`,
                        }}>
                          {r.label} {m[r.key] ? '✓' : '○'}
                        </span>
                      ))}
                    </div>
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
                      onClick={() => openAttendance(m)}
                      title="View Attendance"
                    >
                      📋 Attendance
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
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Meeting Stats</h2>
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              fontSize: 10, fontWeight: 700, color: '#16a34a',
              background: 'rgba(22,163,74,0.1)', borderRadius: 20, padding: '2px 8px',
            }}>
              <span style={{
                width: 6, height: 6, borderRadius: '50%', background: '#16a34a',
                animation: 'pulse 2s infinite',
              }} />
              LIVE
            </span>
          </div>
          <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.3}}`}</style>
          {[
            { label: 'Total Scheduled', value: meetings.length, color: 'var(--primary)' },
            { label: 'Upcoming', value: upcomingMs.length, color: '#2563eb' },
            { label: 'Completed', value: pastMs.length, color: '#16a34a' },
            { label: 'Reminders Sent', value: reminderSentCount, color: '#ca8a04' },
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
                    className="btn btn-secondary btn-sm"
                    onClick={() => openAttendance(m)}
                    style={{ fontSize: 11, padding: '3px 8px' }}
                  >
                    📋
                  </button>
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

      {/* ── ATTENDANCE MODAL ── */}
      {attendanceModal.open && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 600, maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }}>
            {/* Header */}
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #f3f4f6', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>📋 Attendance Sheet</h3>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                  {attendanceModal.meeting?.meeting_topic || 'Meeting'}
                  {' · '}
                  {attendanceModal.meeting?.meeting_datetime
                    ? new Date(attendanceModal.meeting.meeting_datetime).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })
                    : ''}
                </div>
              </div>
              <button onClick={() => setAttendanceModal({ open: false, meeting: null })} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: 'var(--text-muted)', lineHeight: 1 }}>✕</button>
            </div>

            {/* Summary badges */}
            {!attendanceLoading && attendanceRows.length > 0 && (() => {
              const present = attendanceRows.filter(r => r.status === 'present').length;
              const absent  = attendanceRows.filter(r => r.status === 'absent').length;
              const total   = attendanceRows.length;
              const pct     = total > 0 ? Math.round((present / total) * 100) : 0;
              return (
                <div style={{ display: 'flex', gap: 12, padding: '16px 24px', borderBottom: '1px solid #f3f4f6', flexWrap: 'wrap' }}>
                  {[
                    { label: 'Total',   value: total,     color: '#3b82f6' },
                    { label: 'Present', value: present,   color: '#16a34a' },
                    { label: 'Absent',  value: absent,    color: '#dc2626' },
                    { label: 'Att. %',  value: `${pct}%`, color: pct >= 75 ? '#16a34a' : pct >= 50 ? '#f59e0b' : '#dc2626' },
                  ].map(s => (
                    <div key={s.label} style={{ flex: 1, minWidth: 70, textAlign: 'center', background: '#f8fafc', borderRadius: 10, padding: '10px 8px' }}>
                      <div style={{ fontWeight: 800, fontSize: 22, color: s.color }}>{s.value}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>{s.label}</div>
                    </div>
                  ))}
                </div>
              );
            })()}

            {/* Table */}
            <div style={{ overflowY: 'auto', flex: 1, padding: '0 24px' }}>
              {attendanceLoading ? (
                <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--text-muted)' }}>Loading…</div>
              ) : attendanceRows.length === 0 ? (
                <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--text-muted)' }}>
                  <p style={{ fontSize: 32, margin: 0 }}>📭</p>
                  <p style={{ marginTop: 8 }}>No attendance records for this meeting yet.</p>
                  <p style={{ fontSize: 12 }}>Records are seeded when a meeting is created via the Admin Meeting Scheduler.</p>
                </div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 4 }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid #f3f4f6' }}>
                      <th style={{ textAlign: 'left', padding: '10px 8px', fontSize: 11, color: 'var(--text-muted)', fontWeight: 700 }}>#</th>
                      <th style={{ textAlign: 'left', padding: '10px 8px', fontSize: 11, color: 'var(--text-muted)', fontWeight: 700 }}>Name</th>
                      <th style={{ textAlign: 'left', padding: '10px 8px', fontSize: 11, color: 'var(--text-muted)', fontWeight: 700 }}>Email</th>
                      <th style={{ textAlign: 'center', padding: '10px 8px', fontSize: 11, color: 'var(--text-muted)', fontWeight: 700 }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {attendanceRows.map((r, i) => (
                      <tr key={r.id} style={{ borderBottom: '1px solid #f9f0e8' }}>
                        <td style={{ padding: '10px 8px', fontSize: 12, color: 'var(--text-muted)' }}>{i + 1}</td>
                        <td style={{ padding: '10px 8px', fontWeight: 700, fontSize: 13 }}>{r.user_name}</td>
                        <td style={{ padding: '10px 8px', fontSize: 12, color: '#2563eb' }}>{r.user_email || '—'}</td>
                        <td style={{ padding: '10px 8px', textAlign: 'center' }}>
                          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                            <input
                              type="checkbox"
                              checked={r.status === 'present'}
                              onChange={() => setAttendanceRows(prev =>
                                prev.map(row => row.id === r.id
                                  ? { ...row, status: row.status === 'present' ? 'absent' : 'present' }
                                  : row
                                )
                              )}
                            />
                            <span style={{
                              fontSize: 11, fontWeight: 700, padding: '2px 10px', borderRadius: 10,
                              background: r.status === 'present' ? '#f0fdf4' : '#fef2f2',
                              color:      r.status === 'present' ? '#16a34a' : '#dc2626',
                            }}>
                              {r.status === 'present' ? '✅ Present' : '❌ Absent'}
                            </span>
                          </label>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Footer */}
            {!attendanceLoading && attendanceRows.length > 0 && (
              <div style={{ padding: '16px 24px', borderTop: '1px solid #f3f4f6', display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button className="btn btn-secondary" onClick={() => setAttendanceModal({ open: false, meeting: null })}>Close</button>
                <button className="btn btn-primary" onClick={saveAttendance} disabled={attendanceSaving}>
                  {attendanceSaving ? 'Saving…' : '💾 Save Attendance'}
                </button>
              </div>
            )}
            {!attendanceLoading && attendanceRows.length === 0 && (
              <div style={{ padding: '16px 24px', borderTop: '1px solid #f3f4f6', display: 'flex', justifyContent: 'flex-end' }}>
                <button className="btn btn-secondary" onClick={() => setAttendanceModal({ open: false, meeting: null })}>Close</button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
