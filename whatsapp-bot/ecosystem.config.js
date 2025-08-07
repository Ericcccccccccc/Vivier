module.exports = {
  apps: [{
    name: 'whatsapp-bot',
    script: './dist/index.js',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '500M',
    env: {
      NODE_ENV: 'production',
      API_URL: process.env.API_URL || 'https://api.email-ai.app',
      API_KEY: process.env.API_KEY,
      SESSION_PATH: './session',
      LOG_LEVEL: 'info',
      ENABLE_COMMANDS: 'true',
      ENABLE_NOTIFICATIONS: 'true',
    },
    env_development: {
      NODE_ENV: 'development',
      API_URL: 'http://localhost:3000',
      LOG_LEVEL: 'debug',
    },
    error_file: './logs/error.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true,
    // Restart if crashes more than 5 times in 60 seconds
    min_uptime: '60s',
    max_restarts: 5,
    // Exponential backoff restart delay
    restart_delay: 4000,
    exp_backoff_restart_delay: 100,
    // Merge logs
    merge_logs: true,
    // Log date format
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    // Force signal
    kill_timeout: 5000,
    // Listen for shutdown signal
    listen_timeout: 3000,
    // Cron restart (optional - restart every day at 3 AM)
    // cron_restart: '0 3 * * *',
  }],

  // Deployment configuration
  deploy: {
    production: {
      user: 'ubuntu',
      host: 'YOUR_GCP_VM_IP',
      ref: 'origin/main',
      repo: 'https://github.com/your-repo/whatsapp-bot.git',
      path: '/home/ubuntu/whatsapp-bot',
      'pre-deploy': 'npm ci --production',
      'post-deploy': 'npm run build && pm2 startOrRestart ecosystem.config.js --env production',
      'pre-setup': 'apt-get update && apt-get install -y nodejs npm',
    },
  },
};