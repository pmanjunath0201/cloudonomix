import React, { useEffect, useState } from 'react';
import { apiGetAlerts, apiCreateAlert, apiDeleteAlert, apiToggleAlert } from '../utils/api';
import { PageHeader, Card, Btn, Spinner } from '../components/UI';

const CLOUD_COLOR = { AWS:'#FF9900', GCP:'#4285F4', Azure:'#0078D4', ALL:'var(--cyan)' };

export default function Alerts() {
  const [alerts,  setAlerts]  = useState([]);
  const [usage,   setUsage]   = useState(null);
  const [form,    setForm]    = useState({ name:'', threshold:'', email:'', cloud:'ALL', service:'ALL' });
  const [show,    setShow]    = useState(false);
  const [busy,    setBusy]    = useState(false);
  const [saving,  setSaving]  = useState(false);
  const [err,     setErr]     = useState('');
  const [upgradeMsg, setUpgradeMsg] = useState('');

  const load = async () => {
    setBusy(true);
    try {
      const r = await apiGetAlerts();
      setAlerts(r.data.data || []);
      setUsage(r.data.usage);
    } catch{}
    setBusy(false);
  };

  useEffect(() => { load(); }, []);

  const create = async e => {
    e.preventDefault(); setSaving(true); setErr(''); setUpgradeMsg('');
    try {
      await apiCreateAlert({ ...form, threshold: parseFloat(form.threshold) });
      setForm({ name:'', threshold:'', email:'', cloud:'ALL', service:'ALL' });
      setShow(false);
      load();
    } catch(ex) {
      const d = ex.response?.data || {};
      if (d.upgrade_required) {
        setUpgradeMsg(d.error);
        setShow(false);
      } else {
        setErr(d.error || 'Failed to create alert');
      }
    }
    setSaving(false);
  };

  const del    = async id => { try { await apiDeleteAlert(id); setAlerts(p=>p.filter(a=>a.id!==id)); } catch{} };
  const toggle = async id => {
    try { await apiToggleAlert(id); setAlerts(p=>p.map(a=>a.id===id?{...a,active:!a.active}:a)); } catch{}
  };

  const canAdd = !usage || usage.current < usage.max;

  return (
    <div className="fade-in">
      <PageHeader
        title="△ Budget Alerts"
        subtitle="Automatic email alerts when cloud spend crosses your thresholds — checked every hour"
        actions={
          canAdd
            ? <Btn onClick={() => { setShow(!show); setErr(''); }}>
                {show ? '✕ Cancel' : '+ New Alert'}
              </Btn>
            : <span style={{ fontSize:'13px', color:'var(--orange)', padding:'8px 14px', background:'rgba(245,158,11,.1)', border:'1px solid rgba(245,158,11,.25)', borderRadius:'8px' }}>
                Alert limit reached — Upgrade to add more
              </span>
        }
      />

      {/* Upgrade message */}
      {upgradeMsg && (
        <div style={{ background:'rgba(245,158,11,.08)', border:'1px solid rgba(245,158,11,.25)', borderRadius:'11px', padding:'14px 18px', marginBottom:'18px', fontSize:'13px', color:'var(--orange)' }}>
          ⚠️ {upgradeMsg}
          <a href="https://wa.me/919XXXXXXXXX?text=I want to upgrade Cloudonomix plan" target="_blank" rel="noreferrer"
             style={{ marginLeft:'12px', color:'var(--green)', fontWeight:'700' }}>
            📱 Upgrade via WhatsApp
          </a>
        </div>
      )}

      {/* Usage bar */}
      {usage && (
        <div style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:'11px', padding:'14px 18px', marginBottom:'18px', display:'flex', alignItems:'center', gap:'16px' }}>
          <span style={{ fontSize:'13px', color:'var(--t2)' }}>Alerts used:</span>
          <div style={{ flex:1, height:'6px', background:'var(--border)', borderRadius:'3px', overflow:'hidden' }}>
            <div style={{ height:'100%', width:`${Math.min((usage.current/usage.max)*100,100)}%`, background: usage.current>=usage.max?'var(--orange)':'var(--cyan)', borderRadius:'3px', transition:'width .5s' }}/>
          </div>
          <span style={{ fontFamily:'var(--mono)', fontSize:'12px', color: usage.current>=usage.max?'var(--orange)':'var(--t2)' }}>
            {usage.current} / {usage.max}
          </span>
        </div>
      )}

      {/* How alerts work info box */}
      <div style={{ background:'rgba(0,212,255,.05)', border:'1px solid rgba(0,212,255,.15)', borderRadius:'11px', padding:'14px 18px', marginBottom:'20px', fontSize:'13px', color:'var(--t2)', lineHeight:'1.6' }}>
        <strong style={{ color:'var(--cyan)' }}>ℹ️ How alerts work:</strong> Cloudonomix checks your cloud spend every hour automatically.
        When your spend exceeds the threshold, an email is sent to the address you specify.
        To avoid email spam, alerts trigger max once every 24 hours per alert.
      </div>

      {/* Create form */}
      {show && (
        <Card className="mb-20" style={{ marginBottom:'20px' }}>
          <h3 style={{ fontFamily:'var(--mono)', fontSize:'14px', color:'var(--t1)', marginBottom:'18px' }}>Create Budget Alert</h3>
          {err && <div style={{ background:'rgba(239,68,68,.09)', border:'1px solid rgba(239,68,68,.3)', color:'var(--red)', borderRadius:'9px', padding:'11px 15px', fontSize:'13px', marginBottom:'16px' }}>{err}</div>}
          <form onSubmit={create} style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'14px' }}>
            {[
              ['Alert Name','text',form.name,'name','e.g. Monthly Budget Limit'],
              ['Threshold Amount','number',form.threshold,'threshold','e.g. 5000'],
              ['Alert Email','email',form.email,'email','you@company.com'],
            ].map(([lbl,type,val,key,ph])=>(
              <div key={key} style={{ display:'flex', flexDirection:'column', gap:'5px' }}>
                <label style={{ fontSize:'11px', color:'var(--t2)', textTransform:'uppercase', letterSpacing:'.5px', fontWeight:'600' }}>{lbl}</label>
                <input type={type} placeholder={ph} value={val} required
                  style={{ background:'var(--card2)', border:'1px solid var(--border2)', color:'var(--t1)', borderRadius:'8px', padding:'10px 13px', fontSize:'13px', outline:'none' }}
                  onChange={e=>setForm({...form,[key]:e.target.value})}/>
              </div>
            ))}
            <div style={{ display:'flex', flexDirection:'column', gap:'5px' }}>
              <label style={{ fontSize:'11px', color:'var(--t2)', textTransform:'uppercase', letterSpacing:'.5px', fontWeight:'600' }}>Cloud</label>
              <select value={form.cloud} onChange={e=>setForm({...form,cloud:e.target.value})}
                style={{ background:'var(--card2)', border:'1px solid var(--border2)', color:'var(--t1)', borderRadius:'8px', padding:'10px 13px', fontSize:'13px', outline:'none' }}>
                <option value="ALL">All Clouds (Total)</option>
                <option value="AWS">AWS Only</option>
                <option value="Azure">Azure Only</option>
                <option value="GCP">GCP Only</option>
              </select>
            </div>
            <div style={{ gridColumn:'1/-1' }}>
              <p style={{ fontSize:'12px', color:'var(--t3)', marginBottom:'12px' }}>
                💡 <strong>Tip:</strong> Enter threshold in your billing currency (₹ for India, $ for global). The alert fires when your spend exceeds this amount in the current month.
              </p>
              <Btn disabled={saving}>{saving?'Creating...':'✓ Create Alert'}</Btn>
            </div>
          </form>
        </Card>
      )}

      {/* Alerts list */}
      {busy ? <Spinner text="Loading alerts..."/> : (
        <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
          {alerts.length === 0 && (
            <div style={{ textAlign:'center', padding:'48px', background:'var(--card)', border:'1px dashed var(--border)', borderRadius:'12px', color:'var(--t3)', fontSize:'14px' }}>
              No alerts yet.<br/>
              <span style={{ fontSize:'13px' }}>Create one to get emailed when your cloud bill gets too high.</span>
            </div>
          )}
          {alerts.map(a => (
            <div key={a.id} style={{
              background:'var(--card)', border:'1px solid var(--border)', borderRadius:'12px',
              padding:'16px 20px', display:'flex', alignItems:'center', gap:'14px',
              flexWrap:'wrap', opacity:a.active?1:.55, transition:'opacity .2s'
            }}>
              {/* Status dot */}
              <div style={{ width:'10px', height:'10px', borderRadius:'50%', flexShrink:0,
                background:a.active?'var(--green)':'var(--t3)',
                boxShadow:a.active?'0 0 7px var(--green)':'none' }}/>

              {/* Alert info */}
              <div style={{ flex:1, minWidth:'200px' }}>
                <div style={{ fontSize:'14px', fontWeight:'600', color:'var(--t1)', marginBottom:'3px' }}>{a.name}</div>
                <div style={{ display:'flex', gap:'8px', flexWrap:'wrap' }}>
                  <span style={{ fontSize:'11px', padding:'2px 8px', borderRadius:'20px', border:`1px solid ${CLOUD_COLOR[a.cloud]||'var(--border)'}40`, color:CLOUD_COLOR[a.cloud]||'var(--t3)', background:`${CLOUD_COLOR[a.cloud]||'#fff'}10`, fontFamily:'var(--mono)', fontWeight:'700' }}>
                    {a.cloud}
                  </span>
                  {a.service !== 'ALL' && (
                    <span style={{ fontSize:'11px', color:'var(--t3)', background:'var(--card2)', border:'1px solid var(--border)', padding:'2px 8px', borderRadius:'20px' }}>{a.service}</span>
                  )}
                  <span style={{ fontSize:'11px', color:'var(--t3)' }}>→ {a.email}</span>
                </div>
              </div>

              {/* Threshold */}
              <div style={{ textAlign:'right', minWidth:'100px' }}>
                <div style={{ fontFamily:'var(--mono)', fontSize:'18px', fontWeight:'700', color:'var(--cyan)' }}>
                  {a.threshold?.toLocaleString()}
                </div>
                <div style={{ fontSize:'11px', color:'var(--t3)' }}>threshold/mo</div>
              </div>

              {/* Last triggered */}
              {a.last_triggered && (
                <div style={{ textAlign:'center', minWidth:'90px' }}>
                  <div style={{ fontSize:'11px', color:'var(--orange)', fontFamily:'var(--mono)', fontWeight:'700' }}>
                    🚨 {a.trigger_count}x triggered
                  </div>
                  <div style={{ fontSize:'10px', color:'var(--t3)' }}>
                    Last: {new Date(a.last_triggered).toLocaleDateString()}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div style={{ display:'flex', gap:'8px', alignItems:'center' }}>
                <button onClick={() => toggle(a.id)}
                  style={{ padding:'5px 13px', borderRadius:'20px', border:`1px solid ${a.active?'var(--green)':'var(--t3)'}`, background:'transparent', color:a.active?'var(--green)':'var(--t3)', cursor:'pointer', fontSize:'11px', fontFamily:'var(--mono)', fontWeight:'700' }}>
                  {a.active?'ON':'OFF'}
                </button>
                <button onClick={() => del(a.id)}
                  style={{ width:'32px', height:'32px', borderRadius:'8px', border:'1px solid var(--border)', background:'transparent', color:'var(--t3)', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'14px', transition:'all .15s' }}
                  onMouseOver={e=>{e.currentTarget.style.color='var(--red)';e.currentTarget.style.borderColor='var(--red)'}}
                  onMouseOut={e=>{e.currentTarget.style.color='var(--t3)';e.currentTarget.style.borderColor='var(--border)'}}>
                  ✕
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
