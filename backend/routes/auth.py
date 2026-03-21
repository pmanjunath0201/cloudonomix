import re
from flask import Blueprint, request, jsonify, g
from database import db
from models import Tenant, User
from auth_utils import generate_token, require_auth
from datetime import datetime
from app import limiter

auth_bp = Blueprint('auth', __name__)

def _slugify(s):
    return re.sub(r'[^a-z0-9]+', '-', s.lower()).strip('-')

def _td(t):
    return {
        'id': t.id, 'name': t.name, 'slug': t.slug, 'plan': t.plan,
        'aws_ok': t.aws_ok, 'gcp_ok': t.gcp_ok, 'azure_ok': t.azure_ok,
        'aws_region': t.aws_region
    }

# ── Register ───────────────────────────────────────────────────────────────────
@auth_bp.route('/register', methods=['POST'])
@limiter.limit('10 per hour')
def register():
    d = request.get_json() or {}
    for k in ('company_name', 'email', 'password', 'name'):
        if not d.get(k):
            return jsonify({'error': f'{k} is required'}), 400
    if len(d['password']) < 6:
        return jsonify({'error': 'Password must be at least 6 characters'}), 400

    slug = _slugify(d['company_name'])
    base, n = slug, 1
    while Tenant.query.filter_by(slug=slug).first():
        slug = f"{base}-{n}"; n += 1

    tenant = Tenant(name=d['company_name'], slug=slug, plan='starter')
    db.session.add(tenant)
    db.session.flush()

    if User.query.filter_by(email=d['email']).first():
        return jsonify({'error': 'Email already registered'}), 409

    user = User(
        tenant_id=tenant.id, email=d['email'],
        name=d['name'], role='owner',
        is_verified=False
    )
    user.set_password(d['password'])
    db.session.add(user)
    db.session.commit()

    # Create 30-day trial for new tenant
    try:
        from services.trial_service import create_trial
        create_trial(tenant.id)
    except Exception as e:
        print(f"[Auth] Trial creation failed: {e}")

    # Send verification email
    try:
        from services.email_service import generate_verification_token, send_verification_email
        token = generate_verification_token(d['email'])
        send_verification_email(d['email'], d['name'], token)
    except Exception as e:
        print(f"[Auth] Email send failed: {e}")

    return jsonify({
        'message': 'Account created! Please check your email to verify your account.',
        'email': d['email'],
        'requires_verification': True
    }), 201

# ── Verify Email ───────────────────────────────────────────────────────────────
@auth_bp.route('/verify-email', methods=['POST'])
def verify_email():
    token = (request.get_json() or {}).get('token', '')
    if not token:
        return jsonify({'error': 'Token is required'}), 400

    from services.email_service import verify_token
    email, err = verify_token(token)

    if err == 'expired':
        return jsonify({'error': 'Verification link has expired. Please register again or request a new link.'}), 400
    if err == 'invalid':
        return jsonify({'error': 'Invalid verification link.'}), 400

    user = User.query.filter_by(email=email).first()
    if not user:
        return jsonify({'error': 'User not found.'}), 404
    if user.is_verified:
        return jsonify({'message': 'Email already verified. Please login.', 'already_verified': True})

    user.is_verified  = True
    user.verified_at  = datetime.utcnow()
    db.session.commit()

    # Send welcome email
    try:
        from services.email_service import send_welcome_email
        send_welcome_email(email, user.name, user.tenant.name)
    except Exception as e:
        print(f"[Auth] Welcome email failed: {e}")

    token = generate_token(user.id, user.tenant_id)
    return jsonify({
        'message': 'Email verified successfully! Welcome to Cloudonomix.',
        'token':   token,
        'user':    {'id': user.id, 'name': user.name, 'email': user.email, 'role': user.role},
        'tenant':  _td(user.tenant)
    })

# ── Resend Verification ────────────────────────────────────────────────────────
@auth_bp.route('/resend-verification', methods=['POST'])
def resend_verification():
    email = (request.get_json() or {}).get('email', '')
    user  = User.query.filter_by(email=email).first()
    if not user:
        return jsonify({'error': 'Email not found'}), 404
    if user.is_verified:
        return jsonify({'message': 'Already verified. Please login.'})
    try:
        from services.email_service import generate_verification_token, send_verification_email
        token = generate_verification_token(email)
        send_verification_email(email, user.name, token)
    except Exception as e:
        print(f"[Auth] Resend failed: {e}")
    return jsonify({'message': f'Verification email resent to {email}'})

