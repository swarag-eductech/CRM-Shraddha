import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient';

export function useLeads(statusFilter = 'all', userId = null) {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    setError('');
    let query = supabase
      .from('ttp_leads')
      .select('id, name, phone, email, city, source, lead_program, status, assigned_user_id, created_at')
      .eq('is_deleted', false)
      .order('created_at', { ascending: false })
      .limit(300);
    if (statusFilter && statusFilter !== 'all') {
      query = query.eq('status', statusFilter);
    }
    if (userId) {
      query = query.eq('assigned_user_id', userId);
    }
    const { data, error: err } = await query;
    setLoading(false);
    if (err) { setError(err.message); return; }
    setLeads(data || []);
  }, [statusFilter, userId]);

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
  }, [fetchLeads]);

  return { leads, loading, error, refetch: fetchLeads };
}
