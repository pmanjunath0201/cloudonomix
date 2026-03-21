"""
Azure service — real data, with currency detection and caching.
Azure Cost Management API rate limit: ~30 requests/hour.
Cache TTL: 10 minutes to prevent 429 errors.
"""
from datetime import datetime, timedelta
import time

def _credential(tenant):
    from azure.identity import ClientSecretCredential
    return ClientSecretCredential(
        tenant_id=tenant.azure_tenant_id,
        client_id=tenant.azure_client_id,
        client_secret=tenant.azure_client_secret)

def _call_with_retry(fn, retries=3, wait=10):
    from azure.core.exceptions import HttpResponseError
    for attempt in range(retries):
        try:
            return fn()
        except HttpResponseError as e:
            if e.status_code == 429:
                wait_time = wait * (2 ** attempt)
                print(f"[Azure] 429 — waiting {wait_time}s (retry {attempt+1}/{retries})")
                time.sleep(wait_time)
                if attempt == retries - 1:
                    raise ValueError(
                        "Azure API rate limit (429). Data is cached for 10 minutes. "
                        "Please wait a moment and refresh."
                    )
            else:
                raise
        except Exception as e:
            raise ValueError(str(e))

def _get_billing_currency(tenant):
    """Detect the billing currency from Azure subscription."""
    try:
        from azure.mgmt.billing import BillingManagementClient
        cred   = _credential(tenant)
        client = BillingManagementClient(cred)
        accounts = list(client.billing_accounts.list())
        if accounts:
            props = accounts[0].additional_properties or {}
            return props.get('billingProfiles', [{}])[0].get('currency', 'USD')
    except:
        pass
    # Fallback: try to detect from subscription location
    try:
        from azure.mgmt.resource import SubscriptionClient
        cred   = _credential(tenant)
        client = SubscriptionClient(cred)
        for sub in client.subscriptions.list():
            if sub.subscription_id == tenant.azure_subscription_id:
                # India subscriptions use INR
                loc = getattr(sub, 'display_name', '') or ''
                return 'USD'  # default, actual currency comes from cost data
    except:
        pass
    return 'USD'

def get_cost_summary(tenant):
    """Fetch Azure cost data. Cached for 10 minutes. Returns currency with data."""
    if not tenant.azure_ok:
        raise ValueError("Azure not configured")

    from services.cache import get as cache_get, set as cache_set
    cache_key = f"t{tenant.id}:azure:cost_summary"
    cached = cache_get(cache_key)
    if cached is not None:
        print(f"[Azure Cache HIT] tenant {tenant.id}")
        return cached

    try:
        from azure.mgmt.costmanagement import CostManagementClient
        from azure.mgmt.costmanagement.models import (
            QueryDefinition, QueryTimePeriod, QueryDataset,
            QueryAggregation, QueryGrouping, TimeframeType)

        cred   = _credential(tenant)
        client = CostManagementClient(cred)
        scope  = f"/subscriptions/{tenant.azure_subscription_id}"
        end    = datetime.utcnow()
        start  = end - timedelta(days=180)

        query = QueryDefinition(
            type='ActualCost',
            timeframe=TimeframeType.CUSTOM,
            time_period=QueryTimePeriod(from_property=start, to=end),
            dataset=QueryDataset(
                granularity='Monthly',
                aggregation={'totalCost': QueryAggregation(name='Cost', function='Sum')},
                grouping=[QueryGrouping(type='Dimension', name='ServiceName')]
            )
        )

        def do_query():
            return client.query.usage(scope=scope, parameters=query)

        result = _call_with_retry(do_query)

        monthly  = {}
        cols     = [c.name for c in result.columns]
        cost_i   = cols.index('Cost')
        svc_i    = cols.index('ServiceName')
        currency = 'USD'

        # Detect currency column
        if 'Currency' in cols:
            cur_i = cols.index('Currency')
        else:
            cur_i = None

        # Detect month column
        month_col = next((c for c in ['BillingMonth','UsageDate','BillingPeriodStartDate'] if c in cols), None)
        month_i   = cols.index(month_col) if month_col else None

        for row in result.rows:
            raw_month = str(row[month_i])[:7] if month_i is not None else datetime.utcnow().strftime('%Y-%m')
            svc       = str(row[svc_i])
            cost      = round(float(row[cost_i]), 2)
            if cur_i is not None and row[cur_i]:
                currency = str(row[cur_i])
            if cost <= 0:
                continue
            if raw_month not in monthly:
                monthly[raw_month] = {'month': raw_month, 'total': 0, 'services': [], 'currency': currency}
            monthly[raw_month]['services'].append({'service': svc, 'cost': cost})
            monthly[raw_month]['total'] = round(monthly[raw_month]['total'] + cost, 2)

        result_list = sorted(monthly.values(), key=lambda x: x['month'])
        # Tag each period with currency
        for p in result_list:
            p['currency'] = currency

        cache_set(cache_key, result_list, ttl_seconds=600)
        return result_list

    except ValueError:
        raise
    except Exception as e:
        raise ValueError(f"Azure cost query failed: {str(e)}")

def get_cost_by_service(tenant):
    if not tenant.azure_ok:
        raise ValueError("Azure not configured")
    summary = get_cost_summary(tenant)
    if not summary:
        return []
    return sorted(summary[-1]['services'], key=lambda x: x['cost'], reverse=True)

