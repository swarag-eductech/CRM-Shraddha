import React, { useState, useEffect } from 'react';
import { MdClose, MdPhone, MdAccessTime, MdToday, MdBlock } from 'react-icons/md';
import { FaWhatsapp } from 'react-icons/fa';
import { supabase } from '../supabaseClient';
import { dismissFollowup } from '../api';
import { formatIST } from '../utils/time';

function formatTime(dt) {
  if (!dt) return '—';
  return formatIST(dt).timeOnly;
}

export default function FollowupPopup() {
  const [followups, setFollowups] = useState([]);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const fetchToday = async () => {
      const today = new Date();
      const start = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();
      const end   = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59).toISOString();

      const { data } = await supabase
        .from('ttp_followups')
        .select('*, ttp_leads(id, name, phone)')
        .gte('next_followup_at', start)
        .lte('next_followup_at', end)
        .eq('status', 'pending')
        .eq('is_deleted', false)
        .eq('dismissed', false)
        .order('next_followup_at', { ascending: true });

      if (data && data.length > 0) {
        setFollowups(data);
        setVisible(true);
      }
    };

    // Small delay so dashboard renders first
    const t = setTimeout(fetchToday, 600);
    return () => clearTimeout(t);
  }, []);

  if (!visible) return null;

  const handleDismissOne = async (followupId) => {
    try {
      await dismissFollowup(followupId);
      const remaining = followups.filter(f => f.id !== followupId);
      setFollowups(remaining);
      if (remaining.length === 0) setVisible(false);
    } catch (err) {
      alert('Failed to dismiss: ' + err.message);
    }
  };

  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
        zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 16, animation: 'fadeIn 0.2s ease',
      }}
      onClick={() => setVisible(false)}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#fff', borderRadius: 20, width: '100%', maxWidth: 480,
          boxShadow: '0 24px 80px rgba(193,107,5,0.2)',
          border: '1.5px solid rgba(193,107,5,0.18)',
          overflow: 'hidden', animation: 'fadeInUp 0.3s ease',
        }}
      >
        {/* Header */}
        <div style={{
          background: 'linear-gradient(135deg, #ff6600, #f7971e)',
          padding: '18px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 38, height: 38, borderRadius: 10, background: 'rgba(255,255,255,0.2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20,
            }}>
              <MdToday style={{ color: '#fff' }} />
            </div>
            <div>
              <h3 style={{ color: '#fff', margin: 0, fontSize: 16, fontWeight: 800 }}>
                Today's Follow-ups
              </h3>
              <p style={{ color: 'rgba(255,255,255,0.85)', margin: 0, fontSize: 12 }}>
                {followups.length} pending for today
              </p>
            </div>
          </div>
          <button
            onClick={() => setVisible(false)}
            style={{
              background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: 8,
              width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#fff', cursor: 'pointer', fontSize: 18,
            }}
          >
            <MdClose />
          </button>
        </div>

        {/* List */}
        <div style={{ maxHeight: 360, overflowY: 'auto', padding: '4px 0' }}>
          {followups.map((f, idx) => {
            const lead = f.ttp_leads || {};
            const now = new Date();
            const dt = f.next_followup_at ? new Date(f.next_followup_at) : null;
            const isOverdue = dt && dt < now;
            const isUpcoming = dt && !isOverdue && (dt - now) < 2 * 60 * 60 * 1000;

            const rowBg = isOverdue
              ? 'rgba(239,68,68,0.05)'
              : isUpcoming
              ? 'rgba(245,158,11,0.07)'
              : 'transparent';
            const rowBorder = isOverdue
              ? '1px solid #fca5a5'
              : isUpcoming
              ? '1px solid #fde68a'
              : `1px solid ${idx < followups.length - 1 ? '#fef3e8' : 'transparent'}`;
            const accentColor = isOverdue ? '#dc2626' : isUpcoming ? '#d97706' : '#ea580c';
            const timeBg = isOverdue ? '#fee2e2' : isUpcoming ? '#fef3c7' : '#fff7ed';

            return (
              <div
                key={f.id}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '14px 20px',
                  background: rowBg,
                  borderBottom: rowBorder,
                  animation: `fadeInUp 0.3s ease ${idx * 0.07}s both`,
                }}
              >
                {/* Number bubble */}
                <div style={{
                  width: 38, height: 38, borderRadius: 10, flexShrink: 0,
                  background: isOverdue ? '#fee2e2' : isUpcoming ? '#fef3c7' : 'linear-gradient(135deg, #fff7ed, #ffedd5)',
                  border: `1.5px solid ${isOverdue ? '#fca5a5' : isUpcoming ? '#fde68a' : '#fed7aa'}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 16, fontWeight: 800, color: accentColor,
                }}>
                  {f.followup_number || idx + 1}
                </div>

                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: '#1a1a1a' }}>
                      {lead.name || '—'}
                    </span>
                    {isOverdue && (
                      <span style={{ fontSize: 10, fontWeight: 800, padding: '1px 7px', borderRadius: 6, background: '#fee2e2', color: '#dc2626', border: '1px solid #fca5a5' }}>
                        OVERDUE
                      </span>
                    )}
                    {isUpcoming && (
                      <span style={{ fontSize: 10, fontWeight: 800, padding: '1px 7px', borderRadius: 6, background: '#fef3c7', color: '#d97706', border: '1px solid #fde68a' }}>
                        SOON
                      </span>
                    )}
                  </div>
                  {lead.phone && (
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
                      <MdPhone size={12} /> {lead.phone}
                    </div>
                  )}
                  {f.note && (
                    <div style={{ fontSize: 11, color: isOverdue ? '#9b1c1c' : '#92400e', marginTop: 3, fontStyle: 'italic', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {f.note}
                    </div>
                  )}
                </div>

                {/* Time + WA + Dismiss */}
                <div style={{ flexShrink: 0, textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
                  <div style={{
                    fontSize: 12, fontWeight: 700, color: accentColor,
                    display: 'flex', alignItems: 'center', gap: 4,
                    background: timeBg, padding: '3px 8px', borderRadius: 8,
                  }}>
                    <MdAccessTime size={12} /> {formatTime(f.next_followup_at)}
                  </div>
                  {lead.phone && (
                    <button
                      style={{
                        background: '#25D366', color: '#fff', border: 'none',
                        borderRadius: 7, padding: '4px 10px', fontSize: 11,
                        cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4,
                        fontWeight: 600,
                      }}
                      onClick={() => {
                        const msg = encodeURIComponent(
                          `Hello ${lead.name}! This is a follow-up reminder from Shraddha Institute. Looking forward to connecting with you today! 🙏`
                        );
                        window.open(`https://wa.me/91${lead.phone}?text=${msg}`, '_blank', 'noopener,noreferrer');
                      }}
                    >
                      <FaWhatsapp /> Remind
                    </button>
                  )}
                  <button
                    title="Dismiss this follow-up"
                    onClick={() => handleDismissOne(f.id)}
                    style={{ background: '#fff7ed', border: '1px solid #fed7aa', color: '#ea580c', borderRadius: 7, padding: '4px 10px', fontSize: 11, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
                  >
                    <MdBlock size={11} /> Dismiss
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div style={{
          padding: '14px 20px', background: '#fdf6ee',
          borderTop: '1px solid #fce4c0', display: 'flex', justifyContent: 'flex-end', gap: 10,
        }}>
          <button
            onClick={() => setVisible(false)}
            style={{
              background: '#fff', border: '1.5px solid #fed7aa', color: '#ea580c',
              borderRadius: 10, padding: '8px 20px', cursor: 'pointer',
              fontSize: 13, fontWeight: 600,
            }}
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}
