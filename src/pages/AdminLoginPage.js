import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabaseClient';
import { upsertCRMUser } from '../api';
import { useNavigate } from 'react-router-dom';
import { MdLogin, MdLock, MdEmail, MdVisibility, MdVisibilityOff, MdArrowBack, MdCheckCircle } from 'react-icons/md';

// â”€â”€â”€ Brand token (mirrors index.css) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const C = {
  // Sidebar-matched dark background
  bg: 'linear-gradient(135deg, #fff7f0 0%, #fff3e8 50%, #ffe8d0 100%)',
  b1: '#ff6600', b2: '#f7971e', b3: '#ea580c', b4: '#fb923c',
  orange: '#ff6600', amber: '#f7971e',
  btnGrad: 'linear-gradient(90deg, #ff6600 0%, #f7971e 60%, #fb923c 100%)',
  logoGrad: 'linear-gradient(135deg, #fbbf24 0%, #f97316 55%, #ff6600 100%)',
  white: '#1a1a2e', muted: 'rgba(26,26,46,0.60)', ghost: 'rgba(26,26,46,0.42)',
  glass: '#ffffff', border: 'rgba(255,102,0,0.20)',
  inpBg: '#fff', inpLine: 'rgba(255,102,0,0.28)',
  red: '#dc2626', redBg: 'rgba(220,38,38,0.07)',
  green: '#16a34a', greenBg: 'rgba(22,163,74,0.08)',
};

