#!/bin/bash

# WhatsApp Bot Setup Script for GCP e2-micro Instance
# This script sets up the WhatsApp bot on a fresh Ubuntu VM

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[✓]${NC} $1"
}

print_error() {
    echo -e "${RED}[✗]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[!]${NC} $1"
}

echo "================================================"
echo "   WhatsApp Bot Setup for GCP e2-micro VM"
echo "================================================"
echo ""

# Check if running as root
if [[ $EUID -eq 0 ]]; then
   print_error "This script should not be run as root"
   exit 1
fi

# Update system packages
print_status "Updating system packages..."
sudo apt-get update
sudo apt-get upgrade -y

# Install essential tools
print_status "Installing essential tools..."
sudo apt-get install -y \
    curl \
    wget \
    git \
    build-essential \
    htop \
    unzip

# Install Node.js 20
print_status "Installing Node.js 20..."
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Verify Node.js installation
node_version=$(node -v)
npm_version=$(npm -v)
print_status "Node.js installed: $node_version"
print_status "npm installed: $npm_version"

# Install PM2 globally
print_status "Installing PM2..."
sudo npm install -g pm2

# Setup PM2 to start on boot
print_status "Configuring PM2 startup..."
pm2 startup systemd -u $USER --hp /home/$USER
sudo systemctl enable pm2-$USER

# Create application directory
print_status "Creating application directory..."
APP_DIR="$HOME/whatsapp-bot"
mkdir -p $APP_DIR
cd $APP_DIR

# Create necessary subdirectories
mkdir -p logs session backups

# Clone repository (if provided)
if [ ! -z "$1" ]; then
    print_status "Cloning repository from $1..."
    git clone $1 .
else
    print_warning "No repository URL provided. Please manually copy your code."
fi

# Create .env file template
print_status "Creating .env template..."
cat > .env << 'EOF'
# API Configuration
API_URL=https://api.email-ai.app
API_KEY=your-api-key-here

# WhatsApp Configuration
SESSION_PATH=./session
QR_TIMEOUT=60000
RECONNECT_DELAY=5000
KEEP_ALIVE_INTERVAL=30000

# Logging
LOG_LEVEL=info
LOG_FILE=./logs/bot.log

# Features
ENABLE_COMMANDS=true
ENABLE_NOTIFICATIONS=true
MAX_MESSAGE_QUEUE=100
MESSAGE_RETRY_COUNT=3

# Admin Configuration
ADMIN_WHATSAPP_ID=

# Rate Limiting
RATE_LIMIT_MESSAGES_PER_MINUTE=30
RATE_LIMIT_WINDOW_MS=60000
EOF

print_warning "Please edit .env file with your configuration"

# Install dependencies if package.json exists
if [ -f "package.json" ]; then
    print_status "Installing dependencies..."
    npm ci --production
    
    # Build TypeScript if needed
    if [ -f "tsconfig.json" ]; then
        print_status "Building TypeScript..."
        npm run build
    fi
fi

