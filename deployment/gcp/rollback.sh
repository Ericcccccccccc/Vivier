#!/bin/bash

# Rollback Script for Email AI Assistant
# Quickly rollback to a previous deployment version

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
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo "==================================="
echo "Email AI Assistant Rollback Tool"
echo "Project: $PROJECT_ID"
echo "==================================="
echo ""

# Function to show usage
show_usage() {
    cat << EOF
Usage: $0 [OPTIONS] [REVISION]

Options:
    -h, --help              Show this help message
    -l, --list              List available revisions
    -s, --service           Rollback Cloud Run service only
    -v, --vm                Rollback VM only
    -b, --backup TIMESTAMP  Restore from backup with given timestamp
    -d, --dry-run           Show what would be done without making changes
    --force                 Skip confirmation prompts

Examples:
    $0 --list                     # List available revisions
    $0 email-ai-api-00005-abc     # Rollback to specific revision
    $0 --service                  # Rollback Cloud Run to previous revision
    $0 --backup 20240115_120000   # Restore from specific backup

EOF
    exit 0
}

# Parse arguments
DRY_RUN=false
FORCE=false
LIST_ONLY=false
SERVICE_ONLY=false
VM_ONLY=false
BACKUP_RESTORE=false
BACKUP_TIMESTAMP=""
TARGET_REVISION=""

while [[ $# -gt 0 ]]; do
    case $1 in
        -h|--help)
            show_usage
            ;;
        -l|--list)
            LIST_ONLY=true
            shift
            ;;
        -s|--service)
            SERVICE_ONLY=true
            shift
            ;;
        -v|--vm)
            VM_ONLY=true
            shift
            ;;
        -b|--backup)
            BACKUP_RESTORE=true
            BACKUP_TIMESTAMP="$2"
            shift 2
            ;;
        -d|--dry-run)
            DRY_RUN=true
            shift
            ;;
        --force)
            FORCE=true
            shift
            ;;
        *)
            TARGET_REVISION="$1"
            shift
            ;;
    esac
done

# Function to execute command (respects dry run)
execute() {
    local COMMAND=$1
    local DESCRIPTION=$2
    
    if [ "$DRY_RUN" = true ]; then
        echo -e "${BLUE}[DRY RUN]${NC} Would execute: $DESCRIPTION"
        echo "  Command: $COMMAND"
    else
        echo "Executing: $DESCRIPTION"
        eval "$COMMAND"
    fi
}

# Function to confirm action
confirm() {
    local MESSAGE=$1
    
    if [ "$FORCE" = true ]; then
        return 0
    fi
    
    echo -e "${YELLOW}$MESSAGE${NC}"
    read -p "Are you sure? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Rollback cancelled."
        exit 1
    fi
}

# List available revisions
list_revisions() {
    echo "Available Cloud Run Revisions:"
    echo "------------------------------"
    
    gcloud run revisions list \
        --service=$SERVICE_NAME \
        --region=$REGION \
        --format="table(
            name:label=REVISION,
            metadata.annotations.'serving.knative.dev/creator':label=DEPLOYED_BY,
            metadata.creationTimestamp:label=CREATED,
            status.traffic.percent:label=TRAFFIC%,
            metadata.annotations.'client.knative.dev/user-image':label=IMAGE
        )" \
        --sort-by="~metadata.creationTimestamp"
    
    echo ""
    echo "Current traffic allocation:"
    gcloud run services describe $SERVICE_NAME \
        --region=$REGION \
        --format="table(spec.traffic[].percent:label=TRAFFIC%, spec.traffic[].revisionName:label=REVISION, spec.traffic[].tag:label=TAG)"
    
    echo ""
    echo "Available VM Backups:"
    echo "--------------------"
    
    # List Git commits on VM
    if gcloud compute instances describe $VM_NAME --zone=$ZONE &> /dev/null; then
        echo "Recent Git commits on VM:"
        gcloud compute ssh $VM_NAME --zone=$ZONE --command="cd /opt/whatsapp-bot && git log --oneline -10" 2>/dev/null || echo "Unable to fetch Git history"
    fi
    
    echo ""
    echo "Available Backup Timestamps:"
    echo "----------------------------"
    gsutil ls gs://${PROJECT_ID}-backups/manifests/**/manifest_*.json 2>/dev/null | \
        sed 's/.*manifest_//' | sed 's/.json//' | sort -r | head -10 || echo "No backups found"
}

