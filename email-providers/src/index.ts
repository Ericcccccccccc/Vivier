// Main exports for the email-providers package

// Core interfaces and types
export * from './interface';

// Providers
export { GmailProvider } from './providers/gmail';
export { OutlookProvider } from './providers/outlook';
export { IMAPProvider } from './providers/imap';

// Authentication
export { OAuth2Handler } from './auth/oauth-handler';
export { GmailOAuth } from './auth/gmail-oauth';

// Utilities
export { EmailParser } from './utils/parser';
export { EmailFormatter } from './utils/formatter';

// Factory and management
export { EmailProviderFactory } from './provider-factory';
export { ConnectionPool } from './connection-pool';
export { WebhookHandler } from './webhook-handler';

// Configuration
export * from './config';

// Re-export commonly used types for convenience
export type {
  Email,
  EmailProvider,
  EmailAddress,
  EmailCredentials,
  AuthResult,
  FetchOptions,
  OutgoingEmail,
  SentEmail,
  Folder,
  SearchQuery,
  ProviderInfo,
  QuotaInfo,
  EmailAccountConfig,
  IMAPConfig,
} from './interface';