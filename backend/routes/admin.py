from flask import Blueprint, jsonify, g, request
from auth_utils import require_superadmin
from database import db
from models import Tenant, User

admin_bp = Blueprint('admin', __name__)

PLAN_PRICE_USD = {'starter':49,  'growth':149,  'business':499}

def _audit(action, detail, admin_email='system'):
    """Log admin actions to console and optionally a log table."""
    from datetime import datetime
    print(f"[AUDIT] {datetime.utcnow().isoformat()} | {admin_email} | {action} | {detail}")
PLAN_PRICE_INR = {'starter':3999,'growth':9999,'business':29999}

def _td(t):
    return {
        'id':t.id,'name':t.name,'slug':t.slug,'plan':t.plan,'active':t.active,
        'aws_ok':t.aws_ok,'gcp_ok':t.gcp_ok,'azure_ok':t.azure_ok,
        'user_count':len(t.users),
        'owner': next((u.email for u in t.users if u.role=='owner'),'—'),
        'owner_verified': next((u.is_verified for u in t.users if u.role=='owner'), False),
        'users_verified': sum(1 for u in t.users if u.is_verified),
        'created_at':t.created_at.strftime('%Y-%m-%d')
    }

@admin_bp.route('/stats', methods=['GET'])
@require_superadmin
def stats():
    tenants     = Tenant.query.filter(Tenant.slug!='cloudonomix-admin').all()
    active      = [t for t in tenants if t.active]
    mrr_usd     = sum(PLAN_PRICE_USD.get(t.plan,0) for t in active)
    mrr_inr     = sum(PLAN_PRICE_INR.get(t.plan,0) for t in active)
    total_users = User.query.filter(User.role!='superadmin').count()
    verified    = User.query.filter(User.role!='superadmin', User.is_verified==True).count()

    return jsonify({
        'total_tenants':   len(tenants),
        'active_tenants':  len(active),
        'total_users':     total_users,
        'verified_users':  verified,
        'unverified_users':total_users - verified,
        'aws_connected':   sum(1 for t in tenants if t.aws_ok),
        'gcp_connected':   sum(1 for t in tenants if t.gcp_ok),
        'azure_connected': sum(1 for t in tenants if t.azure_ok),
        'mrr_usd':  mrr_usd,
        'mrr_inr':  mrr_inr,
        'arr_usd':  mrr_usd * 12,
        'arr_inr':  mrr_inr * 12,
        'plans': {p: sum(1 for t in tenants if t.plan==p) for p in ('starter','growth','business')}
    })

@admin_bp.route('/tenants', methods=['GET'])
@require_superadmin
def list_tenants():
    tenants = Tenant.query.filter(Tenant.slug!='cloudonomix-admin').order_by(Tenant.created_at.desc()).all()
    return jsonify({'data': [_td(t) for t in tenants]})

@admin_bp.route('/tenants/<int:tid>/plan', methods=['POST'])
@require_superadmin
def change_plan(tid):
    t = db.session.get(Tenant, tid)
    if not t: return jsonify({'error':'Not found'}), 404
    plan = (request.get_json() or {}).get('plan','')
    if plan not in ('starter','growth','business'):
        return jsonify({'error':'Invalid plan'}), 400
    old_plan = t.plan
    t.plan = plan
    db.session.commit()
    _audit('PLAN_CHANGE', f'Tenant {t.name} (id:{tid}) changed from {old_plan} to {plan}', g.user.email)
    # Notify tenant owner of plan change
    try:
        from services.email_service import _send
        owner = next((u for u in t.users if u.role=='owner'), None)
        if owner:
            _send(owner.email,
                  f"Your Cloudonomix plan has been updated to {plan.title()}",
                  f"""<div style="font-family:Inter,sans-serif;max-width:520px;margin:40px auto;
                       background:#111827;border-radius:16px;padding:36px;border:1px solid #1e2d45;">
                    <h2 style="color:#00d4ff;font-family:monospace;">⬡ Cloudonomix</h2>
                    <h3 style="color:#f1f5f9;">Plan Updated: {plan.title()}</h3>
                    <p style="color:#94a3b8;">Hi {owner.name}, your plan has been upgraded from
                    <b style="color:#f1f5f9;">{old_plan.title()}</b> to
                    <b style="color:#10b981;">{plan.title()}</b>.
                    All new features are now active in your account.</p>
                    <p style="color:#94a3b8;">Login to Cloudonomix to explore your new features.</p>
                  </div>""")
    except: pass
    return jsonify({'message': f'Plan changed to {plan}'})

@admin_bp.route('/tenants/<int:tid>/toggle', methods=['POST'])
@require_superadmin
def toggle_tenant(tid):
    t = db.session.get(Tenant, tid)
    if not t: return jsonify({'error':'Not found'}), 404
    t.active = not t.active
    db.session.commit()
    _audit('TENANT_TOGGLE', f'Tenant {t.name} (id:{tid}) active={t.active}', g.user.email)
    return jsonify({'active': t.active})

@admin_bp.route('/tenants/<int:tid>', methods=['DELETE'])
@require_superadmin
def delete_tenant(tid):
    t = db.session.get(Tenant, tid)
    if not t: return jsonify({'error':'Not found'}), 404
    name_backup = t.name
    db.session.delete(t)
    db.session.commit()
    _audit('TENANT_DELETE', f'Deleted tenant {name_backup} (id:{tid})', g.user.email)
    return jsonify({'message': 'Deleted'})

@admin_bp.route('/users', methods=['GET'])
@require_superadmin
def list_users():
    users = User.query.filter(User.role!='superadmin').order_by(User.created_at.desc()).all()
    return jsonify({'data': [{
        'id':u.id,'name':u.name,'email':u.email,'role':u.role,
        'tenant':u.tenant.name,'is_verified':u.is_verified,
        'created_at':u.created_at.strftime('%Y-%m-%d')
    } for u in users]})

@admin_bp.route('/resend-verification/<int:uid>', methods=['POST'])
@require_superadmin
def resend_verification(uid):
    """Admin can resend verification email to any user."""
    user = db.session.get(User, uid)
    if not user: return jsonify({'error':'Not found'}), 404
    if user.is_verified: return jsonify({'message':'Already verified'})
    try:
        from services.email_service import generate_verification_token, send_verification_email
        token = generate_verification_token(user.email)
        send_verification_email(user.email, user.name, token)
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    return jsonify({'message': f'Verification email sent to {user.email}'})
