import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import http from '../utils/api';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [sent,  setSent]  = useState(false);
  const [busy,  setBusy]  = useState(false);
  const [err,   setErr]   = useState('');

  const submit = async e => {
    e.preventDefault(); setBusy(true); setErr('');
    try {
      await http.post('/auth/forgot-password', { email });
      setSent(true);
    } catch(ex) { setErr(ex.response?.data?.error || 'Failed. Try again.'); }
    setBusy(false);
  };

  return (
    <div style={{ minHeight:'100vh', background:'var(--bg)', display:'flex', alignItems:'center', justifyContent:'center', padding:'20px' }}>
      <div style={{ width:'100%', maxWidth:'420px', background:'var(--card)', border:'1px solid var(--border)', borderRadius:'16px', overflow:'hidden' }}>
        <div style={{ background:'linear-gradient(135deg,#0d1525,#0a0e1a)', padding:'28px', textAlign:'center', borderBottom:'1px solid var(--border)' }}>
          <div style={{ fontFamily:'var(--mono)', fontSize:'20px', color:'var(--cyan)' }}>⬡ Cloudonomix</div>
        </div>
        <div style={{ padding:'36px 32px' }}>
          {!sent ? (
            <>
              <h2 style={{ fontFamily:'var(--mono)', color:'var(--t1)', fontSize:'18px', marginBottom:'8px' }}>Forgot Password?</h2>
              <p style={{ color:'var(--t2)', fontSize:'13px', marginBottom:'24px', lineHeight:'1.6' }}>
                Enter your email and we'll send you a link to reset your password.
              </p>
              {err && <div style={{ background:'rgba(239,68,68,.09)', border:'1px solid rgba(239,68,68,.3)', color:'var(--red)', borderRadius:'9px', padding:'11px 15px', fontSize:'13px', marginBottom:'16px' }}>{err}</div>}
              <form onSubmit={submit} style={{ display:'flex', flexDirection:'column', gap:'16px' }}>
                <div style={{ display:'flex', flexDirection:'column', gap:'5px' }}>
                  <label style={{ fontSize:'11px', fontWeight:'600', color:'var(--t2)', textTransform:'uppercase', letterSpacing:'.5px' }}>Email Address</label>
                  <input type="email" value={email} required placeholder="you@company.com" onChange={e=>setEmail(e.target.value)}
                    style={{ background:'var(--card2)', border:'1px solid var(--border2)', color:'var(--t1)', borderRadius:'9px', padding:'11px 14px', fontSize:'14px', outline:'none' }}/>
                </div>
                <button type="submit" disabled={busy}
                  style={{ width:'100%', padding:'13px', background:'var(--cyan)', color:'#080c14', border:'none', borderRadius:'9px', fontWeight:'700', fontSize:'14px', cursor:'pointer', opacity:busy?.6:1, fontFamily:'var(--mono)' }}>
                  {busy ? 'Sending...' : 'Send Reset Link'}
                </button>
              </form>
            </>
          ) : (
            <>
              <div style={{ textAlign:'center', marginBottom:'20px' }}>
                <div style={{ fontSize:'48px', marginBottom:'14px' }}>📧</div>
                <h2 style={{ fontFamily:'var(--mono)', color:'var(--green)', fontSize:'18px', marginBottom:'8px' }}>Check Your Email</h2>
                <p style={{ color:'var(--t2)', fontSize:'13px', lineHeight:'1.6' }}>
                  We sent a password reset link to <strong style={{ color:'var(--cyan)' }}>{email}</strong>.<br/>
                  The link expires in 1 hour. Check your spam folder if you don't see it.
                </p>
              </div>
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
