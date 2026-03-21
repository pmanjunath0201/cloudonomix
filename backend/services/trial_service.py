"""
Trial management service.
- Creates 30-day trial on registration
- Sends 7-day and 1-day warnings
- Expires trial and notifies client + admin
- Checked hourly via cron job
"""
from datetime import datetime, timedelta

def create_trial(tenant_id, trial_days=30):
    """Called when a new tenant registers."""
    from models import TrialConfig
    from database import db
    existing = TrialConfig.query.filter_by(tenant_id=tenant_id).first()
    if existing:
        return existing
    trial = TrialConfig(tenant_id=tenant_id, trial_days=trial_days)
    db.session.add(trial)
    db.session.commit()
    print(f"[Trial] Created {trial_days}-day trial for tenant {tenant_id}")
    return trial

def get_trial_status(tenant_id):
    """Get trial status for a tenant. Returns dict for frontend."""
    from models import TrialConfig, Tenant
    trial  = TrialConfig.query.filter_by(tenant_id=tenant_id).first()
    tenant = Tenant.query.get(tenant_id)

    # If on paid plan — no trial restrictions
    if tenant and tenant.plan != 'starter':
        return {'on_trial': False, 'plan': tenant.plan, 'is_paid': True}

    if not trial:
        # Starter plan with no trial record — create one
        trial = create_trial(tenant_id)

    return {
        'on_trial':       trial.is_active,
        'is_expired':     trial.is_expired,
        'days_remaining': trial.days_remaining,
        'trial_end':      trial.trial_end.isoformat(),
        'trial_start':    trial.trial_start.isoformat(),
        'plan':           tenant.plan if tenant else 'starter',
        'is_paid':        False,
    }

def check_all_trials(app):
    """
    Run hourly via cron — checks all starter plan tenants.
    Sends warnings at 7 days and 1 day remaining.
    Expires trial and restricts access after 30 days.
    """
    with app.app_context():
        from models import TrialConfig, Tenant, User
        from database import db

        now    = datetime.utcnow()
        trials = TrialConfig.query.filter_by(is_expired=False).all()
        expired_count  = 0
        warning_count  = 0

        for trial in trials:
            tenant = Tenant.query.get(trial.tenant_id)
            if not tenant:
                continue

            # Skip if client upgraded to paid plan
            if tenant.plan != 'starter':
                continue

            owner = next((u for u in tenant.users if u.role == 'owner'), None)
            if not owner:
                continue

            days_left = trial.days_remaining

            # ── 7-day warning ──────────────────────────────────────────────
            if days_left <= 7 and not trial.warning_sent_7:
                _send_warning_email(owner, tenant, days_left, '7-day')
                trial.warning_sent_7 = True
                warning_count += 1
                print(f"[Trial] 7-day warning sent to {tenant.name}")

            # ── 1-day warning ──────────────────────────────────────────────
            elif days_left <= 1 and not trial.warning_sent_1:
                _send_warning_email(owner, tenant, days_left, '1-day')
                trial.warning_sent_1 = True
                warning_count += 1
                print(f"[Trial] 1-day warning sent to {tenant.name}")

            # ── Trial expired ──────────────────────────────────────────────
            if now >= trial.trial_end and not trial.is_expired:
                trial.is_expired  = True
                trial.expired_at  = now
                expired_count    += 1
                print(f"[Trial] EXPIRED for {tenant.name}")

                # Send expiry email to client
                if not trial.expiry_sent:
                    _send_expiry_email(owner, tenant)
                    trial.expiry_sent = True

                # Notify admin
                _notify_admin_expiry(tenant)

        db.session.commit()
        print(f"[Trial] Check done — {expired_count} expired, {warning_count} warnings sent")
        return {'expired': expired_count, 'warnings': warning_count}

