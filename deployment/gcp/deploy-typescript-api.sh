#!/bin/bash

# Deploy TypeScript API Server to Google Cloud Run
# This script builds and deploys the production TypeScript API

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Get the directory of this script
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$SCRIPT_DIR/../.."
API_DIR="$PROJECT_ROOT/api-server"

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

# Check if we're in the right directory
if [ ! -d "$API_DIR" ]; then
    echo -e "${RED}❌ Error: api-server directory not found${NC}"
    echo "Please run this script from the project root directory"
    exit 1
fi

# Navigate to api-server directory
cd "$API_DIR"

# Step 1: Clean up any existing temporary files
echo -e "${YELLOW}🧹 Cleaning up any existing temporary files...${NC}"
rm -rf database-layer-temp ai-provider-layer-temp package-temp.json Dockerfile.build

# Step 2: Prepare Docker build
echo -e "${YELLOW}📦 Preparing Docker build...${NC}"

# Build workspace packages first
echo "Building workspace packages..."
cd ../database-layer && npm run build
cd ../ai-provider-layer && npm run build
cd "$API_DIR"

# Copy workspace packages to api-server directory temporarily (including built files)
echo "Copying workspace packages (source and dist)..."
mkdir -p database-layer-temp/src
mkdir -p database-layer-temp/dist
mkdir -p ai-provider-layer-temp/src
mkdir -p ai-provider-layer-temp/dist
cp -r ../database-layer/src/* ./database-layer-temp/src/
cp -r ../database-layer/dist/* ./database-layer-temp/dist/ 2>/dev/null || true
cp -r ../database-layer/package.json ./database-layer-temp/
cp -r ../database-layer/tsconfig.json ./database-layer-temp/
cp -r ../ai-provider-layer/src/* ./ai-provider-layer-temp/src/
cp -r ../ai-provider-layer/dist/* ./ai-provider-layer-temp/dist/ 2>/dev/null || true
cp -r ../ai-provider-layer/package.json ./ai-provider-layer-temp/
cp -r ../ai-provider-layer/tsconfig.json ./ai-provider-layer-temp/

# Create a temporary package.json that references local packages
cat > package-temp.json << EOF
{
  "name": "@email-ai/api-server",
  "version": "1.0.0",
  "description": "Express API server for email AI system on Google Cloud Run",
  "main": "dist/index.js",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "test": "jest",
    "lint": "eslint src --ext .ts",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@email-ai/database": "file:./database-layer-temp",
    "@email-ai/ai-provider": "file:./ai-provider-layer-temp",
    "express": "^4.18.0",
    "cors": "^2.8.5",
    "helmet": "^7.0.0",
    "compression": "^1.7.4",
    "express-rate-limit": "^6.0.0",
    "jsonwebtoken": "^9.0.0",
    "bcrypt": "^5.1.0",
    "pino": "^8.0.0",
    "pino-http": "^8.0.0",
    "pino-pretty": "^10.0.0",
    "zod": "^3.22.0",
    "dotenv": "^16.0.0"
  },
  "devDependencies": {
    "@types/express": "^4.17.17",
    "@types/cors": "^2.8.13",
    "@types/compression": "^1.7.2",
    "@types/bcrypt": "^5.0.0",
    "@types/jsonwebtoken": "^9.0.2",
    "@types/node": "^20.0.0",
    "typescript": "^5.0.0",
    "tsx": "^3.0.0",
    "jest": "^29.0.0",
    "@types/jest": "^29.0.0",
    "ts-jest": "^29.0.0",
    "supertest": "^6.0.0",
    "@types/supertest": "^2.0.12",
    "eslint": "^8.0.0",
    "@typescript-eslint/eslint-plugin": "^5.0.0",
    "@typescript-eslint/parser": "^5.0.0"
  }
}
EOF

# Temporarily rename existing Dockerfile if it exists
if [ -f "Dockerfile" ]; then
  mv Dockerfile Dockerfile.original
fi

# Create a modified Dockerfile for the build
cat > Dockerfile << 'EOF'
# Multi-stage build for TypeScript API
FROM node:20-alpine AS builder

WORKDIR /app

# Copy workspace packages first
COPY database-layer-temp ./database-layer-temp
COPY ai-provider-layer-temp ./ai-provider-layer-temp

# Copy package files
COPY package-temp.json ./package.json
COPY tsconfig.json ./

# Fresh install of dependencies
RUN npm install

# Copy source
COPY src ./src

# Build TypeScript
RUN npm run build

# Production stage
FROM node:20-alpine

WORKDIR /app

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Copy workspace packages
COPY --from=builder --chown=nodejs:nodejs /app/database-layer-temp ./database-layer-temp
COPY --from=builder --chown=nodejs:nodejs /app/ai-provider-layer-temp ./ai-provider-layer-temp

# Copy package files
COPY --from=builder --chown=nodejs:nodejs /app/package.json ./

# Copy node_modules (includes built workspace packages)
COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules

# Copy built application
COPY --from=builder --chown=nodejs:nodejs /app/dist ./dist

# Switch to non-root user
USER nodejs

# Expose port (Cloud Run uses PORT env var)
ENV PORT=8080
ENV NODE_ENV=production

EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:8080/health', (r) => {r.statusCode === 200 ? process.exit(0) : process.exit(1)})"

# Start with dumb-init for proper signal handling
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/index.js"]
EOF

# Step 3: Build and push Docker image using Cloud Build
echo -e "${YELLOW}🔨 Building Docker image with Cloud Build...${NC}"

# Simply use the Dockerfile.build directly
gcloud builds submit \
  --tag $IMAGE_NAME:latest \
  --timeout=20m \
  --machine-type=e2-medium \
  --project=$PROJECT_ID \
  .

echo "Docker image built and pushed successfully."

# Step 4: Check if service exists
echo "Checking if Cloud Run service exists..."
if gcloud run services describe $SERVICE_NAME --region=$REGION --project=$PROJECT_ID &> /dev/null; then
    echo "Service exists. Updating..."
    DEPLOY_CMD="update"
else
    echo "Service doesn't exist. Creating..."
    DEPLOY_CMD="deploy"
fi

# Step 5: Deploy to Cloud Run
echo -e "${YELLOW}🚀 Deploying to Cloud Run...${NC}"

# Check if secrets exist in Secret Manager and use them if available
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

echo "Deployment complete."

# Step 6: Get the service URL
SERVICE_URL=$(gcloud run services describe $SERVICE_NAME \
  --region=$REGION \
  --project=$PROJECT_ID \
  --format='value(status.url)')

# Step 7: Clean up temporary files
echo -e "${YELLOW}🧹 Cleaning up temporary files...${NC}"
rm -rf database-layer-temp ai-provider-layer-temp
rm -f package-temp.json Dockerfile cloudbuild.yaml

# Restore original Dockerfile if it exists
if [ -f "Dockerfile.original" ]; then
  mv Dockerfile.original Dockerfile
fi

# Step 8: Test the deployment
echo -e "${YELLOW}🧪 Testing deployed service...${NC}"
echo "Testing health endpoint..."
HEALTH_STATUS=$(curl -s -o /dev/null -w "%{http_code}" $SERVICE_URL/health)
if [ "$HEALTH_STATUS" = "200" ]; then
    echo -e "${GREEN}✅ Health check passed!${NC}"
    curl -s $SERVICE_URL/health | python3 -m json.tool || true
else
    echo -e "${YELLOW}⚠️  Health check returned status: $HEALTH_STATUS${NC}"
    echo "Please check the logs:"
    echo "gcloud run logs read --service=$SERVICE_NAME --region=$REGION --project=$PROJECT_ID"
fi

echo ""
echo "==================================="
echo -e "${GREEN}🎉 Deployment Successful!${NC}"
echo "==================================="
echo "Service URL: $SERVICE_URL"
echo ""
echo "Next steps:"
echo "1. The TypeScript API is now deployed at: $SERVICE_URL"
echo "2. Test authentication: curl -X POST $SERVICE_URL/api/auth/register -H 'Content-Type: application/json' -d '{\"email\":\"test@example.com\",\"password\":\"testpass123\"}'"
echo "3. Update your frontend to use this API URL"
echo ""
echo "To view logs:"
echo "  gcloud run logs read --service=$SERVICE_NAME --region=$REGION --project=$PROJECT_ID"
echo ""
echo "To rollback if needed:"
echo "  ./rollback.sh $SERVICE_NAME"
echo ""