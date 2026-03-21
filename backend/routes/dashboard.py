from flask import Blueprint, jsonify, g
from auth_utils import require_auth

dashboard_bp = Blueprint('dashboard', __name__)

@dashboard_bp.route('/summary', methods=['GET'])
@require_auth
def summary():
    t = g.tenant
    clouds = {'aws': t.aws_ok, 'gcp': t.gcp_ok, 'azure': t.azure_ok}
    if not any(clouds.values()):
        return jsonify({'no_credentials': True, 'clouds': clouds,
                        'message': 'Connect at least one cloud provider in Settings.'})

    result = {'no_credentials': False, 'clouds': clouds,
              'aws': None, 'gcp': None, 'azure': None,
              'total_monthly': 0, 'currencies': {}}

    if t.aws_ok:
        try:
            from services.aws_service import get_cost_summary_cached
            data = get_cost_summary_cached(t)
            if data:
                curr = data[-1]; prev = data[-2] if len(data)>1 else None
                chg  = round(((curr['total']-prev['total'])/prev['total'])*100,1) if prev and prev['total'] else 0
                result['aws'] = {
                    'monthly_total': curr['total'], 'prev_total': prev['total'] if prev else 0,
                    'change_pct': chg, 'top_services': curr['services'][:5],
                    'trend': [{'month':p['month'],'total':p['total']} for p in data[-6:]],
                    'currency': 'USD'
                }
                result['total_monthly'] += curr['total']
                result['currencies']['aws'] = 'USD'
        except Exception as e:
            result['aws'] = {'error': str(e)}

    if t.gcp_ok:
        try:
            from services.cache import get as cg, set as cs
            key  = f"t{t.id}:gcp:cost_summary"
            data = cg(key)
            if not data:
                from services.gcp_service import get_cost_summary
                data = get_cost_summary(t); cs(key, data, ttl_seconds=600)
            if data:
                curr = data[-1]
                result['gcp'] = {'monthly_total': curr['total'], 'top_services': curr['services'][:5],
                                  'trend': [{'month':p['month'],'total':p['total']} for p in data[-6:]],
                                  'currency': 'USD'}
                result['total_monthly'] += curr['total']
                result['currencies']['gcp'] = 'USD'
        except Exception as e:
            result['gcp'] = {'error': str(e)}

    if t.azure_ok:
        try:
            from services.azure_service import get_cost_summary
            data = get_cost_summary(t)
            if data:
                curr     = data[-1]
                prev     = data[-2] if len(data)>1 else None
                chg      = round(((curr['total']-prev['total'])/prev['total'])*100,1) if prev and prev['total'] else 0
                currency = curr.get('currency', 'USD')
                result['azure'] = {
                    'monthly_total': curr['total'], 'change_pct': chg,
                    'top_services': curr['services'][:5],
                    'trend': [{'month':p['month'],'total':p['total']} for p in data[-6:]],
                    'currency': currency
                }
                result['total_monthly'] += curr['total']
                result['currencies']['azure'] = currency
        except Exception as e:
            result['azure'] = {'error': str(e)}

    result['total_monthly'] = round(result['total_monthly'], 2)

    # Add trial status
    try:
        from services.trial_service import get_trial_status
        result['trial'] = get_trial_status(t.id)
    except Exception as e:
        result['trial'] = {'on_trial': False, 'error': str(e)}

    return jsonify(result)

@dashboard_bp.route('/plan-status', methods=['GET'])
@require_auth
def get_plan_status():
    from services.plan_limits import plan_status
    status = plan_status(g.tenant)
    status['usage']['alerts'] = len(g.tenant.alerts)
    return jsonify(status)
