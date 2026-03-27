import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient';

export function useTodayTasks() {
  const [followups, setFollowups] = useState([]);
  const [meetings, setMeetings] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchTodayTasks = useCallback(async () => {
    setLoading(true);
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();
    const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59).toISOString();

    const [followupsRes, meetingsRes] = await Promise.all([
      supabase
        .from('ttp_followups')
        .select('*, ttp_leads(id, name, phone)')
        .gte('next_followup_at', startOfDay)
        .lte('next_followup_at', endOfDay)
        .eq('is_deleted', false)
        .eq('dismissed', false)
        .order('next_followup_at', { ascending: true }),
      supabase
        .from('ttp_meetings')
        .select('*, ttp_leads(id, name, phone)')
        .gte('meeting_datetime', startOfDay)
        .lte('meeting_datetime', endOfDay)
        .eq('is_deleted', false)
        .order('meeting_datetime', { ascending: true }),
    ]);

    setLoading(false);
    if (!followupsRes.error) setFollowups(followupsRes.data || []);
    if (!meetingsRes.error) setMeetings(meetingsRes.data || []);
  }, []);

  useEffect(() => {
    fetchTodayTasks();

    // Realtime for followups
    const followupChannel = supabase
      .channel('today_followups')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ttp_followups' }, () => {
        fetchTodayTasks();
      })
      .subscribe();

    // Realtime for meetings
    const meetingChannel = supabase
      .channel('today_meetings')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ttp_meetings' }, () => {
        fetchTodayTasks();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(followupChannel);
      supabase.removeChannel(meetingChannel);
    };
  }, [fetchTodayTasks]);

  return { followups, meetings, loading, refetch: fetchTodayTasks };
}
