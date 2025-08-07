import fetch, { RequestInit } from 'node-fetch';
import { logger } from './utils/logger';
import { 
  APIClient as IAPIClient, 
  EmailSummary, 
  Email,
  UserSession 
} from './types';

interface APIConfig {
  baseURL: string;
  apiKey: string;
  timeout?: number;
}

interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: any;
  timeout?: number;
}

export class APIClient implements IAPIClient {
  private baseURL: string;
  private apiKey: string;
  private timeout: number;

  constructor(config: APIConfig) {
    this.baseURL = config.baseURL || 'https://api.email-ai.app';
    this.apiKey = config.apiKey;
    this.timeout = config.timeout || 30000;

    if (!this.apiKey) {
      logger.warn('API key not provided. Some features may not work.');
    }
  }

  async registerWhatsAppUser(whatsappId: string): Promise<any> {
    logger.info({ whatsappId }, 'Registering WhatsApp user');
    
    return this.request('/api/whatsapp/register', {
      method: 'POST',
      body: {
        whatsappId,
        platform: 'whatsapp',
        registeredAt: new Date().toISOString(),
      },
    });
  }

  async getEmailSummary(whatsappId: string): Promise<EmailSummary> {
    logger.debug({ whatsappId }, 'Fetching email summary');
    
    return this.request(`/api/whatsapp/summary/${encodeURIComponent(whatsappId)}`);
  }

  async getEmail(whatsappId: string, emailId: string): Promise<Email> {
    logger.debug({ whatsappId, emailId }, 'Fetching email details');
    
    return this.request(`/api/emails/${encodeURIComponent(emailId)}`, {
      headers: {
        'X-WhatsApp-ID': whatsappId,
      },
    });
  }

  async sendEmailResponse(
    whatsappId: string,
    emailId: string,
    response: string
  ): Promise<void> {
    logger.info({ whatsappId, emailId }, 'Sending email response');
    
    return this.request('/api/emails/send', {
      method: 'POST',
      body: {
        whatsappId,
        emailId,
        response,
        sentVia: 'whatsapp',
        timestamp: new Date().toISOString(),
      },
    });
  }

  async generateEmailResponse(
    whatsappId: string,
    emailId: string
  ): Promise<{ text: string; confidence: number }> {
    logger.info({ whatsappId, emailId }, 'Generating AI response');
    
    return this.request('/api/ai/generate-response', {
      method: 'POST',
      body: {
        whatsappId,
        emailId,
      },
    });
  }

  async updateBotStatus(status: 'online' | 'offline'): Promise<void> {
    logger.info({ status }, 'Updating bot status');
    
    return this.request('/api/whatsapp/bot-status', {
      method: 'POST',
      body: {
        status,
        timestamp: new Date().toISOString(),
        version: '1.0.0',
      },
    });
  }

  async getUserPreferences(whatsappId: string): Promise<any> {
    logger.debug({ whatsappId }, 'Fetching user preferences');
    
    return this.request(`/api/users/${encodeURIComponent(whatsappId)}/preferences`);
  }

  async updateUserPreferences(whatsappId: string, preferences: any): Promise<void> {
    logger.info({ whatsappId, preferences }, 'Updating user preferences');
    
    return this.request(`/api/users/${encodeURIComponent(whatsappId)}/preferences`, {
      method: 'PUT',
      body: preferences,
    });
  }

  async reportError(error: any): Promise<void> {
    logger.debug('Reporting error to API');
    
    try {
      await this.request('/api/errors/report', {
        method: 'POST',
        body: {
          error: {
            message: error.message || String(error),
            stack: error.stack,
            type: error.type || 'unknown',
          },
          environment: {
            nodeVersion: process.version,
            platform: process.platform,
            uptime: process.uptime(),
          },
          timestamp: new Date().toISOString(),
        },
      });
    } catch (reportError) {
      logger.error({ reportError }, 'Failed to report error to API');
    }
  }

  async getRecentEmails(whatsappId: string, limit = 10): Promise<Email[]> {
    logger.debug({ whatsappId, limit }, 'Fetching recent emails');
    
    return this.request(`/api/emails/recent`, {
      method: 'GET',
      headers: {
        'X-WhatsApp-ID': whatsappId,
      },
    });
  }

  async markEmailAsRead(whatsappId: string, emailId: string): Promise<void> {
    logger.info({ whatsappId, emailId }, 'Marking email as read');
    
    return this.request(`/api/emails/${encodeURIComponent(emailId)}/read`, {
      method: 'POST',
      body: {
        whatsappId,
        readAt: new Date().toISOString(),
      },
    });
  }

  async getUserSession(whatsappId: string): Promise<UserSession> {
    logger.debug({ whatsappId }, 'Fetching user session');
    
    return this.request(`/api/sessions/${encodeURIComponent(whatsappId)}`);
  }

  async updateUserSession(whatsappId: string, session: Partial<UserSession>): Promise<void> {
    logger.debug({ whatsappId }, 'Updating user session');
    
    return this.request(`/api/sessions/${encodeURIComponent(whatsappId)}`, {
      method: 'PUT',
      body: session,
    });
  }

  async submitFeedback(whatsappId: string, feedback: string): Promise<void> {
    logger.info({ whatsappId }, 'Submitting feedback');
    
    return this.request('/api/feedback', {
      method: 'POST',
      body: {
        whatsappId,
        feedback,
        source: 'whatsapp',
        timestamp: new Date().toISOString(),
      },
    });
  }

  async getNotificationQueue(whatsappId: string): Promise<any[]> {
    logger.debug({ whatsappId }, 'Fetching notification queue');
    
    return this.request(`/api/notifications/queue/${encodeURIComponent(whatsappId)}`);
  }

  async acknowledgeNotification(whatsappId: string, notificationId: string): Promise<void> {
    logger.debug({ whatsappId, notificationId }, 'Acknowledging notification');
    
    return this.request(`/api/notifications/${encodeURIComponent(notificationId)}/ack`, {
      method: 'POST',
      body: {
        whatsappId,
        acknowledgedAt: new Date().toISOString(),
      },
    });
  }

  private async request(endpoint: string, options: RequestOptions = {}): Promise<any> {
    const url = `${this.baseURL}${endpoint}`;
    
    const controller = new AbortController();
    const timeout = setTimeout(() => {
      controller.abort();
    }, options.timeout || this.timeout);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'User-Agent': 'WhatsApp-Bot/1.0.0',
          ...options.headers,
        },
        body: options.body ? JSON.stringify(options.body) : undefined,
      });

      clearTimeout(timeout);

      const responseText = await response.text();
      let responseData: any;

      try {
        responseData = JSON.parse(responseText);
      } catch {
        responseData = responseText;
      }

      if (!response.ok) {
        const error = new Error(
          responseData.message || 
          responseData.error || 
          `API error: ${response.status} ${response.statusText}`
        );
        (error as any).status = response.status;
        (error as any).response = responseData;
        throw error;
      }

      return responseData;
      
    } catch (error: any) {
      clearTimeout(timeout);

      if (error.name === 'AbortError') {
        const timeoutError = new Error(`Request timeout: ${endpoint}`);
        (timeoutError as any).code = 'TIMEOUT';
        throw timeoutError;
      }

      logger.error(
        { 
          error: error.message,
          endpoint,
          status: error.status,
        },
        'API request failed'
      );

      throw error;
    }
  }

  async healthCheck(): Promise<{ status: string; latency: number }> {
    const start = Date.now();
    
    try {
      await this.request('/health');
      const latency = Date.now() - start;
      
      return {
        status: 'healthy',
        latency,
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        latency: Date.now() - start,
      };
    }
  }
}