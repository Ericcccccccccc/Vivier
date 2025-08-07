#!/bin/bash

# Vercel Deployment Script for Frontend
# Deploys the Next.js web application to Vercel

set -e

# Configuration
PROJECT_NAME="email-ai-assistant"
VERCEL_ORG_ID="${VERCEL_ORG_ID}"
VERCEL_PROJECT_ID="${VERCEL_PROJECT_ID}"
VERCEL_TOKEN="${VERCEL_TOKEN}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo "==================================="
echo "Vercel Frontend Deployment"
echo "Project: $PROJECT_NAME"
echo "==================================="
echo ""

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

# Check for required environment variables
if [ -z "$VERCEL_TOKEN" ]; then
    echo -e "${YELLOW}Warning: VERCEL_TOKEN not set.${NC}"
    echo "You will need to login manually or set the token."
    echo "Get your token from: https://vercel.com/account/tokens"
    read -p "Enter Vercel token (or press Enter to login manually): " VERCEL_TOKEN
fi

# Get API URL from Cloud Run
echo "Getting API URL from GCP..."
API_URL=$(gcloud run services describe email-ai-api \
    --region=us-central1 \
    --format='value(status.url)' 2>/dev/null || echo "")

if [ -z "$API_URL" ]; then
    echo -e "${YELLOW}Warning: Could not fetch API URL from GCP.${NC}"
    read -p "Enter API URL manually: " API_URL
fi

echo "API URL: $API_URL"

# Get Supabase credentials
echo "Getting Supabase configuration..."
SUPABASE_URL=$(gcloud secrets versions access latest --secret=supabase-url 2>/dev/null || echo "")
SUPABASE_ANON_KEY=$(gcloud secrets versions access latest --secret=supabase-anon-key 2>/dev/null || echo "")

if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_ANON_KEY" ]; then
    echo -e "${YELLOW}Warning: Could not fetch Supabase credentials from Secret Manager.${NC}"
    
    if [ -z "$SUPABASE_URL" ]; then
        read -p "Enter Supabase URL: " SUPABASE_URL
    fi
    
    if [ -z "$SUPABASE_ANON_KEY" ]; then
        read -p "Enter Supabase Anon Key: " SUPABASE_ANON_KEY
    fi
fi

# Create/update .env.production
echo "Creating .env.production file..."
cat > .env.production << EOF
# Production Environment Variables
NEXT_PUBLIC_API_URL=$API_URL
NEXT_PUBLIC_SUPABASE_URL=$SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=$SUPABASE_ANON_KEY
NEXT_PUBLIC_APP_NAME=Email AI Assistant
NEXT_PUBLIC_APP_VERSION=1.0.0
NEXT_PUBLIC_ENABLE_ANALYTICS=true
NEXT_PUBLIC_SENTRY_DSN=
EOF

echo -e "${GREEN}✅ Environment file created${NC}"

# Create/update vercel.json
echo "Creating vercel.json configuration..."
cat > vercel.json << EOF
{
  "name": "$PROJECT_NAME",
  "version": 2,
  "framework": "nextjs",
  "buildCommand": "npm run build",
  "devCommand": "npm run dev",
  "installCommand": "npm install",
  "outputDirectory": ".next",
  "public": false,
  "github": {
    "enabled": true,
    "autoAlias": true
  },
  "env": {
    "NEXT_PUBLIC_API_URL": "@api_url",
    "NEXT_PUBLIC_SUPABASE_URL": "@supabase_url",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY": "@supabase_anon_key",
    "NEXT_PUBLIC_APP_NAME": "Email AI Assistant",
    "NEXT_PUBLIC_APP_VERSION": "1.0.0"
  },
  "build": {
    "env": {
      "NEXT_PUBLIC_API_URL": "@api_url",
      "NEXT_PUBLIC_SUPABASE_URL": "@supabase_url",
      "NEXT_PUBLIC_SUPABASE_ANON_KEY": "@supabase_anon_key"
    }
  },
  "headers": [
    {
      "source": "/api/(.*)",
      "headers": [
        {
          "key": "Cache-Control",
          "value": "no-cache, no-store, must-revalidate"
        }
      ]
    },
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
  ],
  "rewrites": [
    {
      "source": "/api/v1/:path*",
      "destination": "$API_URL/api/v1/:path*"
    }
  ],
  "redirects": [
    {
      "source": "/api",
      "destination": "/api/v1",
      "permanent": false
    }
  ],
  "functions": {
    "pages/api/*.ts": {
      "maxDuration": 10
    }
  },
  "regions": ["iad1"]
}
EOF

