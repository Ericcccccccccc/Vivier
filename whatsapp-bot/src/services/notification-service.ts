import { logger } from '../utils/logger';
import { WhatsAppBot } from '../whatsapp-client';
import { Email, DailyStats, QueuedMessage } from '../types';
import * as templates from '../templates/message-templates';
import NodeCache from 'node-cache';

export class NotificationService {
  private bot: WhatsAppBot;
  private cache: NodeCache;
  private scheduledJobs = new Map<string, NodeJS.Timeout>();

  constructor(bot: WhatsAppBot) {
    this.bot = bot;
    
    // Cache for preventing duplicate notifications
    this.cache = new NodeCache({
      stdTTL: 3600, // 1 hour default TTL
      checkperiod: 600, // Check for expired keys every 10 minutes
    });

    // Schedule daily summary if enabled
    this.scheduleDailySummary();
  }

  async sendEmailNotification(userId: string, email: Email): Promise<void> {
    try {
      // Check if we've already sent this notification
      const cacheKey = `email_${userId}_${email.id}`;
      if (this.cache.get(cacheKey)) {
        logger.debug({ userId, emailId: email.id }, 'Notification already sent, skipping');
        return;
      }

      // Format and send notification
      const message = templates.formatEmailNotification(email);
      
      await this.bot.getMessageQueue().addMessage({
        id: `notif_email_${email.id}`,
        to: userId,
        text: message,
        priority: email.isImportant ? 'high' : 'normal',
        retries: 0,
        addedAt: Date.now(),
      });

      // Mark as sent in cache
      this.cache.set(cacheKey, true);
      
      logger.info({ userId, emailId: email.id }, 'Email notification queued');
    } catch (error) {
      logger.error({ error, userId, emailId: email.id }, 'Failed to send email notification');
    }
  }

  async sendAIResponseNotification(
    userId: string,
    email: Email,
    aiResponse: string
  ): Promise<void> {
    try {
      const message = templates.formatAIResponse(email, aiResponse);
      
      await this.bot.getMessageQueue().addMessage({
        id: `notif_ai_${email.id}`,
        to: userId,
        text: message,
        priority: 'high',
        retries: 0,
        addedAt: Date.now(),
      });
      
      logger.info({ userId, emailId: email.id }, 'AI response notification queued');
    } catch (error) {
      logger.error({ error, userId }, 'Failed to send AI response notification');
    }
  }

  async sendDailySummary(userId: string, stats: DailyStats): Promise<void> {
    try {
      const message = templates.formatDailySummary(stats);
      
      await this.bot.getMessageQueue().addMessage({
        id: `notif_daily_${Date.now()}`,
        to: userId,
        text: message,
        priority: 'low',
        retries: 0,
        addedAt: Date.now(),
      });
      
      logger.info({ userId }, 'Daily summary notification queued');
    } catch (error) {
      logger.error({ error, userId }, 'Failed to send daily summary');
    }
  }

  async sendSystemNotification(userId: string, message: string, priority: 'high' | 'normal' | 'low' = 'normal'): Promise<void> {
    try {
      await this.bot.getMessageQueue().addMessage({
        id: `notif_system_${Date.now()}`,
        to: userId,
        text: `⚙️ *System Notification*\n\n${message}`,
        priority,
        retries: 0,
        addedAt: Date.now(),
      });
      
      logger.info({ userId, priority }, 'System notification queued');
    } catch (error) {
      logger.error({ error, userId }, 'Failed to send system notification');
    }
  }

  async sendErrorNotification(userId: string, error: string): Promise<void> {
    try {
      const message = `
❌ *Error Occurred*

${error}

Please try again or contact support if the issue persists.
      `.trim();
      
      await this.bot.getMessageQueue().addMessage({
        id: `notif_error_${Date.now()}`,
        to: userId,
        text: message,
        priority: 'high',
        retries: 0,
        addedAt: Date.now(),
      });
      
      logger.info({ userId }, 'Error notification queued');
    } catch (error) {
      logger.error({ error, userId }, 'Failed to send error notification');
    }
  }

