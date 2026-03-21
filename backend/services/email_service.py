"""
Email service using Gmail SMTP.
Sends verification, welcome, alert emails.
"""
import smtplib, os
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from itsdangerous import URLSafeTimedSerializer, SignatureExpired, BadSignature

SECRET    = os.getenv('SECRET_KEY', 'dev-secret')
GMAIL     = os.getenv('MAIL_EMAIL', '')
GMAIL_PWD = os.getenv('MAIL_PASSWORD', '')
APP_URL   = os.getenv('APP_URL', 'http://localhost:3000')

def _serializer():
    return URLSafeTimedSerializer(SECRET)

def generate_verification_token(email):
    return _serializer().dumps(email, salt='email-verify')

def verify_token(token, max_age=86400):  # 24 hours
    try:
        email = _serializer().loads(token, salt='email-verify', max_age=max_age)
        return email, None
    except SignatureExpired:
        return None, 'expired'
    except BadSignature:
        return None, 'invalid'

def _send(to_email, subject, html_body):
    """Send email via Gmail SMTP."""
    if not GMAIL or not GMAIL_PWD:
        print(f"[Email] MAIL_EMAIL or MAIL_PASSWORD not set — skipping send to {to_email}")
        print(f"[Email] Subject: {subject}")
        return True  # Don't crash in dev mode

    try:
        msg = MIMEMultipart('alternative')
        msg['Subject'] = subject
        msg['From']    = f"Cloudonomix <{GMAIL}>"
        msg['To']      = to_email
        msg.attach(MIMEText(html_body, 'html'))

        with smtplib.SMTP_SSL('smtp.gmail.com', 465) as server:
            server.login(GMAIL, GMAIL_PWD)
            server.sendmail(GMAIL, to_email, msg.as_string())

        print(f"[Email] Sent '{subject}' to {to_email}")
        return True
    except Exception as e:
        print(f"[Email] Failed to send to {to_email}: {e}")
        return False

# ── Email Templates ────────────────────────────────────────────────────────────

def send_verification_email(to_email, name, token):
    verify_url = f"{APP_URL}/verify-email?token={token}"
    html = f"""
    <!DOCTYPE html>
    <html>
    <body style="margin:0;padding:0;background:#0a0e1a;font-family:Inter,sans-serif;">
      <div style="max-width:560px;margin:40px auto;background:#111827;border-radius:16px;overflow:hidden;border:1px solid #1e2d45;">
        <div style="background:linear-gradient(135deg,#0d1525,#0a0e1a);padding:32px;text-align:center;border-bottom:1px solid #1e2d45;">
          <h1 style="margin:0;font-size:24px;color:#00d4ff;font-family:monospace;">⬡ Cloudonomix</h1>
          <p style="margin:8px 0 0;color:#475569;font-size:13px;">Cloud Cost Intelligence</p>
        </div>
        <div style="padding:36px 32px;">
          <h2 style="color:#f1f5f9;font-size:20px;margin:0 0 12px;">Hi {name}, verify your email</h2>
          <p style="color:#94a3b8;font-size:14px;line-height:1.7;margin:0 0 28px;">
            Thanks for signing up! Click the button below to verify your email address and activate your Cloudonomix account.
          </p>
          <div style="text-align:center;margin:0 0 28px;">
            <a href="{verify_url}"
               style="display:inline-block;background:#00d4ff;color:#080c14;font-weight:700;
                      font-size:15px;padding:14px 36px;border-radius:10px;text-decoration:none;
                      font-family:monospace;letter-spacing:0.3px;">
              ✓ Verify Email Address
            </a>
          </div>
          <p style="color:#475569;font-size:12px;text-align:center;margin:0;">
            This link expires in <strong style="color:#94a3b8;">24 hours</strong>.<br/>
            If you didn't create this account, ignore this email.
          </p>
        </div>
        <div style="padding:20px 32px;border-top:1px solid #1e2d45;text-align:center;">
          <p style="margin:0;color:#334155;font-size:11px;">
            Cloudonomix · Manjunath Project and Softwares<br/>
            Or copy this link: <span style="color:#00d4ff;">{verify_url}</span>
          </p>
        </div>
      </div>
    </body>
    </html>
    """
    return _send(to_email, "Verify your Cloudonomix account", html)

