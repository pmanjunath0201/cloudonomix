"""
Cloudonomix Recommendations Engine
Generates specific, actionable cost-saving recommendations per service/resource.
This is the CORE value of the product.
"""

# ─── Azure Recommendations ────────────────────────────────────────────────────

AZURE_SERVICE_RECS = {
    'Container Registry': {
        'tiers': {'Basic': 5.0, 'Standard': 20.0, 'Premium': 50.0},
        'actions': [
            'Delete untagged/unused container images (docker image prune)',
            'Enable auto-purge for images older than 30 days',
            'Downgrade to Basic tier if you have < 10GB and < 1 team user',
            'Use geo-replication only in Premium if truly needed — disabling saves up to 50%',
        ],
        'savings_pct': 0.40
    },
    'Storage': {
        'actions': [
            'Enable lifecycle management policies — move blobs to Cool/Archive tier after 30 days',
            'Delete orphaned snapshots and old unattached disks',
            'Use reserved capacity for predictable storage needs (up to 38% savings)',
            'Switch from LRS to ZRS only where geo-redundancy is truly needed',
        ],
        'savings_pct': 0.35
    },
    'Virtual Machines': {
        'actions': [
            'Right-size VMs with < 10% avg CPU over 7 days — step down one size',
            'Use Azure Reserved VM Instances for 1-3 year commitments (up to 72% savings)',
            'Enable auto-shutdown for dev/test VMs outside business hours',
            'Switch to B-series (burstable) for workloads with variable CPU needs',
            'Use Spot VMs for batch/non-critical workloads (up to 90% savings)',
        ],
        'savings_pct': 0.45
    },
    'Virtual Network': {
        'actions': [
            'Delete unused Public IP addresses ($3.65/mo each)',
            'Remove idle VPN gateways if not in use',
            'Consolidate NAT gateways where possible',
            'Review ExpressRoute circuits for utilization',
        ],
        'savings_pct': 0.25
    },
    'Azure App Service': {
        'actions': [
            'Move dev/test apps to Free or Shared tier',
            'Use deployment slots only on Standard+ plans — remove if unused',
            'Enable auto-scaling instead of over-provisioning',
            'Consolidate multiple small apps onto one App Service Plan',
        ],
        'savings_pct': 0.50
    },
    'SQL Database': {
        'actions': [
            'Switch to serverless tier for intermittent workloads',
            'Enable auto-pause for dev databases (pauses after 1 hr inactivity)',
            'Right-size DTUs/vCores based on actual consumption',
            'Use elastic pools for multiple databases with variable usage',
        ],
        'savings_pct': 0.40
    },
    'Bandwidth': {
        'actions': [
            'Use Azure CDN to cache static content and reduce egress costs',
            'Enable compression on App Service to reduce data transfer',
            'Review cross-region data transfer — keep data in same region where possible',
        ],
        'savings_pct': 0.30
    },
}

# ─── AWS Recommendations ──────────────────────────────────────────────────────