export default function AdminLoginPage() {
  // â”€â”€ Sign-in state
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');
  const [showPwd,  setShowPwd]  = useState(false);

  // â”€â”€ Forgot-password state
  const [view,        setView]        = useState('login');   // 'login' | 'forgot' | 'forgot-sent'
  const [fpEmail,     setFpEmail]     = useState('');
  const [fpLoading,   setFpLoading]   = useState(false);
  const [fpError,     setFpError]     = useState('');

  // â”€â”€ Animation state
  const [shake,    setShake]    = useState(false);
  const [mounted,  setMounted]  = useState(false);

  const navigate = useNavigate();
  const pwdRef   = useRef(null);

  /* â”€â”€ Staggered entrance on mount â”€â”€ */
  useEffect(() => { const t = setTimeout(() => setMounted(true), 60); return () => clearTimeout(t); }, []);

  /* â”€â”€ Reset animation key when view changes â”€â”€ */
  useEffect(() => {
    setMounted(false);
    const t = setTimeout(() => setMounted(true), 40);
    return () => clearTimeout(t);
  }, [view]);

  const triggerShake = () => {
    setShake(true);
    setTimeout(() => setShake(false), 620);
  };

  /* â”€â”€ Login â”€â”€ */
  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true); setError('');

    const { data: { user }, error: loginErr } =
      await supabase.auth.signInWithPassword({ email, password });

    if (loginErr) {
      setError(loginErr.message);
      setLoading(false);
      triggerShake();
      return;
    }

    const isAdmin = user.user_metadata?.is_admin === true;
    const role = isAdmin ? 'admin' : 'user';
    const name = user.user_metadata?.full_name || user.email?.split('@')[0] || 'User';
    try { await upsertCRMUser({ id: user.id, name, email: user.email || '', role }); } catch (_) {}

    navigate(isAdmin ? '/' : '/pool');
  };

  /* â”€â”€ Forgot password â”€â”€ */
  const handleForgotPassword = async (e) => {
    e.preventDefault();
    if (!fpEmail.trim()) { setFpError('Please enter your email address.'); return; }
    setFpLoading(true); setFpError('');

    const { error: fpErr } = await supabase.auth.resetPasswordForEmail(fpEmail.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    setFpLoading(false);
    if (fpErr) { setFpError(fpErr.message); triggerShake(); return; }
    setView('forgot-sent');
  };

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  return (
    <>
      {/* â”€â”€ KEYFRAMES â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <style>{`
        .cli::placeholder { color: rgba(26,26,46,0.38) !important; }
        .cli:-webkit-autofill, .cli:-webkit-autofill:focus {
          -webkit-box-shadow: 0 0 0 1000px #fff inset !important;
          -webkit-text-fill-color: #1a1a2e !important;
          caret-color: #1a1a2e;
        }
        @keyframes b1  { 0%,100%{transform:translate(0,0) scale(1)} 33%{transform:translate(22px,-18px) scale(1.07)} 66%{transform:translate(-14px,20px) scale(0.95)} }
        @keyframes b2  { 0%,100%{transform:translate(0,0) scale(1)} 33%{transform:translate(-20px,14px) scale(1.06)} 66%{transform:translate(16px,-22px) scale(0.94)} }
        @keyframes b3  { 0%,100%{transform:translate(0,0) scale(1)} 50%{transform:translate(18px,12px) scale(1.05)} }
        @keyframes b4  { 0%,100%{transform:translate(0,0) scale(1)} 50%{transform:translate(-16px,-14px) scale(1.08)} }
        @keyframes breathe { 0%,100%{transform:scale(1)}  50%{transform:scale(1.10)} }
        @keyframes pulse-ring { 0%,100%{transform:translate(-50%,-50%) scale(1);opacity:.40} 50%{transform:translate(-50%,-50%) scale(1.18);opacity:.07} }
        @keyframes logo-in { from{opacity:0;transform:translateY(24px) scale(0.86)} to{opacity:1;transform:translateY(0) scale(1)} }
        @keyframes head-in { from{opacity:0;transform:translateY(18px)} to{opacity:1;transform:translateY(0)} }
        @keyframes card-in { from{opacity:0;transform:translateY(30px)} to{opacity:1;transform:translateY(0)} }
        @keyframes fadein  { from{opacity:0;transform:translateY(-4px)} to{opacity:1;transform:translateY(0)} }
        @keyframes shake   { 0%,100%{transform:translateX(0)} 15%{transform:translateX(-9px)} 30%{transform:translateX(9px)} 45%{transform:translateX(-7px)} 60%{transform:translateX(7px)} 75%{transform:translateX(-3px)} 90%{transform:translateX(3px)} }
        @keyframes spin    { to{transform:rotate(360deg)} }
        @keyframes dot-drift { 0%,100%{opacity:.06} 50%{opacity:.14} }
        @keyframes pop-in  { from{opacity:0;transform:scale(0.84)} to{opacity:1;transform:scale(1)} }

        .cli:focus {
          outline: none;
          border-color: #ff6600 !important;
          box-shadow: 0 0 0 3px rgba(255,102,0,0.20), 0 0 18px rgba(255,102,0,0.16) !important;
        }
        .cli.err:focus {
          border-color: #f87171 !important;
          box-shadow: 0 0 0 3px rgba(248,113,113,0.22) !important;
        }
        .crm-btn-primary {
          transition: transform .16s ease, filter .16s ease, box-shadow .16s ease;
        }
        .crm-btn-primary:hover:not(:disabled) {
          filter: brightness(1.10);
          transform: translateY(-1.5px);
          box-shadow: 0 10px 36px rgba(255,102,0,0.40) !important;
        }
        .crm-btn-primary:active:not(:disabled) {
          transform: scale(0.96) translateY(0) !important;
          filter: brightness(0.96);
        }
        .crm-sso:hover { background: rgba(255,102,0,0.07) !important; transform: translateY(-1px); border-color: rgba(255,102,0,0.40) !important; }
        .crm-sso { transition: background .18s ease, transform .18s ease, border-color .18s ease; }
        .crm-link { transition: color .18s ease; }
        .crm-link:hover { color: #fbbf24 !important; }
      `}</style>

      {/* â”€â”€ ROOT â”€â”€ */}
      <div style={{
        position: 'relative', minHeight: '100vh',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: C.bg, padding: '24px', overflow: 'hidden',
      }}>

        {/* â”€â”€ AMBIENT BLOBS â”€â”€ */}
        <div style={{ position:'absolute', inset:0, pointerEvents:'none', overflow:'hidden' }}>
          <div style={{ position:'absolute', left:'-16%', top:'-10%', width:'58vw', height:'58vw', borderRadius:'50%', background:C.b1, opacity:0.07, animation:'b1 8.5s ease-in-out infinite' }} />
          <div style={{ position:'absolute', right:'-12%', top:'6%',  width:'50vw', height:'50vw', borderRadius:'50%', background:C.b2, opacity:0.06, animation:'b2 10s ease-in-out infinite' }} />
          <div style={{ position:'absolute', left:'-8%',  bottom:'2%', width:'54vw', height:'54vw', borderRadius:'50%', background:C.b3, opacity:0.05, animation:'b3 7.4s ease-in-out infinite' }} />
          <div style={{ position:'absolute', right:'-14%', bottom:'-6%', width:'42vw', height:'42vw', borderRadius:'50%', background:C.b4, opacity:0.05, animation:'b4 11.2s ease-in-out infinite' }} />

          {/* Grid-like decorative dots */}
          {[0,1,2,3,4,5,6,7,8,9,10,11].map(i => (
            <div key={i} style={{
              position:'absolute',
              left:`${((Math.sin(i*2.618)+1)/2)*100}%`,
              top:`${((Math.cos(i*1.414)+1)/2)*100}%`,
              width: i%3===0 ? 5 : 3, height: i%3===0 ? 5 : 3,
              borderRadius:'50%',
              background:`rgba(255,255,255,${0.04+(i%4)*0.015})`,
              animation:`dot-drift ${4+i%4}s ease-in-out infinite`,
              animationDelay:`${i*0.4}s`,
            }} />
          ))}
        </div>

        {/* â”€â”€ CONTENT COLUMN â”€â”€ */}
        <div style={{ width:'100%', maxWidth:420, position:'relative', zIndex:1, display:'flex', flexDirection:'column', alignItems:'center' }}>

          {/* â”€â”€ LOGO (shared across views) â”€â”€ */}
          <div style={{ position:'relative', display:'flex', justifyContent:'center',
            opacity: mounted?1:0,
            animation: mounted?'logo-in 0.55s cubic-bezier(.34,1.5,.64,1) both':'none',
            animationDelay:'0.05s',
          }}>
            <div style={{
              width:250,
              height:250,
          marginBottom: -79,
             
              display:'flex',
              alignItems:'center',
              justifyContent:'center',
              
              overflow:'hidden',
            }}>
              <img
                src="https://fetvqggubxedatdryesz.supabase.co/storage/v1/object/public/assets/Images/Logo/Shraddha_Logo.png"
                alt="Shraddha Logo"
                style={{ width:'100%', height:'100%', objectFit:'contain' }}
              />
            </div>
          </div>

          {/* â•â• VIEW: LOGIN â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
          {view === 'login' && (
            <>
              {/* Heading */}
              <div style={{ textAlign:'center', marginTop:18, marginBottom:24,
                opacity:mounted?1:0,
                animation:mounted?'head-in 0.50s cubic-bezier(.34,1.4,.64,1) both':'none',
                animationDelay:'0.18s',
              }}>
                <p style={{ margin:'6px 0 0', fontSize:15, color:C.muted }}>Sign in to your workspace</p>
              </div>

              {/* Glass card */}
              <div style={{ width:'100%', opacity:mounted?1:0,
                animation: mounted ? `card-in 0.52s cubic-bezier(.34,1.4,.64,1) both` : 'none',
                animationDelay:'0.30s',
              }}>
                <div style={{
                  position:'relative', borderRadius:24,
                  border:`1px solid ${C.border}`,
                  background:C.glass,
                  backdropFilter:'blur(22px)', WebkitBackdropFilter:'blur(22px)',
                  padding:'26px 24px 22px',
                  boxShadow:'0 8px 40px rgba(255,102,0,0.14), 0 2px 16px rgba(0,0,0,0.06)',
                  animation: shake ? 'shake 0.62s ease' : 'none',
                }}>
                  {/* Shimmer line */}
                  <div style={{ position:'absolute', top:0, left:0, right:0, height:2, borderRadius:'24px 24px 0 0', background:'linear-gradient(90deg, #ff6600, #f7971e, transparent)', pointerEvents:'none' }} />

                  <form onSubmit={handleLogin} style={{ display:'flex', flexDirection:'column' }}>
                    {/* Email */}
                    <div style={{ marginBottom:14 }}>
                      <label style={{ display:'block', fontSize:12.5, fontWeight:600, color:'rgba(26,26,46,0.65)', marginBottom:7, letterSpacing:0.3 }}>Email Address</label>
                      <div style={{ position:'relative' }}>
                        <MdEmail style={{ position:'absolute', left:13, top:'50%', transform:'translateY(-50%)', color:'rgba(255,102,0,0.55)', fontSize:16, pointerEvents:'none' }} />
                        <input
                          type="email"
                          className={`cli${error && !email.trim() ? ' err' : ''}`}
                          placeholder="you@shraddha.edu"
                          value={email}
                          onChange={e => { setEmail(e.target.value); setError(''); }}
                          onKeyDown={e => e.key==='Enter' && pwdRef.current?.focus()}
                          required autoComplete="email"
                          style={{
                            width:'100%', boxSizing:'border-box',
                            padding:'13px 14px 13px 38px', borderRadius:14,
                            border: `1.5px solid ${error && !email.trim() ? C.red : C.inpLine}`,
                            background: error && !email.trim() ? C.redBg : C.inpBg,
                            color:C.white, fontSize:15, letterSpacing:0.2,
                            transition:'border-color .2s, box-shadow .2s, background .2s',
                          }}
                        />
                      </div>
                    </div>

                    {/* Password */}
                    <div style={{ marginBottom: error ? 12 : 6 }}>
                      <label style={{ display:'block', fontSize:12.5, fontWeight:600, color:'rgba(26,26,46,0.65)', marginBottom:7, letterSpacing:0.3 }}>Password</label>
                      <div style={{ position:'relative' }}>
                        <MdLock style={{ position:'absolute', left:13, top:'50%', transform:'translateY(-50%)', color:'rgba(255,102,0,0.55)', fontSize:16, pointerEvents:'none' }} />
                        <input
                          ref={pwdRef}
                          type={showPwd ? 'text' : 'password'}
                          className={`cli${error && !password.trim() ? ' err' : ''}`}
                          placeholder="Password"
                          value={password}
                          onChange={e => { setPassword(e.target.value); setError(''); }}
                          required autoComplete="current-password"
                          style={{
                            width:'100%', boxSizing:'border-box',
                            padding:'13px 40px 13px 38px', borderRadius:14,
                            border: `1.5px solid ${error && !password.trim() ? C.red : C.inpLine}`,
                            background: error && !password.trim() ? C.redBg : C.inpBg,
                            color:C.white, fontSize:15, letterSpacing:0.2,
                            transition:'border-color .2s, box-shadow .2s, background .2s',
                          }}
                        />
                        <button type="button" onClick={() => setShowPwd(v=>!v)} style={{ position:'absolute', right:12, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', padding:4, color:'rgba(255,102,0,0.55)', display:'flex', alignItems:'center' }}>
                          {showPwd ? <MdVisibility size={17} /> : <MdVisibilityOff size={17} />}
                        </button>
                      </div>
                    </div>

                    {/* Error */}
                    {error && (
                      <div style={{ display:'flex', alignItems:'flex-start', gap:7, background:C.redBg, border:`1px solid rgba(220,38,38,0.22)`, borderRadius:10, padding:'10px 13px', marginBottom:12, animation:'fadein 0.26s ease both' }}>
                        <span style={{ color:C.red, fontSize:15, flexShrink:0 }}>&#9888;</span>
                        <span style={{ color:C.red, fontSize:13, lineHeight:1.45 }}>{error}</span>
                      </div>
                    )}

                    {/* Forgot link */}
                    <div style={{ textAlign:'right', marginBottom:18, marginTop: error ? 0 : 8 }}>
                      <button type="button" className="crm-link" onClick={() => { setFpEmail(email); setFpError(''); setView('forgot'); }}
                        style={{ background:'none', border:'none', cursor:'pointer', fontSize:13, color:'rgba(255,166,80,0.85)', fontWeight:600, padding:0, letterSpacing:0.2 }}>
                        Forgot password?
                      </button>
                    </div>

                    {/* Sign-in button */}
                    <div style={{ position:'relative' }}>
                      <div style={{ position:'absolute', top:10, left:20, right:20, height:48, borderRadius:16, background:C.btnGrad, opacity:0.32, filter:'blur(10px)', pointerEvents:'none' }} />
                      <button type="submit" disabled={loading} className="crm-btn-primary"
                        style={{ position:'relative', width:'100%', height:52, borderRadius:16, border:'none', background:C.btnGrad, color:'#fff', fontSize:16, fontWeight:700, letterSpacing:0.5, cursor: loading?'not-allowed':'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:9, boxShadow:'0 6px 24px rgba(255,102,0,0.32)', opacity: loading?0.8:1 }}>
                        {loading ? (
                          <span style={{ width:20, height:20, border:'2.5px solid rgba(255,255,255,0.35)', borderTopColor:'#fff', borderRadius:'50%', animation:'spin 0.8s linear infinite', display:'inline-block' }} />
                        ) : (
                          <><MdLogin style={{ fontSize:18 }} />Sign In</>
                        )}
                      </button>
                    </div>
                  </form>
                </div>
              </div>

              {/* Divider */}
              <div style={{ width:'100%', display:'flex', alignItems:'center', gap:12, marginTop:20, opacity:mounted?1:0, animation:mounted?'fadein 0.5s ease both':'none', animationDelay:'0.5s' }}>
                <div style={{ flex:1, height:1, background:'rgba(255,102,0,0.18)' }} />
                <span style={{ fontSize:12, color:C.ghost, letterSpacing:0.3, whiteSpace:'nowrap' }}>or continue with</span>
                <div style={{ flex:1, height:1, background:'rgba(255,102,0,0.18)' }} />
              </div>

              {/* Google SSO */}
              <div style={{ width:'100%', marginTop:12, opacity:mounted?1:0, animation:mounted?'fadein 0.5s ease both':'none', animationDelay:'0.6s' }}>
                <button type="button" className="crm-sso"
                  style={{ width:'100%', height:46, borderRadius:12, border:'1px solid rgba(255,102,0,0.25)', background:'#fff', cursor:'pointer', color:'#1a1a2e', fontSize:14, fontWeight:600, display:'flex', alignItems:'center', justifyContent:'center', gap:10, boxShadow:'0 2px 8px rgba(255,102,0,0.10)' }}>
                  <svg width="18" height="18" viewBox="0 0 48 48"><path fill="#FFC107" d="M43.6 20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.1 8 2.9l5.7-5.7C34.1 6.5 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20c11 0 20-8.9 20-20 0-1.3-.1-2.7-.4-4z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.5 15.3 18.9 12 24 12c3.1 0 5.8 1.1 8 2.9l5.7-5.7C34.1 6.5 29.3 4 24 4 16.2 4 9.4 8.4 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-1.9 13.5-5l-6.2-5.2C29.5 35.6 26.9 36 24 36c-5.2 0-9.7-3.3-11.3-7.9l-6.6 5C9.5 39.7 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20H24v8h11.3c-.8 2.3-2.3 4.2-4.3 5.5l6.2 5.2C41 35.1 44 30 44 24c0-1.3-.1-2.7-.4-4z"/></svg>
                  Continue with Google
                </button>
              </div>
            </>
          )}

          {/* â•â• VIEW: FORGOT PASSWORD â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
          {view === 'forgot' && (
            <>
              <div style={{ textAlign:'center', marginTop:18, marginBottom:24, opacity:mounted?1:0, animation:mounted?'head-in 0.50s cubic-bezier(.34,1.4,.64,1) both':'none', animationDelay:'0.12s' }}>
              
                <p style={{ margin:'6px 0 0', fontSize:14, color:C.muted }}>We'll email you a reset link</p>
              </div>

              <div style={{ width:'100%', opacity:mounted?1:0, animation:mounted?'card-in 0.50s cubic-bezier(.34,1.4,.64,1) both':'none', animationDelay:'0.22s' }}>
                <div style={{
                  position:'relative', borderRadius:24, border:`1px solid ${C.border}`,
                  background:C.glass, backdropFilter:'blur(22px)', WebkitBackdropFilter:'blur(22px)',
                  padding:'26px 24px 22px', boxShadow:'0 8px 40px rgba(255,102,0,0.12), 0 2px 16px rgba(0,0,0,0.06)',
                  animation: shake ? 'shake 0.62s ease' : 'none',
                }}>
                  <div style={{ position:'absolute', top:0, left:0, right:0, height:1.5, borderRadius:'24px 24px 0 0', background:'linear-gradient(90deg, rgba(255,102,0,0.28), transparent)', pointerEvents:'none' }} />

                  <form onSubmit={handleForgotPassword} style={{ display:'flex', flexDirection:'column' }}>
                    <div style={{ marginBottom:16 }}>
                      <label style={{ display:'block', fontSize:12.5, fontWeight:600, color:'rgba(26,26,46,0.65)', marginBottom:7, letterSpacing:0.3 }}>Your Email Address</label>
                      <div style={{ position:'relative' }}>
                        <MdEmail style={{ position:'absolute', left:13, top:'50%', transform:'translateY(-50%)', color:'rgba(255,102,0,0.55)', fontSize:16, pointerEvents:'none' }} />
                        <input
                          type="email"
                          className={`cli${fpError && !fpEmail.trim() ? ' err' : ''}`}
                          placeholder="you@shraddha.edu"
                          value={fpEmail}
                          onChange={e => { setFpEmail(e.target.value); setFpError(''); }}
                          required autoComplete="email" autoFocus
                          style={{
                            width:'100%', boxSizing:'border-box',
                            padding:'13px 14px 13px 38px', borderRadius:14,
                            border:`1.5px solid ${fpError && !fpEmail.trim() ? C.red : C.inpLine}`,
                            background: fpError && !fpEmail.trim() ? C.redBg : C.inpBg,
                            color:C.white, fontSize:15, letterSpacing:0.2,
                            transition:'border-color .2s, box-shadow .2s',
                          }}
                        />
                      </div>
                    </div>

                    {fpError && (
                      <div style={{ display:'flex', alignItems:'flex-start', gap:7, background:C.redBg, border:`1px solid rgba(220,38,38,0.22)`, borderRadius:10, padding:'10px 13px', marginBottom:14, animation:'fadein 0.26s ease both' }}>
                        <span style={{ color:C.red, fontSize:15, flexShrink:0 }}>&#9888;</span>
                        <span style={{ color:C.red, fontSize:13, lineHeight:1.45 }}>{fpError}</span>
                      </div>
                    )}

                    <div style={{ position:'relative', marginTop:4 }}>
                      <div style={{ position:'absolute', top:10, left:20, right:20, height:48, borderRadius:16, background:C.btnGrad, opacity:0.30, filter:'blur(10px)', pointerEvents:'none' }} />
                      <button type="submit" disabled={fpLoading} className="crm-btn-primary"
                        style={{ position:'relative', width:'100%', height:52, borderRadius:16, border:'none', background:C.btnGrad, color:'#fff', fontSize:16, fontWeight:700, letterSpacing:0.4, cursor:fpLoading?'not-allowed':'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:9, boxShadow:'0 6px 24px rgba(255,102,0,0.30)', opacity:fpLoading?0.8:1 }}>
                        {fpLoading ? (
                          <span style={{ width:20, height:20, border:'2.5px solid rgba(255,255,255,0.35)', borderTopColor:'#fff', borderRadius:'50%', animation:'spin 0.8s linear infinite', display:'inline-block' }} />
                        ) : 'Send Reset Link'}
                      </button>
                    </div>
                  </form>

                  <button type="button" onClick={() => setView('login')} className="crm-link"
                    style={{ display:'flex', alignItems:'center', gap:6, background:'none', border:'none', cursor:'pointer', color:C.muted, fontSize:13, fontWeight:500, padding:0, marginTop:18 }}>
                    <MdArrowBack size={15} /> Back to Sign In
                  </button>
                </div>
              </div>
            </>
          )}

          {/* â•â• VIEW: FORGOT SENT â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
          {view === 'forgot-sent' && (
            <div style={{ textAlign:'center', marginTop:28, opacity:mounted?1:0, animation:mounted?'pop-in 0.5s cubic-bezier(.34,1.5,.64,1) both':'none', animationDelay:'0.10s' }}>
              <div style={{
                width:80, height:80, borderRadius:24, margin:'0 auto 20px',
                background:'rgba(74,222,128,0.12)',
                border:'1.5px solid rgba(74,222,128,0.30)',
                display:'flex', alignItems:'center', justifyContent:'center',
                boxShadow:'0 0 32px rgba(74,222,128,0.22)',
              }}>
                <MdCheckCircle style={{ fontSize:42, color:C.green }} />
              </div>
              <h2 style={{ margin:'0 0 8px', fontSize:22, fontWeight:800, color:C.white }}>Check Your Inbox</h2>
              <p style={{ fontSize:14, color:C.muted, lineHeight:1.6, margin:'0 0 28px' }}>
                We sent a password reset link to<br />
                <strong style={{ color:'rgba(255,166,80,0.90)' }}>{fpEmail}</strong>
              </p>
              <button type="button" onClick={() => { setView('login'); setFpEmail(''); }} className="crm-btn-primary"
                style={{ background:C.btnGrad, border:'none', borderRadius:14, padding:'12px 28px', color:'#fff', fontSize:14, fontWeight:700, cursor:'pointer', letterSpacing:0.3, boxShadow:'0 4px 18px rgba(255,102,0,0.28)' }}>
                Back to Sign In
              </button>
              <p style={{ fontSize:12, color:C.ghost, marginTop:14 }}>
                Didn't receive it?{' '}
                <button type="button" className="crm-link" onClick={() => setView('forgot')}
                  style={{ background:'none', border:'none', cursor:'pointer', fontSize:12, color:'rgba(255,166,80,0.75)', fontWeight:600, padding:0, letterSpacing:0.2 }}>
                  Try again
                </button>
              </p>
            </div>
          )}

        </div>
      </div>
    </>
  );
}
