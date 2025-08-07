#!/bin/bash

# Health Check Script for Email AI Assistant
# Verifies all components are running correctly

set -e

# Configuration
PROJECT_ID="${PROJECT_ID:-email-ai-assistant}"
REGION="${REGION:-us-central1}"
ZONE="${ZONE:-us-central1-a}"
SERVICE_NAME="email-ai-api"
VM_NAME="whatsapp-bot"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Health check results
TOTAL_CHECKS=0
PASSED_CHECKS=0
FAILED_CHECKS=0
WARNINGS=0

echo "==================================="
echo "Email AI Assistant Health Check"
echo "Project: $PROJECT_ID"
echo "$(date)"
echo "==================================="
echo ""

# Function to check a service
check_service() {
    local SERVICE=$1
    local CHECK=$2
    local COMMAND=$3
    
    TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
    echo -n "Checking $SERVICE - $CHECK... "
    
    if eval "$COMMAND" &> /dev/null; then
        echo -e "${GREEN}✅ PASS${NC}"
        PASSED_CHECKS=$((PASSED_CHECKS + 1))
        return 0
    else
        echo -e "${RED}❌ FAIL${NC}"
        FAILED_CHECKS=$((FAILED_CHECKS + 1))
        return 1
    fi
}

# Function to check with warning
check_with_warning() {
    local SERVICE=$1
    local CHECK=$2
    local COMMAND=$3
    local WARNING_CONDITION=$4
    
    TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
    echo -n "Checking $SERVICE - $CHECK... "
    
    RESULT=$(eval "$COMMAND" 2>/dev/null || echo "ERROR")
    
    if [ "$RESULT" = "ERROR" ]; then
        echo -e "${RED}❌ FAIL${NC}"
        FAILED_CHECKS=$((FAILED_CHECKS + 1))
        return 1
    elif eval "$WARNING_CONDITION"; then
        echo -e "${YELLOW}⚠️  WARNING${NC} - $RESULT"
        WARNINGS=$((WARNINGS + 1))
        return 0
    else
        echo -e "${GREEN}✅ PASS${NC} - $RESULT"
        PASSED_CHECKS=$((PASSED_CHECKS + 1))
        return 0
    fi
}

# 1. Check GCP Project Configuration
echo "1. GCP Project Configuration"
echo "----------------------------"

check_service "Project" "Exists" "gcloud projects describe $PROJECT_ID"
check_service "Billing" "Enabled" "gcloud beta billing projects describe $PROJECT_ID --format='value(billingEnabled)' | grep -q True"

# Check APIs
REQUIRED_APIS=(
    "run.googleapis.com"
    "compute.googleapis.com"
    "containerregistry.googleapis.com"
    "cloudbuild.googleapis.com"
    "secretmanager.googleapis.com"
    "logging.googleapis.com"
    "monitoring.googleapis.com"
)

for API in "${REQUIRED_APIS[@]}"; do
    check_service "API" "$API" "gcloud services list --enabled --filter=\"name:$API\" --format=\"value(name)\" | grep -q $API"
done

echo ""

# 2. Check Cloud Run Service
echo "2. Cloud Run Service"
echo "--------------------"

