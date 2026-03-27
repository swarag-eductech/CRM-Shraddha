import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';

export default function PrivateAdminRoute({ children }) {
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    async function checkAdmin() {
      // Use getUser() as it is more secure for server-side verification checks
      const { data: { user }, error } = await supabase.auth.getUser();
      
      if (error || !user) {
        setIsAdmin(false);
        setLoading(false);
        return;
      }

      // Check user metadata for is_admin flag
      const userIsAdmin = user.user_metadata?.is_admin === true;
      
      if (!userIsAdmin) {
        // If logged in but not admin, sign out and deny access
        await supabase.auth.signOut();
        setIsAdmin(false);
      } else {
        setIsAdmin(true);
      }
      setLoading(false);
    }
    
    checkAdmin();
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

  if (!isAdmin) {
    return <Navigate to="/admin-login" replace />;
  }

  return children;
}
