#!/bin/bash

# Complete GCP project setup script
# This script sets up a new GCP project with all required services

set -e

# Configuration
PROJECT_ID="${PROJECT_ID:-email-ai-assistant}"
REGION="${REGION:-us-central1}"
ZONE="${ZONE:-us-central1-a}"
BILLING_ACCOUNT_ID="${BILLING_ACCOUNT_ID}"

echo "==================================="
echo "GCP Project Setup for Email AI Assistant"
echo "==================================="
echo "Project ID: $PROJECT_ID"
echo "Region: $REGION"
echo "Zone: $ZONE"
echo ""

# Check if gcloud is installed
if ! command -v gcloud &> /dev/null; then
    echo "Error: gcloud CLI is not installed. Please install it first."
    echo "Visit: https://cloud.google.com/sdk/docs/install"
    exit 1
fi

# Authenticate if needed
echo "Checking authentication..."
if ! gcloud auth list --filter=status:ACTIVE --format="value(account)" | grep -q .; then
    echo "Please authenticate with gcloud..."
    gcloud auth login
fi

# Create project
echo "Creating project $PROJECT_ID..."
if ! gcloud projects describe $PROJECT_ID &> /dev/null; then
    gcloud projects create $PROJECT_ID --name="Email AI Assistant"
    echo "Project created successfully."
else
    echo "Project already exists."
fi

# Set as default project
echo "Setting $PROJECT_ID as default project..."
gcloud config set project $PROJECT_ID

# Link billing account if provided
if [ ! -z "$BILLING_ACCOUNT_ID" ]; then
    echo "Linking billing account..."
    gcloud beta billing projects link $PROJECT_ID --billing-account=$BILLING_ACCOUNT_ID
else
    echo "Warning: No billing account provided. Some services may not work."
    echo "To link billing account later, run:"
    echo "gcloud beta billing projects link $PROJECT_ID --billing-account=YOUR_BILLING_ACCOUNT_ID"
fi

# Enable required APIs
echo "Enabling required APIs..."
gcloud services enable \
  run.googleapis.com \
  compute.googleapis.com \
  containerregistry.googleapis.com \
  cloudbuild.googleapis.com \
  secretmanager.googleapis.com \
  cloudscheduler.googleapis.com \
  logging.googleapis.com \
  monitoring.googleapis.com \
  cloudresourcemanager.googleapis.com \
  iam.googleapis.com \
  storage.googleapis.com \
  cloudfunctions.googleapis.com

echo "APIs enabled successfully."

# Create service account for API
echo "Creating service account for API..."
if ! gcloud iam service-accounts describe email-ai-api@$PROJECT_ID.iam.gserviceaccount.com &> /dev/null; then
    gcloud iam service-accounts create email-ai-api \
      --display-name="Email AI API Service Account" \
      --description="Service account for Email AI API running on Cloud Run"
    echo "Service account created."
else
    echo "Service account already exists."
fi

# Grant necessary permissions to service account
echo "Granting permissions to service account..."
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:email-ai-api@$PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/run.invoker"

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:email-ai-api@$PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:email-ai-api@$PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/logging.logWriter"

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:email-ai-api@$PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/monitoring.metricWriter"

echo "Permissions granted."

# Create service account for WhatsApp bot VM
echo "Creating service account for WhatsApp bot..."
if ! gcloud iam service-accounts describe whatsapp-bot@$PROJECT_ID.iam.gserviceaccount.com &> /dev/null; then
    gcloud iam service-accounts create whatsapp-bot \
      --display-name="WhatsApp Bot Service Account" \
      --description="Service account for WhatsApp bot running on Compute Engine"
    echo "Service account created."
else
    echo "Service account already exists."
fi

# Grant permissions to WhatsApp bot service account
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:whatsapp-bot@$PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:whatsapp-bot@$PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/logging.logWriter"

# Create Cloud Storage bucket for backups
BUCKET_NAME="${PROJECT_ID}-backups"
echo "Creating Cloud Storage bucket for backups..."
if ! gsutil ls -b gs://$BUCKET_NAME &> /dev/null; then
    gsutil mb -p $PROJECT_ID -l $REGION gs://$BUCKET_NAME
    # Set lifecycle rule to delete old backups after 30 days
    cat > /tmp/lifecycle.json << EOF
{
  "lifecycle": {
    "rule": [
      {
        "action": {"type": "Delete"},
        "condition": {
          "age": 30,
          "matchesPrefix": ["backups/"]
        }
      }
    ]
  }
}
EOF
    gsutil lifecycle set /tmp/lifecycle.json gs://$BUCKET_NAME
    rm /tmp/lifecycle.json
    echo "Bucket created with lifecycle rules."
else
    echo "Bucket already exists."
fi

# Set default region and zone
echo "Setting default region and zone..."
gcloud config set compute/region $REGION
gcloud config set compute/zone $ZONE

# Create firewall rules for VM
echo "Creating firewall rules..."
if ! gcloud compute firewall-rules describe allow-ssh-whatsapp &> /dev/null; then
    gcloud compute firewall-rules create allow-ssh-whatsapp \
      --allow=tcp:22 \
      --source-ranges=0.0.0.0/0 \
      --target-tags=whatsapp-bot \
      --description="Allow SSH access to WhatsApp bot VM"
    echo "Firewall rule created."
else
    echo "Firewall rule already exists."
fi

# Create VPC network (optional - using default for free tier)
echo "Using default VPC network for free tier optimization."

# Setup Cloud Scheduler for backups (if available in region)
echo "Checking Cloud Scheduler availability..."
if gcloud scheduler locations list --filter="name:$REGION" --format="value(name)" | grep -q .; then
    echo "Cloud Scheduler is available in $REGION"
    # This will be configured after Cloud Functions are deployed
else
    echo "Warning: Cloud Scheduler not available in $REGION. Manual backup scheduling required."
fi

# Create notification channel for alerts
echo "Setting up monitoring notification channel..."
# Note: This requires manual configuration in Console for email notifications

# Output summary
echo ""
echo "==================================="
echo "Setup Complete!"
echo "==================================="
echo "Project ID: $PROJECT_ID"
echo "Region: $REGION"
echo "Zone: $ZONE"
echo "Service Accounts Created:"
echo "  - email-ai-api@$PROJECT_ID.iam.gserviceaccount.com"
echo "  - whatsapp-bot@$PROJECT_ID.iam.gserviceaccount.com"
echo "Storage Bucket: gs://$BUCKET_NAME"
echo ""
echo "Next Steps:"
echo "1. Run ./secrets.sh to set up Secret Manager"
echo "2. Run ./deploy-api.sh to deploy the API to Cloud Run"
echo "3. Run ./setup-vm.sh to create the WhatsApp bot VM"
echo "4. Configure monitoring alerts in Cloud Console"
echo ""
echo "Remember to stay within free tier limits!"
echo "- Cloud Run: 2M requests/month"
echo "- Compute Engine: 1 e2-micro instance"
echo "- Cloud Storage: 5GB"
echo "- Secret Manager: 6 secrets"