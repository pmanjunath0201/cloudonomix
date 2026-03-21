import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { apiSaveAws, apiSaveGcp, apiSaveAzure, apiRevokeCloud, apiInvite, apiSaveSlack, apiTestSlack } from '../utils/api';
import { getTenant, getUser, refreshTenant, getToken } from '../utils/auth';
import { PageHeader, Card, Btn, Spinner } from '../components/UI';
import http from '../utils/api';
import './Settings.css';

const AWS_REGIONS = ['us-east-1','us-east-2','us-west-1','us-west-2','eu-west-1','eu-west-2','eu-central-1','ap-south-1','ap-southeast-1','ap-northeast-1','ca-central-1','sa-east-1'];
const PLAN_COLOR  = { starter:'var(--cyan)', growth:'var(--green)', business:'var(--purple)' };
const PLAN_FEATURES = {
  starter:  { clouds:1, users:3, alerts:3, scanner:false, anomaly:false, reports:false },
  growth:   { clouds:3, users:10, alerts:20, scanner:true, anomaly:true, reports:true },
  business: { clouds:'∞', users:'∞', alerts:'∞', scanner:true, anomaly:true, reports:true },
};

function Msg({ state }) {
  if (!state) return null;
  return <div className={`settings-msg ${state.ok?'msg-ok':'msg-err'}`}>{state.text}</div>;
}

function FormGroup({ label, children }) {
  return <div className="fg"><label>{label}</label>{children}</div>;
}

function UsageBar({ label, current, max, color='var(--cyan)' }) {
  const pct = max === '∞' ? 100 : Math.min((current / max) * 100, 100);
  const isNear = max !== '∞' && current >= max;
  return (
    <div style={{ marginBottom:'14px' }}>
      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'5px' }}>
        <span style={{ fontSize:'12px', color:'var(--t2)' }}>{label}</span>
        <span style={{ fontSize:'12px', fontFamily:'var(--mono)', color: isNear?'var(--orange)':'var(--t2)' }}>
          {current} / {max} {isNear && '⚠️ Limit reached'}
        </span>
      </div>
      <div style={{ height:'6px', background:'var(--border)', borderRadius:'3px', overflow:'hidden' }}>
        <div style={{ height:'100%', width:`${pct}%`, background: isNear?'var(--orange)':color, borderRadius:'3px', transition:'width .5s' }}/>
      </div>
    </div>
  );
}

