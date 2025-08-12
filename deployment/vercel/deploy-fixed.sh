#!/bin/bash

# Vercel Deployment Script for Frontend
# Deploys the Next.js web application to Vercel with correct API URL

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Get the directory of this script
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$SCRIPT_DIR/../.."

echo "==================================="
echo "Vercel Frontend Deployment"
echo "==================================="
echo ""

# Navigate to project root
cd "$PROJECT_ROOT"

# Check if we're in the right directory
if [ ! -d "web-app" ]; then
    echo -e "${RED}Error: web-app directory not found.${NC}"
    echo "Please run this script from the project root directory."
    exit 1
fi

cd web-app

# Check for Vercel CLI
if ! command -v vercel &> /dev/null; then
    echo "Installing Vercel CLI..."
    npm install -g vercel
fi

# Load environment variables from .env.deployment if exists
if [ -f "../.env.deployment" ]; then
    echo "Loading environment variables from .env.deployment..."
    export $(cat ../.env.deployment | grep -v '^#' | xargs)
fi

# Set the correct API URL for the new TypeScript API
API_URL="https://vivier-api-typescript-1029830533013.us-central1.run.app"
echo -e "${GREEN}Using TypeScript API URL: $API_URL${NC}"

# Get Supabase credentials (already in .env.deployment)
SUPABASE_URL="${SUPABASE_URL:-https://ftkricctldivgsdenegs.supabase.co}"
SUPABASE_ANON_KEY="${SUPABASE_ANON_KEY:-eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ0a3JpY2N0bGRpdmdzZGVuZWdzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ1NzUzMjUsImV4cCI6MjA3MDE1MTMyNX0.bHwU7flkwejQLfpGssfdoF1el6YDtPSldL4juP_iCcc}"

echo "Supabase URL: ${SUPABASE_URL:0:40}..."

# Create/update .env.production
echo "Creating .env.production file..."
cat > .env.production << EOF
# Production Environment Variables
NEXT_PUBLIC_API_URL=$API_URL
NEXT_PUBLIC_SUPABASE_URL=$SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=$SUPABASE_ANON_KEY
NEXT_PUBLIC_APP_NAME=Vivier Email AI Assistant
NEXT_PUBLIC_APP_VERSION=1.0.0
NEXT_PUBLIC_ENABLE_ANALYTICS=true
EOF

echo -e "${GREEN}✅ Environment file created${NC}"

# Create/update vercel.json with simpler configuration
echo "Creating vercel.json configuration..."
cat > vercel.json << EOF
{
  "name": "vivier-frontend",
  "version": 2,
  "framework": "nextjs",
  "buildCommand": "npm run build",
  "devCommand": "npm run dev",
  "installCommand": "npm install",
  "outputDirectory": ".next",
  "public": false,
  "env": {
    "NEXT_PUBLIC_API_URL": "$API_URL",
    "NEXT_PUBLIC_SUPABASE_URL": "$SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY": "$SUPABASE_ANON_KEY"
  },
  "build": {
    "env": {
      "NEXT_PUBLIC_API_URL": "$API_URL",
      "NEXT_PUBLIC_SUPABASE_URL": "$SUPABASE_URL",
      "NEXT_PUBLIC_SUPABASE_ANON_KEY": "$SUPABASE_ANON_KEY"
    }
  },
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "X-Content-Type-Options",
          "value": "nosniff"
        },
        {
          "key": "X-Frame-Options",
          "value": "SAMEORIGIN"
        },
        {
          "key": "X-XSS-Protection",
          "value": "1; mode=block"
        }
      ]
    }
  ]
}
EOF

echo -e "${GREEN}✅ Vercel configuration created${NC}"

# Install dependencies
echo "Installing dependencies..."
npm ci || npm install

