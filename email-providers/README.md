# Vivier Email Providers

A comprehensive email provider integration layer supporting Gmail (OAuth2), Outlook (OAuth2), and generic IMAP/SMTP servers.

## Features

- **Multi-Provider Support**: Gmail, Outlook, and any IMAP/SMTP server
- **OAuth2 Authentication**: Secure authentication for Gmail and Outlook
- **Batch Operations**: Efficient bulk email fetching
- **Connection Pooling**: Reusable IMAP connections with automatic management
- **Webhook Support**: Real-time email notifications (Gmail & Outlook)
- **Email Parsing**: Advanced email parsing with signature detection, language detection, and thread grouping
- **Type Safety**: Full TypeScript support with comprehensive type definitions

## Installation

```bash
npm install @vivier/email-providers
```

## Quick Start

### Gmail Provider

```typescript
import { GmailProvider, EmailProviderFactory } from '@vivier/email-providers';

// Using the factory
const provider = EmailProviderFactory.create({
  provider: 'gmail',
  email: 'user@gmail.com',
});

// Authenticate with OAuth2
const authResult = await provider.authenticate({
  type: 'oauth',
  authCode: 'oauth-authorization-code',
});

// Fetch emails
const emails = await provider.fetchEmails({
  limit: 50,
  onlyUnread: true,
});

// Send email
const sentEmail = await provider.sendEmail({
  from: 'user@gmail.com',
  to: ['recipient@example.com'],
  subject: 'Hello',
  body: {
    text: 'Plain text content',
    html: '<p>HTML content</p>',
  },
});
```

### IMAP Provider

```typescript
import { IMAPProvider } from '@vivier/email-providers';

const provider = new IMAPProvider({
  email: 'user@example.com',
  password: 'password',
  imapHost: 'imap.example.com',
  imapPort: 993,
  smtpHost: 'smtp.example.com',
  smtpPort: 587,
});

// Authenticate
const authResult = await provider.authenticate({
  type: 'password',
  email: 'user@example.com',
  password: 'password',
});

// Fetch emails
const emails = await provider.fetchEmails();
```

### OAuth2 Handler

```typescript
import { OAuth2Handler } from '@vivier/email-providers';

const oauth = new OAuth2Handler('https://your-app.com/auth/callback');

// Generate authorization URL
const authUrl = oauth.getAuthUrl('gmail');

// Exchange authorization code for tokens
const tokens = await oauth.exchangeCode('gmail', authorizationCode);

// Refresh expired token
const newTokens = await oauth.refreshToken('gmail', refreshToken);
```

### Connection Pool (IMAP)

```typescript
import { ConnectionPool } from '@vivier/email-providers';

const pool = new ConnectionPool({
  maxConnections: 10,
  maxIdleTime: 300000, // 5 minutes
});

// Acquire connection
const connection = await pool.acquire('account-id', imapConfig);

// Use connection...

// Release back to pool
pool.release('account-id');

// Health check
const status = await pool.healthCheck();
```

## Provider Detection

```typescript
import { EmailProviderFactory } from '@vivier/email-providers';

// Detect provider from email address
const detection = await EmailProviderFactory.detectProvider('user@gmail.com');
console.log(detection); // { provider: 'gmail', confidence: 1.0 }

// Get IMAP configuration for unknown domains
const config = EmailProviderFactory.getIMAPConfig('user@company.com');
console.log(config); // { imapHost: 'imap.company.com', ... }
```

## Email Parsing Utilities

```typescript
import { EmailParser } from '@vivier/email-providers';

// Parse email addresses
const address = EmailParser.parseEmailAddress('John Doe <john@example.com>');

// Convert HTML to plain text
const text = EmailParser.htmlToText('<p>Hello <strong>World</strong></p>');

// Detect language
const language = EmailParser.detectLanguage('Bonjour le monde');

// Extract signature
const { content, signature } = EmailParser.extractSignature(emailBody);

// Extract thread ID
const threadId = EmailParser.extractThreadId(subject, references);
```

## Email Formatting

```typescript
import { EmailFormatter } from '@vivier/email-providers';

// Create MIME message
const mimeMessage = EmailFormatter.createMimeMessage({
  from: 'sender@example.com',
  to: ['recipient@example.com'],
  subject: 'Test',
  body: { text: 'Hello', html: '<p>Hello</p>' },
});

// Format reply
const reply = EmailFormatter.formatReply(originalEmail, replyText);

// Format forward
const forward = EmailFormatter.formatForward(originalEmail, forwardText);
```

## Webhook Handling

```typescript
import { WebhookHandler } from '@vivier/email-providers';

const handler = new WebhookHandler();

// Register callback for email updates
handler.registerCallback('user@gmail.com', async (email) => {
  console.log('New email:', email);
});

// Handle incoming webhook
const result = await handler.handleWebhookRequest(
  'gmail',
  headers,
  body,
  query
);
```

## Environment Variables

```bash
# Gmail OAuth2
GOOGLE_CLIENT_ID=your-client-id
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_REDIRECT_URI=https://your-app.com/auth/callback/gmail

# Outlook OAuth2
MICROSOFT_CLIENT_ID=your-client-id
MICROSOFT_CLIENT_SECRET=your-client-secret
MICROSOFT_TENANT_ID=common
MICROSOFT_REDIRECT_URI=https://your-app.com/auth/callback/outlook

# Webhooks
GMAIL_WEBHOOK_SECRET=your-secret
GMAIL_TOPIC_NAME=projects/your-project/topics/gmail-updates
OUTLOOK_CLIENT_STATE=your-client-state
WEBHOOK_BASE_URL=https://your-app.com
```

## Supported Providers

### OAuth2 Providers
- **Gmail**: Full OAuth2 support with labels, threading, and push notifications
- **Outlook**: Full OAuth2 support with folders, categories, and webhooks

### IMAP Providers (Pre-configured)
- Yahoo Mail
- iCloud Mail
- AOL Mail
- Zoho Mail
- ProtonMail (requires Bridge)
- FastMail
- And any custom IMAP/SMTP server

## Error Handling

```typescript
try {
  await provider.authenticate(credentials);
} catch (error) {
  if (error.message.includes('Invalid credentials')) {
    // Handle authentication error
  } else if (error.message.includes('Connection timeout')) {
    // Handle connection error
  }
}
```

## Testing

```bash
# Run tests
npm test

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode
npm run test:watch
```

## License

MIT