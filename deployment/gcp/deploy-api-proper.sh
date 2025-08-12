#!/bin/bash

# Deploy TypeScript API Server to Google Cloud Run (Proper Workspace Method)
# This script uses npm workspaces for proper module resolution

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Get the directory of this script
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$SCRIPT_DIR/../.."

# Load environment variables from .env.deployment
echo -e "${YELLOW}📋 Loading environment variables...${NC}"
if [ -f "$PROJECT_ROOT/.env.deployment" ]; then
    export $(cat "$PROJECT_ROOT/.env.deployment" | grep -v '^#' | xargs)
    echo "Environment variables loaded from .env.deployment"
else
    echo -e "${RED}❌ Error: .env.deployment file not found${NC}"
    echo "Please create .env.deployment file in the project root"
    exit 1
fi

# Configuration
PROJECT_ID="${PROJECT_ID:-vivier-468315}"
REGION="${REGION:-us-central1}"
SERVICE_NAME="vivier-api-typescript"
IMAGE_NAME="gcr.io/$PROJECT_ID/$SERVICE_NAME"

echo -e "${GREEN}🚀 Starting deployment of TypeScript API Server${NC}"
echo "================================================"
echo "Project: $PROJECT_ID"
echo "Region: $REGION"
echo "Service: $SERVICE_NAME"
echo ""

# Navigate to project root
cd "$PROJECT_ROOT"

# Step 1: Install dependencies and generate lock file
echo -e "${YELLOW}📦 Installing workspace dependencies...${NC}"
npm install

# Step 2: Create .dockerignore for optimal build context
cat > .dockerignore << 'EOF'
# Node modules - will be installed fresh in Docker
**/node_modules
node_modules

# Build outputs - will be built fresh in Docker
**/dist
**/build
**/*.tsbuildinfo

# Development files
**/.env
**/.env.*
!**/.env.example

# Test files  
**/test
**/tests
**/*.test.ts
**/*.test.js
**/*.spec.ts
**/*.spec.js
**/coverage
**/.nyc_output

# Documentation
**/docs
**/*.md
!**/package.json
!**/package-lock.json

# Version control
.git
.gitignore
**/.gitignore

# IDE files
.vscode
.idea
**/*.swp
**/*.swo
**/.DS_Store

# Logs
**/*.log
**/logs

# Other unnecessary files
**/.eslintrc*
**/.prettierrc*
**/.editorconfig

# Temporary files
**/tmp
**/temp
**/*.tmp
**/*.temp

# Keep only what's needed for build
!database-layer/src
!database-layer/package.json
!database-layer/tsconfig.json
!ai-provider-layer/src  
!ai-provider-layer/package.json
!ai-provider-layer/tsconfig.json
!api-server/src
!api-server/package.json
!api-server/tsconfig.json
!package.json
!package-lock.json
EOF

# Step 3: Build and push Docker image using Cloud Build
echo -e "${YELLOW}🔨 Building Docker image with Cloud Build...${NC}"

# Copy the Dockerfile to root temporarily for Cloud Build
cp api-server/Dockerfile.workspace Dockerfile

# Use the workspace Dockerfile
gcloud builds submit \
  --tag $IMAGE_NAME:latest \
  --timeout=30m \
  --machine-type=e2-highcpu-8 \
  --project=$PROJECT_ID \
  .

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Docker build failed${NC}"
    echo "Check the build logs above for details"
    exit 1
fi

echo "Docker image built and pushed successfully."

# Step 4: Deploy to Cloud Run
echo -e "${YELLOW}🚀 Deploying to Cloud Run...${NC}"

# Check if secrets exist in Secret Manager
USE_SECRETS=false
if gcloud secrets describe supabase-url --project=$PROJECT_ID &> /dev/null; then
    echo "Using secrets from Secret Manager..."
    USE_SECRETS=true
fi

