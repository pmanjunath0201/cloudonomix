import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { saveSession } from '../utils/auth';
import http from '../utils/api';

export default function VerifyEmail() {
  const [params]  = useSearchParams();
  const navigate  = useNavigate();
  const token     = params.get('token');
  const [status, setStatus] = useState('verifying'); // verifying | success | error | resent
  const [msg,    setMsg]    = useState('');
  const [email,  setEmail]  = useState('');
  const [busy,   setBusy]   = useState(false);

  useEffect(() => {
    if (!token) { setStatus('error'); setMsg('No verification token found in the link.'); return; }
    http.post('/auth/verify-email', { token })
      .then(r => {
        if (r.data.already_verified) {
          setStatus('error'); setMsg('This email is already verified. Please login.');
          return;
        }
        saveSession(r.data);
        setStatus('success');
        setTimeout(() => navigate('/settings?setup=1'), 2500);
      })
      .catch(ex => {
        setStatus('error');
        setMsg(ex.response?.data?.error || 'Verification failed. The link may have expired.');
      });
  }, [token]);

  const resend = async () => {
    if (!email) return;
    setBusy(true);
    try {
      await http.post('/auth/resend-verification', { email });
      setStatus('resent');
    } catch(ex) {
      setMsg(ex.response?.data?.error || 'Failed to resend. Try again.');
    }
    setBusy(false);
  };

  return (
    <div style={{ minHeight:'100vh', background:'var(--bg)', display:'flex', alignItems:'center', justifyContent:'center', padding:'20px' }}>
      <div style={{ width:'100%', maxWidth:'440px', background:'var(--card)', border:'1px solid var(--border)', borderRadius:'16px', overflow:'hidden' }}>
        {/* Header */}
        <div style={{ background:'linear-gradient(135deg,#0d1525,#0a0e1a)', padding:'28px', textAlign:'center', borderBottom:'1px solid var(--border)' }}>
          <div style={{ fontFamily:'var(--mono)', fontSize:'22px', color:'var(--cyan)', marginBottom:'4px' }}>⬡ Cloudonomix</div>
          <div style={{ fontSize:'12px', color:'var(--t3)' }}>Cloud Cost Intelligence</div>
        </div>

        <div style={{ padding:'36px 32px', textAlign:'center' }}>

          {/* Verifying */}
          {status === 'verifying' && (
            <>
              <div style={{ fontSize:'44px', marginBottom:'16px' }}>⏳</div>
              <h2 style={{ fontFamily:'var(--mono)', color:'var(--t1)', fontSize:'18px', marginBottom:'8px' }}>Verifying your email...</h2>
              <p style={{ color:'var(--t2)', fontSize:'13px' }}>Please wait a moment.</p>
            </>
          )}

          {/* Success */}
          {status === 'success' && (
            <>
              <div style={{ fontSize:'52px', marginBottom:'16px' }}>✅</div>
              <h2 style={{ fontFamily:'var(--mono)', color:'var(--green)', fontSize:'20px', marginBottom:'8px' }}>Email Verified!</h2>
              <p style={{ color:'var(--t2)', fontSize:'14px', lineHeight:'1.6' }}>
                Welcome to Cloudonomix! You'll be redirected to connect your cloud account in a moment...
              </p>
              <div style={{ marginTop:'20px', width:'100%', height:'4px', background:'var(--border)', borderRadius:'2px', overflow:'hidden' }}>
                <div style={{ height:'100%', background:'var(--green)', animation:'progress 2.5s linear forwards' }}/>
              </div>
              <style>{`@keyframes progress { from{width:0%} to{width:100%} }`}</style>
            </>
          )}

          {/* Error */}
          {status === 'error' && (
            <>
              <div style={{ fontSize:'44px', marginBottom:'16px' }}>❌</div>
              <h2 style={{ fontFamily:'var(--mono)', color:'var(--red)', fontSize:'18px', marginBottom:'8px' }}>Verification Failed</h2>
              <p style={{ color:'var(--t2)', fontSize:'13px', lineHeight:'1.6', marginBottom:'24px' }}>{msg}</p>

              <div style={{ background:'var(--card2)', border:'1px solid var(--border)', borderRadius:'10px', padding:'20px', marginBottom:'16px' }}>
                <p style={{ color:'var(--t2)', fontSize:'13px', marginBottom:'12px' }}>Enter your email to get a new verification link:</p>
                <input type="email" placeholder="your@email.com" value={email}
                  onChange={e => setEmail(e.target.value)}
                  style={{ width:'100%', background:'var(--bg)', border:'1px solid var(--border2)', color:'var(--t1)', borderRadius:'8px', padding:'10px 14px', fontSize:'13px', outline:'none', marginBottom:'12px', boxSizing:'border-box' }}/>
                <button onClick={resend} disabled={!email || busy}
                  style={{ width:'100%', background:'var(--cyan)', color:'#080c14', border:'none', borderRadius:'8px', padding:'11px', fontWeight:'700', fontSize:'13px', cursor:'pointer', opacity: (!email || busy) ? .5 : 1 }}>
                  {busy ? 'Sending...' : 'Resend Verification Email'}
                </button>
              </div>
              <Link to="/login" style={{ color:'var(--t3)', fontSize:'13px' }}>← Back to Login</Link>
            </>
          )}

          {/* Resent */}
          {status === 'resent' && (
            <>
              <div style={{ fontSize:'44px', marginBottom:'16px' }}>📧</div>
              <h2 style={{ fontFamily:'var(--mono)', color:'var(--cyan)', fontSize:'18px', marginBottom:'8px' }}>Email Sent!</h2>
              <p style={{ color:'var(--t2)', fontSize:'14px', lineHeight:'1.6', marginBottom:'20px' }}>
                Check your inbox for a new verification link. Check spam folder if you don't see it.
              </p>
              <Link to="/login" style={{ color:'var(--t3)', fontSize:'13px' }}>← Back to Login</Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
