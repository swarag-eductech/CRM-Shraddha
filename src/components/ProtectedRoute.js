import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';

export default function ProtectedRoute({ children, requireAdmin = false }) {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);

  useEffect(() => {
    async function checkAuth() {
      const { data: { user }, error } = await supabase.auth.getUser();
      
      if (error || !user) {
        setUser(null);
      } else {
        // If requireAdmin is true, check for metadata
        if (requireAdmin && user.user_metadata?.is_admin !== true) {
          await supabase.auth.signOut();
          setUser(null);
        } else {
          setUser(user);
        }
      }
      setLoading(false);
    }
    
    checkAuth();
  }, [requireAdmin]);

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

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return children;
}
