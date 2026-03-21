import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { apiDashboard } from '../utils/api';
import { PageHeader, StatCard, Spinner, ErrorBox } from '../components/UI';
import { formatCost, detectCurrency, getSymbol } from '../utils/currency';
import './Dashboard.css';

const TT = ({ active, payload, label, currency }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tt">
      <div className="tt-label">{label}</div>
      <div className="tt-val">{formatCost(payload[0].value, currency)}</div>
    </div>
  );
};

function EmptyDashboard() {
  const nav = useNavigate();
  return (
    <div className="empty-dash fade-in">
      <div className="ed-hero">
        <div className="ed-logo">◈</div>
        <h2>Welcome to Cloudonomix</h2>
        <p>Connect your cloud accounts to see real cost data. No demo numbers — only your actual spend.</p>
        <button className="ed-cta" onClick={() => nav('/settings?setup=1')}>Connect Cloud Account →</button>
      </div>
      <div className="ed-clouds">
        {[
          { icon:'☁️', name:'Amazon Web Services', desc:'EC2, RDS, S3, EBS, Lambda', color:'var(--aws)' },
          { icon:'🔵', name:'Google Cloud', desc:'Compute, Storage, BigQuery, SQL', color:'var(--gcp)' },
          { icon:'🔷', name:'Microsoft Azure', desc:'VMs, Blob Storage, SQL, AKS', color:'var(--azure)' },
        ].map(c => (
          <div key={c.name} className="ec-card" style={{ '--cc': c.color }}>
            <span className="ec-icon">{c.icon}</span>
            <div><div className="ec-name">{c.name}</div><div className="ec-desc">{c.desc}</div></div>
            <button className="ec-btn" onClick={() => nav('/settings?setup=1')}>Connect</button>
          </div>
        ))}
      </div>
      <div className="ed-steps">
        <h3>How it works</h3>
        <div className="eds-grid">
          {['Connect your cloud account in Settings','Cloudonomix reads your real resource & cost data','Get specific savings actions per VM, DB, Storage','Act on recommendations — reduce waste instantly'].map((s,i) => (
            <div key={i} className="eds-item"><span className="eds-num">{i+1}</span><p>{s}</p></div>
          ))}
        </div>
      </div>
    </div>
  );
}

function CloudSection({ title, color, data, icon }) {
  if (!data) return null;
  const currency = data.currency || 'USD';
  if (data.error) return (
    <div className="cloud-section" style={{ '--cloud-c': color }}>
      <div className="cs-title">{icon} {title}</div>
      <div className="cs-error">⚠️ {data.error}</div>
    </div>
  );
  return (
    <div className="cloud-section" style={{ '--cloud-c': color }}>
      <div className="cs-header">
        <div className="cs-title">{icon} {title}</div>
        <div className="cs-total">
          {formatCost(data.monthly_total, currency)}
          <span>/mo</span>
          {currency !== 'USD' && <span className="cs-currency-badge">{currency}</span>}
        </div>
        {data.change_pct !== undefined && (
          <span className={`cs-change ${data.change_pct > 0 ? 'cs-up' : 'cs-down'}`}>
            {data.change_pct > 0 ? '▲' : '▼'} {Math.abs(data.change_pct)}% vs last month
          </span>
        )}
      </div>
      <div className="cs-body">
        {data.trend?.length > 1 && (
          <ResponsiveContainer width="100%" height={120}>
            <AreaChart data={data.trend} margin={{ top:5, right:5, left:0, bottom:0 }}>
              <defs>
                <linearGradient id={`g${title}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={color} stopOpacity={0.25}/>
                  <stop offset="95%" stopColor={color} stopOpacity={0}/>
                </linearGradient>
              </defs>
              <XAxis dataKey="month" tick={{ fill:'var(--t3)', fontSize:10 }}/>
              <YAxis hide/>
              <Tooltip content={<TT currency={currency}/>}/>
              <Area type="monotone" dataKey="total" stroke={color} strokeWidth={2} fill={`url(#g${title})`}/>
            </AreaChart>
          </ResponsiveContainer>
        )}
        {data.top_services?.length > 0 && (
          <div className="cs-services">
            {data.top_services.slice(0,5).map((s, i) => (
              <div key={i} className="cs-svc-row">
                <span className="cs-svc-name">{s.service}</span>
                <div className="cs-svc-bar-wrap">
                  <div className="cs-svc-bar" style={{ width:`${(s.cost/data.top_services[0].cost)*100}%`, background:color }}/>
                </div>
                <span className="cs-svc-cost">{formatCost(s.cost, currency)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const nav = useNavigate();
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(true);
  const [err,  setErr]  = useState('');

  const load = async () => {
    setBusy(true); setErr('');
    try { const r = await apiDashboard(); setData(r.data); }
    catch(ex) { setErr(ex.response?.data?.error || 'Failed to load dashboard'); }
    setBusy(false);
  };

  useEffect(() => { load(); }, []);

  if (busy) return <Spinner text="Loading dashboard..."/>;
  if (err)  return <ErrorBox msg={err} onRetry={load}/>;
  if (data?.no_credentials) return <EmptyDashboard/>;

  const currency    = detectCurrency(data);
  const sym         = getSymbol(currency);
  const connected   = Object.entries(data.clouds||{}).filter(([,v])=>v).map(([k])=>k.toUpperCase());
  const estSavings  = Math.round(data.total_monthly * 0.30);

  return (
    <div className="dashboard fade-in">
      <PageHeader
        title="Dashboard"
        subtitle={`${connected.join(' + ')} · ${new Date().toLocaleDateString('en-US',{month:'long',year:'numeric'})}`}
      />

      {/* Savings CTA */}
      <div className="savings-cta-banner" onClick={() => nav('/savings')}>
        <div className="scb-left">
          <span className="scb-icon">💡</span>
          <div>
            <div className="scb-title">You could save ~{sym}{estSavings.toLocaleString()}/month</div>
            <div className="scb-sub">Cloudonomix has identified specific optimizations. Click to see exact actions per service.</div>
          </div>
        </div>
        <div className="scb-arrow">View Savings Center →</div>
      </div>

      <div className="db-top-stats">
        <StatCard title="Total Monthly Spend" value={formatCost(data.total_monthly, currency)} accent="cyan" icon="◈" sub={`All connected clouds · ${currency}`}/>
        {data.aws   && !data.aws.error   && <StatCard title="AWS This Month"   value={formatCost(data.aws.monthly_total, 'USD')}     accent="aws"   icon="☁️" sub={data.aws.change_pct !== undefined ? `${data.aws.change_pct>0?'▲':'▼'} ${Math.abs(data.aws.change_pct)}% vs last month` : 'Amazon Web Services'}/>}
        {data.gcp   && !data.gcp.error   && <StatCard title="GCP This Month"   value={formatCost(data.gcp.monthly_total, 'USD')}     accent="gcp"   icon="🔵" sub="Google Cloud"/>}
        {data.azure && !data.azure.error && <StatCard title="Azure This Month" value={formatCost(data.azure.monthly_total, currency)} accent="azure" icon="🔷" sub={`Microsoft Azure · ${data.azure.currency||'USD'}`}/>}
      </div>

      <div className="db-clouds-grid">
        <CloudSection title="AWS"   color="var(--aws)"   icon="☁️" data={data.aws}/>
        <CloudSection title="GCP"   color="var(--gcp)"   icon="🔵" data={data.gcp}/>
        <CloudSection title="Azure" color="var(--azure)" icon="🔷" data={data.azure}/>
      </div>
    </div>
  );
}