AWS_SERVICE_RECS = {
    'Amazon EC2': {
        'actions': [
            'Identify instances with < 5% avg CPU — stop or rightsize immediately',
            'Purchase Reserved Instances for steady-state workloads (up to 72% savings)',
            'Use Savings Plans for flexible compute usage across instance types',
            'Switch to Graviton2 (ARM) instances for compatible workloads — 20% cheaper',
            'Enable auto-scaling groups instead of always-on over-provisioned instances',
            'Use Spot Instances for batch jobs, CI/CD, non-critical workloads',
        ],
        'savings_pct': 0.40
    },
    'Amazon S3': {
        'actions': [
            'Enable S3 Intelligent-Tiering for objects not accessed for 30+ days',
            'Move infrequent data to S3 Standard-IA (45% cheaper than Standard)',
            'Archive cold data to S3 Glacier (68% cheaper than Standard)',
            'Delete incomplete multipart uploads older than 7 days',
            'Enable bucket versioning cleanup lifecycle rules',
            'Compress large objects before uploading',
        ],
        'savings_pct': 0.55
    },
    'Amazon RDS': {
        'actions': [
            'Stop dev/test RDS instances outside business hours',
            'Right-size instance class based on CloudWatch CPU/connections metrics',
            'Switch to Aurora Serverless v2 for variable workloads',
            'Purchase Reserved Instances for production databases (up to 69% savings)',
            'Enable automated backups with minimal retention for non-critical DBs',
        ],
        'savings_pct': 0.45
    },
    'AWS Lambda': {
        'actions': [
            'Optimize memory allocation — profile with AWS Lambda Power Tuning',
            'Reduce function timeout to minimum required',
            'Use Graviton2 for Lambda (up to 19% better price/performance)',
            'Review invocation frequency — combine multiple small functions',
        ],
        'savings_pct': 0.30
    },
    'Amazon CloudFront': {
        'actions': [
            'Enable Origin Shield to reduce origin requests',
            'Use price class to serve only needed regions',
            'Enable compression for text/JSON responses',
            'Review cache hit ratio — low hit rate means you are paying for unnecessary origin fetches',
        ],
        'savings_pct': 0.25
    },
    'Amazon EBS': {
        'actions': [
            'Delete unattached EBS volumes — they charge even when not in use',
            'Downgrade gp2 volumes to gp3 (20% cheaper with better baseline performance)',
            'Delete old/unused snapshots — they accumulate and are charged per GB',
            'Right-size volumes — most are provisioned at 2-5x actual usage',
        ],
        'savings_pct': 0.35
    },
    'AWS Data Transfer': {
        'actions': [
            'Use VPC endpoints to avoid NAT Gateway data transfer charges',
            'Move workloads to same region as their data sources',
            'Use S3 Transfer Acceleration only where required',
            'Enable CloudFront to offload S3 egress costs',
        ],
        'savings_pct': 0.40
    },
}

# ─── GCP Recommendations ──────────────────────────────────────────────────────

GCP_SERVICE_RECS = {
    'Compute Engine': {
        'actions': [
            'Enable committed use discounts for 1-3 year VMs (up to 57% savings)',
            'Use preemptible/Spot VMs for fault-tolerant workloads (up to 91% savings)',
            'Right-size machine types based on CPU/memory utilization',
            'Stop or delete idle instances (< 5% CPU)',
            'Use custom machine types to pay for exactly the CPU/RAM you need',
        ],
        'savings_pct': 0.45
    },
    'Cloud Storage': {
        'actions': [
            'Set lifecycle rules to move old objects to Nearline/Coldline/Archive',
            'Delete incomplete uploads',
            'Use Autoclass storage for automatic tiering',
            'Remove old object versions if versioning is enabled',
        ],
        'savings_pct': 0.50
    },
    'BigQuery': {
        'actions': [
            'Use partitioned and clustered tables to reduce query costs',
            'Enable slot commitments for predictable workloads',
            'Optimize queries — avoid SELECT * on large tables',
            'Set per-user query cost controls',
        ],
        'savings_pct': 0.35
    },
    'Cloud SQL': {
        'actions': [
            'Stop dev/test instances on evenings and weekends',
            'Right-size CPU/memory based on actual usage',
            'Use read replicas only where truly needed',
            'Switch to committed use discounts',
        ],
        'savings_pct': 0.40
    },
}

