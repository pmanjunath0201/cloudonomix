from flask import Blueprint, jsonify, g
from auth_utils import require_auth

costs_bp = Blueprint('costs', __name__)

@costs_bp.route('/aws', methods=['GET'])
@require_auth
def aws_costs():
    if not g.tenant.aws_ok:
        return jsonify({'error': 'AWS not configured'}), 400
    try:
        from services.aws_service import get_cost_summary_cached, get_cost_by_region_cached
        return jsonify({
            'monthly': get_cost_summary_cached(g.tenant),
            'regions': get_cost_by_region_cached(g.tenant)
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@costs_bp.route('/gcp', methods=['GET'])
@require_auth
def gcp_costs():
    if not g.tenant.gcp_ok:
        return jsonify({'error': 'GCP not configured'}), 400
    try:
        from services.cache import get as cache_get, set as cache_set
        key = f"t{g.tenant.id}:gcp:cost_summary"
        cached = cache_get(key)
        if cached:
            return jsonify({'monthly': cached})
        from services.gcp_service import get_cost_summary
        data = get_cost_summary(g.tenant)
        cache_set(key, data, ttl_seconds=600)
        return jsonify({'monthly': data})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@costs_bp.route('/azure', methods=['GET'])
@require_auth
def azure_costs():
    if not g.tenant.azure_ok:
        return jsonify({'error': 'Azure not configured'}), 400
    try:
        from services.azure_service import get_cost_summary
        return jsonify({'monthly': get_cost_summary(g.tenant)})  # already cached inside
    except Exception as e:
        return jsonify({'error': str(e)}), 500
