import React from 'react';
import { PageHeader } from '../components/UI';

const COMPETITORS = [
  {
    name: 'Turbonomic',
    by: 'IBM',
    price: '$8,000–$15,000/mo',
    note: 'AI-driven resource optimization, very complex setup',
    cons: ['Requires 3-6 month onboarding', 'No per-resource IP-level detail', 'AWS-focused, weak Azure/GCP', 'Requires dedicated engineer to manage'],
    color: '#0073b7',
  },
  {
    name: 'Spot.io (NetApp)',
    by: 'NetApp',
    price: '$5,000–$12,000/mo',
    note: 'Spot instance automation and FinOps platform',
    cons: ['Complex pricing model', 'AWS only for core features', 'No actionable per-service steps', 'Requires DevOps expertise'],
    color: '#00c2ff',
  },
  {
    name: 'Apptio Cloudability',
    by: 'IBM',
    price: '$4,500–$8,000/mo',
    note: 'FinOps and cloud cost management for finance teams',
    cons: ['Finance-team tool, not DevOps-friendly', 'No resource-level recommendations', 'Very slow onboarding', 'No multi-cloud deep scan'],
    color: '#cc0000',
  },
];

const FEATURES = [
  ['Deep Resource Scan (VM names, IPs, CPU %)',      true, false, false, false],
  ['Specific numbered action steps per service',     true, false, false, false],
  ['Real AWS + GCP + Azure data in one place',       true, true,  false, true ],
  ['Per-resource savings (exact $ per VM/DB/volume)',true, false, false, false],
  ['Cost Anomaly Detection across all clouds',       true, true,  false, true ],
  ['Budget Alerts with email notifications',         true, true,  true,  true ],
  ['Multi-tenant (one app, many clients)',           true, false, false, false],
  ['Admin Super Panel to manage all clients',        true, false, false, false],
  ['Setup in under 10 minutes',                      true, false, false, false],
  ['No sales call required to start',                true, false, false, false],
  ['Credential validation on connect',               true, false, false, false],
  ['PDF cost reports for stakeholders',              true, true,  true,  true ],
];

