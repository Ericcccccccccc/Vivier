import { Email, EmailAddress, Attachment, OutgoingEmail, Folder } from './interface';
import crypto from 'crypto';

export class EmailTestUtils {
  /**
   * Create a mock email with optional overrides
   */
  static createMockEmail(overrides?: Partial<Email>): Email {
    const defaultEmail: Email = {
      id: `email-${crypto.randomUUID()}`,
      threadId: `thread-${crypto.randomUUID()}`,
      subject: 'Test Email Subject',
      from: {
        email: 'sender@example.com',
        name: 'Test Sender',
      },
      to: [
        {
          email: 'recipient@example.com',
          name: 'Test Recipient',
        },
      ],
      cc: [],
      bcc: [],
      date: new Date(),
      body: {
        text: 'This is a test email body in plain text.',
        html: '<p>This is a test email body in <strong>HTML</strong>.</p>',
      },
      attachments: [],
      labels: ['INBOX'],
      isRead: false,
      isImportant: false,
      isStarred: false,
      isDraft: false,
      isSpam: false,
    };

    return { ...defaultEmail, ...overrides };
  }

  /**
   * Create a mock Gmail API message
   */
  static createMockGmailMessage(overrides?: any): any {
    return {
      id: 'gmail-message-id',
      threadId: 'gmail-thread-id',
      labelIds: ['INBOX', 'UNREAD'],
      snippet: 'This is a snippet of the email content...',
      historyId: '12345',
      internalDate: Date.now().toString(),
      payload: {
        mimeType: 'multipart/alternative',
        headers: [
          { name: 'From', value: 'sender@gmail.com' },
          { name: 'To', value: 'recipient@gmail.com' },
          { name: 'Subject', value: 'Gmail Test Subject' },
          { name: 'Date', value: new Date().toUTCString() },
          { name: 'Message-ID', value: '<message-id@gmail.com>' },
        ],
        parts: [
          {
            mimeType: 'text/plain',
            body: {
              data: Buffer.from('Plain text content').toString('base64'),
              size: 18,
            },
          },
          {
            mimeType: 'text/html',
            body: {
              data: Buffer.from('<p>HTML content</p>').toString('base64'),
              size: 19,
            },
          },
        ],
      },
      sizeEstimate: 1024,
      ...overrides,
    };
  }

  /**
   * Create a mock IMAP message
   */
  static createMockIMAPMessage(overrides?: any): any {
    return {
      attributes: {
        uid: 12345,
        flags: ['\\Seen'],
        date: new Date(),
        size: 2048,
      },
      headers: {
        from: ['sender@imap.com'],
        to: ['recipient@imap.com'],
        subject: ['IMAP Test Subject'],
        date: [new Date().toUTCString()],
        'message-id': ['<message-id@imap.com>'],
      },
      body: 'This is the raw email body content',
      ...overrides,
    };
  }

  /**
   * Create a mock Outlook/Graph API message
   */
  static createMockOutlookMessage(overrides?: any): any {
    return {
      id: 'outlook-message-id',
      conversationId: 'outlook-conversation-id',
      subject: 'Outlook Test Subject',
      bodyPreview: 'This is a preview of the email...',
      body: {
        contentType: 'html',
        content: '<p>This is the email body</p>',
      },
      from: {
        emailAddress: {
          address: 'sender@outlook.com',
          name: 'Outlook Sender',
        },
      },
      toRecipients: [
        {
          emailAddress: {
            address: 'recipient@outlook.com',
            name: 'Outlook Recipient',
          },
        },
      ],
      ccRecipients: [],
      bccRecipients: [],
      receivedDateTime: new Date().toISOString(),
      sentDateTime: new Date().toISOString(),
      hasAttachments: false,
      isRead: false,
      importance: 'normal',
      flag: {
        flagStatus: 'notFlagged',
      },
      isDraft: false,
      categories: [],
      ...overrides,
    };
  }

  /**
   * Create a mock outgoing email
   */
  static createMockOutgoingEmail(overrides?: Partial<OutgoingEmail>): OutgoingEmail {
    const defaultEmail: OutgoingEmail = {
      from: 'sender@example.com',
      to: ['recipient@example.com'],
      subject: 'Test Outgoing Email',
      body: {
        text: 'This is a test outgoing email.',
        html: '<p>This is a test <strong>outgoing</strong> email.</p>',
      },
    };

    return { ...defaultEmail, ...overrides };
  }

  /**
   * Create a mock folder
   */
  static createMockFolder(overrides?: Partial<Folder>): Folder {
    const defaultFolder: Folder = {
      id: 'folder-id',
      name: 'Test Folder',
      type: 'custom',
      unreadCount: 5,
      totalCount: 20,
    };

    return { ...defaultFolder, ...overrides };
  }

