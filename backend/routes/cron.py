"""
Cron endpoints — called by Render.com cron job every hour.
Secured with CRON_SECRET environment variable.
"""
import os
from flask import Blueprint, jsonify, request
from datetime import datetime

cron_bp = Blueprint('cron', __name__)

def _verify_secret():
    """Verify the cron job secret to prevent unauthorized calls."""
    cron_secret = os.getenv('CRON_SECRET', '')
    if not cron_secret:
        return True  # If no secret set, allow (dev mode)
    
    # Accept via header or query param
    provided = (request.headers.get('X-Cron-Secret') or 
                request.args.get('secret', ''))
    return provided == cron_secret

@cron_bp.route('/check-alerts', methods=['GET', 'POST'])
def check_alerts():
    """
    Main cron endpoint — called every hour by Render.com.
    Checks all tenant alerts and sends emails if thresholds exceeded.
    
    Setup on Render.com:
    1. Go to your Render dashboard
    2. New → Cron Job
    3. Command: curl https://your-app.onrender.com/api/cron/check-alerts -H "X-Cron-Secret: YOUR_SECRET"
    4. Schedule: 0 * * * * (every hour)
    """
    if not _verify_secret():
        return jsonify({'error': 'Unauthorized'}), 401

    start_time = datetime.utcnow()
    
    try:
        from flask import current_app
        from services.alert_checker import run_alert_check
        result = run_alert_check(current_app._get_current_object())
        
        result['duration_seconds'] = round(
            (datetime.utcnow() - start_time).total_seconds(), 2)
        result['status'] = 'ok'
        
        print(f"[Cron] check-alerts completed in {result['duration_seconds']}s")
        return jsonify(result)
        
    except Exception as e:
        error_msg = str(e)
        print(f"[Cron] check-alerts FAILED: {error_msg}")
        return jsonify({
            'status':  'error',
            'error':   error_msg,
            'timestamp': start_time.isoformat()
        }), 500

@cron_bp.route('/ping', methods=['GET'])
def ping():
    """
    Keep-alive ping — prevents Render free tier from sleeping.
    Call every 10 minutes via cron-job.org (free).
    URL: https://your-app.onrender.com/api/cron/ping
    """
    return jsonify({
        'status':    'alive',
        'timestamp': datetime.utcnow().isoformat(),
        'message':   'Cloudonomix backend is running'
    })

@cron_bp.route('/alert-logs', methods=['GET'])
def alert_logs():
    """Admin view of all alert emails sent — secured with cron secret."""
    if not _verify_secret():
        return jsonify({'error': 'Unauthorized'}), 401
    
    try:
        from models import AlertLog
        logs = AlertLog.query.order_by(AlertLog.sent_at.desc()).limit(100).all()
        return jsonify({'logs': [{
            'id':           l.id,
            'tenant':       l.tenant_name,
            'alert':        l.alert_name,
            'cloud':        l.cloud,
            'threshold':    l.threshold,
            'actual_spend': l.actual_spend,
            'email':        l.email_sent_to,
            'status':       l.status,
            'sent_at':      l.sent_at.isoformat(),
        } for l in logs], 'count': len(logs)})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@cron_bp.route('/check-trials', methods=['GET', 'POST'])
def check_trials():
    """
    Check all trials — send warnings and expire as needed.
    Runs every hour alongside alert checker.
    Schedule: 0 * * * * (every hour)
    """
    if not _verify_secret():
        return jsonify({'error': 'Unauthorized'}), 401
    try:
        from flask import current_app
        from services.trial_service import check_all_trials
        result = check_all_trials(current_app._get_current_object())
        result['status'] = 'ok'
        return jsonify(result)
    except Exception as e:
        return jsonify({'status': 'error', 'error': str(e)}), 500

@cron_bp.route('/check-all', methods=['GET', 'POST'])
def check_all():
    """
    Master cron endpoint — runs BOTH alert checker AND trial checker.
    Use this single endpoint in Render cron job to do everything at once.
    Schedule: 0 * * * * (every hour)
    """
    if not _verify_secret():
        return jsonify({'error': 'Unauthorized'}), 401

    results = {}
    start   = datetime.utcnow()

    # Run alert checker
    try:
        from flask import current_app
        from services.alert_checker import run_alert_check
        results['alerts'] = run_alert_check(current_app._get_current_object())
        results['alerts']['status'] = 'ok'
    except Exception as e:
        results['alerts'] = {'status': 'error', 'error': str(e)}

    # Run trial checker
    try:
        from flask import current_app
        from services.trial_service import check_all_trials
        results['trials'] = check_all_trials(current_app._get_current_object())
        results['trials']['status'] = 'ok'
    except Exception as e:
        results['trials'] = {'status': 'error', 'error': str(e)}

    results['duration_seconds'] = round(
        (datetime.utcnow() - start).total_seconds(), 2)
    results['timestamp'] = start.isoformat()

    print(f"[Cron] check-all done in {results['duration_seconds']}s")
    return jsonify(results)


@cron_bp.route('/onboarding-emails', methods=['GET','POST'])
def onboarding_emails():
    """Send Day-3 and Day-7 onboarding emails to new tenants."""
    if not _verify_secret():
        return jsonify({'error':'Unauthorized'}), 401
    try:
        from flask import current_app
        from app import create_app
        app = current_app._get_current_object()
        with app.app_context():
            from models import Tenant, User, TrialConfig
            from services.email_service import send_onboarding_day3, send_onboarding_day7
            from datetime import datetime, timedelta
            from database import db

            sent3=0; sent7=0
            trials = TrialConfig.query.filter_by(is_expired=False).all()
            for trial in trials:
                tenant = Tenant.query.get(trial.tenant_id)
                if not tenant or tenant.slug=='cloudonomix-admin': continue
                owner = next((u for u in tenant.users if u.role=='owner'), None)
                if not owner or not owner.is_verified: continue
                days_since = (datetime.utcnow() - trial.trial_start).days
                has_cloud  = tenant.aws_ok or tenant.gcp_ok or tenant.azure_ok

                # Day 3 email — if not sent yet
                if days_since == 3 and not getattr(trial,'onboarding3_sent',False):
                    send_onboarding_day3(owner.email, owner.name, tenant.name, has_cloud)
                    sent3 += 1

                # Day 7 email — if connected and not sent yet
                if days_since == 7 and has_cloud and not getattr(trial,'onboarding7_sent',False):
                    try:
                        total=0; savings=0; sym='$'
                        if tenant.azure_ok:
                            from services.azure_service import get_cost_summary
                            from services.recommendations_engine import generate_azure_recommendations
                            data = get_cost_summary(tenant)
                            if data:
                                r = generate_azure_recommendations({'monthly':data})
                                total   = r.get('total_current_spend',0)
                                savings = r.get('total_estimated_savings',0)
                                currency= data[-1].get('currency','USD') if data else 'USD'
                                sym     = '₹' if currency=='INR' else '$'
                        if total > 0:
                            send_onboarding_day7(owner.email,owner.name,tenant.name,total,savings,sym)
                            sent7 += 1
                    except: pass

        return jsonify({'status':'ok','day3_sent':sent3,'day7_sent':sent7})
    except Exception as e:
        return jsonify({'status':'error','error':str(e)}), 500
