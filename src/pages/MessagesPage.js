import React, { useState, useEffect, useRef, useCallback } from 'react';
import { MdSend, MdRefresh, MdPhone } from 'react-icons/md';
import { FaWhatsapp } from 'react-icons/fa';
import { supabase } from '../supabaseClient';
import { useLeads } from '../hooks/useLeads';

export default function MessagesPage() {
  const { leads, loading } = useLeads();
  const [activeIdx, setActiveIdx] = useState(0);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef(null);

  const activeLead = leads[activeIdx];

  const fetchMessages = useCallback(async (leadId, showLoader = true) => {
    if (!leadId) return;
    if (showLoader) setLoadingMessages(true);
    const { data, error } = await supabase
      .from('ttp_messages')
      .select('*')
      .eq('lead_id', leadId)
      .order('created_at', { ascending: true });
    
    if (showLoader) setLoadingMessages(false);
    if (!error) setMessages(data || []);
  }, []);

  useEffect(() => {
    if (activeLead) {
      fetchMessages(activeLead.id);
      
      // Auto refresh chat every 3 seconds, but do not show loader on background refresh
      const interval = setInterval(() => {
        fetchMessages(activeLead.id, false);
      }, 3000);

      // We can also keep realtime as an extra layer
      const channel = supabase
        .channel(`messages_${activeLead.id}`)
        .on('postgres_changes', 
          { event: 'INSERT', schema: 'public', table: 'ttp_messages', filter: `lead_id=eq.${activeLead.id}` }, 
          (payload) => {
            setMessages(prev => {
              if (prev.find(m => m.id === payload.new.id)) return prev;
              return [...prev, payload.new];
            });
          }
        )
        .subscribe();

      return () => {
        clearInterval(interval);
        supabase.removeChannel(channel);
      };
    }
  }, [activeLead, fetchMessages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async (e) => {
    if (e) e.preventDefault();
    if (!input.trim() || !activeLead || isSending) return;

    const textToSend = input.trim();
    setInput('');
    setIsSending(true);

    try {
      // 1. Always save to DB directly (reliable, immediate)
      const { data: newMsg, error: dbError } = await supabase
        .from('ttp_messages')
        .insert([{
          lead_id: activeLead.id,
          text: textToSend,
          message_text: textToSend,
          direction: 'outgoing'
        }])
        .select()
        .single();

      if (dbError) throw dbError;

      // 2. Optimistic UI update
      setMessages(prev => prev.find(m => m.id === newMsg.id) ? prev : [...prev, newMsg]);

      // 3. Trigger WhatsApp delivery via Edge Function (best-effort)
      const { error: fnError } = await supabase.functions.invoke('whatsapp-webhook', {
        body: {
          manual: true,
          leadId: activeLead.id,
          message: textToSend
        },
        headers: {
          'x-interakt-secret': 'mysecret123'
        }
      });

      if (fnError) {
        console.warn('WhatsApp delivery via Interakt failed:', fnError.message);
      }

    } catch (err) {
      alert('Error sending message: ' + err.message);
    } finally {
      setIsSending(false);
    }
  };

  const openWhatsAppFallback = () => {
    if (!activeLead?.phone) return;
    const msg = encodeURIComponent(input || `Hello ${activeLead.name}! 👋 This is Shraddha Institute.`);
    window.open(`https://wa.me/91${activeLead.phone}?text=${msg}`, '_blank', 'noopener,noreferrer');
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 20, height: 'calc(100vh - 160px)', minHeight: 500 }}
      className="messages-layout">
      <style>{`
        @media(max-width:700px){.messages-layout{grid-template-columns:1fr!important}}
        .msg-outbound { background: var(--gradient); color: #fff; align-self: flex-end; border-radius: 14px 14px 0 14px; }
        .msg-inbound { background: #fff; color: var(--text-dark); align-self: flex-start; border-radius: 14px 14px 14px 0; border: 1px solid var(--border); }
      `}</style>

      {/* Leads List */}
      <div className="content-card" style={{ padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '16px 16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ fontSize: 15, fontWeight: 700 }}>Conversations</h3>
          <span style={{ fontSize: 11, background: 'rgba(255,102,0,0.1)', color: 'var(--primary)', padding: '2px 8px', borderRadius: 10, fontWeight: 700 }}>{leads.length}</span>
        </div>
        <div style={{ overflowY: 'auto', flex: 1 }}>
          {loading ? (
            [1,2,3,4,5].map(i => <div key={i} className="skeleton" style={{ height: 60, margin: '10px 16px', borderRadius: 10 }} />)
          ) : (
            leads.map((lead, i) => (
              <div key={lead.id} onClick={() => setActiveIdx(i)} style={{
                padding: '12px 16px', cursor: 'pointer', borderBottom: '1px solid rgba(0,0,0,0.03)',
                background: activeIdx === i ? 'rgba(255,102,0,0.04)' : 'transparent',
                borderLeft: activeIdx === i ? '3px solid var(--primary)' : '3px solid transparent',
              }}>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  <div style={{ width: 38, height: 38, borderRadius: 10, background: 'var(--gradient)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700 }}>
                    {(lead.name || '?').charAt(0).toUpperCase()}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{lead.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{lead.city || 'No location'}</div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Chat Area */}
      <div className="content-card" style={{ padding: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {!activeLead ? (
          <div className="empty-state" style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <div className="empty-icon">💬</div>
            <p>Select a lead to view history</p>
          </div>
        ) : (
          <>
            {/* Header */}
            <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--border)', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'space-between', zIndex: 5 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 42, height: 42, borderRadius: 12, background: 'var(--gradient)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700 }}>
                  {(activeLead.name || '?').charAt(0).toUpperCase()}
                </div>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700 }}>{activeLead.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <MdPhone size={10} /> +91 {activeLead.phone}
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-secondary btn-sm" onClick={() => fetchMessages(activeLead.id)}>
                  <MdRefresh size={18} />
                </button>
                <button className="btn btn-whatsapp btn-sm" onClick={openWhatsAppFallback}>
                  <FaWhatsapp /> Open WA App
                </button>
              </div>
            </div>

            {/* Messages List */}
            <div style={{ flex: 1, padding: '20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 14, background: '#fcfaf8' }}>
              {loadingMessages ? (
                <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>Loading chat...</div>
              ) : messages.length === 0 ? (
                <div className="empty-state" style={{ opacity: 0.6 }}>
                  <div style={{ fontSize: 32 }}>✨</div>
                  <p>Send a message to {activeLead.name}</p>
                </div>
              ) : (
                messages.map(msg => (
                  <div key={msg.id} className={`msg-${msg.direction === 'incoming' || msg.direction === 'inbound' ? 'inbound' : 'outbound'}`} style={{
                    maxWidth: '75%', padding: '10px 14px', position: 'relative',
                    boxShadow: '0 2px 5px rgba(0,0,0,0.04)',
                  }}>
                    <div style={{ fontSize: 13, lineHeight: 1.5 }}>{msg.text || msg.message_text}</div>
                    <div style={{ fontSize: 9, marginTop: 4, textAlign: 'right', opacity: 0.8 }}>
                      {new Date(msg.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Overlay */}
            <form onSubmit={sendMessage} style={{ padding: '16px 20px', borderTop: '1px solid var(--border)', background: '#fff', display: 'flex', gap: 10 }}>
              <input
                className="form-input"
                placeholder={`Chat with ${activeLead.name.split(' ')[0]}...`}
                style={{ flex: 1, height: 46 }}
                value={input}
                onChange={e => setInput(e.target.value)}
              />
              <button 
                type="submit" 
                className="btn btn-primary" 
                style={{ height: 46, padding: '0 20px' }}
                disabled={!input.trim() || isSending}
              >
                <MdSend size={20} style={{ marginRight: 8 }} />
                {isSending ? 'Sending...' : 'Send'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
