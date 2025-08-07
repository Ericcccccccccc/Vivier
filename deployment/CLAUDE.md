# Google Cloud Platform Deployment Guide

## Your Mission
Deploy the complete email AI assistant to GCP's free tier, ensuring everything runs within free limits and scales appropriately.

## Deployment Architecture

1. **API**: Cloud Run (2M requests/month free)
2. **WhatsApp Bot**: e2-micro VM (free forever)
3. **Frontend**: Vercel (free tier)
4. **Database**: Supabase (free tier)
5. **Storage**: Cloud Storage (5GB free)
6. **Secrets**: Secret Manager (6 secrets free)
7. **Monitoring**: Cloud Logging/Monitoring (free tier)

## Cloud Run Deployment

```bash
#!/bin/bash
# deploy-api.sh

# Build and push Docker image
gcloud builds submit \
  --tag gcr.io/$PROJECT_ID/email-ai-api \
  --timeout=20m \
  ./api-server

# Deploy to Cloud Run
gcloud run deploy email-ai-api \
  --image gcr.io/$PROJECT_ID/email-ai-api \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars-from-file=.env.yaml \
  --set-secrets="SUPABASE_SERVICE_KEY=supabase-key:latest" \
  --set-secrets="GROQ_API_KEY=groq-key:latest" \
  --set-secrets="JWT_SECRET=jwt-secret:latest" \
  --min-instances=0 \
  --max-instances=10 \
  --memory=512Mi \
  --cpu=1 \
  --timeout=60 \
  --concurrency=1000 \
  --service-account=email-ai-api@$PROJECT_ID.iam.gserviceaccount.com

# Get the service URL
SERVICE_URL=$(gcloud run services describe email-ai-api \
  --region=us-central1 \
  --format='value(status.url)')

echo "API deployed at: $SERVICE_URL"
```

## VM Setup for WhatsApp Bot

```bash
#!/bin/bash
# setup-vm.sh

# Create e2-micro instance
gcloud compute instances create whatsapp-bot \
  --machine-type=e2-micro \
  --zone=us-central1-a \
  --image-family=ubuntu-2204-lts \
  --image-project=ubuntu-os-cloud \
  --boot-disk-size=10GB \
  --boot-disk-type=pd-standard \
  --tags=whatsapp-bot \
  --metadata-from-file startup-script=startup.sh

# Create firewall rule (SSH only)
gcloud compute firewall-rules create allow-ssh-whatsapp \
  --allow=tcp:22 \
  --source-ranges=0.0.0.0/0 \
  --target-tags=whatsapp-bot

# SSH into the instance
gcloud compute ssh whatsapp-bot --zone=us-central1-a
```

## Startup Script for VM

```bash
#!/bin/bash
# startup.sh - Runs on VM first boot

# Update system
apt-get update && apt-get upgrade -y

# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs build-essential

# Install PM2
npm install -g pm2

# Clone repository
git clone https://github.com/$GITHUB_USER/email-ai-assistant.git /opt/whatsapp-bot
cd /opt/whatsapp-bot/whatsapp-bot

# Install dependencies
npm ci --production

# Build application
npm run build

# Setup environment
cat > .env << EOF
API_URL=https://email-ai-api-xxxxx.run.app
API_KEY=$(gcloud secrets versions access latest --secret=whatsapp-api-key)
EOF

# Start with PM2
pm2 start ecosystem.config.js
pm2 startup systemd -u root --hp /root
pm2 save

# Setup log rotation
cat > /etc/logrotate.d/whatsapp-bot << EOF
/opt/whatsapp-bot/logs/*.log {
    daily
    rotate 7
    compress
    missingok
    notifempty
}
EOF
```

## Secret Manager Setup

```bash
#!/bin/bash
# setup-secrets.sh

# Create secrets
echo -n "$SUPABASE_SERVICE_KEY" | gcloud secrets create supabase-key \
  --data-file=-

echo -n "$GROQ_API_KEY" | gcloud secrets create groq-key \
  --data-file=-

echo -n "$JWT_SECRET" | gcloud secrets create jwt-secret \
  --data-file=-

echo -n "$WHATSAPP_API_KEY" | gcloud secrets create whatsapp-api-key \
  --data-file=-

# Grant access to service account
gcloud secrets add-iam-policy-binding supabase-key \
  --member=serviceAccount:email-ai-api@$PROJECT_ID.iam.gserviceaccount.com \
  --role=roles/secretmanager.secretAccessor
```

