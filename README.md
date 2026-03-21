# ⬡ Cloudonomix v2 — Cloud Cost Intelligence Platform

Zero fake data. Real AWS, GCP, and Azure costs — with specific actionable savings.

## Quick Start (Windows)

### Backend
```cmd
cd backend
pip install -r requirements.txt
copy .env.example .env
python app.py
```

### Frontend (new terminal)
```cmd
cd frontend
npm install
npm start
```
Open http://localhost:3000

## Admin Login
Email:    admin@cloudonomix.io
Password: admin123

## Features
- Dashboard: Real spend across all clouds + savings banner
- Cost Explorer: 6-month trend + service breakdown per cloud  
- 💡 Savings Center: Specific numbered actions per service (the core value)
- Resource Scanner: Per-VM/IP/CPU analysis with exact savings (AWS)
- Anomaly Detector: Cost spikes across ALL connected clouds
- Multi-Cloud: Side-by-side AWS + GCP + Azure view
- Alerts: Budget threshold alerts with email
- vs Competitors: Why Cloudonomix beats $10,000/mo tools
- Admin Panel: Manage all client tenants

## Cloud Setup

### AWS
IAM → Users → Create User → Attach: ReadOnlyAccess + AWSCostExplorerFullAccess
→ Security Credentials → Create Access Key → Application outside AWS

### GCP  
IAM → Service Accounts → Create → Roles: Billing Account Viewer + Project Viewer
→ Keys → Add Key → JSON → paste in Settings

### Azure
Azure AD → App Registrations → New Registration
→ Certificates & Secrets → New client secret (copy Value)
→ Subscriptions → IAM → Add role: Billing Reader → select your app
→ Paste Subscription ID, Tenant ID, Client ID, Client Secret in Settings
