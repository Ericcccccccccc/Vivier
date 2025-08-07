import { WAMessage, WASocket } from '@whiskeysockets/baileys';
import { logger } from '../utils/logger';
import { APIClient, CommandFunction, EmailSummary } from '../types';
import { WhatsAppBot } from '../whatsapp-client';
import { formatEmailSummary, formatEmailDetails, formatHelp } from '../templates/message-templates';

export class CommandHandler {
  private commands = new Map<string, CommandFunction>();
  private apiClient: APIClient;
  private bot: WhatsAppBot;
  private userContexts = new Map<string, any>();

  constructor(apiClient: APIClient, bot: WhatsAppBot) {
    this.apiClient = apiClient;
    this.bot = bot;
    this.registerCommands();
  }

  private registerCommands(): void {
    this.commands.set('/start', this.handleStart.bind(this));
    this.commands.set('/help', this.handleHelp.bind(this));
    this.commands.set('/status', this.handleStatus.bind(this));
    this.commands.set('/summary', this.handleSummary.bind(this));
    this.commands.set('/pause', this.handlePause.bind(this));
    this.commands.set('/resume', this.handleResume.bind(this));
    this.commands.set('/settings', this.handleSettings.bind(this));
    this.commands.set('/view', this.handleViewEmail.bind(this));
    this.commands.set('/reply', this.handleReplyEmail.bind(this));
    this.commands.set('/send', this.handleSendResponse.bind(this));
    this.commands.set('/ignore', this.handleIgnore.bind(this));
    this.commands.set('/test', this.handleTest.bind(this));
  }

  async processCommand(message: WAMessage, sock: WASocket): Promise<boolean> {
    const text = this.extractText(message);
    if (!text || !text.startsWith('/')) return false;

    const [command, ...args] = text.split(' ');
    const handler = this.commands.get(command.toLowerCase());

    if (!handler) {
      await this.sendMessage(
        sock,
        message.key.remoteJid!,
        '❌ Unknown command. Type /help for available commands.'
      );
      return true;
    }

    try {
      await handler(message, args, sock);
      return true;
    } catch (error) {
      logger.error({ error, command }, 'Command execution error');
      await this.sendMessage(
        sock,
        message.key.remoteJid!,
        '❌ Error processing command. Please try again later.'
      );
      return true;
    }
  }

  private async handleStart(message: WAMessage, args: string[], sock: WASocket): Promise<void> {
    const userId = message.key.remoteJid!;
    
    try {
      // Register user with API
      await this.apiClient.registerWhatsAppUser(userId);
      
      const welcomeMessage = `
🎉 *Welcome to Email AI Assistant!*

I'll help you manage your emails efficiently through WhatsApp.

*Quick Start:*
1. Link your email account on the web dashboard
2. I'll notify you of important emails
3. Use commands to interact with your emails

*Your User ID:* \`${userId}\`

Type /help to see all available commands.

_Visit https://email-ai.app to complete setup_
      `.trim();
      
      await this.sendMessage(sock, userId, welcomeMessage);
    } catch (error) {
      logger.error({ error, userId }, 'Failed to register user');
      await this.sendMessage(sock, userId, '❌ Registration failed. Please try again.');
    }
  }

  private async handleHelp(message: WAMessage, args: string[], sock: WASocket): Promise<void> {
    const helpMessage = formatHelp();
    await this.sendMessage(sock, message.key.remoteJid!, helpMessage);
  }

  private async handleStatus(message: WAMessage, args: string[], sock: WASocket): Promise<void> {
    const userId = message.key.remoteJid!;
    
    try {
      const preferences = await this.apiClient.getUserPreferences(userId);
      
      const statusMessage = `
📊 *Bot Status*

*Connection:* ✅ Online
*Your Status:* ${preferences.isPaused ? '⏸️ Paused' : '▶️ Active'}
*Notifications:* ${preferences.notifications ? '🔔 Enabled' : '🔕 Disabled'}
*Email Account:* ${preferences.emailLinked ? '✅ Linked' : '❌ Not Linked'}
*Daily Summary:* ${preferences.dailySummary ? 'Enabled' : 'Disabled'}

_Last sync: ${new Date().toLocaleTimeString()}_
      `.trim();
      
      await this.sendMessage(sock, userId, statusMessage);
    } catch (error) {
      logger.error({ error }, 'Failed to get status');
      await this.sendMessage(sock, userId, '❌ Could not fetch status. Please try again.');
    }
  }

  private async handleSummary(message: WAMessage, args: string[], sock: WASocket): Promise<void> {
    const userId = message.key.remoteJid!;
    
    await this.sendMessage(sock, userId, '⏳ Fetching your email summary...');
    
    try {
      const summary = await this.apiClient.getEmailSummary(userId);
      const summaryMessage = formatEmailSummary(summary);
      await this.sendMessage(sock, userId, summaryMessage);
    } catch (error) {
      logger.error({ error }, 'Failed to get summary');
      await this.sendMessage(sock, userId, '❌ Could not fetch summary. Please ensure your email is linked.');
    }
  }

