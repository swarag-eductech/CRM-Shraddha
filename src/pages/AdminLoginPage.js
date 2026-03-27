import React, { useState } from 'react';
import { supabase } from '../supabaseClient';
import { useNavigate } from 'react-router-dom';
import { MdLogin, MdLock, MdEmail, MdSchool } from 'react-icons/md';

export default function AdminLoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const { data: { user }, error: loginErr } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (loginErr) {
      setError(loginErr.message);
      setLoading(false);
      return;
    }

    if (user.user_metadata?.is_admin !== true) {
      await supabase.auth.signOut();
      setError('Access denied: Unauthorized admin');
      setLoading(false);
      return;
    }

    navigate('/');
  };

  return (
    <div className="crm-layout" style={{ 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center', 
      minHeight: '100vh', 
      padding: '24px' 
    }}>
      <div className="content-card" style={{ 
        maxWidth: '420px', 
        width: '100%', 
        padding: '36px',
        animation: 'fadeInUp 0.5s ease'
      }}>
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div className="logo-icon" style={{ margin: '0 auto 12px' }}>
            <MdSchool style={{ color: '#fff', fontSize: 22 }} />
          </div>
          <h1 style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-dark)' }}>Admin Login</h1>
          <p style={{ fontSize: '14px', color: 'var(--text-muted)' }}>Institute Control Panel</p>
        </div>

        {error && (
          <div style={{
            background: 'rgba(239, 68, 68, 0.08)',
            border: '1px solid rgba(239, 68, 68, 0.25)',
            borderRadius: '12px',
            padding: '12px 16px',
            marginBottom: '20px',
            fontSize: '13px',
            color: '#dc2626',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <MdLock size={16} /> {error}
          </div>
        )}

        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div className="form-group">
            <label>Admin Email</label>
            <div className="search-input-wrapper">
              <MdEmail className="search-icon" />
              <input
                type="email"
                className="search-input"
                placeholder="admin@yourdomain.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                style={{ paddingLeft: '38px' }}
              />
            </div>
          </div>

          <div className="form-group">
            <label>Password</label>
            <div className="search-input-wrapper">
              <MdLock className="search-icon" />
              <input
                type="password"
                className="search-input"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                style={{ paddingLeft: '38px' }}
              />
            </div>
          </div>

          <button type="submit" className="btn btn-primary" style={{ 
            width: '100%', 
            justifyContent: 'center',
            marginTop: '8px',
            height: '46px'
          }} disabled={loading}>
            {loading ? (
              <span style={{ 
                width: '18px', height: '18px', border: '2px solid #fff', 
                borderTopColor: 'transparent', borderRadius: '50%', 
                animation: 'App-logo-spin 1s linear infinite' 
              }} />
            ) : (
              <>
                <MdLogin /> Sign In 
              </>
            )}
          </button>
        </form>

        <p style={{ 
          marginTop: '28px', 
          textAlign: 'center', 
          fontSize: '12px', 
          color: 'var(--text-muted)' 
        }}>
          &copy; 2026 Admin Dashboard
        </p>
      </div>
    </div>
  );
}
