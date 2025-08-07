#!/bin/bash

# VM Startup Script for WhatsApp Bot
# This script runs on VM first boot and sets up the WhatsApp bot

set -e

# Log all output
exec > >(tee -a /var/log/startup-script.log)
exec 2>&1

echo "==================================="
echo "Starting WhatsApp Bot Setup"
echo "Date: $(date)"
echo "==================================="

# Get metadata
GITHUB_USER=$(curl -H "Metadata-Flavor: Google" http://metadata.google.internal/computeMetadata/v1/instance/attributes/github-user 2>/dev/null || echo "your-github-username")
GITHUB_REPO=$(curl -H "Metadata-Flavor: Google" http://metadata.google.internal/computeMetadata/v1/instance/attributes/github-repo 2>/dev/null || echo "email-ai-assistant")
PROJECT_ID=$(curl -H "Metadata-Flavor: Google" http://metadata.google.internal/computeMetadata/v1/instance/attributes/project-id 2>/dev/null || echo "email-ai-assistant")
API_URL=$(curl -H "Metadata-Flavor: Google" http://metadata.google.internal/computeMetadata/v1/instance/attributes/api-url 2>/dev/null || echo "https://email-ai-api.run.app")

echo "GitHub User: $GITHUB_USER"
echo "GitHub Repo: $GITHUB_REPO"
echo "Project ID: $PROJECT_ID"
echo "API URL: $API_URL"

# Update system
echo "Updating system packages..."
apt-get update
apt-get upgrade -y
apt-get install -y curl wget git build-essential python3 python3-pip

# Install Node.js 20
echo "Installing Node.js 20..."
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs

# Verify Node.js installation
node --version
npm --version

# Install PM2 globally
echo "Installing PM2..."
npm install -g pm2
pm2 --version

# Install additional tools
echo "Installing additional tools..."
npm install -g typescript nodemon

# Create application directory
echo "Creating application directory..."
mkdir -p /opt/whatsapp-bot
cd /opt/whatsapp-bot

# Clone repository (if using Git)
if [ ! -z "$GITHUB_USER" ] && [ ! -z "$GITHUB_REPO" ]; then
    echo "Cloning repository from GitHub..."
    if [ -d ".git" ]; then
        echo "Repository already exists, pulling latest changes..."
        git pull origin main
    else
        git clone https://github.com/$GITHUB_USER/$GITHUB_REPO.git .
    fi
fi

# Navigate to WhatsApp bot directory
if [ -d "whatsapp-bot" ]; then
    cd whatsapp-bot
else
    echo "Creating WhatsApp bot structure..."
    mkdir -p whatsapp-bot
    cd whatsapp-bot
    
    # Create package.json if it doesn't exist
    if [ ! -f "package.json" ]; then
        cat > package.json << 'EOFJSON'
{
  "name": "whatsapp-bot",
  "version": "1.0.0",
  "description": "WhatsApp bot for Email AI Assistant",
  "main": "dist/index.js",
  "scripts": {
    "build": "tsc",
    "start": "node dist/index.js",
    "dev": "nodemon --watch src --exec ts-node src/index.ts",
    "test": "jest"
  },
  "dependencies": {
    "whatsapp-web.js": "^1.23.0",
    "qrcode-terminal": "^0.12.0",
    "axios": "^1.6.0",
    "dotenv": "^16.3.1",
    "winston": "^3.11.0",
    "express": "^4.18.2"
  },
  "devDependencies": {
    "@types/node": "^20.10.0",
    "@types/express": "^4.17.21",
    "typescript": "^5.3.0",
    "nodemon": "^3.0.0",
    "ts-node": "^10.9.0"
  }
}
EOFJSON
    fi
fi

# Install dependencies
echo "Installing dependencies..."
npm ci --production || npm install --production

# Build the application if TypeScript
if [ -f "tsconfig.json" ]; then
    echo "Building TypeScript application..."
    npm run build || npx tsc
fi

# Get secrets from Secret Manager
echo "Retrieving secrets from Secret Manager..."
if command -v gcloud &> /dev/null; then
    # Get WhatsApp API key
    WHATSAPP_API_KEY=$(gcloud secrets versions access latest --secret=whatsapp-api-key 2>/dev/null || echo "")
    
    # Get other necessary secrets
    JWT_SECRET=$(gcloud secrets versions access latest --secret=jwt-secret 2>/dev/null || echo "")
fi

# Create environment file
echo "Creating environment configuration..."
cat > .env << EOF
NODE_ENV=production
PORT=3000
API_URL=$API_URL
API_KEY=$WHATSAPP_API_KEY
JWT_SECRET=$JWT_SECRET
PROJECT_ID=$PROJECT_ID
LOG_LEVEL=info
SESSION_PATH=/opt/whatsapp-bot/sessions
BACKUP_PATH=/opt/whatsapp-bot/backups
EOF

# Create necessary directories
mkdir -p /opt/whatsapp-bot/sessions
mkdir -p /opt/whatsapp-bot/backups
mkdir -p /opt/whatsapp-bot/logs

# Set proper permissions
chown -R nobody:nogroup /opt/whatsapp-bot
chmod -R 755 /opt/whatsapp-bot

# Create PM2 ecosystem file
echo "Creating PM2 ecosystem configuration..."
cat > ecosystem.config.js << 'EOFPM2'
module.exports = {
  apps: [{
    name: 'whatsapp-bot',
    script: './dist/index.js',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '256M',
    env: {
      NODE_ENV: 'production'
    },
    error_file: '/opt/whatsapp-bot/logs/error.log',
    out_file: '/opt/whatsapp-bot/logs/out.log',
    log_file: '/opt/whatsapp-bot/logs/combined.log',
    time: true,
    merge_logs: true,
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    min_uptime: '10s',
    max_restarts: 10,
    exec_mode: 'fork',
    kill_timeout: 5000,
    listen_timeout: 3000,
    cron_restart: '0 0 * * *'  // Restart daily at midnight
  }]
};
EOFPM2

# Start the application with PM2
echo "Starting WhatsApp bot with PM2..."
pm2 start ecosystem.config.js

# Setup PM2 to start on system boot
echo "Setting up PM2 startup script..."
pm2 startup systemd -u root --hp /root
pm2 save

# Setup log rotation
echo "Setting up log rotation..."
cat > /etc/logrotate.d/whatsapp-bot << 'EOFLOGROTATE'
/opt/whatsapp-bot/logs/*.log {
    daily
    rotate 7
    compress
    delaycompress
    missingok
    notifempty
    create 0644 nobody nogroup
    sharedscripts
    postrotate
        pm2 reloadLogs
    endscript
}
EOFLOGROTATE

# Install monitoring agent (optional)
echo "Installing monitoring tools..."
wget -q -O - https://dl.google.com/cloudagents/add-google-cloud-ops-agent-repo.sh | bash
apt-get update
apt-get install -y google-cloud-ops-agent

# Configure monitoring agent
cat > /etc/google-cloud-ops-agent/config.yaml << 'EOFMON'
logging:
  receivers:
    syslog:
      type: files
      include_paths:
      - /var/log/syslog
      - /var/log/messages
    whatsapp:
      type: files
      include_paths:
      - /opt/whatsapp-bot/logs/*.log
  processors:
    parse_json:
      type: parse_json
  service:
    pipelines:
      default_pipeline:
        receivers: [syslog, whatsapp]
        processors: [parse_json]

metrics:
  receivers:
    hostmetrics:
      type: hostmetrics
      collection_interval: 60s
  service:
    pipelines:
      default_pipeline:
        receivers: [hostmetrics]
EOFMON

# Restart monitoring agent
systemctl restart google-cloud-ops-agent

# Create health check endpoint
echo "Creating health check server..."
cat > /opt/whatsapp-bot/health-check.js << 'EOFHEALTH'
const http = require('http');
const { exec } = require('child_process');

const server = http.createServer((req, res) => {
  if (req.url === '/health') {
    exec('pm2 jlist', (error, stdout) => {
      if (error) {
        res.writeHead(500);
        res.end('Unhealthy');
        return;
      }
      
      try {
        const processes = JSON.parse(stdout);
        const whatsappBot = processes.find(p => p.name === 'whatsapp-bot');
        
        if (whatsappBot && whatsappBot.pm2_env.status === 'online') {
          res.writeHead(200);
          res.end('Healthy');
        } else {
          res.writeHead(503);
          res.end('Service Unavailable');
        }
      } catch (e) {
        res.writeHead(500);
        res.end('Error checking status');
      }
    });
  } else {
    res.writeHead(404);
    res.end('Not Found');
  }
});

server.listen(8080, () => {
  console.log('Health check server running on port 8080');
});
EOFHEALTH

# Start health check server
pm2 start /opt/whatsapp-bot/health-check.js --name health-check

# Create backup script
echo "Creating backup script..."
cat > /opt/whatsapp-bot/backup.sh << 'EOFBACKUP'
#!/bin/bash
# Backup WhatsApp session data

BACKUP_DIR="/opt/whatsapp-bot/backups"
SESSION_DIR="/opt/whatsapp-bot/sessions"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# Create backup
tar -czf $BACKUP_DIR/session_backup_$TIMESTAMP.tar.gz -C $SESSION_DIR .

# Keep only last 7 backups
ls -t $BACKUP_DIR/session_backup_*.tar.gz | tail -n +8 | xargs -r rm

# Upload to Cloud Storage if available
if command -v gsutil &> /dev/null; then
    gsutil cp $BACKUP_DIR/session_backup_$TIMESTAMP.tar.gz gs://$PROJECT_ID-backups/whatsapp-sessions/
fi
EOFBACKUP

chmod +x /opt/whatsapp-bot/backup.sh

# Setup cron for backups
echo "Setting up automated backups..."
(crontab -l 2>/dev/null; echo "0 */6 * * * /opt/whatsapp-bot/backup.sh") | crontab -

# Create startup completion flag
touch /opt/whatsapp-bot/.startup-complete

# Final status check
echo ""
echo "==================================="
echo "WhatsApp Bot Setup Complete!"
echo "==================================="
echo "PM2 Status:"
pm2 status
echo ""
echo "Logs location: /opt/whatsapp-bot/logs/"
echo "Session data: /opt/whatsapp-bot/sessions/"
echo "Backups: /opt/whatsapp-bot/backups/"
echo ""
echo "To view logs: pm2 logs whatsapp-bot"
echo "To restart: pm2 restart whatsapp-bot"
echo "To stop: pm2 stop whatsapp-bot"
echo ""
echo "Remember to scan the QR code to authenticate WhatsApp!"
echo "Check logs for QR code: pm2 logs whatsapp-bot --lines 50"
echo "==================================="