# Setup log rotation
print_status "Setting up log rotation..."
sudo tee /etc/logrotate.d/whatsapp-bot << EOF
$APP_DIR/logs/*.log {
    daily
    rotate 7
    compress
    missingok
    notifempty
    create 0644 $USER $USER
    sharedscripts
    postrotate
        pm2 reloadLogs
    endscript
}
EOF

# Configure firewall
print_status "Configuring firewall..."
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw --force enable

# Install PM2 modules
print_status "Installing PM2 modules..."
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 7
pm2 set pm2-logrotate:compress true

# Create systemd service for additional monitoring
print_status "Creating monitoring service..."
sudo tee /etc/systemd/system/whatsapp-bot-monitor.service << EOF
[Unit]
Description=WhatsApp Bot Monitor
After=network.target

[Service]
Type=simple
User=$USER
WorkingDirectory=$APP_DIR
ExecStart=/usr/bin/node $APP_DIR/monitor.js
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

# Create simple monitoring script
cat > $APP_DIR/monitor.js << 'EOF'
const http = require('http');
const { exec } = require('child_process');

const PORT = 3001;

const server = http.createServer((req, res) => {
  if (req.url === '/health') {
    exec('pm2 jlist', (error, stdout) => {
      if (error) {
        res.writeHead(500);
        res.end('Error');
        return;
      }
      
      const processes = JSON.parse(stdout);
      const bot = processes.find(p => p.name === 'whatsapp-bot');
      
      if (bot && bot.pm2_env.status === 'online') {
        res.writeHead(200);
        res.end('OK');
      } else {
        res.writeHead(503);
        res.end('Bot offline');
      }
    });
  } else {
    res.writeHead(404);
    res.end('Not found');
  }
});

server.listen(PORT, () => {
  console.log(`Monitor listening on port ${PORT}`);
});
EOF

# Create swap file for memory management (important for e2-micro)
print_status "Setting up swap file..."
if [ ! -f /swapfile ]; then
    sudo fallocate -l 1G /swapfile
    sudo chmod 600 /swapfile
    sudo mkswap /swapfile
    sudo swapon /swapfile
    echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
    print_status "1GB swap file created"
else
    print_warning "Swap file already exists"
fi

# Optimize system for low memory
print_status "Optimizing system for low memory..."
sudo tee -a /etc/sysctl.conf << EOF

# Optimize for low memory
vm.swappiness=10
vm.vfs_cache_pressure=50
EOF
sudo sysctl -p

# Create start script
print_status "Creating start script..."
cat > $APP_DIR/start.sh << 'EOF'
#!/bin/bash
cd /home/$USER/whatsapp-bot
pm2 start ecosystem.config.js
pm2 save
pm2 logs whatsapp-bot
EOF
chmod +x $APP_DIR/start.sh

# Create maintenance scripts
print_status "Creating maintenance scripts..."

# Backup script
cat > $APP_DIR/backup.sh << 'EOF'
#!/bin/bash
BACKUP_DIR="/home/$USER/whatsapp-bot/backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
mkdir -p $BACKUP_DIR
tar -czf $BACKUP_DIR/session_$TIMESTAMP.tar.gz session/
find $BACKUP_DIR -name "session_*.tar.gz" -mtime +7 -delete
echo "Backup completed: session_$TIMESTAMP.tar.gz"
EOF
chmod +x $APP_DIR/backup.sh

# Cleanup script
cat > $APP_DIR/cleanup.sh << 'EOF'
#!/bin/bash
# Clean old logs
find logs/ -name "*.log" -mtime +30 -delete
# Clean old backups
find backups/ -name "*.tar.gz" -mtime +14 -delete
# Clear npm cache
npm cache clean --force
echo "Cleanup completed"
EOF
chmod +x $APP_DIR/cleanup.sh

# Add cron jobs
print_status "Setting up cron jobs..."
(crontab -l 2>/dev/null; echo "0 3 * * * $APP_DIR/backup.sh") | crontab -
(crontab -l 2>/dev/null; echo "0 4 * * 0 $APP_DIR/cleanup.sh") | crontab -

# Final instructions
echo ""
echo "================================================"
echo "            Setup Complete!"
echo "================================================"
echo ""
print_status "Installation completed successfully!"
echo ""
echo "Next steps:"
echo "1. Edit the .env file with your configuration:"
echo "   nano $APP_DIR/.env"
echo ""
echo "2. Start the bot:"
echo "   cd $APP_DIR"
echo "   ./start.sh"
echo ""
echo "3. Scan the QR code when prompted"
echo ""
echo "Useful commands:"
echo "  pm2 status          - Check bot status"
echo "  pm2 logs            - View logs"
echo "  pm2 restart all     - Restart bot"
echo "  pm2 monit           - Real-time monitoring"
echo "  ./backup.sh         - Manual backup"
echo "  ./cleanup.sh        - Manual cleanup"
echo ""
print_warning "Remember to configure your API_KEY in the .env file!"
echo ""