# Rollback Cloud Run service
rollback_cloud_run() {
    local REVISION=$1
    
    if [ -z "$REVISION" ]; then
        # Get previous revision
        echo "Finding previous revision..."
        REVISION=$(gcloud run revisions list \
            --service=$SERVICE_NAME \
            --region=$REGION \
            --format="value(name)" \
            --sort-by="~metadata.creationTimestamp" \
            --limit=2 | tail -1)
        
        if [ -z "$REVISION" ]; then
            echo -e "${RED}Error: No previous revision found${NC}"
            exit 1
        fi
    fi
    
    echo -e "Rolling back Cloud Run to revision: ${YELLOW}$REVISION${NC}"
    
    # Get current revision for comparison
    CURRENT_REVISION=$(gcloud run services describe $SERVICE_NAME \
        --region=$REGION \
        --format="value(status.latestReadyRevisionName)")
    
    echo "Current revision: $CURRENT_REVISION"
    echo "Target revision:  $REVISION"
    
    if [ "$CURRENT_REVISION" = "$REVISION" ]; then
        echo -e "${YELLOW}Warning: Target revision is already active${NC}"
        return
    fi
    
    confirm "This will redirect all traffic to revision $REVISION"
    
    # Perform rollback
    execute "gcloud run services update-traffic $SERVICE_NAME \
        --to-revisions=$REVISION=100 \
        --region=$REGION" \
        "Rolling back Cloud Run service"
    
    # Verify rollback
    if [ "$DRY_RUN" = false ]; then
        echo "Verifying rollback..."
        sleep 5
        
        NEW_REVISION=$(gcloud run services describe $SERVICE_NAME \
            --region=$REGION \
            --format="value(status.traffic[0].revisionName)")
        
        if [ "$NEW_REVISION" = "$REVISION" ]; then
            echo -e "${GREEN}✅ Rollback successful${NC}"
            
            # Test the service
            SERVICE_URL=$(gcloud run services describe $SERVICE_NAME \
                --region=$REGION \
                --format="value(status.url)")
            
            echo "Testing service at $SERVICE_URL..."
            if curl -f -s -o /dev/null "$SERVICE_URL/health"; then
                echo -e "${GREEN}✅ Service is healthy${NC}"
            else
                echo -e "${YELLOW}⚠️  Service health check failed${NC}"
            fi
        else
            echo -e "${RED}❌ Rollback verification failed${NC}"
            exit 1
        fi
    fi
}

# Rollback VM
rollback_vm() {
    local COMMIT=$1
    
    echo "Rolling back WhatsApp bot VM..."
    
    # Check if VM exists
    if ! gcloud compute instances describe $VM_NAME --zone=$ZONE &> /dev/null; then
        echo -e "${RED}Error: VM $VM_NAME not found${NC}"
        exit 1
    fi
    
    if [ -z "$COMMIT" ]; then
        # Get previous commit
        echo "Getting previous Git commit..."
        COMMIT=$(gcloud compute ssh $VM_NAME --zone=$ZONE \
            --command="cd /opt/whatsapp-bot && git log --oneline -2 | tail -1 | cut -d' ' -f1" 2>/dev/null)
        
        if [ -z "$COMMIT" ]; then
            echo -e "${RED}Error: Could not determine previous commit${NC}"
            exit 1
        fi
    fi
    
    echo -e "Rolling back to commit: ${YELLOW}$COMMIT${NC}"
    
    confirm "This will reset the WhatsApp bot to commit $COMMIT"
    
    # Perform rollback
    ROLLBACK_COMMANDS="cd /opt/whatsapp-bot && \
        git fetch && \
        git reset --hard $COMMIT && \
        npm ci && \
        npm run build && \
        pm2 restart whatsapp-bot"
    
    execute "gcloud compute ssh $VM_NAME --zone=$ZONE --command=\"$ROLLBACK_COMMANDS\"" \
        "Rolling back WhatsApp bot"
    
    # Verify rollback
    if [ "$DRY_RUN" = false ]; then
        echo "Verifying VM rollback..."
        sleep 5
        
        PM2_STATUS=$(gcloud compute ssh $VM_NAME --zone=$ZONE \
            --command="pm2 status --no-color" 2>/dev/null || echo "ERROR")
        
        if echo "$PM2_STATUS" | grep -q "whatsapp-bot.*online"; then
            echo -e "${GREEN}✅ WhatsApp bot is running${NC}"
        else
            echo -e "${RED}❌ WhatsApp bot is not running properly${NC}"
            echo "PM2 Status:"
            echo "$PM2_STATUS"
        fi
    fi
}

