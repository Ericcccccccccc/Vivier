#!/bin/bash

# Quick deployment script for Vivier
# This handles the deployment step by step with proper error handling

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Load environment variables
if [ -f ".env.deployment" ]; then
    echo -e "${BLUE}Loading environment variables...${NC}"
    export $(grep -v '^#' .env.deployment | xargs)
else
    echo -e "${RED}Error: .env.deployment file not found!${NC}"
    exit 1
fi

# Verify critical variables are set
echo -e "${BLUE}Verifying configuration...${NC}"

if [ -z "$SUPABASE_URL" ] || [ -z "$GROQ_API_KEY" ]; then
    echo -e "${RED}Missing required configuration in .env.deployment${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Configuration loaded successfully${NC}"

# Step 1: Setup Supabase Database
echo -e "\n${BLUE}Step 1: Setting up Supabase Database${NC}"
echo "Supabase URL: $SUPABASE_URL"

# First, let's create the database schema
echo "Creating database schema..."
cd database-layer

# Create a script to run the schema in Supabase
cat > run-schema.sql << 'EOF'
-- First, check if tables already exist and skip if they do
DO $$ 
BEGIN
    -- Only create tables if they don't exist
    IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'users') THEN
        -- Run the schema creation
        \i schema.sql
    ELSE
        RAISE NOTICE 'Tables already exist, skipping schema creation';
    END IF;
END $$;
EOF

echo -e "${YELLOW}⚠️  IMPORTANT: Manual step required!${NC}"
echo "Please go to your Supabase project and run the schema:"
echo "1. Go to: $SUPABASE_URL"
echo "2. Click on 'SQL Editor' in the left sidebar"
echo "3. Copy the contents of database-layer/schema.sql"
echo "4. Paste and run it in the SQL editor"
echo ""
read -p "Press Enter when you've completed this step..."

cd ..

# Step 2: Store secrets in GCP
echo -e "\n${BLUE}Step 2: Storing secrets in Google Cloud${NC}"

# Create a simpler secrets script
cat > setup-secrets-simple.sh << 'EOF'
#!/bin/bash

# Simple script to store secrets
PROJECT_ID="${PROJECT_ID}"

# Enable Secret Manager API
echo "Enabling Secret Manager API..."
gcloud services enable secretmanager.googleapis.com --project=$PROJECT_ID

sleep 3

# Function to create a secret
create_secret() {
    local name=$1
    local value=$2
    
    if [ -z "$value" ]; then
        echo "Skipping $name (empty value)"
        return
    fi
    
    echo "Creating secret: $name"
    
    # Delete if exists (for testing)
    gcloud secrets delete $name --project=$PROJECT_ID --quiet 2>/dev/null || true
    
    # Create new secret
    echo -n "$value" | gcloud secrets create $name \
        --data-file=- \
        --replication-policy="automatic" \
        --project=$PROJECT_ID || echo "Failed to create $name"
}

# Store all secrets
EOF

echo "create_secret \"supabase-url\" \"$SUPABASE_URL\"" >> setup-secrets-simple.sh
echo "create_secret \"supabase-anon-key\" \"$SUPABASE_ANON_KEY\"" >> setup-secrets-simple.sh
echo "create_secret \"supabase-service-key\" \"$SUPABASE_SERVICE_KEY\"" >> setup-secrets-simple.sh
echo "create_secret \"groq-api-key\" \"$GROQ_API_KEY\"" >> setup-secrets-simple.sh
echo "create_secret \"jwt-secret\" \"$JWT_SECRET\"" >> setup-secrets-simple.sh
echo "create_secret \"whatsapp-api-key\" \"$(openssl rand -base64 32 | tr -d '\n')\"" >> setup-secrets-simple.sh

echo "" >> setup-secrets-simple.sh
echo "echo \"All secrets stored successfully!\"" >> setup-secrets-simple.sh

chmod +x setup-secrets-simple.sh
./setup-secrets-simple.sh
rm setup-secrets-simple.sh

# Step 3: Build and deploy API
echo -e "\n${BLUE}Step 3: Building and deploying API to Cloud Run${NC}"

cd api-server

# Create the Dockerfile if it doesn't exist (it should)
if [ ! -f "Dockerfile" ]; then
    echo -e "${RED}Dockerfile not found in api-server!${NC}"
    exit 1
