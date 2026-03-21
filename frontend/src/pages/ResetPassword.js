import React, { useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import http from '../utils/api';

export default function ResetPassword() {
  const [params]   = useSearchParams();
  const navigate   = useNavigate();
  const token      = params.get('token');
  const [password, setPassword] = useState('');
  const [confirm,  setConfirm]  = useState('');
  const [busy,     setBusy]     = useState(false);
  const [err,      setErr]      = useState('');
  const [done,     setDone]     = useState(false);

  const submit = async e => {
    e.preventDefault(); setErr('');
    if (password !== confirm) { setErr('Passwords do not match'); return; }
    if (password.length < 6)  { setErr('Password must be at least 6 characters'); return; }
    setBusy(true);
    try {
      await http.post('/auth/reset-password', { token, password });
      setDone(true);
      setTimeout(() => navigate('/login'), 3000);
    } catch(ex) { setErr(ex.response?.data?.error || 'Reset failed.'); }
    setBusy(false);
  };

  return (
    <div style={{ minHeight:'100vh', background:'var(--bg)', display:'flex', alignItems:'center', justifyContent:'center', padding:'20px' }}>
      <div style={{ width:'100%', maxWidth:'420px', background:'var(--card)', border:'1px solid var(--border)', borderRadius:'16px', overflow:'hidden' }}>
        <div style={{ background:'linear-gradient(135deg,#0d1525,#0a0e1a)', padding:'28px', textAlign:'center', borderBottom:'1px solid var(--border)' }}>
          <div style={{ fontFamily:'var(--mono)', fontSize:'20px', color:'var(--cyan)' }}>⬡ Cloudonomix</div>
        </div>
        <div style={{ padding:'36px 32px' }}>
          {done ? (
            <div style={{ textAlign:'center' }}>
              <div style={{ fontSize:'48px', marginBottom:'14px' }}>✅</div>
              <h2 style={{ fontFamily:'var(--mono)', color:'var(--green)', fontSize:'18px', marginBottom:'8px' }}>Password Reset!</h2>
              <p style={{ color:'var(--t2)', fontSize:'13px' }}>Redirecting to login...</p>
            </div>
          ) : (
            <>
              <h2 style={{ fontFamily:'var(--mono)', color:'var(--t1)', fontSize:'18px', marginBottom:'8px' }}>Set New Password</h2>
              <p style={{ color:'var(--t2)', fontSize:'13px', marginBottom:'24px' }}>Choose a strong password for your account.</p>
              {err && <div style={{ background:'rgba(239,68,68,.09)', border:'1px solid rgba(239,68,68,.3)', color:'var(--red)', borderRadius:'9px', padding:'11px 15px', fontSize:'13px', marginBottom:'16px' }}>{err}</div>}
              <form onSubmit={submit} style={{ display:'flex', flexDirection:'column', gap:'16px' }}>
                {[['New Password', password, setPassword, 'Min 6 characters'], ['Confirm Password', confirm, setConfirm, 'Re-enter password']].map(([lbl,val,setter,ph])=>(
                  <div key={lbl} style={{ display:'flex', flexDirection:'column', gap:'5px' }}>
                    <label style={{ fontSize:'11px', fontWeight:'600', color:'var(--t2)', textTransform:'uppercase', letterSpacing:'.5px' }}>{lbl}</label>
                    <input type="password" value={val} required placeholder={ph} minLength={6} onChange={e=>setter(e.target.value)}
                      style={{ background:'var(--card2)', border:'1px solid var(--border2)', color:'var(--t1)', borderRadius:'9px', padding:'11px 14px', fontSize:'14px', outline:'none' }}/>
                  </div>
                ))}
                <button type="submit" disabled={busy}
                  style={{ width:'100%', padding:'13px', background:'var(--cyan)', color:'#080c14', border:'none', borderRadius:'9px', fontWeight:'700', fontSize:'14px', cursor:'pointer', opacity:busy?.6:1, fontFamily:'var(--mono)' }}>
                  {busy ? 'Resetting...' : 'Reset Password'}
                </button>
              </form>
            </>
          )}
          <div style={{ textAlign:'center', marginTop:'20px' }}>
            <Link to="/login" style={{ color:'var(--t3)', fontSize:'13px' }}>← Back to Login</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
