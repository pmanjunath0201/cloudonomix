import os
os.environ['SECRET_KEY'] = 'temp-key-123'

from dotenv import load_dotenv
load_dotenv()

from app import create_app
from database import db
from models import Tenant, User
from datetime import datetime

app = create_app()

with app.app_context():
    db.create_all()
    print("Database ready")

    u = User.query.filter_by(email='admin@cloudonomix.io').first()

    if u:
        u.set_password('admin123')
        u.is_verified = True
        u.verified_at = datetime.utcnow()
        u.tenant.active = True
        db.session.commit()
        print("SUCCESS - Admin password reset to: admin123")
    else:
        t = Tenant.query.filter_by(slug='cloudonomix-admin').first()
        if not t:
            t = Tenant(name='Cloudonomix Admin', slug='cloudonomix-admin', plan='business')
            db.session.add(t)
            db.session.flush()

        nu = User(
            tenant_id=t.id,
            email='admin@cloudonomix.io',
            name='Super Admin',
            role='superadmin',
            is_verified=True,
            verified_at=datetime.utcnow()
        )
        nu.set_password('admin123')
        db.session.add(nu)
        db.session.commit()
        print("SUCCESS - Admin user created")

    print("")
    print("Login with:")
    print("  Email:    admin@cloudonomix.io")
    print("  Password: admin123")