#!/bin/bash

# Deploy API to Google Cloud Run

set -e
source .env.deployment

echo "Building and deploying API to Cloud Run..."
echo "Project: $PROJECT_ID"
echo "Region: $REGION"

cd api-server

# Enable required APIs
echo "Enabling required Google Cloud APIs..."
gcloud services enable \
    run.googleapis.com \
    containerregistry.googleapis.com \
    cloudbuild.googleapis.com \
    --project=$PROJECT_ID

# Configure Docker for GCR
echo "Configuring Docker for Google Container Registry..."
gcloud auth configure-docker --quiet

# Build the Docker image
echo "Building Docker image..."
docker build -t gcr.io/$PROJECT_ID/email-ai-api .

# Push to Container Registry
echo "Pushing image to Container Registry..."
docker push gcr.io/$PROJECT_ID/email-ai-api

# Deploy to Cloud Run
echo "Deploying to Cloud Run..."
gcloud run deploy email-ai-api \
    --image gcr.io/$PROJECT_ID/email-ai-api \
    --platform managed \
    --region $REGION \
    --allow-unauthenticated \
    --set-secrets="SUPABASE_URL=supabase-url:latest,SUPABASE_SERVICE_KEY=supabase-service-key:latest,GROQ_API_KEY=groq-api-key:latest,JWT_SECRET=jwt-secret:latest" \
    --set-env-vars="NODE_ENV=production,SUPABASE_ANON_KEY=$SUPABASE_ANON_KEY,DATABASE_PROVIDER=supabase,AI_PROVIDER=groq,FRONTEND_URL=https://vivier.vercel.app" \
    --min-instances=0 \
    --max-instances=10 \
    --memory=512Mi \
    --cpu=1 \
    --timeout=60 \
    --project=$PROJECT_ID

# Get the service URL
API_URL=$(gcloud run services describe email-ai-api --region=$REGION --format='value(status.url)' --project=$PROJECT_ID)

echo ""
echo "✅ API deployed successfully!"
echo "API URL: $API_URL"
echo ""
echo "You can test it with:"
echo "curl $API_URL/health"

# Save the API URL for next steps
echo "export API_URL=$API_URL" > api-url.sh

cd ..