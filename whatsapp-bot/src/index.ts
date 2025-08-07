import 'dotenv/config';
import { WhatsAppBot } from './whatsapp-client';
import { APIClient } from './api-client';
import { logger } from './utils/logger';

async function main() {
  logger.info('Starting WhatsApp Bot...');

  const apiClient = new APIClient({
    baseURL: process.env.API_URL || 'https://api.email-ai.app',
    apiKey: process.env.API_KEY || '',
  });

  const bot = new WhatsAppBot({
    sessionPath: process.env.SESSION_PATH || './session',
    apiClient,
    enableCommands: process.env.ENABLE_COMMANDS === 'true',
    enableNotifications: process.env.ENABLE_NOTIFICATIONS === 'true',
    adminWhatsAppId: process.env.ADMIN_WHATSAPP_ID,
  });

  try {
    await bot.initialize();
    logger.info('WhatsApp Bot initialized successfully');

    // Graceful shutdown handlers
    const shutdown = async (signal: string) => {
      logger.info(`Received ${signal}, shutting down gracefully...`);
      await bot.shutdown();
      process.exit(0);
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));

    // Unhandled rejection handler
    process.on('unhandledRejection', (reason, promise) => {
      logger.error({ reason, promise }, 'Unhandled Rejection');
      apiClient.reportError({
        type: 'unhandledRejection',
        reason,
        timestamp: new Date(),
      });
    });

    // Uncaught exception handler
    process.on('uncaughtException', async (error) => {
      logger.fatal({ error }, 'Uncaught Exception');
      await apiClient.reportError({
        type: 'uncaughtException',
        error: error.message,
        stack: error.stack,
        timestamp: new Date(),
      });
      process.exit(1);
    });

  } catch (error) {
    logger.fatal({ error }, 'Failed to initialize bot');
    process.exit(1);
  }
}

// Start the bot
main().catch((error) => {
  logger.fatal({ error }, 'Fatal error in main');
  process.exit(1);
});