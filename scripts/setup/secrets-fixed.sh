#!/bin/bash

# Secret Manager Setup Script - Fixed Version
# Manages all secrets securely in Google Secret Manager

set -e

# Configuration
PROJECT_ID="${PROJECT_ID:-vivier-468315}"
REGION="${REGION:-us-central1}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}==================================="
echo "Setting up Secret Manager"
echo "===================================${NC}"
echo "Project: $PROJECT_ID"
echo ""

# First, ensure the Secret Manager API is enabled
echo "Enabling Secret Manager API..."
gcloud services enable secretmanager.googleapis.com --project=$PROJECT_ID || {
    echo -e "${YELLOW}Warning: Could not enable Secret Manager API${NC}"
    echo "You may need to enable it manually or check billing"
}

# Wait a moment for API to be ready
sleep 2

# Function to create or update a secret
create_or_update_secret() {
    local SECRET_NAME=$1
    local SECRET_VALUE=$2
    local DESCRIPTION=$3
    
    echo -e "${BLUE}Processing secret: $SECRET_NAME${NC}"
    
    # Skip if value is empty
    if [ -z "$SECRET_VALUE" ]; then
        echo -e "${YELLOW}  Skipping $SECRET_NAME (no value provided)${NC}"
        return 0
    fi
    
    # Check if secret exists
    if gcloud secrets describe $SECRET_NAME --project=$PROJECT_ID &> /dev/null; then
        echo "  Secret exists. Adding new version..."
        echo -n "$SECRET_VALUE" | gcloud secrets versions add $SECRET_NAME \
            --data-file=- \
            --project=$PROJECT_ID
    else
        echo "  Creating new secret..."
        echo -n "$SECRET_VALUE" | gcloud secrets create $SECRET_NAME \
            --data-file=- \
            --replication-policy="automatic" \
            --project=$PROJECT_ID
    fi
    
    echo -e "${GREEN}  ✅ Secret $SECRET_NAME configured successfully.${NC}"
}

# Function to grant access to a service account
grant_secret_access() {
    local SECRET_NAME=$1
    local SERVICE_ACCOUNT=$2
    
    echo "  Granting access to $SERVICE_ACCOUNT..."
    gcloud secrets add-iam-policy-binding $SECRET_NAME \
        --member="serviceAccount:$SERVICE_ACCOUNT" \
        --role="roles/secretmanager.secretAccessor" \
        --project=$PROJECT_ID &> /dev/null || {
        echo -e "${YELLOW}  Warning: Could not grant access (may already exist)${NC}"
    }
}

# Create service account if it doesn't exist
SERVICE_ACCOUNT="email-ai-api@$PROJECT_ID.iam.gserviceaccount.com"
echo "Checking service account..."
if ! gcloud iam service-accounts describe $SERVICE_ACCOUNT --project=$PROJECT_ID &> /dev/null; then
    echo "Creating service account..."
    gcloud iam service-accounts create email-ai-api \
        --display-name="Email AI API Service Account" \
        --project=$PROJECT_ID
fi

# Store secrets
echo ""
echo "Storing secrets in Secret Manager..."
echo ""

# Database secrets
create_or_update_secret "supabase-url" "$SUPABASE_URL" "Supabase project URL"
create_or_update_secret "supabase-anon-key" "$SUPABASE_ANON_KEY" "Supabase anonymous key"
create_or_update_secret "supabase-service-key" "$SUPABASE_SERVICE_KEY" "Supabase service role key"

# AI Provider secrets
create_or_update_secret "groq-api-key" "$GROQ_API_KEY" "Groq API key"
if [ ! -z "$OPENAI_API_KEY" ]; then
    create_or_update_secret "openai-api-key" "$OPENAI_API_KEY" "OpenAI API key"
fi

# Authentication secrets
create_or_update_secret "jwt-secret" "$JWT_SECRET" "JWT signing secret"

# WhatsApp secrets
API_KEY=$(openssl rand -base64 32 | tr -d '\n')
create_or_update_secret "whatsapp-api-key" "$API_KEY" "WhatsApp bot API key"

# Grant access to service account
echo ""
echo "Granting secret access to service account..."
for secret in supabase-url supabase-anon-key supabase-service-key groq-api-key jwt-secret; do
    grant_secret_access $secret $SERVICE_ACCOUNT
done

# List all secrets
echo ""
echo -e "${BLUE}Configured secrets:${NC}"
gcloud secrets list --project=$PROJECT_ID --format="table(name,create_time)" 2>/dev/null || {
    echo -e "${YELLOW}Could not list secrets${NC}"
}

echo ""
echo -e "${GREEN}✅ Secret Manager setup complete!${NC}"
echo ""
echo "Secrets are now stored securely in Google Secret Manager."
echo "They will be automatically injected into your services during deployment."