# Build the application
echo "Building application..."
npm run build

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Build failed${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Build successful${NC}"

# Deploy to Vercel
echo ""
echo "Deploying to Vercel..."

# Check if VERCEL_TOKEN is set
if [ ! -z "$VERCEL_TOKEN" ]; then
    echo "Using token for automated deployment..."
    
    # Deploy with token (CI/CD mode)
    DEPLOYMENT_URL=$(vercel --prod --token=$VERCEL_TOKEN --yes --confirm)
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ Deployment successful!${NC}"
        echo "Deployment URL: $DEPLOYMENT_URL"
    else
        echo -e "${RED}❌ Deployment failed${NC}"
        exit 1
    fi
else
    echo -e "${YELLOW}No VERCEL_TOKEN found. Initiating interactive deployment...${NC}"
    echo "You will be prompted to login and configure the project."
    echo ""
    
    # Interactive deployment
    vercel --prod
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ Deployment successful!${NC}"
        DEPLOYMENT_URL=$(vercel ls --token=$VERCEL_TOKEN 2>/dev/null | head -n 2 | tail -n 1 | awk '{print $2}' || echo "Check Vercel dashboard")
    else
        echo -e "${RED}❌ Deployment failed${NC}"
        exit 1
    fi
fi

# Create deployment info file
cat > deployment-info.json << EOF
{
  "timestamp": "$(date -Iseconds)",
  "api_url": "$API_URL",
  "supabase_url": "$SUPABASE_URL",
  "commit": "$(git rev-parse HEAD 2>/dev/null || echo 'unknown')",
  "branch": "$(git branch --show-current 2>/dev/null || echo 'unknown')",
  "deployed_by": "$(whoami)",
  "environment": "production"
}
EOF

echo -e "${GREEN}Deployment info saved to deployment-info.json${NC}"

# Update CORS in Cloud Run if we have gcloud access
if command -v gcloud &> /dev/null; then
    echo ""
    echo "Updating CORS configuration in Cloud Run..."
    
    # Get the actual deployment URL if available
    if [ ! -z "$DEPLOYMENT_URL" ] && [ "$DEPLOYMENT_URL" != "Check Vercel dashboard" ]; then
        CORS_ORIGINS="https://vivier.app,$DEPLOYMENT_URL,https://*.vercel.app"
    else
        CORS_ORIGINS="https://vivier.app,https://*.vercel.app"
    fi
    
    gcloud run services update vivier-api-typescript \
        --region=us-central1 \
        --project=vivier-468315 \
        --update-env-vars="FRONTEND_URL=$CORS_ORIGINS" \
        2>/dev/null && echo -e "${GREEN}✅ CORS updated${NC}" || \
        echo -e "${YELLOW}⚠️  Could not update CORS. Update FRONTEND_URL env var manually in Cloud Run.${NC}"
fi

# Test the deployment
if [ ! -z "$DEPLOYMENT_URL" ] && [ "$DEPLOYMENT_URL" != "Check Vercel dashboard" ]; then
    echo ""
    echo "Testing deployment..."
    
    # Test homepage
    echo -n "Testing homepage... "
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$DEPLOYMENT_URL" 2>/dev/null || echo "000")
    if [ "$HTTP_CODE" = "200" ]; then
        echo -e "${GREEN}✅ OK${NC}"
    else
        echo -e "${YELLOW}⚠️  Status: $HTTP_CODE${NC}"
    fi
fi

# Show deployment summary
echo ""
echo "==================================="
echo -e "${GREEN}Deployment Summary${NC}"
echo "==================================="
echo -e "Status: ${GREEN}SUCCESS${NC}"
if [ ! -z "$DEPLOYMENT_URL" ]; then
    echo "Deployment URL: $DEPLOYMENT_URL"
fi
echo "API URL: $API_URL"
echo "Timestamp: $(date)"
echo ""
echo "Next steps:"
echo "1. Visit your Vercel dashboard to get the deployment URL"
echo "2. Test authentication and registration"
echo "3. Verify the app connects to the TypeScript API"
echo ""
echo "To check deployment:"
echo "  vercel ls"
echo ""
echo "To view logs:"
echo "  vercel logs"
echo "==================================="

cd ..
exit 0