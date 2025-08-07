import { Client } from '@microsoft/microsoft-graph-client';
import { TokenCredentialAuthenticationProvider } from '@microsoft/microsoft-graph-client/authProviders/azureTokenCredentials';
import { ClientSecretCredential } from '@azure/identity';
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

export interface OutlookConfig {
  clientId: string;
  clientSecret: string;
  tenantId: string;
  redirectUri: string;
}

interface MicrosoftGraphMessage {
  id: string;
  conversationId?: string;
  subject?: string;
  bodyPreview?: string;
  body?: {
    contentType: string;
    content: string;
  };
  from?: {
    emailAddress: {
      name?: string;
      address: string;
    };
  };
  toRecipients?: Array<{
    emailAddress: {
      name?: string;
      address: string;
    };
  }>;
  ccRecipients?: Array<{
    emailAddress: {
      name?: string;
      address: string;
    };
  }>;
  bccRecipients?: Array<{
    emailAddress: {
      name?: string;
      address: string;
    };
  }>;
  receivedDateTime?: string;
  sentDateTime?: string;
  hasAttachments?: boolean;
  attachments?: Array<{
    id: string;
    name: string;
    contentType: string;
    size: number;
    isInline: boolean;
    contentId?: string;
  }>;
  isRead?: boolean;
  importance?: string;
  flag?: {
    flagStatus: string;
  };
  isDraft?: boolean;
  categories?: string[];
  parentFolderId?: string;
}

export class OutlookProvider implements EmailProvider {
  private client?: Client;
  private accessToken?: string;
  private refreshToken?: string;
  private userEmail?: string;

  constructor(private config: OutlookConfig) {}

