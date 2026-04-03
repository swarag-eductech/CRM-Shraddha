import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import { claimLead, getMyLeads, getLeadPool, updateLeadStatus } from '../api';
import { ProgramBadge, SourceBadge } from '../utils/sourceBadge';
import { MdRefresh, MdPhone } from 'react-icons/md';
import { FaWhatsapp } from 'react-icons/fa';

const STATUS_OPTIONS = ['new', 'contacted', 'warm', 'converted', 'lost'];
const STATUS_COLORS = {
  new:       { bg: '#fff7ed', color: '#ea580c', border: '#fed7aa' },
  contacted: { bg: '#eff6ff', color: '#2563eb', border: '#bfdbfe' },
  warm:      { bg: '#fef9c3', color: '#ca8a04', border: '#fde68a' },
  converted: { bg: '#f0fdf4', color: '#16a34a', border: '#bbf7d0' },
  lost:      { bg: '#fef2f2', color: '#dc2626', border: '#fecaca' },
};

export default function LeadPoolPage() {
  const [tab, setTab] = useState('pool');
  const [poolLeads, setPoolLeads] = useState([]);
  const [myLeads, setMyLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState(null);
  const [userId, setUserId] = useState(null);
  const [userName, setUserName] = useState('');

  const fetchAll = useCallback(async (uid) => {
    setLoading(true);
    try {
      const [pool, mine] = await Promise.all([getLeadPool(), getMyLeads(uid)]);
      setPoolLeads(pool);
      setMyLeads(mine);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserId(user.id);
        setUserName(user.user_metadata?.full_name || user.email?.split('@')[0] || 'User');
        await fetchAll(user.id);
      }
    })();

    const ch = supabase
      .channel('lead_pool_rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ttp_leads' }, async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) await fetchAll(user.id);
      })
      .subscribe();
    return () => supabase.removeChannel(ch);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleClaim = async (leadId) => {
    if (!userId) return;
    setClaiming(leadId);
    try {
      await claimLead(leadId, userId);
      await fetchAll(userId);
      setTab('mine');
    } catch (err) {
      alert(err.message);
    } finally {
      setClaiming(null);
    }
  };

  const handleStatusChange = async (leadId, newStatus) => {
    try {
      await updateLeadStatus(leadId, newStatus);
      setMyLeads(prev => prev.map(l => l.id === leadId ? { ...l, status: newStatus } : l));
    } catch (err) {
      alert('Failed to update status: ' + err.message);
    }
  };

  const fmtDate = (dt) => dt
    ? new Date(dt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
    : '—';

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ margin: 0, fontWeight: 800 }}>Lead Pool</h2>
          <p style={{ color: 'var(--text-muted)', margin: '4px 0 0', fontSize: 13 }}>
            Welcome, <strong>{userName}</strong> — Claim leads and track your progress
          </p>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={() => userId && fetchAll(userId)} disabled={loading}>
          <MdRefresh /> Refresh
        </button>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 24 }}>
        {[
          { label: 'Available Pool', value: poolLeads.length, color: '#f59e0b' },
          { label: 'My Leads', value: myLeads.length, color: '#3b82f6' },
          { label: 'Converted', value: myLeads.filter(l => l.status === 'converted').length, color: '#10b981' },
          { label: 'Warm', value: myLeads.filter(l => l.status === 'warm').length, color: '#f59e0b' },
        ].map(({ label, value, color }) => (
          <div key={label} className="content-card" style={{ padding: '14px 18px', textAlign: 'center' }}>
            <div style={{ fontSize: 26, fontWeight: 800, color }}>{value}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 700 }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Tab switcher */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {[
          { key: 'pool', label: '🎯 Available Pool', count: poolLeads.length },
          { key: 'mine', label: '👤 My Leads', count: myLeads.length },
        ].map(({ key, label, count }) => (
          <button key={key} onClick={() => setTab(key)} style={{
            padding: '8px 22px', borderRadius: 24, fontSize: 13, fontWeight: 700, cursor: 'pointer',
            border: 'none',
            background: tab === key ? 'var(--gradient)' : '#f3f4f6',
            color: tab === key ? '#fff' : 'var(--text-muted)',
            boxShadow: tab === key ? '0 2px 8px rgba(255,102,0,0.2)' : 'none',
          }}>
            {label} <span style={{ opacity: 0.7, marginLeft: 4 }}>{count}</span>
          </button>
        ))}
      </div>

      {/* ── POOL TAB ── */}
      {tab === 'pool' && (
        <div className="content-card">
          <div style={{ marginBottom: 14 }}>
            <h3 style={{ margin: 0 }}>Available Leads</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: '4px 0 0' }}>
              {poolLeads.length} unclaimed leads — click <strong>Claim</strong> to assign to yourself
            </p>
          </div>
          {loading ? (
            <div style={{ padding: '32px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: 14 }}>Loading…</div>
          ) : poolLeads.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">🎯</div>
              <p>No available leads in the pool right now.</p>
            </div>
          ) : (
            <div className="table-wrapper">
              <table className="crm-table">
                <thead>
                  <tr>
                    <th>#</th><th>Name</th><th>Phone</th><th>Source</th>
                    <th>Program</th><th>Campaign</th><th>Lead Date</th><th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {poolLeads.map((lead, i) => (
                    <tr key={lead.id}>
                      <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>{i + 1}</td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--gradient)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 13, fontWeight: 700, flexShrink: 0 }}>
                            {(lead.name || '?').charAt(0).toUpperCase()}
                          </div>
                          <span style={{ fontWeight: 600 }}>{lead.name || '—'}</span>
                        </div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                          <MdPhone size={13} style={{ color: 'var(--text-muted)' }} />
                          <span style={{ fontFamily: 'monospace', fontSize: 13 }}>{lead.phone || '—'}</span>
                        </div>
                      </td>
                      <td><SourceBadge source={lead.source} /></td>
                      <td><ProgramBadge program={lead.lead_program} /></td>
                      <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{lead.campaign_name || '—'}</td>
                      <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{fmtDate(lead.lead_date || lead.created_at)}</td>
                      <td>
                        <button
                          className="btn btn-primary btn-sm"
                          disabled={claiming === lead.id}
                          onClick={() => handleClaim(lead.id)}
                          style={{ minWidth: 84 }}
                        >
                          {claiming === lead.id ? 'Claiming…' : '✋ Claim'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── MY LEADS TAB ── */}
      {tab === 'mine' && (
        <div className="content-card">
          <div style={{ marginBottom: 14 }}>
            <h3 style={{ margin: 0 }}>My Leads</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: '4px 0 0' }}>
              {myLeads.length} leads assigned to you — update status and manage follow-ups
            </p>
          </div>
          {loading ? (
            <div style={{ padding: '32px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: 14 }}>Loading…</div>
          ) : myLeads.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">👤</div>
              <p>You haven't claimed any leads yet. Go to the Pool tab to claim leads.</p>
            </div>
          ) : (
            <div className="table-wrapper">
              <table className="crm-table">
                <thead>
                  <tr>
                    <th>#</th><th>Name</th><th>Phone</th><th>Source</th>
                    <th>Program</th><th>Campaign</th><th>Claimed</th><th>Status</th><th>Contact</th>
                  </tr>
                </thead>
                <tbody>
                  {myLeads.map((lead, i) => {
                    const st = STATUS_COLORS[lead.status] || STATUS_COLORS.new;
                    return (
                      <tr key={lead.id}>
                        <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>{i + 1}</td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--gradient)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 13, fontWeight: 700, flexShrink: 0 }}>
                              {(lead.name || '?').charAt(0).toUpperCase()}
                            </div>
                            <span style={{ fontWeight: 600 }}>{lead.name || '—'}</span>
                          </div>
                        </td>
                        <td style={{ fontFamily: 'monospace', fontSize: 13 }}>{lead.phone || '—'}</td>
                        <td><SourceBadge source={lead.source} /></td>
                        <td><ProgramBadge program={lead.lead_program} /></td>
                        <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{lead.campaign_name || '—'}</td>
                        <td style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{fmtDate(lead.claimed_at)}</td>
                        <td>
                          <select
                            value={lead.status || 'new'}
                            onChange={e => handleStatusChange(lead.id, e.target.value)}
                            style={{
                              background: st.bg, color: st.color, border: `1.5px solid ${st.border}`,
                              borderRadius: 20, padding: '4px 10px', fontSize: 11, fontWeight: 700, cursor: 'pointer',
                            }}
                          >
                            {STATUS_OPTIONS.map(s => (
                              <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                            ))}
                          </select>
                        </td>
                        <td>
                          {lead.phone && (
                            <button
                              className="btn btn-whatsapp btn-sm"
                              title="Open WhatsApp"
                              onClick={() => window.open(`https://wa.me/91${lead.phone}`, '_blank')}
                            >
                              <FaWhatsapp />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
