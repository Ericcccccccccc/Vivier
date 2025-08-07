export interface EmailAddress {
  email: string;
  name?: string;
}

export interface Attachment {
  filename: string;
  contentType: string;
  size: number;
  contentId?: string;
  content?: Buffer;
}

export interface Email {
  id: string;
  threadId?: string;
  subject: string;
  from: EmailAddress;
  to: EmailAddress[];
  cc?: EmailAddress[];
  bcc?: EmailAddress[];
  date: Date;
  body: {
    text: string;
    html?: string;
  };
  attachments: Attachment[];
  labels?: string[];
  folders?: string[];
  isRead: boolean;
  isImportant?: boolean;
  isStarred?: boolean;
  isDraft?: boolean;
  isSpam?: boolean;
}

export interface OutgoingEmail {
  from: string;
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  body: {
    text: string;
    html?: string;
  };
  attachments?: Attachment[];
  replyTo?: string;
  inReplyTo?: string;
  references?: string[];
}

export interface SentEmail {
  id: string;
  threadId?: string;
  sentAt: Date;
}

export interface EmailCredentials {
  type: 'oauth' | 'password';
  // OAuth fields
  authCode?: string;
  accessToken?: string;
  refreshToken?: string;
  // Password auth
  email?: string;
  password?: string;
}

export interface AuthResult {
  success: boolean;
  email?: string;
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: Date;
  error?: string;
}

export interface FetchOptions {
  folder?: string;
  limit?: number;
  offset?: number;
  pageToken?: string;
  since?: Date;
  before?: Date;
  includeSpam?: boolean;
  includeDrafts?: boolean;
  onlyUnread?: boolean;
}

export interface SearchQuery {
  query?: string;
  from?: string;
  to?: string;
  subject?: string;
  body?: string;
  hasAttachment?: boolean;
  isUnread?: boolean;
  isStarred?: boolean;
  labels?: string[];
  after?: Date;
  before?: Date;
  larger?: number;
  smaller?: number;
}

export interface Folder {
  id: string;
  name: string;
  type?: 'inbox' | 'sent' | 'drafts' | 'trash' | 'spam' | 'custom';
  unreadCount?: number;
  totalCount?: number;
  parent?: string;
}

export interface ProviderInfo {
  name: string;
  type: 'gmail' | 'outlook' | 'imap' | 'other';
  features: {
    oauth: boolean;
    webhooks: boolean;
    labels: boolean;
    folders: boolean;
    threading: boolean;
    push: boolean;
  };
}

export interface QuotaInfo {
  used: number;
  total: number;
  percentage: number;
}

export interface EmailProvider {
  // Authentication
  authenticate(credentials: EmailCredentials): Promise<AuthResult>;
  refreshAuth(refreshToken: string): Promise<AuthResult>;
  validateConnection(): Promise<boolean>;
  disconnect(): Promise<void>;
  
  // Email Operations
  fetchEmails(options?: FetchOptions): Promise<Email[]>;
  getEmail(messageId: string): Promise<Email>;
  sendEmail(email: OutgoingEmail): Promise<SentEmail>;
  
  // Folder Operations
  getFolders(): Promise<Folder[]>;
  moveEmail(messageId: string, folder: string): Promise<void>;
  markAsRead(messageId: string): Promise<void>;
  markAsUnread(messageId: string): Promise<void>;
  deleteEmail(messageId: string): Promise<void>;
  starEmail(messageId: string): Promise<void>;
  unstarEmail(messageId: string): Promise<void>;
  
  // Search
  searchEmails(query: SearchQuery): Promise<Email[]>;
  
  // Webhooks (optional)
  setupWebhook?(webhookUrl: string): Promise<void>;
  removeWebhook?(): Promise<void>;
  
  // Provider Info
  getProviderInfo(): ProviderInfo;
  getQuota?(): Promise<QuotaInfo>;
}

export interface EmailAccountConfig {
  provider: 'gmail' | 'outlook' | 'imap';
  email: string;
  credentials?: EmailCredentials;
  imapHost?: string;
  imapPort?: number;
  smtpHost?: string;
  smtpPort?: number;
  secure?: boolean;
}

export interface IMAPConfig {
  email: string;
  password: string;
  imapHost: string;
  imapPort?: number;
  smtpHost: string;
  smtpPort?: number;
  secure?: boolean;
  tls?: boolean;
}

export interface OAuth2Config {
  authUrl: string;
  tokenUrl: string;
  scope: string;
  clientId: string;
  clientSecret: string;
  redirectUri?: string;
}

export interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
  scope?: string;
}