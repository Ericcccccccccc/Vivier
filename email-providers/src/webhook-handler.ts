import crypto from 'crypto';
import { Email } from './interface';

export interface WebhookPayload {
  provider: 'gmail' | 'outlook' | 'custom';
  timestamp: number;
  data: any;
  signature?: string;
}

export interface GmailPushNotification {
  message: {
    data: string;
    messageId: string;
    publishTime: string;
  };
  subscription: string;
}

export interface OutlookNotification {
  value: Array<{
    subscriptionId: string;
    changeType: string;
    resource: string;
    resourceData: {
      id: string;
      '@odata.type': string;
      '@odata.id': string;
    };
    clientState?: string;
    tenantId: string;
  }>;
}

export interface WebhookConfig {
  provider: string;
  secret?: string;
  clientState?: string;
  topicName?: string;
}

export class WebhookHandler {
  private configs: Map<string, WebhookConfig> = new Map();
  private callbacks: Map<string, (email: Email) => Promise<void>> = new Map();

  constructor() {
    this.initializeConfigs();
  }

  private initializeConfigs(): void {
    // Gmail configuration
    if (process.env.GMAIL_WEBHOOK_SECRET) {
      this.configs.set('gmail', {
        provider: 'gmail',
        secret: process.env.GMAIL_WEBHOOK_SECRET,
        topicName: process.env.GMAIL_TOPIC_NAME || 'projects/email-ai/topics/gmail-updates',
      });
    }

    // Outlook configuration
    if (process.env.OUTLOOK_CLIENT_STATE) {
      this.configs.set('outlook', {
        provider: 'outlook',
        clientState: process.env.OUTLOOK_CLIENT_STATE,
      });
    }
  }

  /**
   * Register a callback for email updates
   */
  registerCallback(accountId: string, callback: (email: Email) => Promise<void>): void {
    this.callbacks.set(accountId, callback);
  }

  /**
   * Unregister a callback
   */
  unregisterCallback(accountId: string): void {
    this.callbacks.delete(accountId);
  }

  /**
   * Handle Gmail push notification
   */
  async handleGmailPush(data: GmailPushNotification): Promise<void> {
    try {
      // Decode the base64 message data
      const decodedData = Buffer.from(data.message.data, 'base64').toString();
      const notification = JSON.parse(decodedData);

      // Extract email information
      const emailAddress = notification.emailAddress;
      const historyId = notification.historyId;

      console.log(`Gmail push notification for ${emailAddress}, history ID: ${historyId}`);

      // Trigger callback if registered
      const callback = this.callbacks.get(emailAddress);
      if (callback) {
        // Note: You'll need to fetch the actual email data using the Gmail API
        // This is just a notification that something changed
        const mockEmail: Email = {
          id: `gmail-${historyId}`,
          subject: 'New Gmail Message',
          from: { email: 'notification@gmail.com' },
          to: [{ email: emailAddress }],
          date: new Date(),
          body: { text: 'Gmail push notification received' },
          attachments: [],
          isRead: false,
        };

        await callback(mockEmail);
      }
    } catch (error) {
      console.error('Error handling Gmail push notification:', error);
      throw error;
    }
  }

  /**
   * Handle Outlook notification
   */
  async handleOutlookNotification(data: OutlookNotification, validationToken?: string): Promise<string | void> {
    // Handle validation request
    if (validationToken) {
      return validationToken;
    }

    try {
      for (const notification of data.value) {
        // Verify client state
        const config = this.configs.get('outlook');
        if (config && config.clientState && notification.clientState !== config.clientState) {
          console.error('Invalid client state in Outlook notification');
          continue;
        }

        // Extract resource information
        const resourceParts = notification.resource.split('/');
        const emailId = notification.resourceData.id;

        console.log(`Outlook notification: ${notification.changeType} for message ${emailId}`);

        // Trigger callbacks
        // Note: You'll need to determine the account from the subscription or resource
        for (const callback of this.callbacks.values()) {
          const mockEmail: Email = {
            id: emailId,
            subject: 'Outlook Message Update',
            from: { email: 'notification@outlook.com' },
            to: [],
            date: new Date(),
            body: { text: `Outlook ${notification.changeType} notification` },
            attachments: [],
            isRead: false,
          };

          await callback(mockEmail);
        }
      }
    } catch (error) {
      console.error('Error handling Outlook notification:', error);
      throw error;
    }
  }

  /**
   * Verify webhook signature
   */
  verifyWebhookSignature(provider: string, signature: string, body: any): boolean {
    const config = this.configs.get(provider);
    if (!config || !config.secret) {
      console.warn(`No webhook configuration found for ${provider}`);
      return false;
    }

    switch (provider) {
      case 'gmail':
        return this.verifyGmailSignature(signature, body, config.secret);
      case 'outlook':
        // Outlook uses client state instead of signatures
        return true;
      default:
        return this.verifyHMACSignature(signature, body, config.secret);
    }
  }

