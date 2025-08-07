#!/bin/bash

# Automated Backup Script for Email AI Assistant
# Backs up database, WhatsApp sessions, and application data

set -e

# Configuration
PROJECT_ID="${PROJECT_ID:-email-ai-assistant}"
BUCKET_NAME="${PROJECT_ID}-backups"
BACKUP_DIR="/tmp/backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
DATE_FOLDER=$(date +%Y/%m/%d)
RETENTION_DAYS=30

# Supabase configuration (from environment or secrets)
if [ -z "$SUPABASE_URL" ]; then
    SUPABASE_URL=$(gcloud secrets versions access latest --secret=supabase-url 2>/dev/null || echo "")
fi
if [ -z "$SUPABASE_SERVICE_KEY" ]; then
    SUPABASE_SERVICE_KEY=$(gcloud secrets versions access latest --secret=supabase-service-key 2>/dev/null || echo "")
fi

echo "==================================="
echo "Starting Backup Process"
echo "Timestamp: $TIMESTAMP"
echo "==================================="

# Create temporary backup directory
mkdir -p $BACKUP_DIR

# Function to upload to GCS
upload_to_gcs() {
    local FILE=$1
    local GCS_PATH=$2
    
    echo "Uploading $FILE to gs://$BUCKET_NAME/$GCS_PATH"
    gsutil -q cp $FILE gs://$BUCKET_NAME/$GCS_PATH
    
    # Set lifecycle on uploaded file
    gsutil setmeta -h "x-goog-meta-backup-date:$TIMESTAMP" gs://$BUCKET_NAME/$GCS_PATH
}

# Function to cleanup old backups
cleanup_old_backups() {
    local PREFIX=$1
    
    echo "Cleaning up backups older than $RETENTION_DAYS days in $PREFIX..."
    
    # List and delete old files
    gsutil ls -l gs://$BUCKET_NAME/$PREFIX | \
        awk '{print $2, $3}' | \
        while read size name; do
            if [ ! -z "$name" ] && [ "$name" != "gs://$BUCKET_NAME/$PREFIX" ]; then
                # Get file age
                AGE_DAYS=$(gsutil stat $name | grep "Creation time" | \
                    awk '{print $3}' | \
                    xargs -I {} date -d {} +%s | \
                    xargs -I {} echo "($(date +%s) - {}) / 86400" | bc)
                
                if [ "$AGE_DAYS" -gt "$RETENTION_DAYS" ]; then
                    echo "Deleting old backup: $name (age: $AGE_DAYS days)"
                    gsutil -q rm $name
                fi
            fi
        done 2>/dev/null || true
}

# 1. Backup Supabase Database
echo ""
echo "1. Backing up Supabase database..."
if [ ! -z "$SUPABASE_URL" ] && [ ! -z "$SUPABASE_SERVICE_KEY" ]; then
    # Extract database connection details from Supabase
    DB_HOST=$(echo $SUPABASE_URL | sed 's/https:\/\///' | sed 's/\.supabase\.co.*//')
    DATABASE_URL="postgresql://postgres:$SUPABASE_SERVICE_KEY@db.$DB_HOST.supabase.co:5432/postgres"
    
    # Use pg_dump if available, otherwise use Supabase API
    if command -v pg_dump &> /dev/null; then
        echo "Using pg_dump for database backup..."
        PGPASSWORD=$SUPABASE_SERVICE_KEY pg_dump \
            -h db.$DB_HOST.supabase.co \
            -U postgres \
            -d postgres \
            --no-owner \
            --no-acl \
            --clean \
            --if-exists \
            -f $BACKUP_DIR/database_$TIMESTAMP.sql
        
        # Compress the dump
        gzip $BACKUP_DIR/database_$TIMESTAMP.sql
        upload_to_gcs "$BACKUP_DIR/database_$TIMESTAMP.sql.gz" "database/$DATE_FOLDER/database_$TIMESTAMP.sql.gz"
    else
        echo "pg_dump not available. Using Supabase REST API for backup..."
        
        # Export tables via REST API
        TABLES=("users" "emails" "threads" "attachments" "auth.users")
        
        for TABLE in "${TABLES[@]}"; do
            echo "Exporting table: $TABLE"
            curl -s -X GET \
                "$SUPABASE_URL/rest/v1/$TABLE?select=*" \
                -H "apikey: $SUPABASE_SERVICE_KEY" \
                -H "Authorization: Bearer $SUPABASE_SERVICE_KEY" \
                > $BACKUP_DIR/${TABLE}_$TIMESTAMP.json
            
            gzip $BACKUP_DIR/${TABLE}_$TIMESTAMP.json
            upload_to_gcs "$BACKUP_DIR/${TABLE}_$TIMESTAMP.json.gz" "database/$DATE_FOLDER/${TABLE}_$TIMESTAMP.json.gz"
        done
    fi
    
    echo "✅ Database backup complete"