if [ "$USE_SECRETS" = true ]; then
    # Deploy using Secret Manager
    gcloud run deploy $SERVICE_NAME \
      --image $IMAGE_NAME:latest \
      --platform managed \
      --region $REGION \
      --project=$PROJECT_ID \
      --allow-unauthenticated \
      --set-env-vars="NODE_ENV=production,AI_PROVIDER=groq" \
      --set-secrets="SUPABASE_URL=supabase-url:latest" \
      --set-secrets="SUPABASE_SERVICE_KEY=supabase-service-key:latest" \
      --set-secrets="SUPABASE_ANON_KEY=supabase-anon-key:latest" \
      --set-secrets="GROQ_API_KEY=groq-api-key:latest" \
      --set-secrets="JWT_SECRET=jwt-secret:latest" \
      --set-env-vars="JWT_EXPIRES_IN=15m" \
      --set-env-vars="REFRESH_TOKEN_EXPIRES_IN=7d" \
      --set-env-vars="FRONTEND_URL=*" \
      --min-instances=0 \
      --max-instances=10 \
      --memory=512Mi \
      --cpu=1 \
      --timeout=60 \
      --concurrency=1000
else
    # Deploy using environment variables
    gcloud run deploy $SERVICE_NAME \
      --image $IMAGE_NAME:latest \
      --platform managed \
      --region $REGION \
      --project=$PROJECT_ID \
      --allow-unauthenticated \
      --set-env-vars="NODE_ENV=production,AI_PROVIDER=groq" \
      --set-env-vars="SUPABASE_URL=$SUPABASE_URL" \
      --set-env-vars="SUPABASE_SERVICE_KEY=$SUPABASE_SERVICE_KEY" \
      --set-env-vars="SUPABASE_ANON_KEY=$SUPABASE_ANON_KEY" \
      --set-env-vars="GROQ_API_KEY=$GROQ_API_KEY" \
      --set-env-vars="JWT_SECRET=$JWT_SECRET" \
      --set-env-vars="JWT_EXPIRES_IN=15m" \
      --set-env-vars="REFRESH_TOKEN_EXPIRES_IN=7d" \
      --set-env-vars="FRONTEND_URL=*" \
      --min-instances=0 \
      --max-instances=10 \
      --memory=512Mi \
      --cpu=1 \
      --timeout=60 \
      --concurrency=1000
fi

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Deployment failed${NC}"
    exit 1
fi

echo "Deployment complete."

# Step 5: Get the service URL
SERVICE_URL=$(gcloud run services describe $SERVICE_NAME \
  --region=$REGION \
  --project=$PROJECT_ID \
  --format='value(status.url)')

# Step 6: Clean up
echo -e "${YELLOW}🧹 Cleaning up...${NC}"
rm -f .dockerignore Dockerfile

# Step 7: Test the deployment
echo -e "${YELLOW}🧪 Testing deployed service...${NC}"
echo "Testing health endpoint..."
HEALTH_STATUS=$(curl -s -o /dev/null -w "%{http_code}" $SERVICE_URL/health)
if [ "$HEALTH_STATUS" = "200" ]; then
    echo -e "${GREEN}✅ Health check passed!${NC}"
    curl -s $SERVICE_URL/health | python3 -m json.tool || true
else
    echo -e "${YELLOW}⚠️  Health check returned status: $HEALTH_STATUS${NC}"
    echo "Please check the logs:"
    echo "gcloud run logs read --service=$SERVICE_NAME --region=$REGION --project=$PROJECT_ID --limit=50"
fi

echo ""
echo "==================================="
echo -e "${GREEN}🎉 Deployment Complete!${NC}"
echo "==================================="
echo "Service URL: $SERVICE_URL"
echo ""
echo "Quick tests:"
echo "1. Health check: curl $SERVICE_URL/health"
echo "2. API test: curl -X POST $SERVICE_URL/api/auth/register -H 'Content-Type: application/json' -d '{\"email\":\"test@example.com\",\"password\":\"testpass123\"}'"
echo ""
echo "View logs:"
echo "  gcloud run logs read --service=$SERVICE_NAME --region=$REGION --project=$PROJECT_ID --limit=50"
echo ""