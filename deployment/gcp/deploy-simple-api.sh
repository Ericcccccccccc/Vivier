#!/bin/bash

# Deploy Simple API to Cloud Run
# This script builds and deploys the simple API server to Google Cloud Run

set -e

# Load environment variables
if [ -f ".env.deployment" ]; then
    export $(cat .env.deployment | grep -v '^#' | xargs)
fi

# Configuration
PROJECT_ID="${PROJECT_ID:-vivier-468315}"
REGION="${REGION:-us-central1}"
SERVICE_NAME="vivier-api"
IMAGE_NAME="gcr.io/$PROJECT_ID/$SERVICE_NAME"

echo "==================================="
echo "Deploying Simple API to Cloud Run"
echo "==================================="
echo "Project: $PROJECT_ID"
echo "Region: $REGION"
echo "Service: $SERVICE_NAME"
echo ""

# Check if we're in the right directory
if [ ! -d "api-simple" ]; then
    echo "Error: api-simple directory not found."
    echo "Please run this script from the project root directory."
    exit 1
fi

# Build and push Docker image using Cloud Build
echo "Building Docker image with Cloud Build..."
gcloud builds submit \
  --tag $IMAGE_NAME:latest \
  --tag $IMAGE_NAME:$(date +%Y%m%d-%H%M%S) \
  --timeout=20m \
  --machine-type=e2-medium \
  --project=$PROJECT_ID \
  ./api-simple

echo "Docker image built and pushed successfully."

# Check if service exists
echo "Checking if Cloud Run service exists..."
if gcloud run services describe $SERVICE_NAME --region=$REGION --project=$PROJECT_ID &> /dev/null; then
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
  --project=$PROJECT_ID \
  --allow-unauthenticated \
  --set-env-vars="NODE_ENV=production" \
  --set-env-vars="SUPABASE_URL=$SUPABASE_URL" \
  --set-env-vars="SUPABASE_ANON_KEY=$SUPABASE_ANON_KEY" \
  --set-env-vars="SUPABASE_SERVICE_KEY=$SUPABASE_SERVICE_KEY" \
  --set-env-vars="GROQ_API_KEY=$GROQ_API_KEY" \
  --set-env-vars="JWT_SECRET=$JWT_SECRET" \
  --min-instances=0 \
  --max-instances=10 \
  --memory=512Mi \
  --cpu=1 \
  --timeout=60 \
  --concurrency=1000

echo "Deployment complete."

# Get the service URL
SERVICE_URL=$(gcloud run services describe $SERVICE_NAME \
  --region=$REGION \
  --project=$PROJECT_ID \
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
    echo "gcloud run logs read --service=$SERVICE_NAME --region=$REGION --project=$PROJECT_ID"
fi

echo ""
echo "Next steps:"
echo "1. The API is now deployed at: $SERVICE_URL"
echo "2. Test authentication: curl -X POST $SERVICE_URL/api/auth/register -H 'Content-Type: application/json' -d '{\"email\":\"test@example.com\",\"password\":\"testpass123\"}'"
echo "3. Update your frontend to use this API URL"
echo ""