# ── Login ──────────────────────────────────────────────────────────────────────
@auth_bp.route('/login', methods=['POST'])
@limiter.limit("10 per minute")
def login():
    d    = request.get_json() or {}
    user = User.query.filter_by(email=d.get('email', '')).first()

    if not user or not user.check_password(d.get('password', '')):
        return jsonify({'error': 'Invalid email or password'}), 401

    # Check email verified (skip for superadmin)
    if not user.is_verified and user.role != 'superadmin':
        return jsonify({
            'error': 'Please verify your email before logging in.',
            'requires_verification': True,
            'email': user.email
        }), 403

    if not user.tenant.active:
        return jsonify({'error': 'Account suspended. Contact support.'}), 403

    token = generate_token(user.id, user.tenant_id)
    return jsonify({
        'token':  token,
        'user':   {'id': user.id, 'name': user.name, 'email': user.email, 'role': user.role},
        'tenant': _td(user.tenant)
    })

# ── Me ─────────────────────────────────────────────────────────────────────────
@auth_bp.route('/me', methods=['GET'])
@require_auth
def me():
    return jsonify({
        'user':   {'id': g.user.id, 'name': g.user.name, 'email': g.user.email, 'role': g.user.role},
        'tenant': _td(g.tenant)
    })

# ── Plan Status ────────────────────────────────────────────────────────────────
@auth_bp.route('/plan-status', methods=['GET'])
@require_auth
def plan_status():
    from services.plan_limits import plan_status as get_plan_status
    status = get_plan_status(g.tenant)
    # Add alert count
    status['usage']['alerts'] = len(g.tenant.alerts)
    return jsonify(status)

# ── Save AWS Credentials (with plan limit check) ───────────────────────────────
@auth_bp.route('/credentials/aws', methods=['POST'])
@require_auth
def save_aws():
    if not g.user.can_manage:
        return jsonify({'error': 'Permission denied'}), 403

    from services.plan_limits import can_connect_cloud, count_connected_clouds, get_limits
    # Only check limit if AWS is NOT already connected (reconnecting is fine)
    if not g.tenant.aws_ok:
        if not can_connect_cloud(g.tenant):
            limits     = get_limits(g.tenant.plan)
            next_plans = {'starter': 'growth', 'growth': 'business'}
            next_plan  = next_plans.get(g.tenant.plan, 'business')
            return jsonify({
                'error': f'Your {g.tenant.plan.title()} plan allows only {limits["max_clouds"]} cloud connection(s). '
                         f'You already have {count_connected_clouds(g.tenant)} connected. '
                         f'Upgrade to {next_plan.title()} to connect more clouds.',
                'upgrade_required': True,
                'current_plan':     g.tenant.plan,
                'next_plan':        next_plan
            }), 403

    d = request.get_json() or {}
    if not d.get('aws_access_key') or not d.get('aws_secret_key'):
        return jsonify({'error': 'Access key and secret key required'}), 400

    try:
        import boto3
        sts = boto3.client('sts',
            aws_access_key_id=d['aws_access_key'],
            aws_secret_access_key=d['aws_secret_key'],
            region_name=d.get('aws_region', 'us-east-1'))
        identity   = sts.get_caller_identity()
        account_id = identity['Account']
    except Exception as e:
        return jsonify({'error': f'Invalid AWS credentials: {str(e)}'}), 400

    g.tenant.aws_access_key = d['aws_access_key']
    g.tenant.aws_secret_key = d['aws_secret_key']
    g.tenant.aws_region     = d.get('aws_region', 'us-east-1')
    db.session.commit()
    return jsonify({'message': f'AWS connected — Account: {account_id}', 'tenant': _td(g.tenant)})

# ── Save GCP Credentials (with plan limit check) ───────────────────────────────
@auth_bp.route('/credentials/gcp', methods=['POST'])
@require_auth
def save_gcp():
    if not g.user.can_manage:
        return jsonify({'error': 'Permission denied'}), 403

    from services.plan_limits import can_connect_cloud, count_connected_clouds, get_limits
    if not g.tenant.gcp_ok:
        if not can_connect_cloud(g.tenant):
            limits    = get_limits(g.tenant.plan)
            next_plan = {'starter': 'growth', 'growth': 'business'}.get(g.tenant.plan)
            return jsonify({
                'error': f'Your {g.tenant.plan.title()} plan allows {limits["max_clouds"]} cloud(s). '
                         f'Upgrade to {next_plan.title()} to connect more.',
                'upgrade_required': True,
                'current_plan': g.tenant.plan,
                'next_plan':    next_plan
            }), 403

    d = request.get_json() or {}
    if not d.get('gcp_project_id') or not d.get('gcp_service_account'):
        return jsonify({'error': 'Project ID and service account JSON required'}), 400

    try:
        import json
        from google.oauth2 import service_account
        info  = json.loads(d['gcp_service_account'])
        service_account.Credentials.from_service_account_info(
            info, scopes=['https://www.googleapis.com/auth/cloud-platform'])
    except Exception as e:
        return jsonify({'error': f'Invalid GCP service account: {str(e)}'}), 400

    g.tenant.gcp_project_id      = d['gcp_project_id']
    g.tenant.gcp_service_account = d['gcp_service_account']
    db.session.commit()
    return jsonify({'message': 'GCP credentials saved and validated', 'tenant': _td(g.tenant)})