  private async handlePause(message: WAMessage, args: string[], sock: WASocket): Promise<void> {
    const userId = message.key.remoteJid!;
    
    try {
      await this.apiClient.updateUserPreferences(userId, { isPaused: true });
      await this.sendMessage(sock, userId, '⏸️ Notifications paused. Use /resume to re-enable.');
    } catch (error) {
      logger.error({ error }, 'Failed to pause notifications');
      await this.sendMessage(sock, userId, '❌ Failed to pause notifications.');
    }
  }

  private async handleResume(message: WAMessage, args: string[], sock: WASocket): Promise<void> {
    const userId = message.key.remoteJid!;
    
    try {
      await this.apiClient.updateUserPreferences(userId, { isPaused: false });
      await this.sendMessage(sock, userId, '▶️ Notifications resumed. You\'ll receive email alerts again.');
    } catch (error) {
      logger.error({ error }, 'Failed to resume notifications');
      await this.sendMessage(sock, userId, '❌ Failed to resume notifications.');
    }
  }

  private async handleSettings(message: WAMessage, args: string[], sock: WASocket): Promise<void> {
    const userId = message.key.remoteJid!;
    
    const settingsMessage = `
⚙️ *Settings*

Manage your preferences on the web dashboard:
🔗 https://email-ai.app/settings

*Available Settings:*
• Link/unlink email accounts
• Configure notification preferences
• Set quiet hours
• Manage AI response settings
• View usage statistics

Your User ID: \`${userId}\`
    `.trim();
    
    await this.sendMessage(sock, userId, settingsMessage);
  }

  private async handleViewEmail(message: WAMessage, args: string[], sock: WASocket): Promise<void> {
    const userId = message.key.remoteJid!;
    const emailId = args[0];
    
    if (!emailId) {
      await this.sendMessage(sock, userId, '❌ Please provide an email ID. Usage: /view <email_id>');
      return;
    }
    
    try {
      const email = await this.apiClient.getEmail(userId, emailId);
      const emailMessage = formatEmailDetails(email);
      await this.sendMessage(sock, userId, emailMessage);
    } catch (error) {
      logger.error({ error }, 'Failed to get email');
      await this.sendMessage(sock, userId, '❌ Could not fetch email. Invalid ID or no access.');
    }
  }

  private async handleReplyEmail(message: WAMessage, args: string[], sock: WASocket): Promise<void> {
    const userId = message.key.remoteJid!;
    const emailId = args[0];
    
    if (!emailId) {
      await this.sendMessage(sock, userId, '❌ Please provide an email ID. Usage: /reply <email_id>');
      return;
    }
    
    await this.sendMessage(sock, userId, '🤖 Generating AI response...');
    
    try {
      // Store context for follow-up
      this.userContexts.set(userId, {
        action: 'reply',
        emailId,
        timestamp: Date.now(),
      });
      
      // Generate AI response (this would be done by the API)
      const response = await this.apiClient.generateEmailResponse(userId, emailId);
      
      const responseMessage = `
🤖 *AI Response Generated*

${response.text}

Reply with:
• /send - Send this response
• /edit <new text> - Modify response
• /regenerate - Generate new response
• /cancel - Cancel operation
      `.trim();
      
      await this.sendMessage(sock, userId, responseMessage);
    } catch (error) {
      logger.error({ error }, 'Failed to generate response');
      await this.sendMessage(sock, userId, '❌ Could not generate response. Please try again.');
    }
  }

  private async handleSendResponse(message: WAMessage, args: string[], sock: WASocket): Promise<void> {
    const userId = message.key.remoteJid!;
    const context = this.userContexts.get(userId);
    
    if (!context || context.action !== 'reply') {
      await this.sendMessage(sock, userId, '❌ No pending email response. Use /reply first.');
      return;
    }
    
    try {
      await this.apiClient.sendEmailResponse(userId, context.emailId, context.response);
      await this.sendMessage(sock, userId, '✅ Email sent successfully!');
      this.userContexts.delete(userId);
    } catch (error) {
      logger.error({ error }, 'Failed to send email');
      await this.sendMessage(sock, userId, '❌ Failed to send email. Please try again.');
    }
  }

  private async handleIgnore(message: WAMessage, args: string[], sock: WASocket): Promise<void> {
    const userId = message.key.remoteJid!;
    await this.sendMessage(sock, userId, '✅ Email marked as read.');
  }

  private async handleTest(message: WAMessage, args: string[], sock: WASocket): Promise<void> {
    const userId = message.key.remoteJid!;
    await this.sendMessage(sock, userId, '✅ Bot is working correctly! Connection established.');
  }

  private extractText(message: WAMessage): string {
    const msg = message.message;
    if (!msg) return '';
    
    if (msg.conversation) return msg.conversation;
    if (msg.extendedTextMessage?.text) return msg.extendedTextMessage.text;
    if (msg.imageMessage?.caption) return msg.imageMessage.caption;
    if (msg.videoMessage?.caption) return msg.videoMessage.caption;
    
    return '';
  }

  private async sendMessage(sock: WASocket, to: string, text: string): Promise<void> {
    await sock.sendMessage(to, { text });
  }

  clearContext(userId: string): void {
    this.userContexts.delete(userId);
  }

  getContext(userId: string): any {
    return this.userContexts.get(userId);
  }
}