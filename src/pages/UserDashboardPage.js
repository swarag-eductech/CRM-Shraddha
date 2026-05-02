import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import { getMyLeads, claimLead, getLeadPool, updateLeadStatus } from '../api';
import { ProgramBadge, SourceBadge } from '../utils/sourceBadge';
import { MdRefresh, MdPhone, MdLogout } from 'react-icons/md';
import { FaWhatsapp } from 'react-icons/fa';

const STATUS_OPTIONS = ['new', 'contacted', 'warm', 'converted', 'lost'];
const STATUS_COLORS = {
  new:       { bg: '#fff7ed', color: '#ea580c', border: '#fed7aa' },
  contacted: { bg: '#eff6ff', color: '#2563eb', border: '#bfdbfe' },
  warm:      { bg: '#fef9c3', color: '#ca8a04', border: '#fde68a' },
  converted: { bg: '#f0fdf4', color: '#16a34a', border: '#bbf7d0' },
  lost:      { bg: '#fef2f2', color: '#dc2626', border: '#fecaca' },
};

export default function UserDashboardPage() {
  const [tab, setTab] = useState('pool');
  const [poolLeads, setPoolLeads] = useState([]);
  const [myLeads, setMyLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState(null);
  const [userId, setUserId] = useState(null);
  const [userName, setUserName] = useState('');
  const [userEmail, setUserEmail] = useState('');

  const fetchAll = useCallback(async (uid, isBackground = false) => {
    if (!isBackground) setLoading(true);
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
        setUserEmail(user.email || '');
        await fetchAll(user.id);
      }
    })();

    const ch = supabase
      .channel('user_dash_rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ttp_leads' }, async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) await fetchAll(user.id, true);
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
      alert('Failed: ' + err.message);
    }
  };

  const fmtDate = (dt) => dt
    ? new Date(dt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
    : '—';

  const converted  = myLeads.filter(l => l.status === 'converted').length;
  const warm       = myLeads.filter(l => l.status === 'warm').length;
  const pct        = myLeads.length > 0 ? Math.round((converted / myLeads.length) * 100) : 0;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-light, #fdf8f4)' }}>
      {/* Top bar */}
      <div style={{
        background: '#fff', borderBottom: '1.5px solid #f0e8de',
        padding: '14px 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 38, height: 38, borderRadius: 10, background: 'linear-gradient(135deg,#ff6600,#ff9d4d)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: 16 }}>
            {userName.charAt(0).toUpperCase()}
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 15, color: '#1a1a2e' }}>{userName}</div>
            <div style={{ fontSize: 11, color: '#9ca3af' }}>{userEmail}</div>
          </div>
        </div>
        <button
          onClick={async () => { await supabase.auth.signOut(); window.location.href = '/login'; }}
          className="btn btn-secondary btn-sm"
        >
          <MdLogout /> Logout
        </button>
      </div>

      <div style={{ padding: '28px 28px' }}>
        {/* Stats strip */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 12, marginBottom: 24 }}>
          {[
            { label: 'Pool Available', value: poolLeads.length, color: '#f59e0b', icon: '🎯' },
            { label: 'My Leads',       value: myLeads.length,   color: '#3b82f6', icon: '👤' },
            { label: 'Converted',      value: converted,         color: '#10b981', icon: '✅' },
            { label: 'Warm',           value: warm,              color: '#f59e0b', icon: '🔥' },
            { label: 'My Conv %',      value: `${pct}%`,         color: pct >= 30 ? '#10b981' : '#ea580c', icon: '📈' },
          ].map(({ label, value, color, icon }) => (
            <div key={label} style={{ background: '#fff', borderRadius: 14, padding: '16px 20px', textAlign: 'center', border: '1.5px solid #f0e8de', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
              <div style={{ fontSize: 22, marginBottom: 2 }}>{icon}</div>
              <div style={{ fontSize: 24, fontWeight: 800, color }}>{value}</div>
              <div style={{ fontSize: 11, color: '#9ca3af', fontWeight: 700 }}>{label}</div>
            </div>
          ))}
        </div>

        {/* My leads breakdown banner (only when user has claimed leads) */}
        {myLeads.length > 0 && (
          <div style={{ background: '#fff', borderRadius: 14, border: '1.5px solid #f0e8de', padding: '14px 20px', marginBottom: 20, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#1a1a2e', marginRight: 4 }}>
              📊 My {myLeads.length} Lead{myLeads.length !== 1 ? 's' : ''}:
            </span>
            {[
              { label: 'New',       key: 'new',       bg: '#fff7ed', color: '#ea580c' },
              { label: 'Contacted', key: 'contacted', bg: '#eff6ff', color: '#2563eb' },
              { label: 'Warm',      key: 'warm',      bg: '#fef9c3', color: '#ca8a04' },
              { label: 'Converted', key: 'converted', bg: '#f0fdf4', color: '#16a34a' },
              { label: 'Lost',      key: 'lost',      bg: '#fef2f2', color: '#dc2626' },
            ].map(({ label, key, bg, color }) => {
              const cnt = myLeads.filter(l => l.status === key).length;
              if (cnt === 0) return null;
              return (
                <span key={key} style={{ background: bg, color, fontWeight: 700, fontSize: 12, padding: '4px 12px', borderRadius: 20, border: `1.5px solid ${color}33` }}>
                  {label}: {cnt}
                </span>
              );
            })}
          </div>
        )}

        {/* Tab bar */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
          {[
            { key: 'pool', label: '🎯 Lead Pool', count: poolLeads.length },
            { key: 'mine', label: '👤 My Leads',  count: myLeads.length },
          ].map(({ key, label, count }) => (
            <button key={key} onClick={() => setTab(key)} style={{
              padding: '8px 22px', borderRadius: 24, fontSize: 13, fontWeight: 700, cursor: 'pointer', border: 'none',
              background: tab === key ? 'linear-gradient(135deg,#ff6600,#ff9d4d)' : '#f3f4f6',
              color: tab === key ? '#fff' : '#6b7280',
              boxShadow: tab === key ? '0 2px 8px rgba(255,102,0,0.2)' : 'none',
            }}>
              {label} <span style={{ opacity: 0.7, marginLeft: 4 }}>{count}</span>
            </button>
          ))}
          <button className="btn btn-secondary btn-sm" style={{ marginLeft: 'auto' }} onClick={() => userId && fetchAll(userId)} disabled={loading}>
            <MdRefresh />
          </button>
        </div>

        {/* ── POOL TAB ── */}
        {tab === 'pool' && (
          <div style={{ background: '#fff', borderRadius: 16, border: '1.5px solid #f0e8de', padding: 20 }}>
            <h3 style={{ margin: '0 0 6px' }}>Available Leads</h3>
            <p style={{ fontSize: 13, color: '#9ca3af', margin: '0 0 16px' }}>
              {poolLeads.length} unclaimed — click <strong>Claim</strong> to add to your list
            </p>
            {loading ? (
              <div style={{ padding: 32, textAlign: 'center', color: '#9ca3af' }}>Loading…</div>
            ) : poolLeads.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 40 }}>
                <div style={{ fontSize: 40 }}>🎯</div>
                <p style={{ color: '#9ca3af', marginTop: 8 }}>No leads in the pool right now. Check back shortly.</p>
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid #f0e8de' }}>
                      {['#', 'Name', 'Phone', 'Source', 'Program', 'Campaign', 'Date', ''].map(h => (
                        <th key={h} style={{ padding: '8px 10px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#9ca3af', whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {poolLeads.map((lead, i) => (
                      <tr key={lead.id} style={{ borderBottom: '1px solid #f9f0e8' }}>
                        <td style={{ padding: '10px 10px', color: '#9ca3af', fontSize: 12 }}>{i + 1}</td>
                        <td style={{ padding: '10px 10px', fontWeight: 700 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{ width: 30, height: 30, borderRadius: 8, background: 'linear-gradient(135deg,#ff6600,#ff9d4d)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 12, flexShrink: 0 }}>
                              {(lead.name || '?').charAt(0).toUpperCase()}
                            </div>
                            {lead.name || '—'}
                          </div>
                        </td>
                        <td style={{ padding: '10px 10px', fontFamily: 'monospace' }}>{lead.phone || '—'}</td>
                        <td style={{ padding: '10px 10px' }}><SourceBadge source={lead.source} /></td>
                        <td style={{ padding: '10px 10px' }}><ProgramBadge program={lead.lead_program} /></td>
                        <td style={{ padding: '10px 10px', color: '#9ca3af', fontSize: 12 }}>{lead.campaign_name || '—'}</td>
                        <td style={{ padding: '10px 10px', color: '#9ca3af', fontSize: 11, whiteSpace: 'nowrap' }}>{fmtDate(lead.lead_date || lead.created_at)}</td>
                        <td style={{ padding: '10px 10px' }}>
                          <button
                            onClick={() => handleClaim(lead.id)}
                            disabled={claiming === lead.id}
                            style={{
                              padding: '6px 16px', borderRadius: 20, border: 'none', fontWeight: 700, fontSize: 12, cursor: 'pointer',
                              background: 'linear-gradient(135deg,#ff6600,#ff9d4d)', color: '#fff',
                              opacity: claiming === lead.id ? 0.6 : 1,
                            }}
                          >
                            {claiming === lead.id ? '…' : '✋ Claim'}
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
          <div style={{ background: '#fff', borderRadius: 16, border: '1.5px solid #f0e8de', padding: 20 }}>
            <h3 style={{ margin: '0 0 6px' }}>My Leads</h3>
            <p style={{ fontSize: 13, color: '#9ca3af', margin: '0 0 16px' }}>
              {myLeads.length} leads — update status once you contact them
            </p>
            {loading ? (
              <div style={{ padding: 32, textAlign: 'center', color: '#9ca3af' }}>Loading…</div>
            ) : myLeads.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 40 }}>
                <div style={{ fontSize: 40 }}>👤</div>
                <p style={{ color: '#9ca3af', marginTop: 8 }}>No leads yet. Go to Pool tab and claim your first lead.</p>
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid #f0e8de' }}>
                      {['#', 'Name', 'Phone', 'Program', 'Campaign', 'Claimed', 'Status', ''].map(h => (
                        <th key={h} style={{ padding: '8px 10px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#9ca3af', whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {myLeads.map((lead, i) => {
                      const st = STATUS_COLORS[lead.status] || STATUS_COLORS.new;
                      return (
                        <tr key={lead.id} style={{ borderBottom: '1px solid #f9f0e8' }}>
                          <td style={{ padding: '10px 10px', color: '#9ca3af', fontSize: 12 }}>{i + 1}</td>
                          <td style={{ padding: '10px 10px', fontWeight: 700 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <div style={{ width: 30, height: 30, borderRadius: 8, background: 'linear-gradient(135deg,#ff6600,#ff9d4d)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 12, flexShrink: 0 }}>
                                {(lead.name || '?').charAt(0).toUpperCase()}
                              </div>
                              {lead.name || '—'}
                            </div>
                          </td>
                          <td style={{ padding: '10px 10px', fontFamily: 'monospace' }}>{lead.phone || '—'}</td>
                          <td style={{ padding: '10px 10px' }}><ProgramBadge program={lead.lead_program} /></td>
                          <td style={{ padding: '10px 10px', color: '#9ca3af', fontSize: 12 }}>{lead.campaign_name || '—'}</td>
                          <td style={{ padding: '10px 10px', color: '#9ca3af', fontSize: 11, whiteSpace: 'nowrap' }}>{fmtDate(lead.claimed_at)}</td>
                          <td style={{ padding: '10px 10px' }}>
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
                          <td style={{ padding: '10px 10px' }}>
                            {lead.phone && (
                              <button
                                onClick={() => window.open(`https://wa.me/91${lead.phone}`, '_blank')}
                                style={{ background: '#25d366', color: '#fff', border: 'none', borderRadius: 8, width: 32, height: 32, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                title="WhatsApp"
                              >
                                <FaWhatsapp size={15} />
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
    </div>
  );
}