def get_resources(tenant):
    if not tenant.azure_ok:
        raise ValueError("Azure not configured")
    from services.cache import get as cache_get, set as cache_set
    cache_key = f"t{tenant.id}:azure:resources"
    cached = cache_get(cache_key)
    if cached is not None:
        return cached
    try:
        from azure.mgmt.resource import ResourceManagementClient
        cred   = _credential(tenant)
        client = ResourceManagementClient(cred, tenant.azure_subscription_id)
        resources = []
        for g in [grp.name for grp in client.resource_groups.list()][:5]:
            for r in client.resources.list_by_resource_group(g):
                resources.append({'id':r.id,'name':r.name,'type':r.type,'location':r.location,'group':g})
        cache_set(cache_key, resources, ttl_seconds=600)
        return resources
    except Exception as e:
        raise ValueError(f"Azure resources error: {str(e)}")

def get_vm_details(tenant):
    if not tenant.azure_ok:
        raise ValueError("Azure not configured")
    from services.cache import get as cache_get, set as cache_set
    cache_key = f"t{tenant.id}:azure:vms"
    cached = cache_get(cache_key)
    if cached is not None:
        return cached
    try:
        from azure.mgmt.compute import ComputeManagementClient
        from azure.mgmt.monitor import MonitorManagementClient
        cred    = _credential(tenant)
        compute = ComputeManagementClient(cred, tenant.azure_subscription_id)
        monitor = MonitorManagementClient(cred, tenant.azure_subscription_id)
        VM_COST = {
            'Standard_B1s':7.59,'Standard_B1ms':15.26,'Standard_B2s':30.37,'Standard_B2ms':60.74,
            'Standard_B4ms':121.47,'Standard_B2ats_v2':30.37,'Standard_B2ats v2':30.37,
            'Standard_D2s_v3':96.36,'Standard_D4s_v3':192.72,'Standard_D2s_v4':96.36,
            'Standard_F2s_v2':84.68,'Standard_E2s_v3':126.28,
        }
        vms    = list(compute.virtual_machines.list_all())
        result = []
        for vm in vms[:20]:
            vsize   = vm.hardware_profile.vm_size if vm.hardware_profile else 'Unknown'
            monthly = VM_COST.get(vsize, 80.0)
            parts   = vm.id.split('/')
            rg      = parts[4] if len(parts) > 4 else 'unknown'
            avg_cpu = 0.0
            try:
                end   = datetime.utcnow()
                start = end - timedelta(days=7)
                m     = monitor.metrics.list(
                    vm.id,
                    timespan=f"{start.isoformat()}/{end.isoformat()}",
                    interval='P1D', metricnames='Percentage CPU', aggregation='Average')
                vals = [dp.average for met in m.value for ts in met.timeseries for dp in ts.data if dp.average is not None]
                avg_cpu = round(sum(vals)/len(vals), 2) if vals else 0.0
            except: pass

            if avg_cpu > 0 and avg_cpu < 5.0:
                status='IDLE'; savings=round(monthly*0.5,2)
                rec=f'Avg CPU {avg_cpu}% over 7 days — stop or downsize to save ~{savings}/mo'
            elif avg_cpu > 85:
                status='OVERLOADED'; savings=0; rec=f'CPU avg {avg_cpu}% — consider scaling up'
            else:
                status='HEALTHY'; savings=0; rec='Well utilized'

            result.append({'id':vm.name,'name':vm.name,'size':vsize,'location':vm.location,
                           'resource_group':rg,'state':vm.provisioning_state or 'Unknown',
                           'avg_cpu':avg_cpu,'monthly_cost':monthly,'status':status,
                           'recommendation':rec,'potential_savings':savings})

        result.sort(key=lambda x: x['potential_savings'], reverse=True)
        output = {'resources':result,'summary':{'total':len(result),
                  'idle':len([r for r in result if r['status']=='IDLE']),
                  'total_savings':round(sum(r['potential_savings'] for r in result),2)}}
        cache_set(cache_key, output, ttl_seconds=600)
        return output
    except Exception as e:
        raise ValueError(f"Azure VM scan error: {str(e)}")

def get_storage_details(tenant):
    if not tenant.azure_ok:
        raise ValueError("Azure not configured")
    from services.cache import get as cache_get, set as cache_set
    cache_key = f"t{tenant.id}:azure:storage"
    cached = cache_get(cache_key)
    if cached is not None:
        return cached
    try:
        from azure.mgmt.storage import StorageManagementClient
        cred    = _credential(tenant)
        storage = StorageManagementClient(cred, tenant.azure_subscription_id)
        result  = []
        for acc in list(storage.storage_accounts.list())[:20]:
            parts = acc.id.split('/')
            rg    = parts[4] if len(parts)>4 else 'unknown'
            tier  = str(acc.sku.tier) if acc.sku else 'Standard'
            est   = 20.0
            result.append({'name':acc.name,'location':acc.location,'resource_group':rg,
                           'tier':tier,'kind':str(acc.kind),'estimated_monthly':est,
                           'recommendation':'Enable lifecycle management for cold data archival',
                           'potential_savings':round(est*0.35,2)})
        output = {'resources':result,'summary':{'total':len(result)}}
        cache_set(cache_key, output, ttl_seconds=600)
        return output
    except Exception as e:
        raise ValueError(f"Azure Storage scan error: {str(e)}")
