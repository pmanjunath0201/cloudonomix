# 🚀 Cloudonomix Deployment Guide

## Step 1 — Push to GitHub
```cmd
cd cloudonomix
git init
git add .
git commit -m "Cloudonomix v1.0"
git remote add origin https://github.com/YOURUSERNAME/cloudonomix.git
git push -u origin main
```

## Step 2 — Deploy Backend on Render.com (Free)
1. Go to render.com → Sign up with GitHub
2. New → Blueprint → connect your GitHub repo
3. Render reads render.yaml and sets up everything automatically:
   - Web service (Flask backend)
   - PostgreSQL database (free)
   - Cron job (alert checker — runs every hour)
4. Set these environment variables manually in Render dashboard:
   - ADMIN_PASSWORD = your strong password
   - MAIL_EMAIL = your Gmail address
   - MAIL_PASSWORD = your Gmail App Password (16 chars, no spaces)
   - APP_URL = https://cloudonomix.in (after domain setup)

## Step 3 — Deploy Frontend on Vercel (Free)
1. Go to vercel.com → Sign up with GitHub
2. Import project → select cloudonomix repo
3. Root Directory: frontend
4. Add environment variable:
   - REACT_APP_API_URL = https://cloudonomix-backend.onrender.com
   - REACT_APP_WHATSAPP = 919XXXXXXXXX (your WhatsApp number with country code)
5. Deploy

## Step 4 — Connect Domain (cloudonomix.in)
1. Buy domain on GoDaddy (~₹800/year)
2. In Vercel → Settings → Domains → add cloudonomix.in
3. In GoDaddy DNS → add the CNAME record Vercel shows you
4. Update APP_URL in Render to https://cloudonomix.in

## Step 5 — Set Up Keep-Alive Ping (Free)
Render free tier sleeps after 15 min of inactivity.
Fix: use cron-job.org to ping every 10 minutes.
1. Go to cron-job.org → Sign up free
2. New cron job:
   - URL: https://cloudonomix-backend.onrender.com/api/cron/ping
   - Schedule: every 10 minutes
3. Done — backend stays awake 24/7

## How the Alert System Works After Deployment
```
Render runs this every hour (FREE, automatic):
  → python services/alert_checker.py
  → Loops through ALL client alerts
  → Checks spend vs threshold
  → Sends Gmail alert if exceeded
  → Max 1 email per alert per 24 hours (no spam)
```
No server needed. No VM needed. Runs completely free on Render.

## Admin Credentials
Email:    admin@cloudonomix.io  
Password: set in ADMIN_PASSWORD env var

## Test Alert System Manually
```
curl https://cloudonomix-backend.onrender.com/api/cron/check-alerts \
  -H "X-Cron-Secret: YOUR_CRON_SECRET"
```
