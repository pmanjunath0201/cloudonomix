import React from 'react';
import './UI.css';

export function Card({ children, className='' }) {
  return <div className={`card ${className}`}>{children}</div>;
}

export function PageHeader({ title, subtitle, actions }) {
  return (
    <div className="page-header">
      <div><h1 className="page-title">{title}</h1>{subtitle&&<p className="page-sub">{subtitle}</p>}</div>
      {actions && <div className="page-actions">{actions}</div>}
    </div>
  );
}

export function StatCard({ title, value, sub, accent='cyan', icon }) {
  return (
    <div className={`stat-card stat-card--${accent}`}>
      <div className="stat-header">{icon&&<span className="stat-icon">{icon}</span>}<span className="stat-title">{title}</span></div>
      <div className="stat-value">{value}</div>
      {sub&&<div className="stat-sub">{sub}</div>}
    </div>
  );
}

export function Badge({ label, color='cyan' }) {
  const map = { cyan:'#00d4ff', green:'#10b981', orange:'#f59e0b', red:'#ef4444', purple:'#8b5cf6', aws:'#FF9900', gcp:'#4285F4', azure:'#0078D4' };
  const c = map[color]||color;
  return <span className="badge" style={{color:c,borderColor:c+'40',background:c+'12'}}>{label}</span>;
}

export function Spinner({ text='Loading...' }) {
  return (
    <div className="spinner-wrap">
      <div className="spinner"/>
      <span className="spinner-text">{text}</span>
      <style>{`.spinner{width:36px;height:36px;border:3px solid var(--border);border-top-color:var(--cyan);border-radius:50%;animation:spin .7s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

export function ErrorBox({ msg, onRetry }) {
  return (
    <div className="error-box">
      <span className="error-icon">⚠️</span>
      <div>
        <div className="error-title">Error fetching data</div>
        <div className="error-msg">{msg}</div>
      </div>
      {onRetry&&<button className="retry-btn" onClick={onRetry}>Retry</button>}
    </div>
  );
}

export function NotConfigured({ cloud, onGoSettings }) {
  return (
    <div className="not-configured">
      <div className="nc-icon">🔌</div>
      <h3>{cloud} Not Connected</h3>
      <p>Connect your {cloud} credentials in Settings to see real data.</p>
      <button className="nc-btn" onClick={onGoSettings}>Go to Settings →</button>
    </div>
  );
}

export function CopyBtn({ text }) {
  const [done, setDone] = React.useState(false);
  const copy = () => { navigator.clipboard.writeText(text); setDone(true); setTimeout(()=>setDone(false),1500); };
  return <button className="copy-btn" onClick={copy} title="Copy">{done?'✓':'⎘'}</button>;
}

export function Btn({ children, onClick, variant='primary', disabled, className='' }) {
  return <button className={`btn btn--${variant} ${className}`} onClick={onClick} disabled={disabled}>{children}</button>;
}
