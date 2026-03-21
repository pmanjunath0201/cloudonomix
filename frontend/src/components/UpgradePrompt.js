import React from 'react';
import { useNavigate } from 'react-router-dom';
import './UpgradePrompt.css';

const PLAN_COLOR    = { starter:'var(--cyan)', growth:'var(--green)', business:'var(--purple)' };
const PLAN_PRICE_INR= { growth:9999, business:29999 };
const PLAN_PRICE_USD= { growth:149,  business:499 };
const WHATSAPP_NUM  = process.env.REACT_APP_WHATSAPP || '919XXXXXXXXX'; // Set in .env

export default function UpgradePrompt({ feature, currentPlan, nextPlan, onDismiss }) {
  const nav   = useNavigate();
  const color = PLAN_COLOR[nextPlan] || 'var(--cyan)';
  const npLabel = nextPlan ? nextPlan.charAt(0).toUpperCase() + nextPlan.slice(1) : '';
  const waMsg = encodeURIComponent(`Hi, I want to upgrade my Cloudonomix plan from ${currentPlan} to ${nextPlan}. Please help.`);

  return (
    <div className="upgrade-overlay">
      <div className="upgrade-card" style={{ '--uc': color }}>
        <div className="uc-icon">🔒</div>
        <h3 className="uc-title">{feature} — {npLabel} Plan Required</h3>
        <p className="uc-desc">
          You're on the <strong>{currentPlan?.charAt(0).toUpperCase() + currentPlan?.slice(1)}</strong> plan.
          Upgrade to <strong>{npLabel}</strong> to unlock this feature and more.
        </p>

        <div className="uc-price-box" style={{ borderColor: color+'40', background: color+'0d' }}>
          <div className="uc-plan-name" style={{ color }}>{npLabel} Plan</div>
          <div className="uc-plan-price" style={{ color }}>
            ₹{PLAN_PRICE_INR[nextPlan]?.toLocaleString()}<span>/mo</span>
          </div>
          <div className="uc-plan-usd">${PLAN_PRICE_USD[nextPlan]}/month for global clients</div>
        </div>

        <div className="uc-what-you-get">
          <div className="uc-features-title">What you unlock:</div>
          {nextPlan === 'growth' && ['Connect up to 3 clouds (AWS+GCP+Azure)','Resource Scanner — VM names, IPs, CPU','Anomaly Detector across all clouds','PDF reports for stakeholders','Up to 10 team members','20 budget alerts'].map(f=>(
            <div key={f} className="uc-feature-item">✦ {f}</div>
          ))}
          {nextPlan === 'business' && ['Unlimited cloud connections','Unlimited team members','Unlimited alerts','Priority support & dedicated manager'].map(f=>(
            <div key={f} className="uc-feature-item">✦ {f}</div>
          ))}
        </div>

        <div className="uc-actions">
          <a href={`https://wa.me/${WHATSAPP_NUM}?text=${waMsg}`}
             target="_blank" rel="noreferrer"
             className="uc-btn-primary" style={{ background: color, color:'#080c14' }}>
            📱 WhatsApp to Upgrade
          </a>
          <button className="uc-btn-secondary" onClick={() => nav('/settings')}>
            View Plans in Settings
          </button>
          {onDismiss && (
            <button className="uc-btn-dismiss" onClick={onDismiss}>Maybe later</button>
          )}
        </div>
        <p className="uc-note">We activate upgrades within 1 hour · Pay via UPI or bank transfer</p>
      </div>
    </div>
  );
}