def send_welcome_email(to_email, name, company):
    login_url = f"{APP_URL}/login"
    html = f"""
    <!DOCTYPE html>
    <html>
    <body style="margin:0;padding:0;background:#0a0e1a;font-family:Inter,sans-serif;">
      <div style="max-width:560px;margin:40px auto;background:#111827;border-radius:16px;overflow:hidden;border:1px solid #1e2d45;">
        <div style="background:linear-gradient(135deg,#0d1525,#0a0e1a);padding:32px;text-align:center;border-bottom:1px solid #1e2d45;">
          <h1 style="margin:0;font-size:24px;color:#00d4ff;font-family:monospace;">⬡ Cloudonomix</h1>
        </div>
        <div style="padding:36px 32px;">
          <h2 style="color:#f1f5f9;font-size:20px;margin:0 0 12px;">🎉 Welcome to Cloudonomix, {name}!</h2>
          <p style="color:#94a3b8;font-size:14px;line-height:1.7;margin:0 0 20px;">
            Your account for <strong style="color:#f1f5f9;">{company}</strong> is now active.
            Here's what to do next:
          </p>
          <div style="background:#161f30;border-radius:10px;padding:20px;margin:0 0 24px;">
            <div style="display:flex;align-items:flex-start;margin-bottom:14px;">
              <span style="color:#00d4ff;font-weight:700;margin-right:12px;font-family:monospace;">1</span>
              <div><strong style="color:#f1f5f9;">Connect your cloud account</strong><br/><span style="color:#64748b;font-size:13px;">Go to Settings → AWS / GCP / Azure → add credentials</span></div>
            </div>
            <div style="display:flex;align-items:flex-start;margin-bottom:14px;">
              <span style="color:#00d4ff;font-weight:700;margin-right:12px;font-family:monospace;">2</span>
              <div><strong style="color:#f1f5f9;">See your real cost data</strong><br/><span style="color:#64748b;font-size:13px;">Dashboard shows live spend across all connected clouds</span></div>
            </div>
            <div style="display:flex;align-items:flex-start;">
              <span style="color:#10b981;font-weight:700;margin-right:12px;font-family:monospace;">3</span>
              <div><strong style="color:#f1f5f9;">Find savings opportunities</strong><br/><span style="color:#64748b;font-size:13px;">Savings Center shows exact actions to reduce your bill</span></div>
            </div>
          </div>
          <div style="text-align:center;">
            <a href="{login_url}" style="display:inline-block;background:#10b981;color:#080c14;font-weight:700;font-size:14px;padding:13px 32px;border-radius:10px;text-decoration:none;font-family:monospace;">
              Go to Dashboard →
            </a>
          </div>
        </div>
        <div style="padding:20px 32px;border-top:1px solid #1e2d45;text-align:center;">
          <p style="margin:0;color:#334155;font-size:11px;">Cloudonomix · Manjunath Project and Softwares</p>
        </div>
      </div>
    </body>
    </html>
    """
    return _send(to_email, f"Welcome to Cloudonomix, {name}! 🎉", html)

def send_upgrade_prompt_email(to_email, name, current_plan, feature_blocked, next_plan, price_inr):
    settings_url = f"{APP_URL}/settings"
    html = f"""
    <!DOCTYPE html>
    <html>
    <body style="margin:0;padding:0;background:#0a0e1a;font-family:Inter,sans-serif;">
      <div style="max-width:560px;margin:40px auto;background:#111827;border-radius:16px;overflow:hidden;border:1px solid #1e2d45;">
        <div style="background:linear-gradient(135deg,#0d1525,#0a0e1a);padding:32px;text-align:center;border-bottom:1px solid #1e2d45;">
          <h1 style="margin:0;font-size:24px;color:#00d4ff;font-family:monospace;">⬡ Cloudonomix</h1>
        </div>
        <div style="padding:36px 32px;">
          <h2 style="color:#f59e0b;font-size:20px;margin:0 0 12px;">Upgrade to unlock {feature_blocked}</h2>
          <p style="color:#94a3b8;font-size:14px;line-height:1.7;margin:0 0 20px;">
            Hi {name}, you tried to access <strong style="color:#f1f5f9;">{feature_blocked}</strong>
            which is not available on your <strong style="color:#f1f5f9;">{current_plan.title()}</strong> plan.
          </p>
          <div style="background:#1a1a0e;border:1px solid #f59e0b40;border-radius:10px;padding:20px;margin:0 0 24px;text-align:center;">
            <div style="color:#f59e0b;font-family:monospace;font-size:13px;margin-bottom:6px;">UPGRADE TO</div>
            <div style="color:#f1f5f9;font-family:monospace;font-size:22px;font-weight:700;margin-bottom:4px;">{next_plan.title()} Plan</div>
            <div style="color:#10b981;font-family:monospace;font-size:18px;font-weight:700;">₹{price_inr:,}/month</div>
          </div>
          <p style="color:#94a3b8;font-size:13px;margin:0 0 24px;">
            To upgrade, contact us via WhatsApp or email and we'll activate your plan within 1 hour.
          </p>
          <div style="text-align:center;">
            <a href="https://wa.me/91XXXXXXXXXX?text=I want to upgrade my Cloudonomix plan to {next_plan}"
               style="display:inline-block;background:#25D366;color:#fff;font-weight:700;font-size:14px;padding:13px 28px;border-radius:10px;text-decoration:none;margin-right:10px;">
              WhatsApp Us
            </a>
          </div>
        </div>
      </div>
    </body>
    </html>
    """
    return _send(to_email, f"Unlock {feature_blocked} — Upgrade your Cloudonomix plan", html)

