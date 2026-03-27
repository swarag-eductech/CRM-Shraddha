import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient';

export function useMeetings() {
  const [meetings, setMeetings] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('ttp_meetings')
      .select('*, ttp_leads(id, name, phone)')
      .eq('is_deleted', false)
      .order('meeting_datetime', { ascending: true });
    setLoading(false);
    setMeetings(data || []);
  }, []);

  useEffect(() => {
    fetch();
    const ch = supabase
      .channel('meetings_hook')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ttp_meetings' }, fetch)
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, [fetch]);

  return { meetings, loading, refetch: fetch };
}