export default function Compare() {
  const cloudonomixPricingNote = 'Our per-client cost is $49–$499/mo. Competitors charge $4,500–$15,000/mo for LESS functionality.';

  return (
    <div className="fade-in">
      <PageHeader
        title="⚔ Cloudonomix vs Competitors"
        subtitle="Why companies pay $5,000–$15,000/mo elsewhere — and what you get with Cloudonomix"
      />

      {/* Pricing cards */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'14px', marginBottom:'24px' }}>
        {/* Cloudonomix card */}
        <div style={{ background:'linear-gradient(135deg,rgba(0,212,255,.1),rgba(16,185,129,.05))', border:'1px solid rgba(0,212,255,.35)', borderRadius:'14px', padding:'22px', position:'relative' }}>
          <div style={{ position:'absolute', top:'-10px', left:'50%', transform:'translateX(-50%)', background:'var(--green)', color:'#080c14', fontSize:'10px', fontWeight:'700', padding:'3px 12px', borderRadius:'20px', fontFamily:'var(--mono)', whiteSpace:'nowrap' }}>BEST VALUE</div>
          <div style={{ fontFamily:'var(--mono)', fontSize:'16px', fontWeight:'700', color:'var(--t1)', marginBottom:'8px' }}>⬡ Cloudonomix</div>
          <div style={{ fontFamily:'var(--mono)', fontSize:'26px', fontWeight:'700', color:'var(--cyan)', marginBottom:'6px' }}>$49–$499<span style={{ fontSize:'13px', color:'var(--t3)' }}>/mo</span></div>
          <div style={{ fontSize:'12px', color:'var(--t2)', marginBottom:'14px' }}>All features, all clouds, immediate setup</div>
          <div style={{ display:'flex', flexDirection:'column', gap:'7px' }}>
            {['✦ Real data from AWS + GCP + Azure','✦ Specific savings actions per resource','✦ VM names, IPs, CPU — full detail','✦ Setup in 10 minutes','✦ No sales calls'].map(f => (
              <div key={f} style={{ fontSize:'12px', color:'var(--green)' }}>{f}</div>
            ))}
          </div>
        </div>

        {COMPETITORS.map(c => (
          <div key={c.name} style={{ background:'var(--card)', border:'1px solid var(--border)', borderTop:`2px solid ${c.color}`, borderRadius:'14px', padding:'22px' }}>
            <div style={{ fontFamily:'var(--mono)', fontSize:'14px', fontWeight:'700', color:'var(--t1)', marginBottom:'3px' }}>{c.name}</div>
            <div style={{ fontSize:'11px', color:'var(--t3)', marginBottom:'10px' }}>by {c.by}</div>
            <div style={{ fontFamily:'var(--mono)', fontSize:'15px', fontWeight:'700', color:'#ef4444', marginBottom:'8px' }}>{c.price}</div>
            <div style={{ fontSize:'12px', color:'var(--t2)', marginBottom:'12px' }}>{c.note}</div>
            <div style={{ display:'flex', flexDirection:'column', gap:'6px' }}>
              {c.cons.map(con => <div key={con} style={{ fontSize:'12px', color:'var(--t3)' }}>✕ {con}</div>)}
            </div>
          </div>
        ))}
      </div>

      {/* Savings callout */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', background:'linear-gradient(135deg,rgba(16,185,129,.09),rgba(0,212,255,.05))', border:'1px solid rgba(16,185,129,.28)', borderRadius:'14px', padding:'26px 32px', marginBottom:'24px', flexWrap:'wrap', gap:'18px' }}>
        <div>
          <div style={{ fontFamily:'var(--mono)', fontSize:'15px', fontWeight:'700', color:'var(--t1)', marginBottom:'5px' }}>💰 How much your clients save by choosing you over competitors</div>
          <div style={{ fontSize:'13px', color:'var(--t2)' }}>vs average competitor price of $9,000/mo</div>
        </div>
        <div style={{ display:'flex', gap:'28px' }}>
          {[['$8,501', 'saved/month'], ['$102,012', 'saved/year']].map(([v, l]) => (
            <div key={l} style={{ textAlign:'center' }}>
              <div style={{ fontFamily:'var(--mono)', fontSize:'30px', fontWeight:'700', color:'var(--green)' }}>{v}</div>
              <div style={{ fontSize:'11px', color:'var(--t3)', textTransform:'uppercase', letterSpacing:'.5px' }}>{l}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Note about AWS Cost Explorer */}
      <div style={{ background:'rgba(245,158,11,.07)', border:'1px solid rgba(245,158,11,.25)', borderRadius:'12px', padding:'16px 20px', marginBottom:'24px', fontSize:'13px', color:'var(--t2)', lineHeight:'1.7' }}>
        <strong style={{ color:'var(--orange)' }}>⚠️ Why "AWS Cost Explorer (Free)" is NOT a real competitor:</strong> AWS Cost Explorer only shows raw spend data — no GCP/Azure, no actionable recommendations, no per-resource analysis, no anomaly detection, no team features, and no savings guidance. It's a basic reporting tool, not a cost optimization platform. Cloudonomix replaces it for multi-cloud companies that need actual savings, not just charts.
      </div>

      {/* Feature table */}
      <div style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:'14px', overflow:'hidden' }}>
        <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr 1fr 1fr 1fr', background:'var(--card2)', padding:'12px 22px', fontSize:'11px', fontWeight:'700', color:'var(--t3)', textTransform:'uppercase', letterSpacing:'.5px' }}>
          <span>Feature</span>
          <span style={{ textAlign:'center', color:'var(--cyan)' }}>⬡ Cloudonomix</span>
          {COMPETITORS.map(c => <span key={c.name} style={{ textAlign:'center' }}>{c.name.split(' ')[0]}</span>)}
        </div>
        {FEATURES.map(([feat, ...vals], i) => (
          <div key={i} style={{ display:'grid', gridTemplateColumns:'2fr 1fr 1fr 1fr 1fr', padding:'11px 22px', borderTop:'1px solid var(--border)', background: i % 2 === 0 ? 'rgba(255,255,255,.008)' : 'transparent', transition:'background .15s' }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,212,255,.03)'}
            onMouseLeave={e => e.currentTarget.style.background = i % 2 === 0 ? 'rgba(255,255,255,.008)' : 'transparent'}>
            <span style={{ fontSize:'13px', color:'var(--t2)' }}>{feat}</span>
            {vals.map((v, j) => (
              <span key={j} style={{ textAlign:'center', fontSize:'16px' }}>
                {v ? <span style={{ color:'var(--green)', fontWeight:'700' }}>✓</span> : <span style={{ color:'var(--border2)' }}>✕</span>}
              </span>
            ))}
          </div>
        ))}
      </div>

      {/* CTA */}
      <div style={{ textAlign:'center', background:'var(--card)', border:'1px solid var(--border2)', borderRadius:'14px', padding:'44px 32px', marginTop:'20px' }}>
        <h3 style={{ fontFamily:'var(--mono)', fontSize:'20px', color:'var(--t1)', marginBottom:'10px' }}>Win every client conversation</h3>
        <p style={{ fontSize:'14px', color:'var(--t2)', maxWidth:'480px', margin:'0 auto 24px', lineHeight:'1.7' }}>
          Show this page to any prospect. They are paying $5,000–$15,000/mo for LESS than what Cloudonomix delivers. The math is obvious.
        </p>
        <a href="/settings" style={{ display:'inline-block', background:'var(--cyan)', color:'#080c14', fontWeight:'700', fontSize:'14px', padding:'14px 28px', borderRadius:'10px', textDecoration:'none', fontFamily:'var(--mono)' }}>
          Connect Your Cloud Account →
        </a>
      </div>
    </div>
  );
}
