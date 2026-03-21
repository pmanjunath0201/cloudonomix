"""AWS service — returns real data only. Raises ValueError if not configured."""
import boto3
from datetime import datetime, timedelta

def _ce(t):
    return boto3.client('ce',
        aws_access_key_id=t.aws_access_key,
        aws_secret_access_key=t.aws_secret_key,
        region_name=t.aws_region or 'us-east-1')

def _ec2(t):
    return boto3.client('ec2',
        aws_access_key_id=t.aws_access_key,
        aws_secret_access_key=t.aws_secret_key,
        region_name=t.aws_region or 'us-east-1')

def _cw(t):
    return boto3.client('cloudwatch',
        aws_access_key_id=t.aws_access_key,
        aws_secret_access_key=t.aws_secret_key,
        region_name=t.aws_region or 'us-east-1')

def _rds(t):
    return boto3.client('rds',
        aws_access_key_id=t.aws_access_key,
        aws_secret_access_key=t.aws_secret_key,
        region_name=t.aws_region or 'us-east-1')

def _s3(t):
    return boto3.client('s3',
        aws_access_key_id=t.aws_access_key,
        aws_secret_access_key=t.aws_secret_key,
        region_name=t.aws_region or 'us-east-1')

def _cw_avg(cw, namespace, metric, dims, days=7):
    end   = datetime.utcnow()
    start = end - timedelta(days=days)
    r = cw.get_metric_statistics(
        Namespace=namespace, MetricName=metric,
        Dimensions=dims, StartTime=start, EndTime=end,
        Period=86400, Statistics=['Average'])
    pts = r.get('Datapoints', [])
    return round(sum(d['Average'] for d in pts)/len(pts), 2) if pts else 0.0

HOURLY = {
    't2.micro':0.0116,'t2.small':0.023,'t2.medium':0.0464,'t2.large':0.0928,
    't3.micro':0.0104,'t3.small':0.0208,'t3.medium':0.0416,'t3.large':0.0832,
    't3.xlarge':0.1664,'t3.2xlarge':0.3328,
    'm5.large':0.096,'m5.xlarge':0.192,'m5.2xlarge':0.384,'m5.4xlarge':0.768,
    'm6i.large':0.096,'m6i.xlarge':0.192,
    'r5.large':0.126,'r5.xlarge':0.252,'r5.2xlarge':0.504,
    'c5.large':0.085,'c5.xlarge':0.17,'c5.2xlarge':0.34,
}
DOWNSIZE = {
    't3.2xlarge':'t3.xlarge','t3.xlarge':'t3.large','t3.large':'t3.medium',
    't3.medium':'t3.small','m5.4xlarge':'m5.2xlarge','m5.2xlarge':'m5.xlarge',
    'm5.xlarge':'m5.large','r5.2xlarge':'r5.xlarge','r5.xlarge':'r5.large',
    'c5.2xlarge':'c5.xlarge','c5.xlarge':'c5.large',
}

def get_cost_summary(tenant):
    if not tenant.aws_ok:
        raise ValueError("AWS not configured")
    ce   = _ce(tenant)
    end  = datetime.today().strftime('%Y-%m-%d')
    start= (datetime.today()-timedelta(days=180)).strftime('%Y-%m-%d')
    r = ce.get_cost_and_usage(
        TimePeriod={'Start':start,'End':end},
        Granularity='MONTHLY',
        Metrics=['BlendedCost'],
        GroupBy=[{'Type':'DIMENSION','Key':'SERVICE'}])
    periods = r.get('ResultsByTime',[])
    monthly = []
    for p in periods:
        total = sum(float(g['Metrics']['BlendedCost']['Amount']) for g in p.get('Groups',[]))
        services = [{'service':g['Keys'][0],'cost':round(float(g['Metrics']['BlendedCost']['Amount']),2)} for g in p.get('Groups',[]) if float(g['Metrics']['BlendedCost']['Amount'])>0]
        services.sort(key=lambda x:x['cost'],reverse=True)
        monthly.append({'month':p['TimePeriod']['Start'][:7],'total':round(total,2),'services':services})
    return monthly

def get_cost_by_region(tenant):
    if not tenant.aws_ok:
        raise ValueError("AWS not configured")
    ce   = _ce(tenant)
    end  = datetime.today().strftime('%Y-%m-%d')
    start= (datetime.today()-timedelta(days=30)).strftime('%Y-%m-%d')
    r = ce.get_cost_and_usage(
        TimePeriod={'Start':start,'End':end},
        Granularity='MONTHLY', Metrics=['BlendedCost'],
        GroupBy=[{'Type':'DIMENSION','Key':'REGION'}])
    result = []
    for p in r.get('ResultsByTime',[]):
        for g in p.get('Groups',[]):
            c = round(float(g['Metrics']['BlendedCost']['Amount']),2)
            if c > 0:
                result.append({'region':g['Keys'][0] or 'global','cost':c})
    result.sort(key=lambda x:x['cost'],reverse=True)
    return result