def _send_warning_email(owner, tenant, days_left, warning_type):
    try:
        import os
        from services.email_service import _send
        app_url = os.getenv('APP_URL', 'http://localhost:3000')
        wa_num  = os.getenv('WHATSAPP_NUMBER', '919XXXXXXXXX')
        wa_msg  = f"Hi, I want to upgrade Cloudonomix plan for {tenant.name}"
        urgency_color = '#ef4444' if days_left <= 1 else '#f59e0b'

        html = f"""
        <div style="font-family:Inter,sans-serif;max-width:540px;margin:40px auto;
                    background:#111827;border-radius:16px;border:1px solid #1e2d45;overflow:hidden;">
          <div style="background:linear-gradient(135deg,#1a0a00,#0a0e1a);padding:28px 32px;
                      border-bottom:1px solid {urgency_color}40;">
            <h2 style="margin:0;font-family:monospace;color:var(--cyan,#00d4ff);font-size:18px;">
              ⬡ Cloudonomix
            </h2>
            <p style="margin:6px 0 0;color:{urgency_color};font-size:13px;font-weight:700;">
              {'⚠️ Trial expires tomorrow!' if days_left <= 1 else f'⏰ {days_left} days left in your trial'}
            </p>
          </div>
          <div style="padding:32px;">
            <h3 style="color:#f1f5f9;font-size:18px;margin:0 0 12px;">
              Hi {owner.name}, your free trial {'expires tomorrow' if days_left <= 1 else f'ends in {days_left} days'}
            </h3>
            <p style="color:#94a3b8;font-size:14px;line-height:1.7;margin:0 0 20px;">
              Your 30-day free trial for <strong style="color:#f1f5f9;">{tenant.name}</strong> will expire on
              <strong style="color:{urgency_color};">{(datetime.utcnow() + timedelta(days=days_left)).strftime('%d %B %Y')}</strong>.
              After expiry, you will lose access to your cloud cost data and savings recommendations.
            </p>
            <div style="background:#161f30;border-radius:10px;padding:18px;margin-bottom:20px;">
              <p style="color:#94a3b8;font-size:13px;margin:0 0 12px;">To continue saving money on cloud costs, upgrade now:</p>
              <div style="display:flex;gap:12px;flex-wrap:wrap;">
                <div style="flex:1;min-width:140px;background:#0d1525;border:1px solid rgba(0,212,255,.2);border-radius:8px;padding:14px;text-align:center;">
                  <div style="font-family:monospace;font-size:12px;color:#00d4ff;font-weight:700;margin-bottom:4px;">STARTER</div>
                  <div style="font-family:monospace;font-size:20px;font-weight:700;color:#f1f5f9;">₹3,999<span style="font-size:12px;color:#475569;">/mo</span></div>
                </div>
                <div style="flex:1;min-width:140px;background:#0d1525;border:1px solid rgba(16,185,129,.3);border-radius:8px;padding:14px;text-align:center;">
                  <div style="font-family:monospace;font-size:12px;color:#10b981;font-weight:700;margin-bottom:4px;">GROWTH ⭐</div>
                  <div style="font-family:monospace;font-size:20px;font-weight:700;color:#f1f5f9;">₹9,999<span style="font-size:12px;color:#475569;">/mo</span></div>
                </div>
              </div>
            </div>
            <div style="text-align:center;">
              <a href="https://wa.me/{wa_num}?text={wa_msg}"
                 style="display:inline-block;background:#25D366;color:#fff;font-weight:700;
                        font-size:14px;padding:13px 28px;border-radius:10px;text-decoration:none;
                        font-family:monospace;">
                📱 Upgrade via WhatsApp
              </a>
            </div>
          </div>
          <div style="padding:16px 32px;border-top:1px solid #1e2d45;text-align:center;">
            <p style="margin:0;color:#334155;font-size:11px;">Cloudonomix · Manjunath Project and Softwares</p>
          </div>
        </div>
        """
        subject = (f"⚠️ Your Cloudonomix trial expires tomorrow — upgrade now"
                   if days_left <= 1
                   else f"⏰ {days_left} days left in your Cloudonomix trial")
        _send(owner.email, subject, html)
    except Exception as e:
        print(f"[Trial] Warning email failed: {e}")

def _send_expiry_email(owner, tenant):
    try:
        import os
        from services.email_service import _send
        wa_num = os.getenv('WHATSAPP_NUMBER', '919XXXXXXXXX')
        wa_msg = f"Hi, my Cloudonomix trial expired for {tenant.name}. I want to upgrade."
        html = f"""
        <div style="font-family:Inter,sans-serif;max-width:540px;margin:40px auto;
                    background:#111827;border-radius:16px;border:1px solid #ef444440;overflow:hidden;">
          <div style="background:#1a0505;padding:28px 32px;border-bottom:1px solid #ef444440;">
            <h2 style="margin:0;font-family:monospace;color:#00d4ff;">⬡ Cloudonomix</h2>
            <p style="margin:6px 0 0;color:#ef4444;font-weight:700;">🔒 Your free trial has ended</p>
          </div>
          <div style="padding:32px;">
            <h3 style="color:#f1f5f9;font-size:18px;margin:0 0 12px;">Hi {owner.name}, your trial has expired</h3>
            <p style="color:#94a3b8;font-size:14px;line-height:1.7;margin:0 0 24px;">
              Your 30-day free trial for <strong style="color:#f1f5f9;">{tenant.name}</strong> has ended.
              Your account is now in read-only mode. To continue accessing savings recommendations
              and real-time cloud cost data, please upgrade to a paid plan.
            </p>
            <div style="text-align:center;margin-bottom:16px;">
              <a href="https://wa.me/{wa_num}?text={wa_msg}"
                 style="display:inline-block;background:#25D366;color:#fff;font-weight:700;
                        font-size:15px;padding:14px 32px;border-radius:10px;text-decoration:none;
                        font-family:monospace;">
                📱 Upgrade Now via WhatsApp
              </a>
            </div>
            <p style="color:#475569;font-size:12px;text-align:center;">
              We activate upgrades within 1 hour · Pay via UPI or bank transfer
            </p>
          </div>
        </div>
        """
        _send(owner.email, "🔒 Your Cloudonomix trial has ended — upgrade to continue", html)
    except Exception as e:
        print(f"[Trial] Expiry email failed: {e}")

def _notify_admin_expiry(tenant):
    try:
        import os
        from services.email_service import _send
        admin_email = os.getenv('ADMIN_EMAIL', '')
        if admin_email:
            _send(admin_email,
                  f"[Cloudonomix] Trial expired: {tenant.name}",
                  f"<p>Trial expired for <b>{tenant.name}</b>. Follow up for conversion to paid plan.</p>")
    except: pass
