import React, { useState, useEffect, useRef } from 'react';
import { MdSend } from 'react-icons/md';
import { useLeads } from '../hooks/useLeads';

export default function MessagesPage() {
  const { leads, loading } = useLeads();
  const [activeIdx, setActiveIdx] = useState(0);
  const [input, setInput] = useState('');
  const [messagesMap, setMessagesMap] = useState({});
  const messagesEndRef = useRef(null);

  // When leads load, seed each lead's thread with their message if any
  useEffect(() => {
    if (leads.length === 0) return;
    setMessagesMap(prev => {
      const next = { ...prev };
      leads.forEach(l => {
        if (!next[l.id] && l.message) {
          next[l.id] = [{
            id: `seed-${l.id}`,
            text: l.message,
            mine: false,
            time: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
          }];
        } else if (!next[l.id]) {
          next[l.id] = [];
        }
      });
      return next;
    });
  }, [leads]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messagesMap, activeIdx]);

  const activeLead = leads[activeIdx];
  const messages = activeLead ? (messagesMap[activeLead.id] || []) : [];

  const send = () => {
    if (!input.trim() || !activeLead) return;
    const msg = {
      id: Date.now(),
      text: input.trim(),
      mine: true,
      time: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
    };
    setMessagesMap(prev => ({
      ...prev,
      [activeLead.id]: [...(prev[activeLead.id] || []), msg],
    }));
    setInput('');
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: 20, height: 'calc(100vh - 160px)', minHeight: 500 }}
      className="messages-layout">
      <style>{`@media(max-width:700px){.messages-layout{grid-template-columns:1fr!important}}`}</style>

      {/* Contacts */}
      <div className="content-card" style={{ padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '16px 16px 12px', borderBottom: '1px solid var(--border)', fontWeight: 700, fontSize: 15, flexShrink: 0 }}>
          Leads ({leads.length})
        </div>
        <div style={{ overflowY: 'auto', flex: 1 }}>
          {loading ? (
            [1,2,3,4,5].map(i => (
              <div key={i} style={{ padding: '14px 16px', display: 'flex', gap: 10, borderBottom: '1px solid rgba(0,0,0,0.04)', alignItems: 'center' }}>
                <div className="skeleton" style={{ width: 38, height: 38, borderRadius: '50%', flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div className="skeleton" style={{ width: '60%', height: 12, borderRadius: 4, marginBottom: 6 }} />
                  <div className="skeleton" style={{ width: '40%', height: 10, borderRadius: 4 }} />
                </div>
              </div>
            ))
          ) : leads.length === 0 ? (
            <div className="empty-state" style={{ padding: 24 }}>
              <div className="empty-icon">👥</div>
              <p>No leads yet.</p>
            </div>
          ) : (
            leads.map((lead, i) => (
              <div key={lead.id} onClick={() => setActiveIdx(i)} style={{
                padding: '12px 16px', cursor: 'pointer', transition: 'all 0.2s',
                borderBottom: '1px solid rgba(0,0,0,0.04)',
                background: activeIdx === i ? 'var(--bg-light)' : 'transparent',
                borderLeft: activeIdx === i ? '3px solid var(--primary)' : '3px solid transparent',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center', minWidth: 0 }}>
                    <div style={{
                      width: 36, height: 36, borderRadius: '50%', background: 'var(--gradient)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: '#fff', fontWeight: 700, fontSize: 13, flexShrink: 0
                    }}>{(lead.name || '?').charAt(0).toUpperCase()}</div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{lead.name || '—'}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {lead.message ? lead.message.slice(0, 30) + (lead.message.length > 30 ? '…' : '') : lead.phone || 'No message'}
                      </div>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: 6 }}>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{lead.city || ''}</div>
                    {(messagesMap[lead.id] || []).length > 0 && activeIdx !== i && (
                      <div style={{
                        width: 18, height: 18, borderRadius: '50%', background: 'var(--primary)',
                        color: '#fff', fontSize: 10, fontWeight: 700,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', marginLeft: 'auto', marginTop: 4
                      }}>{(messagesMap[lead.id] || []).length}</div>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Chat Window */}
      <div className="content-card" style={{ padding: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {!activeLead ? (
          <div className="empty-state" style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <div className="empty-icon">💬</div>
            <p>Select a lead to start chatting</p>
          </div>
        ) : (
          <>
            {/* Header */}
            <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12, background: '#fff', flexShrink: 0 }}>
              <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--gradient)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700 }}>
                {(activeLead.name || '?').charAt(0).toUpperCase()}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 700 }}>{activeLead.name || '—'}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  {activeLead.phone || ''}{activeLead.city ? ` · ${activeLead.city}` : ''}{activeLead.program ? ` · ${activeLead.program}` : ''}
                </div>
              </div>
              {activeLead.phone && (
                <a
                  href={`https://wa.me/91${activeLead.phone}?text=${encodeURIComponent(`Hello ${activeLead.name}! 👋 This is Shraddha Institute.`)}`}
                  target="_blank" rel="noopener noreferrer"
                  className="btn btn-whatsapp btn-sm"
                >
                  WhatsApp
                </a>
              )}
            </div>

            {/* Messages */}
            <div style={{ flex: 1, padding: '16px 20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
              {messages.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-muted)', fontSize: 13 }}>
                  No messages yet. Start the conversation!
                </div>
              ) : (
                messages.map(msg => (
                  <div key={msg.id} style={{ display: 'flex', justifyContent: msg.mine ? 'flex-end' : 'flex-start', animation: 'fadeInUp 0.2s ease' }}>
                    <div style={{
                      maxWidth: '72%', padding: '10px 14px',
                      borderRadius: msg.mine ? '16px 16px 0 16px' : '16px 16px 16px 0',
                      background: msg.mine ? 'var(--gradient)' : '#fff',
                      color: msg.mine ? '#fff' : 'var(--text-dark)',
                      fontSize: 13, lineHeight: 1.6,
                      boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                      border: msg.mine ? 'none' : '1px solid var(--border)',
                    }}>
                      {msg.text}
                      <div style={{ fontSize: 10, marginTop: 4, textAlign: 'right', opacity: 0.7, color: msg.mine ? 'rgba(255,255,255,0.8)' : 'var(--text-muted)' }}>
                        {msg.time}
                      </div>
                    </div>
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)', display: 'flex', gap: 10, alignItems: 'center', flexShrink: 0 }}>
              <input
                className="form-input"
                style={{ flex: 1 }}
                placeholder="Type a message..."
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && send()}
              />
              <button className="btn btn-primary" onClick={send} style={{ padding: '10px 14px' }}>
                <MdSend />
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