def scan_ec2(tenant):
    if not tenant.aws_ok:
        raise ValueError("AWS not configured")
    ec2 = _ec2(tenant)
    cw  = _cw(tenant)
    resp = ec2.describe_instances()
    result = []
    for res in resp['Reservations']:
        for inst in res['Instances']:
            iid   = inst['InstanceId']
            itype = inst['InstanceType']
            state = inst['State']['Name']
            name  = next((t['Value'] for t in inst.get('Tags',[]) if t['Key']=='Name'), iid)
            tags  = {t['Key']:t['Value'] for t in inst.get('Tags',[])}
            priv  = inst.get('PrivateIpAddress','')
            pub   = inst.get('PublicIpAddress','')
            az    = inst['Placement']['AvailabilityZone']
            hourly= HOURLY.get(itype, 0.10)
            monthly=round(hourly*730,2)

            avg_cpu = _cw_avg(cw,'AWS/EC2','CPUUtilization',[{'Name':'InstanceId','Value':iid}]) if state=='running' else 0.0
            avg_net = 0.0
            if state == 'running':
                try:
                    avg_net = round(_cw_avg(cw,'AWS/EC2','NetworkIn',[{'Name':'InstanceId','Value':iid}])/(1024*1024),2)
                except: pass

            if state == 'stopped':
                status='STOPPED'; rec='Instance stopped — EBS volumes still billing. Terminate if no longer needed.'; savings=round(monthly*0.05,2); rec_type=None
            elif avg_cpu < 5.0 and state=='running':
                status='IDLE'; rec_type=DOWNSIZE.get(itype)
                savings=round((hourly-HOURLY.get(rec_type,hourly*0.5))*730,2) if rec_type else round(monthly*0.6,2)
                rec=f'CPU avg {avg_cpu}% over 7 days. {"Rightsize to "+rec_type if rec_type else "Consider stopping — heavily underutilized."}'
            elif avg_cpu > 85.0:
                status='OVERLOADED'; rec=f'CPU avg {avg_cpu}% — risk of performance issues. Consider scaling up.'; savings=0; rec_type=None
            else:
                status='HEALTHY'; rec='Resource is well utilized.'; savings=0; rec_type=None

            result.append({
                'id':iid,'name':name,'type':itype,'state':state,
                'private_ip':priv,'public_ip':pub,'az':az,'region':tenant.aws_region,
                'avg_cpu':avg_cpu,'avg_network_mb':avg_net,
                'monthly_cost':monthly,'status':status,
                'recommendation':rec,'recommended_type':rec_type,
                'potential_savings':savings,'tags':tags
            })
    return result

def scan_ebs(tenant):
    if not tenant.aws_ok:
        raise ValueError("AWS not configured")
    ec2  = _ec2(tenant)
    vols = ec2.describe_volumes()['Volumes']
    result = []
    for v in vols:
        name    = next((t['Value'] for t in v.get('Tags',[]) if t['Key']=='Name'), v['VolumeId'])
        monthly = round(v['Size']*0.10,2)
        attached= v['Attachments'][0]['InstanceId'] if v['Attachments'] else None
        status  = 'HEALTHY' if attached else 'UNATTACHED'
        rec     = 'In use.' if attached else f'Unattached {v["Size"]}GB volume — snapshot and delete to save ${monthly}/mo'
        result.append({
            'id':v['VolumeId'],'name':name,'size_gb':v['Size'],
            'type':v['VolumeType'],'state':v['State'],
            'attached_to':attached,'monthly_cost':monthly,
            'status':status,'recommendation':rec,
            'potential_savings':0 if attached else monthly
        })
    return result

def scan_rds(tenant):
    if not tenant.aws_ok:
        raise ValueError("AWS not configured")
    rds  = _rds(tenant)
    cw   = _cw(tenant)
    dbs  = rds.describe_db_instances()['DBInstances']
    result = []
    for db in dbs:
        did    = db['DBInstanceIdentifier']
        engine = f"{db['Engine']} {db['EngineVersion']}"
        cls    = db['DBInstanceClass']
        # rough monthly estimate
        cls_cost = {'db.t3.micro':13,'db.t3.small':26,'db.t3.medium':52,'db.t3.large':104,
                    'db.m5.large':138,'db.m5.xlarge':276,'db.r5.large':175}
        monthly = cls_cost.get(cls, 100)
        avg_cpu = _cw_avg(cw,'AWS/RDS','CPUUtilization',[{'Name':'DBInstanceIdentifier','Value':did}])
        status  = 'IDLE' if avg_cpu < 10 else 'HEALTHY'
        rec     = f'CPU avg {avg_cpu}% — consider smaller instance class to save ~30%' if status=='IDLE' else 'Well utilized.'
        savings = round(monthly*0.3,2) if status=='IDLE' else 0
        result.append({
            'id':did,'engine':engine,'class':cls,'status':db['DBInstanceStatus'],
            'multi_az':db.get('MultiAZ',False),
            'storage_gb':db.get('AllocatedStorage',0),
            'endpoint':db.get('Endpoint',{}).get('Address',''),
            'monthly_cost':monthly,'avg_cpu':avg_cpu,
            'resource_status':status,'recommendation':rec,'potential_savings':savings
        })
    return result