# Restore from backup
restore_from_backup() {
    local TIMESTAMP=$1
    
    if [ -z "$TIMESTAMP" ]; then
        echo -e "${RED}Error: Backup timestamp required${NC}"
        echo "Available backups:"
        gsutil ls gs://${PROJECT_ID}-backups/manifests/**/manifest_*.json 2>/dev/null | \
            sed 's/.*manifest_//' | sed 's/.json//' | sort -r | head -10
        exit 1
    fi
    
    echo -e "Restoring from backup: ${YELLOW}$TIMESTAMP${NC}"
    
    # Find manifest file
    MANIFEST_FILE=$(gsutil ls "gs://${PROJECT_ID}-backups/manifests/**/manifest_$TIMESTAMP.json" 2>/dev/null | head -1)
    
    if [ -z "$MANIFEST_FILE" ]; then
        echo -e "${RED}Error: Backup manifest not found for timestamp $TIMESTAMP${NC}"
        exit 1
    fi
    
    # Download and parse manifest
    TEMP_MANIFEST="/tmp/manifest_$TIMESTAMP.json"
    gsutil cp "$MANIFEST_FILE" "$TEMP_MANIFEST"
    
    echo "Backup manifest:"
    cat "$TEMP_MANIFEST" | jq '.'
    
    confirm "This will restore the system from backup $TIMESTAMP"
    
    # Restore database
    echo "Restoring database..."
    DB_BACKUP=$(cat "$TEMP_MANIFEST" | jq -r '.backups.database')
    if [ "$DB_BACKUP" != "null" ] && [ ! -z "$DB_BACKUP" ]; then
        execute "gsutil cp gs://${PROJECT_ID}-backups/$DB_BACKUP /tmp/database_restore.sql.gz && \
                gunzip /tmp/database_restore.sql.gz && \
                echo 'Database SQL file ready at /tmp/database_restore.sql'" \
                "Downloading database backup"
        
        # Note: Actual database restore would require Supabase credentials
        echo -e "${YELLOW}Note: Manual database restore required using Supabase CLI or pg_restore${NC}"
    fi
    
    # Restore WhatsApp sessions
    echo "Restoring WhatsApp sessions..."
    SESSIONS_BACKUP=$(cat "$TEMP_MANIFEST" | jq -r '.backups.whatsapp_sessions')
    if [ "$SESSIONS_BACKUP" != "null" ] && [ ! -z "$SESSIONS_BACKUP" ]; then
        execute "gsutil cp gs://${PROJECT_ID}-backups/$SESSIONS_BACKUP /tmp/sessions_restore.tar.gz && \
                gcloud compute scp /tmp/sessions_restore.tar.gz $VM_NAME:/tmp/ --zone=$ZONE && \
                gcloud compute ssh $VM_NAME --zone=$ZONE --command='cd /opt/whatsapp-bot && tar -xzf /tmp/sessions_restore.tar.gz && pm2 restart whatsapp-bot'" \
                "Restoring WhatsApp sessions"
    fi
    
    # Restore configuration
    echo "Restoring configuration..."
    CONFIG_BACKUP=$(cat "$TEMP_MANIFEST" | jq -r '.backups.configuration')
    if [ "$CONFIG_BACKUP" != "null" ] && [ ! -z "$CONFIG_BACKUP" ]; then
        execute "gsutil cp gs://${PROJECT_ID}-backups/$CONFIG_BACKUP /tmp/config_restore.tar.gz && \
                tar -xzf /tmp/config_restore.tar.gz -C /tmp/" \
                "Restoring configuration files"
        
        echo -e "${YELLOW}Note: Review restored configuration files in /tmp before applying${NC}"
    fi
    
    # Clean up
    rm -f "$TEMP_MANIFEST"
    
    echo -e "${GREEN}✅ Backup restore process completed${NC}"
    echo "Please verify all services are working correctly:"
    echo "  ./health-check.sh"
}

# Main execution
if [ "$LIST_ONLY" = true ]; then
    list_revisions
    exit 0
fi

if [ "$BACKUP_RESTORE" = true ]; then
    restore_from_backup "$BACKUP_TIMESTAMP"
    exit 0
fi

# Determine what to rollback
if [ "$SERVICE_ONLY" = true ]; then
    rollback_cloud_run "$TARGET_REVISION"
elif [ "$VM_ONLY" = true ]; then
    rollback_vm "$TARGET_REVISION"
else
    # Rollback both
    echo "Performing full rollback..."
    echo ""
    
    if [ -z "$TARGET_REVISION" ]; then
        echo "No specific revision specified. Rolling back to previous versions."
        echo ""
    fi
    
    # Rollback Cloud Run
    echo "Step 1: Rolling back Cloud Run service"
    echo "--------------------------------------"
    rollback_cloud_run "$TARGET_REVISION"
    echo ""
    
    # Rollback VM
    echo "Step 2: Rolling back WhatsApp bot VM"
    echo "------------------------------------"
    rollback_vm
    echo ""
fi

# Final verification
if [ "$DRY_RUN" = false ]; then
    echo "==================================="
    echo "Rollback Complete"
    echo "==================================="
    echo ""
    echo "Running health check..."
    ./health-check.sh || true
    echo ""
    echo "Rollback completed at $(date)"
    echo ""
    echo "Next steps:"
    echo "1. Monitor the services for any issues"
    echo "2. Check application logs for errors"
    echo "3. Verify functionality with test requests"
    echo "4. If issues persist, consider restoring from backup"
else
    echo ""
    echo -e "${BLUE}[DRY RUN COMPLETE]${NC} No changes were made."
    echo "Remove --dry-run flag to perform actual rollback."
fi