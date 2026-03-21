import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { apiRegister } from '../utils/api';
import './Auth.css';

export default function Register() {
  const [form, setForm] = useState({ company_name:'', name:'', email:'', password:'' });
  const [err,  setErr]  = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);  // show success screen

  const submit = async e => {
    e.preventDefault(); setErr(''); setBusy(true);
    try {
      await apiRegister(form);
      setDone(true);  // show "check your email" screen
    } catch(ex) { setErr(ex.response?.data?.error || 'Registration failed'); }
    setBusy(false);
  };

  // ── Success Screen ─────────────────────────────────────────────────────────
  if (done) {
    return (
      <div style={{ minHeight:'100vh', background:'var(--bg)', display:'flex', alignItems:'center', justifyContent:'center', padding:'20px' }}>
        <div style={{ width:'100%', maxWidth:'480px', background:'var(--card)', border:'1px solid var(--border)', borderRadius:'16px', padding:'48px 36px', textAlign:'center' }}>
          <div style={{ fontFamily:'var(--mono)', fontSize:'20px', color:'var(--cyan)', marginBottom:'32px' }}>⬡ Cloudonomix</div>
          <div style={{ fontSize:'56px', marginBottom:'20px' }}>📧</div>
          <h2 style={{ fontFamily:'var(--mono)', color:'var(--t1)', fontSize:'20px', marginBottom:'12px' }}>Check your email!</h2>
          <p style={{ color:'var(--t2)', fontSize:'14px', lineHeight:'1.7', marginBottom:'28px' }}>
            We sent a verification link to <strong style={{ color:'var(--cyan)' }}>{form.email}</strong>.<br/>
            Click the link in the email to activate your account.
          </p>
          <div style={{ background:'var(--card2)', border:'1px solid var(--border)', borderRadius:'10px', padding:'18px', marginBottom:'20px', textAlign:'left' }}>
            <div style={{ fontSize:'12px', color:'var(--t3)', marginBottom:'10px', textTransform:'uppercase', letterSpacing:'.5px' }}>What to do next</div>
            {['Open your email inbox','Find email from Cloudonomix','Click "Verify Email Address"','You\'ll be redirected to connect your cloud account'].map((s,i)=>(
              <div key={i} style={{ display:'flex', alignItems:'center', gap:'10px', marginBottom:'8px' }}>
                <span style={{ width:'20px', height:'20px', borderRadius:'50%', background:'rgba(0,212,255,.15)', border:'1px solid rgba(0,212,255,.3)', color:'var(--cyan)', fontSize:'11px', fontWeight:'700', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, fontFamily:'var(--mono)' }}>{i+1}</span>
                <span style={{ fontSize:'13px', color:'var(--t2)' }}>{s}</span>
              </div>
            ))}
          </div>
          <p style={{ color:'var(--t3)', fontSize:'12px', marginBottom:'16px' }}>
            Didn't receive it? Check your spam folder.
          </p>
          <Link to="/login" style={{ color:'var(--t3)', fontSize:'13px' }}>← Back to Login</Link>
        </div>
      </div>
    );
  }

  // ── Register Form ──────────────────────────────────────────────────────────
  return (
    <div className="auth-page">
      <div className="auth-left">
        <div className="auth-brand"><span className="ab-icon">⬡</span><span className="ab-name">Cloudonomix</span></div>
        <h1 className="auth-headline">Start saving on cloud costs today</h1>
        <p className="auth-body">Connect your cloud accounts and get actionable savings recommendations within minutes.</p>
        <div className="auth-features">
          {['Free 30-day trial','No credit card needed','Real data from day one','Cancel anytime'].map(f=>(
            <div key={f} className="af-row"><span className="af-dot">✦</span>{f}</div>
          ))}
        </div>
      </div>
      <div className="auth-right">
        <div className="auth-card">
          <h2 className="ac-title">Create account</h2>
          <p className="ac-sub">Free 30-day trial — no credit card required</p>
          {err && <div className="auth-err">{err}</div>}
          <form onSubmit={submit} className="auth-form">
            <label>Company Name<input type="text" value={form.company_name} required placeholder="Acme Corp" onChange={e=>setForm({...form,company_name:e.target.value})}/></label>
            <label>Your Name<input type="text" value={form.name} required placeholder="John Smith" onChange={e=>setForm({...form,name:e.target.value})}/></label>
            <label>Work Email<input type="email" value={form.email} required placeholder="john@acme.com" onChange={e=>setForm({...form,email:e.target.value})}/></label>
            <label>Password<input type="password" value={form.password} required placeholder="Min 6 characters" minLength={6} onChange={e=>setForm({...form,password:e.target.value})}/></label>
            <button type="submit" className="auth-btn" disabled={busy}>{busy?<span className="btn-spin"/>:'Create Account →'}</button>
          </form>
          <p className="auth-switch">Already have an account? <Link to="/login">Sign in</Link></p>
        </div>
      </div>
    </div>
  );
}
