import React, { useState, useEffect, useCallback } from 'react';
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';
import { MdRefresh, MdPeople, MdAccessTime, MdHistory } from 'react-icons/md';
import { supabase } from '../supabaseClient';
import { updateLeadStatus } from '../api';
import LeadModal from '../components/LeadModal';

/* react-beautiful-dnd v13 crashes in React 18+ Strict Mode without this wrapper */
function StrictModeDroppable({ children, ...props }) {
  const [enabled, setEnabled] = React.useState(false);
  React.useEffect(() => {
    const raf = requestAnimationFrame(() => setEnabled(true));
    return () => { cancelAnimationFrame(raf); setEnabled(false); };
  }, []);
  if (!enabled) return null;
  return <Droppable {...props}>{children}</Droppable>;
}

const COLUMNS = [
  { id: 'new',       label: 'New',       color: '#3b82f6', bg: 'rgba(59,130,246,0.07)',  dot: '#3b82f6' },
  { id: 'contacted', label: 'Contacted', color: '#8b5cf6', bg: 'rgba(139,92,246,0.07)', dot: '#8b5cf6' },
  { id: 'warm',      label: 'Warm',      color: '#f59e0b', bg: 'rgba(245,158,11,0.07)',  dot: '#f59e0b' },
  { id: 'converted', label: 'Converted', color: '#10b981', bg: 'rgba(16,185,129,0.07)', dot: '#10b981' },
  { id: 'dead',      label: 'Dead',      color: '#6b7280', bg: 'rgba(107,114,128,0.07)', dot: '#6b7280' },
];

function timeAgo(dateStr) {
  if (!dateStr) return '—';
  const diff = Math.floor((Date.now() - new Date(dateStr)) / 1000);
  if (diff < 60)    return 'just now';
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

/* ------------------------------------------------------------------ */
/* LeadCard — shows last followup + next followup, click opens modal   */
/* ------------------------------------------------------------------ */
function LeadCard({ lead, col, onClick, dragProvided, isDragging }) {
  const followups = lead.ttp_followups || [];
  const sorted = [...followups].sort((a, b) => new Date(a.next_followup_at) - new Date(b.next_followup_at));
  const lastDone = sorted.filter((f) => f.status === 'completed').slice(-1)[0];
  const nextPending = sorted.find((f) => f.status === 'pending');

  const fmtShort = (dt) => {
    if (!dt) return null;
    return new Date(dt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  };

  const now = new Date();
  const nextDt = nextPending?.next_followup_at ? new Date(nextPending.next_followup_at) : null;
  const isOverdue = nextDt && nextDt < now;
  const isUpcoming = nextDt && !isOverdue && (nextDt - now) < 2 * 60 * 60 * 1000;

  return (
    <div
      ref={dragProvided.innerRef}
      {...dragProvided.draggableProps}
      {...dragProvided.dragHandleProps}
      onClick={onClick}
      style={{
        ...dragProvided.draggableProps.style,
        background: '#fff',
        border: `1.5px solid ${isDragging ? col.color : isOverdue ? '#fca5a5' : 'rgba(0,0,0,0.07)'}`,
        borderRadius: 12, padding: '12px 14px', marginBottom: 10,
        cursor: 'pointer', userSelect: 'none',
        boxShadow: isDragging ? `0 12px 32px ${col.color}40` : isOverdue ? '0 2px 8px rgba(239,68,68,0.12)' : '0 1px 4px rgba(0,0,0,0.06)',
        opacity: isDragging ? 0.95 : 1,
        transition: 'box-shadow 0.15s, border-color 0.15s',
      }}
    >
      {/* Name row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <div style={{
          width: 30, height: 30, borderRadius: 8, flexShrink: 0,
          background: `linear-gradient(135deg, ${col.color}, ${col.color}99)`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#fff', fontSize: 12, fontWeight: 800,
        }}>
          {(lead.name || '?').charAt(0).toUpperCase()}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#1a1a1a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {lead.name || '—'}
          </div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
            {[lead.phone, lead.city].filter(Boolean).join(' · ')}
          </div>
        </div>
      </div>

      {/* Follow-up info */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {lastDone && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: '#64748b' }}>
            <MdHistory size={10} />
            <span>Last: {fmtShort(lastDone.next_followup_at)}</span>
          </div>
        )}
        {nextPending ? (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 700,
            color: isOverdue ? '#dc2626' : isUpcoming ? '#d97706' : '#16a34a',
          }}>
            <MdAccessTime size={10} />
            <span>
              {isOverdue ? '⚠ OVERDUE: ' : isUpcoming ? '⏰ Soon: ' : 'Next: '}
              {fmtShort(nextPending.next_followup_at)}
            </span>
          </div>
        ) : followups.length === 0 ? (
          <div style={{ fontSize: 10, color: '#f59e0b', fontWeight: 600 }}>No follow-up set</div>
        ) : (
          <div style={{ fontSize: 10, color: '#10b981', fontWeight: 600 }}>✓ All follow-ups done</div>
        )}
      </div>

      {/* Footer */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, alignItems: 'center' }}>
        <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>{timeAgo(lead.created_at)}</span>
        <span style={{
          fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 8,
          background: `${col.color}18`, color: col.color,
        }}>
          {followups.length} F/U
        </span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Main board                                                           */