# ── Save Azure Credentials (with plan limit check) ─────────────────────────────
@auth_bp.route('/credentials/azure', methods=['POST'])
@require_auth
def save_azure():
    if not g.user.can_manage:
        return jsonify({'error': 'Permission denied'}), 403

    from services.plan_limits import can_connect_cloud, get_limits
    if not g.tenant.azure_ok:
        if not can_connect_cloud(g.tenant):
            limits    = get_limits(g.tenant.plan)
            next_plan = {'starter': 'growth', 'growth': 'business'}.get(g.tenant.plan)
            return jsonify({
                'error': f'Your {g.tenant.plan.title()} plan allows {limits["max_clouds"]} cloud(s). '
                         f'Upgrade to {next_plan.title()} to connect more.',
                'upgrade_required': True,
                'current_plan': g.tenant.plan,
                'next_plan':    next_plan
            }), 403

    d = request.get_json() or {}
    for k in ('azure_subscription_id', 'azure_tenant_id', 'azure_client_id', 'azure_client_secret'):
        if not d.get(k):
            return jsonify({'error': f'{k} is required'}), 400

    try:
        from azure.identity import ClientSecretCredential
        from azure.mgmt.resource import SubscriptionClient
        cred   = ClientSecretCredential(d['azure_tenant_id'], d['azure_client_id'], d['azure_client_secret'])
        client = SubscriptionClient(cred)
        subs   = list(client.subscriptions.list())
        if not any(s.subscription_id == d['azure_subscription_id'] for s in subs):
            return jsonify({'error': 'Subscription ID not found for these credentials'}), 400
    except Exception as e:
        return jsonify({'error': f'Invalid Azure credentials: {str(e)}'}), 400

    g.tenant.azure_subscription_id = d['azure_subscription_id']
    g.tenant.azure_tenant_id       = d['azure_tenant_id']
    g.tenant.azure_client_id       = d['azure_client_id']
    g.tenant.azure_client_secret   = d['azure_client_secret']
    db.session.commit()
    return jsonify({'message': f'Azure connected', 'tenant': _td(g.tenant)})

# ── Revoke Cloud ───────────────────────────────────────────────────────────────
@auth_bp.route('/credentials/revoke/<cloud>', methods=['DELETE'])
@require_auth
def revoke(cloud):
    if not g.user.can_manage:
        return jsonify({'error': 'Permission denied'}), 403
    if cloud == 'aws':
        g.tenant.aws_access_key = None; g.tenant.aws_secret_key = None
    elif cloud == 'gcp':
        g.tenant.gcp_project_id = None; g.tenant.gcp_service_account = None
    elif cloud == 'azure':
        g.tenant.azure_subscription_id = None; g.tenant.azure_tenant_id = None
        g.tenant.azure_client_id = None; g.tenant.azure_client_secret = None
    else:
        return jsonify({'error': 'Unknown cloud'}), 400
    db.session.commit()
    # Clear cache for this tenant
    try:
        from services.cache import clear_tenant
        clear_tenant(g.tenant.id)
    except: pass
    return jsonify({'message': f'{cloud.upper()} disconnected', 'tenant': _td(g.tenant)})

# ── Invite Team Member (with plan limit check) ─────────────────────────────────
@auth_bp.route('/invite', methods=['POST'])
@require_auth
def invite():
    if not g.user.can_manage:
        return jsonify({'error': 'Permission denied'}), 403

    from services.plan_limits import can_add_user, get_limits
    if not can_add_user(g.tenant):
        limits    = get_limits(g.tenant.plan)
        next_plan = {'starter': 'growth', 'growth': 'business'}.get(g.tenant.plan)
        return jsonify({
            'error': f'Your {g.tenant.plan.title()} plan allows max {limits["max_users"]} team members. '
                     f'Upgrade to {next_plan.title()} to add more.',
            'upgrade_required': True,
            'current_plan': g.tenant.plan,
            'next_plan':    next_plan
        }), 403

    d = request.get_json() or {}
    if User.query.filter_by(tenant_id=g.tenant.id, email=d.get('email', '')).first():
        return jsonify({'error': 'User already exists'}), 409

    user = User(
        tenant_id=g.tenant.id, email=d['email'],
        name=d.get('name', ''), role='member',
        is_verified=True  # invited members are pre-verified by owner
    )
    user.set_password(d.get('password', 'changeme123'))
    db.session.add(user)
    db.session.commit()
    return jsonify({'message': f"{d['email']} added as team member"}), 201

