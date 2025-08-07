# Email AI Assistant - Deployment Guide

Complete deployment guide for deploying the Email AI Assistant to Google Cloud Platform (GCP) free tier with Vercel frontend hosting.

## 📋 Table of Contents

- [Overview](#overview)
- [Prerequisites](#prerequisites)
- [Architecture](#architecture)
- [Quick Start](#quick-start)
- [Detailed Setup](#detailed-setup)
- [Monitoring](#monitoring)
- [Troubleshooting](#troubleshooting)
- [Cost Optimization](#cost-optimization)
- [Security](#security)
- [Maintenance](#maintenance)

## 🎯 Overview

This deployment setup provides a production-ready infrastructure using:
- **Google Cloud Run** for the API (2M requests/month free)
- **Compute Engine e2-micro** for WhatsApp bot (free forever)
- **Vercel** for frontend hosting (free tier)
- **Supabase** for database (free tier)
- **Cloud Storage** for backups (5GB free)
- **Secret Manager** for secure credential storage

## 📦 Prerequisites

### Required Tools
```bash
# Install Google Cloud SDK
curl https://sdk.cloud.google.com | bash

# Install Node.js 20+
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install Vercel CLI
npm install -g vercel

# Install Docker (for local testing)
curl -fsSL https://get.docker.com | sh
```

### Required Accounts
1. **Google Cloud Platform** account with billing enabled (for free tier)
2. **Supabase** account (free tier)
3. **Vercel** account (free tier)
4. **Groq** API key for AI processing
5. **GitHub** account for code repository

### Environment Setup
```bash
# Clone the repository
git clone https://github.com/your-username/email-ai-assistant.git
cd email-ai-assistant

# Set environment variables
export PROJECT_ID="email-ai-assistant"
export REGION="us-central1"
export ZONE="us-central1-a"
```

## 🏗️ Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│                 │     │                 │     │                 │
│    Vercel       │────▶│  Cloud Run API  │────▶│    Supabase     │
│   (Frontend)    │     │   (Backend)     │     │   (Database)    │
│                 │     │                 │     │                 │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                               │
                               │
                               ▼
                        ┌─────────────────┐
                        │                 │
                        │  WhatsApp Bot   │
                        │   (VM e2-micro) │
                        │                 │
                        └─────────────────┘
```

## 🚀 Quick Start

### 1. Initial Setup (One-time)
```bash
cd deployment/gcp

# Step 1: Set up GCP project
./setup-project.sh

# Step 2: Configure secrets
./secrets.sh

# Step 3: Deploy API to Cloud Run
./deploy-api.sh

# Step 4: Set up WhatsApp bot VM
./setup-vm.sh

# Step 5: Deploy frontend to Vercel
cd ../vercel
./deploy.sh
```

### 2. Verify Deployment
```bash
# Run health check
cd deployment/gcp
./health-check.sh
```

## 📚 Detailed Setup

### Step 1: GCP Project Configuration

Create and configure your GCP project:

```bash
# Set your project ID
export PROJECT_ID="your-project-id"

# Run setup script
./deployment/gcp/setup-project.sh
```

This will:
- Create the GCP project
- Enable required APIs
- Create service accounts
- Set up Cloud Storage bucket
- Configure firewall rules

### Step 2: Secrets Management

Store your API keys and credentials securely:

```bash
# You'll be prompted for:
# - Supabase URL and keys
# - Groq API key
# - OpenAI API key (optional)
# - SMTP credentials (optional)

./deployment/gcp/secrets.sh
```

### Step 3: Deploy API to Cloud Run

Deploy the backend API:

```bash
./deployment/gcp/deploy-api.sh
```

The script will:
- Build Docker image
- Push to Container Registry
- Deploy to Cloud Run
- Configure environment variables
- Set up health checks

### Step 4: WhatsApp Bot Setup

Create and configure the VM for WhatsApp:

```bash
# Set your GitHub username
export GITHUB_USER="your-github-username"

./deployment/gcp/setup-vm.sh
```

After VM creation:
1. SSH into the VM: `gcloud compute ssh whatsapp-bot --zone=us-central1-a`
2. Check PM2 status: `pm2 status`
3. View QR code: `pm2 logs whatsapp-bot`
4. Scan QR code with WhatsApp

### Step 5: Frontend Deployment

Deploy the Next.js frontend to Vercel:

```bash
cd deployment/vercel

# Set Vercel token (get from https://vercel.com/account/tokens)
export VERCEL_TOKEN="your-vercel-token"

./deploy.sh
```

### Step 6: Configure CI/CD

Set up GitHub Actions for automated deployment:

1. Go to GitHub repository settings
2. Add secrets:
   - `GCP_SA_KEY`: Service account JSON key
   - `VERCEL_TOKEN`: Vercel deployment token
   - `SLACK_WEBHOOK_URL`: (Optional) Slack notifications

3. Push to main branch to trigger deployment

## 📊 Monitoring

### View Metrics
```bash
# Check service health
./deployment/gcp/health-check.sh

# View Cloud Run logs
gcloud run logs read --service=email-ai-api --region=us-central1

# View VM logs
gcloud compute ssh whatsapp-bot --zone=us-central1-a --command="pm2 logs"

# Monitor free tier usage
node deployment/gcp/cost-monitor.js
```

### Set Up Alerts

1. Go to [Cloud Console Monitoring](https://console.cloud.google.com/monitoring)
2. Create alert policies for:
   - High error rate (>1%)
   - High latency (>1000ms)
   - Free tier usage (>80%)
   - VM downtime

### Dashboards

Access monitoring dashboards:
- [Cloud Run Metrics](https://console.cloud.google.com/run)
- [VM Instances](https://console.cloud.google.com/compute/instances)
- [Cloud Storage](https://console.cloud.google.com/storage)
- [Secret Manager](https://console.cloud.google.com/security/secret-manager)

## 🔧 Troubleshooting

### Common Issues

#### 1. Cloud Run deployment fails
```bash
# Check build logs
gcloud builds list --limit=5

# Check service logs
gcloud run logs read --service=email-ai-api --region=us-central1 --limit=50

# Verify secrets exist
gcloud secrets list
```

#### 2. WhatsApp bot not connecting
```bash
# SSH into VM
gcloud compute ssh whatsapp-bot --zone=us-central1-a

# Check PM2 status
pm2 status

# View logs
pm2 logs whatsapp-bot --lines=100

# Restart bot
pm2 restart whatsapp-bot

# Clear session and restart
rm -rf /opt/whatsapp-bot/sessions/*
pm2 restart whatsapp-bot
```

#### 3. Frontend not loading
```bash
# Check Vercel deployment
vercel logs --token=$VERCEL_TOKEN

# Verify environment variables
vercel env ls --token=$VERCEL_TOKEN

# Redeploy
cd web-app && vercel --prod --token=$VERCEL_TOKEN
```

#### 4. Database connection issues
```bash
# Test Supabase connection
curl -X GET "$SUPABASE_URL/rest/v1/" \
  -H "apikey: $SUPABASE_ANON_KEY" \
  -H "Authorization: Bearer $SUPABASE_ANON_KEY"

# Check Cloud Run environment
gcloud run services describe email-ai-api --region=us-central1 --format=json | jq '.spec.template.spec.containers[0].env'
```

### Rollback Procedures

#### Quick rollback to previous version:
```bash
# Rollback Cloud Run
./deployment/gcp/rollback.sh --service

# Rollback VM
./deployment/gcp/rollback.sh --vm

# Full rollback
./deployment/gcp/rollback.sh

# Restore from backup
./deployment/gcp/rollback.sh --backup 20240115_120000
```

## 💰 Cost Optimization

### Free Tier Limits
| Service | Free Tier | Monthly Usage | Tips |
|---------|-----------|---------------|------|
| Cloud Run | 2M requests | Monitor daily | Use caching |
| Compute Engine | 1 e2-micro | 744 hours | Keep always on |
| Cloud Storage | 5GB | Check weekly | Clean old backups |
| Secret Manager | 6 secrets | Fixed | Combine secrets |
| Container Registry | 500MB | Monitor size | Clean old images |

### Cost Monitoring
```bash
# Run cost monitor
node deployment/gcp/cost-monitor.js

# Set up automated monitoring (runs daily)
gcloud scheduler jobs create http cost-monitor \
  --location=us-central1 \
  --schedule="0 8 * * *" \
  --uri="https://your-cloud-function-url" \
  --http-method=GET
```

### Optimization Tips
1. **Enable caching** in Cloud Run to reduce requests
2. **Compress images** before storing
3. **Clean old backups** automatically (30-day retention)
4. **Use Cloud CDN** for static assets
5. **Implement rate limiting** to prevent abuse

## 🔒 Security

### Best Practices
1. **Never commit secrets** to version control
2. **Rotate secrets regularly** (every 90 days)
3. **Use service accounts** with minimal permissions
4. **Enable audit logging** for compliance
5. **Implement rate limiting** and DDoS protection
6. **Use HTTPS everywhere** (automatic with Cloud Run)
7. **Regular security scans** with Cloud Security Scanner

### Security Checklist
- [ ] All secrets in Secret Manager
- [ ] Service accounts have minimal permissions
- [ ] Firewall rules configured correctly
- [ ] CORS properly configured
- [ ] Rate limiting enabled
- [ ] Audit logging enabled
- [ ] Regular backups configured
- [ ] Monitoring alerts set up

## 🛠️ Maintenance

### Daily Tasks
- Check health status: `./health-check.sh`
- Review error logs for issues
- Monitor free tier usage

### Weekly Tasks
- Review backup integrity
- Check storage usage
- Update dependencies if needed
- Review monitoring alerts

### Monthly Tasks
- Rotate secrets
- Clean old backups and logs
- Review and optimize costs
- Update documentation
- Security audit

### Backup and Restore
```bash
# Manual backup
./deployment/gcp/backup.sh

# Scheduled backup (set up in cron)
0 2 * * * /path/to/deployment/gcp/backup.sh

# Restore from backup
./deployment/gcp/rollback.sh --backup TIMESTAMP
```

## 📝 Additional Resources

### Documentation
- [Google Cloud Run Docs](https://cloud.google.com/run/docs)
- [Vercel Docs](https://vercel.com/docs)
- [Supabase Docs](https://supabase.com/docs)
- [WhatsApp Web.js Docs](https://docs.wwebjs.dev/)

### Support
- Create an issue on GitHub
- Check existing issues for solutions
- Join our Discord community
- Email: support@example.com

### Contributing
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests
5. Submit a pull request

## 📄 License

MIT License - See LICENSE file for details

---

## 🎉 Success Checklist

After deployment, verify:
- [ ] Cloud Run API responds at HTTPS URL
- [ ] WhatsApp bot connects and stays online
- [ ] Frontend loads on Vercel
- [ ] Database connections work
- [ ] Authentication works
- [ ] Email processing works
- [ ] WhatsApp messages are received
- [ ] Monitoring dashboards show data
- [ ] Backups run automatically
- [ ] Costs stay within free tier

**Congratulations!** Your Email AI Assistant is now deployed and running in production! 🚀