export default function Settings() {
  const loc      = useLocation();
  const nav      = useNavigate();
  const isSetup  = new URLSearchParams(loc.search).get('setup') === '1';
  const tenant   = getTenant();
  const user     = getUser();
  const [tab, setTab] = useState('plan');

  // Plan status
  const [planStatus, setPlanStatus] = useState(null);

  // AWS
  const [aws,     setAws]     = useState({ aws_access_key:'', aws_secret_key:'', aws_region:'us-east-1' });
  const [awsMsg,  setAwsMsg]  = useState(null);
  const [awsBusy, setAwsBusy] = useState(false);

  // GCP
  const [gcp,     setGcp]     = useState({ gcp_project_id:'', gcp_service_account:'' });
  const [gcpMsg,  setGcpMsg]  = useState(null);
  const [gcpBusy, setGcpBusy] = useState(false);

  // Azure
  const [az,     setAz]     = useState({ azure_subscription_id:'', azure_tenant_id:'', azure_client_id:'', azure_client_secret:'' });
  const [azMsg,  setAzMsg]  = useState(null);
  const [azBusy, setAzBusy] = useState(false);

  // Team
  const [inv,     setInv]     = useState({ name:'', email:'', password:'' });
  const [slack,   setSlack]   = useState({ webhook_url:'' });
  const [slackMsg,setSlackMsg]= useState(null);
  const [slackBusy,setSlackBusy]=useState(false);
  const [invMsg,  setInvMsg]  = useState(null);
  const [invBusy, setInvBusy] = useState(false);

  useEffect(() => {
    http.get('/dashboard/plan-status').then(r => setPlanStatus(r.data)).catch(()=>{});
    if (isSetup) setTab('aws');
  }, []);

  const doRefresh = async () => {
    await refreshTenant();
    const r = await http.get('/dashboard/plan-status');
    setPlanStatus(r.data);
    window.location.reload();
  };

  const saveAws = async e => {
    e.preventDefault(); setAwsMsg(null); setAwsBusy(true);
    try {
      const r = await apiSaveAws(aws);
      if (r.data.upgrade_required) { setAwsMsg({ ok:false, text:r.data.error }); setAwsBusy(false); return; }
      setAwsMsg({ ok:true, text: r.data.message });
      setAws(f=>({...f, aws_access_key:'', aws_secret_key:''}));
      await doRefresh();
    } catch(ex) {
      const d = ex.response?.data || {};
      setAwsMsg({ ok:false, text: d.error || 'Failed' });
      if (d.upgrade_required) nav('/settings?tab=plan');
    }
    setAwsBusy(false);
  };

  const saveGcp = async e => {
    e.preventDefault(); setGcpMsg(null); setGcpBusy(true);
    try {
      const r = await apiSaveGcp(gcp);
      setGcpMsg({ ok:true, text:r.data.message });
      setGcp(f=>({...f, gcp_service_account:''}));
      await doRefresh();
    } catch(ex) {
      const d = ex.response?.data || {};
      setGcpMsg({ ok:false, text: d.error || 'Failed' });
    }
    setGcpBusy(false);
  };

  const saveAzure = async e => {
    e.preventDefault(); setAzMsg(null); setAzBusy(true);
    try {
      const r = await apiSaveAzure(az);
      setAzMsg({ ok:true, text:r.data.message });
      setAz({ azure_subscription_id:'', azure_tenant_id:'', azure_client_id:'', azure_client_secret:'' });
      await doRefresh();
    } catch(ex) {
      const d = ex.response?.data || {};
      setAzMsg({ ok:false, text: d.error || 'Failed' });
    }
    setAzBusy(false);
  };

  const revoke = async cloud => {
    if (!window.confirm(`Disconnect ${cloud.toUpperCase()}?`)) return;
    try { await apiRevokeCloud(cloud); await doRefresh(); }
    catch(ex) { alert(ex.response?.data?.error || 'Failed'); }
  };

  const saveSlack = async e => {
    e.preventDefault(); setSlackMsg(null); setSlackBusy(true);
    try {
      const r = await apiSaveSlack(slack);
      setSlackMsg({ ok:true, text:r.data.message });
      setSlack({ webhook_url:'' });
    } catch(ex) { setSlackMsg({ ok:false, text:ex.response?.data?.error||'Failed' }); }
    setSlackBusy(false);
  };

  const testSlack = async () => {
    try { const r = await apiTestSlack(); setSlackMsg({ ok:true, text:r.data.message }); }
    catch(ex) { setSlackMsg({ ok:false, text:ex.response?.data?.error||'Test failed' }); }
  };

  const sendInvite = async e => {
    e.preventDefault(); setInvMsg(null); setInvBusy(true);
    try {
      await apiInvite(inv);
      setInvMsg({ ok:true, text:`${inv.email} added as team member` });
      setInv({ name:'', email:'', password:'' });
      const r = await http.get('/dashboard/plan-status');
      setPlanStatus(r.data);
    } catch(ex) {
      const d = ex.response?.data || {};
      setInvMsg({ ok:false, text: d.error || 'Failed' });
    }
    setInvBusy(false);
  };

  const planFeats = PLAN_FEATURES[tenant?.plan] || PLAN_FEATURES.starter;
  const connectedClouds = [tenant?.aws_ok, tenant?.gcp_ok, tenant?.azure_ok].filter(Boolean).length;

  const tabs = [
    { key:'plan',   label:'📊 Plan & Usage' },
    { key:'aws',    label:'☁️ AWS',          ok:tenant?.aws_ok },
    { key:'gcp',    label:'🔵 Google Cloud', ok:tenant?.gcp_ok },
    { key:'azure',  label:'🔷 Azure',        ok:tenant?.azure_ok },
    { key:'team',   label:'👥 Team' },
    { key:'slack',  label:'💬 Slack' },
    { key:'account',label:'🏢 Account' },
  ];

  return (
    <div className="settings-page fade-in">
      <PageHeader title="Settings" subtitle={isSetup ? '🎉 Connect your cloud accounts below to see real cost data.' : 'Manage credentials, team, and account'} />

      {isSetup && (
        <div className="setup-banner">
          <strong>👋 One last step!</strong> Connect at least one cloud provider below. Your dashboard will show real data only after connecting.
        </div>
      )}

      {/* Connection status pills */}
      <div className="cloud-status-row">
        {[['AWS','aws_ok','var(--aws)'],['GCP','gcp_ok','var(--gcp)'],['Azure','azure_ok','var(--azure)']].map(([name,key,color])=>(
          <div key={name} className={`csr-item ${tenant?.[key]?'csr-on':''}`} style={tenant?.[key]?{borderColor:color+'50',background:color+'0d'}:{}}>
            <span className="csr-dot" style={tenant?.[key]?{background:color,boxShadow:`0 0 7px ${color}`}:{}}/>
            <span>{name}</span>
            <span className="csr-status">{tenant?.[key]?'✅ Connected':'Not connected'}</span>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="stabs">
        {tabs.map(t=>(
          <button key={t.key} className={`stab ${tab===t.key?'stab--active':''}`} onClick={()=>setTab(t.key)}>
            {t.label}
            {t.ok !== undefined && <span className="stab-dot" style={{background:t.ok?'var(--green)':'var(--orange)'}}/>}
          </button>
        ))}
      </div>

      {/* ── PLAN & USAGE ── */}
      {tab === 'plan' && (
        <Card>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'20px', flexWrap:'wrap', gap:'12px' }}>
            <div>
              <h3 style={{ fontFamily:'var(--mono)', fontSize:'16px', color:'var(--t1)', marginBottom:'4px' }}>
                Current Plan: <span style={{ color: PLAN_COLOR[tenant?.plan] }}>{tenant?.plan?.charAt(0).toUpperCase() + tenant?.plan?.slice(1)}</span>
              </h3>
              <p style={{ fontSize:'13px', color:'var(--t2)' }}>
                {tenant?.plan==='starter' && 'Upgrade to Growth for Resource Scanner, Anomaly Detector, PDF Reports and more.'}
                {tenant?.plan==='growth'  && 'Upgrade to Business for unlimited clouds, users, and priority support.'}
                {tenant?.plan==='business'&& 'You have full access to all Cloudonomix features.'}
              </p>
            </div>
            {planStatus?.next_plan && (
              <a href={`https://wa.me/919XXXXXXXXX?text=I want to upgrade to ${planStatus.next_plan} plan`}
                 target="_blank" rel="noreferrer"
                 style={{ padding:'10px 20px', background:'var(--green)', color:'#080c14', borderRadius:'9px', textDecoration:'none', fontWeight:'700', fontSize:'13px', fontFamily:'var(--mono)', whiteSpace:'nowrap' }}>
                📱 Upgrade to {planStatus.next_plan?.charAt(0).toUpperCase() + planStatus.next_plan?.slice(1)} →
              </a>
            )}
          </div>

          {/* Usage bars */}
          {planStatus && (
            <div style={{ background:'var(--card2)', border:'1px solid var(--border)', borderRadius:'12px', padding:'20px', marginBottom:'20px' }}>
              <div style={{ fontSize:'12px', fontWeight:'600', color:'var(--t3)', textTransform:'uppercase', letterSpacing:'.5px', marginBottom:'16px' }}>Current Usage</div>
              <UsageBar label="Cloud Accounts" current={connectedClouds} max={planFeats.clouds} color={PLAN_COLOR[tenant?.plan]}/>
              <UsageBar label="Team Members"   current={planStatus.usage?.users}  max={planFeats.users}  color={PLAN_COLOR[tenant?.plan]}/>
              <UsageBar label="Budget Alerts"  current={planStatus.usage?.alerts} max={planFeats.alerts} color={PLAN_COLOR[tenant?.plan]}/>
            </div>
          )}

          {/* Feature matrix */}
          <div style={{ fontSize:'12px', fontWeight:'600', color:'var(--t3)', textTransform:'uppercase', letterSpacing:'.5px', marginBottom:'12px' }}>Features Included</div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'10px' }}>
            {[
              ['Resource Scanner', planFeats.scanner],
              ['Anomaly Detector', planFeats.anomaly],
              ['PDF Reports',      planFeats.reports],
              ['Multi-Cloud View', tenant?.plan !== 'starter'],
              ['Budget Alerts',    true],
              ['Cost Explorer',    true],
            ].map(([feat, avail]) => (
              <div key={feat} style={{ display:'flex', alignItems:'center', gap:'8px', background:'var(--card2)', border:'1px solid var(--border)', borderRadius:'8px', padding:'10px 14px' }}>
                <span style={{ color: avail?'var(--green)':'var(--t3)', fontSize:'14px' }}>{avail?'✓':'✕'}</span>
                <span style={{ fontSize:'12px', color: avail?'var(--t1)':'var(--t3)' }}>{feat}</span>
              </div>
            ))}
          </div>

          {/* Plan cards */}
          {tenant?.plan !== 'business' && (
            <>
              <div style={{ fontSize:'12px', fontWeight:'600', color:'var(--t3)', textTransform:'uppercase', letterSpacing:'.5px', margin:'20px 0 12px' }}>Available Upgrades</div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'14px' }}>
                {[{plan:'growth',priceInr:9999,priceUsd:149},{plan:'business',priceInr:29999,priceUsd:499}].filter(p=>p.plan!==tenant?.plan).map(p=>(
                  <div key={p.plan} style={{ background:'var(--card2)', border:`1px solid ${PLAN_COLOR[p.plan]}30`, borderRadius:'12px', padding:'18px' }}>
                    <div style={{ fontFamily:'var(--mono)', fontSize:'15px', fontWeight:'700', color:PLAN_COLOR[p.plan], marginBottom:'4px' }}>{p.plan.charAt(0).toUpperCase()+p.plan.slice(1)}</div>
                    <div style={{ fontFamily:'var(--mono)', fontSize:'22px', fontWeight:'700', color:'var(--t1)', marginBottom:'8px' }}>₹{p.priceInr.toLocaleString()}<span style={{fontSize:'13px',color:'var(--t3)'}}>/mo</span></div>
                    <div style={{ fontSize:'11px', color:'var(--t3)', marginBottom:'14px' }}>${p.priceUsd}/mo for global clients</div>
                    <a href={`https://wa.me/919XXXXXXXXX?text=Upgrade to ${p.plan}`} target="_blank" rel="noreferrer"
                       style={{ display:'block', padding:'9px', background:PLAN_COLOR[p.plan], color:'#080c14', borderRadius:'8px', textDecoration:'none', fontWeight:'700', fontSize:'12px', textAlign:'center', fontFamily:'var(--mono)' }}>
                      Upgrade via WhatsApp
                    </a>
                  </div>
                ))}
              </div>
            </>
          )}
        </Card>
      )}

      {/* ── AWS ── */}
      {tab === 'aws' && (
        <Card>
          <div className="cred-header">
            <div>
              <h3>Amazon Web Services</h3>
              <span className={tenant?.aws_ok?'status-ok':'status-no'}>{tenant?.aws_ok?'✅ Connected':'⚠️ Not connected'}</span>
            </div>
            {tenant?.aws_ok && <Btn variant="danger" onClick={()=>revoke('aws')}>Disconnect</Btn>}
          </div>
          <p className="cred-desc">Scan EC2, RDS, S3, EBS and Cost Explorer data.</p>
          {!planStatus?.can_add_cloud && !tenant?.aws_ok && (
            <div className="settings-msg msg-err">Your {tenant?.plan} plan allows {planStatus?.limits?.max_clouds} cloud connection(s). Upgrade to connect more clouds.</div>
          )}
          <div className="tip-box tip-aws">
            <strong>💡 AWS IAM Setup:</strong> AWS Console → IAM → Users → Create User → Attach: <code>ReadOnlyAccess</code> + <code>AWSCostExplorerFullAccess</code> → Security Credentials → Create Access Key
          </div>
          <Msg state={awsMsg}/>
          <form onSubmit={saveAws} className="cred-form">
            <FormGroup label="AWS Access Key ID"><input type="text" placeholder="AKIAIOSFODNN7EXAMPLE" value={aws.aws_access_key} required onChange={e=>setAws({...aws,aws_access_key:e.target.value})}/></FormGroup>
            <FormGroup label="AWS Secret Access Key"><input type="password" placeholder="wJalrXUtnFEMI..." value={aws.aws_secret_key} required onChange={e=>setAws({...aws,aws_secret_key:e.target.value})}/></FormGroup>
            <FormGroup label="Primary Region">
              <select value={aws.aws_region} onChange={e=>setAws({...aws,aws_region:e.target.value})}>
                {AWS_REGIONS.map(r=><option key={r} value={r}>{r}</option>)}
              </select>
            </FormGroup>
            <Btn disabled={awsBusy}>{awsBusy?'Validating...':'✓ Save & Validate AWS'}</Btn>
          </form>
        </Card>
      )}

      {/* ── GCP ── */}
      {tab === 'gcp' && (
        <Card>
          <div className="cred-header">
            <div>
              <h3>Google Cloud Platform</h3>
              <span className={tenant?.gcp_ok?'status-ok':'status-no'}>{tenant?.gcp_ok?'✅ Connected':'⚠️ Not connected'}</span>
            </div>
            {tenant?.gcp_ok && <Btn variant="danger" onClick={()=>revoke('gcp')}>Disconnect</Btn>}
          </div>
          <p className="cred-desc">Fetch Compute Engine, Cloud Storage, BigQuery, and Cloud SQL costs.</p>
          {!planStatus?.can_add_cloud && !tenant?.gcp_ok && (
            <div className="settings-msg msg-err">Cloud limit reached on your {tenant?.plan} plan. Upgrade to connect GCP.</div>
          )}
          <div className="tip-box tip-gcp">
            <strong>💡 GCP Setup:</strong> GCP Console → IAM → Service Accounts → Create → Roles: <code>Billing Account Viewer</code> + <code>Project Viewer</code> → Keys → Add Key → JSON → paste below
          </div>
          <Msg state={gcpMsg}/>
          <form onSubmit={saveGcp} className="cred-form">
            <FormGroup label="GCP Project ID"><input type="text" placeholder="my-project-123456" value={gcp.gcp_project_id} required onChange={e=>setGcp({...gcp,gcp_project_id:e.target.value})}/></FormGroup>
            <FormGroup label="Service Account JSON Key">
              <textarea rows={8} placeholder={'{\n  "type": "service_account",\n  "project_id": "...",\n  ...\n}'} value={gcp.gcp_service_account} required onChange={e=>setGcp({...gcp,gcp_service_account:e.target.value})}/>
            </FormGroup>
            <Btn disabled={gcpBusy} style={{background:'var(--gcp)',color:'#fff'}}>{gcpBusy?'Validating...':'✓ Save & Validate GCP'}</Btn>
          </form>
        </Card>
      )}

      {/* ── AZURE ── */}
      {tab === 'azure' && (
        <Card>
          <div className="cred-header">
            <div>
              <h3>Microsoft Azure</h3>
              <span className={tenant?.azure_ok?'status-ok':'status-no'}>{tenant?.azure_ok?'✅ Connected':'⚠️ Not connected'}</span>
            </div>
            {tenant?.azure_ok && <Btn variant="danger" onClick={()=>revoke('azure')}>Disconnect</Btn>}
          </div>
          <p className="cred-desc">Fetch VM, Blob Storage, SQL, AKS costs via Azure Cost Management API.</p>
          {!planStatus?.can_add_cloud && !tenant?.azure_ok && (
            <div className="settings-msg msg-err">Cloud limit reached on your {tenant?.plan} plan. Upgrade to connect Azure.</div>
          )}
          <div className="tip-box tip-azure">
            <strong>💡 Azure Setup:</strong><br/>
            1. Azure Portal → Azure Active Directory → App registrations → New registration<br/>
            2. Certificates &amp; secrets → New client secret → copy the Value<br/>
            3. Subscriptions → your sub → Access control (IAM) → Add role: <code>Billing Reader</code> → select your app
          </div>
          <Msg state={azMsg}/>
          <form onSubmit={saveAzure} className="cred-form">
            <div className="form-grid-2">
              <FormGroup label="Subscription ID"><input type="text" placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" value={az.azure_subscription_id} required onChange={e=>setAz({...az,azure_subscription_id:e.target.value})}/></FormGroup>
              <FormGroup label="Tenant ID (Directory ID)"><input type="text" placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" value={az.azure_tenant_id} required onChange={e=>setAz({...az,azure_tenant_id:e.target.value})}/></FormGroup>
              <FormGroup label="Client ID (Application ID)"><input type="text" placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" value={az.azure_client_id} required onChange={e=>setAz({...az,azure_client_id:e.target.value})}/></FormGroup>
              <FormGroup label="Client Secret (Value)"><input type="password" placeholder="Your app registration secret" value={az.azure_client_secret} required onChange={e=>setAz({...az,azure_client_secret:e.target.value})}/></FormGroup>
            </div>
            <Btn disabled={azBusy} style={{background:'var(--azure)',color:'#fff'}}>{azBusy?'Validating...':'✓ Save & Validate Azure'}</Btn>
          </form>
        </Card>
      )}

      {/* ── TEAM ── */}
      {tab === 'team' && (
        <Card>
          <h3 style={{fontFamily:'var(--mono)',fontSize:'15px',color:'var(--t1)',marginBottom:'6px'}}>Team Members</h3>
          {planStatus && <UsageBar label="Team Members Used" current={planStatus.usage?.users} max={planStatus.limits?.max_users} color="var(--purple)"/>}
          <p className="cred-desc">Invited members can view all data but cannot change cloud credentials.</p>
          <Msg state={invMsg}/>
          {planStatus?.can_add_user ? (
            <form onSubmit={sendInvite} className="cred-form">
              <FormGroup label="Full Name"><input type="text" placeholder="Jane Doe" value={inv.name} required onChange={e=>setInv({...inv,name:e.target.value})}/></FormGroup>
              <FormGroup label="Email"><input type="email" placeholder="jane@company.com" value={inv.email} required onChange={e=>setInv({...inv,email:e.target.value})}/></FormGroup>
              <FormGroup label="Temporary Password"><input type="password" placeholder="Min 6 characters" value={inv.password} required minLength={6} onChange={e=>setInv({...inv,password:e.target.value})}/></FormGroup>
              <Btn disabled={invBusy}>{invBusy?'Adding...':'+ Add Team Member'}</Btn>
            </form>
          ) : (
            <div className="settings-msg msg-err">Team member limit reached on your {tenant?.plan} plan. Upgrade to add more members.</div>
          )}
        </Card>
      )}

      {/* ── SLACK ── */}
      {tab === 'slack' && (
        <Card>
          <h3 style={{fontFamily:'var(--mono)',fontSize:'15px',color:'var(--t1)',marginBottom:'6px'}}>Slack Integration</h3>
          <p className="cred-desc">Get daily cost digests and budget alerts directly in your Slack channel.</p>
          <div className="tip-box tip-azure">
            <strong>💡 How to get a Slack Webhook URL:</strong><br/>
            1. Go to api.slack.com/apps → Create New App → From scratch<br/>
            2. Select your workspace → Incoming Webhooks → Activate<br/>
            3. Add New Webhook to Workspace → select channel → copy the URL<br/>
            4. Paste the URL below (starts with https://hooks.slack.com/...)
          </div>
          {tenant?.slack_webhook_url && (
            <div style={{background:'rgba(16,185,129,.08)',border:'1px solid rgba(16,185,129,.25)',borderRadius:'9px',padding:'12px 16px',marginBottom:'16px',fontSize:'13px',color:'var(--green)',display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:'8px'}}>
              <span>✅ Slack connected — alerts will be sent to your channel</span>
              <button onClick={testSlack} style={{background:'transparent',border:'1px solid var(--green)',color:'var(--green)',borderRadius:'7px',padding:'5px 12px',cursor:'pointer',fontSize:'12px'}}>Send Test Message</button>
            </div>
          )}
          <Msg state={slackMsg}/>
          <form onSubmit={saveSlack} className="cred-form">
            <FormGroup label="Slack Webhook URL">
              <input type="url" placeholder="https://hooks.slack.com/services/T.../B.../..." value={slack.webhook_url} required onChange={e=>setSlack({webhook_url:e.target.value})}/>
            </FormGroup>
            <Btn disabled={slackBusy} style={{background:'#4A154B',color:'#fff'}}>{slackBusy?'Connecting...':'Connect Slack Channel'}</Btn>
          </form>
          <div style={{marginTop:'20px',background:'var(--card2)',border:'1px solid var(--border)',borderRadius:'10px',padding:'16px'}}>
            <div style={{fontSize:'12px',fontWeight:'600',color:'var(--t3)',textTransform:'uppercase',letterSpacing:'.5px',marginBottom:'10px'}}>What you get in Slack</div>
            {['Daily cost digest at 9am','Budget alert when threshold exceeded','Weekly savings summary'].map(f=>(
              <div key={f} style={{display:'flex',alignItems:'center',gap:'8px',fontSize:'13px',color:'var(--t2)',marginBottom:'7px'}}>
                <span style={{color:'var(--green)'}}>✓</span>{f}
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* ── ACCOUNT ── */}
      {tab === 'account' && (
        <Card>
          <h3 style={{fontFamily:'var(--mono)',fontSize:'15px',color:'var(--t1)',marginBottom:'16px'}}>Account Details</h3>
          <div className="account-grid">
            {[['Company',tenant?.name],['Plan',tenant?.plan?.toUpperCase()],['Name',user?.name],['Email',user?.email],['Role',user?.role],
              ['AWS',tenant?.aws_ok?'✅ Connected':'⚠️ Not configured'],
              ['GCP',tenant?.gcp_ok?'✅ Connected':'⚠️ Not configured'],
              ['Azure',tenant?.azure_ok?'✅ Connected':'⚠️ Not configured'],
            ].map(([k,v])=>(
              <div key={k} className="ag-row"><span className="ag-key">{k}</span><span className="ag-val">{v}</span></div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
