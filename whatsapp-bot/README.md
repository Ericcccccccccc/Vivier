# WhatsApp Bot for Email AI Assistant

A WhatsApp bot built with Baileys that integrates with the Email AI Assistant platform, designed to run 24/7 on a GCP e2-micro VM.

## Features

- 🤖 **AI-Powered Email Management**: Manage emails through WhatsApp commands
- 📧 **Smart Notifications**: Receive important email alerts
- 🔄 **Auto-Reconnect**: Maintains persistent WhatsApp connection
- 💬 **Command System**: Rich command interface for email operations
- 📊 **Email Summaries**: Daily and on-demand email statistics
- 🔒 **Secure Session Management**: Encrypted session storage with backups
- 📈 **Health Monitoring**: Built-in health checks and diagnostics
- 🚀 **Production Ready**: PM2 process management and Docker support

## Architecture

```
┌─────────────────┐     ┌──────────────┐     ┌──────────────┐
│   WhatsApp      │────▶│  Bot Server  │────▶│   Email AI   │
│   Users         │◀────│   (Baileys)  │◀────│     API      │
└─────────────────┘     └──────────────┘     └──────────────┘
```

## Quick Start

### Prerequisites

- Node.js 20+
- npm or yarn
- GCP e2-micro VM (or any Linux server)

### Installation

1. **Clone the repository**:
```bash
git clone https://github.com/your-repo/whatsapp-bot.git
cd whatsapp-bot
```

2. **Install dependencies**:
```bash
npm install
```

3. **Configure environment**:
```bash
cp .env.example .env
# Edit .env with your configuration
nano .env
```

4. **Build the project**:
```bash
npm run build
```

5. **Start the bot**:
```bash
npm start
# Or with PM2:
pm2 start ecosystem.config.js
```

6. **Scan QR Code**:
   - Check logs for QR code
   - Scan with WhatsApp mobile app
   - Session will be saved automatically

## GCP VM Setup

### Automated Setup

Run the setup script on your GCP e2-micro instance:

```bash
wget https://raw.githubusercontent.com/your-repo/whatsapp-bot/main/setup-vm.sh
chmod +x setup-vm.sh
./setup-vm.sh
```

### Manual Setup

1. **Create e2-micro instance**:
```bash
gcloud compute instances create whatsapp-bot \
  --machine-type=e2-micro \
  --zone=us-central1-a \
  --image-family=ubuntu-2204-lts \
  --image-project=ubuntu-os-cloud \
  --boot-disk-size=10GB
```

2. **SSH into instance**:
```bash
gcloud compute ssh whatsapp-bot
```

3. **Run setup script** or follow manual installation steps

## Commands

### Basic Commands
- `/start` - Initialize bot and register
- `/help` - Show all available commands
- `/status` - Check bot and account status
- `/settings` - Open settings dashboard

### Email Commands
- `/summary` - Get email summary
- `/view <id>` - View full email
- `/reply <id>` - Generate AI response
- `/send` - Send pending response
- `/ignore` - Mark email as read

### Notification Control
- `/pause` - Pause all notifications
- `/resume` - Resume notifications
- `/quiet <hours>` - Pause for specific hours

## Docker Deployment

### Using Docker Compose

```bash
# Build and start
docker-compose up -d

# View logs
docker-compose logs -f

# Stop
docker-compose down
```

### Using Docker

```bash
# Build image
docker build -t whatsapp-bot .

# Run container
docker run -d \
  --name whatsapp-bot \
  --restart unless-stopped \
  -v $(pwd)/session:/app/session \
  -v $(pwd)/logs:/app/logs \
  -e API_KEY=your-api-key \
  whatsapp-bot
```

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `API_URL` | Email AI API endpoint | `https://api.email-ai.app` |
| `API_KEY` | API authentication key | Required |
| `SESSION_PATH` | WhatsApp session directory | `./session` |
| `LOG_LEVEL` | Logging level | `info` |
| `ENABLE_COMMANDS` | Enable command processing | `true` |
| `ENABLE_NOTIFICATIONS` | Enable notifications | `true` |
| `ADMIN_WHATSAPP_ID` | Admin WhatsApp number | Optional |

### PM2 Configuration

The `ecosystem.config.js` file contains PM2 settings:
- Auto-restart on crash
- Memory limit (500MB)
- Log rotation
- Environment management

## Monitoring

### Health Check Endpoint

The bot exposes a health check endpoint at port 3001:

```bash
curl http://localhost:3001/health
```

### PM2 Monitoring

```bash
# Status
pm2 status

# Real-time monitoring
pm2 monit

# Logs
pm2 logs whatsapp-bot

# Metrics
pm2 describe whatsapp-bot
```

### Diagnostics

Run diagnostics to check system health:

```bash
node -e "require('./dist/health-check').runDiagnostics()"
```

## Maintenance

### Backup Session

```bash
./backup.sh
# Or manually:
tar -czf backups/session_$(date +%Y%m%d).tar.gz session/
```

### Clean Logs

```bash
./cleanup.sh
# Or manually:
find logs/ -name "*.log" -mtime +30 -delete
```

### Update Bot

```bash
git pull
npm install
npm run build
pm2 restart whatsapp-bot
```

## Troubleshooting

### Bot Not Connecting

1. Check logs: `pm2 logs whatsapp-bot`
2. Verify API key is set correctly
3. Ensure network connectivity
4. Clear session and rescan QR: `rm -rf session/`

### High Memory Usage

1. Check memory: `pm2 describe whatsapp-bot`
2. Restart bot: `pm2 restart whatsapp-bot`
3. Increase swap if needed
4. Review message queue size

### Message Not Sending

1. Check rate limits in logs
2. Verify WhatsApp connection status
3. Check API connectivity
4. Review message queue status

## Security

- API keys are stored in environment variables
- Session data is encrypted by Baileys
- Regular session backups
- Rate limiting to prevent abuse
- Input validation on all commands

## Development

### Local Development

```bash
# Install dev dependencies
npm install

# Run in development mode
npm run dev

# Run tests
npm test

# Lint code
npm run lint
```

### Project Structure

```
whatsapp-bot/
├── src/
│   ├── index.ts              # Entry point
│   ├── whatsapp-client.ts    # WhatsApp connection
│   ├── api-client.ts         # API integration
│   ├── handlers/             # Message/command handlers
│   ├── services/             # Business logic
│   ├── templates/            # Message templates
│   └── utils/                # Utilities
├── ecosystem.config.js        # PM2 configuration
├── Dockerfile                 # Docker configuration
├── setup-vm.sh               # VM setup script
└── package.json              # Dependencies
```

## Contributing

1. Fork the repository
2. Create feature branch
3. Commit changes
4. Push to branch
5. Open pull request

## License

MIT

## Support

For issues and questions:
- GitHub Issues: [your-repo/issues](https://github.com/your-repo/whatsapp-bot/issues)
- Email: support@email-ai.app
- Documentation: https://docs.email-ai.app