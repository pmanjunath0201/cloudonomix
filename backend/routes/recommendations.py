from flask import Blueprint, jsonify, g
from auth_utils import require_auth

recs_bp = Blueprint('recommendations', __name__)

@recs_bp.route('/', methods=['GET'])
@require_auth
def get_all():
    t = g.tenant
    if not (t.aws_ok or t.gcp_ok or t.azure_ok):
        return jsonify({'error': 'No cloud accounts connected'}), 400

    all_recs     = []
    total_spend  = 0
    total_savings= 0

    from services.recommendations_engine import (
        generate_aws_recommendations, generate_azure_recommendations, generate_gcp_recommendations)

    if t.aws_ok:
        try:
            from services.aws_service import get_cost_summary_cached
            result = generate_aws_recommendations({'monthly': get_cost_summary_cached(t)})
            all_recs.extend(result.get('recommendations', []))
            total_spend   += result.get('total_current_spend', 0)
            total_savings += result.get('total_estimated_savings', 0)
        except Exception as e:
            all_recs.append({'cloud':'AWS','error':str(e)})

    if t.azure_ok:
        try:
            from services.azure_service import get_cost_summary  # uses cache
            result = generate_azure_recommendations({'monthly': get_cost_summary(t)})
            all_recs.extend(result.get('recommendations', []))
            total_spend   += result.get('total_current_spend', 0)
            total_savings += result.get('total_estimated_savings', 0)
        except Exception as e:
            all_recs.append({'cloud':'Azure','error':str(e)})

    if t.gcp_ok:
        try:
            from services.cache import get as cache_get, set as cache_set
            key  = f"t{t.id}:gcp:cost_summary"
            data = cache_get(key)
            if not data:
                from services.gcp_service import get_cost_summary
                data = get_cost_summary(t)
                cache_set(key, data, ttl_seconds=600)
            result = generate_gcp_recommendations({'monthly': data})
            all_recs.extend(result.get('recommendations', []))
            total_spend   += result.get('total_current_spend', 0)
            total_savings += result.get('total_estimated_savings', 0)
        except Exception as e:
            all_recs.append({'cloud':'GCP','error':str(e)})

    valid = [r for r in all_recs if 'error' not in r]
    valid.sort(key=lambda x: x.get('estimated_savings', 0), reverse=True)

    return jsonify({
        'recommendations': valid,
        'errors': [r for r in all_recs if 'error' in r],
        'summary': {
            'total_spend':     round(total_spend, 2),
            'total_savings':   round(total_savings, 2),
            'savings_pct':     round((total_savings / total_spend * 100) if total_spend else 0, 1),
            'total_count':     len(valid),
            'high_priority':   len([r for r in valid if r.get('priority') == 'HIGH']),
            'medium_priority': len([r for r in valid if r.get('priority') == 'MEDIUM']),
        }
    })

@recs_bp.route('/azure', methods=['GET'])
@require_auth
def azure_recs():
    if not g.tenant.azure_ok:
        return jsonify({'error':'Azure not configured'}), 400
    try:
        from services.azure_service import get_cost_summary
        from services.recommendations_engine import generate_azure_recommendations
        return jsonify(generate_azure_recommendations({'monthly': get_cost_summary(g.tenant)}))
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@recs_bp.route('/aws', methods=['GET'])
@require_auth
def aws_recs():
    if not g.tenant.aws_ok:
        return jsonify({'error':'AWS not configured'}), 400
    try:
        from services.aws_service import get_cost_summary_cached
        from services.recommendations_engine import generate_aws_recommendations
        return jsonify(generate_aws_recommendations({'monthly': get_cost_summary_cached(g.tenant)}))
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@recs_bp.route('/gcp', methods=['GET'])
@require_auth
def gcp_recs():
    if not g.tenant.gcp_ok:
        return jsonify({'error':'GCP not configured'}), 400
    try:
        from services.cache import get as cache_get, set as cache_set
        key  = f"t{g.tenant.id}:gcp:cost_summary"
        data = cache_get(key)
        if not data:
            from services.gcp_service import get_cost_summary
            data = get_cost_summary(g.tenant)
            cache_set(key, data, ttl_seconds=600)
        from services.recommendations_engine import generate_gcp_recommendations
        return jsonify(generate_gcp_recommendations({'monthly': data}))
    except Exception as e:
        return jsonify({'error': str(e)}), 500
