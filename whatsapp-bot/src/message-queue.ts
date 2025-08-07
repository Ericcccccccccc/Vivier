import { logger } from './utils/logger';
import { QueuedMessage } from './types';
import { WhatsAppBot } from './whatsapp-client';
import PQueue from 'p-queue';
import * as fs from 'fs/promises';
import * as path from 'path';

export class MessageQueue {
  private queue: PQueue;
  private bot: WhatsAppBot;
  private failedMessages: QueuedMessage[] = [];
  private maxRetries = parseInt(process.env.MESSAGE_RETRY_COUNT || '3');
  private queueFilePath = path.join(process.cwd(), 'queue-backup.json');
  private isProcessing = false;

  constructor(bot: WhatsAppBot) {
    this.bot = bot;
    
    // Initialize p-queue with concurrency and rate limiting
    this.queue = new PQueue({
      concurrency: 1, // Process one message at a time
      interval: 1000, // 1 second interval
      intervalCap: 1, // 1 message per interval
    });

    // Load persisted queue on startup
    this.loadPersistedQueue();

    // Set up queue event listeners
    this.setupEventListeners();

    // Persist queue periodically
    setInterval(() => this.persistQueue(), 30000);
  }

  private setupEventListeners(): void {
    this.queue.on('active', () => {
      logger.debug(`Queue working. Size: ${this.queue.size}, Pending: ${this.queue.pending}`);
    });

    this.queue.on('idle', () => {
      logger.debug('Queue is idle');
      this.isProcessing = false;
    });

    this.queue.on('error', (error) => {
      logger.error({ error }, 'Queue error');
    });
  }

  async addMessage(message: QueuedMessage): Promise<void> {
    // Assign ID if not present
    if (!message.id) {
      message.id = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    // Set default values
    message.retries = message.retries || 0;
    message.addedAt = message.addedAt || Date.now();
    message.priority = message.priority || 'normal';

    // Add to queue with priority
    const priority = this.getPriorityValue(message.priority);
    
    await this.queue.add(
      async () => this.processMessage(message),
      { priority }
    );

    logger.info(
      { 
        messageId: message.id,
        to: message.to,
        priority: message.priority,
        queueSize: this.queue.size 
      },
      'Message added to queue'
    );
  }

  private async processMessage(message: QueuedMessage): Promise<void> {
    try {
      logger.debug({ messageId: message.id }, 'Processing message');

      // Check if bot is connected
      if (!this.bot.isConnected()) {
        throw new Error('Bot is not connected to WhatsApp');
      }

      // Send the message
      await this.bot.sendMessage(message.to, message.text, message.options);

      logger.info(
        { messageId: message.id, to: message.to },
        'Message sent successfully'
      );

    } catch (error) {
      logger.error(
        { error, messageId: message.id, retries: message.retries },
        'Failed to send message'
      );

      // Handle retry logic
      if (message.retries < this.maxRetries) {
        message.retries++;
        
        // Calculate exponential backoff delay
        const delay = Math.min(1000 * Math.pow(2, message.retries), 30000);
        
        logger.info(
          { messageId: message.id, retries: message.retries, delay },
          'Retrying message'
        );

        // Re-add to queue after delay
        setTimeout(() => {
          this.addMessage(message);
        }, delay);
      } else {
        // Max retries reached, add to failed messages
        this.failedMessages.push(message);
        logger.error(
          { messageId: message.id },
          'Message failed after max retries'
        );

        // Persist failed messages
        await this.persistFailedMessages();
      }
    }
  }

  async processQueue(): Promise<void> {
    if (this.isProcessing || this.queue.size === 0) {
      return;
    }

    this.isProcessing = true;
    logger.info({ queueSize: this.queue.size }, 'Starting queue processing');

    // Queue will process automatically due to p-queue
    await this.queue.onIdle();

    logger.info('Queue processing complete');
  }

  async stop(): Promise<void> {
    logger.info('Stopping message queue...');
    
    // Clear the queue
    this.queue.clear();
    
    // Wait for any pending messages
    await this.queue.onIdle();
    
    // Persist current state
    await this.persistQueue();
    
    logger.info('Message queue stopped');
  }

  async addBulkMessages(messages: QueuedMessage[]): Promise<void> {
    logger.info({ count: messages.length }, 'Adding bulk messages to queue');
    
    for (const message of messages) {
      await this.addMessage(message);
    }
  }

  getQueueStatus(): {
    size: number;
    pending: number;
    isPaused: boolean;
    failedCount: number;
  } {
    return {
      size: this.queue.size,
      pending: this.queue.pending,
      isPaused: this.queue.isPaused,
      failedCount: this.failedMessages.length,
    };
  }

  pauseQueue(): void {
    this.queue.pause();
    logger.info('Queue paused');
  }

  resumeQueue(): void {
    this.queue.start();
    logger.info('Queue resumed');
  }

  clearQueue(): void {
    this.queue.clear();
    logger.info('Queue cleared');
  }

  async retryFailedMessages(): Promise<void> {
    const failed = [...this.failedMessages];
    this.failedMessages = [];
    
    logger.info({ count: failed.length }, 'Retrying failed messages');
    
    for (const message of failed) {
      message.retries = 0; // Reset retry count
      await this.addMessage(message);
    }
  }

  private getPriorityValue(priority: 'high' | 'normal' | 'low'): number {
    switch (priority) {
      case 'high':
        return 1;
      case 'normal':
        return 2;
      case 'low':
        return 3;
      default:
        return 2;
    }
  }

  private async persistQueue(): Promise<void> {
    try {
      const data = {
        queue: Array.from(this.queue),
        failed: this.failedMessages,
        timestamp: Date.now(),
      };
      
      await fs.writeFile(
        this.queueFilePath,
        JSON.stringify(data, null, 2),
        'utf-8'
      );
      
      logger.debug('Queue persisted to disk');
    } catch (error) {
      logger.error({ error }, 'Failed to persist queue');
    }
  }

  private async loadPersistedQueue(): Promise<void> {
    try {
      const exists = await fs.access(this.queueFilePath).then(() => true).catch(() => false);
      
      if (!exists) {
        return;
      }

      const data = await fs.readFile(this.queueFilePath, 'utf-8');
      const parsed = JSON.parse(data);
      
      // Check if data is not too old (24 hours)
      if (Date.now() - parsed.timestamp > 24 * 60 * 60 * 1000) {
        logger.info('Persisted queue is too old, ignoring');
        return;
      }

      // Restore failed messages
      this.failedMessages = parsed.failed || [];
      
      // Restore queue items
      if (parsed.queue && parsed.queue.length > 0) {
        logger.info({ count: parsed.queue.length }, 'Restoring persisted queue');
        await this.addBulkMessages(parsed.queue);
      }
      
    } catch (error) {
      logger.error({ error }, 'Failed to load persisted queue');
    }
  }

  private async persistFailedMessages(): Promise<void> {
    try {
      const failedPath = path.join(process.cwd(), 'failed-messages.json');
      
      await fs.writeFile(
        failedPath,
        JSON.stringify(this.failedMessages, null, 2),
        'utf-8'
      );
      
      logger.debug('Failed messages persisted to disk');
    } catch (error) {
      logger.error({ error }, 'Failed to persist failed messages');
    }
  }
}