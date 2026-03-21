import React, { useEffect, useState } from 'react';
import { apiAdminStats, apiAdminTenants, apiAdminPlan, apiAdminToggle, apiAdminDelete, apiAdminUsers } from '../utils/api';
import { PageHeader, Spinner, ErrorBox } from '../components/UI';
import http from '../utils/api';

const PLAN_PRICE_INR = { starter:3999, growth:9999, business:29999 };

export default function AdminPanel() {
  const [tab,     setTab]     = useState('overview');
  const [stats,   setStats]   = useState(null);
  const [tenants, setTenants] = useState([]);
  const [users,   setUsers]   = useState([]);
  const [busy,    setBusy]    = useState(true);
  const [err,     setErr]     = useState('');
  const [search,  setSearch]  = useState('');
  const [flash,   setFlash]   = useState('');

  const load = async () => {
    setBusy(true); setErr('');
    try {
      const [s,t,u] = await Promise.all([apiAdminStats(), apiAdminTenants(), apiAdminUsers()]);
      setStats(s.data); setTenants(t.data.data||[]); setUsers(u.data.data||[]);
    } catch(ex) { setErr(ex.response?.data?.error||'Failed to load'); }
    setBusy(false);
  };

  useEffect(()=>{ load(); },[]);

  const msg  = m => { setFlash(m); setTimeout(()=>setFlash(''),3000); };

  const changePlan = async (id,plan) => {
    try { await apiAdminPlan(id,plan); setTenants(p=>p.map(t=>t.id===id?{...t,plan}:t)); msg(`Plan updated to ${plan}`); } catch{}
  };
  const toggle = async id => {
    try { const r=await apiAdminToggle(id); setTenants(p=>p.map(t=>t.id===id?{...t,active:r.data.active}:t)); msg('Status updated'); } catch{}
  };
  const del = async (id,name) => {
    if (!window.confirm(`Delete "${name}"?`)) return;
    try { await apiAdminDelete(id); setTenants(p=>p.filter(t=>t.id!==id)); msg(`${name} deleted`); } catch{}
  };
  const resendVerification = async (uid, email) => {
    try { await http.post(`/admin/resend-verification/${uid}`); msg(`Verification sent to ${email}`); } catch{}
  };

  if (busy) return <Spinner text="Loading admin panel..."/>;
  if (err)  return <ErrorBox msg={err} onRetry={load}/>;

  const filtered = tenants.filter(t=>
    t.name.toLowerCase().includes(search.toLowerCase()) ||
    t.owner.toLowerCase().includes(search.toLowerCase())
  );

  const PLAN_COLOR = { starter:'var(--cyan)', growth:'var(--green)', business:'var(--purple)' };

  return (
    <div className="fade-in">
      <PageHeader title="⚙ Admin Panel" subtitle="Manage all Cloudonomix clients"/>
      {flash && <div style={{background:'rgba(16,185,129,.1)',border:'1px solid rgba(16,185,129,.3)',color:'var(--green)',borderRadius:'9px',padding:'11px 16px',marginBottom:'16px',fontFamily:'var(--mono)',fontSize:'13px'}}>✅ {flash}</div>}

      {/* Tabs */}
      <div style={{display:'flex',gap:'4px',marginBottom:'22px',borderBottom:'1px solid var(--border)'}}>
        {[['overview','📊 Overview'],['clients',`🏢 Clients (${tenants.length})`],['users',`👥 Users (${users.length})`]].map(([k,l])=>(
          <button key={k} onClick={()=>setTab(k)}
            style={{padding:'9px 20px',background:'transparent',border:'none',borderBottom:`2px solid ${tab===k?'var(--cyan)':'transparent'}`,color:tab===k?'var(--cyan)':'var(--t3)',cursor:'pointer',fontSize:'13px',marginBottom:'-1px',fontFamily:'var(--sans)'}}>
            {l}
          </button>
        ))}
      </div>

      {/* Overview */}
      {tab==='overview' && stats && (
        <>
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(150px,1fr))',gap:'12px',marginBottom:'20px'}}>
            {[
              ['Clients',   stats.total_tenants,  'var(--cyan)'],
              ['Active',    stats.active_tenants,  'var(--green)'],
              ['Users',     stats.total_users,     'var(--purple)'],
              ['Verified',  `${stats.verified_users}/${stats.total_users}`, 'var(--green)'],
              ['MRR (USD)', `$${stats.mrr_usd}`,  'var(--cyan)'],
              ['MRR (INR)', `₹${stats.mrr_inr?.toLocaleString()}`, 'var(--orange)'],
              ['ARR (INR)', `₹${stats.arr_inr?.toLocaleString()}`, 'var(--green)'],
              ['AWS ✅',    stats.aws_connected,   '#FF9900'],
              ['GCP ✅',    stats.gcp_connected,   '#4285F4'],
              ['Azure ✅',  stats.azure_connected, '#0078D4'],
            ].map(([l,v,c])=>(
              <div key={l} style={{background:'var(--card)',border:'1px solid var(--border)',borderRadius:'12px',padding:'16px',textAlign:'center',borderTop:`2px solid ${c}`}}>
                <div style={{fontFamily:'var(--mono)',fontSize:'20px',fontWeight:'700',color:c,marginBottom:'3px'}}>{v}</div>
                <div style={{fontSize:'10px',color:'var(--t3)',textTransform:'uppercase',letterSpacing:'.5px'}}>{l}</div>
              </div>
            ))}
          </div>
          {/* Plan breakdown */}
          <div style={{background:'var(--card)',border:'1px solid var(--border)',borderRadius:'12px',padding:'22px'}}>
            <div style={{fontFamily:'var(--mono)',fontSize:'13px',color:'var(--t1)',marginBottom:'16px'}}>Plan Distribution</div>
            {Object.entries(stats.plans||{}).map(([plan,count])=>(
              <div key={plan} style={{display:'flex',alignItems:'center',gap:'12px',marginBottom:'12px'}}>
                <span style={{width:'70px',fontSize:'12px',color:PLAN_COLOR[plan],fontWeight:'700',textTransform:'capitalize'}}>{plan}</span>
                <div style={{flex:1,height:'8px',background:'var(--border)',borderRadius:'4px',overflow:'hidden'}}>
                  <div style={{height:'100%',width:`${(count/(stats.total_tenants||1))*100}%`,background:PLAN_COLOR[plan],borderRadius:'4px'}}/>
                </div>
                <span style={{fontSize:'12px',color:'var(--t3)',width:'60px'}}>{count} clients</span>
                <span style={{fontFamily:'var(--mono)',fontSize:'12px',fontWeight:'700',color:PLAN_COLOR[plan],width:'80px',textAlign:'right'}}>₹{(count*PLAN_PRICE_INR[plan]).toLocaleString()}/mo</span>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Clients */}
      {tab==='clients' && (
        <>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="🔍 Search clients..."
            style={{width:'100%',maxWidth:'360px',background:'var(--card)',border:'1px solid var(--border2)',color:'var(--t1)',borderRadius:'9px',padding:'9px 14px',fontSize:'13px',outline:'none',marginBottom:'14px'}}/>
          <div style={{overflowX:'auto',borderRadius:'12px',border:'1px solid var(--border)'}}>
            <table style={{width:'100%',borderCollapse:'collapse'}}>
              <thead><tr style={{background:'var(--card2)'}}>
                {['Company','Owner','Verified','Plan','AWS','GCP','Azure','Users','Status','Joined',''].map(h=>(
                  <th key={h} style={{padding:'11px 12px',textAlign:'left',fontSize:'11px',color:'var(--t3)',textTransform:'uppercase',letterSpacing:'.4px',fontWeight:'600',whiteSpace:'nowrap'}}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {filtered.map(t=>(
                  <tr key={t.id} style={{borderTop:'1px solid var(--border)',opacity:t.active?1:.55}}>
                    <td style={{padding:'12px 12px'}}><div style={{fontSize:'13px',fontWeight:'600',color:'var(--t1)'}}>{t.name}</div></td>
                    <td style={{padding:'12px 12px',fontSize:'12px',color:'var(--t2)',fontFamily:'var(--mono)'}}>{t.owner}</td>
                    <td style={{padding:'12px 12px',fontSize:'12px',textAlign:'center'}}>{t.owner_verified?'✅':'⚠️'}</td>
                    <td style={{padding:'12px 12px'}}>
                      <select value={t.plan} onChange={e=>changePlan(t.id,e.target.value)}
                        style={{background:'var(--card2)',border:'1px solid var(--border2)',borderRadius:'7px',padding:'5px 9px',fontSize:'12px',fontFamily:'var(--mono)',color:PLAN_COLOR[t.plan],cursor:'pointer',outline:'none'}}>
                        <option value="starter">Starter</option>
                        <option value="growth">Growth</option>
                        <option value="business">Business</option>
                      </select>
                    </td>
                    <td style={{padding:'12px 8px',fontSize:'12px',textAlign:'center'}}>{t.aws_ok?'✅':'—'}</td>
                    <td style={{padding:'12px 8px',fontSize:'12px',textAlign:'center'}}>{t.gcp_ok?'✅':'—'}</td>
                    <td style={{padding:'12px 8px',fontSize:'12px',textAlign:'center'}}>{t.azure_ok?'✅':'—'}</td>
                    <td style={{padding:'12px 8px',fontSize:'13px',color:'var(--t2)',textAlign:'center'}}>{t.user_count}</td>
                    <td style={{padding:'12px 8px'}}>
                      <button onClick={()=>toggle(t.id)}
                        style={{padding:'4px 10px',borderRadius:'20px',border:`1px solid ${t.active?'var(--green)':'var(--t3)'}`,background:'transparent',color:t.active?'var(--green)':'var(--t3)',cursor:'pointer',fontSize:'11px',fontFamily:'var(--mono)',fontWeight:'700'}}>
                        {t.active?'Active':'Suspended'}
                      </button>
                    </td>
                    <td style={{padding:'12px 8px',fontSize:'11px',color:'var(--t3)',fontFamily:'var(--mono)'}}>{t.created_at}</td>
                    <td style={{padding:'12px 8px'}}>
                      <button onClick={()=>del(t.id,t.name)} style={{background:'transparent',border:'none',color:'var(--t3)',cursor:'pointer',fontSize:'16px',padding:'2px 6px'}} title="Delete">🗑</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Users */}
      {tab==='users' && (
        <>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="🔍 Search users..."
            style={{width:'100%',maxWidth:'360px',background:'var(--card)',border:'1px solid var(--border2)',color:'var(--t1)',borderRadius:'9px',padding:'9px 14px',fontSize:'13px',outline:'none',marginBottom:'14px'}}/>
          <div style={{overflowX:'auto',borderRadius:'12px',border:'1px solid var(--border)'}}>
            <table style={{width:'100%',borderCollapse:'collapse'}}>
              <thead><tr style={{background:'var(--card2)'}}>
                {['Name','Email','Verified','Role','Company','Joined',''].map(h=>(
                  <th key={h} style={{padding:'11px 14px',textAlign:'left',fontSize:'11px',color:'var(--t3)',textTransform:'uppercase',letterSpacing:'.4px',fontWeight:'600'}}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {users.filter(u=>u.name.toLowerCase().includes(search.toLowerCase())||u.email.toLowerCase().includes(search.toLowerCase())).map(u=>(
                  <tr key={u.id} style={{borderTop:'1px solid var(--border)'}}>
                    <td style={{padding:'12px 14px',fontSize:'13px',fontWeight:'600',color:'var(--t1)'}}>{u.name}</td>
                    <td style={{padding:'12px 14px',fontSize:'12px',color:'var(--t2)',fontFamily:'var(--mono)'}}>{u.email}</td>
                    <td style={{padding:'12px 14px',fontSize:'12px',textAlign:'center'}}>
                      {u.is_verified ? '✅' : <button onClick={()=>resendVerification(u.id,u.email)} style={{background:'transparent',border:'1px solid var(--orange)',color:'var(--orange)',borderRadius:'6px',padding:'3px 8px',cursor:'pointer',fontSize:'11px'}}>Resend</button>}
                    </td>
                    <td style={{padding:'12px 14px'}}><span style={{fontSize:'11px',padding:'3px 10px',borderRadius:'20px',border:'1px solid',fontFamily:'var(--mono)',fontWeight:'700',color:u.role==='owner'?'var(--cyan)':'var(--t3)',borderColor:u.role==='owner'?'rgba(0,212,255,.3)':'var(--border)'}}>{u.role}</span></td>
                    <td style={{padding:'12px 14px',fontSize:'13px',color:'var(--t2)'}}>{u.tenant}</td>
                    <td style={{padding:'12px 14px',fontSize:'12px',color:'var(--t3)',fontFamily:'var(--mono)'}}>{u.created_at}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