  /**
   * Create a mock attachment
   */
  static createMockAttachment(overrides?: Partial<Attachment>): Attachment {
    const defaultAttachment: Attachment = {
      filename: 'test-document.pdf',
      contentType: 'application/pdf',
      size: 1024 * 50, // 50 KB
      contentId: 'attachment-id',
    };

    return { ...defaultAttachment, ...overrides };
  }

  /**
   * Simulate OAuth2 flow
   */
  static async simulateOAuthFlow(provider: string): Promise<{
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
  }> {
    // Simulate async OAuth flow
    await new Promise(resolve => setTimeout(resolve, 100));

    return {
      accessToken: `mock-access-token-${provider}-${Date.now()}`,
      refreshToken: `mock-refresh-token-${provider}-${Date.now()}`,
      expiresIn: 3600,
    };
  }

  /**
   * Create test email addresses
   */
  static createEmailAddresses(count: number = 3): EmailAddress[] {
    const addresses: EmailAddress[] = [];
    
    for (let i = 0; i < count; i++) {
      addresses.push({
        email: `user${i + 1}@example.com`,
        name: `User ${i + 1}`,
      });
    }

    return addresses;
  }

  /**
   * Create a batch of mock emails
   */
  static createMockEmailBatch(count: number = 10): Email[] {
    const emails: Email[] = [];
    const now = Date.now();

    for (let i = 0; i < count; i++) {
      emails.push(
        this.createMockEmail({
          id: `email-${i}`,
          subject: `Test Email ${i + 1}`,
          date: new Date(now - i * 3600000), // 1 hour apart
          isRead: i % 3 === 0,
          isImportant: i % 5 === 0,
        })
      );
    }

    return emails;
  }

  /**
   * Create mock search results
   */
  static createMockSearchResults(query: string, count: number = 5): Email[] {
    const emails: Email[] = [];

    for (let i = 0; i < count; i++) {
      emails.push(
        this.createMockEmail({
          id: `search-result-${i}`,
          subject: `Search Result: ${query} (${i + 1})`,
          body: {
            text: `This email contains the search query: ${query}`,
            html: `<p>This email contains the search query: <strong>${query}</strong></p>`,
          },
        })
      );
    }

    return emails;
  }

  /**
   * Generate random email content
   */
  static generateRandomContent(): { text: string; html: string } {
    const subjects = [
      'Meeting reminder',
      'Project update',
      'Invoice attached',
      'Weekly report',
      'Quick question',
      'Follow up',
      'Important announcement',
      'Newsletter',
    ];

    const bodies = [
      'I hope this email finds you well.',
      'Please find attached the requested documents.',
      'Looking forward to hearing from you.',
      'Let me know if you have any questions.',
      'Thank you for your time and consideration.',
      'Please review and provide feedback.',
      'This is a reminder about our upcoming meeting.',
      'Here is the weekly update as requested.',
    ];

    const subject = subjects[Math.floor(Math.random() * subjects.length)];
    const body = bodies[Math.floor(Math.random() * bodies.length)];

    return {
      text: body,
      html: `<p>${body}</p>`,
    };
  }

  /**
   * Mock webhook payload
   */
  static createMockWebhookPayload(provider: string): any {
    switch (provider) {
      case 'gmail':
        return {
          message: {
            data: Buffer.from(JSON.stringify({
              emailAddress: 'user@gmail.com',
              historyId: '12345',
            })).toString('base64'),
            messageId: 'msg-id',
            publishTime: new Date().toISOString(),
          },
          subscription: 'projects/test/subscriptions/gmail-updates',
        };

      case 'outlook':
        return {
          value: [
            {
              subscriptionId: 'sub-id',
              changeType: 'created',
              resource: 'me/messages/msg-id',
              resourceData: {
                id: 'msg-id',
                '@odata.type': '#Microsoft.Graph.Message',
                '@odata.id': 'messages/msg-id',
              },
              clientState: 'secret',
              tenantId: 'tenant-id',
            },
          ],
        };

      default:
        return {
          event: 'email.received',
          data: {
            messageId: 'msg-id',
            timestamp: Date.now(),
          },
        };
    }
  }

  /**
   * Validate email structure
   */
  static isValidEmail(email: any): email is Email {
    return (
      typeof email === 'object' &&
      typeof email.id === 'string' &&
      typeof email.subject === 'string' &&
      typeof email.from === 'object' &&
      Array.isArray(email.to) &&
      email.date instanceof Date &&
      typeof email.body === 'object' &&
      Array.isArray(email.attachments) &&
      typeof email.isRead === 'boolean'
    );
  }
}