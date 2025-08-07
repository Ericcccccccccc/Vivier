#!/bin/bash

# Deploy API to Cloud Run
# This script builds and deploys the API server to Google Cloud Run

set -e

# Configuration
PROJECT_ID="${PROJECT_ID:-email-ai-assistant}"
REGION="${REGION:-us-central1}"
SERVICE_NAME="email-ai-api"
IMAGE_NAME="gcr.io/$PROJECT_ID/$SERVICE_NAME"

echo "==================================="
echo "Deploying API to Cloud Run"
echo "==================================="
echo "Project: $PROJECT_ID"
echo "Region: $REGION"
echo "Service: $SERVICE_NAME"
echo ""

# Check if we're in the right directory
if [ ! -d "api-server" ]; then
    echo "Error: api-server directory not found."
    echo "Please run this script from the project root directory."
    exit 1
fi

# Check if Dockerfile exists
if [ ! -f "api-server/Dockerfile" ]; then
    echo "Creating Dockerfile for API server..."
    cat > api-server/Dockerfile << 'EOF'
# Multi-stage build for smaller image size
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies
RUN npm ci

# Copy source code
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

# Copy package files
COPY package*.json ./

# Install production dependencies only
RUN npm ci --production && \
    npm cache clean --force

# Copy built application from builder
COPY --from=builder /app/dist ./dist

# Copy any additional files needed
COPY --from=builder /app/tsconfig.json ./

# Change ownership to nodejs user
RUN chown -R nodejs:nodejs /app

# Switch to non-root user
USER nodejs

# Expose port (Cloud Run uses PORT env variable)
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:8080/health', (r) => {r.statusCode === 200 ? process.exit(0) : process.exit(1)})"

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start the application
CMD ["node", "dist/server.js"]
EOF
    echo "Dockerfile created."
fi

# Check if .dockerignore exists
if [ ! -f "api-server/.dockerignore" ]; then
    echo "Creating .dockerignore..."
    cat > api-server/.dockerignore << 'EOF'
node_modules
npm-debug.log
.env
.env.*
.git
.gitignore
README.md
.DS_Store
coverage
.nyc_output
.vscode
.idea
*.log
dist
build
test
tests
*.test.ts
*.spec.ts
EOF
    echo ".dockerignore created."
fi

# Build and push Docker image using Cloud Build
echo "Building Docker image with Cloud Build..."
gcloud builds submit \
  --tag $IMAGE_NAME:latest \
  --tag $IMAGE_NAME:$(date +%Y%m%d-%H%M%S) \
  --timeout=20m \
  --machine-type=e2-medium \
  ./api-server

echo "Docker image built and pushed successfully."

# Check if service exists
echo "Checking if Cloud Run service exists..."
if gcloud run services describe $SERVICE_NAME --region=$REGION &> /dev/null; then
    echo "Service exists. Updating..."
    DEPLOY_CMD="update"
else
    echo "Service doesn't exist. Creating..."
    DEPLOY_CMD="deploy"
fi

# Deploy to Cloud Run
echo "Deploying to Cloud Run..."
gcloud run deploy $SERVICE_NAME \
  --image $IMAGE_NAME:latest \
  --platform managed \
  --region $REGION \
  --allow-unauthenticated \
  --set-env-vars="NODE_ENV=production" \
  --set-env-vars="PORT=8080" \
  --set-env-vars="LOG_LEVEL=info" \
  --set-env-vars="RATE_LIMIT_WINDOW_MS=60000" \
  --set-env-vars="RATE_LIMIT_MAX=100" \
  --set-env-vars="MAX_FILE_SIZE=10485760" \
  --set-env-vars="CORS_ORIGIN=https://email-ai.vercel.app" \
  --set-secrets="SUPABASE_URL=supabase-url:latest" \
  --set-secrets="SUPABASE_SERVICE_KEY=supabase-service-key:latest" \
  --set-secrets="GROQ_API_KEY=groq-api-key:latest" \
  --set-secrets="JWT_SECRET=jwt-secret:latest" \
  --set-secrets="OPENAI_API_KEY=openai-api-key:latest" \
  --min-instances=0 \
  --max-instances=10 \
  --memory=512Mi \
  --cpu=1 \
  --timeout=60 \
  --concurrency=1000 \
  --service-account=email-ai-api@$PROJECT_ID.iam.gserviceaccount.com \
  --labels="app=email-ai,component=api,environment=production"

echo "Deployment complete."

# Get the service URL
SERVICE_URL=$(gcloud run services describe $SERVICE_NAME \
  --region=$REGION \
  --format='value(status.url)')

echo ""
echo "==================================="
echo "Deployment Successful!"
echo "==================================="
echo "Service URL: $SERVICE_URL"
echo ""
echo "Testing the deployment..."

# Test the health endpoint
echo "Testing health endpoint..."
HEALTH_STATUS=$(curl -s -o /dev/null -w "%{http_code}" $SERVICE_URL/health)
if [ "$HEALTH_STATUS" = "200" ]; then
    echo "✅ Health check passed!"
else
    echo "⚠️  Health check returned status: $HEALTH_STATUS"
    echo "Please check the logs:"
    echo "gcloud run logs read --service=$SERVICE_NAME --region=$REGION"
fi

# Set up traffic management (optional)
echo ""
echo "Traffic configuration:"
gcloud run services describe $SERVICE_NAME \
  --region=$REGION \
  --format="table(spec.traffic[].percent, spec.traffic[].revisionName, spec.traffic[].tag)"

# Set up domain mapping (optional)
echo ""
echo "To map a custom domain, run:"
echo "gcloud run domain-mappings create --service=$SERVICE_NAME --domain=YOUR_DOMAIN --region=$REGION"

# Output useful commands
echo ""
echo "Useful commands:"
echo "- View logs: gcloud run logs read --service=$SERVICE_NAME --region=$REGION"
echo "- View metrics: gcloud monitoring metrics-descriptors list --filter=\"metric.type:run.googleapis.com\""
echo "- Update traffic: gcloud run services update-traffic $SERVICE_NAME --region=$REGION --to-latest"
echo "- Rollback: gcloud run services update-traffic $SERVICE_NAME --region=$REGION --to-revisions=REVISION_NAME=100"
echo ""
echo "Remember to:"
echo "1. Update the CORS_ORIGIN environment variable with your frontend URL"
echo "2. Configure the frontend to use this API URL: $SERVICE_URL"
echo "3. Monitor usage to stay within free tier limits (2M requests/month)"