echo -e "${GREEN}✅ Vercel configuration created${NC}"

# Install dependencies
echo "Installing dependencies..."
npm ci

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

if [ ! -z "$VERCEL_TOKEN" ]; then
    # Deploy with token (CI/CD mode)
    DEPLOY_COMMAND="vercel --prod --token=$VERCEL_TOKEN --yes"
    
    # Set environment variables
    echo "Setting environment variables..."
    vercel env add NEXT_PUBLIC_API_URL production --token=$VERCEL_TOKEN --yes <<< "$API_URL"
    vercel env add NEXT_PUBLIC_SUPABASE_URL production --token=$VERCEL_TOKEN --yes <<< "$SUPABASE_URL"
    vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production --token=$VERCEL_TOKEN --yes <<< "$SUPABASE_ANON_KEY"
else
    # Interactive deployment
    DEPLOY_COMMAND="vercel --prod"
    echo -e "${YELLOW}Manual deployment mode. You may need to login.${NC}"
fi

# Execute deployment
DEPLOYMENT_URL=$(eval $DEPLOY_COMMAND)

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Deployment successful!${NC}"
    echo "Deployment URL: $DEPLOYMENT_URL"
    
    # Update CORS in Cloud Run
    echo ""
    echo "Updating CORS configuration in Cloud Run..."
    gcloud run services update email-ai-api \
        --region=us-central1 \
        --update-env-vars="CORS_ORIGIN=$DEPLOYMENT_URL" \
        2>/dev/null || echo -e "${YELLOW}Warning: Could not update CORS. Please update manually.${NC}"
    
    # Create deployment info file
    cat > deployment-info.json << EOF
{
  "timestamp": "$(date -Iseconds)",
  "url": "$DEPLOYMENT_URL",
  "api_url": "$API_URL",
  "commit": "$(git rev-parse HEAD 2>/dev/null || echo 'unknown')",
  "branch": "$(git branch --show-current 2>/dev/null || echo 'unknown')",
  "deployed_by": "$(whoami)",
  "environment": "production"
}
EOF
    
    echo -e "${GREEN}Deployment info saved to deployment-info.json${NC}"
    
    # Test the deployment
    echo ""
    echo "Testing deployment..."
    
    # Test homepage
    echo -n "Testing homepage... "
    if curl -s -o /dev/null -w "%{http_code}" "$DEPLOYMENT_URL" | grep -q "200"; then
        echo -e "${GREEN}✅ OK${NC}"
    else
        echo -e "${YELLOW}⚠️  Failed${NC}"
    fi
    
    # Test API proxy
    echo -n "Testing API proxy... "
    if curl -s -o /dev/null -w "%{http_code}" "$DEPLOYMENT_URL/api/v1/health" | grep -q "200"; then
        echo -e "${GREEN}✅ OK${NC}"
    else
        echo -e "${YELLOW}⚠️  Failed (this may be normal if API requires auth)${NC}"
    fi
    
else
    echo -e "${RED}❌ Deployment failed${NC}"
    exit 1
fi

# Create alias for production
if [ ! -z "$VERCEL_TOKEN" ]; then
    echo ""
    echo "Setting up production alias..."
    vercel alias set "$DEPLOYMENT_URL" email-ai.vercel.app --token=$VERCEL_TOKEN 2>/dev/null || \
        echo -e "${YELLOW}Note: Could not set alias. You may need to configure it manually.${NC}"
fi

# Show deployment summary
echo ""
echo "==================================="
echo "Deployment Summary"
echo "==================================="
echo -e "Status: ${GREEN}SUCCESS${NC}"
echo "Production URL: $DEPLOYMENT_URL"
echo "API URL: $API_URL"
echo "Timestamp: $(date)"
echo ""
echo "Next steps:"
echo "1. Visit $DEPLOYMENT_URL to verify the deployment"
echo "2. Test authentication and core features"
echo "3. Monitor logs: vercel logs --token=$VERCEL_TOKEN"
echo "4. Check analytics: https://vercel.com/dashboard"
echo ""
echo "To rollback this deployment:"
echo "vercel rollback --token=$VERCEL_TOKEN"
echo "==================================="

cd ..
exit 0