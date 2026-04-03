import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';

export default function ProtectedRoute({ children, requireAdmin = false }) {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    async function checkAuth() {
      const { data: { user }, error } = await supabase.auth.getUser();
      if (error || !user) {
        setUser(null);
      } else {
        setUser(user);
        setIsAdmin(user.user_metadata?.is_admin === true);
      }
      setLoading(false);
    }
    checkAuth();
  }, []);

  if (loading) {
    return (
      <div style={{ 
        display: 'flex', justifyContent: 'center', alignItems: 'center', 
        height: '100vh', background: 'var(--bg-light)' 
      }}>
        <div className="skeleton" style={{ width: 100, height: 100, borderRadius: '50%' }} />
      </div>
    );
  }

  // Not logged in at all → login page
  if (!user) return <Navigate to="/login" replace />;

  // Admin-only route but user is not admin → redirect to their pool
  if (requireAdmin && !isAdmin) return <Navigate to="/pool" replace />;

  return children;
}
