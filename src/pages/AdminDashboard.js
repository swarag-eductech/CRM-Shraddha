import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import { MdEvent, MdPeople, MdSchool, MdRefresh, MdBarChart, MdAssignment, MdCheckCircle, MdCancel } from 'react-icons/md';
import { SourceBadge, ProgramBadge } from '../utils/sourceBadge';
import { getCRMUsers, getLeadsForAdmin, updateCRMUserRole, reassignLead, createCRMUser } from '../api';
import { useAuth } from '../hooks/useAuth';

// ── Meeting type config ─────────────────────────────────────────────────────
const MEETING_TYPES = [
  { value: 'orientation', label: '👋 Orientation Training',  color: '#2563eb', bg: '#eff6ff' },
  { value: 'marketing',   label: '📈 Marketing Session',    color: '#d97706', bg: '#fffbeb' },
  { value: 'doubt',       label: '❓ Doubt Clearing',       color: '#dc2626', bg: '#fef2f2' },
];
const MEETING_PROGRAMS = [
  { value: 'ttp_teacher_training', label: '🎓 TTP Teacher Training' },
  { value: 'abacus',               label: '🧮 Abacus Teacher Training' },
  { value: 'vedic_math',           label: '📐 Vedic Math Teacher Training' },
];

export default function AdminDashboard() {
  const { userId, userName } = useAuth();
  const [tab, setTab] = useState('leads');

  // All Leads state
  const [leads, setLeads] = useState([]);
  const [crmUsers, setCrmUsers] = useState([]);
  const [leadsLoading, setLeadsLoading] = useState(true);
  const [srcFilter, setSrcFilter] = useState('all');
  const [progFilter, setProgFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [campaignFilter, setCampaignFilter] = useState('');
  const [reassigning, setReassigning] = useState(null);
  const [userFilter, setUserFilter] = useState('all');
  const [expandedUserId, setExpandedUserId] = useState(null);

  // Users state
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [newUser, setNewUser] = useState({ name: '', email: '', password: '', role: 'user' });
  const [creatingUser, setCreatingUser] = useState(false);
  const [createUserMsg, setCreateUserMsg] = useState({ type: '', text: '' });

  // Meeting scheduler state
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [form, setForm] = useState({
    meetingDate: '', meetingTime: '', duration: 30, hostEmail: '',
    traineeEmails: [],
    meetingType: 'orientation',
    meetingProgram: 'ttp_teacher_training',
    meetingTopic: '',
  });

  // Attendance tab state
  const [attendanceMeetings, setAttendanceMeetings] = useState([]);
  const [selectedMeeting, setSelectedMeeting] = useState(null);
  const [attendanceRows, setAttendanceRows] = useState([]);
  const [attendanceLoading, setAttendanceLoading] = useState(false);
  const [attendanceSaving, setAttendanceSaving] = useState(false);

  const fetchData = useCallback(async () => {
    setLeadsLoading(true);
    const [leadsResult, usersResult] = await Promise.allSettled([
      getLeadsForAdmin(),
      getCRMUsers(),
    ]);
    if (leadsResult.status === 'fulfilled') setLeads(leadsResult.value);
    else console.error('getLeadsForAdmin error:', leadsResult.reason);
    if (usersResult.status === 'fulfilled') setCrmUsers(usersResult.value);
    else console.error('getCRMUsers error:', usersResult.reason);
    setLeadsLoading(false);
  }, []);

  // Fetch teacher-training meetings for attendance tab
  const fetchAttendanceMeetings = useCallback(async () => {
    const { data } = await supabase
      .from('ttp_meetings')
      .select('id, meeting_datetime, meeting_type, meeting_program, meeting_topic, host_name, created_by_name')
      .eq('is_deleted', false)
      .in('meeting_program', ['ttp_teacher_training', 'abacus', 'vedic_math'])
      .order('meeting_datetime', { ascending: false })
      .limit(50);
    setAttendanceMeetings(data || []);
  }, []);

  const fetchAttendanceForMeeting = useCallback(async (meetingId) => {
    setAttendanceLoading(true);
    setSelectedMeeting(meetingId);
    const { data } = await supabase
      .from('meeting_attendance')
      .select('*')
      .eq('meeting_id', meetingId)
      .order('user_name');
    setAttendanceRows(data || []);
    setAttendanceLoading(false);
  }, []);

  const saveAttendance = async () => {
    if (!selectedMeeting || attendanceRows.length === 0) return;
    setAttendanceSaving(true);
    const now = new Date().toISOString();
    const updates = attendanceRows.map(r => ({
      id:         r.id,
      meeting_id: r.meeting_id,
      user_id:    r.user_id,
      user_name:  r.user_name,
      user_email: r.user_email,
      status:     r.status,
      marked_at:  r.status === 'present' ? (r.marked_at || now) : null,
    }));
    const { error } = await supabase.from('meeting_attendance').upsert(updates, { onConflict: 'id' });
    setAttendanceSaving(false);
    if (error) alert('Save failed: ' + error.message);
  };

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => { if (tab === 'attendance') fetchAttendanceMeetings(); }, [tab, fetchAttendanceMeetings]);

  // Filtered leads
  const filteredLeads = leads.filter(l => {
    const matchSrc  = srcFilter === 'all' || l.source === srcFilter;
    const matchProg = progFilter === 'all' || l.lead_program === progFilter;
    const matchStat = statusFilter === 'all' || l.status === statusFilter;
    const matchCamp = !campaignFilter || (l.campaign_name || '').toLowerCase().includes(campaignFilter.toLowerCase());
    const matchUser = userFilter === 'all'
      ? true
      : userFilter === 'unclaimed'
      ? !l.assigned_user_id
      : l.assigned_user_id === userFilter;
    return matchSrc && matchProg && matchStat && matchCamp && matchUser;
  });

  // Performance report
  const report = crmUsers.map(u => {
    const ul = leads.filter(l => l.assigned_user_id === u.id);
    return {
      ...u,
      total:     ul.length,
      converted: ul.filter(l => l.status === 'converted').length,
      warm:      ul.filter(l => l.status === 'warm').length,
      pending:   ul.filter(l => l.status === 'new' || l.status === 'contacted').length,
    };
  });

  const unclaimedCount = leads.filter(l => !l.assigned_user_id).length;
  const sources = [...new Set(leads.map(l => l.source).filter(Boolean))];
  const statuses = ['new', 'contacted', 'warm', 'converted', 'lost'];

  const fmtDate = (dt) => dt ? new Date(dt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '—';

  const handleReassign = async (leadId, newUserId) => {
    setReassigning(leadId);
    try {
      await reassignLead(leadId, newUserId === '' ? null : newUserId);
      await fetchData();
    } catch (err) { alert('Reassign failed: ' + err.message); }
    finally { setReassigning(null); }
  };

  const handleRoleChange = async (userId, newRole) => {
    try {
      await updateCRMUserRole(userId, newRole);
      setCrmUsers(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u));
    } catch (err) { alert('Role update failed: ' + err.message); }
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    setCreatingUser(true);
    setCreateUserMsg({ type: '', text: '' });
    try {
      const result = await createCRMUser(newUser);
      setCreateUserMsg({ type: 'success', text: `✅ User "${result.user.name}" created! Email: ${result.user.email}` });
      setNewUser({ name: '', email: '', password: '', role: 'user' });
      setShowCreateUser(false);
      await fetchData();
    } catch (err) {
      setCreateUserMsg({ type: 'error', text: err.message });
    } finally {
      setCreatingUser(false);
    }
  };

  // Meeting submit (original logic preserved + new type/program fields)
  const handleMeetingSubmit = async (e) => {
    e.preventDefault();
    if (!form.hostEmail || !form.meetingDate || !form.meetingTime) {
      setMessage({ type: 'error', text: 'All required fields must be filled.' });
      return;
    }
    setSaving(true); setMessage({ type: '', text: '' });
    try {
      // Build attendees list (host + trainees) for attendance seeding
      const hostLead = meetingLeads.find(l => l.email === form.hostEmail);
      const traineeLists = form.traineeEmails.map(email => ({
        user_name: meetingLeads.find(l => l.email === email)?.name || email,
        user_email: email,
      }));
      const attendees = [
        { user_name: hostLead?.name || form.hostEmail, user_email: form.hostEmail },
        ...traineeLists,
      ];

      const { data, error } = await supabase.functions.invoke('create-meeting', {
        body: {
          userName: userName || 'Admin', userPhone: '0000000000',
          meetingDate: form.meetingDate, meetingTime: form.meetingTime,
          duration: Number(form.duration), hostEmail: form.hostEmail,
          traineeEmails: form.traineeEmails,
          // ── New fields ──────────────────────────────────────
          meetingType:    form.meetingType,
          meetingProgram: form.meetingProgram,
          meetingTopic:   form.meetingTopic,
          hostName:       hostLead?.name || form.hostEmail,
          hostPhone:      hostLead?.phone || '',
          createdById:    userId || null,
          createdByName:  userName || 'Admin',
          attendees,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setMessage({ type: 'success', text: 'Meeting scheduled! Attendance sheet created.' });
      setForm({ meetingDate: '', meetingTime: '', duration: 30, hostEmail: '', traineeEmails: [], meetingType: 'orientation', meetingProgram: 'ttp_teacher_training', meetingTopic: '' });
    } catch (err) { setMessage({ type: 'error', text: err.message }); }
    finally { setSaving(false); }
  };

  const meetingLeads = leads.filter(l => l.email);

  const TABS = [
    { key: 'leads',      label: '📋 All Leads' },
    { key: 'users',      label: '👥 Users' },
    { key: 'report',     label: '📊 Performance' },
    { key: 'meeting',    label: '📅 Meeting Scheduler' },
    { key: 'attendance', label: '✅ Attendance' },
  ];

  return (
    <div>
      {/* Title */}
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ margin: 0, fontWeight: 800 }}>Admin Control Panel</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: '4px 0 0' }}>
          Manage leads, users, performance reports and meeting scheduling
        </p>
      </div>

      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 24 }}>
        {[
          { label: 'Total Leads',    value: leads.length,                                    color: '#3b82f6' },
          { label: 'Unclaimed Pool', value: unclaimedCount,                                  color: '#f59e0b' },
          { label: 'Converted',      value: leads.filter(l => l.status === 'converted').length, color: '#10b981' },
          { label: 'CRM Users',      value: crmUsers.length,                                 color: '#8b5cf6' },
        ].map(({ label, value, color }) => (
          <div key={label} className="content-card" style={{ padding: '16px 20px', textAlign: 'center' }}>
            <div style={{ fontSize: 28, fontWeight: 800, color }}>{value}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 700 }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        {TABS.map(({ key, label }) => (
          <button key={key} onClick={() => setTab(key)} style={{
            padding: '8px 20px', borderRadius: 24, fontSize: 13, fontWeight: 700, cursor: 'pointer',
            border: 'none',
            background: tab === key ? 'var(--gradient)' : '#f3f4f6',
            color: tab === key ? '#fff' : 'var(--text-muted)',
            boxShadow: tab === key ? '0 2px 8px rgba(255,102,0,0.2)' : 'none',
          }}>{label}</button>
        ))}
      </div>

      {/* ── ALL LEADS TAB ── */}
      {tab === 'leads' && (
        <div className="content-card">
          {/* Filters */}
          <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
            <button className="btn btn-secondary btn-sm" onClick={fetchData} disabled={leadsLoading}><MdRefresh /> Refresh</button>
            <select className="form-input" style={{ width: 'auto', fontSize: 12 }} value={srcFilter} onChange={e => setSrcFilter(e.target.value)}>
              <option value="all">All Sources</option>
              {sources.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <select className="form-input" style={{ width: 'auto', fontSize: 12 }} value={progFilter} onChange={e => setProgFilter(e.target.value)}>
              <option value="all">All Programs</option>
              <option value="student_abacus_class">🧮 Abacus Student</option>
              <option value="ttp_teacher_training">👩‍🏫 TTP Teacher</option>
            </select>
            <select className="form-input" style={{ width: 'auto', fontSize: 12 }} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
              <option value="all">All Statuses</option>
              {statuses.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
            </select>
            <input className="form-input" placeholder="Search campaign…" style={{ width: 160, fontSize: 12 }} value={campaignFilter} onChange={e => setCampaignFilter(e.target.value)} />
            <select className="form-input" style={{ width: 'auto', fontSize: 12 }} value={userFilter} onChange={e => setUserFilter(e.target.value)}>
              <option value="all">All Users</option>
              <option value="unclaimed">⏳ Unclaimed</option>
              {crmUsers.map(u => <option key={u.id} value={u.id}>👤 {u.name}</option>)}
            </select>
            <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 'auto' }}>{filteredLeads.length} leads</span>
          </div>

          {leadsLoading ? (
            <div style={{ padding: '32px 0', textAlign: 'center', color: 'var(--text-muted)' }}>Loading…</div>
          ) : (
            <div className="table-wrapper">
              <table className="crm-table">
                <thead>
                  <tr>
                    <th>#</th><th>Name</th><th>Phone</th><th>Source</th><th>Program</th>
                    <th>Campaign</th><th>Status</th><th>Assigned To</th><th>Claimed</th><th>Reassign</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLeads.map((lead, i) => (
                    <tr key={lead.id}>
                      <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{i + 1}</td>
                      <td style={{ fontWeight: 600, fontSize: 14 }}>{lead.name || '—'}</td>
                      <td style={{ fontFamily: 'monospace', fontSize: 13 }}>{lead.phone || '—'}</td>
                      <td><SourceBadge source={lead.source} /></td>
                      <td><ProgramBadge program={lead.lead_program} /></td>
                      <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{lead.campaign_name || '—'}</td>
                      <td>
                        <span style={{
                          fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 12,
                          background: { new:'#fff7ed', contacted:'#eff6ff', warm:'#fef9c3', converted:'#f0fdf4', lost:'#fef2f2' }[lead.status] || '#f3f4f6',
                          color:      { new:'#ea580c', contacted:'#2563eb', warm:'#ca8a04', converted:'#16a34a', lost:'#dc2626' }[lead.status] || '#6b7280',
                        }}>
                          {lead.status || 'new'}
                        </span>
                      </td>
                      <td style={{ fontSize: 12 }}>
                        {lead.crm_users
                          ? <span style={{ fontWeight: 600, color: '#1d4ed8' }}>{lead.crm_users.name}</span>
                          : <span style={{ color: '#f59e0b', fontWeight: 600, fontSize: 11 }}>⏳ Unclaimed</span>
                        }
                      </td>
                      <td style={{ fontSize: 11, color: 'var(--text-muted)' }}>{fmtDate(lead.claimed_at)}</td>
                      <td>
                        <select
                          style={{ fontSize: 11, borderRadius: 8, border: '1.5px solid #e5e7eb', padding: '4px 8px', cursor: 'pointer', minWidth: 120 }}
                          value={lead.assigned_user_id || ''}
                          disabled={reassigning === lead.id}
                          onChange={e => handleReassign(lead.id, e.target.value)}
                        >
                          <option value="">⏳ Unassigned</option>
                          {crmUsers.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                        </select>
                      </td>
                    </tr>
                  ))}
                  {filteredLeads.length === 0 && (
                    <tr><td colSpan={10} style={{ textAlign: 'center', padding: 24, color: 'var(--text-muted)' }}>No leads match current filters.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── USERS TAB ── */}
      {tab === 'users' && (
        <div>
          {/* Create User Form */}
          <div className="content-card" style={{ marginBottom: 20 }}>
            <div className="section-header" style={{ marginBottom: showCreateUser ? 20 : 0 }}>
              <div>
                <h3 style={{ margin: 0 }}>Create New User</h3>
                <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: '4px 0 0' }}>Add a login for a new team member</p>
              </div>
              <button className="btn btn-primary" onClick={() => { setShowCreateUser(s => !s); setCreateUserMsg({ type: '', text: '' }); }}>
                {showCreateUser ? '✕ Cancel' : '+ Create User'}
              </button>
            </div>

            {createUserMsg.text && (
              <div style={{ padding: '10px 14px', borderRadius: 8, marginBottom: 14, fontSize: 13, fontWeight: 600,
                background: createUserMsg.type === 'success' ? '#f0fdf4' : '#fef2f2',
                color:      createUserMsg.type === 'success' ? '#16a34a' : '#dc2626',
                border:    `1px solid ${createUserMsg.type === 'success' ? '#bbf7d0' : '#fecaca'}`,
              }}>
                {createUserMsg.text}
              </div>
            )}

            {showCreateUser && (
              <form onSubmit={handleCreateUser}>
                <div className="form-grid">
                  <div className="form-group">
                    <label>Full Name *</label>
                    <input className="form-input" placeholder="e.g. Priya Sharma" value={newUser.name} onChange={e => setNewUser(u => ({ ...u, name: e.target.value }))} required />
                  </div>
                  <div className="form-group">
                    <label>Email *</label>
                    <input type="email" className="form-input" placeholder="priya@example.com" value={newUser.email} onChange={e => setNewUser(u => ({ ...u, email: e.target.value }))} required />
                  </div>
                  <div className="form-group">
                    <label>Password *</label>
                    <input type="password" className="form-input" placeholder="Min 6 characters" minLength={6} value={newUser.password} onChange={e => setNewUser(u => ({ ...u, password: e.target.value }))} required />
                  </div>
                  <div className="form-group">
                    <label>Role *</label>
                    <select className="form-input" value={newUser.role} onChange={e => setNewUser(u => ({ ...u, role: e.target.value }))}>
                      <option value="user">👤 User (can see own leads only)</option>
                      <option value="admin">👑 Admin (full access)</option>
                    </select>
                  </div>
                </div>
                <div style={{ marginTop: 16, display: 'flex', gap: 10 }}>
                  <button type="submit" className="btn btn-primary" disabled={creatingUser}>
                    {creatingUser ? 'Creating…' : '✅ Create User & Set Password'}
                  </button>
                  <button type="button" className="btn btn-secondary" onClick={() => setShowCreateUser(false)}>Cancel</button>
                </div>
                <p style={{ marginTop: 10, fontSize: 12, color: 'var(--text-muted)' }}>
                  🔒 Share the <strong>email</strong> and <strong>password</strong> with the user directly. They can change it later in Settings.
                </p>
              </form>
            )}
          </div>

          {/* Users table */}
          <div className="content-card">
            <div className="section-header" style={{ marginBottom: 16 }}>
              <div>
                <h3 style={{ margin: 0 }}>CRM Users</h3>
                <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: '4px 0 0' }}>Manage roles and track lead claims</p>
              </div>
              <button className="btn btn-secondary btn-sm" onClick={fetchData} disabled={leadsLoading}><MdRefresh /></button>
            </div>

            {crmUsers.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">👥</div>
                <p>No CRM users yet. Create one above.</p>
              </div>
            ) : (
              <div className="table-wrapper">
                <table className="crm-table">
                  <thead>
                    <tr>
                      <th>#</th><th>Name</th><th>Email</th><th>Role</th>
                      <th>Leads Claimed</th><th>Converted</th><th>Joined</th><th>Change Role</th>
                    </tr>
                  </thead>
                  <tbody>
                    {crmUsers.map((u, i) => {
                      const userLeads = leads.filter(l => l.assigned_user_id === u.id);
                      const isExpanded = expandedUserId === u.id;
                      return (
                        <React.Fragment key={u.id}>
                        <tr>
                          <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{i + 1}</td>
                          <td style={{ fontWeight: 700 }}>{u.name}</td>
                          <td style={{ fontSize: 12, color: '#2563eb' }}>{u.email}</td>
                          <td>
                            <span style={{
                              padding: '3px 10px', borderRadius: 12, fontSize: 11, fontWeight: 700,
                              background: u.role === 'admin' ? '#eff6ff' : '#f0fdf4',
                              color:      u.role === 'admin' ? '#1d4ed8' : '#15803d',
                              border:    `1.5px solid ${u.role === 'admin' ? '#bfdbfe' : '#bbf7d0'}`,
                            }}>
                              {u.role === 'admin' ? '👑 Admin' : '👤 User'}
                            </span>
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <button
                              onClick={() => setExpandedUserId(isExpanded ? null : u.id)}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                              title={isExpanded ? 'Collapse' : 'View leads'}
                            >
                              <span style={{ fontWeight: 800, fontSize: 18, color: '#3b82f6' }}>{userLeads.length}</span>
                              <span style={{ fontSize: 11, color: '#3b82f6', marginLeft: 4 }}>{isExpanded ? '▲' : '▼'}</span>
                            </button>
                          </td>
                          <td style={{ fontWeight: 700, color: '#16a34a' }}>
                            {userLeads.filter(l => l.status === 'converted').length}
                          </td>
                          <td style={{ fontSize: 11, color: 'var(--text-muted)' }}>{fmtDate(u.created_at)}</td>
                          <td>
                            <select
                              style={{ fontSize: 11, borderRadius: 8, border: '1.5px solid #e5e7eb', padding: '4px 8px' }}
                              value={u.role}
                              onChange={e => handleRoleChange(u.id, e.target.value)}
                            >
                              <option value="user">👤 User</option>
                              <option value="admin">👑 Admin</option>
                            </select>
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr>
                            <td colSpan={8} style={{ background: '#f8fafc', padding: 0 }}>
                              {userLeads.length === 0 ? (
                                <div style={{ padding: '12px 20px', color: 'var(--text-muted)', fontSize: 13 }}>No leads claimed yet.</div>
                              ) : (
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                                  <thead>
                                    <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
                                      <th style={{ padding: '8px 14px', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 700, fontSize: 11 }}>#</th>
                                      <th style={{ padding: '8px 14px', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 700, fontSize: 11 }}>Lead Name</th>
                                      <th style={{ padding: '8px 14px', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 700, fontSize: 11 }}>Phone</th>
                                      <th style={{ padding: '8px 14px', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 700, fontSize: 11 }}>Program</th>
                                      <th style={{ padding: '8px 14px', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 700, fontSize: 11 }}>Status</th>
                                      <th style={{ padding: '8px 14px', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 700, fontSize: 11 }}>Claimed</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {userLeads.map((l, idx) => (
                                      <tr key={l.id} style={{ borderBottom: '1px solid #f0f0f0' }}>
                                        <td style={{ padding: '8px 14px', color: 'var(--text-muted)' }}>{idx + 1}</td>
                                        <td style={{ padding: '8px 14px', fontWeight: 600 }}>{l.name || '—'}</td>
                                        <td style={{ padding: '8px 14px', fontFamily: 'monospace' }}>{l.phone || '—'}</td>
                                        <td style={{ padding: '8px 14px' }}><ProgramBadge program={l.lead_program} /></td>
                                        <td style={{ padding: '8px 14px' }}>
                                          <span style={{
                                            fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 10,
                                            background: { new:'#fff7ed', contacted:'#eff6ff', warm:'#fef9c3', converted:'#f0fdf4', lost:'#fef2f2' }[l.status] || '#f3f4f6',
                                            color:      { new:'#ea580c', contacted:'#2563eb', warm:'#ca8a04', converted:'#16a34a', lost:'#dc2626' }[l.status] || '#6b7280',
                                          }}>{l.status || 'new'}</span>
                                        </td>
                                        <td style={{ padding: '8px 14px', color: 'var(--text-muted)' }}>{fmtDate(l.claimed_at)}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              )}
                            </td>
                          </tr>
                        )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── PERFORMANCE REPORT TAB ── */}
      {tab === 'report' && (
        <div>
          {/* Summary cards per user */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16, marginBottom: 24 }}>
            {report.length === 0 ? (
              <div className="content-card" style={{ gridColumn: '1/-1', textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>
                No users to report yet.
              </div>
            ) : report.map(u => {
              const pct = u.total > 0 ? Math.round((u.converted / u.total) * 100) : 0;
              const warmPct = u.total > 0 ? Math.round((u.warm / u.total) * 100) : 0;
              return (
                <div key={u.id} className="content-card" style={{ padding: '18px 20px' }}>
                  {/* Header */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                    <div style={{
                      width: 44, height: 44, borderRadius: 12, flexShrink: 0,
                      background: u.role === 'admin' ? 'linear-gradient(135deg,#3b82f6,#2563eb)' : 'linear-gradient(135deg,#10b981,#059669)',
                      color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontWeight: 800, fontSize: 16,
                    }}>
                      {u.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 800, fontSize: 14, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{u.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{u.email}</div>
                    </div>
                    <span style={{
                      padding: '3px 10px', borderRadius: 12, fontSize: 11, fontWeight: 700, flexShrink: 0,
                      background: u.role === 'admin' ? '#eff6ff' : '#f0fdf4',
                      color:      u.role === 'admin' ? '#1d4ed8' : '#15803d',
                    }}>
                      {u.role === 'admin' ? '👑 Admin' : '👤 Staff'}
                    </span>
                  </div>

                  {/* Stats row */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 14 }}>
                    {[
                      { label: 'Claimed',   value: u.total,     color: '#3b82f6' },
                      { label: 'Converted', value: u.converted, color: '#10b981' },
                      { label: 'Warm',      value: u.warm,      color: '#f59e0b' },
                      { label: 'Pending',   value: u.pending,   color: '#6b7280' },
                    ].map(s => (
                      <div key={s.label} style={{ textAlign: 'center', background: '#f8fafc', borderRadius: 8, padding: '8px 4px' }}>
                        <div style={{ fontWeight: 800, fontSize: 18, color: s.color }}>{s.value}</div>
                        <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600 }}>{s.label}</div>
                      </div>
                    ))}
                  </div>

                  {/* Conversion rate bar */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)' }}>Conversion Rate</span>
                      <span style={{ fontSize: 13, fontWeight: 800, color: pct >= 30 ? '#16a34a' : pct >= 15 ? '#f59e0b' : '#ea580c' }}>{pct}%</span>
                    </div>
                    <div style={{ height: 8, borderRadius: 8, background: '#f1f5f9', overflow: 'hidden' }}>
                      <div style={{
                        height: '100%', borderRadius: 8, transition: 'width 0.6s ease',
                        width: `${Math.min(pct, 100)}%`,
                        background: pct >= 30 ? 'linear-gradient(90deg,#10b981,#34d399)' : pct >= 15 ? 'linear-gradient(90deg,#f59e0b,#fbbf24)' : 'linear-gradient(90deg,#ef4444,#f87171)',
                      }} />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
                      <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>Warm pipeline: {warmPct}%</span>
                      <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{u.total} total leads</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Overall summary table */}
          <div className="content-card">
            <div className="section-header" style={{ marginBottom: 16 }}>
              <h3 style={{ margin: 0 }}>Summary Table</h3>
              <button className="btn btn-secondary btn-sm" onClick={fetchData} disabled={leadsLoading}><MdRefresh /></button>
            </div>
            <div className="table-wrapper">
              <table className="crm-table">
                <thead>
                  <tr>
                    <th>#</th><th>User</th><th>Role</th><th>Total Claimed</th>
                    <th>Converted</th><th>Warm</th><th>Pending</th><th>Conversion %</th>
                  </tr>
                </thead>
                <tbody>
                  {report.map((u, i) => {
                    const pct = u.total > 0 ? Math.round((u.converted / u.total) * 100) : null;
                    return (
                      <tr key={u.id}>
                        <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{i + 1}</td>
                        <td>
                          <div style={{ fontWeight: 700 }}>{u.name}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{u.email}</div>
                        </td>
                        <td>
                          <span style={{
                            fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 10,
                            background: u.role === 'admin' ? '#eff6ff' : '#f0fdf4',
                            color:      u.role === 'admin' ? '#1d4ed8' : '#15803d',
                          }}>
                            {u.role === 'admin' ? '👑 Admin' : '👤 Staff'}
                          </span>
                        </td>
                        <td style={{ fontWeight: 800, textAlign: 'center', fontSize: 18 }}>{u.total}</td>
                        <td><span style={{ fontWeight: 700, color: '#16a34a', fontSize: 15 }}>{u.converted}</span></td>
                        <td><span style={{ fontWeight: 700, color: '#ca8a04' }}>{u.warm}</span></td>
                        <td><span style={{ fontWeight: 700, color: '#2563eb' }}>{u.pending}</span></td>
                        <td>
                          {pct !== null ? (
                            <span style={{
                              fontWeight: 800, fontSize: 14, padding: '3px 10px', borderRadius: 10,
                              background: pct >= 30 ? '#f0fdf4' : pct >= 15 ? '#fef9c3' : '#fef2f2',
                              color:      pct >= 30 ? '#16a34a' : pct >= 15 ? '#ca8a04' : '#ea580c',
                            }}>{pct}%</span>
                          ) : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                        </td>
                      </tr>
                    );
                  })}
                  {report.length === 0 && (
                    <tr><td colSpan={8} style={{ textAlign: 'center', padding: 24, color: 'var(--text-muted)' }}>No users to report yet.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            <div style={{ marginTop: 16, padding: '12px 16px', background: '#fff7ed', borderRadius: 10, border: '1.5px solid #fed7aa', fontSize: 13 }}>
              <strong>Unclaimed leads in pool:</strong>{' '}
              <span style={{ fontWeight: 800, color: '#ea580c' }}>{unclaimedCount}</span>
            </div>
          </div>
        </div>
      )}

      {/* ── MEETING SCHEDULER TAB ── */}
      {tab === 'meeting' && (
        <div className="content-card">
          <h3 style={{ margin: '0 0 4px', fontWeight: 700 }}>Schedule a Teacher Training Meeting</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 20 }}>
            Only for TTP / Abacus / Vedic Math teacher training sessions.
          </p>
          {message.text && (
            <div style={{
              padding: '12px 16px', borderRadius: 8, marginBottom: 16, fontSize: 13, fontWeight: 600,
              background: message.type === 'success' ? '#f0fdf4' : '#fef2f2',
              color:      message.type === 'success' ? '#16a34a' : '#dc2626',
              border:    `1px solid ${message.type === 'success' ? '#bbf7d0' : '#fecaca'}`,
            }}>
              {message.type === 'success' ? '✅ ' : '⚠️ '}{message.text}
            </div>
          )}
          <form onSubmit={handleMeetingSubmit}>
            <div className="form-grid">
              {/* Meeting type */}
              <div className="form-group">
                <label>Meeting Type *</label>
                <select className="form-input" value={form.meetingType} onChange={e => setForm(f => ({ ...f, meetingType: e.target.value }))} required>
                  {MEETING_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
                {/* Live preview badge */}
                {(() => {
                  const t = MEETING_TYPES.find(t => t.value === form.meetingType);
                  return t ? (
                    <span style={{ display: 'inline-block', marginTop: 6, padding: '3px 12px', borderRadius: 12, fontSize: 11, fontWeight: 700, background: t.bg, color: t.color }}>
                      {t.label}
                    </span>
                  ) : null;
                })()}
              </div>

              {/* Meeting program */}
              <div className="form-group">
                <label>Training Program *</label>
                <select className="form-input" value={form.meetingProgram} onChange={e => setForm(f => ({ ...f, meetingProgram: e.target.value }))} required>
                  {MEETING_PROGRAMS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                </select>
              </div>

              {/* Topic */}
              <div className="form-group" style={{ gridColumn: '1/-1' }}>
                <label>Meeting Topic / Agenda</label>
                <input className="form-input" placeholder="e.g. Module 3 – Abacus level 2 techniques" value={form.meetingTopic} onChange={e => setForm(f => ({ ...f, meetingTopic: e.target.value }))} />
              </div>

              <div className="form-group">
                <label>Meeting Date *</label>
                <input type="date" className="form-input" value={form.meetingDate} onChange={e => setForm(f => ({ ...f, meetingDate: e.target.value }))} required />
              </div>
              <div className="form-group">
                <label>Start Time *</label>
                <input type="text" className="form-input" placeholder="e.g., 02:30 PM" value={form.meetingTime} onChange={e => setForm(f => ({ ...f, meetingTime: e.target.value }))} required />
              </div>
              <div className="form-group">
                <label>Duration (minutes)</label>
                <select className="form-input" value={form.duration} onChange={e => setForm(f => ({ ...f, duration: e.target.value }))}>
                  {[15, 30, 45, 60, 90, 120].map(d => <option key={d} value={d}>{d} min</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Host (Trainer) *</label>
                <select className="form-input" value={form.hostEmail} onChange={e => setForm(f => ({ ...f, hostEmail: e.target.value }))} required>
                  <option value="">Select host…</option>
                  {meetingLeads.map(l => <option key={l.id} value={l.email}>{l.name} ({l.email})</option>)}
                </select>
              </div>
            </div>

            {/* WhatsApp template preview */}
            <div style={{ margin: '16px 0', padding: '12px 16px', background: '#f0fdf4', borderRadius: 10, border: '1px solid #bbf7d0', fontSize: 12 }}>
              <div style={{ fontWeight: 700, marginBottom: 6, color: '#15803d' }}>📱 WhatsApp Template Preview</div>
              <div style={{ color: '#166534', lineHeight: 1.6 }}>
                {(() => {
                  const t = MEETING_TYPES.find(t => t.value === form.meetingType);
                  const p = MEETING_PROGRAMS.find(p => p.value === form.meetingProgram);
                  return `${t?.label || '—'} — ${p?.label || '—'}${form.meetingTopic ? ' | ' + form.meetingTopic : ''} | ${form.meetingDate || 'DD-MM-YYYY'} ${form.meetingTime || 'HH:MM'}`;
                })()}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                Template used in Interakt: <strong>{form.meetingType === 'orientation' ? 'meeting_orientation_v2' : form.meetingType === 'marketing' ? 'meeting_marketing_v2' : 'meeting_doubt_v2'}</strong>
              </div>
            </div>

            <div className="form-group" style={{ marginTop: 16 }}>
              <label>Select Trainees / Attendees</label>
              <div style={{ maxHeight: 200, overflowY: 'auto', border: '1.5px solid #f0e8de', borderRadius: 8, padding: '8px 12px' }}>
                {meetingLeads.filter(l => l.email !== form.hostEmail).map(l => (
                  <label key={l.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0', cursor: 'pointer', fontSize: 13, borderBottom: '1px solid #f9f0e8' }}>
                    <input type="checkbox" checked={form.traineeEmails.includes(l.email)}
                      onChange={() => setForm(f => ({
                        ...f,
                        traineeEmails: f.traineeEmails.includes(l.email)
                          ? f.traineeEmails.filter(e => e !== l.email)
                          : [...f.traineeEmails, l.email],
                      }))}
                    />
                    <span style={{ fontWeight: 600 }}>{l.name}</span>
                    <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>{l.email}</span>
                  </label>
                ))}
                {meetingLeads.filter(l => l.email !== form.hostEmail).length === 0 && (
                  <div style={{ color: 'var(--text-muted)', fontSize: 12, padding: '8px 0' }}>No other leads with email found.</div>
                )}
              </div>
            </div>
            <div style={{ marginTop: 20, display: 'flex', gap: 10 }}>
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? 'Scheduling…' : '📅 Schedule Meeting'}
              </button>
              <button type="button" className="btn btn-secondary"
                onClick={() => setForm({ meetingDate: '', meetingTime: '', duration: 30, hostEmail: '', traineeEmails: [], meetingType: 'orientation', meetingProgram: 'ttp_teacher_training', meetingTopic: '' })}>
                Clear
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── ATTENDANCE TAB ── */}
      {tab === 'attendance' && (
        <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: 16, alignItems: 'start' }}>
          {/* Left: meeting list */}
          <div className="content-card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '14px 16px', borderBottom: '1px solid #f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h3 style={{ margin: 0, fontSize: 14 }}>Teacher Training Meetings</h3>
              <button className="btn btn-secondary btn-sm" onClick={fetchAttendanceMeetings}><MdRefresh /></button>
            </div>
            <div style={{ maxHeight: 520, overflowY: 'auto' }}>
              {attendanceMeetings.length === 0 ? (
                <div style={{ padding: 24, color: 'var(--text-muted)', fontSize: 13, textAlign: 'center' }}>No meetings yet.</div>
              ) : attendanceMeetings.map(m => {
                const typeInfo = MEETING_TYPES.find(t => t.value === m.meeting_type) || MEETING_TYPES[0];
                return (
                  <div
                    key={m.id}
                    onClick={() => fetchAttendanceForMeeting(m.id)}
                    style={{
                      padding: '12px 16px', cursor: 'pointer', borderBottom: '1px solid #f3f4f6',
                      background: selectedMeeting === m.id ? '#fff7ed' : '#fff',
                      borderLeft: selectedMeeting === m.id ? '3px solid var(--primary)' : '3px solid transparent',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <span style={{ padding: '2px 8px', borderRadius: 8, fontSize: 10, fontWeight: 700, background: typeInfo.bg, color: typeInfo.color }}>
                        {typeInfo.label}
                      </span>
                    </div>
                    <div style={{ fontWeight: 700, fontSize: 13 }}>{m.meeting_topic || '(No topic)'}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                      {m.host_name ? `Host: ${m.host_name}` : ''}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      {m.meeting_datetime ? new Date(m.meeting_datetime).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : ''}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right: attendance sheet */}
          <div className="content-card">
            {!selectedMeeting ? (
              <div style={{ padding: '48px 0', textAlign: 'center', color: 'var(--text-muted)' }}>
                <div style={{ fontSize: 32 }}>📋</div>
                <p style={{ marginTop: 8 }}>Select a meeting to view the attendance sheet.</p>
              </div>
            ) : attendanceLoading ? (
              <div style={{ padding: '48px 0', textAlign: 'center', color: 'var(--text-muted)' }}>Loading…</div>
            ) : (
              <>
                {/* Summary badges */}
                {(() => {
                  const present = attendanceRows.filter(r => r.status === 'present').length;
                  const absent  = attendanceRows.filter(r => r.status === 'absent').length;
                  const total   = attendanceRows.length;
                  const pct     = total > 0 ? Math.round((present / total) * 100) : 0;
                  return (
                    <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
                      {[
                        { label: 'Total',   value: total,   color: '#3b82f6' },
                        { label: 'Present', value: present, color: '#16a34a' },
                        { label: 'Absent',  value: absent,  color: '#dc2626' },
                        { label: 'Att. %',  value: `${pct}%`, color: pct >= 75 ? '#16a34a' : pct >= 50 ? '#f59e0b' : '#dc2626' },
                      ].map(s => (
                        <div key={s.label} style={{ flex: 1, minWidth: 80, textAlign: 'center', background: '#f8fafc', borderRadius: 10, padding: '12px 8px' }}>
                          <div style={{ fontWeight: 800, fontSize: 22, color: s.color }}>{s.value}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>{s.label}</div>
                        </div>
                      ))}
                    </div>
                  );
                })()}

                {attendanceRows.length === 0 ? (
                  <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--text-muted)' }}>
                    No attendance records found. They are seeded when a meeting is created.
                  </div>
                ) : (
                  <div className="table-wrapper">
                    <table className="crm-table">
                      <thead>
                        <tr>
                          <th>#</th><th>Name</th><th>Email</th><th>Status</th><th>Marked At</th>
                        </tr>
                      </thead>
                      <tbody>
                        {attendanceRows.map((r, i) => (
                          <tr key={r.id}>
                            <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{i + 1}</td>
                            <td style={{ fontWeight: 700 }}>{r.user_name}</td>
                            <td style={{ fontSize: 12, color: '#2563eb' }}>{r.user_email || '—'}</td>
                            <td>
                              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
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
                            <td style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                              {r.marked_at ? new Date(r.marked_at).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' }) : '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                <div style={{ marginTop: 16, display: 'flex', gap: 10 }}>
                  <button className="btn btn-primary" onClick={saveAttendance} disabled={attendanceSaving}>
                    {attendanceSaving ? 'Saving…' : '💾 Save Attendance'}
                  </button>
                  <button className="btn btn-secondary btn-sm" onClick={() => fetchAttendanceForMeeting(selectedMeeting)}>Refresh</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