# ── Forgot Password ────────────────────────────────────────────────────────────
@auth_bp.route('/forgot-password', methods=['POST'])
@limiter.limit('5 per minute')
def forgot_password():
    email = (request.get_json() or {}).get('email', '')
    user  = User.query.filter_by(email=email).first()
    # Always return success to prevent email enumeration
    if user:
        try:
            from services.email_service import generate_verification_token, _send
            import os
            token    = generate_verification_token(f"reset:{email}")
            app_url  = os.getenv('APP_URL', 'http://localhost:3000')
            reset_url= f"{app_url}/reset-password?token={token}"
            html = f"""
            <div style="font-family:Inter,sans-serif;max-width:520px;margin:40px auto;
                        background:#111827;border-radius:16px;padding:36px;border:1px solid #1e2d45;">
              <h2 style="color:#00d4ff;font-family:monospace;margin:0 0 8px;">⬡ Cloudonomix</h2>
              <h3 style="color:#f1f5f9;margin:0 0 16px;">Reset your password</h3>
              <p style="color:#94a3b8;font-size:14px;line-height:1.6;margin:0 0 24px;">
                Click the button below to reset your password. This link expires in 1 hour.
              </p>
              <a href="{reset_url}"
                 style="display:inline-block;background:#00d4ff;color:#080c14;font-weight:700;
                        font-size:14px;padding:13px 28px;border-radius:9px;text-decoration:none;
                        font-family:monospace;">
                Reset Password
              </a>
              <p style="color:#475569;font-size:12px;margin-top:20px;">
                If you didn't request this, ignore this email. Your password won't change.
              </p>
            </div>
            """
            _send(email, "Reset your Cloudonomix password", html)
        except Exception as e:
            print(f"[Auth] Password reset email failed: {e}")
    return jsonify({'message': f'If {email} is registered, a reset link has been sent.'})

@auth_bp.route('/reset-password', methods=['POST'])
def reset_password():
    d     = request.get_json() or {}
    token = d.get('token', '')
    new_pw= d.get('password', '')
    if len(new_pw) < 6:
        return jsonify({'error': 'Password must be at least 6 characters'}), 400

    from services.email_service import verify_token
    raw, err = verify_token(token, max_age=3600)  # 1 hour for password reset
    if err == 'expired':
        return jsonify({'error': 'Reset link has expired. Please request a new one.'}), 400
    if err == 'invalid' or not raw or not raw.startswith('reset:'):
        return jsonify({'error': 'Invalid reset link.'}), 400

    email = raw.replace('reset:', '')
    user  = User.query.filter_by(email=email).first()
    if not user:
        return jsonify({'error': 'User not found.'}), 404

    user.set_password(new_pw)
    db.session.commit()
    return jsonify({'message': 'Password reset successfully. You can now login.'})

# ── Slack Webhook ──────────────────────────────────────────────────────────────
@auth_bp.route('/credentials/slack', methods=['POST'])
@require_auth
def save_slack():
    if not g.user.can_manage:
        return jsonify({'error': 'Permission denied'}), 403
    d = request.get_json() or {}
    webhook = d.get('webhook_url', '').strip()
    if not webhook.startswith('https://hooks.slack.com/'):
        return jsonify({'error': 'Invalid Slack webhook URL. Must start with https://hooks.slack.com/'}), 400
    # Test the webhook
    try:
        import requests as req
        r = req.post(webhook, json={'text': '✅ Cloudonomix connected successfully!'}, timeout=5)
        if r.status_code != 200:
            return jsonify({'error': f'Webhook test failed: {r.text}'}), 400
    except Exception as e:
        return jsonify({'error': f'Could not reach webhook: {str(e)}'}), 400
    g.tenant.slack_webhook_url = webhook
    db.session.commit()
    return jsonify({'message': 'Slack connected successfully! You will receive cost alerts in your channel.'})

@auth_bp.route('/test-slack', methods=['POST'])
@require_auth
def test_slack():
    if not g.tenant.slack_webhook_url:
        return jsonify({'error': 'Slack not configured'}), 400
    try:
        from services.slack_service import send_daily_digest
        send_daily_digest(g.tenant.slack_webhook_url, g.tenant.name, 629.49, '$', 
                          [{'service':'Container Registry','cost':271},{'service':'Storage','cost':209}], 189.0)
        return jsonify({'message': 'Test message sent to Slack!'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500
