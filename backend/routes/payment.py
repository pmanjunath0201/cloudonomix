"""
Razorpay Payment Integration
For now: creates payment links that can be sent to clients.
When Razorpay webhook fires (payment success), auto-upgrades plan.
"""
import os
from flask import Blueprint, jsonify, request, g
from auth_utils import require_auth, require_superadmin

payment_bp = Blueprint('payment', __name__)

PLAN_PRICE_INR = {'starter':399900, 'growth':999900, 'business':2999900}  # in paise
PLAN_PRICE_USD = {'starter':4900,   'growth':14900,  'business':49900}

@payment_bp.route('/create-link', methods=['POST'])
@require_superadmin
def create_payment_link():
    """Admin creates a payment link for a specific tenant and plan."""
    d         = request.get_json() or {}
    tenant_id = d.get('tenant_id')
    plan      = d.get('plan','growth')
    currency  = d.get('currency','INR')  # INR or USD

    if plan not in ('starter','growth','business'):
        return jsonify({'error':'Invalid plan'}), 400

    from models import Tenant
    tenant = Tenant.query.get(tenant_id)
    if not tenant:
        return jsonify({'error':'Tenant not found'}), 404

    razorpay_key = os.getenv('RAZORPAY_KEY_ID','')
    if not razorpay_key:
        # Return WhatsApp fallback if Razorpay not configured
        wa_num = os.getenv('WHATSAPP_NUMBER','919XXXXXXXXX')
        amount = PLAN_PRICE_INR[plan]//100 if currency=='INR' else PLAN_PRICE_USD[plan]//100
        sym    = '₹' if currency=='INR' else '$'
        return jsonify({
            'method':    'whatsapp',
            'message':   f'Razorpay not configured. Send WhatsApp payment request.',
            'whatsapp':  f'https://wa.me/{wa_num}?text=Payment request for {tenant.name}: {plan.title()} plan {sym}{amount}/month',
            'amount':    amount,
            'currency':  currency,
            'plan':      plan,
            'tenant':    tenant.name,
        })

    # Razorpay API integration
    try:
        import razorpay
        client = razorpay.Client(auth=(razorpay_key, os.getenv('RAZORPAY_KEY_SECRET','')))
        amount = PLAN_PRICE_INR[plan] if currency=='INR' else PLAN_PRICE_USD[plan]
        owner  = next((u for u in tenant.users if u.role=='owner'), None)

        link_data = {
            'amount':      amount,
            'currency':    currency,
            'description': f'Cloudonomix {plan.title()} Plan — Monthly',
            'reference_id':f'cx_{tenant.id}_{plan}',
            'expire_by':   int(__import__('time').time()) + 86400 * 7,  # 7 days
            'customer': {
                'name':  owner.name if owner else tenant.name,
                'email': owner.email if owner else '',
            },
            'notify': {'sms':False,'email':True},
            'reminder_enable': True,
            'notes': {'tenant_id': str(tenant.id), 'plan': plan},
            'callback_url':    os.getenv('APP_URL','') + '/payment-success',
            'callback_method': 'get',
        }
        link = client.payment_link.create(link_data)
        return jsonify({
            'method':       'razorpay',
            'payment_link': link['short_url'],
            'amount':       amount//100,
            'currency':     currency,
            'plan':         plan,
            'tenant':       tenant.name,
            'expires_in':   '7 days',
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@payment_bp.route('/webhook', methods=['POST'])
def razorpay_webhook():
    """Razorpay webhook — auto-upgrades plan on payment success."""
    import hmac, hashlib
    secret = os.getenv('RAZORPAY_WEBHOOK_SECRET','')
    sig    = request.headers.get('X-Razorpay-Signature','')
    body   = request.get_data()

    if secret and sig:
        expected = hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()
        if not hmac.compare_digest(expected, sig):
            return jsonify({'error':'Invalid signature'}), 400

    event = request.get_json() or {}
    if event.get('event') == 'payment_link.paid':
        notes = event.get('payload',{}).get('payment_link',{}).get('entity',{}).get('notes',{})
        tenant_id = notes.get('tenant_id')
        plan      = notes.get('plan')
        if tenant_id and plan:
            from models import Tenant
            from database import db
            tenant = Tenant.query.get(int(tenant_id))
            if tenant:
                old_plan   = tenant.plan
                tenant.plan= plan
                db.session.commit()
                # Email client about upgrade
                try:
                    from services.email_service import _send
                    owner = next((u for u in tenant.users if u.role=='owner'), None)
                    if owner:
                        _send(owner.email,
                              f'Your Cloudonomix plan is now {plan.title()}!',
                              f'<p>Payment received. Your plan is upgraded to <b>{plan}</b>. Enjoy your new features!</p>')
                except: pass
                print(f"[Payment] {tenant.name} upgraded {old_plan} → {plan}")

    return jsonify({'status':'ok'})
