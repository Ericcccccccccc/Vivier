#!/bin/bash

# Simple script to deploy frontend to Vercel
# Run from project root: ./scripts/deploy-frontend.sh

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "Deploying Frontend to Vercel..."

# Load environment
if [ -f ".env.deployment" ]; then
    source .env.deployment
else
    echo "Error: .env.deployment not found!"
    exit 1
fi

# Move to web-app directory
cd web-app

# Create production environment file
echo "Setting up production environment..."
cat > .env.production << EOF
NEXT_PUBLIC_API_URL=https://vivier-api-s7xwcum6vq-uc.a.run.app
NEXT_PUBLIC_SUPABASE_URL=$SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=$SUPABASE_ANON_KEY
EOF

# Install dependencies
echo "Installing dependencies..."
npm install

# Build
echo "Building application..."
npm run build

# Deploy to Vercel
echo "Deploying to Vercel..."
if [ -n "$VERCEL_TOKEN" ]; then
    npx vercel --prod --token=$VERCEL_TOKEN --yes
    echo -e "${GREEN}✅ Frontend deployed successfully!${NC}"
else
    echo -e "${YELLOW}⚠️  No Vercel token found. Run: npx vercel --prod${NC}"
    npx vercel --prod
fi

cd ..