from flask import Flask, jsonify
from flask_cors import CORS
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from dotenv import load_dotenv
import os

load_dotenv()

limiter = Limiter(key_func=get_remote_address, storage_uri="memory://",
                  default_limits=["2000 per hour"])

def create_app():
    app = Flask(__name__)
    app.config['SECRET_KEY']                  = os.getenv('SECRET_KEY') or _abort_missing('SECRET_KEY')
    app.config['SQLALCHEMY_DATABASE_URI']     = os.getenv('DATABASE_URL','sqlite:///cloudonomix.db')
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

    CORS(app, resources={r"/api/*": {
        "origins": os.getenv('ALLOWED_ORIGINS','*').split(',')
    }})

    limiter.init_app(app)

    from database import db
    db.init_app(app)

    from routes.auth            import auth_bp
    from routes.dashboard       import dashboard_bp
    from routes.costs           import costs_bp
    from routes.scanner         import scanner_bp
    from routes.alerts          import alerts_bp
    from routes.admin           import admin_bp
    from routes.recommendations import recs_bp
    from routes.reports         import reports_bp
    from routes.cron            import cron_bp
    from routes.payment         import payment_bp

    app.register_blueprint(auth_bp,      url_prefix='/api/auth')
    app.register_blueprint(dashboard_bp, url_prefix='/api/dashboard')
    app.register_blueprint(costs_bp,     url_prefix='/api/costs')
    app.register_blueprint(scanner_bp,   url_prefix='/api/scanner')
    app.register_blueprint(alerts_bp,    url_prefix='/api/alerts')
    app.register_blueprint(admin_bp,     url_prefix='/api/admin')
    app.register_blueprint(recs_bp,      url_prefix='/api/recommendations')
    app.register_blueprint(reports_bp,   url_prefix='/api/reports')
    app.register_blueprint(cron_bp,      url_prefix='/api/cron')
    app.register_blueprint(payment_bp,   url_prefix='/api/payment')

    # Rate limit error handler
    @app.errorhandler(429)
    def ratelimit_handler(e):
        return jsonify({'error': 'Too many requests. Please slow down.'}), 429

    with app.app_context():
        db.create_all()
        _seed_admin()

    @app.route('/')
    def home():
        return "🚀 Cloudonomix Backend is Running!"
    
    return app

def _abort_missing(key):
    """Crash loudly in production if critical env var not set."""
    env = os.getenv('FLASK_ENV','development')
    if env == 'production':
        raise RuntimeError(f"REQUIRED env var {key} is not set! Check your .env or Render environment variables.")
    return 'dev-insecure-key-change-in-production'

def _seed_admin():
    from models import Tenant, User
    from database import db
    from datetime import datetime
    email = os.getenv('ADMIN_EMAIL','admin@cloudonomix.io')
    pwd   = os.getenv('ADMIN_PASSWORD','admin123')
    existing = User.query.filter_by(email=email).first()
    if existing:
        if not existing.is_verified:
            existing.is_verified = True
            existing.verified_at = datetime.utcnow()
            db.session.commit()
        return
    t = Tenant(name='Cloudonomix Admin', slug='cloudonomix-admin', plan='business')
    db.session.add(t); db.session.flush()
    u = User(tenant_id=t.id, email=email, name='Super Admin', role='superadmin',
             is_verified=True, verified_at=datetime.utcnow())
    u.set_password(pwd)
    db.session.add(u); db.session.commit()
    print(f"[Cloudonomix] Admin → {email} / {pwd}")

if __name__ == '__main__':
    app = create_app()
    app.run(debug=True, host='0.0.0.0', port=5000)