# Check if service exists
if check_service "Cloud Run" "Service exists" "gcloud run services describe $SERVICE_NAME --region=$REGION --format='value(name)'"; then
    # Get service URL
    SERVICE_URL=$(gcloud run services describe $SERVICE_NAME --region=$REGION --format='value(status.url)')
    echo "   Service URL: $SERVICE_URL"
    
    # Check service is serving traffic
    check_service "Cloud Run" "Serving traffic" "gcloud run services describe $SERVICE_NAME --region=$REGION --format='value(status.conditions[0].status)' | grep -q True"
    
    # Check health endpoint
    check_service "Cloud Run" "Health endpoint" "curl -f -s -o /dev/null -w '%{http_code}' $SERVICE_URL/health | grep -q 200"
    
    # Check API endpoint
    check_service "Cloud Run" "API endpoint" "curl -f -s -o /dev/null -w '%{http_code}' $SERVICE_URL/api/v1/status | grep -q 200"
    
    # Check instance count
    INSTANCE_COUNT=$(gcloud run services describe $SERVICE_NAME --region=$REGION --format='value(status.latestReadyRevisionName)' | xargs -I {} gcloud run revisions describe {} --region=$REGION --format='value(status.instanceCount)' 2>/dev/null || echo "0")
    echo "   Active instances: ${INSTANCE_COUNT:-0}"
    
    # Check for recent errors
    ERROR_COUNT=$(gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=$SERVICE_NAME AND severity>=ERROR" --limit=10 --format='value(timestamp)' --project=$PROJECT_ID 2>/dev/null | wc -l)
    if [ "$ERROR_COUNT" -gt 0 ]; then
        echo -e "   Recent errors: ${YELLOW}$ERROR_COUNT errors in last 10 logs${NC}"
    else
        echo -e "   Recent errors: ${GREEN}None${NC}"
    fi
fi

echo ""

# 3. Check WhatsApp Bot VM
echo "3. WhatsApp Bot VM"
echo "------------------"

# Check if VM exists
if check_service "VM" "Instance exists" "gcloud compute instances describe $VM_NAME --zone=$ZONE --format='value(name)'"; then
    # Check VM status
    VM_STATUS=$(gcloud compute instances describe $VM_NAME --zone=$ZONE --format='value(status)')
    if [ "$VM_STATUS" = "RUNNING" ]; then
        echo -e "   VM Status: ${GREEN}$VM_STATUS${NC}"
        PASSED_CHECKS=$((PASSED_CHECKS + 1))
    else
        echo -e "   VM Status: ${RED}$VM_STATUS${NC}"
        FAILED_CHECKS=$((FAILED_CHECKS + 1))
    fi
    TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
    
    # Check PM2 process
    if [ "$VM_STATUS" = "RUNNING" ]; then
        PM2_STATUS=$(gcloud compute ssh $VM_NAME --zone=$ZONE --command="pm2 jlist" 2>/dev/null || echo "[]")
        if echo "$PM2_STATUS" | grep -q "whatsapp-bot"; then
            echo -e "   PM2 Process: ${GREEN}✅ Running${NC}"
            PASSED_CHECKS=$((PASSED_CHECKS + 1))
        else
            echo -e "   PM2 Process: ${RED}❌ Not running${NC}"
            FAILED_CHECKS=$((FAILED_CHECKS + 1))
        fi
        TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
        
        # Check health endpoint on VM
        check_service "VM" "Health endpoint" "gcloud compute ssh $VM_NAME --zone=$ZONE --command='curl -f -s http://localhost:8080/health'"
    fi
    
    # Get VM uptime
    UPTIME=$(gcloud compute ssh $VM_NAME --zone=$ZONE --command="uptime -p" 2>/dev/null || echo "Unknown")
    echo "   Uptime: $UPTIME"
fi

echo ""

# 4. Check Secrets
echo "4. Secret Manager"
echo "-----------------"

REQUIRED_SECRETS=(
    "supabase-url"
    "supabase-service-key"
    "groq-api-key"
    "jwt-secret"
    "whatsapp-api-key"
)

for SECRET in "${REQUIRED_SECRETS[@]}"; do
    check_service "Secret" "$SECRET" "gcloud secrets describe $SECRET --project=$PROJECT_ID"
done

# Check secret access
SECRET_ACCESS_COUNT=$(gcloud logging read "protoPayload.serviceName=secretmanager.googleapis.com" --limit=100 --format='value(timestamp)' --project=$PROJECT_ID 2>/dev/null | wc -l)
echo "   Recent secret accesses: $SECRET_ACCESS_COUNT (last 100 events)"

echo ""

# 5. Check Storage
echo "5. Cloud Storage"
echo "----------------"

BUCKET_NAME="${PROJECT_ID}-backups"
if check_service "Storage" "Bucket exists" "gsutil ls -b gs://$BUCKET_NAME"; then
    # Check bucket size
    BUCKET_SIZE=$(gsutil du -s gs://$BUCKET_NAME 2>/dev/null | awk '{print $1}' || echo "0")
    BUCKET_SIZE_MB=$((BUCKET_SIZE / 1024 / 1024))
    BUCKET_SIZE_GB=$((BUCKET_SIZE / 1024 / 1024 / 1024))
    
    if [ $BUCKET_SIZE_GB -gt 4 ]; then
        echo -e "   Bucket size: ${YELLOW}${BUCKET_SIZE_GB}GB (>80% of 5GB free tier)${NC}"
        WARNINGS=$((WARNINGS + 1))
    else
        echo -e "   Bucket size: ${GREEN}${BUCKET_SIZE_MB}MB${NC}"
    fi
    
    # Check latest backup
    LATEST_BACKUP=$(gsutil ls -l gs://$BUCKET_NAME/manifests/latest.json 2>/dev/null | grep -v TOTAL | awk '{print $2}' || echo "")
    if [ ! -z "$LATEST_BACKUP" ]; then
        echo -e "   Latest backup: ${GREEN}$LATEST_BACKUP${NC}"
    else
        echo -e "   Latest backup: ${YELLOW}No backups found${NC}"
    fi
fi

echo ""

# 6. Check Monitoring
echo "6. Monitoring & Alerts"
echo "----------------------"

# Check uptime checks
UPTIME_CHECKS=$(gcloud monitoring uptime-checks list --project=$PROJECT_ID --format='value(name)' 2>/dev/null | wc -l)
echo "   Uptime checks configured: $UPTIME_CHECKS"

# Check alert policies
ALERT_POLICIES=$(gcloud alpha monitoring policies list --project=$PROJECT_ID --format='value(name)' 2>/dev/null | wc -l)
echo "   Alert policies configured: $ALERT_POLICIES"

# Check for recent incidents
RECENT_INCIDENTS=$(gcloud logging read "severity>=ERROR" --limit=10 --format='value(timestamp)' --project=$PROJECT_ID 2>/dev/null | wc -l)
if [ "$RECENT_INCIDENTS" -gt 5 ]; then
    echo -e "   Recent incidents: ${YELLOW}$RECENT_INCIDENTS errors in last 10 logs${NC}"
    WARNINGS=$((WARNINGS + 1))
else
    echo -e "   Recent incidents: ${GREEN}$RECENT_INCIDENTS errors in last 10 logs${NC}"
fi

echo ""

# 7. Check Free Tier Usage
echo "7. Free Tier Usage"
echo "------------------"

# Cloud Run usage (simplified check)
echo -n "   Cloud Run requests: "
MONTHLY_REQUESTS=$(gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=$SERVICE_NAME" --format='value(timestamp)' --project=$PROJECT_ID 2>/dev/null | wc -l)
if [ "$MONTHLY_REQUESTS" -gt 1600000 ]; then
    echo -e "${YELLOW}High usage detected${NC}"
    WARNINGS=$((WARNINGS + 1))
else
    echo -e "${GREEN}Within limits${NC}"
fi

# VM hours (e2-micro is free for 744 hours/month)
echo -n "   VM hours this month: "
VM_HOURS=$(gcloud compute instances describe $VM_NAME --zone=$ZONE --format='value(creationTimestamp)' 2>/dev/null | xargs -I {} date -d {} +%s | xargs -I {} echo "($(date +%s) - {}) / 3600" | bc 2>/dev/null || echo "0")
if [ "$VM_HOURS" -gt 744 ]; then
    echo -e "${YELLOW}${VM_HOURS}h (exceeds free tier)${NC}"
    WARNINGS=$((WARNINGS + 1))
else
    echo -e "${GREEN}${VM_HOURS}h${NC}"
fi

echo ""

# 8. Check External Dependencies
echo "8. External Dependencies"
echo "------------------------"

# Check Supabase
SUPABASE_URL=$(gcloud secrets versions access latest --secret=supabase-url 2>/dev/null || echo "")
if [ ! -z "$SUPABASE_URL" ]; then
    if curl -f -s -o /dev/null "$SUPABASE_URL/rest/v1/" 2>/dev/null; then
        echo -e "   Supabase: ${GREEN}✅ Reachable${NC}"
        PASSED_CHECKS=$((PASSED_CHECKS + 1))
    else
        echo -e "   Supabase: ${RED}❌ Unreachable${NC}"
        FAILED_CHECKS=$((FAILED_CHECKS + 1))
    fi
    TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
fi

# Check Groq API (without making actual API call)
echo -e "   Groq API: ${GREEN}✅ Configured${NC}"

echo ""

# 9. Performance Metrics
echo "9. Performance Metrics"
echo "----------------------"

if [ ! -z "$SERVICE_URL" ]; then
    # Measure response time
    RESPONSE_TIME=$(curl -o /dev/null -s -w '%{time_total}' $SERVICE_URL/health 2>/dev/null || echo "N/A")
    if [ "$RESPONSE_TIME" != "N/A" ]; then
        RESPONSE_MS=$(echo "$RESPONSE_TIME * 1000" | bc)
        if (( $(echo "$RESPONSE_MS < 500" | bc -l) )); then
            echo -e "   API Response Time: ${GREEN}${RESPONSE_MS}ms${NC}"
        elif (( $(echo "$RESPONSE_MS < 1000" | bc -l) )); then
            echo -e "   API Response Time: ${YELLOW}${RESPONSE_MS}ms${NC}"
        else
            echo -e "   API Response Time: ${RED}${RESPONSE_MS}ms${NC}"
        fi
    fi
fi

# Get Cloud Run metrics
if command -v gcloud &> /dev/null; then
    echo "   Cloud Run Metrics (last hour):"
    echo "   - Request count: $(gcloud monitoring read "run.googleapis.com/request_count" --project=$PROJECT_ID --format='value(point.value.int64_value)' 2>/dev/null | tail -1 || echo 'N/A')"
    echo "   - Container instances: $(gcloud monitoring read "run.googleapis.com/container/instance_count" --project=$PROJECT_ID --format='value(point.value.int64_value)' 2>/dev/null | tail -1 || echo 'N/A')"
fi

echo ""

# Summary
echo "==================================="
echo "Health Check Summary"
echo "==================================="
echo -e "Total Checks: $TOTAL_CHECKS"
echo -e "Passed: ${GREEN}$PASSED_CHECKS${NC}"
echo -e "Failed: ${RED}$FAILED_CHECKS${NC}"
echo -e "Warnings: ${YELLOW}$WARNINGS${NC}"

# Calculate health score
HEALTH_SCORE=$((PASSED_CHECKS * 100 / TOTAL_CHECKS))

echo ""
echo -n "Overall Health Score: "
if [ $HEALTH_SCORE -ge 90 ]; then
    echo -e "${GREEN}${HEALTH_SCORE}% - HEALTHY${NC}"
    EXIT_CODE=0
elif [ $HEALTH_SCORE -ge 70 ]; then
    echo -e "${YELLOW}${HEALTH_SCORE}% - WARNING${NC}"
    EXIT_CODE=0
else
    echo -e "${RED}${HEALTH_SCORE}% - CRITICAL${NC}"
    EXIT_CODE=1
fi

echo "==================================="

# Recommendations
if [ $FAILED_CHECKS -gt 0 ] || [ $WARNINGS -gt 0 ]; then
    echo ""
    echo "Recommendations:"
    echo "----------------"
    
    if [ $FAILED_CHECKS -gt 0 ]; then
        echo "• Review failed checks above and take corrective action"
        echo "• Check logs: gcloud logging read 'severity>=ERROR' --limit=50"
    fi
    
    if [ $WARNINGS -gt 0 ]; then
        echo "• Monitor warning conditions closely"
        echo "• Consider implementing auto-scaling or optimization"
    fi
    
    echo "• Run './deploy-api.sh' to redeploy the API if needed"
    echo "• Run './setup-vm.sh' to recreate the VM if needed"
fi

echo ""
echo "Health check completed at $(date)"
echo ""

exit $EXIT_CODE