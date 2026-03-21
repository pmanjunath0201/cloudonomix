"""
One-time migration script — encrypts existing plain text credentials.
Run ONCE after adding ENCRYPTION_KEY to .env:

    python migrate_encrypt.py

Safe to run multiple times — skips already-encrypted values.
"""
from app import create_app
from database import db
from models import Tenant
from services.encryption import encrypt_if_needed

def migrate():
    app = create_app()
    with app.app_context():
        tenants = Tenant.query.all()
        count   = 0

        for tenant in tenants:
            changed = False

            # AWS
            if tenant._aws_access_key:
                new_val = encrypt_if_needed(tenant._aws_access_key)
                if new_val != tenant._aws_access_key:
                    tenant._aws_access_key = new_val; changed = True
            if tenant._aws_secret_key:
                new_val = encrypt_if_needed(tenant._aws_secret_key)
                if new_val != tenant._aws_secret_key:
                    tenant._aws_secret_key = new_val; changed = True

            # GCP
            if tenant._gcp_project_id:
                new_val = encrypt_if_needed(tenant._gcp_project_id)
                if new_val != tenant._gcp_project_id:
                    tenant._gcp_project_id = new_val; changed = True
            if tenant._gcp_service_account:
                new_val = encrypt_if_needed(tenant._gcp_service_account)
                if new_val != tenant._gcp_service_account:
                    tenant._gcp_service_account = new_val; changed = True

            # Azure
            for field in ['_azure_subscription_id','_azure_tenant_id','_azure_client_id','_azure_client_secret']:
                val = getattr(tenant, field)
                if val:
                    new_val = encrypt_if_needed(val)
                    if new_val != val:
                        setattr(tenant, field, new_val); changed = True

            if changed:
                count += 1
                print(f"  ✅ Encrypted credentials for: {tenant.name}")

        db.session.commit()
        print(f"\n✅ Migration complete — encrypted {count} tenant(s)")
        print("   All new credentials will auto-encrypt going forward.")

if __name__ == '__main__':
    print("🔐 Cloudonomix Credential Encryption Migration")
    print("=" * 50)
    migrate()