/* ------------------------------------------------------------------ */
export default function LeadsKanbanPage() {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedLead, setSelectedLead] = useState(null);

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('ttp_leads')
      .select('id, name, phone, city, status, created_at, ttp_followups(id, next_followup_at, status)')
      .order('created_at', { ascending: false });
    setLoading(false);
    setLeads(data || []);
  }, []);

  useEffect(() => {
    fetchLeads();
    const ch = supabase
      .channel('kanban_rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ttp_leads' }, fetchLeads)
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, [fetchLeads]);

  const onDragEnd = async (result) => {
    const { draggableId, destination, source } = result;
    if (!destination || destination.droppableId === source.droppableId) return;
    const targetStatus = destination.droppableId;
    const leadId = draggableId;
    const prevLeads = leads;
    setLeads((ls) => ls.map((l) => l.id === leadId ? { ...l, status: targetStatus } : l));
    try {
      await updateLeadStatus(leadId, targetStatus);
    } catch {
      setLeads(prevLeads);
    }
  };

  const leadsForCol = (colId) => leads.filter((l) => (l.status || 'new') === colId);
  const total = leads.length;

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          {COLUMNS.map((col) => {
            const cnt = leadsForCol(col.id).length;
            return (
              <div key={col.id} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: col.color }} />
                <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{col.label}</span>
                <span style={{ fontSize: 13, fontWeight: 800, color: col.color }}>{cnt}</span>
              </div>
            );
          })}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            <MdPeople style={{ verticalAlign: 'middle' }} /> {total} total
          </span>
          <button className="btn btn-secondary btn-sm" onClick={fetchLeads} disabled={loading}>
            <MdRefresh /> Refresh
          </button>
        </div>
      </div>

      {/* Board */}
      <DragDropContext onDragEnd={onDragEnd}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${COLUMNS.length}, minmax(200px, 1fr))`,
          gap: 14, overflowX: 'auto', paddingBottom: 8,
        }}>
          {COLUMNS.map((col) => {
            const colLeads = leadsForCol(col.id);
            return (
              <div
                key={col.id}
                style={{
                  background: '#f9f4ef', borderRadius: 16,
                  border: '2px dashed transparent', padding: '14px 12px', minHeight: 200,
                }}
              >
                {/* Column header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                    <div style={{ width: 10, height: 10, borderRadius: '50%', background: col.color }} />
                    <span style={{ fontSize: 13, fontWeight: 800, color: '#1a1a1a' }}>{col.label}</span>
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 800, padding: '2px 9px', borderRadius: 20, background: col.color, color: '#fff' }}>
                    {colLeads.length}
                  </span>
                </div>

                {/* Cards */}
                {loading ? (
                  [1, 2].map((i) => (
                    <div key={i} className="skeleton" style={{ height: 90, borderRadius: 12, marginBottom: 10 }} />
                  ))
                ) : (
                  <StrictModeDroppable droppableId={col.id}>
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        style={{
                          minHeight: 60,
                          background: snapshot.isDraggingOver ? col.bg : 'transparent',
                          borderRadius: 10,
                          border: snapshot.isDraggingOver ? `1.5px dashed ${col.color}` : '1.5px dashed transparent',
                          transition: 'background 0.15s, border-color 0.15s',
                          padding: 2,
                        }}
                      >
                        {colLeads.length === 0 && !snapshot.isDraggingOver && (
                          <div style={{ textAlign: 'center', padding: '16px 10px', color: 'var(--text-muted)', fontSize: 12 }}>
                            No leads
                          </div>
                        )}
                        {colLeads.map((lead, index) => (
                          <Draggable key={lead.id} draggableId={lead.id} index={index}>
                            {(dragProvided, dragSnapshot) => (
                              <LeadCard
                                lead={lead}
                                col={col}
                                dragProvided={dragProvided}
                                isDragging={dragSnapshot.isDragging}
                                onClick={() => setSelectedLead(lead)}
                              />
                            )}
                          </Draggable>
                        ))}
                        {provided.placeholder}
                      </div>
                    )}
                  </StrictModeDroppable>
                )}
              </div>
            );
          })}
        </div>
      </DragDropContext>

      {/* Lead detail modal */}
      {selectedLead && (
        <LeadModal
          lead={selectedLead}
          onClose={() => setSelectedLead(null)}
          onUpdated={(updated) => {
            setLeads((ls) => ls.map((l) => l.id === updated.id ? { ...l, ...updated } : l));
            setSelectedLead(null);
          }}
        />
      )}
    </div>
  );
}
