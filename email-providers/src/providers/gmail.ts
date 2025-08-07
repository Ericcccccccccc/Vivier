import { google, gmail_v1 } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import {
  EmailProvider,
  Email,
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
  Attachment
} from '../interface';
import { EmailParser } from '../utils/parser';

export interface GmailConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  email?: string;
}

export class GmailProvider implements EmailProvider {
  private oauth2Client: OAuth2Client;
  private gmail?: gmail_v1.Gmail;
  private userEmail?: string;

  constructor(private config: GmailConfig) {
    this.oauth2Client = new OAuth2Client(
      config.clientId,
      config.clientSecret,
      config.redirectUri
    );
  }

  async authenticate(credentials: EmailCredentials): Promise<AuthResult> {
    try {
      if (credentials.type === 'oauth') {
        if (credentials.authCode) {
          // Exchange auth code for tokens
          const { tokens } = await this.oauth2Client.getToken(credentials.authCode);
          this.oauth2Client.setCredentials(tokens);
          
          // Initialize Gmail API
          this.gmail = google.gmail({ version: 'v1', auth: this.oauth2Client });
          
          // Get user profile
          const profile = await this.gmail.users.getProfile({ userId: 'me' });
          this.userEmail = profile.data.emailAddress || undefined;
          
          return {
            success: true,
            email: this.userEmail,
            accessToken: tokens.access_token || undefined,
            refreshToken: tokens.refresh_token || undefined,
            expiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : undefined,
          };
        } else if (credentials.accessToken) {
          // Use existing access token
          this.oauth2Client.setCredentials({
            access_token: credentials.accessToken,
            refresh_token: credentials.refreshToken,
          });
          
          this.gmail = google.gmail({ version: 'v1', auth: this.oauth2Client });
          
          const profile = await this.gmail.users.getProfile({ userId: 'me' });
          this.userEmail = profile.data.emailAddress || undefined;
          
          return {
            success: true,
            email: this.userEmail,
          };
        }
      }
      
      throw new Error('Gmail requires OAuth2 authentication');
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  async refreshAuth(refreshToken: string): Promise<AuthResult> {
    try {
      this.oauth2Client.setCredentials({ refresh_token: refreshToken });
      const { credentials } = await this.oauth2Client.refreshAccessToken();
      
      return {
        success: true,
        accessToken: credentials.access_token || undefined,
        refreshToken: credentials.refresh_token || refreshToken,
        expiresAt: credentials.expiry_date ? new Date(credentials.expiry_date) : undefined,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  async validateConnection(): Promise<boolean> {
    if (!this.gmail) return false;
    
    try {
      await this.gmail.users.getProfile({ userId: 'me' });
      return true;
    } catch {
      return false;
    }
  }

  async disconnect(): Promise<void> {
    this.oauth2Client.revokeCredentials();
    this.gmail = undefined;
    this.userEmail = undefined;
  }

  async fetchEmails(options: FetchOptions = {}): Promise<Email[]> {
    if (!this.gmail) throw new Error('Not authenticated');
    
    const query = this.buildQuery(options);
    
    try {
      // List messages
      const response = await this.gmail.users.messages.list({
        userId: 'me',
        q: query,
        maxResults: options.limit || 50,
        pageToken: options.pageToken,
        includeSpamTrash: options.includeSpam,
      });
      
      if (!response.data.messages || response.data.messages.length === 0) {
        return [];
      }
      
      // Fetch full messages in parallel batches
      const emails = await this.batchFetchMessages(response.data.messages);
      
      return emails;
    } catch (error: any) {
      throw new Error(`Failed to fetch emails: ${error.message}`);
    }
  }

  private async batchFetchMessages(messages: gmail_v1.Schema$Message[]): Promise<Email[]> {
    if (!this.gmail) throw new Error('Not authenticated');
    
    const batchSize = 10;
    const emails: Email[] = [];
    
    for (let i = 0; i < messages.length; i += batchSize) {
      const batch = messages.slice(i, i + batchSize);
      const promises = batch.map(msg => 
        this.gmail!.users.messages.get({
          userId: 'me',
          id: msg.id!,
          format: 'full',
        })
      );
      
      const responses = await Promise.all(promises);
      const parsedEmails = responses.map(r => this.parseGmailMessage(r.data));
      emails.push(...parsedEmails);
    }
    
    return emails;
  }

  private parseGmailMessage(message: gmail_v1.Schema$Message): Email {
    const headers = this.extractHeaders(message.payload?.headers || []);
    
    return {
      id: message.id!,
      threadId: message.threadId || undefined,
      subject: headers.subject || '(No Subject)',
      from: EmailParser.parseEmailAddress(headers.from || ''),
      to: EmailParser.parseEmailAddresses(headers.to || ''),
      cc: headers.cc ? EmailParser.parseEmailAddresses(headers.cc) : undefined,
      bcc: headers.bcc ? EmailParser.parseEmailAddresses(headers.bcc) : undefined,
      date: new Date(parseInt(message.internalDate || '0')),
      body: this.extractBody(message.payload),
      attachments: this.extractAttachments(message.payload),
      labels: message.labelIds,
      isRead: !message.labelIds?.includes('UNREAD'),
      isImportant: message.labelIds?.includes('IMPORTANT'),
      isStarred: message.labelIds?.includes('STARRED'),
      isDraft: message.labelIds?.includes('DRAFT'),
      isSpam: message.labelIds?.includes('SPAM'),
    };
  }

  private extractHeaders(headers: gmail_v1.Schema$MessagePartHeader[]): Record<string, string> {
    return headers.reduce((acc, header) => {
      if (header.name && header.value) {
        acc[header.name.toLowerCase()] = header.value;
      }
      return acc;
    }, {} as Record<string, string>);
  }

  private extractBody(payload?: gmail_v1.Schema$MessagePart): { text: string; html?: string } {
    let textBody = '';
    let htmlBody = '';
    
    const extractParts = (part?: gmail_v1.Schema$MessagePart) => {
      if (!part) return;
      
      if (part.mimeType === 'text/plain' && part.body?.data) {
        textBody += Buffer.from(part.body.data, 'base64').toString();
      } else if (part.mimeType === 'text/html' && part.body?.data) {
        htmlBody += Buffer.from(part.body.data, 'base64').toString();
      }
      
      if (part.parts) {
        part.parts.forEach(extractParts);
      }
    };
    
    extractParts(payload);
    
    return {
      text: textBody || EmailParser.htmlToText(htmlBody),
      html: htmlBody || undefined,
    };
  }

  private extractAttachments(payload?: gmail_v1.Schema$MessagePart): Attachment[] {
    const attachments: Attachment[] = [];
    
    const extractParts = (part?: gmail_v1.Schema$MessagePart) => {
      if (!part) return;
      
      if (part.filename && part.body?.attachmentId) {
        attachments.push({
          filename: part.filename,
          contentType: part.mimeType || 'application/octet-stream',
          size: part.body.size || 0,
          contentId: part.body.attachmentId,
        });
      }
      
      if (part.parts) {
        part.parts.forEach(extractParts);
      }
    };
    
    extractParts(payload);
    
    return attachments;
  }

  async getEmail(messageId: string): Promise<Email> {
    if (!this.gmail) throw new Error('Not authenticated');
    
    const response = await this.gmail.users.messages.get({
      userId: 'me',
      id: messageId,
      format: 'full',
    });
    
    return this.parseGmailMessage(response.data);
  }

  async sendEmail(email: OutgoingEmail): Promise<SentEmail> {
    if (!this.gmail) throw new Error('Not authenticated');
    
    const message = this.createMimeMessage(email);
    
    const response = await this.gmail.users.messages.send({
      userId: 'me',
      requestBody: {
        raw: Buffer.from(message).toString('base64url'),
      },
    });
    
    return {
      id: response.data.id!,
      threadId: response.data.threadId || undefined,
      sentAt: new Date(),
    };
  }

  private createMimeMessage(email: OutgoingEmail): string {
    const boundary = `boundary_${Date.now()}`;
    
    let message = '';
    message += `From: ${email.from}\r\n`;
    message += `To: ${email.to.join(', ')}\r\n`;
    if (email.cc?.length) message += `Cc: ${email.cc.join(', ')}\r\n`;
    if (email.bcc?.length) message += `Bcc: ${email.bcc.join(', ')}\r\n`;
    message += `Subject: ${email.subject}\r\n`;
    if (email.inReplyTo) message += `In-Reply-To: ${email.inReplyTo}\r\n`;
    if (email.references?.length) message += `References: ${email.references.join(' ')}\r\n`;
    message += `MIME-Version: 1.0\r\n`;
    message += `Content-Type: multipart/alternative; boundary="${boundary}"\r\n\r\n`;
    
    // Text part
    message += `--${boundary}\r\n`;
    message += `Content-Type: text/plain; charset=utf-8\r\n\r\n`;
    message += `${email.body.text}\r\n\r\n`;
    
    // HTML part (if provided)
    if (email.body.html) {
      message += `--${boundary}\r\n`;
      message += `Content-Type: text/html; charset=utf-8\r\n\r\n`;
      message += `${email.body.html}\r\n\r\n`;
    }
    
    message += `--${boundary}--`;
    
    return message;
  }

  async getFolders(): Promise<Folder[]> {
    if (!this.gmail) throw new Error('Not authenticated');
    
    const response = await this.gmail.users.labels.list({ userId: 'me' });
    
    return (response.data.labels || []).map(label => ({
      id: label.id!,
      name: label.name!,
      type: this.mapLabelType(label.name!),
      unreadCount: label.messagesUnread || 0,
      totalCount: label.messagesTotal || 0,
    }));
  }

  private mapLabelType(name: string): Folder['type'] {
    const typeMap: Record<string, Folder['type']> = {
      'INBOX': 'inbox',
      'SENT': 'sent',
      'DRAFT': 'drafts',
      'TRASH': 'trash',
      'SPAM': 'spam',
    };
    
    return typeMap[name] || 'custom';
  }

  async moveEmail(messageId: string, folder: string): Promise<void> {
    if (!this.gmail) throw new Error('Not authenticated');
    
    await this.gmail.users.messages.modify({
      userId: 'me',
      id: messageId,
      requestBody: {
        addLabelIds: [folder],
        removeLabelIds: ['INBOX'],
      },
    });
  }

  async markAsRead(messageId: string): Promise<void> {
    if (!this.gmail) throw new Error('Not authenticated');
    
    await this.gmail.users.messages.modify({
      userId: 'me',
      id: messageId,
      requestBody: {
        removeLabelIds: ['UNREAD'],
      },
    });
  }

  async markAsUnread(messageId: string): Promise<void> {
    if (!this.gmail) throw new Error('Not authenticated');
    
    await this.gmail.users.messages.modify({
      userId: 'me',
      id: messageId,
      requestBody: {
        addLabelIds: ['UNREAD'],
      },
    });
  }

  async deleteEmail(messageId: string): Promise<void> {
    if (!this.gmail) throw new Error('Not authenticated');
    
    await this.gmail.users.messages.trash({
      userId: 'me',
      id: messageId,
    });
  }

  async starEmail(messageId: string): Promise<void> {
    if (!this.gmail) throw new Error('Not authenticated');
    
    await this.gmail.users.messages.modify({
      userId: 'me',
      id: messageId,
      requestBody: {
        addLabelIds: ['STARRED'],
      },
    });
  }

  async unstarEmail(messageId: string): Promise<void> {
    if (!this.gmail) throw new Error('Not authenticated');
    
    await this.gmail.users.messages.modify({
      userId: 'me',
      id: messageId,
      requestBody: {
        removeLabelIds: ['STARRED'],
      },
    });
  }

  async searchEmails(query: SearchQuery): Promise<Email[]> {
    const gmailQuery = this.buildSearchQuery(query);
    
    return this.fetchEmails({
      limit: 100,
    });
  }

  private buildQuery(options: FetchOptions): string {
    const parts: string[] = [];
    
    if (options.folder && options.folder !== 'INBOX') {
      parts.push(`label:${options.folder}`);
    }
    
    if (options.since) {
      parts.push(`after:${Math.floor(options.since.getTime() / 1000)}`);
    }
    
    if (options.before) {
      parts.push(`before:${Math.floor(options.before.getTime() / 1000)}`);
    }
    
    if (options.onlyUnread) {
      parts.push('is:unread');
    }
    
    if (!options.includeSpam) {
      parts.push('-label:SPAM');
    }
    
    if (!options.includeDrafts) {
      parts.push('-label:DRAFT');
    }
    
    return parts.join(' ');
  }

  private buildSearchQuery(query: SearchQuery): string {
    const parts: string[] = [];
    
    if (query.query) parts.push(query.query);
    if (query.from) parts.push(`from:${query.from}`);
    if (query.to) parts.push(`to:${query.to}`);
    if (query.subject) parts.push(`subject:${query.subject}`);
    if (query.body) parts.push(query.body);
    if (query.hasAttachment) parts.push('has:attachment');
    if (query.isUnread) parts.push('is:unread');
    if (query.isStarred) parts.push('is:starred');
    if (query.after) parts.push(`after:${Math.floor(query.after.getTime() / 1000)}`);
    if (query.before) parts.push(`before:${Math.floor(query.before.getTime() / 1000)}`);
    if (query.larger) parts.push(`larger:${query.larger}`);
    if (query.smaller) parts.push(`smaller:${query.smaller}`);
    
    if (query.labels) {
      query.labels.forEach(label => parts.push(`label:${label}`));
    }
    
    return parts.join(' ');
  }

  async setupWebhook(webhookUrl: string): Promise<void> {
    if (!this.gmail) throw new Error('Not authenticated');
    
    // Set up Gmail push notifications via Cloud Pub/Sub
    await this.gmail.users.watch({
      userId: 'me',
      requestBody: {
        topicName: `projects/${process.env.GCP_PROJECT_ID}/topics/gmail-updates`,
        labelIds: ['INBOX'],
      },
    });
  }

  async removeWebhook(): Promise<void> {
    if (!this.gmail) throw new Error('Not authenticated');
    
    await this.gmail.users.stop({ userId: 'me' });
  }

  getProviderInfo(): ProviderInfo {
    return {
      name: 'Gmail',
      type: 'gmail',
      features: {
        oauth: true,
        webhooks: true,
        labels: true,
        folders: true,
        threading: true,
        push: true,
      },
    };
  }

  async getQuota(): Promise<QuotaInfo> {
    if (!this.gmail) throw new Error('Not authenticated');
    
    // Gmail doesn't provide quota via API, return mock data
    return {
      used: 0,
      total: 15 * 1024 * 1024 * 1024, // 15 GB
      percentage: 0,
    };
  }
}