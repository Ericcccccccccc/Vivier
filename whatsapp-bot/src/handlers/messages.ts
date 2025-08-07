import { WAMessage, WASocket } from '@whiskeysockets/baileys';
import { logger } from '../utils/logger';
import { APIClient } from '../types';
import { CommandHandler } from './commands';

export class MessageHandler {
  private apiClient: APIClient;
  private commandHandler: CommandHandler;
  private rateLimiter = new Map<string, number[]>();
  private rateLimitWindow = parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000');
  private maxMessagesPerWindow = parseInt(process.env.RATE_LIMIT_MESSAGES_PER_MINUTE || '30');

  constructor(apiClient: APIClient, commandHandler: CommandHandler) {
    this.apiClient = apiClient;
    this.commandHandler = commandHandler;
    
    // Clean up rate limiter every minute
    setInterval(() => this.cleanRateLimiter(), 60000);
  }

  async handleMessage(message: WAMessage, sock: WASocket): Promise<void> {
    try {
      const userId = message.key.remoteJid!;
      const messageText = this.extractText(message);
      
      // Check rate limiting
      if (!this.checkRateLimit(userId)) {
        logger.warn({ userId }, 'Rate limit exceeded');
        await sock.sendMessage(userId, {
          text: '⚠️ You\'re sending too many messages. Please wait a moment.',
        });
        return;
      }

      // Log message
      logger.info({
        from: userId,
        messageId: message.key.id,
        type: message.message?.conversation ? 'text' : 'other',
        hasMedia: this.hasMedia(message),
      }, 'Message received');

      // Check if it's a command
      const isCommand = await this.commandHandler.processCommand(message, sock);
      if (isCommand) return;

      // Handle regular messages based on context
      const context = this.commandHandler.getContext(userId);
      
      if (context) {
        await this.handleContextualMessage(message, sock, context);
      } else {
        await this.handleRegularMessage(message, sock);
      }
      
    } catch (error) {
      logger.error({ error, message }, 'Error handling message');
      
      const userId = message.key.remoteJid!;
      await sock.sendMessage(userId, {
        text: '❌ An error occurred while processing your message. Please try again.',
      });
    }
  }

  private async handleContextualMessage(
    message: WAMessage,
    sock: WASocket,
    context: any
  ): Promise<void> {
    const userId = message.key.remoteJid!;
    const text = this.extractText(message);

    // Handle based on context action
    switch (context.action) {
      case 'reply':
        if (text.toLowerCase() === 'cancel') {
          this.commandHandler.clearContext(userId);
          await sock.sendMessage(userId, { text: '❌ Operation cancelled.' });
        } else if (text.toLowerCase() === 'regenerate') {
          await this.regenerateResponse(userId, context.emailId, sock);
        } else if (text.toLowerCase().startsWith('edit ')) {
          const newText = text.substring(5);
          await this.editResponse(userId, context.emailId, newText, sock);
        } else {
          await sock.sendMessage(userId, {
            text: '❓ Please use one of the suggested commands or type "cancel" to stop.',
          });
        }
        break;

      case 'awaiting_response':
        // Handle custom responses
        await this.handleCustomResponse(userId, text, context, sock);
        break;

      default:
        // Clear unknown context
        this.commandHandler.clearContext(userId);
    }
  }

  private async handleRegularMessage(message: WAMessage, sock: WASocket): Promise<void> {
    const userId = message.key.remoteJid!;
    const text = this.extractText(message).toLowerCase();

    // Handle common queries
    if (text.includes('help')) {
      await sock.sendMessage(userId, {
        text: 'Need help? Type /help to see all available commands.',
      });
    } else if (text.includes('hello') || text.includes('hi')) {
      await sock.sendMessage(userId, {
        text: '👋 Hello! I\'m your Email AI Assistant. Type /help to get started.',
      });
    } else if (text.includes('summary')) {
      await sock.sendMessage(userId, {
        text: 'To get your email summary, type /summary',
      });
    } else {
      // Default response for unrecognized messages
      await sock.sendMessage(userId, {
        text: 'I didn\'t understand that. Type /help to see available commands.',
      });
    }
  }

  private async regenerateResponse(
    userId: string,
    emailId: string,
    sock: WASocket
  ): Promise<void> {
    await sock.sendMessage(userId, { text: '🔄 Regenerating response...' });
    
    try {
      const newResponse = await this.apiClient.generateEmailResponse(userId, emailId);
      
      await sock.sendMessage(userId, {
        text: `🤖 *New Response Generated*\n\n${newResponse.text}\n\nReply with:\n• /send - Send this response\n• /regenerate - Try again\n• /cancel - Cancel`,
      });
    } catch (error) {
      logger.error({ error }, 'Failed to regenerate response');
      await sock.sendMessage(userId, {
        text: '❌ Failed to regenerate response. Please try again.',
      });
    }
  }

  private async editResponse(
    userId: string,
    emailId: string,
    newText: string,
    sock: WASocket
  ): Promise<void> {
    // Update context with edited response
    const context = this.commandHandler.getContext(userId);
    if (context) {
      context.response = newText;
    }

    await sock.sendMessage(userId, {
      text: `✏️ Response updated.\n\n${newText}\n\nReply with:\n• /send - Send this response\n• /cancel - Cancel`,
    });
  }

  private async handleCustomResponse(
    userId: string,
    text: string,
    context: any,
    sock: WASocket
  ): Promise<void> {
    // Handle custom email response
    context.response = text;
    
    await sock.sendMessage(userId, {
      text: `📝 Custom response saved.\n\nReply with:\n• /send - Send this response\n• /edit <text> - Modify response\n• /cancel - Cancel`,
    });
  }

  private extractText(message: WAMessage): string {
    const msg = message.message;
    if (!msg) return '';
    
    if (msg.conversation) return msg.conversation;
    if (msg.extendedTextMessage?.text) return msg.extendedTextMessage.text;
    if (msg.imageMessage?.caption) return msg.imageMessage.caption;
    if (msg.videoMessage?.caption) return msg.videoMessage.caption;
    if (msg.documentMessage?.caption) return msg.documentMessage.caption;
    
    return '';
  }

  private hasMedia(message: WAMessage): boolean {
    const msg = message.message;
    if (!msg) return false;
    
    return !!(
      msg.imageMessage ||
      msg.videoMessage ||
      msg.audioMessage ||
      msg.documentMessage ||
      msg.stickerMessage
    );
  }

  private checkRateLimit(userId: string): boolean {
    const now = Date.now();
    const userTimestamps = this.rateLimiter.get(userId) || [];
    
    // Filter timestamps within the window
    const recentTimestamps = userTimestamps.filter(
      (timestamp) => now - timestamp < this.rateLimitWindow
    );
    
    if (recentTimestamps.length >= this.maxMessagesPerWindow) {
      return false;
    }
    
    // Add current timestamp
    recentTimestamps.push(now);
    this.rateLimiter.set(userId, recentTimestamps);
    
    return true;
  }

  private cleanRateLimiter(): void {
    const now = Date.now();
    
    for (const [userId, timestamps] of this.rateLimiter.entries()) {
      const recentTimestamps = timestamps.filter(
        (timestamp) => now - timestamp < this.rateLimitWindow
      );
      
      if (recentTimestamps.length === 0) {
        this.rateLimiter.delete(userId);
      } else {
        this.rateLimiter.set(userId, recentTimestamps);
      }
    }
  }
}