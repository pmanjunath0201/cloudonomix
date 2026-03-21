import React, { useEffect, useState } from 'react';
import { apiAwsCosts, apiGcpCosts, apiAzureCosts } from '../utils/api';
import { getTenant } from '../utils/auth';
import { PageHeader, Spinner, NotConfigured } from '../components/UI';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { formatCost, detectCurrency } from '../utils/currency';
import UpgradePrompt from '../components/UpgradePrompt';

const CLOUD_CONFIG = [
  { key:'aws',   name:'AWS',   icon:'☁️', color:'var(--aws)',   fetcher: apiAwsCosts,   dataKey:'monthly' },
  { key:'gcp',   name:'GCP',   icon:'🔵', color:'var(--gcp)',   fetcher: apiGcpCosts,   dataKey:'monthly' },
  { key:'azure', name:'Azure', icon:'🔷', color:'var(--azure)', fetcher: apiAzureCosts, dataKey:'monthly' },
];

function CloudCard({ config, data, loading, error }) {
  const { name, icon, color } = config;
  const currency = data?.monthly?.slice(-1)[0]?.currency || 'USD';
  const latest   = data?.monthly?.slice(-1)[0];
  const services = latest?.services || [];
  const total    = latest?.total || 0;

  return (
    <div style={{ background:'var(--card)', border:'1px solid var(--border)', borderTop:`2px solid ${color}`, borderRadius:'14px', padding:'22px', display:'flex', flexDirection:'column', gap:'14px' }}>
      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
          <span style={{ fontSize:'24px' }}>{icon}</span>
          <div>
            <div style={{ fontFamily:'var(--mono)', fontSize:'14px', fontWeight:'700', color:'var(--t1)' }}>{name}</div>
            <div style={{ fontSize:'11px', color: error ? 'var(--orange)' : 'var(--green)', marginTop:'2px' }}>
              {error ? '⚠️ Error loading' : loading ? '⏳ Loading...' : '✅ Connected'}
            </div>
          </div>
        </div>
        {total > 0 && (
          <div style={{ fontFamily:'var(--mono)', fontSize:'22px', fontWeight:'700', color:'var(--t1)' }}>
            {formatCost(total, currency)}<span style={{ fontSize:'12px', color:'var(--t3)' }}>/mo</span>
          </div>
        )}
      </div>

      {loading && <div style={{ textAlign:'center', padding:'20px', color:'var(--t3)', fontSize:'13px' }}>Loading cost data...</div>}
      {error   && <div style={{ fontSize:'13px', color:'var(--orange)', background:'rgba(245,158,11,.07)', border:'1px solid rgba(245,158,11,.2)', borderRadius:'8px', padding:'10px 14px' }}>⚠️ {error}</div>}

      {!loading && !error && services.length > 0 && (
        <>
          {/* Bar chart */}
          <ResponsiveContainer width="100%" height={150}>
            <BarChart data={services.slice(0,6)} margin={{ top:4, right:4, left:0, bottom:40 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)"/>
              <XAxis dataKey="service" tick={{ fill:'var(--t3)', fontSize:9 }} angle={-25} textAnchor="end" interval={0}/>
              <YAxis hide/>
              <Tooltip
                contentStyle={{ background:'var(--card2)', border:'1px solid var(--border2)', borderRadius:'8px' }}
                formatter={v => [formatCost(v, currency), 'Cost']}/>
              <Bar dataKey="cost" radius={[4,4,0,0]} fill={color} fillOpacity={.85}/>
            </BarChart>
          </ResponsiveContainer>

          {/* Service list */}
          <div style={{ display:'flex', flexDirection:'column', gap:'7px' }}>
            {services.slice(0,5).map((s, i) => (
              <div key={i} style={{ display:'flex', alignItems:'center', gap:'8px' }}>
                <span style={{ fontSize:'11px', color:'var(--t2)', flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{s.service}</span>
                <div style={{ width:'80px', height:'4px', background:'var(--border)', borderRadius:'2px', overflow:'hidden', flexShrink:0 }}>
                  <div style={{ height:'100%', width:`${(s.cost/services[0].cost)*100}%`, background:color }}/>
                </div>
                <span style={{ fontFamily:'var(--mono)', fontSize:'11px', color:'var(--t1)', width:'60px', textAlign:'right', flexShrink:0 }}>
                  {formatCost(s.cost, currency)}
                </span>
              </div>
            ))}
          </div>
        </>
      )}

      {!loading && !error && services.length === 0 && (
        <div style={{ textAlign:'center', padding:'20px', color:'var(--t3)', fontSize:'13px' }}>
          No billing data found yet
        </div>
      )}
    </div>
  );
}

export default function MultiCloud() {
  const tenant  = getTenant();
  const [data,  setData]   = useState({ aws:null, gcp:null, azure:null });
  const [loading,setLoading]= useState({ aws:false, gcp:false, azure:false });
  const [errors, setErrors] = useState({ aws:'', gcp:'', azure:'' });
  const [showUpgrade, setShowUpgrade] = useState(false);

  const hasAny = tenant?.aws_ok || tenant?.gcp_ok || tenant?.azure_ok;
  const hasMultiple = [tenant?.aws_ok, tenant?.gcp_ok, tenant?.azure_ok].filter(Boolean).length > 1;

  useEffect(() => {
    CLOUD_CONFIG.forEach(({ key, fetcher }) => {
      const connected = tenant?.[`${key}_ok`];
      if (!connected) return;
      setLoading(p => ({ ...p, [key]:true }));
      fetcher()
        .then(r => setData(p => ({ ...p, [key]:r.data })))
        .catch(ex => setErrors(p => ({ ...p, [key]: ex.response?.data?.error || 'Failed to load' })))
        .finally(() => setLoading(p => ({ ...p, [key]:false })));
    });
  }, []);

  if (!hasAny) return (
    <div className="fade-in">
      <PageHeader title="🌐 Multi-Cloud" subtitle="Unified view across all connected cloud providers"/>
      <NotConfigured cloud="a cloud provider" onGoSettings={() => window.location.href='/settings'}/>
    </div>
  );

  // Total across all clouds
  const totals = CLOUD_CONFIG.map(c => {
    if (!tenant?.[`${c.key}_ok`]) return 0;
    const d = data[c.key];
    return d?.monthly?.slice(-1)[0]?.total || 0;
  });
  const grandTotal = totals.reduce((a,b) => a+b, 0);

  return (
    <div className="fade-in">
      {showUpgrade && (
        <UpgradePrompt feature="Multi-Cloud Dashboard" currentPlan={tenant?.plan}
          nextPlan="growth" onDismiss={() => setShowUpgrade(false)}/>
      )}

      <PageHeader title="🌐 Multi-Cloud" subtitle="Unified cost view across AWS, GCP, and Azure"/>

      {/* Grand total summary */}
      {grandTotal > 0 && (
        <div style={{ background:'linear-gradient(135deg,rgba(0,212,255,.07),rgba(16,185,129,.04))', border:'1px solid rgba(0,212,255,.2)', borderRadius:'13px', padding:'20px 26px', marginBottom:'20px', display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:'14px' }}>
          <div>
            <div style={{ fontSize:'12px', color:'var(--t3)', textTransform:'uppercase', letterSpacing:'.5px', marginBottom:'4px' }}>Total Monthly Spend — All Clouds</div>
            <div style={{ fontFamily:'var(--mono)', fontSize:'32px', fontWeight:'700', color:'var(--cyan)' }}>
              ${grandTotal.toLocaleString()}
            </div>
          </div>
          <div style={{ display:'flex', gap:'16px', flexWrap:'wrap' }}>
            {CLOUD_CONFIG.map((c, i) => tenant?.[`${c.key}_ok`] && totals[i] > 0 && (
              <div key={c.key} style={{ textAlign:'center' }}>
                <div style={{ fontFamily:'var(--mono)', fontSize:'16px', fontWeight:'700', color:c.color }}>
                  ${totals[i].toLocaleString()}
                </div>
                <div style={{ fontSize:'11px', color:'var(--t3)' }}>{c.name}</div>
                <div style={{ fontFamily:'var(--mono)', fontSize:'10px', color:'var(--t3)' }}>
                  {grandTotal > 0 ? `${((totals[i]/grandTotal)*100).toFixed(0)}%` : ''}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Cloud cards grid */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(300px,1fr))', gap:'16px' }}>
        {CLOUD_CONFIG.map(config => (
          tenant?.[`${config.key}_ok`] ? (
            <CloudCard key={config.key} config={config}
              data={data[config.key]}
              loading={loading[config.key]}
              error={errors[config.key]}/>
          ) : (
            <div key={config.key} style={{ background:'var(--card)', border:'1px dashed var(--border)', borderRadius:'14px', padding:'28px', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:'10px', minHeight:'200px', opacity:'.6' }}>
              <span style={{ fontSize:'32px' }}>{config.icon}</span>
              <div style={{ fontFamily:'var(--mono)', fontSize:'13px', color:'var(--t1)' }}>{config.name}</div>
              <div style={{ fontSize:'12px', color:'var(--t3)' }}>Not connected</div>
              <a href="/settings" style={{ fontSize:'12px', color:'var(--cyan)' }}>Connect in Settings →</a>
            </div>
          )
        ))}
      </div>
    </div>
  );
}
