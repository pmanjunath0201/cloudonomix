from flask import Blueprint, jsonify, g, request
from auth_utils import require_auth
from services.plan_limits import check_feature

scanner_bp = Blueprint('scanner', __name__)

def _plan_check(feature):
    allowed, msg = check_feature(g.tenant, feature)
    if not allowed:
        return jsonify({'error': msg, 'upgrade_required': True, 'current_plan': g.tenant.plan}), 403
    return None

@scanner_bp.route('/aws', methods=['GET'])
@require_auth
def scan_aws():
    block = _plan_check('resource_scanner')
    if block: return block
    if not g.tenant.aws_ok:
        return jsonify({'error': 'AWS not configured'}), 400
    resource_type = request.args.get('type', 'ec2')
    try:
        if resource_type == 'ec2':
            from services.aws_service import scan_ec2_cached
            data = scan_ec2_cached(g.tenant)
            return jsonify({'resources': data, 'summary': {
                'total': len(data), 'idle': len([r for r in data if r['status']=='IDLE']),
                'stopped': len([r for r in data if r['status']=='STOPPED']),
                'healthy': len([r for r in data if r['status']=='HEALTHY']),
                'total_cost': round(sum(r['monthly_cost'] for r in data), 2),
                'total_savings': round(sum(r['potential_savings'] for r in data), 2)
            }})
        elif resource_type == 'ebs':
            from services.aws_service import scan_ebs_cached
            data = scan_ebs_cached(g.tenant)
            return jsonify({'resources': data, 'summary': {
                'total': len(data),
                'unattached': len([v for v in data if v['status']=='UNATTACHED']),
                'total_cost': round(sum(v['monthly_cost'] for v in data), 2),
                'total_savings': round(sum(v['potential_savings'] for v in data), 2)
            }})
        elif resource_type == 'rds':
            from services.aws_service import scan_rds_cached
            data = scan_rds_cached(g.tenant)
            return jsonify({'resources': data, 'summary': {
                'total': len(data),
                'idle': len([r for r in data if r['resource_status']=='IDLE']),
                'total_cost': round(sum(r['monthly_cost'] for r in data), 2),
                'total_savings': round(sum(r['potential_savings'] for r in data), 2)
            }})
        elif resource_type == 's3':
            from services.aws_service import scan_s3_cached
            data = scan_s3_cached(g.tenant)
            return jsonify({'resources': data, 'summary': {
                'total': len(data),
                'cold': len([b for b in data if b['status']=='COLD']),
                'total_cost': round(sum(b['monthly_cost'] for b in data), 2),
                'total_savings': round(sum(b['potential_savings'] for b in data), 2)
            }})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@scanner_bp.route('/azure/vms', methods=['GET'])
@require_auth
def scan_azure_vms():
    block = _plan_check('resource_scanner')
    if block: return block
    if not g.tenant.azure_ok:
        return jsonify({'error': 'Azure not configured'}), 400
    try:
        from services.azure_service import get_vm_details
        return jsonify(get_vm_details(g.tenant))
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@scanner_bp.route('/azure', methods=['GET'])
@require_auth
def scan_azure():
    if not g.tenant.azure_ok:
        return jsonify({'error': 'Azure not configured'}), 400
    try:
        from services.azure_service import get_cost_by_service
        services = get_cost_by_service(g.tenant)
        return jsonify({'services': services, 'total': round(sum(s['cost'] for s in services), 2)})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@scanner_bp.route('/gcp', methods=['GET'])
@require_auth
def scan_gcp():
    if not g.tenant.gcp_ok:
        return jsonify({'error': 'GCP not configured'}), 400
    try:
        from services.gcp_service import get_cost_by_service
        data = get_cost_by_service(g.tenant)
        return jsonify({'services': data, 'total': round(sum(s['cost'] for s in data), 2)})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@scanner_bp.route('/anomalies/all', methods=['GET'])
