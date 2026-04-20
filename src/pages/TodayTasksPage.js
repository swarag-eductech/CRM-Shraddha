import React, { useState } from 'react';
import { MdToday, MdEvent, MdPhone, MdVideocam, MdRefresh, MdBlock } from 'react-icons/md';
import { FaWhatsapp } from 'react-icons/fa';
import { useTodayTasks } from '../hooks/useTodayTasks';
import { dismissFollowup } from '../api';
import { formatIST } from '../utils/time';

export default function TodayTasksPage() {
  const { followups: rawFollowups, meetings, loading, refetch: refresh } = useTodayTasks();
  const [dismissed, setDismissed] = useState(new Set());

  const followups = rawFollowups.filter(f => !dismissed.has(f.id));

  const handleDismiss = async (followupId) => {
    try {
      await dismissFollowup(followupId);
      setDismissed(prev => new Set([...prev, followupId]));
    } catch (err) { alert('Dismiss failed: ' + err.message); }
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }} className="today-layout">
      <style>{`@media(max-width:800px){.today-layout{grid-template-columns:1fr!important}}`}</style>

      {/* Follow-ups */}
      <div className="content-card">
        <div className="section-header">
          <div>
            <h2>Today's Follow-ups</h2>
            <p>{followups.length} pending</p>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={refresh} disabled={loading}>
            <MdRefresh /> Refresh
          </button>
        </div>

        {loading ? (
          [1, 2, 3].map((i) => (
            <div key={i} style={{ display: 'flex', gap: 12, padding: '14px 0', borderBottom: '1px solid #f9f0e8', alignItems: 'center' }}>
              <div className="skeleton" style={{ width: 42, height: 42, borderRadius: 10, flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div className="skeleton" style={{ width: '45%', height: 13, borderRadius: 4, marginBottom: 6 }} />
                <div className="skeleton" style={{ width: '65%', height: 11, borderRadius: 4 }} />
              </div>
            </div>
          ))
        ) : followups.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">✅</div>
            <p>No follow-ups due today.</p>
          </div>
        ) : (
          followups.map((f) => {
            const lead = f.ttp_leads || {};
            return (
              <div
                key={f.id}
                style={{
                  display: 'flex', alignItems: 'flex-start', gap: 12,
                  padding: '14px 0', borderBottom: '1px solid #f9f0e8',
                }}
              >
                <div style={{
                  width: 40, height: 40, borderRadius: 10,
                  background: f.reminder_sent ? 'rgba(16,185,129,0.1)' : 'rgba(234,88,12,0.1)',
                  color: f.reminder_sent ? '#16a34a' : '#ea580c',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 18, flexShrink: 0, fontWeight: 700,
                }}>
                  {f.followup_number || '?'}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 700 }}>{lead.name || '—'}</div>
                  {lead.phone && (
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      <MdPhone size={11} style={{ verticalAlign: 'middle' }} /> {lead.phone}
                    </div>
                  )}
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                    Follow-up #{f.followup_number} &bull; {formatIST(f.next_followup_at).shortDT}
                  </div>
                  {f.note && (
                    <div style={{
                      fontSize: 12, marginTop: 4, padding: '6px 10px',
                      background: '#fdf6ee', borderRadius: 6, color: '#6b4c2a',
                    }}>
                      {f.note}
                    </div>
                  )}
                  {f.reminder_sent && (
                    <span style={{
                      display: 'inline-block', marginTop: 4, fontSize: 10, padding: '2px 8px',
                      background: 'rgba(16,185,129,0.1)', color: '#16a34a', borderRadius: 20,
                    }}>
                      Reminder Sent
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-end', flexShrink: 0 }}>
                  <button
                    onClick={() => handleDismiss(f.id)}
                    style={{ background: '#fff7ed', border: '1px solid #fed7aa', color: '#ea580c', borderRadius: 7, padding: '4px 8px', fontSize: 11, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3, whiteSpace: 'nowrap' }}
                  >
                    <MdBlock size={11} /> Dismiss
                  </button>
                  {lead.phone && (
                    <button
                      className="btn btn-whatsapp btn-sm"
                      style={{ flexShrink: 0 }}
                      onClick={() => {
                        const msg = encodeURIComponent(
                          `Hello ${lead.name}! Just a friendly follow-up from Shraddha Institute. Ready to take the next step? 🙏`
                        );
                        window.open(`https://wa.me/91${lead.phone}?text=${msg}`, '_blank', 'noopener,noreferrer');
                      }}
                    >
                      <FaWhatsapp />
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Meetings */}
      <div className="content-card">
        <div className="section-header">
          <div>
            <h2>Today's Meetings</h2>
            <p>{meetings.length} scheduled</p>
          </div>
          <MdToday style={{ fontSize: 22, color: 'var(--primary)', opacity: 0.5 }} />
        </div>

        {loading ? (
          [1, 2].map((i) => (
            <div key={i} style={{ display: 'flex', gap: 12, padding: '14px 0', borderBottom: '1px solid #f9f0e8', alignItems: 'center' }}>
              <div className="skeleton" style={{ width: 42, height: 42, borderRadius: 10, flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div className="skeleton" style={{ width: '40%', height: 13, borderRadius: 4, marginBottom: 6 }} />
                <div className="skeleton" style={{ width: '55%', height: 11, borderRadius: 4 }} />
              </div>
            </div>
          ))
        ) : meetings.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📅</div>
            <p>No meetings scheduled for today.</p>
          </div>
        ) : (
          meetings.map((m) => {
            const lead = m.ttp_leads || {};
            const now = new Date();
            const diffMin = Math.round((new Date(m.meeting_datetime) - now) / 60000);
            const soon = diffMin > 0 && diffMin <= 30;
            const started = diffMin <= 0;
            return (
              <div
                key={m.id}
                style={{
                  display: 'flex', alignItems: 'flex-start', gap: 12,
                  padding: '14px 0', borderBottom: '1px solid #f9f0e8',
                  borderLeft: soon ? '3px solid #ea580c' : started ? '3px solid #16a34a' : '3px solid transparent',
                  paddingLeft: (soon || started) ? 10 : 0,
                }}
              >
                <div style={{
                  width: 40, height: 40, borderRadius: 10,
                  background: soon ? 'rgba(234,88,12,0.1)' : 'rgba(37,99,235,0.1)',
                  color: soon ? '#ea580c' : '#2563eb',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 20, flexShrink: 0,
                }}>
                  <MdEvent />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 700 }}>{lead.name || '—'}</div>
                  {lead.phone && (
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      <MdPhone size={11} style={{ verticalAlign: 'middle' }} /> {lead.phone}
                    </div>
                  )}
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                    🕐 {formatIST(m.meeting_datetime).shortDT}
                    {soon && <span style={{ marginLeft: 6, color: '#ea580c', fontWeight: 700 }}>in {diffMin}m</span>}
                    {started && diffMin > -60 && <span style={{ marginLeft: 6, color: '#16a34a', fontWeight: 700 }}>In progress</span>}
                  </div>
                  {m.meeting_link && (
                    <a
                      href={m.meeting_link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="meeting-link"
                      style={{ marginTop: 4, display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12 }}
                    >
                      <MdVideocam /> Join Meeting
                    </a>
                  )}
                </div>
                {lead.phone && (
                  <button
                    className="btn btn-whatsapp btn-sm"
                    style={{ flexShrink: 0 }}
                    onClick={() => {
                      const msg = encodeURIComponent(
                        `Hello ${lead.name}! Your meeting is at ${formatIST(m.meeting_datetime).shortDT} today.\n${m.meeting_link ? `Link: ${m.meeting_link}` : ''}\n– Shraddha Institute`
                      );
                      window.open(`https://wa.me/91${lead.phone}?text=${msg}`, '_blank', 'noopener,noreferrer');
                    }}
                  >
                    <FaWhatsapp />
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
