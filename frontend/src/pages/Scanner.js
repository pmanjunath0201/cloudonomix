import React, { useEffect, useState } from 'react';
import { apiScanAws, apiScanAzureVMs } from '../utils/api';
import { getTenant } from '../utils/auth';
import { PageHeader, Spinner, ErrorBox, NotConfigured, CopyBtn } from '../components/UI';
import './Scanner.css';

const STATUS_COLOR = {
  IDLE:'var(--orange)', HEALTHY:'var(--green)', STOPPED:'var(--orange)',
  UNATTACHED:'var(--red)', OVERLOADED:'var(--red)', UNKNOWN:'var(--t3)'
};

// ── AWS Resource Card ──────────────────────────────────────────────────────────
function AwsCard({ item, type }) {
  const [open, setOpen] = useState(false);
  const sc      = STATUS_COLOR[item.status || item.resource_status] || 'var(--t3)';
  const savings = item.potential_savings || 0;

  return (
    <div className={`rcard ${savings > 0 ? 'rcard--warn' : ''}`} style={savings > 0 ? { borderLeftColor: sc } : {}}>
      <div className="rcard-header" onClick={() => setOpen(!open)}>
        <div className="rcard-left">
          <span className="rcard-type-icon">{type==='ec2'?'🖥':type==='ebs'?'💾':type==='rds'?'🗄':'🪣'}</span>
          <div>
            <div className="rcard-name">{item.name || item.id}</div>
            <div className="rcard-id">{item.id} <CopyBtn text={item.id}/></div>
          </div>
        </div>
        <div className="rcard-right">
          <span className="rcard-status" style={{ color:sc, borderColor:sc+'40', background:sc+'12' }}>
            {item.status || item.resource_status || '—'}
          </span>
          {savings > 0 && <span className="rcard-savings">save ${savings}/mo</span>}
          <span className="rcard-toggle">{open ? '▲' : '▼'}</span>
        </div>
      </div>

      {open && (
        <div className="rcard-detail">
          <div className="rcard-grid">
            {type === 'ec2' && <>
              <div className="rd-item"><span>Type</span><strong>{item.type}</strong></div>
              <div className="rd-item"><span>State</span><strong style={{color:item.state==='running'?'var(--green)':'var(--orange)'}}>{item.state}</strong></div>
              <div className="rd-item"><span>Private IP</span><strong className="mono">{item.private_ip||'—'} {item.private_ip&&<CopyBtn text={item.private_ip}/>}</strong></div>
              <div className="rd-item"><span>Public IP</span><strong className="mono">{item.public_ip||'None'} {item.public_ip&&<CopyBtn text={item.public_ip}/>}</strong></div>
              <div className="rd-item"><span>Region / AZ</span><strong>{item.region}/{item.az}</strong></div>
              <div className="rd-item"><span>Avg CPU (7d)</span><strong style={{color:item.avg_cpu<5?'var(--orange)':item.avg_cpu>80?'var(--red)':'var(--green)'}}>{item.avg_cpu}%</strong></div>
              <div className="rd-item"><span>Monthly Cost</span><strong className="cost-val">${item.monthly_cost}</strong></div>
              <div className="rd-item"><span>Savings</span><strong className="savings-val">{savings>0?`$${savings}/mo`:'—'}</strong></div>
            </>}
            {type === 'ebs' && <>
              <div className="rd-item"><span>Size</span><strong>{item.size_gb} GB</strong></div>
              <div className="rd-item"><span>Type</span><strong>{item.type}</strong></div>
              <div className="rd-item"><span>State</span><strong>{item.state}</strong></div>
              <div className="rd-item"><span>Attached To</span><strong className="mono">{item.attached_to||'Not attached'} {item.attached_to&&<CopyBtn text={item.attached_to}/>}</strong></div>
              <div className="rd-item"><span>Monthly Cost</span><strong className="cost-val">${item.monthly_cost}</strong></div>
              <div className="rd-item"><span>Savings</span><strong className="savings-val">{savings>0?`$${savings}/mo`:'—'}</strong></div>
            </>}
            {type === 'rds' && <>
              <div className="rd-item"><span>Engine</span><strong>{item.engine}</strong></div>
              <div className="rd-item"><span>Class</span><strong>{item.class}</strong></div>
              <div className="rd-item"><span>Multi-AZ</span><strong style={{color:item.multi_az?'var(--green)':'var(--t3)'}}>{item.multi_az?'Yes':'No'}</strong></div>
              <div className="rd-item"><span>Storage</span><strong>{item.storage_gb} GB</strong></div>
              <div className="rd-item"><span>Endpoint</span><strong className="mono" style={{fontSize:'11px'}}>{item.endpoint} {item.endpoint&&<CopyBtn text={item.endpoint}/>}</strong></div>
              <div className="rd-item"><span>Avg CPU</span><strong style={{color:item.avg_cpu<10?'var(--orange)':'var(--green)'}}>{item.avg_cpu}%</strong></div>
              <div className="rd-item"><span>Monthly Cost</span><strong className="cost-val">${item.monthly_cost}</strong></div>
              <div className="rd-item"><span>Savings</span><strong className="savings-val">{savings>0?`$${savings}/mo`:'—'}</strong></div>
            </>}
            {type === 's3' && <>
              <div className="rd-item"><span>Region</span><strong>{item.region}</strong></div>
              <div className="rd-item"><span>Size</span><strong>{item.size_gb} GB</strong></div>
              <div className="rd-item"><span>Objects</span><strong>{item.object_count?.toLocaleString()}</strong></div>
              <div className="rd-item"><span>Monthly Cost</span><strong className="cost-val">${item.monthly_cost}</strong></div>
              <div className="rd-item"><span>Savings</span><strong className="savings-val">{savings>0?`$${savings}/mo`:'—'}</strong></div>
            </>}
          </div>
          {item.recommendation && item.status !== 'HEALTHY' && (
            <div className="rcard-rec">
              <span className="rec-bulb">💡</span>
              <div>
                <div className="rec-text">{item.recommendation}</div>
                {item.recommended_type && <div className="rec-action">→ Rightsize to <strong>{item.recommended_type}</strong> — save <strong>${savings}/mo</strong></div>}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Azure VM Card ─────────────────────────────────────────────────────────────
function AzureVmCard({ vm }) {
  const [open, setOpen] = useState(false);
  const sc      = STATUS_COLOR[vm.status] || 'var(--t3)';
  const savings = vm.potential_savings || 0;

  return (
    <div className={`rcard ${savings > 0 ? 'rcard--warn' : ''}`} style={savings > 0 ? { borderLeftColor: sc } : {}}>
      <div className="rcard-header" onClick={() => setOpen(!open)}>
        <div className="rcard-left">
          <span className="rcard-type-icon">🖥</span>
          <div>
            <div className="rcard-name">{vm.name}</div>
            <div className="rcard-id">{vm.size} · {vm.location}</div>
          </div>
        </div>
        <div className="rcard-right">
          <span className="rcard-status" style={{ color:sc, borderColor:sc+'40', background:sc+'12' }}>{vm.status}</span>
          {savings > 0 && <span className="rcard-savings">save ${savings}/mo</span>}
          <span className="rcard-toggle">{open ? '▲' : '▼'}</span>
        </div>
      </div>
      {open && (
        <div className="rcard-detail">
          <div className="rcard-grid">
            <div className="rd-item"><span>VM Size</span><strong>{vm.size}</strong></div>
            <div className="rd-item"><span>Location</span><strong>{vm.location}</strong></div>
            <div className="rd-item"><span>Resource Group</span><strong>{vm.resource_group}</strong></div>
            <div className="rd-item"><span>State</span><strong>{vm.state}</strong></div>
            <div className="rd-item"><span>Avg CPU (7d)</span>
              <strong style={{color:vm.avg_cpu>0&&vm.avg_cpu<5?'var(--orange)':vm.avg_cpu>80?'var(--red)':'var(--green)'}}>
                {vm.avg_cpu > 0 ? `${vm.avg_cpu}%` : 'No data'}
              </strong>
            </div>
            <div className="rd-item"><span>Monthly Cost</span><strong className="cost-val">${vm.monthly_cost}</strong></div>
            <div className="rd-item"><span>Savings</span><strong className="savings-val">{savings>0?`$${savings}/mo`:'—'}</strong></div>
          </div>
          {vm.status !== 'HEALTHY' && vm.recommendation && (
            <div className="rcard-rec">
              <span className="rec-bulb">💡</span>
              <div className="rec-text">{vm.recommendation}</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main Scanner Component ────────────────────────────────────────────────────
export default function Scanner() {
  const tenant = getTenant();
  const hasAws   = tenant?.aws_ok;
  const hasAzure = tenant?.azure_ok;
  const hasAny   = hasAws || hasAzure || tenant?.gcp_ok;

  // AWS state
  const [awsTab, setAwsTab]   = useState('ec2');
  const [awsData, setAwsData] = useState({});
  const [awsBusy, setAwsBusy] = useState(false);
  const [awsErr,  setAwsErr]  = useState('');

  // Azure state
  const [azureVms,  setAzureVms]  = useState(null);
  const [azureBusy, setAzureBusy] = useState(false);
  const [azureErr,  setAzureErr]  = useState('');

  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('ALL');

  // Default to the first available cloud
  const [activeCloud, setActiveCloud] = useState(hasAzure && !hasAws ? 'azure' : 'aws');

  const loadAws = async (type) => {
    setAwsBusy(true); setAwsErr('');
    try {
      const r = await apiScanAws(type);
      setAwsData(prev => ({ ...prev, [type]: r.data }));
    } catch(ex) { setAwsErr(ex.response?.data?.error || 'AWS scan failed'); }
    setAwsBusy(false);
  };

  const loadAzure = async () => {
    setAzureBusy(true); setAzureErr('');
    try {
      const r = await apiScanAzureVMs();
      setAzureVms(r.data);
    } catch(ex) { setAzureErr(ex.response?.data?.error || 'Azure scan failed'); }
    setAzureBusy(false);
  };

  useEffect(() => {
    if (activeCloud === 'aws' && hasAws) loadAws(awsTab);
    if (activeCloud === 'azure' && hasAzure && !azureVms) loadAzure();
  }, [activeCloud, awsTab]);

  if (!hasAny) return (
    <div className="scanner-page fade-in">
      <PageHeader title="⚡ Resource Scanner" subtitle="Deep scan of all cloud resources with names, IPs, and exact savings"/>
      <NotConfigured cloud="a cloud provider" onGoSettings={() => window.location.href = '/settings'}/>
    </div>
  );

  const AWS_TABS = [
    { key:'ec2', label:'EC2 Instances' },
    { key:'ebs', label:'EBS Volumes' },
    { key:'rds', label:'RDS Databases' },
    { key:'s3',  label:'S3 Buckets' },
  ];

  const currentAws = awsData[awsTab];
  const awsResources = (currentAws?.resources || []).filter(r => {
    const hay = JSON.stringify(r).toLowerCase();
    const matchSearch = !search || hay.includes(search.toLowerCase());
    const matchFilter = filter === 'ALL' || (r.status || r.resource_status) === filter;
    return matchSearch && matchFilter;
  });

  const azureResources = (azureVms?.resources || []).filter(r => {
    const hay = JSON.stringify(r).toLowerCase();
    return !search || hay.includes(search.toLowerCase());
  });

  return (
    <div className="scanner-page fade-in">
      <PageHeader title="⚡ Resource Scanner" subtitle="Real resource data — names, IPs, CPU usage, and exact savings per resource"/>

      {/* Cloud selector tabs */}
      <div style={{ display:'flex', gap:'10px', marginBottom:'20px', flexWrap:'wrap' }}>
        {hasAws && (
          <button onClick={() => setActiveCloud('aws')}
            style={{ padding:'9px 20px', borderRadius:'10px', border:`2px solid ${activeCloud==='aws'?'var(--aws)':'var(--border)'}`, background: activeCloud==='aws'?'rgba(255,153,0,.1)':'var(--card)', color: activeCloud==='aws'?'var(--aws)':'var(--t2)', cursor:'pointer', fontWeight:'600', fontSize:'13px', transition:'all .2s' }}>
            ☁️ AWS
          </button>
        )}
        {hasAzure && (
          <button onClick={() => setActiveCloud('azure')}
            style={{ padding:'9px 20px', borderRadius:'10px', border:`2px solid ${activeCloud==='azure'?'var(--azure)':'var(--border)'}`, background: activeCloud==='azure'?'rgba(0,120,212,.1)':'var(--card)', color: activeCloud==='azure'?'var(--azure)':'var(--t2)', cursor:'pointer', fontWeight:'600', fontSize:'13px', transition:'all .2s' }}>
            🔷 Azure
          </button>
        )}
        {tenant?.gcp_ok && (
          <button onClick={() => setActiveCloud('gcp')}
            style={{ padding:'9px 20px', borderRadius:'10px', border:`2px solid ${activeCloud==='gcp'?'var(--gcp)':'var(--border)'}`, background: activeCloud==='gcp'?'rgba(66,133,244,.1)':'var(--card)', color: activeCloud==='gcp'?'var(--gcp)':'var(--t2)', cursor:'pointer', fontWeight:'600', fontSize:'13px', transition:'all .2s' }}>
            🔵 GCP
          </button>
        )}
        {!hasAws && <div style={{ fontSize:'13px', color:'var(--t3)', padding:'9px 0', alignSelf:'center' }}>Connect AWS in Settings to scan EC2, RDS, S3, EBS resources</div>}
      </div>

      {/* AWS Scanner */}
      {activeCloud === 'aws' && hasAws && (
        <>
          {currentAws && (
            <div className="scan-summary">
              <div className="ss-item"><span className="ss-val">{currentAws.summary?.total||0}</span><span className="ss-lbl">Total</span></div>
              <div className="ss-item warn"><span className="ss-val">{currentAws.summary?.idle||currentAws.summary?.unattached||0}</span><span className="ss-lbl">Wasteful</span></div>
              <div className="ss-item"><span className="ss-val">${(currentAws.summary?.total_cost||0).toLocaleString()}</span><span className="ss-lbl">Monthly Spend</span></div>
              <div className="ss-item green"><span className="ss-val">${(currentAws.summary?.total_savings||0).toLocaleString()}</span><span className="ss-lbl">Recoverable</span></div>
            </div>
          )}
          <div className="scan-toolbar">
            <input className="scan-search" placeholder="🔍 Search by name, IP, ID..." value={search} onChange={e=>setSearch(e.target.value)}/>
            <div className="scan-filters">
              {['ALL','IDLE','HEALTHY','STOPPED','UNATTACHED'].map(f=>(
                <button key={f} className={`sf-btn ${filter===f?'sf-active':''}`} onClick={()=>setFilter(f)}>{f}</button>
              ))}
            </div>
          </div>
          <div className="scan-tabs">
            {AWS_TABS.map(t=>(
              <button key={t.key} className={`scan-tab ${awsTab===t.key?'scan-tab--active':''}`} onClick={()=>setAwsTab(t.key)}>
                {t.label} {awsData[t.key]?`(${awsData[t.key].resources?.length||0})`:''}</button>
            ))}
          </div>
          {awsBusy && <Spinner text={`Scanning AWS ${awsTab.toUpperCase()}...`}/>}
          {awsErr  && <ErrorBox msg={awsErr} onRetry={()=>loadAws(awsTab)}/>}
          {!awsBusy && !awsErr && currentAws && (
            <div className="rcard-list">
              {awsResources.length === 0
                ? <div className="scan-empty">No resources match your filter.</div>
                : awsResources.map((r,i) => <AwsCard key={i} item={r} type={awsTab}/>)
              }
            </div>
          )}
        </>
      )}

      {/* Azure Scanner */}
      {activeCloud === 'azure' && hasAzure && (
        <>
          {azureVms?.summary && (
            <div className="scan-summary">
              <div className="ss-item"><span className="ss-val">{azureVms.summary.total||0}</span><span className="ss-lbl">VMs Total</span></div>
              <div className="ss-item warn"><span className="ss-val">{azureVms.summary.idle||0}</span><span className="ss-lbl">Idle VMs</span></div>
              <div className="ss-item green"><span className="ss-val">${(azureVms.summary.total_savings||0).toLocaleString()}</span><span className="ss-lbl">Recoverable</span></div>
            </div>
          )}
          <div className="scan-toolbar">
            <input className="scan-search" placeholder="🔍 Search by name, size, location..." value={search} onChange={e=>setSearch(e.target.value)}/>
          </div>
          {azureBusy && <Spinner text="Scanning Azure Virtual Machines..."/>}
          {azureErr  && <ErrorBox msg={azureErr} onRetry={loadAzure}/>}
          {!azureBusy && !azureErr && azureVms && (
            <div className="rcard-list">
              {azureResources.length === 0
                ? <div className="scan-empty">No Azure VMs found or none match search.</div>
                : azureResources.map((vm,i) => <AzureVmCard key={i} vm={vm}/>)
              }
            </div>
          )}
          {!azureBusy && !azureErr && !azureVms && (
            <div style={{ textAlign:'center', padding:'40px', background:'var(--card)', border:'1px solid var(--border)', borderRadius:'12px' }}>
              <button onClick={loadAzure} style={{ padding:'12px 24px', background:'var(--azure)', color:'#fff', border:'none', borderRadius:'9px', cursor:'pointer', fontWeight:'700', fontSize:'14px' }}>
                🔍 Start Azure VM Scan
              </button>
              <p style={{ fontSize:'12px', color:'var(--t3)', marginTop:'10px' }}>
                Note: First scan may take 30–60 seconds to fetch CPU metrics from Azure Monitor.
              </p>
            </div>
          )}
        </>
      )}

      {activeCloud === 'gcp' && (
        <div style={{ textAlign:'center', padding:'48px', background:'var(--card)', border:'1px solid var(--border)', borderRadius:'12px' }}>
          <div style={{ fontSize:'32px', marginBottom:'12px' }}>🔵</div>
          <div style={{ fontFamily:'var(--mono)', fontSize:'16px', color:'var(--t1)', marginBottom:'8px' }}>GCP Resource Scanning</div>
          <div style={{ fontSize:'13px', color:'var(--t2)' }}>
            GCP Compute Engine scanning requires BigQuery billing export to be enabled.<br/>
            Cost breakdown is available in Cost Explorer. VM-level scan coming in the next update.
          </div>
        </div>
      )}
    </div>
  );
}
// Note: UpgradePrompt is shown via the NotConfigured component when plan check fails
// Backend returns upgrade_required:true which triggers the prompt
