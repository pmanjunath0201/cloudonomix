import React, { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Cell } from 'recharts';
import { apiAwsCosts, apiGcpCosts, apiAzureCosts } from '../utils/api';
import { getTenant } from '../utils/auth';
import { PageHeader, Spinner, ErrorBox, NotConfigured } from '../components/UI';
import { formatCost } from '../utils/currency';
import './Costs.css';

const COLORS = ['#00d4ff','#10b981','#8b5cf6','#f59e0b','#ef4444','#ec4899','#34d399'];

function CloudCosts({ data, color, title, currency }) {
  if (!data) return null;
  if (data.error) return <div className="cloud-err">⚠️ {title}: {data.error}</div>;
  const monthly = data.monthly || [];
  if (!monthly.length) return <div className="cloud-err">{title}: No billing data found yet.</div>;
  const latest   = monthly[monthly.length - 1];
  const services = latest?.services || [];
  const cur       = currency || latest?.currency || 'USD';

  return (
    <div className="costs-cloud-block">
      <div className="ccb-header" style={{ '--cc': color }}>
        <h3>{title}</h3>
        <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
          {cur !== 'USD' && <span style={{ fontSize:'12px', color:'var(--t3)', fontFamily:'var(--mono)' }}>Billing in {cur}</span>}
          <span className="ccb-total">{formatCost(latest?.total, cur)}<span>/mo</span></span>
        </div>
      </div>
      <div className="ccb-charts">
        <div className="ccb-trend">
          <div className="ccb-chart-label">6-Month Trend</div>
          <ResponsiveContainer width="100%" height={160}>
            <LineChart data={monthly.slice(-6)} margin={{ top:5, right:5, left:0, bottom:0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)"/>
              <XAxis dataKey="month" tick={{ fill:'var(--t3)', fontSize:10 }}/>
              <YAxis tick={{ fill:'var(--t3)', fontSize:10 }} tickFormatter={v => formatCost(v, cur, 0)}/>
              <Tooltip contentStyle={{ background:'var(--card2)', border:'1px solid var(--border2)', borderRadius:'8px' }}
                formatter={v => [formatCost(v, cur), '']}/>
              <Line type="monotone" dataKey="total" stroke={color} strokeWidth={2} dot={false}/>
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="ccb-breakdown">
          <div className="ccb-chart-label">This Month by Service</div>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={services.slice(0,7)} margin={{ top:5, right:5, left:5, bottom:50 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)"/>
              <XAxis dataKey="service" tick={{ fill:'var(--t3)', fontSize:9 }} angle={-30} textAnchor="end" interval={0}/>
              <YAxis tick={{ fill:'var(--t3)', fontSize:10 }} tickFormatter={v => formatCost(v, cur, 0)}/>
              <Tooltip contentStyle={{ background:'var(--card2)', border:'1px solid var(--border2)', borderRadius:'8px' }}
                formatter={v => [formatCost(v, cur), '']}/>
              <Bar dataKey="cost" radius={[4,4,0,0]}>
                {services.slice(0,7).map((_,i) => <Cell key={i} fill={COLORS[i%COLORS.length]} fillOpacity={.85}/>)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
      <div className="ccb-table">
        {services.slice(0,10).map((s,i) => (
          <div key={i} className="cct-row">
            <span className="cct-dot" style={{ background:COLORS[i%COLORS.length] }}/>
            <span className="cct-name">{s.service}</span>
            <div className="cct-bar-wrap"><div className="cct-bar" style={{ width:`${(s.cost/services[0].cost)*100}%`, background:COLORS[i%COLORS.length] }}/></div>
            <span className="cct-cost">{formatCost(s.cost, cur)}</span>
            <span className="cct-pct">{((s.cost/latest.total)*100).toFixed(1)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Costs() {
  const tenant = getTenant();
  const [aws,   setAws]   = useState(null);
  const [gcp,   setGcp]   = useState(null);
  const [azure, setAzure] = useState(null);
  const [busy,  setBusy]  = useState(false);
  const [err,   setErr]   = useState('');

  const load = async () => {
    setBusy(true); setErr('');
    try {
      const calls = [];
      if (tenant?.aws_ok)   calls.push(apiAwsCosts().then(r=>setAws(r.data)).catch(e=>setAws({error:e.response?.data?.error||'AWS error'})));
      if (tenant?.gcp_ok)   calls.push(apiGcpCosts().then(r=>setGcp(r.data)).catch(e=>setGcp({error:e.response?.data?.error||'GCP error'})));
      if (tenant?.azure_ok) calls.push(apiAzureCosts().then(r=>setAzure(r.data)).catch(e=>setAzure({error:e.response?.data?.error||'Azure error'})));
      await Promise.all(calls);
    } catch { setErr('Failed to load'); }
    setBusy(false);
  };

  useEffect(() => { load(); }, []);

  const hasAny = tenant?.aws_ok || tenant?.gcp_ok || tenant?.azure_ok;
  if (!hasAny) return (
    <div className="costs-page fade-in">
      <PageHeader title="◈ Cost Explorer" subtitle="Detailed breakdown by service and time"/>
      <NotConfigured cloud="a cloud provider" onGoSettings={() => window.location.href = '/settings'}/>
    </div>
  );

  // Detect Azure currency from data
  const azureCurrency = azure?.monthly?.slice(-1)[0]?.currency || 'USD';

  return (
    <div className="costs-page fade-in">
      <PageHeader title="◈ Cost Explorer" subtitle="Real cost data from your connected cloud accounts"/>
      {busy && <Spinner text="Loading cost data..."/>}
      {err  && <ErrorBox msg={err} onRetry={load}/>}
      {!busy && (
        <div className="costs-sections">
          {tenant?.aws_ok   && <CloudCosts data={aws}   color="var(--aws)"   title="☁️ Amazon Web Services" currency="USD"/>}
          {tenant?.gcp_ok   && <CloudCosts data={gcp}   color="var(--gcp)"   title="🔵 Google Cloud"        currency="USD"/>}
          {tenant?.azure_ok && <CloudCosts data={azure} color="var(--azure)" title="🔷 Microsoft Azure"      currency={azureCurrency}/>}
        </div>
      )}
    </div>
  );
}
