import React, { useState, useEffect, useCallback } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { MdRefresh, MdPeople, MdAccessTime, MdHistory } from 'react-icons/md';
import { supabase } from '../supabaseClient';
import { updateLeadStatus } from '../api';
import LeadModal from '../components/LeadModal';
import { useAuth } from '../hooks/useAuth';

/* @hello-pangea/dnd works better with React 18/19 than react-beautiful-dnd */
/* but this hack is still helpful to ensure the Droppable mounts correctly */
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
        boxShadow: isDragging ? `0 20px 48px ${col.color}45` : isOverdue ? '0 2px 8px rgba(239,68,68,0.12)' : '0 1px 4px rgba(0,0,0,0.06)',
        transform: isDragging ? `${dragProvided.draggableProps.style.transform} scale(1.02)` : dragProvided.draggableProps.style.transform,
        opacity: isDragging ? 0.9 : 1,
        transition: 'box-shadow 0.2s, border-color 0.2s, background 0.2s, transform 0.2s',
        zIndex: isDragging ? 1000 : 1,
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
  const { userId, isAdmin, loading: authLoading } = useAuth();
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedLead, setSelectedLead] = useState(null);

  const fetchLeads = useCallback(async (isBackground = false) => {
    if (authLoading) return;
    if (!isBackground) setLoading(true);
    let query = supabase
      .from('ttp_leads')
      .select('id, name, phone, city, status, created_at, ttp_followups(id, next_followup_at, status)')
      .eq('is_deleted', false)
      .order('created_at', { ascending: false });
    if (!isAdmin && userId) {
      query = query.eq('assigned_user_id', userId);
    }
    const { data } = await query;
    setLoading(false);
    setLeads(data || []);
  }, [userId, isAdmin, authLoading]);

  useEffect(() => {
    fetchLeads();
    const ch = supabase
      .channel('kanban_rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ttp_leads' }, (payload) => {
        // Optimistic check: if it's an update and we already have it updated locally, ignore
        fetchLeads(true);
      })
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, [fetchLeads]);

  const onDragEnd = async (result) => {
    const { draggableId, destination, source } = result;
    
    // Dropped outside a list or back in the same spot
    if (!destination) return;
    if (destination.droppableId === source.droppableId && destination.index === source.index) return;
    
    const targetStatus = destination.droppableId;
    const leadId = draggableId;
    
    // Optimistically update status
    const prevLeads = [...leads];
    setLeads((currentLeads) => {
      return currentLeads.map((l) => 
        l.id === leadId ? { ...l, status: targetStatus } : l
      );
    });

    try {
      await updateLeadStatus(leadId, targetStatus);
    } catch (error) {
      console.error("Failed to update status:", error);
      setLeads(prevLeads);
    }
  };

  const leadsForCol = (colId) => leads.filter((l) => (l.status || 'new') === colId);
  const total = leads.length;

  return (
    <div style={{ animation: 'fadeIn 0.4s ease' }}>
      {/* Header Summary */}
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between', 
        marginBottom: 24,
        background: '#fff',
        padding: '16px 20px',
        borderRadius: 16,
        boxShadow: '0 2px 12px rgba(0,0,0,0.03)',
      }}>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          {COLUMNS.map((col) => {
            const cnt = leadsForCol(col.id).length;
            return (
              <div key={col.id} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: col.color }} />
                <span style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 500 }}>{col.label}</span>
                <span style={{ fontSize: 13, fontWeight: 800, color: col.color, background: `${col.color}15`, padding: '1px 8px', borderRadius: 10 }}>{cnt}</span>
              </div>
            );
          })}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)' }}>
            <MdPeople style={{ verticalAlign: 'middle', marginRight: 4, fontSize: 18 }} /> {total} total leads
          </span>
          <button className="btn btn-secondary btn-sm" onClick={fetchLeads} disabled={loading}>
            <MdRefresh style={{ animation: loading ? 'App-logo-spin 1s linear infinite' : 'none' }} /> Refresh
          </button>
        </div>
      </div>

      {/* Board */}
      <DragDropContext onDragEnd={onDragEnd}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${COLUMNS.length}, minmax(240px, 1fr))`,
          gap: 20, 
          overflowX: 'auto', 
          paddingBottom: 20,
          minHeight: 'calc(100vh - 250px)',
        }}>
          {COLUMNS.map((col) => {
            const colLeads = leadsForCol(col.id);
            return (
              <div
                key={col.id}
                style={{
                  background: '#f8f9fa', 
                  borderRadius: 20,
                  border: '1px solid rgba(0,0,0,0.03)',
                  display: 'flex',
                  flexDirection: 'column',
                  maxHeight: '100%',
                }}
              >
                {/* Column header */}
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'space-between', 
                  padding: '16px 16px 12px',
                  borderBottom: `2px solid ${col.color}`,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 12, height: 12, borderRadius: '50%', background: col.color, boxShadow: `0 0 0 3px ${col.color}20` }} />
                    <span style={{ fontSize: 14, fontWeight: 800, color: '#1a1a1a' }}>{col.label}</span>
                  </div>
                  <span style={{ 
                    fontSize: 11, 
                    fontWeight: 800, 
                    padding: '3px 10px', 
                    borderRadius: 20, 
                    background: col.color, 
                    color: '#fff',
                    boxShadow: `0 4px 10px ${col.color}40`,
                  }}>
                    {colLeads.length}
                  </span>
                </div>

                {/* Cards Container */}
                <div style={{ padding: '12px', flex: 1, overflowY: 'auto' }}>
                  {loading ? (
                    [1, 2, 3].map((i) => (
                      <div key={i} className="skeleton" style={{ height: 100, borderRadius: 14, marginBottom: 12, opacity: 0.1 * (4-i) }} />
                    ))
                  ) : (
                    <StrictModeDroppable droppableId={col.id}>
                      {(provided, snapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.droppableProps}
                          style={{
                            minHeight: '150px',
                            background: snapshot.isDraggingOver ? `${col.color}08` : 'transparent',
                            borderRadius: 14,
                            transition: 'all 0.2s ease',
                            padding: '2px',
                          }}
                        >
                          {colLeads.length === 0 && !snapshot.isDraggingOver && (
                            <div style={{ 
                              textAlign: 'center', 
                              padding: '40px 20px', 
                              color: '#94a3b8', 
                              fontSize: 13,
                              border: '2px dashed rgba(0,0,0,0.05)',
                              borderRadius: 16,
                              marginTop: 10
                            }}>
                              <div style={{ fontSize: 24, marginBottom: 8, opacity: 0.5 }}>📂</div>
                              No leads in this stage
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
