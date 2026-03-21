import React, { useEffect, useState } from 'react';
import { apiReportSummary, apiDownloadReport } from '../utils/api';
import { PageHeader, Spinner } from '../components/UI';
import UpgradePrompt from '../components/UpgradePrompt';
import { getTenant } from '../utils/auth';

export default function Reports() {
  const tenant  = getTenant();
  const [summary, setSummary]   = useState(null);
  const [busy,    setBusy]      = useState(true);
  const [downloading, setDL]    = useState(false);
  const [err,     setErr]       = useState('');
  const [showUpgrade, setUpgrade] = useState(false);

  useEffect(() => {
    apiReportSummary()
      .then(r => setSummary(r.data))
      .catch(ex => {
        const d = ex.response?.data || {};
        if (d.upgrade_required) setUpgrade(true);
        else setErr(d.error || 'Failed to load');
      })
      .finally(() => setBusy(false));
  }, []);

  const download = async () => {
    setDL(true); setErr('');
    try {
      const res = await apiDownloadReport();
      const blob = new Blob([res.data], { type:'application/pdf' });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = `cloudonomix-report-${new Date().toISOString().slice(0,7)}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch(ex) {
      const d = ex.response?.data || {};
      if (d.upgrade_required) setUpgrade(true);
      else setErr(d.error || 'Download failed');
    }
    setDL(false);
  };

  if (busy) return <Spinner text="Loading reports..."/>;

  if (showUpgrade) return (
    <div className="fade-in">
      <PageHeader title="📄 Reports" subtitle="PDF cost reports for stakeholders and finance teams"/>
      <UpgradePrompt
        feature="PDF Reports"
        currentPlan={tenant?.plan}
        nextPlan="growth"
        onDismiss={() => setUpgrade(false)}
      />
    </div>
  );

  const hasCloud = tenant?.aws_ok || tenant?.gcp_ok || tenant?.azure_ok;

  return (
    <div className="fade-in">
      <PageHeader title="📄 Reports" subtitle="Generate and download PDF cost reports for stakeholders"/>

      {err && (
        <div style={{ background:'rgba(239,68,68,.09)', border:'1px solid rgba(239,68,68,.3)', color:'var(--red)', borderRadius:'9px', padding:'12px 16px', fontSize:'13px', marginBottom:'18px' }}>
          {err}
        </div>
      )}

      {!hasCloud ? (
        <div style={{ textAlign:'center', padding:'60px 24px', background:'var(--card)', border:'1px solid var(--border)', borderRadius:'14px' }}>
          <div style={{ fontSize:'48px', marginBottom:'16px' }}>☁️</div>
          <div style={{ fontFamily:'var(--mono)', fontSize:'16px', color:'var(--t1)', marginBottom:'8px' }}>No cloud connected</div>
          <div style={{ fontSize:'13px', color:'var(--t2)', marginBottom:'20px' }}>Connect a cloud provider in Settings to generate reports</div>
          <a href="/settings" style={{ display:'inline-block', background:'var(--cyan)', color:'#080c14', fontWeight:'700', fontSize:'13px', padding:'10px 22px', borderRadius:'9px', textDecoration:'none', fontFamily:'var(--mono)' }}>
            Go to Settings →
          </a>
        </div>
      ) : (
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'16px' }}>
          {/* Monthly Report Card */}
          <div style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:'14px', padding:'28px', display:'flex', flexDirection:'column', gap:'14px' }}>
            <div style={{ display:'flex', alignItems:'center', gap:'12px' }}>
              <span style={{ fontSize:'32px' }}>📊</span>
              <div>
                <div style={{ fontFamily:'var(--mono)', fontSize:'15px', fontWeight:'700', color:'var(--t1)' }}>Monthly Cost Report</div>
                <div style={{ fontSize:'12px', color:'var(--t2)', marginTop:'3px' }}>Detailed breakdown by service across all clouds</div>
              </div>
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
              {[
                '6-month cost trend per cloud',
                'Service breakdown with % share',
                'Top savings recommendations',
                'Month-over-month comparison',
              ].map(f => (
                <div key={f} style={{ display:'flex', alignItems:'center', gap:'8px', fontSize:'13px', color:'var(--t2)' }}>
                  <span style={{ color:'var(--green)', fontSize:'12px' }}>✓</span>{f}
                </div>
              ))}
            </div>
            <div style={{ fontSize:'11px', color:'var(--t3)', background:'var(--card2)', border:'1px solid var(--border)', borderRadius:'7px', padding:'9px 12px' }}>
              Last generated: {summary?.last_generated || 'Never'} · PDF format
            </div>
            <button onClick={download} disabled={downloading}
              style={{ padding:'13px', background:'var(--green)', color:'#080c14', border:'none', borderRadius:'10px', fontWeight:'700', fontSize:'14px', cursor:'pointer', fontFamily:'var(--mono)', opacity:downloading?.7:1, transition:'opacity .2s' }}>
              {downloading ? '⏳ Generating PDF...' : '⬇ Download PDF Report'}
            </button>
          </div>

          {/* What's included */}
          <div style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:'14px', padding:'28px' }}>
            <div style={{ fontFamily:'var(--mono)', fontSize:'13px', color:'var(--t1)', fontWeight:'700', marginBottom:'16px' }}>Who uses these reports?</div>
            {[
              { role:'CTO / Engineering Lead', use:'Share with team to show cloud cost trends and justify optimization efforts' },
              { role:'CFO / Finance Team', use:'Include in board presentations and quarterly financial reviews' },
              { role:'DevOps Managers', use:'Present resource waste analysis to justify infrastructure changes' },
              { role:'Startup Founders', use:'Send to investors showing responsible cloud cost management' },
            ].map(({ role, use }) => (
              <div key={role} style={{ marginBottom:'14px', paddingBottom:'14px', borderBottom:'1px solid var(--border)' }}>
                <div style={{ fontSize:'12px', fontWeight:'700', color:'var(--cyan)', fontFamily:'var(--mono)', marginBottom:'4px' }}>{role}</div>
                <div style={{ fontSize:'12px', color:'var(--t2)', lineHeight:'1.5' }}>{use}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
