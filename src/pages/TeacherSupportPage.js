import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  MdAdd, MdClose, MdRefresh, MdSearch, MdPhone,
  MdAssignment, MdFilterList,
  MdEdit, MdDelete, MdSupportAgent, MdCheckCircle, MdPending,
  MdOutlineContactPhone,
} from 'react-icons/md';
import { useTeacherSupport } from '../hooks/useTeacherSupport';
import { useAuth } from '../hooks/useAuth';
import { callCustomer } from '../api';

// ─── Constants ───────────────────────────────────────────────────────────────
const AGENTS = ['pujita', 'aditya', 'gautami'];
const ISSUE_TYPES  = ['Marketing Issue', 'Institutional Issue', 'Personal Issue'];
const STATUS_OPTS  = ['New', 'Contacted', 'In Progress', 'Resolved'];

const ISSUE_COLORS = {
  'Marketing Issue':      { bg: '#fff7ed', color: '#ea580c', border: '#fed7aa' },
  'Institutional Issue':  { bg: '#eff6ff', color: '#2563eb', border: '#bfdbfe' },
  'Personal Issue':       { bg: '#fdf4ff', color: '#9333ea', border: '#e9d5ff' },
};

const STATUS_COLORS = {
  'New':         { bg: '#f0fdf4', color: '#16a34a', border: '#bbf7d0' },
  'Contacted':   { bg: '#eff6ff', color: '#2563eb', border: '#bfdbfe' },
  'In Progress': { bg: '#fef9c3', color: '#ca8a04', border: '#fde68a' },
  'Resolved':    { bg: '#f1f5f9', color: '#64748b', border: '#e2e8f0' },
};



