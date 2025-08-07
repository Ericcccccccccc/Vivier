#!/bin/bash

# Secret Manager Setup Script
# Manages all secrets securely in Google Secret Manager

set -e

# Configuration
PROJECT_ID="${PROJECT_ID:-email-ai-assistant}"

echo "==================================="
echo "Setting up Secret Manager"
echo "==================================="
echo "Project: $PROJECT_ID"
echo ""

# Function to create or update a secret
create_or_update_secret() {
    local SECRET_NAME=$1
    local SECRET_VALUE=$2
    local DESCRIPTION=$3
    
    echo "Processing secret: $SECRET_NAME"
    
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
        
        if [ ! -z "$DESCRIPTION" ]; then
            gcloud secrets update $SECRET_NAME \
                --update-labels="description=$DESCRIPTION" \
                --project=$PROJECT_ID
        fi
    fi
    
    echo "  ✅ Secret $SECRET_NAME configured successfully."
}

# Function to grant access to a service account
grant_secret_access() {
    local SECRET_NAME=$1
    local SERVICE_ACCOUNT=$2
    
    echo "Granting access to $SERVICE_ACCOUNT for secret $SECRET_NAME..."
    gcloud secrets add-iam-policy-binding $SECRET_NAME \
        --member="serviceAccount:$SERVICE_ACCOUNT" \
        --role="roles/secretmanager.secretAccessor" \
        --project=$PROJECT_ID
}

# Check for required environment variables or prompt for them
echo "Checking for required secrets..."
echo ""

# Supabase configuration
if [ -z "$SUPABASE_URL" ]; then
    read -p "Enter Supabase URL: " SUPABASE_URL
fi
if [ -z "$SUPABASE_SERVICE_KEY" ]; then
    read -p "Enter Supabase Service Key: " SUPABASE_SERVICE_KEY
fi
if [ -z "$SUPABASE_ANON_KEY" ]; then
    read -p "Enter Supabase Anon Key: " SUPABASE_ANON_KEY
fi

# AI API Keys
if [ -z "$GROQ_API_KEY" ]; then
    read -p "Enter Groq API Key: " GROQ_API_KEY
fi
if [ -z "$OPENAI_API_KEY" ]; then
    read -p "Enter OpenAI API Key (optional, press Enter to skip): " OPENAI_API_KEY
fi

# JWT Secret
if [ -z "$JWT_SECRET" ]; then
    echo "Generating JWT secret..."
    JWT_SECRET=$(openssl rand -base64 32)
    echo "Generated JWT secret: $JWT_SECRET"
fi

# WhatsApp Configuration
if [ -z "$WHATSAPP_API_KEY" ]; then
    echo "Generating WhatsApp API key..."
    WHATSAPP_API_KEY=$(openssl rand -hex 32)
    echo "Generated WhatsApp API key: $WHATSAPP_API_KEY"
fi

# Email configuration (optional)
read -p "Enter SMTP Host (optional, press Enter to skip): " SMTP_HOST
if [ ! -z "$SMTP_HOST" ]; then
    read -p "Enter SMTP Port: " SMTP_PORT
    read -p "Enter SMTP User: " SMTP_USER
    read -s -p "Enter SMTP Password: " SMTP_PASSWORD
    echo ""
fi

echo ""
echo "Creating/updating secrets in Secret Manager..."
echo ""

# Create secrets
create_or_update_secret "supabase-url" "$SUPABASE_URL" "Supabase project URL"
create_or_update_secret "supabase-service-key" "$SUPABASE_SERVICE_KEY" "Supabase service role key"
create_or_update_secret "supabase-anon-key" "$SUPABASE_ANON_KEY" "Supabase anonymous key"
create_or_update_secret "groq-api-key" "$GROQ_API_KEY" "Groq API key for AI processing"
create_or_update_secret "jwt-secret" "$JWT_SECRET" "JWT signing secret"
create_or_update_secret "whatsapp-api-key" "$WHATSAPP_API_KEY" "WhatsApp bot API key"

# Create OpenAI key if provided
if [ ! -z "$OPENAI_API_KEY" ]; then
    create_or_update_secret "openai-api-key" "$OPENAI_API_KEY" "OpenAI API key"
fi

# Create SMTP secrets if provided
if [ ! -z "$SMTP_HOST" ]; then
    create_or_update_secret "smtp-host" "$SMTP_HOST" "SMTP server host"
    create_or_update_secret "smtp-port" "$SMTP_PORT" "SMTP server port"
    create_or_update_secret "smtp-user" "$SMTP_USER" "SMTP username"
    create_or_update_secret "smtp-password" "$SMTP_PASSWORD" "SMTP password"
