import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiDashboard } from '../utils/api';
import { getTenant } from '../utils/auth';

export default function TrialBanner() {
  const [trial, setTrial] = useState(null);
  const nav    = useNavigate();
  const tenant = getTenant();

  useEffect(() => {
    // Only check for starter plan
    if (tenant?.plan !== 'starter') return;
    apiDashboard()
      .then(r => { if (r.data.trial) setTrial(r.data.trial); })
      .catch(() => {});
  }, [tenant?.plan]);

  if (!trial || trial.is_paid || !trial.on_trial) return null;
  if (trial.days_remaining > 7) return null; // Only show when ≤7 days left

  const isExpired  = trial.is_expired;
  const isUrgent   = trial.days_remaining <= 1;
  const waNum      = process.env.REACT_APP_WHATSAPP || '919XXXXXXXXX';
  const waMsg      = encodeURIComponent(`Hi, I want to upgrade my Cloudonomix trial to a paid plan`);

  const bgColor    = isExpired ? 'rgba(239,68,68,.12)'  : isUrgent ? 'rgba(239,68,68,.09)' : 'rgba(245,158,11,.08)';
  const borderColor= isExpired ? 'rgba(239,68,68,.4)'   : isUrgent ? 'rgba(239,68,68,.3)'  : 'rgba(245,158,11,.3)';
  const textColor  = isExpired ? '#ef4444'               : isUrgent ? '#ef4444'              : '#f59e0b';

  return (
    <div style={{
      background: bgColor, border:`1px solid ${borderColor}`,
      borderRadius:'10px', padding:'12px 18px', marginBottom:'18px',
      display:'flex', alignItems:'center', justifyContent:'space-between',
      flexWrap:'wrap', gap:'10px'
    }}>
      <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
        <span style={{ fontSize:'18px' }}>{isExpired ? '🔒' : isUrgent ? '⚠️' : '⏰'}</span>
        <div>
          <div style={{ fontFamily:'var(--mono)', fontSize:'13px', fontWeight:'700', color:textColor }}>
            {isExpired
              ? 'Your free trial has expired'
              : isUrgent
              ? 'Trial expires tomorrow!'
              : `${trial.days_remaining} days left in your free trial`}
          </div>
          <div style={{ fontSize:'12px', color:'var(--t2)', marginTop:'2px' }}>
            {isExpired
              ? 'Upgrade to continue accessing your cloud cost data'
              : `Trial ends on ${new Date(trial.trial_end).toLocaleDateString('en-IN', {day:'numeric',month:'long',year:'numeric'})}`}
          </div>
        </div>
      </div>
      <a href={`https://wa.me/${waNum}?text=${waMsg}`}
         target="_blank" rel="noreferrer"
         style={{
           background:'#25D366', color:'#fff', fontWeight:'700', fontSize:'12px',
           padding:'8px 16px', borderRadius:'8px', textDecoration:'none',
           fontFamily:'var(--mono)', whiteSpace:'nowrap', flexShrink:0
         }}>
        📱 Upgrade Now
      </a>
    </div>
  );
}
