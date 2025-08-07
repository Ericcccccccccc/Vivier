#!/bin/bash

# ====================================
# Vivier Deployment Helper Script
# ====================================
# This script helps you deploy the entire Vivier stack to production
# using GCP, Supabase, and Vercel free tiers

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m' # No Color

# Script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Banner
clear
echo -e "${CYAN}${BOLD}"
echo "╔══════════════════════════════════════════════════════════╗"
echo "║          Vivier Email AI Assistant Deployment           ║"
echo "║                    Free Tier Edition                    ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo -e "${NC}"

# Function to print section headers
print_section() {
    echo -e "\n${BLUE}${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}${BOLD}  $1${NC}"
    echo -e "${BLUE}${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"
}

# Function to print status
print_status() {
    echo -e "${CYAN}▶${NC} $1"
}

# Function to print success
print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

# Function to print warning
print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

# Function to print error
print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Function to ask for confirmation
confirm() {
    read -p "$(echo -e ${YELLOW}"$1 (y/n): "${NC})" -n 1 -r
    echo
    [[ $REPLY =~ ^[Yy]$ ]]
}

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to validate email
validate_email() {
    [[ "$1" =~ ^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$ ]]
}

# Function to generate JWT secret
generate_jwt_secret() {
    openssl rand -base64 32 | tr -d '\n'
}

# Check for .env.deployment file
print_section "Step 1: Environment Configuration"

if [ ! -f ".env.deployment" ]; then
    print_error ".env.deployment file not found!"
    print_status "Creating template file..."
    exit 1
fi

# Source environment variables
print_status "Loading environment variables..."
set -a  # Export all variables
source .env.deployment
set +a

# Validate required tools
print_section "Step 2: Checking Prerequisites"

MISSING_TOOLS=()

# Check for required commands
for cmd in gcloud docker node npm git openssl curl; do
    if command_exists "$cmd"; then
        print_success "$cmd is installed"
    else
        MISSING_TOOLS+=("$cmd")
        print_error "$cmd is not installed"
    fi
done