def generate_azure_recommendations(cost_data):
    """Generate actionable recommendations from Azure cost data."""
    recs = []
    if not cost_data or not cost_data.get('monthly'):
        return recs

    latest = cost_data['monthly'][-1] if cost_data['monthly'] else {}
    services = latest.get('services', [])
    total = latest.get('total', 0)

    for svc in services:
        name = svc['service']
        cost = svc['cost']
        if cost <= 0:
            continue

        # Find matching recommendation template
        matched_key = None
        for key in AZURE_SERVICE_RECS:
            if key.lower() in name.lower() or name.lower() in key.lower():
                matched_key = key
                break

        if matched_key:
            template = AZURE_SERVICE_RECS[matched_key]
            est_savings = round(cost * template['savings_pct'], 2)
            priority = 'HIGH' if cost > 100 else 'MEDIUM' if cost > 20 else 'LOW'
            recs.append({
                'id': f'azure-{name.lower().replace(" ","-")}',
                'cloud': 'Azure',
                'service': name,
                'current_cost': cost,
                'estimated_savings': est_savings,
                'savings_pct': int(template['savings_pct'] * 100),
                'priority': priority,
                'category': 'Service Optimization',
                'actions': template['actions'],
                'impact': f'Reduce {name} spend from ${cost}/mo to ~${round(cost - est_savings, 2)}/mo'
            })
        elif cost > 10:
            # Generic recommendation for unknown service
            est_savings = round(cost * 0.20, 2)
            recs.append({
                'id': f'azure-{name.lower().replace(" ","-")}-generic',
                'cloud': 'Azure',
                'service': name,
                'current_cost': cost,
                'estimated_savings': est_savings,
                'savings_pct': 20,
                'priority': 'LOW',
                'category': 'Review Required',
                'actions': [
                    f'Review {name} usage in Azure Portal — check for idle or over-provisioned resources',
                    'Check if test/dev resources can be scaled down or deleted',
                    'Review Azure Advisor recommendations for this service',
                ],
                'impact': f'Potential 20% reduction on ${name} spend'
            })

    # Sort by estimated savings descending
    recs.sort(key=lambda x: x['estimated_savings'], reverse=True)

    # Add total summary
    total_savings = round(sum(r['estimated_savings'] for r in recs), 2)
    return {
        'recommendations': recs,
        'total_current_spend': round(total, 2),
        'total_estimated_savings': total_savings,
        'savings_percentage': round((total_savings / total * 100) if total else 0, 1),
        'count': len(recs),
        'high_priority': len([r for r in recs if r['priority'] == 'HIGH']),
    }

def generate_aws_recommendations(cost_data, scan_data=None):
    """Generate actionable recommendations from AWS cost data + resource scan."""
    recs = []
    if not cost_data or not cost_data.get('monthly'):
        return {'recommendations': [], 'total_estimated_savings': 0}

    latest = cost_data['monthly'][-1] if cost_data['monthly'] else {}
    services = latest.get('services', [])
    total = latest.get('total', 0)

    for svc in services:
        name = svc['service']
        cost = svc['cost']
        if cost <= 0:
            continue

        matched_key = None
        for key in AWS_SERVICE_RECS:
            if key.lower() in name.lower() or name.lower() in key.lower():
                matched_key = key
                break

        if matched_key:
            template = AWS_SERVICE_RECS[matched_key]
            est_savings = round(cost * template['savings_pct'], 2)
            priority = 'HIGH' if cost > 200 else 'MEDIUM' if cost > 50 else 'LOW'
            recs.append({
                'id': f'aws-{name.lower().replace(" ","-")}',
                'cloud': 'AWS',
                'service': name,
                'current_cost': cost,
                'estimated_savings': est_savings,
                'savings_pct': int(template['savings_pct'] * 100),
                'priority': priority,
                'category': 'Service Optimization',
                'actions': template['actions'],
                'impact': f'Reduce {name} from ${cost}/mo to ~${round(cost - est_savings, 2)}/mo'
            })

    # Add resource-level recommendations if scan data available
    if scan_data:
        ec2 = scan_data.get('ec2', {}).get('resources', [])
        for inst in ec2:
            if inst.get('status') == 'IDLE' and inst.get('potential_savings', 0) > 0:
                recs.append({
                    'id': f'aws-ec2-{inst["id"]}',
                    'cloud': 'AWS',
                    'service': 'Amazon EC2',
                    'resource_id': inst['id'],
                    'resource_name': inst.get('name', inst['id']),
                    'private_ip': inst.get('private_ip', ''),
                    'current_cost': inst['monthly_cost'],
                    'estimated_savings': inst['potential_savings'],
                    'savings_pct': int((inst['potential_savings'] / inst['monthly_cost']) * 100) if inst['monthly_cost'] else 0,
                    'priority': 'HIGH',
                    'category': 'Idle Resource',
                    'actions': [
                        f'Instance {inst["id"]} ({inst.get("type","")}) has avg CPU of {inst.get("avg_cpu",0)}% over 7 days',
                        f'Action: Stop the instance immediately to save ${inst["potential_savings"]}/mo',
                        f'If needed occasionally: use Instance Scheduler to auto-start/stop',
                        f'If not needed: terminate and delete attached EBS volumes',
                    ],
                    'impact': f'Stop {inst.get("name", inst["id"])} → save ${inst["potential_savings"]}/mo'
                })

    recs.sort(key=lambda x: x['estimated_savings'], reverse=True)
    total_savings = round(sum(r['estimated_savings'] for r in recs), 2)

    return {
        'recommendations': recs,
        'total_current_spend': round(total, 2),
        'total_estimated_savings': total_savings,
        'savings_percentage': round((total_savings / total * 100) if total else 0, 1),
        'count': len(recs),
        'high_priority': len([r for r in recs if r['priority'] == 'HIGH']),
    }

