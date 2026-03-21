"""
Simple in-memory cache to prevent API rate limit (429) errors.
Azure Cost Management API allows ~30 requests per hour per subscription.
GCP and AWS also have limits — this cache prevents repeated calls.
"""
import time

_cache = {}

def get(key):
    """Return cached value if not expired, else None."""
    if key in _cache:
        value, expires_at = _cache[key]
        if time.time() < expires_at:
            return value
        del _cache[key]
    return None

def set(key, value, ttl_seconds=300):
    """Cache a value for ttl_seconds (default 5 minutes)."""
    _cache[key] = (value, time.time() + ttl_seconds)

def delete(key):
    if key in _cache:
        del _cache[key]

def clear_tenant(tenant_id):
    """Clear all cache entries for a tenant."""
    keys_to_delete = [k for k in _cache if k.startswith(f"t{tenant_id}:")]
    for k in keys_to_delete:
        del _cache[k]

def cached(key_fn, ttl_seconds=300):
    """Decorator factory: cache result of a function call."""
    def decorator(fn):
        def wrapper(*args, **kwargs):
            key = key_fn(*args, **kwargs)
            result = get(key)
            if result is not None:
                print(f"[Cache HIT] {key}")
                return result
            print(f"[Cache MISS] {key} — calling API")
            result = fn(*args, **kwargs)
            set(key, result, ttl_seconds)
            return result
        return wrapper
    return decorator
