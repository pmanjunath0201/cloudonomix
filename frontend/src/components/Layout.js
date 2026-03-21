import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { getTenant, getUser, clearSession, isSuperAdmin } from '../utils/auth';
import TrialBanner from './TrialBanner';
import './Layout.css';

const CLIENT_NAV = [
  { to:'/',            label:'Dashboard',        icon:'⬡' },
  { to:'/costs',       label:'Cost Explorer',    icon:'◈' },
  { to:'/savings',     label:'Savings Center',   icon:'💡', highlight:true },
  { to:'/scanner',     label:'Resource Scanner', icon:'⚡' },
  { to:'/anomalies',   label:'Anomaly Detector', icon:'🚨' },
  { to:'/multicloud',  label:'Multi-Cloud',      icon:'🌐' },
  { to:'/alerts',      label:'Alerts',           icon:'△' },
  { to:'/reports',     label:'Reports',          icon:'📄', planRequired:'growth' },
  { to:'/compare',     label:'vs Competitors',   icon:'⚔' },
  { to:'/settings',    label:'Settings',         icon:'⚙' },
];
const ADMIN_NAV = [
  { to:'/admin',    label:'Admin Panel', icon:'⚙' },
  { to:'/settings', label:'Settings',   icon:'◈' },
];
const PLAN_COLOR = { starter:'var(--cyan)', growth:'var(--green)', business:'var(--purple)' };

export default function Layout({ children }) {
  const [open, setOpen] = useState(false);
  const navigate        = useNavigate();
  const tenant          = getTenant();
  const user            = getUser();
  const isAdmin         = isSuperAdmin();
  const nav             = isAdmin ? ADMIN_NAV : CLIENT_NAV;

  const logout = () => { clearSession(); navigate('/login'); };

  // Filter nav based on plan
  const visibleNav = nav.filter(item => {
    if (!item.planRequired) return true;
    const planOrder = { starter:0, growth:1, business:2 };
    return (planOrder[tenant?.plan] || 0) >= (planOrder[item.planRequired] || 0);
  });

  return (
    <div className="layout">
      <button className="mob-toggle" onClick={() => setOpen(!open)}>☰</button>

      <aside className={`sidebar ${open ? 'sidebar--open' : ''}`}>
        <div className="sidebar__brand" onClick={() => setOpen(false)}>
          <span className="brand-icon">⬡</span>
          <span className="brand-name">Cloudonomix</span>
          {isAdmin && <span className="admin-pill">ADMIN</span>}
        </div>

        {tenant && !isAdmin && (
          <div className="sidebar__tenant">
            <span className="tenant-name">{tenant.name}</span>
            <span className="tenant-plan" style={{ color: PLAN_COLOR[tenant.plan] }}>
              {tenant.plan?.toUpperCase()}
            </span>
          </div>
        )}

        {tenant && !isAdmin && (
          <div className="sidebar__clouds">
            {[['A', tenant.aws_ok,'var(--aws)','AWS'],
              ['G', tenant.gcp_ok,'var(--gcp)','GCP'],
              ['Az',tenant.azure_ok,'var(--azure)','Azure']].map(([abbr,ok,color,title]) => (
              <span key={title}
                className={`cloud-dot ${ok ? 'cloud-dot--on' : ''}`}
                title={`${title}: ${ok ? 'Connected' : 'Not connected'}`}
                style={ok ? { background:color, boxShadow:`0 0 6px ${color}`, color:'#0a0e1a' } : {}}>
                {abbr}
              </span>
            ))}
          </div>
        )}

        <nav className="sidebar__nav">
          {visibleNav.map(({ to, label, icon, highlight }) => (
            <NavLink key={to} to={to} end={to === '/' || to === '/admin'}
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                `nav-link ${isActive ? 'nav-link--active' : ''} ${highlight ? 'nav-link--highlight' : ''}`
              }>
              {icon && <span className="nav-icon">{icon}</span>}
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="sidebar__footer">
          <div className="user-block">
            <div className="user-name">{user?.name}</div>
            <div className="user-role">{user?.role}</div>
          </div>
          <button className="logout-btn" onClick={logout}>⏻ Logout</button>
        </div>
      </aside>

      <main className="main-area">
        {/* FIX 1: TrialBanner shown on every page */}
        <TrialBanner />
        {children}
      </main>
    </div>
  );
}