def send_budget_alert_email(to_email, alert_name, service, current_spend, threshold, currency='₹'):
    html = f"""
    <!DOCTYPE html>
    <html>
    <body style="margin:0;padding:0;background:#0a0e1a;font-family:Inter,sans-serif;">
      <div style="max-width:560px;margin:40px auto;background:#111827;border-radius:16px;overflow:hidden;border:1px solid #ef444440;">
        <div style="background:#1a0a0a;padding:32px;text-align:center;border-bottom:1px solid #ef444440;">
          <h1 style="margin:0;font-size:22px;color:#ef4444;font-family:monospace;">🚨 Budget Alert Triggered</h1>
          <p style="margin:6px 0 0;color:#475569;font-size:13px;">Cloudonomix · {alert_name}</p>
        </div>
        <div style="padding:36px 32px;">
          <div style="background:#1a0a0a;border:1px solid #ef444440;border-radius:10px;padding:24px;text-align:center;margin:0 0 24px;">
            <div style="color:#94a3b8;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px;">Current Spend</div>
            <div style="font-family:monospace;font-size:36px;font-weight:700;color:#ef4444;">{currency}{current_spend:,.2f}</div>
            <div style="color:#475569;font-size:13px;margin-top:8px;">exceeded threshold of <strong style="color:#f1f5f9;">{currency}{threshold:,.2f}</strong></div>
          </div>
          <p style="color:#94a3b8;font-size:14px;line-height:1.7;margin:0 0 20px;">
            <strong style="color:#f59e0b;">Service:</strong> {service}<br/>
            Your cloud spend has exceeded the budget you set. Log in to Cloudonomix to review and take action.
          </p>
          <div style="text-align:center;">
            <a href="{APP_URL}/savings" style="display:inline-block;background:#ef4444;color:#fff;font-weight:700;font-size:14px;padding:13px 28px;border-radius:10px;text-decoration:none;font-family:monospace;">
              View Savings Center →
            </a>
          </div>
        </div>
      </div>
    </body>
    </html>
    """
    return _send(to_email, f"🚨 Budget Alert: {alert_name} threshold exceeded", html)

