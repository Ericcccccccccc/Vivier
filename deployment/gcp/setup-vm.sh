#!/bin/bash

# Setup VM for WhatsApp Bot
# Creates an e2-micro instance (free tier) to run the WhatsApp bot

set -e

# Configuration
PROJECT_ID="${PROJECT_ID:-email-ai-assistant}"
ZONE="${ZONE:-us-central1-a}"
INSTANCE_NAME="whatsapp-bot"
MACHINE_TYPE="e2-micro"  # Free tier
GITHUB_USER="${GITHUB_USER:-your-github-username}"
GITHUB_REPO="${GITHUB_REPO:-email-ai-assistant}"

echo "==================================="
echo "Setting up VM for WhatsApp Bot"
echo "==================================="
echo "Project: $PROJECT_ID"
echo "Zone: $ZONE"
echo "Instance: $INSTANCE_NAME"
echo "Machine Type: $MACHINE_TYPE (free tier)"
echo ""

# Check if startup script exists
if [ ! -f "deployment/gcp/startup.sh" ]; then
    echo "Error: startup.sh not found. Creating it first..."
    exit 1
fi

# Check if instance already exists
echo "Checking if instance already exists..."
if gcloud compute instances describe $INSTANCE_NAME --zone=$ZONE &> /dev/null; then
    echo "Instance already exists."
    read -p "Do you want to delete and recreate it? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "Deleting existing instance..."
        gcloud compute instances delete $INSTANCE_NAME --zone=$ZONE --quiet
        echo "Instance deleted."
    else
        echo "Keeping existing instance. Exiting."
        exit 0
    fi
fi

# Create metadata file with environment variables
echo "Creating metadata configuration..."
cat > /tmp/metadata.txt << EOF
startup-script-url=gs://${PROJECT_ID}-backups/startup.sh
github-user=$GITHUB_USER
github-repo=$GITHUB_REPO
project-id=$PROJECT_ID
api-url=https://email-ai-api-xxxxx.run.app
EOF

# Upload startup script to Cloud Storage
echo "Uploading startup script to Cloud Storage..."
gsutil cp deployment/gcp/startup.sh gs://${PROJECT_ID}-backups/startup.sh
gsutil acl ch -u whatsapp-bot@${PROJECT_ID}.iam.gserviceaccount.com:R gs://${PROJECT_ID}-backups/startup.sh

# Create the instance
echo "Creating e2-micro instance..."
gcloud compute instances create $INSTANCE_NAME \
  --machine-type=$MACHINE_TYPE \
  --zone=$ZONE \
  --image-family=ubuntu-2204-lts \
  --image-project=ubuntu-os-cloud \
  --boot-disk-size=10GB \
  --boot-disk-type=pd-standard \
  --boot-disk-auto-delete \
  --tags=whatsapp-bot,http-server,https-server \
  --metadata-from-file=startup-script=deployment/gcp/startup.sh \
  --metadata="github-user=$GITHUB_USER,github-repo=$GITHUB_REPO,project-id=$PROJECT_ID" \
  --service-account=whatsapp-bot@${PROJECT_ID}.iam.gserviceaccount.com \
  --scopes=https://www.googleapis.com/auth/cloud-platform \
  --preemptible \
  --maintenance-policy=MIGRATE \
  --provisioning-model=STANDARD \
  --reservation-affinity=any

echo "Instance created successfully."

# Wait for instance to be ready
echo "Waiting for instance to be ready..."
sleep 30

# Get instance external IP
EXTERNAL_IP=$(gcloud compute instances describe $INSTANCE_NAME \
  --zone=$ZONE \
  --format='value(networkInterfaces[0].accessConfigs[0].natIP)')

echo "Instance external IP: $EXTERNAL_IP"

# Create or update firewall rules
echo "Configuring firewall rules..."

# SSH access
if ! gcloud compute firewall-rules describe allow-ssh-whatsapp &> /dev/null; then
    gcloud compute firewall-rules create allow-ssh-whatsapp \
      --allow=tcp:22 \
      --source-ranges=0.0.0.0/0 \
      --target-tags=whatsapp-bot \
      --description="Allow SSH access to WhatsApp bot"
fi

