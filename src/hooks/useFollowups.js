import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient';

/**
 * useFollowups(leadId?)
 * If leadId is provided → fetches followups for that lead only.
 * Otherwise → fetches all followups joined with ttp_leads.
 */
export function useFollowups(leadId = null) {
  const [followups, setFollowups] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async (isBackground = false) => {
    if (!isBackground) setLoading(true);
    let q = supabase
      .from('ttp_followups')
      .select('*, ttp_leads(id, name, phone)')
      .eq('is_deleted', false)
      .order('next_followup_at', { ascending: true });

    if (leadId) q = q.eq('lead_id', leadId);

    const { data } = await q;
    setLoading(false);
    setFollowups(data || []);
  }, [leadId]);

  useEffect(() => {
    fetch();
    const ch = supabase
      .channel(`followups_hook_${leadId || 'all'}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ttp_followups' }, () => fetch(true))
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, [fetch, leadId]);

  return { followups, loading, refetch: fetch };
}