if [ ${#MISSING_TOOLS[@]} -gt 0 ]; then
    print_error "Missing required tools: ${MISSING_TOOLS[*]}"
    print_warning "Please install missing tools and try again"
    echo
    echo "Installation commands:"
    echo "  - gcloud: https://cloud.google.com/sdk/docs/install"
    echo "  - docker: curl -fsSL https://get.docker.com | sh"
    echo "  - node/npm: curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - && sudo apt-get install -y nodejs"
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    print_warning "Node.js version should be 18 or higher (current: $(node -v))"
fi

# Validate required environment variables
print_section "Step 3: Validating Configuration"

MISSING_VARS=()
WARNINGS=()

# Check required variables
required_vars=(
    "PROJECT_ID"
    "SUPABASE_URL"
    "SUPABASE_ANON_KEY"
    "SUPABASE_SERVICE_KEY"
    "GROQ_API_KEY"
    "VERCEL_TOKEN"
)

for var in "${required_vars[@]}"; do
    if [ -z "${!var}" ]; then
        MISSING_VARS+=("$var")
        print_error "$var is not set"
    else
        # Mask sensitive values in output
        if [[ "$var" == *"KEY"* ]] || [[ "$var" == *"TOKEN"* ]] || [[ "$var" == *"SECRET"* ]]; then
            masked_value="${!var:0:10}..."
            print_success "$var is set ($masked_value)"
        else
            print_success "$var is set (${!var})"
        fi
    fi
done

# Check optional but recommended variables
if [ -z "$BILLING_ACCOUNT_ID" ]; then
    WARNINGS+=("BILLING_ACCOUNT_ID not set - you'll need to link billing manually")
    print_warning "BILLING_ACCOUNT_ID not set"
fi

if [ -z "$JWT_SECRET" ]; then
    print_warning "JWT_SECRET not set - generating one for you..."
    JWT_SECRET=$(generate_jwt_secret)
    echo "JWT_SECRET=$JWT_SECRET" >> .env.deployment
    print_success "JWT_SECRET generated and saved"
fi

if [ -z "$ALERT_EMAIL" ]; then
    WARNINGS+=("ALERT_EMAIL not set - you won't receive monitoring alerts")
    print_warning "ALERT_EMAIL not set"
elif ! validate_email "$ALERT_EMAIL"; then
    print_error "ALERT_EMAIL is not a valid email address"
    MISSING_VARS+=("ALERT_EMAIL (invalid)")
fi

# Check if there are missing required variables
if [ ${#MISSING_VARS[@]} -gt 0 ]; then
    echo
    print_error "Missing required configuration!"
    echo
    echo -e "${YELLOW}Please edit .env.deployment and add the missing values:${NC}"
    echo
    for var in "${MISSING_VARS[@]}"; do
        echo "  - $var"
    done
    echo
    echo -e "${CYAN}Need help getting these values?${NC}"
    echo "  - SUPABASE_*: Visit https://app.supabase.com and create a project"
    echo "  - GROQ_API_KEY: Visit https://console.groq.com/keys"
    echo "  - VERCEL_TOKEN: Visit https://vercel.com/account/tokens"
    echo "  - BILLING_ACCOUNT_ID: Run 'gcloud billing accounts list'"
    echo
    exit 1
fi

# Show warnings if any
if [ ${#WARNINGS[@]} -gt 0 ]; then
    echo
    print_warning "Warnings:"
    for warning in "${WARNINGS[@]}"; do
        echo "  - $warning"
    done
    echo
    if ! confirm "Continue despite warnings?"; then
        exit 0
    fi
fi

# Check GCloud authentication
print_section "Step 4: Google Cloud Authentication"

if ! gcloud auth list --filter=status:ACTIVE --format="value(account)" | grep -q .; then
    print_warning "Not logged in to Google Cloud"
    print_status "Please authenticate with your Google account..."
    gcloud auth login
else
    ACCOUNT=$(gcloud auth list --filter=status:ACTIVE --format="value(account)")
    print_success "Authenticated as: $ACCOUNT"
fi

# Check if project exists
if gcloud projects describe "$PROJECT_ID" >/dev/null 2>&1; then
    print_success "Project $PROJECT_ID exists"
    if ! confirm "Use existing project $PROJECT_ID?"; then
        read -p "Enter new project ID: " NEW_PROJECT_ID
        PROJECT_ID=$NEW_PROJECT_ID
        # Update .env.deployment
        sed -i "s/^PROJECT_ID=.*/PROJECT_ID=$PROJECT_ID/" .env.deployment
    fi
else
    print_warning "Project $PROJECT_ID does not exist"
    if confirm "Create new project $PROJECT_ID?"; then
        CREATE_PROJECT=true
    else
        read -p "Enter existing project ID: " NEW_PROJECT_ID
        PROJECT_ID=$NEW_PROJECT_ID
        # Update .env.deployment
        sed -i "s/^PROJECT_ID=.*/PROJECT_ID=$PROJECT_ID/" .env.deployment
    fi
fi

# Summary before deployment
print_section "Step 5: Deployment Summary"

echo -e "${BOLD}Configuration:${NC}"
echo "  Project ID:        $PROJECT_ID"
echo "  Region:            $REGION"
echo "  Zone:              $ZONE"
echo "  GitHub User:       $GITHUB_USER"
echo "  Deployment Env:    ${DEPLOYMENT_ENV:-production}"
echo
echo -e "${BOLD}Services to Deploy:${NC}"
echo "  ✓ Supabase Database (already in cloud)"
echo "  ✓ Google Cloud Run API"
echo "  ✓ Vercel Frontend"
echo "  ✓ WhatsApp Bot on VM"
echo "  ✓ Monitoring & Backups"
echo
echo -e "${BOLD}Estimated Costs:${NC}"
echo "  ${GREEN}✓ All services within free tier limits${NC}"
echo "  - Cloud Run: 2M requests/month free"
echo "  - VM: 1 e2-micro free forever"
echo "  - Vercel: Hobby plan free"
echo "  - Supabase: 500MB database free"
echo

if [ "$DRY_RUN" == "true" ]; then
    print_warning "DRY RUN MODE - No actual changes will be made"
fi

if ! confirm "Ready to deploy?"; then
    print_warning "Deployment cancelled"
    exit 0
fi

# Export variables for child scripts
export PROJECT_ID REGION ZONE BILLING_ACCOUNT_ID GITHUB_USER
export SUPABASE_URL SUPABASE_ANON_KEY SUPABASE_SERVICE_KEY
export GROQ_API_KEY JWT_SECRET VERCEL_TOKEN
export ALERT_EMAIL ADMIN_WHATSAPP_NUMBER
export DRY_RUN VERBOSE

# Start deployment
print_section "Step 6: Starting Deployment"

# Track deployment progress
DEPLOYMENT_LOG="deployment-$(date +%Y%m%d-%H%M%S).log"
echo "Deployment started at $(date)" > "$DEPLOYMENT_LOG"

# Function to run deployment step
run_step() {
    local step_name="$1"
    local script_path="$2"
    
    print_status "Running: $step_name"
    
    if [ "$DRY_RUN" == "true" ]; then
        print_warning "[DRY RUN] Would execute: $script_path"
        return 0
    fi
    
    if [ -f "$script_path" ]; then
        if bash "$script_path" >> "$DEPLOYMENT_LOG" 2>&1; then
            print_success "$step_name completed"
            return 0
        else
            print_error "$step_name failed! Check $DEPLOYMENT_LOG for details"
            return 1
        fi
    else
        print_error "Script not found: $script_path"
        return 1
    fi
}

# Phase 1: GCP Project Setup
print_section "Phase 1: Google Cloud Setup"

if [ "$CREATE_PROJECT" == "true" ] || ! gcloud projects describe "$PROJECT_ID" >/dev/null 2>&1; then
    run_step "Setting up GCP project" "deployment/gcp/setup-project.sh"
else
    print_success "Using existing project $PROJECT_ID"
fi

# Phase 2: Secrets Configuration
print_section "Phase 2: Configuring Secrets"

run_step "Setting up secrets in Secret Manager" "deployment/gcp/secrets.sh"

# Phase 3: Deploy API
print_section "Phase 3: Deploying Backend API"

run_step "Building and deploying API to Cloud Run" "deployment/gcp/deploy-api.sh"

# Get API URL
if [ "$DRY_RUN" != "true" ]; then
    API_URL=$(gcloud run services describe email-ai-api --region="$REGION" --format='value(status.url)' 2>/dev/null || echo "")
    if [ -n "$API_URL" ]; then
        print_success "API deployed at: $API_URL"
        export API_URL
    else
        print_warning "Could not retrieve API URL"
    fi
fi

# Phase 4: Deploy Frontend
print_section "Phase 4: Deploying Frontend"

cd web-app
if [ "$DRY_RUN" != "true" ]; then
    print_status "Installing frontend dependencies..."
    npm ci
    
    print_status "Building frontend..."
    npm run build
    
    print_status "Deploying to Vercel..."
    if [ -n "$VERCEL_TOKEN" ]; then
        DEPLOYMENT_URL=$(vercel --prod --token="$VERCEL_TOKEN" --yes)
        print_success "Frontend deployed at: $DEPLOYMENT_URL"
        export FRONTEND_URL=$DEPLOYMENT_URL
    else
        print_warning "Vercel token not set, skipping frontend deployment"
    fi
fi
cd ..

# Phase 5: Deploy WhatsApp Bot
print_section "Phase 5: Setting up WhatsApp Bot"

run_step "Creating VM for WhatsApp bot" "deployment/gcp/setup-vm.sh"

if [ "$DRY_RUN" != "true" ]; then
    echo
    print_warning "IMPORTANT: WhatsApp Setup Required!"
    echo
    echo "To complete WhatsApp bot setup:"
    echo "1. SSH into the VM:"
    echo "   ${CYAN}gcloud compute ssh whatsapp-bot --zone=$ZONE${NC}"
    echo
    echo "2. Check PM2 status:"
    echo "   ${CYAN}pm2 status${NC}"
    echo
    echo "3. View QR code:"
    echo "   ${CYAN}pm2 logs whatsapp-bot${NC}"
    echo
    echo "4. Scan the QR code with WhatsApp on your phone"
    echo
fi

# Phase 6: Setup Monitoring
print_section "Phase 6: Configuring Monitoring"

if [ "$ENABLE_MONITORING" == "true" ]; then
    run_step "Setting up monitoring" "deployment/gcp/monitoring-setup.sh"
fi

if [ "$ENABLE_BACKUPS" == "true" ]; then
    run_step "Configuring backups" "deployment/gcp/backup-setup.sh"
fi

# Phase 7: Health Check
print_section "Phase 7: Final Health Check"

if [ "$DRY_RUN" != "true" ]; then
    print_status "Running health checks..."
    
    # Check API
    if [ -n "$API_URL" ]; then
        if curl -s -o /dev/null -w "%{http_code}" "$API_URL/health" | grep -q "200"; then
            print_success "API is healthy"
        else
            print_warning "API health check failed"
        fi
    fi
    
    # Check Frontend
    if [ -n "$FRONTEND_URL" ]; then
        if curl -s -o /dev/null -w "%{http_code}" "$FRONTEND_URL" | grep -q "200"; then
            print_success "Frontend is accessible"
        else
            print_warning "Frontend check failed"
        fi
    fi
fi

# Deployment complete
print_section "🎉 Deployment Complete!"

echo -e "${GREEN}${BOLD}Your Vivier Email AI Assistant is deployed!${NC}"
echo
echo -e "${BOLD}Access your services:${NC}"
[ -n "$FRONTEND_URL" ] && echo "  Frontend:    $FRONTEND_URL"
[ -n "$API_URL" ] && echo "  API:         $API_URL"
echo "  Supabase:    $SUPABASE_URL"
echo
echo -e "${BOLD}Next Steps:${NC}"
echo "1. Complete WhatsApp setup (see instructions above)"
echo "2. Test the application at $FRONTEND_URL"
echo "3. Monitor usage: ${CYAN}deployment/gcp/cost-monitor.js${NC}"
echo "4. View logs: ${CYAN}gcloud run logs read --service=email-ai-api${NC}"
echo
echo -e "${BOLD}Useful Commands:${NC}"
echo "  View deployment log:  ${CYAN}cat $DEPLOYMENT_LOG${NC}"
echo "  Check health:         ${CYAN}deployment/gcp/health-check.sh${NC}"
echo "  Rollback if needed:   ${CYAN}deployment/gcp/rollback.sh${NC}"
echo
echo -e "${GREEN}${BOLD}Happy emailing! 📧${NC}"

# Save deployment info
cat > deployment-info.json << EOF
{
  "timestamp": "$(date -Iseconds)",
  "project_id": "$PROJECT_ID",
  "api_url": "${API_URL:-not_deployed}",
  "frontend_url": "${FRONTEND_URL:-not_deployed}",
  "region": "$REGION",
  "zone": "$ZONE",
  "deployed_by": "$(whoami)",
  "deployment_log": "$DEPLOYMENT_LOG"
}
EOF

print_success "Deployment info saved to deployment-info.json"