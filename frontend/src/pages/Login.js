import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { apiLogin } from '../utils/api';
import { saveSession } from '../utils/auth';
import './Auth.css';

export default function Login() {
  const [form, setForm]   = useState({ email:'', password:'' });
  const [err,  setErr]    = useState('');
  const [busy, setBusy]   = useState(false);
  const [needsVerify, setNeedsVerify] = useState(false);
  const [resendBusy,  setResendBusy]  = useState(false);
  const [resendDone,  setResendDone]  = useState(false);
  const navigate = useNavigate();

  const submit = async e => {
    e.preventDefault(); setErr(''); setNeedsVerify(false); setBusy(true);
    try {
      const r = await apiLogin(form);
      saveSession(r.data);
      navigate(r.data.user.role === 'superadmin' ? '/admin' : '/');
    } catch(ex) {
      const data = ex.response?.data || {};
      if (data.requires_verification) {
        setNeedsVerify(true);
      } else {
        setErr(data.error || 'Login failed');
      }
    }
    setBusy(false);
  };

  const resend = async () => {
    setResendBusy(true);
    try {
      const http = (await import('../utils/api')).default;
      await http.post('/auth/resend-verification', { email: form.email });
      setResendDone(true);
    } catch{}
    setResendBusy(false);
  };

  return (
    <div className="auth-page">
      <div className="auth-left">
        <div className="auth-brand"><span className="ab-icon">⬡</span><span className="ab-name">Cloudonomix</span></div>
        <h1 className="auth-headline">Cloud Cost Intelligence<br/>for Engineering Teams</h1>
        <p className="auth-body">Connect AWS, GCP, and Azure. Get real-time cost breakdowns, per-resource savings recommendations, and anomaly alerts.</p>
        <div className="auth-features">
          {['Real AWS/GCP/Azure data — no fake numbers','Per-VM and per-IP savings analysis','Multi-tenant — each client isolated','Anomaly detection & budget alerts'].map(f=>(
            <div key={f} className="af-row"><span className="af-dot">✦</span>{f}</div>
          ))}
        </div>
      </div>
      <div className="auth-right">
        <div className="auth-card">
          <h2 className="ac-title">Sign in</h2>
          <p className="ac-sub">Welcome back to Cloudonomix</p>

          {/* Email not verified warning */}
          {needsVerify && (
            <div style={{ background:'rgba(245,158,11,.1)', border:'1px solid rgba(245,158,11,.3)', borderRadius:'10px', padding:'16px', marginBottom:'16px' }}>
              <div style={{ color:'var(--orange)', fontWeight:'700', fontSize:'14px', marginBottom:'6px' }}>📧 Email not verified</div>
              <div style={{ color:'var(--t2)', fontSize:'13px', marginBottom:'12px', lineHeight:'1.5' }}>
                Please check your inbox for a verification email and click the link to activate your account.
              </div>
              {!resendDone ? (
                <button onClick={resend} disabled={resendBusy || !form.email}
                  style={{ background:'var(--orange)', color:'#080c14', border:'none', borderRadius:'7px', padding:'8px 16px', fontWeight:'700', fontSize:'12px', cursor:'pointer', opacity: resendBusy ? .6 : 1 }}>
                  {resendBusy ? 'Sending...' : 'Resend verification email'}
                </button>
              ) : (
                <div style={{ color:'var(--green)', fontSize:'13px', fontWeight:'600' }}>✓ Verification email sent! Check your inbox.</div>
              )}
            </div>
          )}

          {err && <div className="auth-err">{err}</div>}

          <form onSubmit={submit} className="auth-form">
            <label>Email<input type="email" value={form.email} required placeholder="you@company.com" onChange={e=>setForm({...form,email:e.target.value})}/></label>
            <label>Password<input type="password" value={form.password} required placeholder="••••••••" onChange={e=>setForm({...form,password:e.target.value})}/></label>
            <button type="submit" className="auth-btn" disabled={busy}>{busy?<span className="btn-spin"/>:'Sign In'}</button>
          </form>
          <div style={{textAlign:'center'}}><p className="auth-switch">No account? <Link to="/register">Start free trial</Link></p><p style={{marginTop:'8px'}}><Link to="/forgot-password" style={{color:'var(--t3)',fontSize:'13px'}}>Forgot password?</Link></p></div>
        </div>
      </div>
    </div>
  );
}
