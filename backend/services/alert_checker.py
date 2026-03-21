"""
Cloudonomix Alert Checker — runs every hour via cron job.

What it does:
1. Loads ALL active tenants with connected clouds
2. Fetches their current month spend (uses cache to avoid API hammering)
3. Compares against each active alert threshold
4. Sends email if spend > threshold AND no email sent in last 24 hours
5. Logs every trigger to AlertLog table for audit trail

Called by:
- GET /api/cron/check-alerts (secured with CRON_SECRET)
- Render.com cron job: every hour
- GitHub Actions (backup): every 2 hours
"""

import os
from datetime import datetime, timedelta

def run_alert_check(app):
    """Main alert checker — call with Flask app context."""
    with app.app_context():
        from database import db
        from models import Tenant, Alert, AlertLog
        
        print(f"\n[AlertChecker] Starting check at {datetime.utcnow().isoformat()}")
        
        tenants = Tenant.query.filter_by(active=True).all()
        total_checked = 0
        total_triggered = 0
        total_errors = 0

        for tenant in tenants:
            # Skip admin tenant
            if tenant.slug == 'cloudonomix-admin':
                continue
            
            # Get current spend for this tenant across all clouds
            spend_data = _get_tenant_spend(tenant)
            
            if not spend_data:
                continue

            # Check each active alert for this tenant
            alerts = Alert.query.filter_by(tenant_id=tenant.id, active=True).all()
            
            for alert in alerts:
                total_checked += 1
                try:
                    result = _check_single_alert(alert, spend_data, tenant)
                    if result == 'triggered':
                        total_triggered += 1
                    elif result == 'error':
                        total_errors += 1
                except Exception as e:
                    total_errors += 1
                    print(f"[AlertChecker] Error on alert {alert.id}: {e}")

        db.session.commit()
        
        summary = (f"[AlertChecker] Done — "
                   f"checked {total_checked} alerts across {len(tenants)} tenants | "
                   f"triggered {total_triggered} | errors {total_errors}")
        print(summary)
        return {
            'checked': total_checked,
            'triggered': total_triggered,
            'errors': total_errors,
            'tenants': len(tenants),
            'timestamp': datetime.utcnow().isoformat()
        }

def _get_tenant_spend(tenant):
    """
    Get current month spend for tenant across all clouds.
    Returns dict: {'total': 629.49, 'by_cloud': {'Azure': 629.49, 'AWS': 0}, 
                   'by_service': {'Container Registry': 271.18, ...}, 'currency': 'INR'}
    """
    spend = {
        'total': 0.0,
        'by_cloud': {},
        'by_service': {},
        'currency': 'USD'
    }

    if tenant.aws_ok:
        try:
            from services.aws_service import get_cost_summary_cached
            data = get_cost_summary_cached(tenant)
            if data and data[-1]:
                curr     = data[-1]
                aws_total= curr['total']
                spend['total']              += aws_total
                spend['by_cloud']['AWS']     = aws_total
                for s in curr.get('services', []):
                    svc = s['service']
                    spend['by_service'][f"AWS:{svc}"] = s['cost']
        except Exception as e:
            print(f"[AlertChecker] AWS spend fetch failed for {tenant.name}: {e}")

    if tenant.azure_ok:
        try:
            from services.azure_service import get_cost_summary
            data = get_cost_summary(tenant)  # uses cache
            if data and data[-1]:
                curr        = data[-1]
                azure_total = curr['total']
                spend['total']               += azure_total
                spend['by_cloud']['Azure']    = azure_total
                spend['currency']             = curr.get('currency', 'USD')
                for s in curr.get('services', []):
                    svc = s['service']
                    spend['by_service'][f"Azure:{svc}"] = s['cost']
        except Exception as e:
            print(f"[AlertChecker] Azure spend fetch failed for {tenant.name}: {e}")

    if tenant.gcp_ok:
        try:
            from services.cache import get as cache_get, set as cache_set
            key  = f"t{tenant.id}:gcp:cost_summary"
            data = cache_get(key)
            if not data:
                from services.gcp_service import get_cost_summary
                data = get_cost_summary(tenant)
                cache_set(key, data, ttl_seconds=600)
            if data and data[-1]:
                curr      = data[-1]
                gcp_total = curr['total']
                spend['total']             += gcp_total
                spend['by_cloud']['GCP']    = gcp_total
                for s in curr.get('services', []):
                    svc = s['service']
                    spend['by_service'][f"GCP:{svc}"] = s['cost']
        except Exception as e:
            print(f"[AlertChecker] GCP spend fetch failed for {tenant.name}: {e}")

    return spend if spend['total'] > 0 else None

def _check_single_alert(alert, spend_data, tenant):
    """
    Check one alert against current spend.
    Returns: 'triggered' | 'skipped' | 'error'
    
    Skip rules:
    - Already triggered in last 24 hours (no spam)
    - Current spend <= threshold
    """
    from database import db
    from models import AlertLog

    # Determine which spend to compare
    if alert.cloud == 'ALL':
        current_spend = spend_data['total']
        cloud_label   = 'All Clouds'
    else:
        current_spend = spend_data['by_cloud'].get(alert.cloud, 0)
        cloud_label   = alert.cloud

    if alert.service != 'ALL':
        # Check specific service
        key           = f"{alert.cloud}:{alert.service}"
        current_spend = spend_data['by_service'].get(key, current_spend)

    # Check if threshold exceeded
    if current_spend <= alert.threshold:
        return 'skipped'

    # Check if already notified in last 24 hours — prevent email spam
    if alert.last_triggered:
        hours_since = (datetime.utcnow() - alert.last_triggered).total_seconds() / 3600
        if hours_since < 24:
            print(f"[AlertChecker] Alert '{alert.name}' already triggered {hours_since:.1f}h ago — skipping")
            return 'skipped'

    # TRIGGER THE ALERT
    currency = spend_data.get('currency', 'USD')
    sym      = '₹' if currency == 'INR' else '$'
    
    print(f"[AlertChecker] 🚨 ALERT TRIGGERED: '{alert.name}' for {tenant.name} — "
          f"{sym}{current_spend:.2f} > {sym}{alert.threshold:.2f}")

    # Send email
    email_status = 'sent'
    error_msg    = None
    try:
        from services.email_service import send_budget_alert_email
        send_budget_alert_email(
            to_email      = alert.email,
            alert_name    = alert.name,
            service       = f"{cloud_label} — {alert.service}" if alert.service != 'ALL' else cloud_label,
            current_spend = current_spend,
            threshold     = alert.threshold,
            currency      = sym
        )
    except Exception as e:
        email_status = 'failed'
        error_msg    = str(e)
        print(f"[AlertChecker] Email failed for alert {alert.id}: {e}")

    # Update alert record
    alert.last_triggered = datetime.utcnow()
    alert.last_spend     = current_spend
    alert.trigger_count  = (alert.trigger_count or 0) + 1

    # Log to AlertLog for audit trail
    log = AlertLog(
        alert_id     = alert.id,
        tenant_id    = tenant.id,
        tenant_name  = tenant.name,
        alert_name   = alert.name,
        service      = alert.service,
        cloud        = alert.cloud,
        threshold    = alert.threshold,
        actual_spend = current_spend,
        email_sent_to= alert.email,
        status       = email_status,
        error_msg    = error_msg
    )
    db.session.add(log)

    return 'triggered'
