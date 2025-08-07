import { WAMessage, WASocket } from '@whiskeysockets/baileys';

export interface BotConfig {
  sessionPath: string;
  apiClient: APIClient;
  enableCommands?: boolean;
  enableNotifications?: boolean;
  adminWhatsAppId?: string;
}

export interface QueuedMessage {
  id: string;
  to: string;
  text: string;
  options?: any;
  retries: number;
  addedAt: number;
  priority?: 'high' | 'normal' | 'low';
}

export interface EmailSummary {
  today: {
    received: number;
    sent: number;
    aiResponses: number;
  };
  unread: {
    total: number;
    important: number;
    requiresResponse: number;
  };
  topSenders: Array<{
    name: string;
    email: string;
    count: number;
  }>;
  categories: Record<string, number>;
}

export interface Email {
  id: string;
  from: {
    name?: string;
    email: string;
  };
  to: string;
  subject: string;
  preview: string;
  body?: string;
  date: Date;
  isImportant: boolean;
  category?: string;
  attachments?: Array<{
    name: string;
    size: number;
    type: string;
  }>;
}

export interface DailyStats {
  date: Date;
  received: number;
  sent: number;
  aiResponses: number;
  avgResponseTime: string;
  topCategories: Array<{
    name: string;
    count: number;
  }>;
}

export interface UserSession {
  whatsappId: string;
  userId?: string;
  isActive: boolean;
  isPaused: boolean;
  lastMessageAt?: Date;
  context?: any;
}

export interface HealthReport {
  status: 'healthy' | 'degraded' | 'unhealthy';
  uptime: number;
  memory: {
    used: number;
    total: number;
    percentage: number;
  };
  queue: {
    size: number;
    processing: boolean;
    failed: number;
  };
  connection: {
    isConnected: boolean;
    lastDisconnect?: Date;
    reconnectAttempts: number;
  };
  api: {
    isReachable: boolean;
    latency?: number;
  };
}

export type CommandFunction = (
  message: WAMessage,
  args: string[],
  sock: WASocket
) => Promise<void>;

export interface APIClient {
  registerWhatsAppUser(whatsappId: string): Promise<any>;
  getEmailSummary(whatsappId: string): Promise<EmailSummary>;
  getEmail(whatsappId: string, emailId: string): Promise<Email>;
  sendEmailResponse(whatsappId: string, emailId: string, response: string): Promise<void>;
  updateBotStatus(status: 'online' | 'offline'): Promise<void>;
  getUserPreferences(whatsappId: string): Promise<any>;
  updateUserPreferences(whatsappId: string, preferences: any): Promise<void>;
  reportError(error: any): Promise<void>;
}