def scan_s3(tenant):
    if not tenant.aws_ok:
        raise ValueError("AWS not configured")
    s3 = _s3(tenant)
    cw = _cw(tenant)
    buckets = s3.list_buckets()['Buckets']
    result  = []
    for b in buckets:
        name = b['Name']
        try:
            size_bytes = _cw_avg(cw,'AWS/S3','BucketSizeBytes',
                [{'Name':'BucketName','Value':name},{'Name':'StorageType','Value':'StandardStorage'}])
            size_gb = round(size_bytes/(1024**3),2)
            obj_count= int(_cw_avg(cw,'AWS/S3','NumberOfObjects',
                [{'Name':'BucketName','Value':name},{'Name':'StorageType','Value':'AllStorageTypes'}]))
        except:
            size_gb=0; obj_count=0
        monthly = round(size_gb*0.023,2)
        status  = 'COLD' if size_gb>100 and obj_count>0 else 'HEALTHY'
        rec     = 'Consider S3 Intelligent-Tiering or Glacier for infrequently accessed data.' if status=='COLD' else 'OK'
        savings = round(monthly*0.6,2) if status=='COLD' else 0
        try:
            region = s3.get_bucket_location(Bucket=name)['LocationConstraint'] or 'us-east-1'
        except:
            region = 'unknown'
        result.append({
            'name':name,'region':region,'size_gb':size_gb,
            'object_count':obj_count,'monthly_cost':monthly,
            'status':status,'recommendation':rec,'potential_savings':savings
        })
    return result

def detect_anomalies(tenant):
    if not tenant.aws_ok:
        raise ValueError("AWS not configured")
    monthly = get_cost_summary(tenant)
    if len(monthly) < 2:
        return []
    prev = {s['service']:s['cost'] for s in monthly[-2]['services']}
    curr = {s['service']:s['cost'] for s in monthly[-1]['services']}
    anomalies = []
    for svc,amt in curr.items():
        p = prev.get(svc,0)
        if p > 0:
            pct = ((amt-p)/p)*100
            if pct > 30:
                sev = 'CRITICAL' if pct>100 else 'HIGH' if pct>50 else 'MEDIUM'
                anomalies.append({
                    'service':svc,'current':round(amt,2),'previous':round(p,2),
                    'change_pct':round(pct,1),'change_amt':round(amt-p,2),
                    'severity':sev,
                    'message':f'{svc} increased {pct:.1f}% (${amt-p:.2f}) vs last month'
                })
    anomalies.sort(key=lambda x:x['change_pct'],reverse=True)
    return anomalies

# ── Cached wrappers ────────────────────────────────────────────────────────────

def get_cost_summary_cached(tenant):
    """get_cost_summary with 10-minute cache."""
    from services.cache import get as cache_get, set as cache_set
    key = f"t{tenant.id}:aws:cost_summary"
    cached = cache_get(key)
    if cached is not None:
        return cached
    result = get_cost_summary(tenant)
    cache_set(key, result, ttl_seconds=600)
    return result

def get_cost_by_region_cached(tenant):
    from services.cache import get as cache_get, set as cache_set
    key = f"t{tenant.id}:aws:regions"
    cached = cache_get(key)
    if cached is not None:
        return cached
    result = get_cost_by_region(tenant)
    cache_set(key, result, ttl_seconds=600)
    return result

def scan_ec2_cached(tenant):
    from services.cache import get as cache_get, set as cache_set
    key = f"t{tenant.id}:aws:ec2"
    cached = cache_get(key)
    if cached is not None:
        return cached
    result = scan_ec2(tenant)
    cache_set(key, result, ttl_seconds=600)
    return result

def scan_ebs_cached(tenant):
    from services.cache import get as cache_get, set as cache_set
    key = f"t{tenant.id}:aws:ebs"
    cached = cache_get(key)
    if cached is not None:
        return cached
    result = scan_ebs(tenant)
    cache_set(key, result, ttl_seconds=600)
    return result

def scan_rds_cached(tenant):
    from services.cache import get as cache_get, set as cache_set
    key = f"t{tenant.id}:aws:rds"
    cached = cache_get(key)
    if cached is not None:
        return cached
    result = scan_rds(tenant)
    cache_set(key, result, ttl_seconds=600)
    return result

def scan_s3_cached(tenant):
    from services.cache import get as cache_get, set as cache_set
    key = f"t{tenant.id}:aws:s3"
    cached = cache_get(key)
    if cached is not None:
        return cached
    result = scan_s3(tenant)
    cache_set(key, result, ttl_seconds=600)
    return result

def detect_anomalies_cached(tenant):
    from services.cache import get as cache_get, set as cache_set
    key = f"t{tenant.id}:aws:anomalies"
    cached = cache_get(key)
    if cached is not None:
        return cached
    result = detect_anomalies(tenant)
    cache_set(key, result, ttl_seconds=600)
    return result
