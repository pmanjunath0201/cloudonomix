"""GCP service — real data only via google-cloud-billing SDK."""
import json
from datetime import datetime, timedelta

def _billing_client(tenant):
    from google.cloud import billing_v1
    from google.oauth2 import service_account
    info = json.loads(tenant.gcp_service_account)
    creds = service_account.Credentials.from_service_account_info(
        info, scopes=['https://www.googleapis.com/auth/cloud-platform'])
    return billing_v1.CloudBillingClient(credentials=creds)

def _resource_client(tenant):
    from google.cloud import resourcemanager_v3
    from google.oauth2 import service_account
    info = json.loads(tenant.gcp_service_account)
    creds = service_account.Credentials.from_service_account_info(
        info, scopes=['https://www.googleapis.com/auth/cloud-platform'])
    return resourcemanager_v3.ProjectsClient(credentials=creds)

def get_cost_summary(tenant):
    """Fetch GCP billing data via Cloud Billing API."""
    if not tenant.gcp_ok:
        raise ValueError("GCP not configured")
    try:
        from google.cloud import bigquery
        from google.oauth2 import service_account
        info   = json.loads(tenant.gcp_service_account)
        creds  = service_account.Credentials.from_service_account_info(info)
        client = bigquery.Client(project=tenant.gcp_project_id, credentials=creds)
        # Query billing export table if available
        query = f"""
            SELECT
                FORMAT_DATE('%Y-%m', usage_start_time) as month,
                service.description as service,
                SUM(cost) as cost
            FROM `{tenant.gcp_project_id}.billing_export.gcp_billing_export_v1_*`
            WHERE DATE(usage_start_time) >= DATE_SUB(CURRENT_DATE(), INTERVAL 6 MONTH)
            GROUP BY month, service
            ORDER BY month DESC, cost DESC
        """
        rows = list(client.query(query).result())
        monthly = {}
        for r in rows:
            m = r['month']
            if m not in monthly:
                monthly[m] = {'month':m,'total':0,'services':[]}
            monthly[m]['services'].append({'service':r['service'],'cost':round(float(r['cost']),2)})
            monthly[m]['total'] = round(monthly[m]['total']+float(r['cost']),2)
        return sorted(monthly.values(), key=lambda x:x['month'])
    except Exception as e:
        raise ValueError(f"GCP billing query failed: {str(e)}. Ensure BigQuery billing export is enabled.")

def get_projects(tenant):
    if not tenant.gcp_ok:
        raise ValueError("GCP not configured")
    try:
        client = _resource_client(tenant)
        projects = []
        for p in client.list_projects():
            projects.append({'id':p.project_id,'name':p.display_name,'state':p.state.name})
        return projects
    except Exception as e:
        raise ValueError(f"GCP projects error: {str(e)}")

def get_cost_by_service(tenant):
    """Get current month cost by service."""
    if not tenant.gcp_ok:
        raise ValueError("GCP not configured")
    try:
        summary = get_cost_summary(tenant)
        if not summary:
            return []
        latest = summary[-1]
        return sorted(latest['services'], key=lambda x:x['cost'], reverse=True)
    except Exception as e:
        raise ValueError(str(e))

def get_compute_instances(tenant):
    """Scan GCP Compute Engine instances with cost estimates."""
    if not tenant.gcp_ok:
        raise ValueError("GCP not configured")
    from services.cache import get as cache_get, set as cache_set
    cache_key = f"t{tenant.id}:gcp:compute"
    cached = cache_get(cache_key)
    if cached:
        return cached
    try:
        import json
        from google.cloud import compute_v1
        from google.oauth2 import service_account
        info   = json.loads(tenant.gcp_service_account)
        creds  = service_account.Credentials.from_service_account_info(info)
        client = compute_v1.InstancesClient(credentials=creds)
        request = compute_v1.AggregatedListInstancesRequest(project=tenant.gcp_project_id)
        instances = client.aggregated_list(request=request)
        # GCP pricing estimate (USD/month)
        MACHINE_COST = {
            'e2-micro':7.11,'e2-small':14.22,'e2-medium':28.45,
            'e2-standard-2':48.92,'e2-standard-4':97.84,'e2-standard-8':195.68,
            'n1-standard-1':24.27,'n1-standard-2':48.54,'n1-standard-4':97.09,
            'n2-standard-2':56.35,'n2-standard-4':112.71,
            'c2-standard-4':200.12,'c2-standard-8':400.24,
        }
        result = []
        for zone, response in instances:
            for vm in response.instances:
                machine = vm.machine_type.split('/')[-1] if '/' in vm.machine_type else vm.machine_type
                monthly = MACHINE_COST.get(machine, 50.0)
                status  = vm.status
                if status == 'TERMINATED':
                    st = 'STOPPED'; savings = round(monthly * 0.05, 2)
                    rec = 'Instance terminated but still visible — delete if no longer needed'
                elif status == 'RUNNING':
                    st = 'HEALTHY'; savings = 0
                    rec = 'Running — check CPU utilization in Cloud Monitoring for rightsizing'
                else:
                    st = 'UNKNOWN'; savings = 0; rec = f'Status: {status}'
                result.append({
                    'id': vm.name, 'name': vm.name,
                    'machine_type': machine,
                    'zone': zone.replace('zones/',''),
                    'status': st, 'gcp_status': status,
                    'monthly_cost': monthly,
                    'recommendation': rec,
                    'potential_savings': savings,
                })
        result.sort(key=lambda x: x['potential_savings'], reverse=True)
        output = {
            'resources': result,
            'summary': {
                'total': len(result),
                'stopped': len([r for r in result if r['status']=='STOPPED']),
                'total_cost': round(sum(r['monthly_cost'] for r in result), 2),
                'total_savings': round(sum(r['potential_savings'] for r in result), 2),
            }
        }
        cache_set(cache_key, output, ttl_seconds=600)
        return output
    except Exception as e:
        raise ValueError(f"GCP Compute scan failed: {str(e)}")
