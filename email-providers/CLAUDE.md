# Email Provider Layer - Multi-Provider Support

## Your Mission
Create a flexible email provider abstraction that supports Gmail (OAuth2), Outlook (OAuth2), and any IMAP/SMTP server. This layer handles all email fetching, sending, and account management.

## Architecture Principles

1. **Provider Agnostic**: Common interface for all providers
2. **Secure Authentication**: OAuth2 preferred, encrypted passwords for IMAP
3. **Batch Operations**: Efficient bulk email fetching
4. **Attachment Handling**: Parse and store attachment metadata
5. **Thread Support**: Group emails by conversation
6. **Real-time Updates**: Webhook support where available
7. **Error Recovery**: Handle connection failures gracefully

## Provider Interface Design

```typescript
export interface EmailProvider {
  // Authentication
  authenticate(credentials: EmailCredentials): Promise<AuthResult>;
  refreshAuth(refreshToken: string): Promise<AuthResult>;
  validateConnection(): Promise<boolean>;
  
  // Email Operations
  fetchEmails(options: FetchOptions): Promise<Email[]>;
  getEmail(messageId: string): Promise<Email>;
  sendEmail(email: OutgoingEmail): Promise<SentEmail>;
  
  // Folder Operations
  getFolders(): Promise<Folder[]>;
  moveEmail(messageId: string, folder: string): Promise<void>;
  markAsRead(messageId: string): Promise<void>;
  deleteEmail(messageId: string): Promise<void>;
  
  // Search
  searchEmails(query: SearchQuery): Promise<Email[]>;
  
  // Webhooks (if supported)
  setupWebhook?(webhookUrl: string): Promise<void>;
  removeWebhook?(): Promise<void>;
  
  // Provider Info
  getProviderInfo(): ProviderInfo;
  getQuota?(): Promise<QuotaInfo>;
}
```

## Implementation Requirements

- OAuth2 Security: Proper state parameter, PKCE for public clients
- Connection Management: Reuse IMAP connections, handle timeouts
- Error Handling: Graceful degradation, retry logic
- Batch Operations: Fetch multiple emails efficiently
- Attachment Handling: Don't download full attachments, just metadata
- Thread Support: Group related emails
- Search Capabilities: Provider-specific search syntax
- Rate Limiting: Respect provider limits
- Webhook Verification: Validate webhook signatures
- Auto-Configuration: Detect settings from email domain