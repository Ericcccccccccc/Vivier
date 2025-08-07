import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  Browsers,
  WASocket,
  ConnectionState,
  WAMessage,
  BaileysEventMap,
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import QRCode from 'qrcode-terminal';
import { logger } from './utils/logger';
import { BotConfig, APIClient } from './types';
import { CommandHandler } from './handlers/commands';
import { MessageHandler } from './handlers/messages';
import { MessageQueue } from './message-queue';
import { SessionManager } from './session-manager';
import { NotificationService } from './services/notification-service';

export class WhatsAppBot {
  private sock: WASocket | null = null;
  private sessionPath: string;
  private apiClient: APIClient;
  private messageQueue: MessageQueue;
  private commandHandler: CommandHandler;
  private messageHandler: MessageHandler;
  private sessionManager: SessionManager;
  private notificationService: NotificationService;
  private config: BotConfig;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private isShuttingDown = false;

  constructor(config: BotConfig) {
    this.config = config;
    this.sessionPath = config.sessionPath;
    this.apiClient = config.apiClient;
    
    // Initialize components
    this.messageQueue = new MessageQueue(this);
    this.commandHandler = new CommandHandler(this.apiClient, this);
    this.messageHandler = new MessageHandler(this.apiClient, this.commandHandler);
    this.sessionManager = new SessionManager(this.sessionPath);
    this.notificationService = new NotificationService(this);
  }

  async initialize(): Promise<void> {
    try {
      const { state, saveCreds } = await useMultiFileAuthState(this.sessionPath);
      const { version } = await fetchLatestBaileysVersion();

      logger.info({ version }, 'Initializing WhatsApp connection');

      this.sock = makeWASocket({
        version,
        auth: {
          creds: state.creds,
          keys: makeCacheableSignalKeyStore(state.keys, logger),
        },
        browser: Browsers.ubuntu('Chrome'),
        printQRInTerminal: false,
        defaultQueryTimeoutMs: 60000,
        keepAliveIntervalMs: parseInt(process.env.KEEP_ALIVE_INTERVAL || '30000'),
        logger: logger.child({ module: 'baileys' }),
        generateHighQualityLinkPreview: true,
        syncFullHistory: false,
        getMessage: async (key) => {
          return { conversation: 'Message not available' };
        },
      });

      this.setupEventHandlers(saveCreds);
      
    } catch (error) {
      logger.error({ error }, 'Failed to initialize WhatsApp connection');
      throw error;
    }
  }

  private setupEventHandlers(saveCreds: () => Promise<void>): void {
    if (!this.sock) return;

    // Connection updates
    this.sock.ev.on('connection.update', this.handleConnectionUpdate.bind(this));

    // Save credentials
    this.sock.ev.on('creds.update', saveCreds);

    // Message handling
    this.sock.ev.on('messages.upsert', this.handleMessages.bind(this));

    // Message updates (read receipts, etc.)
    this.sock.ev.on('messages.update', this.handleMessageUpdate.bind(this));

    // Presence updates
    this.sock.ev.on('presence.update', this.handlePresenceUpdate.bind(this));

    // Group updates
    this.sock.ev.on('groups.update', this.handleGroupUpdate.bind(this));

    // Call events
    this.sock.ev.on('call', this.handleCall.bind(this));
  }

  private async handleConnectionUpdate(update: Partial<ConnectionState>): Promise<void> {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      logger.info('QR Code received. Scan with WhatsApp:');
      QRCode.generate(qr, { small: true });
      
      // Send QR to admin if configured
      if (this.config.adminWhatsAppId) {
        await this.sendQRToAdmin(qr);
      }
    }

    if (connection === 'close') {
      const shouldReconnect = 
        !this.isShuttingDown &&
        (lastDisconnect?.error as Boom)?.output?.statusCode !== DisconnectReason.loggedOut;

      logger.warn(
        { 
          error: lastDisconnect?.error,
          statusCode: (lastDisconnect?.error as Boom)?.output?.statusCode,
          reconnectAttempts: this.reconnectAttempts 
        },
        'Connection closed'
      );

      if (shouldReconnect && this.reconnectAttempts < this.maxReconnectAttempts) {
        const delay = Math.min(5000 * Math.pow(2, this.reconnectAttempts), 60000);
        this.reconnectAttempts++;
        
        logger.info(
          { delay, attempt: this.reconnectAttempts },
          'Attempting to reconnect...'
        );
        
        setTimeout(() => this.initialize(), delay);
      } else if (this.reconnectAttempts >= this.maxReconnectAttempts) {
        logger.error('Max reconnection attempts reached. Manual intervention required.');
        await this.apiClient.updateBotStatus('offline');
        process.exit(1);
      } else {
        logger.info('Logged out. Need to scan QR code again.');
        await this.sessionManager.clearSession();
        await this.apiClient.updateBotStatus('offline');
      }
    }