# HTTP/HTTPS for health checks (internal only)
if ! gcloud compute firewall-rules describe allow-health-check-whatsapp &> /dev/null; then
    gcloud compute firewall-rules create allow-health-check-whatsapp \
      --allow=tcp:80,tcp:443,tcp:3000 \
      --source-ranges=35.191.0.0/16,130.211.0.0/22 \
      --target-tags=whatsapp-bot \
      --description="Allow health checks for WhatsApp bot"
fi

# Set up SSH key (optional)
echo "Setting up SSH access..."
if [ -f ~/.ssh/id_rsa.pub ]; then
    echo "Adding your SSH key to the instance..."
    gcloud compute instances add-metadata $INSTANCE_NAME \
      --zone=$ZONE \
      --metadata-from-file ssh-keys=~/.ssh/id_rsa.pub
fi

# Create a persistent disk for data (optional, within free tier)
echo "Checking persistent disk requirements..."
# Note: 30GB total persistent disk is free, we're using 10GB for boot

# Set up monitoring
echo "Setting up monitoring..."
gcloud compute instances add-metadata $INSTANCE_NAME \
  --zone=$ZONE \
  --metadata=enable-oslogin=TRUE,enable-guest-attributes=TRUE

# Create instance schedule (optional - to save resources)
echo "Creating instance schedule (optional)..."
cat > /tmp/schedule-policy.json << EOF
{
  "description": "WhatsApp bot instance schedule",
  "vmStartSchedule": {
    "schedule": "0 6 * * *"
  },
  "vmStopSchedule": {
    "schedule": "0 0 * * *"
  },
  "timeZone": "America/New_York"
}
EOF

# Note: Resource policies require specific API enablement
# gcloud compute resource-policies create instance-schedule whatsapp-bot-schedule \
#   --region=${ZONE%-*} \
#   --vm-start-schedule="0 6 * * *" \
#   --vm-stop-schedule="0 0 * * *" \
#   --timezone="America/New_York"

# Wait for startup script to complete
echo "Waiting for startup script to complete (this may take 5-10 minutes)..."
echo "You can check the progress with:"
echo "gcloud compute instances get-serial-port-output $INSTANCE_NAME --zone=$ZONE"
echo ""

# Function to check if startup is complete
check_startup_complete() {
    gcloud compute ssh $INSTANCE_NAME --zone=$ZONE --command="test -f /opt/whatsapp-bot/.startup-complete" 2>/dev/null
    return $?
}

# Wait with timeout
TIMEOUT=600  # 10 minutes
ELAPSED=0
INTERVAL=30

while [ $ELAPSED -lt $TIMEOUT ]; do
    if check_startup_complete; then
        echo "✅ Startup script completed successfully!"
        break
    fi
    echo "Still waiting... ($ELAPSED seconds elapsed)"
    sleep $INTERVAL
    ELAPSED=$((ELAPSED + INTERVAL))
done

if [ $ELAPSED -ge $TIMEOUT ]; then
    echo "⚠️  Startup script is taking longer than expected."
    echo "Check the logs for details."
fi

# Output connection information
echo ""
echo "==================================="
echo "VM Setup Complete!"
echo "==================================="
echo "Instance Name: $INSTANCE_NAME"
echo "External IP: $EXTERNAL_IP"
echo "Zone: $ZONE"
echo ""
echo "To connect via SSH:"
echo "gcloud compute ssh $INSTANCE_NAME --zone=$ZONE"
echo ""
echo "To view startup script logs:"
echo "gcloud compute instances get-serial-port-output $INSTANCE_NAME --zone=$ZONE | grep startup-script"
echo ""
echo "To check WhatsApp bot status:"
echo "gcloud compute ssh $INSTANCE_NAME --zone=$ZONE --command='pm2 status'"
echo ""
echo "To view WhatsApp bot logs:"
echo "gcloud compute ssh $INSTANCE_NAME --zone=$ZONE --command='pm2 logs whatsapp-bot'"
echo ""
echo "To restart WhatsApp bot:"
echo "gcloud compute ssh $INSTANCE_NAME --zone=$ZONE --command='pm2 restart whatsapp-bot'"
echo ""
echo "Important: Remember to:"
echo "1. Update the API_URL in the bot configuration"
echo "2. Scan the WhatsApp QR code to authenticate"
echo "3. Monitor the instance to ensure it stays within free tier"