import React, { useEffect, useState } from 'react';
import { apiAllRecs } from '../utils/api';
import { getTenant } from '../utils/auth';
import { PageHeader, Spinner, ErrorBox, NotConfigured } from '../components/UI';
import './Recommendations.css';

const PRIORITY_COLOR = { HIGH:'#ef4444', MEDIUM:'#f59e0b', LOW:'#10b981' };
const CLOUD_COLOR    = { AWS:'#FF9900', Azure:'#0078D4', GCP:'#4285F4' };

function RecCard({ rec, onDismiss }) {
  const [open, setOpen] = useState(false);
  const pc = PRIORITY_COLOR[rec.priority] || '#94a3b8';
  const cc = CLOUD_COLOR[rec.cloud] || '#94a3b8';

  return (
    <div className="rec-card" style={{ borderLeftColor: pc }}>
      <div className="rec-card-header" onClick={() => setOpen(!open)}>
        <div className="rc-left">
          <div className="rc-badges">
            <span className="rc-priority" style={{ color: pc, borderColor: pc + '40', background: pc + '12' }}>{rec.priority}</span>
            <span className="rc-cloud" style={{ color: cc, borderColor: cc + '30', background: cc + '0d' }}>{rec.cloud}</span>
            {rec.category && <span className="rc-category">{rec.category}</span>}
            {rec.resource_id && <span className="rc-resource-id">🖥 {rec.resource_name || rec.resource_id}</span>}
          </div>
          <div className="rc-service">{rec.service}</div>
          <div className="rc-impact">{rec.impact}</div>
        </div>
        <div className="rc-right">
          <div className="rc-savings-block">
            <div className="rc-current">${rec.current_cost?.toLocaleString()}<span>/mo now</span></div>
            <div className="rc-arrow">→</div>
            <div className="rc-potential">
              <span className="rc-save-label">Save</span>
              <span className="rc-save-amt">${rec.estimated_savings?.toLocaleString()}/mo</span>
              <span className="rc-save-pct">({rec.savings_pct}%)</span>
            </div>
          </div>
          <span className="rc-toggle">{open ? '▲' : '▼'}</span>
        </div>
      </div>

      {open && (
        <div className="rec-card-detail">
          <div className="rc-detail-title">💡 Specific Actions to Take</div>
          <ol className="rc-actions-list">
            {rec.actions?.map((action, i) => (
              <li key={i} className="rc-action-item">
                <span className="rc-action-num">{i + 1}</span>
                <span>{action}</span>
              </li>
            ))}
          </ol>
          {rec.private_ip && (
            <div className="rc-resource-detail">
              <span className="rd-label">Private IP:</span>
              <code>{rec.private_ip}</code>
            </div>
          )}
          <div className="rc-card-footer">
            <button className="rc-dismiss" onClick={() => onDismiss(rec.id)}>Dismiss</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Recommendations() {
  const tenant  = getTenant();
  const [data,  setData]      = useState(null);
  const [busy,  setBusy]      = useState(true);
  const [err,   setErr]       = useState('');
  const [filter, setFilter]   = useState('ALL');
  const [cloud,  setCloud]    = useState('ALL');
  const [dismissed, setDismissed] = useState(new Set());

  const load = async () => {
    setBusy(true); setErr('');
    try { const r = await apiAllRecs(); setData(r.data); }
    catch(ex) { setErr(ex.response?.data?.error || 'Failed to load recommendations'); }
    setBusy(false);
  };

  useEffect(() => { load(); }, []);

  const hasAny = tenant?.aws_ok || tenant?.gcp_ok || tenant?.azure_ok;
  if (!hasAny) return (
    <div className="fade-in">
      <PageHeader title="💡 Savings Center" subtitle="Actionable cost optimization recommendations"/>
      <NotConfigured cloud="a cloud provider" onGoSettings={() => window.location.href = '/settings'}/>
    </div>
  );

  if (busy) return <Spinner text="Analyzing costs and generating recommendations..."/>;
  if (err)  return <ErrorBox msg={err} onRetry={load}/>;

  const allRecs = (data?.recommendations || []).filter(r => !dismissed.has(r.id));
  const filtered = allRecs.filter(r => {
    const pMatch = filter === 'ALL' || r.priority === filter;
    const cMatch = cloud === 'ALL' || r.cloud === cloud;
    return pMatch && cMatch;
  });
  const summary = data?.summary || {};

  return (
    <div className="recs-page fade-in">
      <PageHeader
        title="💡 Savings Center"
        subtitle="Specific, actionable steps to reduce your cloud costs — sorted by maximum savings impact"
      />

      {/* Big savings summary */}
      <div className="recs-hero">
        <div className="rh-main">
          <div className="rh-label">Total Recoverable Savings</div>
          <div className="rh-amount">${summary.total_savings?.toLocaleString() || '0'}<span>/month</span></div>
          <div className="rh-sub">From ${summary.total_spend?.toLocaleString() || '0'}/mo total spend — {summary.savings_pct || 0}% reducible</div>
        </div>
        <div className="rh-stats">
          <div className="rhs-item">
            <span className="rhs-val">{summary.total_count || 0}</span>
            <span className="rhs-lbl">Total Recommendations</span>
          </div>
          <div className="rhs-item rhs-high">
            <span className="rhs-val">{summary.high_priority || 0}</span>
            <span className="rhs-lbl">High Priority</span>
          </div>
          <div className="rhs-item rhs-med">
            <span className="rhs-val">{summary.medium_priority || 0}</span>
            <span className="rhs-lbl">Medium Priority</span>
          </div>
          <div className="rhs-item rhs-year">
            <span className="rhs-val">${((summary.total_savings || 0) * 12).toLocaleString()}</span>
            <span className="rhs-lbl">Annual Savings</span>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="recs-filters">
        <div className="rf-group">
          <span className="rf-label">Priority:</span>
          {['ALL','HIGH','MEDIUM','LOW'].map(p => (
            <button key={p} className={`rf-btn ${filter === p ? 'rf-active' : ''}`}
              style={filter === p && p !== 'ALL' ? { color: PRIORITY_COLOR[p], borderColor: PRIORITY_COLOR[p] + '60', background: PRIORITY_COLOR[p] + '12' } : {}}
              onClick={() => setFilter(p)}>{p}</button>
          ))}
        </div>
        <div className="rf-group">
          <span className="rf-label">Cloud:</span>
          {['ALL', ...(tenant?.aws_ok ? ['AWS'] : []), ...(tenant?.azure_ok ? ['Azure'] : []), ...(tenant?.gcp_ok ? ['GCP'] : [])].map(c => (
            <button key={c} className={`rf-btn ${cloud === c ? 'rf-active' : ''}`}
              style={cloud === c && c !== 'ALL' ? { color: CLOUD_COLOR[c], borderColor: CLOUD_COLOR[c] + '50', background: CLOUD_COLOR[c] + '0d' } : {}}
              onClick={() => setCloud(c)}>{c}</button>
          ))}
        </div>
        <span className="rf-count">{filtered.length} recommendations</span>
      </div>

      {/* Recommendations list */}
      <div className="recs-list">
        {filtered.length === 0 ? (
          <div className="recs-empty">
            {dismissed.size > 0 ? '✅ All recommendations dismissed for this filter.' : 'No recommendations match the selected filters.'}
          </div>
        ) : (
          filtered.map(rec => (
            <RecCard key={rec.id} rec={rec} onDismiss={id => setDismissed(p => new Set([...p, id]))}/>
          ))
        )}
      </div>

      {data?.errors?.length > 0 && (
        <div className="recs-errors">
          {data.errors.map((e, i) => (
            <div key={i} className="rec-err-item">⚠️ {e.cloud}: {e.error}</div>
          ))}
        </div>
      )}
    </div>
  );
}
