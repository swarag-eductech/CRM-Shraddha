import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import { markNotificationRead, markAllNotificationsRead } from '../api';

export function useNotifications() {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchNotifications = useCallback(async () => {
    const { data, error } = await supabase
      .from('ttp_notifications')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);
    setLoading(false);
    if (!error) setNotifications(data || []);
  }, []);

  useEffect(() => {
    fetchNotifications();

    // Use optimistic state updates instead of re-fetching from the server on
    // every change. This is much faster — zero extra network round-trips.
    const channel = supabase
      .channel('ttp_notifications_realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'ttp_notifications' },
        (payload) => {
          // Prepend the new notification directly from the realtime payload
          setNotifications(prev => {
            // Guard: don't add duplicates if we already have it
            if (prev.some(n => n.id === payload.new.id)) return prev;
            return [payload.new, ...prev];
          });
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'ttp_notifications' },
        (payload) => {
          // Patch just the changed record in-place — no network request needed
          setNotifications(prev =>
            prev.map(n => (n.id === payload.new.id ? payload.new : n))
          );
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
    // fetchNotifications is stable (useCallback with no deps), safe to include
  }, [fetchNotifications]);

  const unreadCount = notifications.filter(n => !n.is_read).length;

  const markRead = async (id) => {
    // Optimistic: update UI first, then persist to DB
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
    await markNotificationRead(id);
  };

  const markAllRead = async () => {
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    await markAllNotificationsRead();
  };

  return { notifications, loading, unreadCount, markRead, markAllRead, refetch: fetchNotifications };
}
