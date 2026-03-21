from flask import Blueprint, jsonify, g, request
from auth_utils import require_auth
from database import db
from models import Alert

alerts_bp = Blueprint('alerts', __name__)

@alerts_bp.route('/', methods=['GET'])
@require_auth
def list_alerts():
    from services.plan_limits import get_limits
    limits = get_limits(g.tenant.plan)
    alerts = Alert.query.filter_by(tenant_id=g.tenant.id).all()
    return jsonify({
        'data': [{
            'id':a.id,'name':a.name,'threshold':a.threshold,
            'email':a.email,'service':a.service,'cloud':a.cloud,
            'active':a.active,
            'last_triggered': a.last_triggered.isoformat() if a.last_triggered else None,
            'last_spend':     a.last_spend,
            'trigger_count':  a.trigger_count or 0,
        } for a in alerts],
        'usage':  {'current':len(alerts),'max':limits['max_alerts']},
        'can_add': len(alerts) < limits['max_alerts'],
        'plan':    g.tenant.plan,
    })

@alerts_bp.route('/', methods=['POST'])
@require_auth
def create_alert():
    from services.plan_limits import can_add_alert, get_limits, NEXT_PLAN, PLANS
    if not can_add_alert(g.tenant):
        limits    = get_limits(g.tenant.plan)
        next_plan = NEXT_PLAN.get(g.tenant.plan)
        np        = PLANS.get(next_plan, {})
        return jsonify({
            'error': f'Your {g.tenant.plan.title()} plan allows max {limits["max_alerts"]} alerts. '
                     f'Upgrade to {next_plan.title()} to add more.',
            'upgrade_required': True,
            'current_plan': g.tenant.plan,
            'next_plan':    next_plan,
            'next_plan_price_inr': np.get('price_inr'),
        }), 403

    d = request.get_json() or {}
    if not d.get('name') or not d.get('threshold') or not d.get('email'):
        return jsonify({'error':'name, threshold, email required'}), 400

    a = Alert(
        tenant_id=g.tenant.id, name=d['name'],
        threshold=float(d['threshold']), email=d['email'],
        service=d.get('service','ALL'), cloud=d.get('cloud','ALL')
    )
    db.session.add(a); db.session.commit()
    return jsonify({'message':'Alert created','id':a.id}), 201

@alerts_bp.route('/<int:aid>', methods=['DELETE'])
@require_auth
def delete_alert(aid):
    a = Alert.query.filter_by(id=aid, tenant_id=g.tenant.id).first_or_404()
    db.session.delete(a); db.session.commit()
    return jsonify({'message':'Alert deleted'})

@alerts_bp.route('/<int:aid>/toggle', methods=['POST'])
@require_auth
def toggle_alert(aid):
    a = Alert.query.filter_by(id=aid, tenant_id=g.tenant.id).first_or_404()
    a.active = not a.active; db.session.commit()
    return jsonify({'active':a.active})

@alerts_bp.route('/logs', methods=['GET'])
@require_auth
def alert_logs():
    """History of all triggered alerts for this tenant."""
    from models import AlertLog
    logs = AlertLog.query.filter_by(tenant_id=g.tenant.id)\
                         .order_by(AlertLog.sent_at.desc()).limit(50).all()
    return jsonify({'logs': [{
        'alert_name':   l.alert_name,
        'cloud':        l.cloud,
        'threshold':    l.threshold,
        'actual_spend': l.actual_spend,
        'email':        l.email_sent_to,
        'status':       l.status,
        'sent_at':      l.sent_at.isoformat(),
    } for l in logs]})