def send_onboarding_day3(to_email, name, company, has_connected_cloud):
    """Day 3 onboarding email - nudge to connect cloud if not done."""
    import os
    app_url = os.getenv('APP_URL','http://localhost:3000')
    if has_connected_cloud:
        subject = f"Your Cloudonomix savings report is ready, {name}"
        html = f"""
        <div style="font-family:Inter,sans-serif;max-width:540px;margin:40px auto;
                    background:#111827;border-radius:16px;border:1px solid #1e2d45;overflow:hidden;">
          <div style="background:linear-gradient(135deg,#0d1525,#0a0e1a);padding:28px 32px;border-bottom:1px solid #1e2d45;">
            <h2 style="margin:0;font-family:monospace;color:#00d4ff;font-size:18px;">⬡ Cloudonomix</h2>
          </div>
          <div style="padding:32px;">
            <h3 style="color:#f1f5f9;font-size:18px;margin:0 0 12px;">Hi {name}, your savings analysis is ready</h3>
            <p style="color:#94a3b8;font-size:14px;line-height:1.7;margin:0 0 20px;">
              It's been 3 days since you connected <strong style="color:#f1f5f9;">{company}</strong>.
              Here's what Cloudonomix found so far:
            </p>
            <div style="background:#161f30;border-radius:10px;padding:18px;margin:0 0 22px;">
              <p style="color:#94a3b8;font-size:13px;margin:0 0 10px;">To see your full savings breakdown:</p>
              <a href="{app_url}/savings" style="display:inline-block;background:#10b981;color:#080c14;
                 font-weight:700;font-size:13px;padding:11px 22px;border-radius:9px;text-decoration:none;font-family:monospace;">
                View Savings Center →
              </a>
            </div>
          </div>
        </div>"""
    else:
        subject = f"{name}, your cloud account is not connected yet"
        html = f"""
        <div style="font-family:Inter,sans-serif;max-width:540px;margin:40px auto;
                    background:#111827;border-radius:16px;border:1px solid #1e2d45;overflow:hidden;">
          <div style="background:linear-gradient(135deg,#0d1525,#0a0e1a);padding:28px 32px;border-bottom:1px solid #1e2d45;">
            <h2 style="margin:0;font-family:monospace;color:#00d4ff;font-size:18px;">⬡ Cloudonomix</h2>
          </div>
          <div style="padding:32px;">
            <h3 style="color:#f1f5f9;font-size:18px;margin:0 0 12px;">Hi {name}, one quick step left</h3>
            <p style="color:#94a3b8;font-size:14px;line-height:1.7;margin:0 0 20px;">
              You signed up 3 days ago but haven't connected your cloud account yet.
              It takes only 5 minutes and you'll immediately see where your money is going.
            </p>
            <div style="background:#161f30;border-radius:10px;padding:18px;margin:0 0 22px;">
              {"<br/>".join([f"<p style='color:#94a3b8;font-size:13px;margin:0 0 8px;'>✦ {s}</p>" for s in ["Connect AWS, Azure, or GCP in Settings","See your real cloud cost breakdown","Get specific savings recommendations per service"]])}
            </div>
            <a href="{app_url}/settings" style="display:inline-block;background:#00d4ff;color:#080c14;
               font-weight:700;font-size:13px;padding:12px 24px;border-radius:9px;text-decoration:none;font-family:monospace;">
              Connect Cloud Account →
            </a>
          </div>
        </div>"""
    return _send(to_email, subject, html)

def send_onboarding_day7(to_email, name, company, total_spend, potential_savings, currency_sym='$'):
    """Day 7 onboarding email - show savings found."""
    import os
    app_url = os.getenv('APP_URL','http://localhost:3000')
    subject = f"We found {currency_sym}{potential_savings:,.0f}/mo in savings for {company}"
    html = f"""
    <div style="font-family:Inter,sans-serif;max-width:540px;margin:40px auto;
                background:#111827;border-radius:16px;border:1px solid #1e2d45;overflow:hidden;">
      <div style="background:linear-gradient(135deg,#0d1525,#0a0e1a);padding:28px 32px;border-bottom:1px solid #1e2d45;">
        <h2 style="margin:0;font-family:monospace;color:#00d4ff;font-size:18px;">⬡ Cloudonomix</h2>
      </div>
      <div style="padding:32px;">
        <h3 style="color:#f1f5f9;font-size:18px;margin:0 0 12px;">Your 7-day savings report, {name}</h3>
        <div style="background:linear-gradient(135deg,rgba(16,185,129,.12),rgba(0,212,255,.06));
             border:1px solid rgba(16,185,129,.3);border-radius:12px;padding:22px;margin:0 0 22px;text-align:center;">
          <p style="color:#94a3b8;font-size:12px;text-transform:uppercase;letter-spacing:.5px;margin:0 0 6px;">Potential Monthly Savings Found</p>
          <p style="font-family:monospace;font-size:36px;font-weight:700;color:#10b981;margin:0 0 4px;">
            {currency_sym}{potential_savings:,.0f}/mo
          </p>
          <p style="color:#475569;font-size:12px;margin:0;">from {currency_sym}{total_spend:,.0f}/mo total spend — {round((potential_savings/total_spend*100) if total_spend else 0)}% reducible</p>
        </div>
        <p style="color:#94a3b8;font-size:14px;line-height:1.7;margin:0 0 20px;">
          Cloudonomix identified specific actions to reduce your cloud bill. Each recommendation has exact steps — no guesswork.
        </p>
        <a href="{app_url}/savings" style="display:inline-block;background:#10b981;color:#080c14;
           font-weight:700;font-size:14px;padding:13px 28px;border-radius:10px;text-decoration:none;font-family:monospace;">
          View All Savings Recommendations →
        </a>
      </div>
    </div>"""
    return _send(to_email, subject, html)
