from database import db
from datetime import datetime
import bcrypt

class Tenant(db.Model):
    __tablename__ = 'tenants'
    id            = db.Column(db.Integer, primary_key=True)
    name          = db.Column(db.String(120), nullable=False)
    slug          = db.Column(db.String(80),  unique=True, nullable=False)
    plan          = db.Column(db.String(20),  default='starter')
    active        = db.Column(db.Boolean,     default=True)
    created_at    = db.Column(db.DateTime,    default=datetime.utcnow)

    # ── Credentials stored ENCRYPTED in DB ────────────────────────────────────
    # Never access these _enc columns directly — use the property accessors below
    _aws_access_key     = db.Column('aws_access_key',     db.String(500))
    _aws_secret_key     = db.Column('aws_secret_key',     db.String(500))
    aws_region          = db.Column(db.String(50),        default='us-east-1')
    _gcp_project_id     = db.Column('gcp_project_id',     db.String(500))
    _gcp_service_account= db.Column('gcp_service_account',db.Text)
    _azure_subscription_id = db.Column('azure_subscription_id', db.String(500))
    _azure_tenant_id       = db.Column('azure_tenant_id',       db.String(500))
    _azure_client_id       = db.Column('azure_client_id',       db.String(500))
    _azure_client_secret   = db.Column('azure_client_secret',   db.String(500))

    slack_webhook_url = db.Column(db.String(500), nullable=True)  # Slack integration

    users  = db.relationship('User',  back_populates='tenant', cascade='all,delete-orphan')
    alerts = db.relationship('Alert', back_populates='tenant', cascade='all,delete-orphan')

    # ── AWS Properties — auto encrypt on set, auto decrypt on get ─────────────
    @property
    def aws_access_key(self):
        from services.encryption import decrypt
        return decrypt(self._aws_access_key or '')

    @aws_access_key.setter
    def aws_access_key(self, value):
        from services.encryption import encrypt
        self._aws_access_key = encrypt(value) if value else None

    @property
    def aws_secret_key(self):
        from services.encryption import decrypt
        return decrypt(self._aws_secret_key or '')

    @aws_secret_key.setter
    def aws_secret_key(self, value):
        from services.encryption import encrypt
        self._aws_secret_key = encrypt(value) if value else None

    # ── GCP Properties ─────────────────────────────────────────────────────────
    @property
    def gcp_project_id(self):
        from services.encryption import decrypt
        return decrypt(self._gcp_project_id or '')

    @gcp_project_id.setter
    def gcp_project_id(self, value):
        from services.encryption import encrypt
        self._gcp_project_id = encrypt(value) if value else None

    @property
    def gcp_service_account(self):
        from services.encryption import decrypt
        return decrypt(self._gcp_service_account or '')

    @gcp_service_account.setter
    def gcp_service_account(self, value):
        from services.encryption import encrypt
        self._gcp_service_account = encrypt(value) if value else None

    # ── Azure Properties ────────────────────────────────────────────────────────
    @property
    def azure_subscription_id(self):
        from services.encryption import decrypt
        return decrypt(self._azure_subscription_id or '')

    @azure_subscription_id.setter
    def azure_subscription_id(self, value):
        from services.encryption import encrypt
        self._azure_subscription_id = encrypt(value) if value else None

    @property
    def azure_tenant_id(self):
        from services.encryption import decrypt
        return decrypt(self._azure_tenant_id or '')

    @azure_tenant_id.setter
    def azure_tenant_id(self, value):
        from services.encryption import encrypt
        self._azure_tenant_id = encrypt(value) if value else None

    @property
    def azure_client_id(self):
        from services.encryption import decrypt
        return decrypt(self._azure_client_id or '')

    @azure_client_id.setter
    def azure_client_id(self, value):
        from services.encryption import encrypt
        self._azure_client_id = encrypt(value) if value else None

    @property
    def azure_client_secret(self):
        from services.encryption import decrypt
        return decrypt(self._azure_client_secret or '')

    @azure_client_secret.setter
    def azure_client_secret(self, value):
        from services.encryption import encrypt
        self._azure_client_secret = encrypt(value) if value else None

    # ── Connection status ──────────────────────────────────────────────────────
    @property
    def aws_ok(self):
        return bool(self._aws_access_key and self._aws_secret_key)

    @property
    def gcp_ok(self):
        return bool(self._gcp_project_id and self._gcp_service_account)

    @property
    def azure_ok(self):
        return bool(self._azure_subscription_id and self._azure_client_id and self._azure_client_secret)


