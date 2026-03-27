import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

export function useLeads(statusFilter = 'all') {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchLeads = async () => {
    setLoading(true);
    setError('');
    let query = supabase
      .from('ttp_leads')
      .select('*, ttp_followups(id, followup_number, next_followup_at, status, note, dismissed, is_deleted)')
      .eq('is_deleted', false)
      .order('created_at', { ascending: false });
    if (statusFilter && statusFilter !== 'all') {
      query = query.eq('status', statusFilter);
    }
    const { data, error: err } = await query;
    setLoading(false);
    if (err) { setError(err.message); return; }
    setLeads(data || []);
  };

  useEffect(() => {
    fetchLeads();
    // Realtime subscription for ttp_leads changes
    const channel = supabase
      .channel('ttp_leads_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ttp_leads' }, () => {
        fetchLeads();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  return { leads, loading, error, refetch: fetchLeads };
}