@require_auth
def anomalies_all():
    block = _plan_check('anomaly_detector')
    if block: return block
    t = g.tenant
    result = {'aws': None, 'gcp': None, 'azure': None, 'all_anomalies': []}

    if t.aws_ok:
        try:
            from services.aws_service import detect_anomalies_cached
            aws_a = detect_anomalies_cached(t)
            result['aws'] = aws_a
            result['all_anomalies'].extend([{**a, 'cloud': 'AWS'} for a in aws_a])
        except Exception as e:
            result['aws'] = {'error': str(e)}

    if t.azure_ok:
        try:
            from services.azure_service import get_cost_summary
            monthly   = get_cost_summary(t)
            anomalies = []
            if len(monthly) >= 2:
                prev = {s['service']: s['cost'] for s in monthly[-2]['services']}
                curr = {s['service']: s['cost'] for s in monthly[-1]['services']}
                for svc, amt in curr.items():
                    p = prev.get(svc, 0)
                    if p > 0:
                        pct = ((amt - p) / p) * 100
                        if pct > 25:
                            sev = 'CRITICAL' if pct > 100 else 'HIGH' if pct > 50 else 'MEDIUM'
                            anomalies.append({
                                'service': svc, 'current': round(amt,2), 'previous': round(p,2),
                                'change_pct': round(pct,1), 'change_amt': round(amt-p,2),
                                'severity': sev, 'cloud': 'Azure',
                                'message': f'Azure {svc} increased {pct:.1f}% (+${amt-p:.2f}) vs last month'
                            })
            anomalies.sort(key=lambda x: x['change_pct'], reverse=True)
            result['azure'] = anomalies
            result['all_anomalies'].extend(anomalies)
        except Exception as e:
            result['azure'] = {'error': str(e)}

    if t.gcp_ok:
        try:
            from services.gcp_service import get_cost_summary
            monthly   = get_cost_summary(t)
            anomalies = []
            if len(monthly) >= 2:
                prev = {s['service']: s['cost'] for s in monthly[-2]['services']}
                curr = {s['service']: s['cost'] for s in monthly[-1]['services']}
                for svc, amt in curr.items():
                    p = prev.get(svc, 0)
                    if p > 0:
                        pct = ((amt - p) / p) * 100
                        if pct > 25:
                            sev = 'CRITICAL' if pct > 100 else 'HIGH' if pct > 50 else 'MEDIUM'
                            anomalies.append({
                                'service': svc, 'current': round(amt,2), 'previous': round(p,2),
                                'change_pct': round(pct,1), 'change_amt': round(amt-p,2),
                                'severity': sev, 'cloud': 'GCP',
                                'message': f'GCP {svc} increased {pct:.1f}% (+${amt-p:.2f}) vs last month'
                            })
            anomalies.sort(key=lambda x: x['change_pct'], reverse=True)
            result['gcp'] = anomalies
            result['all_anomalies'].extend(anomalies)
        except Exception as e:
            result['gcp'] = {'error': str(e)}

    result['all_anomalies'].sort(key=lambda x: x.get('change_pct', 0), reverse=True)
    result['total_anomalies'] = len(result['all_anomalies'])
    result['critical_count']  = len([a for a in result['all_anomalies'] if a.get('severity') == 'CRITICAL'])
    result['total_excess']    = round(sum(a.get('change_amt', 0) for a in result['all_anomalies']), 2)
    return jsonify(result)

@scanner_bp.route('/gcp/vms', methods=['GET'])
@require_auth
def scan_gcp_vms():
    block = _plan_check('resource_scanner')
    if block: return block
    if not g.tenant.gcp_ok:
        return jsonify({'error': 'GCP not configured'}), 400
    try:
        from services.gcp_service import get_compute_instances
        return jsonify(get_compute_instances(g.tenant))
    except Exception as e:
        return jsonify({'error': str(e)}), 500
