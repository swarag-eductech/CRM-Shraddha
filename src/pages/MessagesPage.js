import React, { useState, useEffect, useRef, useCallback } from 'react';
import { MdSend, MdRefresh, MdPhone, MdAttachFile, MdClose, MdPictureAsPdf, MdInsertDriveFile } from 'react-icons/md';
import { FaWhatsapp } from 'react-icons/fa';
import { supabase } from '../supabaseClient';
import { useLeads } from '../hooks/useLeads';

const ACCEPTED_TYPES = {
  'image/jpeg': 'image', 'image/png': 'image', 'image/gif': 'image', 'image/webp': 'image',
  'video/mp4': 'video', 'video/quicktime': 'video', 'video/webm': 'video',
  'application/pdf': 'pdf',
};
const MAX_SIZE_MB = 20;

export default function MessagesPage() {
  const { leads, loading } = useLeads();
  const [activeIdx, setActiveIdx] = useState(0);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [attachment, setAttachment] = useState(null); // { file, previewUrl, mediaType, name }
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);

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
    const hasText = input.trim().length > 0;
    const hasFile = !!attachment;
    if ((!hasText && !hasFile) || !activeLead || isSending) return;

    const textToSend = input.trim();
    setInput('');
    setIsSending(true);
    const pendingAttachment = attachment;
    setAttachment(null);

    try {
      let mediaUrl = null;
      let mediaType = null;

      // 1. Upload file to storage if attached
      if (pendingAttachment) {
        mediaUrl  = await uploadAttachment(activeLead.id, pendingAttachment.file, pendingAttachment.mediaType);
        mediaType = pendingAttachment.mediaType;
        if (pendingAttachment.previewUrl) URL.revokeObjectURL(pendingAttachment.previewUrl);
      }

      // 2. Save to DB
      const { data: newMsg, error: dbError } = await supabase
        .from('ttp_messages')
        .insert([{
          lead_id: activeLead.id,
          text: textToSend || null,
          message_text: textToSend || null,
          direction: 'outgoing',
          ...(mediaUrl ? { media_url: mediaUrl, media_type: mediaType } : {}),
        }])
        .select()
        .single();

      if (dbError) throw dbError;

      // 3. Optimistic UI update
      setMessages(prev => prev.find(m => m.id === newMsg.id) ? prev : [...prev, newMsg]);

      // 4. Trigger WhatsApp text delivery (best-effort, media URL appended if present)
      const waText = [textToSend, mediaUrl].filter(Boolean).join('\n');
      if (waText) {
        const { error: fnError } = await supabase.functions.invoke('whatsapp-webhook', {
          body: { manual: true, leadId: activeLead.id, message: waText },
          headers: { 'x-interakt-secret': 'mysecret123' },
        });
        if (fnError) console.warn('WhatsApp delivery failed:', fnError.message);
      }

    } catch (err) {
      alert('Error sending message: ' + err.message);
    } finally {
      setIsSending(false);
    }
  };

  // ── File Attachment ──────────────────────────────────────────────────────────
  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!fileInputRef.current) return;
    fileInputRef.current.value = '';          // reset so same file can be re-selected
    if (!file) return;

    const mediaType = ACCEPTED_TYPES[file.type];
    if (!mediaType) {
      alert('Unsupported file type. Please select an image (JPG/PNG/GIF/WEBP), video (MP4/WEBM) or PDF.');
      return;
    }
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      alert(`File too large. Maximum allowed size is ${MAX_SIZE_MB} MB.`);
      return;
    }

    const previewUrl = mediaType === 'image' ? URL.createObjectURL(file) : null;
    setAttachment({ file, previewUrl, mediaType, name: file.name });
  };

  const removeAttachment = () => {
    if (attachment?.previewUrl) URL.revokeObjectURL(attachment.previewUrl);
    setAttachment(null);
  };

  const uploadAttachment = async (leadId, file, mediaType) => {
    const ext = file.name.split('.').pop();
    const path = `messages/${leadId}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage
      .from('crm-attachments')
      .upload(path, file, { contentType: file.type, upsert: false });
    if (error) throw error;
    const { data } = supabase.storage.from('crm-attachments').getPublicUrl(path);
    return data.publicUrl;
  };
  // ─────────────────────────────────────────────────────────────────────────────

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
        .msg-media-img { max-width: 220px; border-radius: 10px; display: block; margin-bottom: 6px; cursor: pointer; }
        .msg-media-video { max-width: 260px; border-radius: 10px; display: block; margin-bottom: 6px; }
        .msg-pdf-link { display: flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 600; text-decoration: none; background: rgba(0,0,0,0.08); padding: 6px 10px; border-radius: 8px; margin-bottom: 6px; }
        .attach-preview { display: flex; align-items: center; gap: 10px; padding: 8px 12px; background: rgba(255,102,0,0.06); border-top: 1px solid var(--border); }
        .attach-thumb { width: 42px; height: 42px; border-radius: 8px; object-fit: cover; }
        .btn-attach { background: none; border: 1.5px solid var(--border); border-radius: 10px; padding: 0 12px; height: 46px; cursor: pointer; display: flex; align-items: center; color: var(--text-muted); transition: border-color .2s; }
        .btn-attach:hover { border-color: var(--primary); color: var(--primary); }
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
                    {/* Media attachment */}
                    {msg.media_url && msg.media_type === 'image' && (
                      <img
                        src={msg.media_url}
                        alt="attachment"
                        className="msg-media-img"
                        onClick={() => window.open(msg.media_url, '_blank', 'noopener,noreferrer')}
                      />
                    )}
                    {msg.media_url && msg.media_type === 'video' && (
                      <video src={msg.media_url} controls className="msg-media-video" />
                    )}
                    {msg.media_url && msg.media_type === 'pdf' && (
                      <a href={msg.media_url} target="_blank" rel="noopener noreferrer"
                        className="msg-pdf-link"
                        style={{ color: msg.direction === 'outgoing' ? '#fff' : 'var(--primary)' }}>
                        <MdPictureAsPdf size={18} /> View PDF
                      </a>
                    )}
                    {msg.media_url && !['image','video','pdf'].includes(msg.media_type) && (
                      <a href={msg.media_url} target="_blank" rel="noopener noreferrer"
                        className="msg-pdf-link"
                        style={{ color: msg.direction === 'outgoing' ? '#fff' : 'var(--primary)' }}>
                        <MdInsertDriveFile size={18} /> Download File
                      </a>
                    )}
                    {/* Text */}
                    {(msg.text || msg.message_text) && (
                      <div style={{ fontSize: 13, lineHeight: 1.5 }}>{msg.text || msg.message_text}</div>
                    )}
                    <div style={{ fontSize: 9, marginTop: 4, textAlign: 'right', opacity: 0.8 }}>
                      {new Date(msg.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Overlay */}
            <div style={{ borderTop: '1px solid var(--border)', background: '#fff' }}>
              {/* Attachment preview strip */}
              {attachment && (
                <div className="attach-preview">
                  {attachment.mediaType === 'image' && (
                    <img src={attachment.previewUrl} alt="preview" className="attach-thumb" />
                  )}
                  {attachment.mediaType === 'video' && (
                    <div style={{ width: 42, height: 42, borderRadius: 8, background: 'var(--gradient)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <MdInsertDriveFile size={20} color="#fff" />
                    </div>
                  )}
                  {attachment.mediaType === 'pdf' && (
                    <div style={{ width: 42, height: 42, borderRadius: 8, background: '#e53935', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <MdPictureAsPdf size={20} color="#fff" />
                    </div>
                  )}
                  <div style={{ flex: 1, fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-muted)' }}>
                    {attachment.name}
                  </div>
                  <button onClick={removeAttachment} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}>
                    <MdClose size={18} />
                  </button>
                </div>
              )}
              <form onSubmit={sendMessage} style={{ padding: '12px 20px', display: 'flex', gap: 10, alignItems: 'center' }}>
                {/* Hidden file input */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/gif,image/webp,video/mp4,video/quicktime,video/webm,application/pdf"
                  style={{ display: 'none' }}
                  onChange={handleFileSelect}
                />
                {/* Attach button */}
                <button
                  type="button"
                  className="btn-attach"
                  title="Attach image, video or PDF (max 20 MB)"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <MdAttachFile size={20} />
                </button>
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
                  disabled={(!input.trim() && !attachment) || isSending}
                >
                  <MdSend size={20} style={{ marginRight: 8 }} />
                  {isSending ? 'Sending...' : 'Send'}
                </button>
              </form>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
