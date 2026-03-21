"""
Slack integration service — sends cost alerts and daily digests.
Clients set their Slack Webhook URL in Settings.
"""
import requests
import os

def send_slack_message(webhook_url: str, blocks: list) -> bool:
    """Send a message to Slack via webhook."""
    if not webhook_url:
        return False
    try:
        r = requests.post(webhook_url, json={'blocks': blocks}, timeout=10)
        return r.status_code == 200
    except Exception as e:
        print(f"[Slack] Send failed: {e}")
        return False

def send_budget_alert(webhook_url: str, alert_name: str, service: str,
                      current: float, threshold: float, currency: str = '$') -> bool:
    """Send a budget alert notification to Slack."""
    blocks = [
        {"type":"header","text":{"type":"plain_text","text":f"🚨 Budget Alert: {alert_name}"}},
        {"type":"section","fields":[
            {"type":"mrkdwn","text":f"*Service:*\n{service}"},
            {"type":"mrkdwn","text":f"*Current Spend:*\n{currency}{current:,.2f}"},
            {"type":"mrkdwn","text":f"*Threshold:*\n{currency}{threshold:,.2f}"},
            {"type":"mrkdwn","text":f"*Overage:*\n{currency}{current-threshold:,.2f}"},
        ]},
        {"type":"actions","elements":[{
            "type":"button","text":{"type":"plain_text","text":"View Savings Center"},
            "url": os.getenv('APP_URL','https://cloudonomix.in') + '/savings',
            "style":"danger"
        }]}
    ]
    return send_slack_message(webhook_url, blocks)

def send_daily_digest(webhook_url: str, tenant_name: str,
                      total: float, currency: str, top_services: list,
                      savings_available: float) -> bool:
    """Send daily cost digest to Slack."""
    sym = currency
    fields = [
        {"type":"mrkdwn","text":f"*Total Spend This Month:*\n{sym}{total:,.2f}"},
        {"type":"mrkdwn","text":f"*Recoverable Savings:*\n✅ {sym}{savings_available:,.2f}/mo"},
    ]
    svc_text = "\n".join([f"• {s['service']}: {sym}{s['cost']:,.2f}" for s in top_services[:3]])
    blocks = [
        {"type":"header","text":{"type":"plain_text","text":f"☁️ {tenant_name} — Daily Cloud Digest"}},
        {"type":"section","fields": fields},
        {"type":"section","text":{"type":"mrkdwn","text":f"*Top Services:*\n{svc_text}"}},
        {"type":"actions","elements":[{
            "type":"button","text":{"type":"plain_text","text":"View Dashboard"},
            "url": os.getenv('APP_URL','https://cloudonomix.in')
        }]}
    ]
    return send_slack_message(webhook_url, blocks)