  async sendBulkNotifications(notifications: Array<{
    userId: string;
    message: string;
    priority?: 'high' | 'normal' | 'low';
  }>): Promise<void> {
    const messages: QueuedMessage[] = notifications.map((notif, index) => ({
      id: `notif_bulk_${Date.now()}_${index}`,
      to: notif.userId,
      text: notif.message,
      priority: notif.priority || 'normal',
      retries: 0,
      addedAt: Date.now(),
    }));

    await this.bot.getMessageQueue().addBulkMessages(messages);
    
    logger.info({ count: notifications.length }, 'Bulk notifications queued');
  }

  private scheduleDailySummary(): void {
    // Schedule for 9 AM every day
    const now = new Date();
    const scheduledTime = new Date(now);
    scheduledTime.setHours(9, 0, 0, 0);
    
    // If 9 AM has passed today, schedule for tomorrow
    if (scheduledTime <= now) {
      scheduledTime.setDate(scheduledTime.getDate() + 1);
    }
    
    const timeUntilSummary = scheduledTime.getTime() - now.getTime();
    
    setTimeout(() => {
      this.sendDailySummaries();
      // Schedule next daily summary
      setInterval(() => this.sendDailySummaries(), 24 * 60 * 60 * 1000);
    }, timeUntilSummary);
    
    logger.info({ scheduledTime }, 'Daily summary scheduled');
  }

  private async sendDailySummaries(): Promise<void> {
    logger.info('Sending daily summaries to all users');
    
    // This would typically fetch all active users from the API
    // and send summaries to each one
    try {
      // Implementation would go here
      // const users = await this.api.getActiveUsers();
      // for (const user of users) {
      //   const stats = await this.api.getDailyStats(user.whatsappId);
      //   await this.sendDailySummary(user.whatsappId, stats);
      // }
    } catch (error) {
      logger.error({ error }, 'Failed to send daily summaries');
    }
  }

  async sendWelcomeMessage(userId: string): Promise<void> {
    const message = templates.formatWelcomeMessage(userId);
    
    await this.bot.getMessageQueue().addMessage({
      id: `notif_welcome_${Date.now()}`,
      to: userId,
      text: message,
      priority: 'high',
      retries: 0,
      addedAt: Date.now(),
    });
  }

  async sendQuickReply(
    userId: string,
    message: string,
    buttons: Array<{ id: string; title: string }>
  ): Promise<void> {
    // Note: Baileys supports buttons but they might not work on all WhatsApp versions
    try {
      const buttonMessage = {
        text: message,
        footer: 'Email AI Assistant',
        buttons: buttons.map((btn, index) => ({
          buttonId: btn.id,
          buttonText: { displayText: btn.title },
          type: 1,
        })),
        headerType: 1,
      };

      await this.bot.sendMessage(userId, '', { buttons: buttonMessage });
      
      logger.info({ userId, buttonCount: buttons.length }, 'Quick reply sent');
    } catch (error) {
      logger.error({ error, userId }, 'Failed to send quick reply');
      // Fallback to regular message
      await this.bot.sendMessage(userId, message);
    }
  }

  async sendMediaNotification(
    userId: string,
    caption: string,
    mediaUrl: string,
    mediaType: 'image' | 'document'
  ): Promise<void> {
    try {
      const mediaMessage = mediaType === 'image' 
        ? { image: { url: mediaUrl }, caption }
        : { document: { url: mediaUrl }, caption };

      await this.bot.sendMessage(userId, '', mediaMessage);
      
      logger.info({ userId, mediaType }, 'Media notification sent');
    } catch (error) {
      logger.error({ error, userId }, 'Failed to send media notification');
      // Fallback to text message
      await this.bot.sendMessage(userId, caption);
    }
  }

  clearCache(): void {
    this.cache.flushAll();
    logger.info('Notification cache cleared');
  }

  stop(): void {
    // Clear all scheduled jobs
    for (const [id, timeout] of this.scheduledJobs) {
      clearTimeout(timeout);
    }
    this.scheduledJobs.clear();
    
    // Clear cache
    this.clearCache();
    
    logger.info('Notification service stopped');
  }
}