## Monitoring Configuration

```yaml
# monitoring.yaml
apiVersion: monitoring.coreos.com/v1
kind: ServiceLevelObjective
metadata:
  name: email-ai-api-slo
spec:
  service: email-ai-api
  sli:
    - name: availability
      target: 0.99
      window: 30d
    - name: latency
      target: 0.95
      threshold: 500ms
      window: 30d
  
alertPolicy:
  - name: high-error-rate
    condition:
      threshold: 0.01
      duration: 5m
    notification:
      - email: admin@example.com
  
  - name: high-latency
    condition:
      threshold: 1000ms
      duration: 5m
    notification:
      - email: admin@example.com
```

## CI/CD with Cloud Build

```yaml
# cloudbuild.yaml
steps:
  # Run tests
  - name: 'node:20'
    entrypoint: 'npm'
    args: ['test']
    dir: 'api-server'
  
  # Build Docker image
  - name: 'gcr.io/cloud-builders/docker'
    args: [
      'build',
      '-t', 'gcr.io/$PROJECT_ID/email-ai-api:$COMMIT_SHA',
      '-t', 'gcr.io/$PROJECT_ID/email-ai-api:latest',
      '--cache-from', 'gcr.io/$PROJECT_ID/email-ai-api:latest',
      './api-server'
    ]
  
  # Push to Container Registry
  - name: 'gcr.io/cloud-builders/docker'
    args: ['push', '--all-tags', 'gcr.io/$PROJECT_ID/email-ai-api']
  
  # Deploy to Cloud Run
  - name: 'gcr.io/google.com/cloudsdktool/cloud-sdk'
    entrypoint: 'gcloud'
    args: [
      'run', 'deploy', 'email-ai-api',
      '--image', 'gcr.io/$PROJECT_ID/email-ai-api:$COMMIT_SHA',
      '--region', 'us-central1'
    ]
  
  # Update WhatsApp bot
  - name: 'gcr.io/google.com/cloudsdktool/cloud-sdk'
    entrypoint: 'bash'
    args:
      - '-c'
      - |
        gcloud compute ssh whatsapp-bot \
          --zone=us-central1-a \
          --command="cd /opt/whatsapp-bot && git pull && npm install && npm run build && pm2 restart all"

timeout: 1200s
```

## Vercel Deployment

```json
// vercel.json
{
  "buildCommand": "npm run build",
  "outputDirectory": ".next",
  "devCommand": "npm run dev",
  "installCommand": "npm install",
  "framework": "nextjs",
  "env": {
    "NEXT_PUBLIC_API_URL": "@api_url",
    "NEXT_PUBLIC_SUPABASE_URL": "@supabase_url",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY": "@supabase_anon_key"
  }
}
```

## Cost Monitoring

```typescript
// Cloud Function to monitor free tier usage
import { CloudRunClient } from '@google-cloud/run';
import { Storage } from '@google-cloud/storage';

export const monitorUsage = async (req, res) => {
  const usage = {
    cloudRun: {
      requests: await getCloudRunRequests(),
      limit: 2000000,
      percentage: 0,
    },
    storage: {
      used: await getStorageUsage(),
      limit: 5 * 1024 * 1024 * 1024, // 5GB
      percentage: 0,
    },
    vm: {
      uptime: await getVMUptime(),
      limit: 744, // hours per month
      percentage: 0,
    },
  };
  
  // Calculate percentages
  usage.cloudRun.percentage = (usage.cloudRun.requests / usage.cloudRun.limit) * 100;
  usage.storage.percentage = (usage.storage.used / usage.storage.limit) * 100;
  usage.vm.percentage = (usage.vm.uptime / usage.vm.limit) * 100;
  
  // Alert if over 80%
  if (usage.cloudRun.percentage > 80) {
    await sendAlert('Cloud Run usage at ' + usage.cloudRun.percentage + '%');
  }
  
  res.json(usage);
};
```