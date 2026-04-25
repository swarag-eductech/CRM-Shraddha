import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { MdPeople, MdTrendingUp, MdEvent, MdCheckCircle, MdArrowForward, MdRefresh, MdToday, MdApps, MdSupportAgent } from 'react-icons/md';
import { FaWhatsapp } from 'react-icons/fa';
import { useLeads } from '../hooks/useLeads';
import { useTodayTasks } from '../hooks/useTodayTasks';
import { useTeacherSupport } from '../hooks/useTeacherSupport';
import FollowupPopup from '../components/FollowupPopup';
import { useAuth } from '../hooks/useAuth';

function formatTimeAgo(dateStr) {
  if (!dateStr) return '—';
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

function getWeekData(leads) {
  const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const now = new Date();
  const dow = now.getDay();
  const diffToMon = dow === 0 ? 6 : dow - 1;
  const monday = new Date(now);
  monday.setDate(now.getDate() - diffToMon);
  monday.setHours(0, 0, 0, 0);
  const counts = dayNames.map((d, i) => {
    const dayStart = new Date(monday);
    dayStart.setDate(monday.getDate() + i);
    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayStart.getDate() + 1);
    const count = leads.filter(l => {
      if (!l.created_at) return false;
      const ld = new Date(l.created_at);
      return ld >= dayStart && ld < dayEnd;
    }).length;
    return { day: d, leads: count };
  });
  const max = Math.max(...counts.map(c => c.leads), 1);
  return counts.map(c => ({ ...c, height: `${Math.max((c.leads / max) * 100, 4)}%` }));
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const { userId, isAdmin } = useAuth();
  const { leads, loading, refetch } = useLeads('all', isAdmin ? null : userId || null);
  const { followups: todayFollowups, meetings: todayMeetings } = useTodayTasks();
  const { issues: tsIssues } = useTeacherSupport();

  const totalLeads = leads.length;

  const todayLeads = useMemo(() => {
    const today = new Date();
    return leads.filter(l => {
      if (!l.created_at) return false;
      const ld = new Date(l.created_at);
      return ld.getDate() === today.getDate() &&
        ld.getMonth() === today.getMonth() &&
        ld.getFullYear() === today.getFullYear();
    }).length;
  }, [leads]);

  const thisWeekLeads = useMemo(() => {
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    return leads.filter(l => l.created_at && new Date(l.created_at) >= weekAgo).length;
  }, [leads]);

  const withEmail = useMemo(() => leads.filter(l => l.email).length, [leads]);
  const weekData = useMemo(() => getWeekData(leads), [leads]);
  const weekTotal = weekData.reduce((s, d) => s + d.leads, 0);
  const weekPeak = weekData.reduce((mx, d) => d.leads > mx.leads ? d : mx, weekData[0] || { day: '—', leads: 0 });
  const recentLeads = leads.slice(0, 5);

  const activities = useMemo(() => leads.slice(0, 5).map(l => ({
    text: <><strong>New lead</strong> {l.name || 'Unknown'} enquired{l.program ? ` for ${l.program}` : ''}{l.city ? ` from ${l.city}` : ''}</>,
    color: '#ff6600',
    time: formatTimeAgo(l.created_at),
  })), [leads]);

  const funnelData = useMemo(() => {
    const withProgram = leads.filter(l => l.program).length;
    const withMsg = leads.filter(l => l.message).length;
    return [
      { label: 'Total Enquiries', value: totalLeads, pct: 100 },
      { label: 'With Program Interest', value: withProgram, pct: totalLeads ? Math.round((withProgram / totalLeads) * 100) : 0 },
      { label: 'With Email', value: withEmail, pct: totalLeads ? Math.round((withEmail / totalLeads) * 100) : 0 },
      { label: 'With Message / Note', value: withMsg, pct: totalLeads ? Math.round((withMsg / totalLeads) * 100) : 0 },
    ];
  }, [leads, totalLeads, withEmail]);

  const statCards = [
    {
      label: 'Total Leads',
      value: loading ? '—' : totalLeads.toLocaleString(),
      icon: <MdPeople />,
      color: 'linear-gradient(135deg, #ff6600, #f7971e)',
      change: `${thisWeekLeads} this week`,
      changeType: 'up',
    },
    {
      label: "Today's Leads",
      value: loading ? '—' : String(todayLeads),
      icon: <MdTrendingUp />,
      color: 'linear-gradient(135deg, #7c3aed, #a855f7)',
      change: 'added today',
      changeType: 'up',
    },
    {
      label: 'This Week',
      value: loading ? '—' : String(thisWeekLeads),
      icon: <MdEvent />,
      color: 'linear-gradient(135deg, #2563eb, #3b82f6)',
      change: 'last 7 days',
      changeType: 'up',
    },
    {
      label: 'With Email',
      value: loading ? '—' : String(withEmail),
      icon: <MdCheckCircle />,
      color: 'linear-gradient(135deg, #10b981, #34d399)',
      change: totalLeads ? `${Math.round((withEmail / totalLeads) * 100)}% of leads` : '0%',
      changeType: 'up',
    },
  ];

  return (
    <div>
      <FollowupPopup />
      {/* Today's tasks banner */}
      {todayFollowups.length > 0 && (
        <div style={{ background: '#fff7ed', border: '1.5px solid #fed7aa', borderRadius: 12, padding: '12px 20px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 12 }}>
          <MdToday style={{ color: '#ea580c', fontSize: 20, flexShrink: 0 }} />
          <span style={{ fontSize: 14, color: '#92400e', fontWeight: 600 }}>
            You have <strong style={{ color: '#ea580c' }}>{todayFollowups.length}</strong> follow-up{todayFollowups.length !== 1 ? 's' : ''} due today
            {todayMeetings.length > 0 && ` · ${todayMeetings.length} meeting${todayMeetings.length !== 1 ? 's' : ''}`}
          </span>
        </div>
      )}
      {/* Stats */}
      <div className="stats-grid">
        {statCards.map((card, i) => (
          <div key={card.label} className="stat-card"
            style={{ '--card-color': card.color, animationDelay: `${i * 0.08}s` }}>
            <div className="stat-icon" style={{ background: card.color }}>{card.icon}</div>
            <div className="stat-info">
              <h3>{card.value}</h3>
              <p>{card.label}</p>
              <div className={`stat-change ${card.changeType}`}>↑ {card.change}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Teacher Support Summary */}
      {tsIssues.length > 0 && (
        <div style={{ background: '#fff', borderRadius: 14, padding: '16px 20px', marginBottom: 20, border: '1.5px solid #f0e8de', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
            <MdSupportAgent style={{ color: '#ff6600', fontSize: 22, flexShrink: 0 }} />
            <div>
              <div style={{ fontWeight: 700, fontSize: 14, color: '#1e293b' }}>Teacher Support Desk</div>
              <div style={{ fontSize: 12, color: '#64748b' }}>
                <span style={{ color: '#ff6600', fontWeight: 700 }}>{tsIssues.filter(i => i.status !== 'Resolved').length}</span> open &nbsp;·&nbsp;
                <span style={{ color: '#ea580c', fontWeight: 700 }}>{tsIssues.filter(i => i.issue_type === 'Marketing Issue').length}</span> marketing &nbsp;·&nbsp;
                <span style={{ color: '#16a34a', fontWeight: 700 }}>{tsIssues.filter(i => i.status === 'Resolved').length}</span> resolved
              </div>
            </div>
          </div>
          <button onClick={() => navigate('/teacher-support')} style={{ padding: '7px 16px', borderRadius: 8, background: 'linear-gradient(135deg,#ff6600,#f97316)', color: '#fff', border: 'none', fontWeight: 700, cursor: 'pointer', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
            View All <MdArrowForward size={14} />
          </button>
        </div>
      )}

      {/* Main Grid */}
      <div className="dashboard-grid">
        {/* Left Column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* Weekly Chart */}
          <div className="content-card">
            <div className="section-header">
              <div>
                <h2>Weekly Leads</h2>
                <p>New leads this week (live from database)</p>
              </div>
              <button className="btn btn-secondary btn-sm" onClick={refetch} disabled={loading}>
                <MdRefresh style={{ animation: loading ? 'App-logo-spin 1s linear infinite' : 'none' }} /> Refresh
              </button>
            </div>
            {loading ? (
              <div className="skeleton" style={{ height: 120, borderRadius: 10 }} />
            ) : (
              <>
                <div className="chart-bars">
                  {weekData.map(d => (
                    <div key={d.day} className="chart-bar-wrap">
                      <div style={{ flex: 1, display: 'flex', alignItems: 'flex-end', width: '100%' }}>
                        <div className="chart-bar" style={{ height: d.height }} title={`${d.leads} leads`} />
                      </div>
                      <span className="chart-label">{d.day}</span>
                    </div>
                  ))}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12, fontSize: 12, color: 'var(--text-muted)' }}>
                  <span>Total this week: <strong style={{ color: 'var(--primary)' }}>{weekTotal} leads</strong></span>
                  <span>Peak: <strong>{weekPeak.day} ({weekPeak.leads})</strong></span>
                </div>
              </>
            )}
          </div>

          {/* Recent Leads */}
          <div className="content-card">
            <div className="section-header">
              <div>
                <h2>Recent Leads</h2>
                <p>Latest {recentLeads.length} from Supabase</p>
              </div>
              <button className="btn btn-secondary btn-sm" onClick={() => navigate('/leads')}>
                View All <MdArrowForward />
              </button>
            </div>
            {loading ? (
              [1, 2, 3, 4].map(i => (
                <div key={i} style={{ display: 'flex', gap: 12, padding: '12px 0', borderBottom: '1px solid rgba(0,0,0,0.04)', alignItems: 'center' }}>
                  <div className="skeleton" style={{ width: 30, height: 30, borderRadius: 8, flexShrink: 0 }} />
                  <div className="skeleton" style={{ width: '20%', height: 13, borderRadius: 4 }} />
                  <div className="skeleton" style={{ width: '16%', height: 13, borderRadius: 4 }} />
                  <div className="skeleton" style={{ width: '13%', height: 13, borderRadius: 4 }} />
                </div>
              ))
            ) : recentLeads.length === 0 ? (
              <div className="empty-state"><div className="empty-icon">📋</div><p>No leads yet.</p></div>
            ) : (
              <div className="table-wrapper">
                <table className="crm-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Program</th>
                      <th>City</th>
                      <th>Phone</th>
                      <th>Added</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentLeads.map(lead => (
                      <tr key={lead.id}>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{ width: 28, height: 28, borderRadius: 7, background: 'var(--gradient)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>
                              {(lead.name || '?').charAt(0).toUpperCase()}
                            </div>
                            <span style={{ fontWeight: 600 }}>{lead.name || '—'}</span>
                          </div>
                        </td>
                        <td>{lead.program || '—'}</td>
                        <td>{lead.city || '—'}</td>
                        <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{lead.phone || '—'}</td>
                        <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>{formatTimeAgo(lead.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Right Column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* Lead Quality Funnel */}
          <div className="content-card">
            <div className="section-header"><h2>Lead Quality Funnel</h2></div>
            {loading ? (
              [1, 2, 3, 4].map(i => <div key={i} className="skeleton" style={{ height: 38, borderRadius: 8, marginBottom: 10 }} />)
            ) : (
              funnelData.map(f => (
                <div key={f.label} className="progress-bar-wrap">
                  <div className="progress-bar-label">
                    <span>{f.label}</span>
                    <span style={{ fontWeight: 600, color: 'var(--text-dark)' }}>{f.value}</span>
                  </div>
                  <div className="progress-bar">
                    <div className="progress-fill" style={{ width: `${f.pct}%` }} />
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Today's Tasks Overview */}
          <div className="content-card">
            <div className="section-header">
              <div><h2>Today's Tasks</h2><p>Follow-ups &amp; meetings due today</p></div>
              <button className="btn btn-secondary btn-sm" onClick={() => navigate('/todaytasks')}>
                View All <MdArrowForward />
              </button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 4 }}>
              <div style={{ background: 'rgba(234,88,12,0.07)', borderRadius: 12, padding: '14px 16px', border: '1.5px solid rgba(234,88,12,0.15)', cursor: 'pointer' }} onClick={() => navigate('/todaytasks')}>
                <div style={{ fontSize: 28, fontWeight: 800, color: '#ea580c' }}>{todayFollowups.length}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>Follow-ups due</div>
              </div>
              <div style={{ background: 'rgba(37,99,235,0.07)', borderRadius: 12, padding: '14px 16px', border: '1.5px solid rgba(37,99,235,0.15)', cursor: 'pointer' }} onClick={() => navigate('/todaytasks')}>
                <div style={{ fontSize: 28, fontWeight: 800, color: '#2563eb' }}>{todayMeetings.length}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>Meetings today</div>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="content-card">
            <div className="section-header"><h2>Quick Actions</h2></div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }}
                onClick={() => navigate('/leads')}>
                <MdPeople /> View All Leads
              </button>
              <button className="btn btn-secondary" style={{ width: '100%', justifyContent: 'center' }}
                onClick={() => navigate('/kanban')}>
                <MdApps /> Kanban Board
              </button>
              <button className="btn btn-secondary" style={{ width: '100%', justifyContent: 'center' }}
                onClick={() => navigate('/meetings')}>
                <MdEvent /> Schedule Meeting
              </button>
              <button className="btn btn-secondary" style={{ width: '100%', justifyContent: 'center' }}
                onClick={() => navigate('/todaytasks')}>
                <MdToday /> Today's Tasks
              </button>
              <button className="btn btn-secondary" style={{ width: '100%', justifyContent: 'center' }}
                onClick={() => navigate('/teacher-support')}>
                <MdSupportAgent /> Teacher Support
              </button>
              <button className="btn btn-whatsapp" style={{ width: '100%', justifyContent: 'center' }}
                onClick={() => navigate('/whatsapp')}>
                <FaWhatsapp /> Bulk WhatsApp
              </button>
            </div>
          </div>

          {/* Recent Activity */}
          <div className="content-card">
            <div className="section-header"><h2>Recent Activity</h2></div>
            {loading ? (
              [1, 2, 3].map(i => <div key={i} className="skeleton" style={{ height: 40, borderRadius: 8, marginBottom: 8 }} />)
            ) : activities.length === 0 ? (
              <div className="empty-state"><div className="empty-icon">📋</div><p>No activity yet.</p></div>
            ) : (
              activities.map((act, i) => (
                <div key={i} className="activity-item">
                  <div className="activity-dot" style={{ background: act.color }} />
                  <div>
                    <div className="activity-text">{act.text}</div>
                    <div className="activity-time">{act.time}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