  /**
   * Verify Gmail Cloud Pub/Sub signature
   */
  private verifyGmailSignature(signature: string, body: any, secret: string): boolean {
    // Gmail uses Cloud Pub/Sub which handles authentication differently
    // The signature verification depends on your Pub/Sub setup
    // This is a simplified example
    
    try {
      const message = body.message;
      if (!message || !message.data) {
        return false;
      }

      // Verify the message is from the expected subscription
      const subscription = body.subscription;
      if (!subscription || !subscription.includes('gmail-updates')) {
        return false;
      }

      return true;
    } catch (error) {
      console.error('Gmail signature verification failed:', error);
      return false;
    }
  }

  /**
   * Verify HMAC signature
   */
  private verifyHMACSignature(signature: string, body: any, secret: string): boolean {
    try {
      const payload = typeof body === 'string' ? body : JSON.stringify(body);
      const expectedSignature = crypto
        .createHmac('sha256', secret)
        .update(payload)
        .digest('hex');

      return crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expectedSignature)
      );
    } catch (error) {
      console.error('HMAC signature verification failed:', error);
      return false;
    }
  }

  /**
   * Generate webhook URL for a provider
   */
  generateWebhookUrl(provider: string, accountId: string): string {
    const baseUrl = process.env.WEBHOOK_BASE_URL || process.env.API_URL || 'http://localhost:3000';
    return `${baseUrl}/webhooks/${provider}/${accountId}`;
  }

  /**
   * Parse webhook headers
   */
  parseWebhookHeaders(headers: Record<string, string>): {
    provider?: string;
    signature?: string;
    timestamp?: string;
  } {
    // Gmail headers
    if (headers['x-goog-resource-state']) {
      return {
        provider: 'gmail',
        timestamp: headers['x-goog-message-number'],
      };
    }

    // Outlook headers
    if (headers['x-microsoft-signature']) {
      return {
        provider: 'outlook',
        signature: headers['x-microsoft-signature'],
      };
    }

    // Generic webhook headers
    return {
      signature: headers['x-webhook-signature'] || headers['x-signature'],
      timestamp: headers['x-webhook-timestamp'] || headers['x-timestamp'],
    };
  }

  /**
   * Handle webhook request
   */
  async handleWebhookRequest(
    provider: string,
    headers: Record<string, string>,
    body: any,
    query?: Record<string, string>
  ): Promise<{ status: number; body?: any }> {
    try {
      // Handle validation requests
      if (query?.validationToken) {
        return {
          status: 200,
          body: query.validationToken,
        };
      }

      // Parse headers
      const { signature } = this.parseWebhookHeaders(headers);

      // Verify signature if present
      if (signature && !this.verifyWebhookSignature(provider, signature, body)) {
        console.error(`Invalid webhook signature for ${provider}`);
        return { status: 401 };
      }

      // Route to appropriate handler
      switch (provider) {
        case 'gmail':
          await this.handleGmailPush(body);
          break;
        case 'outlook':
          const result = await this.handleOutlookNotification(body, query?.validationToken);
          if (result) {
            return { status: 200, body: result };
          }
          break;
        default:
          console.warn(`Unknown webhook provider: ${provider}`);
          return { status: 404 };
      }

      return { status: 200 };
    } catch (error) {
      console.error(`Error handling webhook for ${provider}:`, error);
      return { status: 500 };
    }
  }

  /**
   * Set up webhook subscription for Gmail
   */
  async setupGmailWebhook(accessToken: string, topicName?: string): Promise<{
    historyId: string;
    expiration: string;
  }> {
    const topic = topicName || this.configs.get('gmail')?.topicName;
    if (!topic) {
      throw new Error('Gmail topic name not configured');
    }

    // This would use the Gmail API to set up watch
    // Implementation depends on your Gmail provider setup
    
    return {
      historyId: Date.now().toString(),
      expiration: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    };
  }

  /**
   * Set up webhook subscription for Outlook
   */
  async setupOutlookWebhook(
    accessToken: string,
    webhookUrl: string,
    changeTypes: string[] = ['created', 'updated']
  ): Promise<{
    subscriptionId: string;
    expiration: string;
  }> {
    const config = this.configs.get('outlook');
    
    // This would use the Microsoft Graph API to create a subscription
    // Implementation depends on your Outlook provider setup
    
    return {
      subscriptionId: crypto.randomUUID(),
      expiration: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
    };
  }

  /**
   * Remove webhook subscription
   */
  async removeWebhook(provider: string, subscriptionId: string): Promise<void> {
    switch (provider) {
      case 'gmail':
        // Stop Gmail watch
        console.log(`Removing Gmail webhook subscription`);
        break;
      case 'outlook':
        // Delete Outlook subscription
        console.log(`Removing Outlook webhook subscription: ${subscriptionId}`);
        break;
      default:
        console.warn(`Cannot remove webhook for unknown provider: ${provider}`);
    }
  }

  /**
   * Get webhook status
   */
  getWebhookStatus(): {
    configured: string[];
    activeCallbacks: number;
  } {
    return {
      configured: Array.from(this.configs.keys()),
      activeCallbacks: this.callbacks.size,
    };
  }
}