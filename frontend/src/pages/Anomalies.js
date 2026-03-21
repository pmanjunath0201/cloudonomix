import React, { useEffect, useState } from 'react';
import { apiAllAnomalies } from '../utils/api';
import { getTenant } from '../utils/auth';
import { PageHeader, Spinner, ErrorBox, NotConfigured } from '../components/UI';
import UpgradePrompt from '../components/UpgradePrompt';

const SEV = {
  CRITICAL: { color:'#ef4444', icon:'🚨', bg:'rgba(239,68,68,.08)', border:'rgba(239,68,68,.25)' },
  HIGH:     { color:'#f59e0b', icon:'⚠️', bg:'rgba(245,158,11,.08)', border:'rgba(245,158,11,.25)' },
  MEDIUM:   { color:'#8b5cf6', icon:'📊', bg:'rgba(139,92,246,.08)', border:'rgba(139,92,246,.25)' },
};
const CLOUD_COLOR = { AWS:'#FF9900', Azure:'#0078D4', GCP:'#4285F4' };

export default function Anomalies() {
  const tenant = getTenant();
  const [data, setData]   = useState(null);
  const [busy, setBusy]   = useState(true);
  const [err,  setErr]    = useState('');
  const [dismissed, setDismissed] = useState(new Set());
  const [cloudFilter, setCloudFilter] = useState('ALL');
  const [showUpgrade, setShowUpgrade] = useState(false);

  const load = async () => {
    setBusy(true); setErr('');
    try { const r = await apiAllAnomalies(); setData(r.data); }
    catch(ex) {
      const d = ex.response?.data || {};
      if (d.upgrade_required) { setShowUpgrade(true); setBusy(false); return; }
      setErr(d.error || 'Failed to detect anomalies');
    }
    setBusy(false);
  };

  useEffect(() => { load(); }, []);

  const hasAny = tenant?.aws_ok || tenant?.gcp_ok || tenant?.azure_ok;
  if (!hasAny) return (
    <div className="fade-in">
      <PageHeader title="🚨 Anomaly Detector" subtitle="Detects cost spikes across all your clouds vs previous month"/>
      <NotConfigured cloud="a cloud provider" onGoSettings={() => window.location.href = '/settings'}/>
    </div>
  );

  if (showUpgrade) return (
    <div className="fade-in">
      <PageHeader title="🚨 Anomaly Detector" subtitle="Detects cost spikes across all your clouds vs previous month"/>
      <UpgradePrompt feature="Anomaly Detector" currentPlan={tenant?.plan} nextPlan="growth" onDismiss={() => setShowUpgrade(false)}/>
    </div>
  );
  if (busy) return <Spinner text="Analyzing cost patterns across all clouds..."/>;
  if (err)  return <ErrorBox msg={err} onRetry={load}/>;

  const all = (data?.all_anomalies || []).filter(a => !dismissed.has(`${a.cloud}-${a.service}`));
  const filtered = cloudFilter === 'ALL' ? all : all.filter(a => a.cloud === cloudFilter);
  const clouds = ['ALL', ...(tenant?.aws_ok ? ['AWS'] : []), ...(tenant?.azure_ok ? ['Azure'] : []), ...(tenant?.gcp_ok ? ['GCP'] : [])];

  return (
    <div className="fade-in">
      <PageHeader
        title="🚨 Anomaly Detector"
        subtitle="Cost spikes detected across all connected clouds — sorted by severity"
      />

      {/* Summary bar */}
      <div style={{ display:'flex', gap:'12px', marginBottom:'22px', flexWrap:'wrap' }}>
        {[
          ['Total Anomalies', data?.total_anomalies || 0, 'var(--cyan)'],
          ['Critical', data?.critical_count || 0, '#ef4444'],
          ['Excess Spend', `$${(data?.total_excess || 0).toLocaleString()}`, '#f59e0b'],
        ].map(([lbl,val,c]) => (
          <div key={lbl} style={{ flex:1, minWidth:'140px', background:'var(--card)', border:`1px solid ${c}30`, borderRadius:'12px', padding:'18px', textAlign:'center' }}>
            <div style={{ fontFamily:'var(--mono)', fontSize:'26px', fontWeight:'700', color:c, marginBottom:'4px' }}>{val}</div>
            <div style={{ fontSize:'11px', color:'var(--t3)', textTransform:'uppercase', letterSpacing:'.5px' }}>{lbl}</div>
          </div>
        ))}
      </div>

      {/* Cloud status row */}
      <div style={{ display:'flex', gap:'10px', marginBottom:'18px', flexWrap:'wrap' }}>
        {[['AWS', tenant?.aws_ok, data?.aws], ['GCP', tenant?.gcp_ok, data?.gcp], ['Azure', tenant?.azure_ok, data?.azure]].map(([name, connected, cloudData]) => (
          <div key={name} style={{
            display:'flex', alignItems:'center', gap:'8px', padding:'8px 14px',
            background:'var(--card)', border:`1px solid ${connected ? CLOUD_COLOR[name]+'30' : 'var(--border)'}`,
            borderRadius:'9px', fontSize:'12px',
            color: connected ? 'var(--t1)' : 'var(--t3)'
          }}>
            <span style={{ width:'8px', height:'8px', borderRadius:'50%', background: connected ? CLOUD_COLOR[name] : 'var(--border2)', display:'inline-block', boxShadow: connected ? `0 0 6px ${CLOUD_COLOR[name]}` : 'none' }}/>
            <span>{name}</span>
            {connected && <span style={{ marginLeft:'4px', fontFamily:'var(--mono)', fontSize:'11px', color: connected ? CLOUD_COLOR[name] : 'var(--t3)' }}>
              {cloudData?.error ? '⚠ Error' : Array.isArray(cloudData) ? `${cloudData.length} anomalies` : `${cloudData?.length || 0} anomalies`}
            </span>}
            {!connected && <span style={{ color:'var(--t3)', fontSize:'11px' }}>Not connected</span>}
          </div>
        ))}
      </div>

      {/* Cloud filter */}
      {clouds.length > 2 && (
        <div style={{ display:'flex', gap:'6px', marginBottom:'18px' }}>
          {clouds.map(c => (
            <button key={c} onClick={() => setCloudFilter(c)}
              style={{
                padding:'6px 14px', borderRadius:'20px', border:'1px solid',
                cursor:'pointer', fontSize:'11px', fontFamily:'var(--mono)',
                borderColor: cloudFilter===c ? (CLOUD_COLOR[c] || 'var(--cyan)') : 'var(--border2)',
                color: cloudFilter===c ? (CLOUD_COLOR[c] || 'var(--cyan)') : 'var(--t3)',
                background: cloudFilter===c ? `${CLOUD_COLOR[c] || '#00d4ff'}12` : 'var(--card)',
              }}>{c}</button>
          ))}
        </div>
      )}

      {!filtered.length ? (
        <div style={{ textAlign:'center', padding:'60px', background:'var(--card)', border:'1px solid var(--border)', borderRadius:'14px' }}>
          <div style={{ fontSize:'44px', marginBottom:'14px' }}>✅</div>
          <div style={{ fontFamily:'var(--mono)', color:'var(--green)', fontSize:'16px', marginBottom:'6px' }}>No anomalies detected</div>
          <div style={{ fontSize:'13px', color:'var(--t3)' }}>
            {cloudFilter !== 'ALL' ? `No anomalies for ${cloudFilter}` : 'Your cloud spend looks normal across all providers.'}
            {!data?.total_anomalies && ' (Need 2+ months of billing data to compare)'}
          </div>
        </div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:'12px' }}>
          {filtered.map((a, i) => {
            const s = SEV[a.severity] || SEV.MEDIUM;
            const cc = CLOUD_COLOR[a.cloud] || '#94a3b8';
            const key = `${a.cloud}-${a.service}`;
            return (
              <div key={i} style={{ background:'var(--card)', border:'1px solid var(--border)', borderLeft:`3px solid ${s.color}`, borderRadius:'13px', padding:'20px 24px' }}>
                <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:'14px', flexWrap:'wrap', gap:'12px' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:'12px' }}>
                    <span style={{ fontSize:'22px' }}>{s.icon}</span>
                    <div>
                      <div style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'6px', flexWrap:'wrap' }}>
                        <span style={{ fontSize:'16px', fontWeight:'700', color:'var(--t1)' }}>{a.service}</span>
                        <span style={{ fontSize:'10px', fontWeight:'700', padding:'2px 9px', borderRadius:'20px', border:`1px solid ${s.color}40`, color:s.color, background:s.color+'12', fontFamily:'var(--mono)' }}>{a.severity}</span>
                        <span style={{ fontSize:'10px', fontWeight:'700', padding:'2px 9px', borderRadius:'20px', border:`1px solid ${cc}40`, color:cc, background:cc+'12', fontFamily:'var(--mono)' }}>{a.cloud}</span>
                      </div>
                    </div>
                  </div>
                  <div style={{ textAlign:'right' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:'16px', marginBottom:'6px' }}>
                      <div style={{ textAlign:'center' }}>
                        <div style={{ fontSize:'10px', color:'var(--t3)', marginBottom:'2px' }}>LAST MONTH</div>
                        <div style={{ fontFamily:'var(--mono)', fontSize:'15px', color:'var(--t2)' }}>${a.previous?.toLocaleString()}</div>
                      </div>
                      <span style={{ color:'var(--t3)', fontSize:'16px' }}>→</span>
                      <div style={{ textAlign:'center' }}>
                        <div style={{ fontSize:'10px', color:'var(--t3)', marginBottom:'2px' }}>THIS MONTH</div>
                        <div style={{ fontFamily:'var(--mono)', fontSize:'15px', color:s.color, fontWeight:'700' }}>${a.current?.toLocaleString()}</div>
                      </div>
                    </div>
                    <div style={{ fontFamily:'var(--mono)', fontSize:'14px', color:s.color, fontWeight:'700' }}>▲ +{a.change_pct}% (+${a.change_amt?.toLocaleString()})</div>
                  </div>
                </div>
                <div style={{ fontSize:'13px', color:'var(--t2)', background:'rgba(255,255,255,.02)', borderRadius:'8px', padding:'12px 14px', marginBottom:'12px', lineHeight:'1.6' }}>{a.message}</div>
                <div style={{ display:'flex', justifyContent:'flex-end' }}>
                  <button onClick={() => setDismissed(p => new Set([...p, key]))}
                    style={{ padding:'6px 14px', background:'transparent', border:'1px solid var(--border2)', color:'var(--t3)', borderRadius:'7px', cursor:'pointer', fontSize:'12px' }}>
                    Dismiss
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Cloud errors */}
      {[['AWS', data?.aws], ['GCP', data?.gcp], ['Azure', data?.azure]].map(([name, cd]) =>
        cd?.error ? (
          <div key={name} style={{ marginTop:'12px', background:'rgba(245,158,11,.07)', border:'1px solid rgba(245,158,11,.2)', borderRadius:'9px', padding:'11px 15px', fontSize:'13px', color:'var(--orange)' }}>
            ⚠️ {name}: {cd.error}
          </div>
        ) : null
      )}
    </div>
  );
}
