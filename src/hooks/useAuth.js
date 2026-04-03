import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

async function resolveAuth(user) {
  if (!user) return { userId: null, isAdmin: false, userName: '', userRole: 'user', loading: false };

  // Fetch profile from crm_users to get the admin-managed name and role
  const { data: crmUser } = await supabase
    .from('crm_users')
    .select('name, role')
    .eq('id', user.id)
    .single();

  const isAdmin =
    user.user_metadata?.is_admin === true || crmUser?.role === 'admin';
  const userName =
    crmUser?.name ||
    user.user_metadata?.full_name ||
    user.email?.split('@')[0] ||
    'User';
  const userRole = crmUser?.role || (isAdmin ? 'admin' : 'user');

  return { userId: user.id, isAdmin, userName, userRole, loading: false };
}

export function useAuth() {
  const [auth, setAuth] = useState({ userId: null, isAdmin: false, userName: '', userRole: 'user', loading: true });

  useEffect(() => {
    let mounted = true;

    // Load initial session
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      const resolved = await resolveAuth(user);
      if (mounted) setAuth(resolved);
    });

    // React to sign-in / sign-out in real time
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const resolved = await resolveAuth(session?.user || null);
      if (mounted) setAuth(resolved);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  return auth;
}