def generate_gcp_recommendations(cost_data):
    """Generate actionable recommendations from GCP cost data."""
    recs = []
    if not cost_data or not cost_data.get('monthly'):
        return {'recommendations': [], 'total_estimated_savings': 0}

    latest = cost_data['monthly'][-1] if cost_data['monthly'] else {}
    services = latest.get('services', [])
    total = latest.get('total', 0)

    for svc in services:
        name = svc['service']
        cost = svc['cost']
        if cost <= 0:
            continue

        matched_key = None
        for key in GCP_SERVICE_RECS:
            if key.lower() in name.lower() or name.lower() in key.lower():
                matched_key = key
                break

        if matched_key:
            template = GCP_SERVICE_RECS[matched_key]
            est_savings = round(cost * template['savings_pct'], 2)
            priority = 'HIGH' if cost > 200 else 'MEDIUM' if cost > 50 else 'LOW'
            recs.append({
                'id': f'gcp-{name.lower().replace(" ","-")}',
                'cloud': 'GCP',
                'service': name,
                'current_cost': cost,
                'estimated_savings': est_savings,
                'savings_pct': int(template['savings_pct'] * 100),
                'priority': priority,
                'category': 'Service Optimization',
                'actions': template['actions'],
                'impact': f'Reduce {name} from ${cost}/mo to ~${round(cost - est_savings, 2)}/mo'
            })

    recs.sort(key=lambda x: x['estimated_savings'], reverse=True)
    total_savings = round(sum(r['estimated_savings'] for r in recs), 2)

    return {
        'recommendations': recs,
        'total_current_spend': round(total, 2),
        'total_estimated_savings': total_savings,
        'savings_percentage': round((total_savings / total * 100) if total else 0, 1),
        'count': len(recs),
        'high_priority': len([r for r in recs if r['priority'] == 'HIGH']),
    }

def apply_currency(recs_result, currency='USD'):
    """Apply correct currency symbol to all savings amounts in recommendations."""
    if currency == 'USD':
        return recs_result
    sym = {'INR':'₹','EUR':'€','GBP':'£','AUD':'A$','CAD':'C$'}.get(currency, currency+' ')
    # Just tag each recommendation with currency for frontend to handle
    recs = recs_result.get('recommendations', [])
    for r in recs:
        r['currency'] = currency
        r['currency_symbol'] = sym
    recs_result['currency'] = currency
    recs_result['currency_symbol'] = sym
    return recs_result