    if (connection === 'open') {
      logger.info('WhatsApp connection established successfully!');
      this.reconnectAttempts = 0;
      await this.onConnected();
    }

    if (connection === 'connecting') {
      logger.info('Connecting to WhatsApp...');
    }
  }

  private async onConnected(): Promise<void> {
    try {
      // Update API status
      await this.apiClient.updateBotStatus('online');

      // Send startup notification to admin
      if (this.config.adminWhatsAppId) {
        await this.sendToAdmin('🤖 WhatsApp bot is online and ready!');
      }

      // Process any queued messages
      await this.messageQueue.processQueue();

      // Backup session
      await this.sessionManager.backupSession();

    } catch (error) {
      logger.error({ error }, 'Error in onConnected handler');
    }
  }

  private async handleMessages(update: { messages: WAMessage[], type: string }): Promise<void> {
    try {
      const { messages, type } = update;
      
      if (type !== 'notify') return;

      for (const message of messages) {
        // Ignore our own messages
        if (message.key.fromMe) continue;

        // Process message
        await this.messageHandler.handleMessage(message, this.sock!);
      }
    } catch (error) {
      logger.error({ error }, 'Error handling messages');
    }
  }

  private async handleMessageUpdate(updates: WAMessage[]): Promise<void> {
    for (const update of updates) {
      if (update.key && update.update?.status) {
        logger.debug(
          { 
            messageId: update.key.id,
            status: update.update.status 
          },
          'Message status updated'
        );
      }
    }
  }

  private async handlePresenceUpdate(update: { id: string, presences: any }): Promise<void> {
    logger.debug({ update }, 'Presence update received');
  }

  private async handleGroupUpdate(updates: any[]): Promise<void> {
    logger.debug({ updates }, 'Group updates received');
  }

  private async handleCall(call: any): Promise<void> {
    logger.info({ call }, 'Call received');
    
    // Auto-reject calls
    if (this.sock && call[0].status === 'offer') {
      await this.sock.rejectCall(call[0].id, call[0].from);
      logger.info('Call auto-rejected');
    }
  }

  async sendMessage(to: string, text: string, options?: any): Promise<void> {
    if (!this.sock) {
      logger.error('Cannot send message: Socket not initialized');
      throw new Error('WhatsApp connection not available');
    }

    try {
      await this.sock.sendMessage(to, {
        text,
        ...options,
      });
      
      logger.info({ to, messageLength: text.length }, 'Message sent successfully');
    } catch (error) {
      logger.error({ error, to }, 'Failed to send message');
      throw error;
    }
  }

  async sendToAdmin(text: string): Promise<void> {
    if (this.config.adminWhatsAppId) {
      await this.sendMessage(this.config.adminWhatsAppId, text);
    }
  }

  private async sendQRToAdmin(qr: string): Promise<void> {
    if (this.config.adminWhatsAppId) {
      const message = `📱 *New QR Code Generated*\n\nPlease scan this QR code with WhatsApp to connect the bot.\n\nQR Code expires in 60 seconds.`;
      await this.sendToAdmin(message);
      // Note: Can't send actual QR image without additional setup
    }
  }

  async shutdown(): Promise<void> {
    logger.info('Shutting down WhatsApp bot...');
    this.isShuttingDown = true;

    try {
      // Update API status
      await this.apiClient.updateBotStatus('offline');

      // Stop message queue
      await this.messageQueue.stop();

      // Close WhatsApp connection
      if (this.sock) {
        this.sock.end(undefined);
        this.sock = null;
      }

      // Backup session
      await this.sessionManager.backupSession();

      logger.info('WhatsApp bot shutdown complete');
    } catch (error) {
      logger.error({ error }, 'Error during shutdown');
    }
  }

  getSocket(): WASocket | null {
    return this.sock;
  }

  isConnected(): boolean {
    return this.sock?.user ? true : false;
  }

  getNotificationService(): NotificationService {
    return this.notificationService;
  }

  getMessageQueue(): MessageQueue {
    return this.messageQueue;
  }
}