  async authenticate(credentials: EmailCredentials): Promise<AuthResult> {
    try {
      if (credentials.type === 'oauth') {
        if (credentials.authCode) {
          // Exchange auth code for tokens
          const tokenResponse = await this.exchangeCodeForToken(credentials.authCode);
          
          this.accessToken = tokenResponse.access_token;
          this.refreshToken = tokenResponse.refresh_token;
          
          // Initialize Graph client
          this.client = Client.init({
            authProvider: (done) => {
              done(null, this.accessToken!);
            },
          });
          
          // Get user profile
          const user = await this.client.api('/me').get();
          this.userEmail = user.mail || user.userPrincipalName;
          
          return {
            success: true,
            email: this.userEmail,
            accessToken: this.accessToken,
            refreshToken: this.refreshToken,
            expiresAt: new Date(Date.now() + tokenResponse.expires_in * 1000),
          };
        } else if (credentials.accessToken) {
          // Use existing access token
          this.accessToken = credentials.accessToken;
          this.refreshToken = credentials.refreshToken;
          
          this.client = Client.init({
            authProvider: (done) => {
              done(null, this.accessToken!);
            },
          });
          
          const user = await this.client.api('/me').get();
          this.userEmail = user.mail || user.userPrincipalName;
          
          return {
            success: true,
            email: this.userEmail,
          };
        }
      }
      
      throw new Error('Outlook requires OAuth2 authentication');
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  private async exchangeCodeForToken(code: string): Promise<any> {
    const params = new URLSearchParams({
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret,
      code: code,
      redirect_uri: this.config.redirectUri,
      grant_type: 'authorization_code',
    });

    const response = await fetch(`https://login.microsoftonline.com/${this.config.tenantId}/oauth2/v2.0/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params,
    });

    if (!response.ok) {
      throw new Error(`Token exchange failed: ${await response.text()}`);
    }

    return response.json();
  }

  async refreshAuth(refreshToken: string): Promise<AuthResult> {
    try {
      const params = new URLSearchParams({
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      });

      const response = await fetch(`https://login.microsoftonline.com/${this.config.tenantId}/oauth2/v2.0/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params,
      });

      if (!response.ok) {
        throw new Error(`Token refresh failed: ${await response.text()}`);
      }

      const tokenResponse = await response.json();
      
      this.accessToken = tokenResponse.access_token;
      this.refreshToken = tokenResponse.refresh_token || refreshToken;
      
      return {
        success: true,
        accessToken: this.accessToken,
        refreshToken: this.refreshToken,
        expiresAt: new Date(Date.now() + tokenResponse.expires_in * 1000),
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  async validateConnection(): Promise<boolean> {
    if (!this.client) return false;
    
    try {
      await this.client.api('/me').get();
      return true;
    } catch {
      return false;
    }
  }

  async disconnect(): Promise<void> {
    this.client = undefined;
    this.accessToken = undefined;
    this.refreshToken = undefined;
    this.userEmail = undefined;
  }

  async fetchEmails(options: FetchOptions = {}): Promise<Email[]> {
    if (!this.client) throw new Error('Not authenticated');
    
    try {
      let query = this.client.api('/me/messages')
        .top(options.limit || 50)
        .select('id,conversationId,subject,bodyPreview,body,from,toRecipients,ccRecipients,bccRecipients,receivedDateTime,hasAttachments,isRead,importance,flag,isDraft,categories,parentFolderId')
        .orderby('receivedDateTime desc');
      
      // Apply filters
      const filters: string[] = [];
      
      if (options.folder) {
        query = this.client.api(`/me/mailFolders/${options.folder}/messages`)
          .top(options.limit || 50)
          .select('id,conversationId,subject,bodyPreview,body,from,toRecipients,ccRecipients,bccRecipients,receivedDateTime,hasAttachments,isRead,importance,flag,isDraft,categories,parentFolderId')
          .orderby('receivedDateTime desc');
      }
      
      if (options.since) {
        filters.push(`receivedDateTime ge ${options.since.toISOString()}`);
      }
      
      if (options.before) {
        filters.push(`receivedDateTime le ${options.before.toISOString()}`);
      }
      
      if (options.onlyUnread) {
        filters.push('isRead eq false');
      }
      
      if (filters.length > 0) {
        query = query.filter(filters.join(' and '));
      }
      
      if (options.offset) {
        query = query.skip(options.offset);
      }
      
      const response = await query.get();
      
      const emails = await Promise.all(
        response.value.map((msg: MicrosoftGraphMessage) => this.parseOutlookMessage(msg))
      );
      
      return emails;
    } catch (error: any) {
      throw new Error(`Failed to fetch emails: ${error.message}`);
    }
  }

  private async parseOutlookMessage(message: MicrosoftGraphMessage): Promise<Email> {
    const attachments: Attachment[] = [];
    
    if (message.hasAttachments && this.client) {
      try {
        const attachmentResponse = await this.client
          .api(`/me/messages/${message.id}/attachments`)
          .get();
        
        attachments.push(...attachmentResponse.value.map((att: any) => ({
          filename: att.name,
          contentType: att.contentType,
          size: att.size,
          contentId: att.contentId,
        })));
      } catch (error) {
        console.error('Failed to fetch attachments:', error);
      }
    }
    
    return {
      id: message.id,
      threadId: message.conversationId,
      subject: message.subject || '(No Subject)',
      from: message.from ? {
        email: message.from.emailAddress.address,
        name: message.from.emailAddress.name,
      } : { email: 'unknown@unknown.com' },
      to: (message.toRecipients || []).map(r => ({
        email: r.emailAddress.address,
        name: r.emailAddress.name,
      })),
      cc: message.ccRecipients?.map(r => ({
        email: r.emailAddress.address,
        name: r.emailAddress.name,
      })),
      bcc: message.bccRecipients?.map(r => ({
        email: r.emailAddress.address,
        name: r.emailAddress.name,
      })),
      date: new Date(message.receivedDateTime || message.sentDateTime || Date.now()),
      body: {
        text: message.body?.contentType === 'text' 
          ? message.body.content 
          : EmailParser.htmlToText(message.body?.content || ''),
        html: message.body?.contentType === 'html' 
          ? message.body.content 
          : undefined,
      },
      attachments,
      labels: message.categories,
      folders: message.parentFolderId ? [message.parentFolderId] : undefined,
      isRead: message.isRead || false,
      isImportant: message.importance === 'high',
      isStarred: message.flag?.flagStatus === 'flagged',
      isDraft: message.isDraft,
    };
  }

  async getEmail(messageId: string): Promise<Email> {
    if (!this.client) throw new Error('Not authenticated');
    
    const message = await this.client
      .api(`/me/messages/${messageId}`)
      .get();
    
    return this.parseOutlookMessage(message);
  }

  async sendEmail(email: OutgoingEmail): Promise<SentEmail> {
    if (!this.client) throw new Error('Not authenticated');
    
    const message = {
      subject: email.subject,
      body: {
        contentType: email.body.html ? 'html' : 'text',
        content: email.body.html || email.body.text,
      },
      toRecipients: email.to.map(addr => ({
        emailAddress: { address: addr },
      })),
      ccRecipients: email.cc?.map(addr => ({
        emailAddress: { address: addr },
      })),
      bccRecipients: email.bcc?.map(addr => ({
        emailAddress: { address: addr },
      })),
    };
    
    const response = await this.client
      .api('/me/sendMail')
      .post({
        message,
        saveToSentItems: true,
      });
    
    return {
      id: response.id || `sent-${Date.now()}`,
      sentAt: new Date(),
    };
  }

  async getFolders(): Promise<Folder[]> {
    if (!this.client) throw new Error('Not authenticated');
    
    const response = await this.client
      .api('/me/mailFolders')
      .get();
    
    return response.value.map((folder: any) => ({
      id: folder.id,
      name: folder.displayName,
      type: this.mapFolderType(folder.displayName),
      unreadCount: folder.unreadItemCount,
      totalCount: folder.totalItemCount,
      parent: folder.parentFolderId,
    }));
  }

  private mapFolderType(name: string): Folder['type'] {
    const typeMap: Record<string, Folder['type']> = {
      'Inbox': 'inbox',
      'Sent Items': 'sent',
      'Drafts': 'drafts',
      'Deleted Items': 'trash',
      'Junk Email': 'spam',
    };
    
    return typeMap[name] || 'custom';
  }

  async moveEmail(messageId: string, folder: string): Promise<void> {
    if (!this.client) throw new Error('Not authenticated');
    
    await this.client
      .api(`/me/messages/${messageId}/move`)
      .post({
        destinationId: folder,
      });
  }

  async markAsRead(messageId: string): Promise<void> {
    if (!this.client) throw new Error('Not authenticated');
    
    await this.client
      .api(`/me/messages/${messageId}`)
      .patch({
        isRead: true,
      });
  }

  async markAsUnread(messageId: string): Promise<void> {
    if (!this.client) throw new Error('Not authenticated');
    
    await this.client
      .api(`/me/messages/${messageId}`)
      .patch({
        isRead: false,
      });
  }

  async deleteEmail(messageId: string): Promise<void> {
    if (!this.client) throw new Error('Not authenticated');
    
    await this.client
      .api(`/me/messages/${messageId}`)
      .delete();
  }

  async starEmail(messageId: string): Promise<void> {
    if (!this.client) throw new Error('Not authenticated');
    
    await this.client
      .api(`/me/messages/${messageId}`)
      .patch({
        flag: {
          flagStatus: 'flagged',
        },
      });
  }

  async unstarEmail(messageId: string): Promise<void> {
    if (!this.client) throw new Error('Not authenticated');
    
    await this.client
      .api(`/me/messages/${messageId}`)
      .patch({
        flag: {
          flagStatus: 'notFlagged',
        },
      });
  }

  async searchEmails(query: SearchQuery): Promise<Email[]> {
    if (!this.client) throw new Error('Not authenticated');
    
    const filters: string[] = [];
    
    if (query.from) {
      filters.push(`from/emailAddress/address eq '${query.from}'`);
    }
    
    if (query.to) {
      filters.push(`toRecipients/any(r: r/emailAddress/address eq '${query.to}')`);
    }
    
    if (query.subject) {
      filters.push(`contains(subject, '${query.subject}')`);
    }
    
    if (query.body) {
      filters.push(`contains(body/content, '${query.body}')`);
    }
    
    if (query.hasAttachment) {
      filters.push('hasAttachments eq true');
    }
    
    if (query.isUnread) {
      filters.push('isRead eq false');
    }
    
    if (query.isStarred) {
      filters.push(`flag/flagStatus eq 'flagged'`);
    }
    
    if (query.after) {
      filters.push(`receivedDateTime ge ${query.after.toISOString()}`);
    }
    
    if (query.before) {
      filters.push(`receivedDateTime le ${query.before.toISOString()}`);
    }
    
    let searchQuery = this.client
      .api('/me/messages')
      .top(100)
      .orderby('receivedDateTime desc');
    
    if (filters.length > 0) {
      searchQuery = searchQuery.filter(filters.join(' and '));
    }
    
    if (query.query) {
      searchQuery = searchQuery.search(`"${query.query}"`);
    }
    
    const response = await searchQuery.get();
    
    return Promise.all(
      response.value.map((msg: MicrosoftGraphMessage) => this.parseOutlookMessage(msg))
    );
  }

  async setupWebhook(webhookUrl: string): Promise<void> {
    if (!this.client) throw new Error('Not authenticated');
    
    // Create subscription for mail notifications
    await this.client.api('/subscriptions').post({
      changeType: 'created,updated',
      notificationUrl: webhookUrl,
      resource: '/me/messages',
      expirationDateTime: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(), // 3 days
      clientState: 'secretClientState',
    });
  }

  async removeWebhook(): Promise<void> {
    if (!this.client) throw new Error('Not authenticated');
    
    // List and delete all subscriptions
    const subscriptions = await this.client.api('/subscriptions').get();
    
    for (const subscription of subscriptions.value) {
      await this.client.api(`/subscriptions/${subscription.id}`).delete();
    }
  }

  getProviderInfo(): ProviderInfo {
    return {
      name: 'Outlook',
      type: 'outlook',
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
    if (!this.client) throw new Error('Not authenticated');
    
    try {
      const mailboxSettings = await this.client.api('/me/mailboxSettings').get();
      
      // Outlook doesn't provide quota via Graph API by default
      return {
        used: 0,
        total: 50 * 1024 * 1024 * 1024, // 50 GB (default for Outlook.com)
        percentage: 0,
      };
    } catch {
      return {
        used: 0,
        total: 50 * 1024 * 1024 * 1024,
        percentage: 0,
      };
    }
  }
}