class User(db.Model):
    __tablename__ = 'users'
    id          = db.Column(db.Integer,  primary_key=True)
    tenant_id   = db.Column(db.Integer,  db.ForeignKey('tenants.id'), nullable=False)
    email       = db.Column(db.String(200), nullable=False)
    name        = db.Column(db.String(120))
    role        = db.Column(db.String(30),  default='member')
    pw_hash     = db.Column(db.String(250), nullable=False)
    is_verified = db.Column(db.Boolean,  default=False)
    verified_at = db.Column(db.DateTime, nullable=True)
    created_at  = db.Column(db.DateTime, default=datetime.utcnow)
    tenant      = db.relationship('Tenant', back_populates='users')
    __table_args__ = (db.UniqueConstraint('tenant_id', 'email'),)

    def set_password(self, pw):
        self.pw_hash = bcrypt.hashpw(pw.encode(), bcrypt.gensalt()).decode()

    def check_password(self, pw):
        return bcrypt.checkpw(pw.encode(), self.pw_hash.encode())

    @property
    def can_manage(self):
        return self.role in ('owner', 'superadmin')


class Alert(db.Model):
    __tablename__ = 'alerts'
    id            = db.Column(db.Integer, primary_key=True)
    tenant_id     = db.Column(db.Integer, db.ForeignKey('tenants.id'), nullable=False)
    name          = db.Column(db.String(120), nullable=False)
    threshold     = db.Column(db.Float,  nullable=False)
    email         = db.Column(db.String(200), nullable=False)
    service       = db.Column(db.String(100), default='ALL')
    cloud         = db.Column(db.String(20),  default='ALL')
    active        = db.Column(db.Boolean, default=True)
    last_triggered= db.Column(db.DateTime, nullable=True)
    last_spend    = db.Column(db.Float,    nullable=True)
    trigger_count = db.Column(db.Integer,  default=0)
    created_at    = db.Column(db.DateTime, default=datetime.utcnow)
    tenant        = db.relationship('Tenant', back_populates='alerts')


class AlertLog(db.Model):
    __tablename__  = 'alert_logs'
    id             = db.Column(db.Integer, primary_key=True)
    alert_id       = db.Column(db.Integer, db.ForeignKey('alerts.id', ondelete='CASCADE'))
    tenant_id      = db.Column(db.Integer, db.ForeignKey('tenants.id', ondelete='CASCADE'))
    tenant_name    = db.Column(db.String(120))
    alert_name     = db.Column(db.String(120))
    service        = db.Column(db.String(100))
    cloud          = db.Column(db.String(20))
    threshold      = db.Column(db.Float)
    actual_spend   = db.Column(db.Float)
    email_sent_to  = db.Column(db.String(200))
    sent_at        = db.Column(db.DateTime, default=datetime.utcnow)
    status         = db.Column(db.String(20), default='sent')
    error_msg      = db.Column(db.Text, nullable=True)


class TrialConfig(db.Model):
    __tablename__  = 'trial_configs'
    id             = db.Column(db.Integer, primary_key=True)
    tenant_id      = db.Column(db.Integer, db.ForeignKey('tenants.id'), unique=True)
    trial_days     = db.Column(db.Integer, default=30)
    trial_start    = db.Column(db.DateTime, default=datetime.utcnow)
    trial_end      = db.Column(db.DateTime)
    is_expired     = db.Column(db.Boolean, default=False)
    expired_at     = db.Column(db.DateTime, nullable=True)
    warning_sent_7 = db.Column(db.Boolean, default=False)
    warning_sent_1 = db.Column(db.Boolean, default=False)
    expiry_sent    = db.Column(db.Boolean, default=False)

    def __init__(self, tenant_id, trial_days=30):
        from datetime import timedelta
        self.tenant_id   = tenant_id
        self.trial_days  = trial_days
        self.trial_start = datetime.utcnow()
        self.trial_end   = datetime.utcnow() + timedelta(days=trial_days)

    @property
    def days_remaining(self):
        if self.is_expired:
            return 0
        delta = self.trial_end - datetime.utcnow()
        return max(0, delta.days)

    @property
    def is_active(self):
        return not self.is_expired and datetime.utcnow() < self.trial_end
