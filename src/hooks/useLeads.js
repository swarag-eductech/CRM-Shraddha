import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../supabaseClient';

export function useLeads(statusFilter = 'all', userId = null) {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  // Debounce timer ref — prevents multiple rapid realtime events from each
  // firing a separate network request. Events are collapsed into one fetch.
  const debounceRef = useRef(null);

  const fetchLeads = useCallback(async (isBackground = false) => {
    if (!isBackground) setLoading(true);
    setError('');
    let query = supabase
      .from('ttp_leads')
      .select('id, name, phone, email, city, source, lead_program, status, assigned_user_id, created_at')
      .eq('is_deleted', false)
      .order('created_at', { ascending: false })
      .limit(100); // Reduced from 300 — 100 is enough for dashboard/messages
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

    const channel = supabase
      .channel('ttp_leads_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ttp_leads' }, () => {
        // Debounce: collapse rapid-fire events into a single fetch after 400ms
        clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => fetchLeads(true), 400);
      })
      .subscribe();

    return () => {
      clearTimeout(debounceRef.current);
      supabase.removeChannel(channel);
    };
  }, [fetchLeads]);

  return { leads, loading, error, refetch: fetchLeads };
}