fi

echo ""
echo "Granting access to service accounts..."
echo ""

# Grant access to API service account
API_SERVICE_ACCOUNT="email-ai-api@${PROJECT_ID}.iam.gserviceaccount.com"
grant_secret_access "supabase-url" "$API_SERVICE_ACCOUNT"
grant_secret_access "supabase-service-key" "$API_SERVICE_ACCOUNT"
grant_secret_access "groq-api-key" "$API_SERVICE_ACCOUNT"
grant_secret_access "jwt-secret" "$API_SERVICE_ACCOUNT"

if [ ! -z "$OPENAI_API_KEY" ]; then
    grant_secret_access "openai-api-key" "$API_SERVICE_ACCOUNT"
fi

if [ ! -z "$SMTP_HOST" ]; then
    grant_secret_access "smtp-host" "$API_SERVICE_ACCOUNT"
    grant_secret_access "smtp-port" "$API_SERVICE_ACCOUNT"
    grant_secret_access "smtp-user" "$API_SERVICE_ACCOUNT"
    grant_secret_access "smtp-password" "$API_SERVICE_ACCOUNT"
fi

# Grant access to WhatsApp bot service account
BOT_SERVICE_ACCOUNT="whatsapp-bot@${PROJECT_ID}.iam.gserviceaccount.com"
grant_secret_access "whatsapp-api-key" "$BOT_SERVICE_ACCOUNT"
grant_secret_access "jwt-secret" "$BOT_SERVICE_ACCOUNT"

echo ""
echo "Creating secret accessor script..."
cat > get-secret.sh << 'EOFSCRIPT'
#!/bin/bash
# Helper script to retrieve secrets

SECRET_NAME=$1
PROJECT_ID="${PROJECT_ID:-email-ai-assistant}"

if [ -z "$SECRET_NAME" ]; then
    echo "Usage: ./get-secret.sh <secret-name>"
    echo ""
    echo "Available secrets:"
    gcloud secrets list --project=$PROJECT_ID --format="table(name)"
    exit 1
fi

gcloud secrets versions access latest --secret=$SECRET_NAME --project=$PROJECT_ID
EOFSCRIPT

chmod +x get-secret.sh

echo ""
echo "Creating secret rotation script..."
cat > rotate-secrets.sh << 'EOFROTATE'
#!/bin/bash
# Rotate secrets script

PROJECT_ID="${PROJECT_ID:-email-ai-assistant}"

echo "Starting secret rotation..."

# Rotate JWT secret
echo "Rotating JWT secret..."
NEW_JWT_SECRET=$(openssl rand -base64 32)
echo -n "$NEW_JWT_SECRET" | gcloud secrets versions add jwt-secret --data-file=- --project=$PROJECT_ID

# Rotate WhatsApp API key
echo "Rotating WhatsApp API key..."
NEW_WHATSAPP_KEY=$(openssl rand -hex 32)
echo -n "$NEW_WHATSAPP_KEY" | gcloud secrets versions add whatsapp-api-key --data-file=- --project=$PROJECT_ID

echo "Secret rotation complete."
echo ""
echo "Remember to:"
echo "1. Redeploy the API to Cloud Run to use new secrets"
echo "2. Restart the WhatsApp bot VM"
echo "3. Update any local development environments"
EOFROTATE

chmod +x rotate-secrets.sh

echo ""
echo "==================================="
echo "Secret Manager Setup Complete!"
echo "==================================="
echo ""
echo "Secrets created:"
gcloud secrets list --project=$PROJECT_ID --format="table(name,createTime)"
echo ""
echo "To view a secret value:"
echo "./get-secret.sh <secret-name>"
echo ""
echo "To rotate secrets:"
echo "./rotate-secrets.sh"
echo ""
echo "To manually add a new version of a secret:"
echo "echo -n 'new-value' | gcloud secrets versions add <secret-name> --data-file=-"
echo ""
echo "Security best practices:"
echo "1. Rotate secrets regularly (every 90 days)"
echo "2. Never commit secrets to version control"
echo "3. Use service accounts with minimal permissions"
echo "4. Enable secret version destruction after rotation"
echo "5. Monitor secret access in Cloud Audit Logs"
echo ""
echo "Free tier limits:"
echo "- 6 active secrets (we're using 6-10)"
echo "- 10,000 access operations per month"
echo ""
echo "Next steps:"
echo "1. Note down the generated JWT secret and WhatsApp API key"
echo "2. Run ./deploy-api.sh to deploy the API with these secrets"
echo "3. Run ./setup-vm.sh to create the WhatsApp bot VM"