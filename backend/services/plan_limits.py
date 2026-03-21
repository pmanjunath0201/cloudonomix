"""
Plan enforcement — single source of truth for all plan limits.
"""

PLANS = {
    'starter': {
        'max_clouds':       1,
        'max_users':        3,
        'max_alerts':       3,
        'resource_scanner': False,
        'anomaly_detector': False,
        'pdf_reports':      False,
        'multicloud_view':  False,
        'savings_center':   'basic',
        'price_inr':        3999,
        'price_usd':        49,
    },
    'growth': {
        'max_clouds':       3,
        'max_users':        10,
        'max_alerts':       20,
        'resource_scanner': True,
        'anomaly_detector': True,
        'pdf_reports':      True,
        'multicloud_view':  True,
        'savings_center':   'full',
        'price_inr':        9999,
        'price_usd':        149,
    },
    'business': {
        'max_clouds':       999,
        'max_users':        999,
        'max_alerts':       999,
        'resource_scanner': True,
        'anomaly_detector': True,
        'pdf_reports':      True,
        'multicloud_view':  True,
        'savings_center':   'full',
        'price_inr':        29999,
        'price_usd':        499,
    },
}

NEXT_PLAN  = {'starter':'growth','growth':'business','business':None}
FEAT_NAMES = {
    'resource_scanner': 'Resource Scanner',
    'anomaly_detector': 'Anomaly Detector',
    'pdf_reports':      'PDF Reports',
    'multicloud_view':  'Multi-Cloud Dashboard',
}

def get_limits(plan):
    return PLANS.get(plan, PLANS['starter'])

def count_connected_clouds(tenant):
    return sum([bool(tenant.aws_ok), bool(tenant.gcp_ok), bool(tenant.azure_ok)])

def can_connect_cloud(tenant):
    return count_connected_clouds(tenant) < get_limits(tenant.plan)['max_clouds']

def can_add_user(tenant):
    from models import User
    current = User.query.filter_by(tenant_id=tenant.id).count()
    return current < get_limits(tenant.plan)['max_users']

def can_add_alert(tenant):
    return len(tenant.alerts) < get_limits(tenant.plan)['max_alerts']

def check_feature(tenant, feature):
    """Returns (allowed, message)"""
    limits  = get_limits(tenant.plan)
    allowed = limits.get(feature, False)
    if not allowed:
        fname     = FEAT_NAMES.get(feature, feature)
        next_plan = NEXT_PLAN.get(tenant.plan)
        msg = f"{fname} is not available on your {tenant.plan.title()} plan."
        if next_plan:
            np = PLANS[next_plan]
            msg += (f" Upgrade to {next_plan.title()} "
                    f"(₹{np['price_inr']:,}/mo · ${np['price_usd']}/mo) to unlock.")
        return False, msg
    return True, 'OK'

def plan_status(tenant):
    from models import User
    limits       = get_limits(tenant.plan)
    current_users = User.query.filter_by(tenant_id=tenant.id).count()
    current_clouds= count_connected_clouds(tenant)
    next_plan     = NEXT_PLAN.get(tenant.plan)
    np_data       = PLANS.get(next_plan, {})

    return {
        'plan':   tenant.plan,
        'limits': limits,
        'usage': {
            'clouds': current_clouds,
            'users':  current_users,
            'alerts': len(tenant.alerts),
        },
        'can_add_cloud': current_clouds < limits['max_clouds'],
        'can_add_user':  current_users  < limits['max_users'],
        'can_add_alert': len(tenant.alerts) < limits['max_alerts'],
        'features': {
            'resource_scanner': limits['resource_scanner'],
            'anomaly_detector': limits['anomaly_detector'],
            'pdf_reports':      limits['pdf_reports'],
            'multicloud_view':  limits['multicloud_view'],
            'savings_center':   limits['savings_center'],
        },
        'next_plan':          next_plan,
        'next_plan_price_inr': np_data.get('price_inr'),
        'next_plan_price_usd': np_data.get('price_usd'),
    }
