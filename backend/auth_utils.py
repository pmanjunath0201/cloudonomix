import jwt, os
from datetime import datetime, timedelta
from functools import wraps
from flask import request, jsonify, g
from models import User, Tenant
from database import db

SECRET  = os.getenv('SECRET_KEY', 'dev-secret')
EXPIRY  = int(os.getenv('JWT_EXPIRY_HOURS', 168))  # 7 days default

def generate_token(user_id, tenant_id):
    return jwt.encode(
        {'user_id': user_id, 'tenant_id': tenant_id,
         'exp': datetime.utcnow() + timedelta(hours=EXPIRY)},
        SECRET, algorithm='HS256')

def require_auth(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        auth = request.headers.get('Authorization','')
        if not auth.startswith('Bearer '):
            return jsonify({'error':'Missing token'}), 401
        try:
            payload = jwt.decode(auth.split()[1], SECRET, algorithms=['HS256'])
        except jwt.ExpiredSignatureError:
            return jsonify({'error':'Token expired'}), 401
        except jwt.InvalidTokenError:
            return jsonify({'error':'Invalid token'}), 401
        user   = db.session.get(User,   payload['user_id'])
        tenant = db.session.get(Tenant, payload['tenant_id'])
        if not user or not tenant or not tenant.active:
            return jsonify({'error':'Unauthorized'}), 401
        g.user   = user
        g.tenant = tenant
        return f(*args, **kwargs)
    return decorated

def require_superadmin(f):
    @wraps(f)
    @require_auth
    def decorated(*args, **kwargs):
        if g.user.role != 'superadmin':
            return jsonify({'error':'Superadmin only'}), 403
        return f(*args, **kwargs)
    return decorated