else
    echo "⚠️  Supabase credentials not found. Skipping database backup."
fi

# 2. Backup WhatsApp Sessions
echo ""
echo "2. Backing up WhatsApp sessions..."
VM_NAME="whatsapp-bot"
ZONE="us-central1-a"

# Check if VM exists and is running
if gcloud compute instances describe $VM_NAME --zone=$ZONE &> /dev/null; then
    # Create backup on VM
    echo "Creating session backup on VM..."
    gcloud compute ssh $VM_NAME --zone=$ZONE --command="
        cd /opt/whatsapp-bot
        tar -czf /tmp/whatsapp_sessions_$TIMESTAMP.tar.gz sessions/
    " 2>/dev/null || echo "Failed to create backup on VM"
    
    # Copy backup from VM
    echo "Copying backup from VM..."
    gcloud compute scp \
        $VM_NAME:/tmp/whatsapp_sessions_$TIMESTAMP.tar.gz \
        $BACKUP_DIR/whatsapp_sessions_$TIMESTAMP.tar.gz \
        --zone=$ZONE 2>/dev/null || echo "Failed to copy backup from VM"
    
    # Upload to GCS
    if [ -f "$BACKUP_DIR/whatsapp_sessions_$TIMESTAMP.tar.gz" ]; then
        upload_to_gcs "$BACKUP_DIR/whatsapp_sessions_$TIMESTAMP.tar.gz" "whatsapp-sessions/$DATE_FOLDER/sessions_$TIMESTAMP.tar.gz"
        echo "✅ WhatsApp sessions backup complete"
    else
        echo "⚠️  WhatsApp session backup file not found"
    fi
    
    # Clean up on VM
    gcloud compute ssh $VM_NAME --zone=$ZONE --command="
        rm -f /tmp/whatsapp_sessions_$TIMESTAMP.tar.gz
    " 2>/dev/null || true
else
    echo "⚠️  WhatsApp bot VM not found or not running. Skipping session backup."
fi

# 3. Backup Application Logs
echo ""
echo "3. Backing up application logs..."

# Export Cloud Run logs
echo "Exporting Cloud Run logs..."
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=email-ai-api" \
    --limit=10000 \
    --format=json \
    --project=$PROJECT_ID \
    > $BACKUP_DIR/cloudrun_logs_$TIMESTAMP.json

gzip $BACKUP_DIR/cloudrun_logs_$TIMESTAMP.json
upload_to_gcs "$BACKUP_DIR/cloudrun_logs_$TIMESTAMP.json.gz" "logs/$DATE_FOLDER/cloudrun_$TIMESTAMP.json.gz"

# Export VM logs
echo "Exporting VM logs..."
gcloud logging read "resource.type=gce_instance AND resource.labels.instance_name=whatsapp-bot" \
    --limit=10000 \
    --format=json \
    --project=$PROJECT_ID \
    > $BACKUP_DIR/vm_logs_$TIMESTAMP.json

gzip $BACKUP_DIR/vm_logs_$TIMESTAMP.json
upload_to_gcs "$BACKUP_DIR/vm_logs_$TIMESTAMP.json.gz" "logs/$DATE_FOLDER/vm_$TIMESTAMP.json.gz"

echo "✅ Logs backup complete"

# 4. Backup Secrets Metadata (not the actual secrets)
echo ""
echo "4. Backing up secrets metadata..."
gcloud secrets list \
    --project=$PROJECT_ID \
    --format=json \
    > $BACKUP_DIR/secrets_metadata_$TIMESTAMP.json

# Add version info for each secret
for SECRET in $(gcloud secrets list --project=$PROJECT_ID --format="value(name)"); do
    echo "Secret: $SECRET" >> $BACKUP_DIR/secrets_versions_$TIMESTAMP.txt
    gcloud secrets versions list $SECRET --project=$PROJECT_ID >> $BACKUP_DIR/secrets_versions_$TIMESTAMP.txt
    echo "" >> $BACKUP_DIR/secrets_versions_$TIMESTAMP.txt
done

gzip $BACKUP_DIR/secrets_metadata_$TIMESTAMP.json
gzip $BACKUP_DIR/secrets_versions_$TIMESTAMP.txt
upload_to_gcs "$BACKUP_DIR/secrets_metadata_$TIMESTAMP.json.gz" "config/$DATE_FOLDER/secrets_metadata_$TIMESTAMP.json.gz"
upload_to_gcs "$BACKUP_DIR/secrets_versions_$TIMESTAMP.txt.gz" "config/$DATE_FOLDER/secrets_versions_$TIMESTAMP.txt.gz"