// ─── Smartflo Call Button ────────────────────────────────────────────────────
function SmartfloCallButton({ phone }) {
  const [calling, setCalling] = useState(false);
  const [agent, setAgent]     = useState('');
  const [dropOpen, setDropOpen] = useState(false);
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
    <div ref={ref} style={{ position: 'relative', display: 'inline-flex', gap: 2, marginTop: 4 }}>
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

// ─── Helpers ─────────────────────────────────────────────────────────────────
function formatDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function Badge({ label, map }) {
  const c = map[label] || { bg: '#f1f5f9', color: '#64748b', border: '#e2e8f0' };
  return (
    <span style={{
      background: c.bg, color: c.color, border: `1.5px solid ${c.border || c.bg}`,
      padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap',
    }}>{label}</span>
  );
}

// ─── Stat Card ───────────────────────────────────────────────────────────────
function StatCard({ label, value, icon, color }) {
  return (
    <div style={{
      background: '#fff', borderRadius: 14, padding: '18px 20px', display: 'flex',
      alignItems: 'center', gap: 14, boxShadow: '0 2px 8px rgba(0,0,0,0.07)',
      border: '1.5px solid #f0e8de', flex: 1, minWidth: 140,
    }}>
      <div style={{ width: 44, height: 44, borderRadius: 12, background: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', color, fontSize: 22, flexShrink: 0 }}>{icon}</div>
      <div>
        <div style={{ fontSize: 24, fontWeight: 800, color: '#1e293b', lineHeight: 1 }}>{value}</div>
        <div style={{ fontSize: 12, color: '#64748b', marginTop: 3 }}>{label}</div>
      </div>
    </div>
  );
}

// ─── Issue Modal (Create / Edit) ─────────────────────────────────────────────
function IssueModal({ issue, onClose, onSave, currentUserId }) {
  const isEdit = !!issue?.id;
  const empty  = { ttp_code: '', teacher_name: '', mobile_number: '', student_count: '', since_started: '', issue_type: 'Marketing Issue', remark: '', status: 'New', follow_up_date: '' };
  const [form, setForm] = useState(isEdit ? {
    ttp_code:       issue.ttp_code       || '',
    teacher_name:   issue.teacher_name   || '',
    mobile_number:  issue.mobile_number  || '',
    student_count:  issue.student_count  != null ? String(issue.student_count) : '',
    since_started:  issue.since_started  || '',
    issue_type:     issue.issue_type     || 'Marketing Issue',
    remark:         issue.remark         || '',
    status:         issue.status         || 'New',
    follow_up_date: issue.follow_up_date || '',
  } : empty);
  const [saving, setSaving] = useState(false);
  const [err, setErr]       = useState('');

  const handle = (field) => (e) => setForm(f => ({ ...f, [field]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    if (!form.teacher_name.trim())  { setErr('Teacher name is required.'); return; }
    if (!form.mobile_number.trim()) { setErr('Mobile number is required.'); return; }
    setSaving(true);
    setErr('');
    try {
      await onSave(form, isEdit ? issue.id : null);
      onClose();
    } catch (ex) {
      setErr(ex.message);
    } finally {
      setSaving(false);
    }
  };

  const inputStyle = {
    width: '100%', padding: '9px 12px', borderRadius: 8,
    border: '1.5px solid #e2e8f0', fontSize: 14, outline: 'none',
    background: '#fafafa', boxSizing: 'border-box',
  };
  const labelStyle = { fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 4, display: 'block' };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: '#fff', borderRadius: 18, width: '100%', maxWidth: 560, boxShadow: '0 24px 64px rgba(0,0,0,0.18)', overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ background: 'linear-gradient(135deg,#ff6600,#f97316)', padding: '18px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ color: '#fff', fontWeight: 700, fontSize: 16 }}>{isEdit ? 'Edit Issue' : 'New Teacher Issue'}</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', fontSize: 22, lineHeight: 1 }}><MdClose /></button>
        </div>

        <form onSubmit={submit} style={{ padding: '22px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={labelStyle}>TTP Code</label>
              <input style={inputStyle} value={form.ttp_code} onChange={handle('ttp_code')} placeholder="e.g. TTP-102" />
            </div>
            <div>
              <label style={labelStyle}>Teacher Name *</label>
              <input style={inputStyle} value={form.teacher_name} onChange={handle('teacher_name')} placeholder="Full name" />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={labelStyle}>Mobile Number *</label>
              <input style={inputStyle} value={form.mobile_number} onChange={handle('mobile_number')} placeholder="10-digit mobile" />
            </div>
            <div>
              <label style={labelStyle}>Student Count</label>
              <input type="number" style={inputStyle} value={form.student_count} onChange={handle('student_count')} placeholder="e.g. 20" min="0" />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={labelStyle}>Since Started</label>
              <input style={inputStyle} value={form.since_started} onChange={handle('since_started')} placeholder="e.g. 7.8 years" />
            </div>
            <div>
              <label style={labelStyle}>Issue Type *</label>
              <select style={inputStyle} value={form.issue_type} onChange={handle('issue_type')}>
                {ISSUE_TYPES.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={labelStyle}>Status</label>
              <select style={inputStyle} value={form.status} onChange={handle('status')}>
                {STATUS_OPTS.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Follow-up Date</label>
              <input type="date" style={inputStyle} value={form.follow_up_date} onChange={handle('follow_up_date')} />
            </div>
          </div>

          <div>
            <label style={labelStyle}>Remark</label>
            <textarea style={{ ...inputStyle, minHeight: 72, resize: 'vertical' }} value={form.remark} onChange={handle('remark')} placeholder="Notes / remark…" />
          </div>

          {err && <div style={{ color: '#dc2626', fontSize: 13 }}>{err}</div>}

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button type="button" onClick={onClose} style={{ padding: '9px 20px', borderRadius: 8, border: '1.5px solid #e2e8f0', background: '#f8fafc', cursor: 'pointer', fontWeight: 600 }}>Cancel</button>
            <button type="submit" disabled={saving} style={{ padding: '9px 24px', borderRadius: 8, background: 'linear-gradient(135deg,#ff6600,#f97316)', color: '#fff', border: 'none', fontWeight: 700, cursor: saving ? 'wait' : 'pointer' }}>
              {saving ? 'Saving…' : (isEdit ? 'Update Issue' : 'Create Issue')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Issue Row ────────────────────────────────────────────────────────────────
function IssueRow({ issue, onEdit, onDelete, onStatusChange }) {
  const [statusOpen, setStatusOpen] = useState(false);
  const ref = useRef();

  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setStatusOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const sc = STATUS_COLORS[issue.status] || STATUS_COLORS['New'];

  return (
    <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
      {/* TTP Code */}
      <td style={{ padding: '12px 16px' }}>
        {issue.ttp_code
          ? <span style={{ background: '#fff7ed', color: '#c2410c', border: '1.5px solid #fed7aa', borderRadius: 8, padding: '3px 10px', fontSize: 12, fontWeight: 700 }}>{issue.ttp_code}</span>
          : <span style={{ color: '#cbd5e1', fontSize: 12 }}>—</span>}
      </td>
      {/* Teacher */}
      <td style={{ padding: '12px 16px' }}>
        <div style={{ fontWeight: 700, fontSize: 14, color: '#1e293b' }}>{issue.teacher_name}</div>
      </td>
      {/* Mobile */}
      <td style={{ padding: '12px 16px' }}>
        <div style={{ fontSize: 13, color: '#475569', display: 'flex', alignItems: 'center', gap: 4 }}>
          <MdPhone size={13} style={{ color: '#94a3b8' }} />{issue.mobile_number}
        </div>
        {issue.mobile_number && <SmartfloCallButton phone={issue.mobile_number} />}
      </td>
      {/* Student Count */}
      <td style={{ padding: '12px 16px', textAlign: 'center' }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#1e293b' }}>
          {issue.student_count != null ? issue.student_count : '—'}
        </div>
      </td>
      {/* Since Started */}
      <td style={{ padding: '12px 16px', fontSize: 13, color: '#475569' }}>
        {issue.since_started || '—'}
      </td>
      {/* Issue Type */}
      <td style={{ padding: '12px 16px' }}>
        <Badge label={issue.issue_type} map={ISSUE_COLORS} />
      </td>
      {/* Remark */}
      <td style={{ padding: '12px 16px', maxWidth: 220 }}>
        <div style={{ fontSize: 12, color: '#64748b', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
          {issue.remark || '—'}
        </div>
      </td>
      {/* Status */}
      <td style={{ padding: '12px 16px' }} ref={ref}>
        <div style={{ position: 'relative', display: 'inline-block' }}>
          <span
            onClick={() => setStatusOpen(o => !o)}
            style={{ ...sc, padding: '4px 12px', borderRadius: 20, fontSize: 11, fontWeight: 700, cursor: 'pointer', display: 'inline-block', border: `1.5px solid ${sc.border}` }}
          >
            {issue.status}
          </span>
          {statusOpen && (
            <div style={{ position: 'absolute', top: '110%', left: 0, zIndex: 50, background: '#fff', borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.13)', border: '1px solid #f0e8de', overflow: 'hidden', minWidth: 130 }}>
              {STATUS_OPTS.map(s => {
                const c = STATUS_COLORS[s];
                return (
                  <div key={s} onClick={() => { setStatusOpen(false); onStatusChange(issue.id, s); }}
                    style={{ padding: '8px 14px', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: c.color, background: issue.status === s ? c.bg : '#fff' }}>
                    {s}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </td>
      {/* Follow-up */}
      <td style={{ padding: '12px 16px', fontSize: 12, color: '#64748b' }}>
        {formatDate(issue.follow_up_date)}
      </td>
      {/* Actions */}
      <td style={{ padding: '12px 16px' }}>
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={() => onEdit(issue)} title="Edit" style={{ background: '#eff6ff', color: '#2563eb', border: 'none', borderRadius: 6, padding: '5px 8px', cursor: 'pointer' }}>
            <MdEdit size={14} />
          </button>
          <button onClick={() => onDelete(issue.id)} title="Delete" style={{ background: '#fef2f2', color: '#dc2626', border: 'none', borderRadius: 6, padding: '5px 8px', cursor: 'pointer' }}>
            <MdDelete size={14} />
          </button>
        </div>
      </td>
    </tr>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function TeacherSupportPage() {
  const { userId } = useAuth();

  const [issueTypeFilter, setIssueTypeFilter] = useState('all');
  const [statusFilter,    setStatusFilter]    = useState('all');
  const [myIssues,        setMyIssues]        = useState(false);
  const [search,          setSearch]          = useState('');
  const [modalOpen,       setModalOpen]       = useState(false);
  const [editingIssue,    setEditingIssue]    = useState(null);
  const [deleteConfirm,   setDeleteConfirm]   = useState(null); // { id, name }

  const { issues, loading, error, refetch, createIssue, updateIssue, deleteIssue } =
    useTeacherSupport({ issueTypeFilter, statusFilter, myIssues, currentUserId: userId });

  // Client-side search
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return issues;
    return issues.filter(i =>
      i.teacher_name?.toLowerCase().includes(q) ||
      i.mobile_number?.includes(q) ||
      i.ttp_code?.toLowerCase().includes(q) ||
      i.remark?.toLowerCase().includes(q)
    );
  }, [issues, search]);

  // Stats
  const total      = issues.length;
  const marketing  = issues.filter(i => i.issue_type === 'Marketing Issue').length;
  const pending    = issues.filter(i => i.status !== 'Resolved').length;
  const resolved   = issues.filter(i => i.status === 'Resolved').length;

  const handleSave = async (form, id) => {
    if (id) {
      await updateIssue(id, form);
    } else {
      await createIssue(form, userId);
    }
  };

  const handleDelete = (id) => {
    const issue = issues.find(i => i.id === id);
    setDeleteConfirm({ id, name: issue?.teacher_name || 'this issue' });
  };

  const confirmDelete = async () => {
    if (!deleteConfirm) return;
    try { await deleteIssue(deleteConfirm.id); }
    catch (ex) { alert('Delete failed: ' + ex.message); }
    finally { setDeleteConfirm(null); }
  };

  const handleStatusChange = async (id, newStatus) => {
    try { await updateIssue(id, { status: newStatus }); } catch (ex) { alert('Update failed: ' + ex.message); }
  };

  const selectStyle = {
    padding: '7px 12px', borderRadius: 8, border: '1.5px solid #e2e8f0',
    fontSize: 13, background: '#fff', cursor: 'pointer', outline: 'none', color: '#334155',
  };

  return (
    <div style={{ padding: '24px', maxWidth: 1200, margin: '0 auto' }}>

      {/* Page Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: '#1e293b', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <MdSupportAgent style={{ color: '#ff6600', fontSize: 26 }} />
            Teacher Support Desk
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#64748b' }}>
            Track and resolve issues raised by existing teachers
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={refetch} style={{ padding: '8px 14px', borderRadius: 8, border: '1.5px solid #e2e8f0', background: '#fff', cursor: 'pointer', color: '#64748b', display: 'flex', alignItems: 'center', gap: 4 }}>
            <MdRefresh size={16} /> Refresh
          </button>
          <button onClick={() => { setEditingIssue(null); setModalOpen(true); }} style={{ padding: '8px 18px', borderRadius: 8, background: 'linear-gradient(135deg,#ff6600,#f97316)', color: '#fff', border: 'none', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 14 }}>
            <MdAdd size={18} /> New Issue
          </button>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 24 }}>
        <StatCard label="Total Issues"       value={total}     icon={<MdAssignment />}          color="#ff6600" />
        <StatCard label="Marketing Issues"   value={marketing} icon={<MdOutlineContactPhone />}  color="#ea580c" />
        <StatCard label="Pending Follow-ups" value={pending}   icon={<MdPending />}              color="#ca8a04" />
        <StatCard label="Resolved"           value={resolved}  icon={<MdCheckCircle />}          color="#16a34a" />
      </div>

      {/* Filters */}
      <div style={{ background: '#fff', borderRadius: 12, padding: '14px 18px', marginBottom: 18, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', border: '1.5px solid #f0e8de' }}>
        <MdFilterList style={{ color: '#94a3b8', fontSize: 18 }} />

        <div style={{ position: 'relative', flex: 1, minWidth: 180 }}>
          <MdSearch style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', fontSize: 16 }} />
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search teacher, mobile, TTP code…"
            style={{ paddingLeft: 32, padding: '7px 12px 7px 32px', borderRadius: 8, border: '1.5px solid #e2e8f0', width: '100%', fontSize: 13, outline: 'none', background: '#fafafa', boxSizing: 'border-box' }}
          />
        </div>

        <select style={selectStyle} value={issueTypeFilter} onChange={e => setIssueTypeFilter(e.target.value)}>
          <option value="all">All Issue Types</option>
          {ISSUE_TYPES.map(t => <option key={t}>{t}</option>)}
        </select>

        <select style={selectStyle} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="all">All Statuses</option>
          {STATUS_OPTS.map(s => <option key={s}>{s}</option>)}
        </select>

        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#475569', cursor: 'pointer', userSelect: 'none' }}>
          <input type="checkbox" checked={myIssues} onChange={e => setMyIssues(e.target.checked)} style={{ accentColor: '#ff6600' }} />
          My Issues
        </label>
      </div>

      {/* Table */}
      <div style={{ background: '#fff', borderRadius: 14, boxShadow: '0 2px 8px rgba(0,0,0,0.07)', border: '1.5px solid #f0e8de', overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#ff6600', fontSize: 15 }}>Loading…</div>
        ) : error ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#dc2626', fontSize: 14 }}>Error: {error}</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 60, textAlign: 'center', color: '#94a3b8', fontSize: 15 }}>
            <MdSupportAgent size={40} style={{ marginBottom: 10, opacity: 0.4 }} />
            <div>No issues found.</div>
            <div style={{ fontSize: 13, marginTop: 6 }}>Click "New Issue" to log a teacher support request.</div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#fafafa', borderBottom: '2px solid #f1f5f9' }}>
                  {['TTP Code', 'Teacher Name', 'Mobile Number', 'Students', 'Since Started', 'Issue Type', 'Remark', 'Status', 'Follow-up', 'Actions'].map(h => (
                    <th key={h} style={{ padding: '11px 16px', textAlign: 'left', fontSize: 12, fontWeight: 700, color: '#64748b', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(issue => (
                  <IssueRow
                    key={issue.id}
                    issue={issue}
                    onEdit={(i) => { setEditingIssue(i); setModalOpen(true); }}
                    onDelete={handleDelete}
                    onStatusChange={handleStatusChange}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div style={{ marginTop: 10, fontSize: 12, color: '#94a3b8', textAlign: 'right' }}>
        Showing {filtered.length} of {issues.length} issues
      </div>

      {/* Modal */}
      {modalOpen && (
        <IssueModal
          issue={editingIssue}
          onClose={() => { setModalOpen(false); setEditingIssue(null); }}
          onSave={handleSave}
          currentUserId={userId}
        />
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: '#fff', borderRadius: 18, width: '100%', maxWidth: 420, boxShadow: '0 24px 64px rgba(0,0,0,0.18)', overflow: 'hidden' }}>
            <div style={{ background: 'linear-gradient(135deg,#ff6600,#f97316)', padding: '18px 24px', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 38, height: 38, borderRadius: 10, background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>🗑️</div>
              <div style={{ color: '#fff', fontWeight: 700, fontSize: 16 }}>Delete Issue</div>
            </div>
            <div style={{ padding: '24px 24px 20px' }}>
              <p style={{ margin: '0 0 6px', fontSize: 15, fontWeight: 700, color: '#1e293b' }}>Are you sure you want to delete this issue?</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '14px 0', background: '#fff7ed', border: '1.5px solid #fed7aa', borderRadius: 10, padding: '10px 14px' }}>
                <div style={{ width: 34, height: 34, borderRadius: 8, background: '#ffedd5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, color: '#ff6600', fontSize: 15, flexShrink: 0 }}>
                  {(deleteConfirm.name || '?').charAt(0).toUpperCase()}
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14, color: '#ea580c' }}>{deleteConfirm.name}</div>
                  <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>This action cannot be undone.</div>
                </div>
              </div>
              <p style={{ margin: '0 0 20px', fontSize: 13, color: '#64748b' }}>All data associated with this issue will be permanently removed.</p>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button onClick={() => setDeleteConfirm(null)} style={{ padding: '9px 22px', borderRadius: 8, border: '1.5px solid #f0e8de', background: '#fff7ed', cursor: 'pointer', fontWeight: 600, fontSize: 14, color: '#ea580c' }}>Cancel</button>
                <button onClick={confirmDelete} style={{ padding: '9px 22px', borderRadius: 8, background: 'linear-gradient(135deg,#ff6600,#f97316)', color: '#fff', border: 'none', fontWeight: 700, fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>🗑️ Yes, Delete</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