fi

# Build the Docker image
echo "Building Docker image..."
docker build -t gcr.io/$PROJECT_ID/email-ai-api .

# Push to Container Registry
echo "Pushing to Container Registry..."
docker push gcr.io/$PROJECT_ID/email-ai-api

# Deploy to Cloud Run
echo "Deploying to Cloud Run..."
gcloud run deploy email-ai-api \
    --image gcr.io/$PROJECT_ID/email-ai-api \
    --platform managed \
    --region $REGION \
    --allow-unauthenticated \
    --set-secrets="SUPABASE_URL=supabase-url:latest" \
    --set-secrets="SUPABASE_SERVICE_KEY=supabase-service-key:latest" \
    --set-secrets="GROQ_API_KEY=groq-api-key:latest" \
    --set-secrets="JWT_SECRET=jwt-secret:latest" \
    --set-env-vars="NODE_ENV=production,SUPABASE_ANON_KEY=$SUPABASE_ANON_KEY" \
    --min-instances=0 \
    --max-instances=10 \
    --memory=512Mi \
    --project=$PROJECT_ID

# Get the API URL
API_URL=$(gcloud run services describe email-ai-api --region=$REGION --format='value(status.url)' --project=$PROJECT_ID)
echo -e "${GREEN}✅ API deployed at: $API_URL${NC}"

cd ..

# Step 4: Deploy frontend to Vercel
echo -e "\n${BLUE}Step 4: Deploying frontend to Vercel${NC}"

cd web-app

# Create environment file for production
cat > .env.production << EOF
NEXT_PUBLIC_API_URL=$API_URL
NEXT_PUBLIC_SUPABASE_URL=$SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=$SUPABASE_ANON_KEY
EOF

# Install dependencies
echo "Installing dependencies..."
npm ci

# Build
echo "Building application..."
npm run build

# Deploy to Vercel
echo "Deploying to Vercel..."
if [ -n "$VERCEL_TOKEN" ]; then
    npx vercel --prod --token=$VERCEL_TOKEN --yes
    FRONTEND_URL=$(npx vercel ls --token=$VERCEL_TOKEN | grep email-ai | head -1 | awk '{print $2}')
    echo -e "${GREEN}✅ Frontend deployed at: https://$FRONTEND_URL${NC}"
else
    echo -e "${YELLOW}Vercel token not set, skipping frontend deployment${NC}"
fi

cd ..

# Step 5: Setup WhatsApp Bot VM
echo -e "\n${BLUE}Step 5: Setting up WhatsApp Bot VM${NC}"

# Check if VM already exists
if gcloud compute instances describe whatsapp-bot --zone=$ZONE --project=$PROJECT_ID &>/dev/null; then
    echo "VM already exists, skipping creation"
else
    echo "Creating VM instance..."
    gcloud compute instances create whatsapp-bot \
        --machine-type=e2-micro \
        --zone=$ZONE \
        --image-family=ubuntu-2204-lts \
        --image-project=ubuntu-os-cloud \
        --boot-disk-size=10GB \
        --boot-disk-type=pd-standard \
        --tags=whatsapp-bot \
        --project=$PROJECT_ID \
        --metadata startup-script='#!/bin/bash
apt-get update
apt-get install -y nodejs npm git
git clone https://github.com/Ericcccccccccc/Vivier.git /opt/whatsapp-bot
cd /opt/whatsapp-bot/whatsapp-bot
npm install
npm install -g pm2
echo "API_URL='$API_URL'" > .env
pm2 start ecosystem.config.js
pm2 startup
pm2 save'
fi

echo -e "\n${GREEN}🎉 Deployment Complete!${NC}"
echo ""
echo "Services deployed:"
echo "  API:       $API_URL"
[ -n "$FRONTEND_URL" ] && echo "  Frontend:  https://$FRONTEND_URL"
echo "  Database:  $SUPABASE_URL"
echo ""
echo "Next steps:"
echo "1. SSH into WhatsApp bot VM to scan QR code:"
echo "   ${BLUE}gcloud compute ssh whatsapp-bot --zone=$ZONE --project=$PROJECT_ID${NC}"
echo "2. Run: ${BLUE}pm2 logs whatsapp-bot${NC}"
echo "3. Scan the QR code with WhatsApp"