echo "✅ Secrets metadata backup complete"

# 5. Backup Configuration Files
echo ""
echo "5. Backing up configuration files..."

# Create config archive
tar -czf $BACKUP_DIR/config_$TIMESTAMP.tar.gz \
    deployment/*.yaml \
    deployment/*.yml \
    deployment/*.json \
    deployment/.env.* \
    2>/dev/null || echo "Some config files not found"

upload_to_gcs "$BACKUP_DIR/config_$TIMESTAMP.tar.gz" "config/$DATE_FOLDER/config_$TIMESTAMP.tar.gz"

echo "✅ Configuration backup complete"

# 6. Create backup manifest
echo ""
echo "6. Creating backup manifest..."
cat > $BACKUP_DIR/manifest_$TIMESTAMP.json << EOF
{
  "timestamp": "$TIMESTAMP",
  "date": "$(date -Iseconds)",
  "project_id": "$PROJECT_ID",
  "backups": {
    "database": "database/$DATE_FOLDER/database_$TIMESTAMP.sql.gz",
    "whatsapp_sessions": "whatsapp-sessions/$DATE_FOLDER/sessions_$TIMESTAMP.tar.gz",
    "cloudrun_logs": "logs/$DATE_FOLDER/cloudrun_$TIMESTAMP.json.gz",
    "vm_logs": "logs/$DATE_FOLDER/vm_$TIMESTAMP.json.gz",
    "secrets_metadata": "config/$DATE_FOLDER/secrets_metadata_$TIMESTAMP.json.gz",
    "configuration": "config/$DATE_FOLDER/config_$TIMESTAMP.tar.gz"
  },
  "retention_days": $RETENTION_DAYS,
  "backup_size_bytes": $(du -sb $BACKUP_DIR | cut -f1)
}
EOF

upload_to_gcs "$BACKUP_DIR/manifest_$TIMESTAMP.json" "manifests/$DATE_FOLDER/manifest_$TIMESTAMP.json"

# Also create/update latest manifest
upload_to_gcs "$BACKUP_DIR/manifest_$TIMESTAMP.json" "manifests/latest.json"

echo "✅ Manifest created"

# 7. Cleanup old backups
echo ""
echo "7. Cleaning up old backups..."
cleanup_old_backups "database/"
cleanup_old_backups "whatsapp-sessions/"
cleanup_old_backups "logs/"
cleanup_old_backups "config/"
cleanup_old_backups "manifests/"

# 8. Verify backup integrity
echo ""
echo "8. Verifying backup integrity..."
VERIFY_ERRORS=0

# Check if files exist in GCS
for FILE in \
    "database/$DATE_FOLDER/database_$TIMESTAMP.sql.gz" \
    "whatsapp-sessions/$DATE_FOLDER/sessions_$TIMESTAMP.tar.gz" \
    "logs/$DATE_FOLDER/cloudrun_$TIMESTAMP.json.gz" \
    "config/$DATE_FOLDER/config_$TIMESTAMP.tar.gz"
do
    if gsutil ls gs://$BUCKET_NAME/$FILE &> /dev/null; then
        echo "✅ Verified: $FILE"
    else
        echo "❌ Missing: $FILE"
        VERIFY_ERRORS=$((VERIFY_ERRORS + 1))
    fi
done

# 9. Send notification
echo ""
echo "9. Sending backup notification..."
BACKUP_SIZE=$(du -sh $BACKUP_DIR | cut -f1)
BUCKET_SIZE=$(gsutil du -s gs://$BUCKET_NAME | cut -f1)

if [ $VERIFY_ERRORS -eq 0 ]; then
    STATUS="✅ SUCCESS"
    MESSAGE="Backup completed successfully"
else
    STATUS="⚠️ WARNING"
    MESSAGE="Backup completed with $VERIFY_ERRORS errors"
fi

cat << EOF

==================================="
Backup Report
===================================
Status: $STATUS
Timestamp: $TIMESTAMP
Backup Size: $BACKUP_SIZE
Total Bucket Size: $BUCKET_SIZE
Message: $MESSAGE

Backup Location: gs://$BUCKET_NAME/$DATE_FOLDER/
Manifest: gs://$BUCKET_NAME/manifests/$DATE_FOLDER/manifest_$TIMESTAMP.json

To restore from this backup:
./restore.sh $TIMESTAMP
===================================
EOF

# 10. Cleanup local backup directory
echo ""
echo "10. Cleaning up local files..."
rm -rf $BACKUP_DIR

echo ""
echo "==================================="
echo "Backup Process Complete!"
echo "Status: $STATUS"
echo "===================================="

# Exit with appropriate code
if [ $VERIFY_ERRORS -eq 0 ]; then
    exit 0
else
    exit 1
fi