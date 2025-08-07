import * as Imap from 'node-imap';
import { simpleParser, ParsedMail } from 'mailparser';
import nodemailer from 'nodemailer';
import { Readable } from 'stream';
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
  Attachment,
  IMAPConfig
} from '../interface';
import { EmailParser } from '../utils/parser';

export class IMAPProvider implements EmailProvider {
  private imap?: Imap;
  private smtp?: nodemailer.Transporter;
  private config: IMAPConfig;
  private isConnected: boolean = false;

  constructor(config: IMAPConfig) {
    this.config = config;
  }

  async authenticate(credentials: EmailCredentials): Promise<AuthResult> {
    try {
      if (credentials.type === 'password') {
        this.config.email = credentials.email || this.config.email;
        this.config.password = credentials.password || this.config.password;
      } else {
        return {
          success: false,
          error: 'IMAP requires password authentication',
        };
      }

      // Initialize IMAP connection
      this.imap = new Imap({
        user: this.config.email,
        password: this.config.password,
        host: this.config.imapHost,
        port: this.config.imapPort || 993,
        tls: this.config.tls !== false,
        tlsOptions: { rejectUnauthorized: false },
        authTimeout: 10000,
      });

      // Initialize SMTP transporter
      this.smtp = nodemailer.createTransporter({
        host: this.config.smtpHost,
        port: this.config.smtpPort || 587,
        secure: this.config.smtpPort === 465,
        auth: {
          user: this.config.email,
          pass: this.config.password,
        },
        tls: {
          rejectUnauthorized: false,
        },
      });

      // Test IMAP connection
      await this.connectImap();
      
      // Test SMTP connection
      await this.smtp.verify();

      return {
        success: true,
        email: this.config.email,
      };
    } catch (error: any) {
      return {
        success: false,
        error: `Authentication failed: ${error.message}`,
      };
    }
  }

  private connectImap(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.imap) {
        reject(new Error('IMAP not initialized'));
        return;
      }

      if (this.isConnected) {
        resolve();
        return;
      }

      this.imap.once('ready', () => {
        this.isConnected = true;
        resolve();
      });

      this.imap.once('error', (err: Error) => {
        this.isConnected = false;
        reject(err);
      });

      this.imap.once('end', () => {
        this.isConnected = false;
      });

      this.imap.connect();
    });
  }

  async refreshAuth(refreshToken: string): Promise<AuthResult> {
    // IMAP doesn't use refresh tokens
    return {
      success: false,
      error: 'IMAP does not support token refresh',
    };
  }

  async validateConnection(): Promise<boolean> {
    if (!this.imap || !this.smtp) return false;

    try {
      if (!this.isConnected) {
        await this.connectImap();
      }
      
      await this.smtp.verify();
      return true;
    } catch {
      return false;
    }
  }

  async disconnect(): Promise<void> {
    if (this.imap && this.isConnected) {
      this.imap.end();
      this.isConnected = false;
    }
    
    if (this.smtp) {
      this.smtp.close();
    }
  }

  async fetchEmails(options: FetchOptions = {}): Promise<Email[]> {
    if (!this.imap) throw new Error('Not authenticated');

    if (!this.isConnected) {
      await this.connectImap();
    }

    return new Promise((resolve, reject) => {
      const emails: Email[] = [];
      const folder = options.folder || 'INBOX';

      this.imap!.openBox(folder, true, (err, box) => {
        if (err) {
          reject(err);
          return;
        }

        // Determine fetch range
        const total = box.messages.total;
        if (total === 0) {
          resolve([]);
          return;
        }

        const limit = options.limit || 50;
        const offset = options.offset || 0;
        const start = Math.max(1, total - offset - limit + 1);
        const end = total - offset;

        if (start > end) {
          resolve([]);
          return;
        }

        // Build search criteria
        const searchCriteria: any[] = ['ALL'];
        
        if (options.since) {
          searchCriteria.push(['SINCE', options.since]);
        }
        
        if (options.before) {
          searchCriteria.push(['BEFORE', options.before]);
        }
        
        if (options.onlyUnread) {
          searchCriteria.push('UNSEEN');
        }

        // Search for messages
        this.imap!.search(searchCriteria, (err, results) => {
          if (err) {
            reject(err);
            return;
          }

          if (!results || results.length === 0) {
            resolve([]);
            return;
          }

          // Apply limit and offset to results
          const limitedResults = results.slice(-limit - offset, -offset || undefined).slice(-limit);

          if (limitedResults.length === 0) {
            resolve([]);
            return;
          }

          const fetch = this.imap!.fetch(limitedResults, {
            bodies: '',
            struct: true,
            envelope: true,
          });

          fetch.on('message', (msg, seqno) => {
            let buffer = '';
            let attributes: any = {};

            msg.on('body', (stream) => {
              stream.on('data', (chunk) => {
                buffer += chunk.toString('utf8');
              });

              stream.once('end', async () => {
                try {
                  const parsed = await simpleParser(buffer);
                  const email = this.parseIMAPMessage(parsed, attributes);
                  emails.push(email);
                } catch (error) {
                  console.error('Failed to parse email:', error);
                }
              });
            });

            msg.once('attributes', (attrs) => {
              attributes = attrs;
            });
          });

          fetch.once('error', reject);
          
          fetch.once('end', () => {
            resolve(emails.sort((a, b) => b.date.getTime() - a.date.getTime()));
          });
        });
      });
    });
  }

  private parseIMAPMessage(parsed: ParsedMail, attributes: any): Email {
    const attachments: Attachment[] = (parsed.attachments || []).map(att => ({
      filename: att.filename || 'unnamed',
      contentType: att.contentType,
      size: att.size,
      contentId: att.contentId,
    }));

    return {
      id: parsed.messageId || `imap-${attributes.uid || Date.now()}`,
      threadId: parsed.references ? parsed.references[0] : undefined,
      subject: parsed.subject || '(No Subject)',
      from: this.parseAddress(parsed.from),
      to: this.parseAddresses(parsed.to),
      cc: this.parseAddresses(parsed.cc),
      bcc: this.parseAddresses(parsed.bcc),
      date: parsed.date || new Date(),
      body: {
        text: parsed.text || '',
        html: parsed.html || undefined,
      },
      attachments,
      isRead: attributes.flags ? !attributes.flags.includes('\\Unseen') : false,
      isStarred: attributes.flags ? attributes.flags.includes('\\Flagged') : false,
      isDraft: attributes.flags ? attributes.flags.includes('\\Draft') : false,
    };
  }

  private parseAddress(address: any): EmailAddress {
    if (!address) return { email: 'unknown@unknown.com' };
    
    if (address.value && address.value[0]) {
      return {
        email: address.value[0].address || 'unknown@unknown.com',
        name: address.value[0].name,
      };
    }
    
    if (address.text) {
      return EmailParser.parseEmailAddress(address.text);
    }
    
    return { email: 'unknown@unknown.com' };
  }

  private parseAddresses(addresses: any): EmailAddress[] {
    if (!addresses) return [];
    
    if (addresses.value) {
      return addresses.value.map((addr: any) => ({
        email: addr.address || 'unknown@unknown.com',
        name: addr.name,
      }));
    }
    
    if (addresses.text) {
      return EmailParser.parseEmailAddresses(addresses.text);
    }
    
    return [];
  }

  async getEmail(messageId: string): Promise<Email> {
    // For IMAP, we need to search by message ID
    const emails = await this.searchEmails({
      query: messageId,
    });
    
    if (emails.length === 0) {
      throw new Error(`Email ${messageId} not found`);
    }
    
    return emails[0];
  }

  async sendEmail(email: OutgoingEmail): Promise<SentEmail> {
    if (!this.smtp) throw new Error('SMTP not configured');

    const info = await this.smtp.sendMail({
      from: email.from,
      to: email.to.join(', '),
      cc: email.cc?.join(', '),
      bcc: email.bcc?.join(', '),
      subject: email.subject,
      text: email.body.text,
      html: email.body.html,
      inReplyTo: email.inReplyTo,
      references: email.references?.join(' '),
      attachments: email.attachments?.map(att => ({
        filename: att.filename,
        content: att.content,
        contentType: att.contentType,
      })),
    });

    // Save to Sent folder if possible
    try {
      await this.saveToSentFolder(email, info.messageId);
    } catch (error) {
      console.error('Failed to save to Sent folder:', error);
    }

    return {
      id: info.messageId,
      sentAt: new Date(),
    };
  }

  private async saveToSentFolder(email: OutgoingEmail, messageId: string): Promise<void> {
    if (!this.imap || !this.isConnected) return;

    return new Promise((resolve, reject) => {
      // Try common sent folder names
      const sentFolders = ['Sent', 'Sent Items', 'Sent Mail', '[Gmail]/Sent Mail'];
      
      const tryFolder = (index: number) => {
        if (index >= sentFolders.length) {
          reject(new Error('Could not find Sent folder'));
          return;
        }

        this.imap!.openBox(sentFolders[index], false, (err) => {
          if (err) {
            tryFolder(index + 1);
            return;
          }

          // Create RFC822 message
          const message = this.createRFC822Message(email, messageId);
          
          this.imap!.append(message, { flags: ['\\Seen'] }, (err) => {
            if (err) {
              reject(err);
            } else {
              resolve();
            }
          });
        });
      };

      tryFolder(0);
    });
  }

  private createRFC822Message(email: OutgoingEmail, messageId: string): string {
    const boundary = `boundary_${Date.now()}`;
    
    let message = '';
    message += `Message-ID: ${messageId}\r\n`;
    message += `Date: ${new Date().toUTCString()}\r\n`;
    message += `From: ${email.from}\r\n`;
    message += `To: ${email.to.join(', ')}\r\n`;
    if (email.cc?.length) message += `Cc: ${email.cc.join(', ')}\r\n`;
    message += `Subject: ${email.subject}\r\n`;
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
    if (!this.imap) throw new Error('Not authenticated');
    
    if (!this.isConnected) {
      await this.connectImap();
    }

    return new Promise((resolve, reject) => {
      this.imap!.getBoxes((err, boxes) => {
        if (err) {
          reject(err);
          return;
        }

        const folders: Folder[] = [];
        
        const processBoxes = (boxes: any, parent?: string) => {
          for (const [name, box] of Object.entries(boxes)) {
            const fullName = parent ? `${parent}/${name}` : name;
            
            folders.push({
              id: fullName,
              name: name,
              type: this.mapFolderType(name),
              parent: parent,
            });

            if ((box as any).children) {
              processBoxes((box as any).children, fullName);
            }
          }
        };

        processBoxes(boxes);
        resolve(folders);
      });
    });
  }

  private mapFolderType(name: string): Folder['type'] {
    const lowercaseName = name.toLowerCase();
    
    if (lowercaseName === 'inbox') return 'inbox';
    if (lowercaseName.includes('sent')) return 'sent';
    if (lowercaseName.includes('draft')) return 'drafts';
    if (lowercaseName.includes('trash') || lowercaseName.includes('deleted')) return 'trash';
    if (lowercaseName.includes('spam') || lowercaseName.includes('junk')) return 'spam';
    
    return 'custom';
  }

  async moveEmail(messageId: string, folder: string): Promise<void> {
    if (!this.imap) throw new Error('Not authenticated');
    
    if (!this.isConnected) {
      await this.connectImap();
    }

    return new Promise((resolve, reject) => {
      this.imap!.openBox('INBOX', false, (err) => {
        if (err) {
          reject(err);
          return;
        }

        // Search for the message
        this.imap!.search([['HEADER', 'MESSAGE-ID', messageId]], (err, results) => {
          if (err || !results || results.length === 0) {
            reject(err || new Error('Message not found'));
            return;
          }

          this.imap!.move(results[0], folder, (err) => {
            if (err) {
              reject(err);
            } else {
              resolve();
            }
          });
        });
      });
    });
  }

  async markAsRead(messageId: string): Promise<void> {
    await this.setFlag(messageId, '\\Seen', true);
  }

  async markAsUnread(messageId: string): Promise<void> {
    await this.setFlag(messageId, '\\Seen', false);
  }

  async starEmail(messageId: string): Promise<void> {
    await this.setFlag(messageId, '\\Flagged', true);
  }

  async unstarEmail(messageId: string): Promise<void> {
    await this.setFlag(messageId, '\\Flagged', false);
  }

  private async setFlag(messageId: string, flag: string, add: boolean): Promise<void> {
    if (!this.imap) throw new Error('Not authenticated');
    
    if (!this.isConnected) {
      await this.connectImap();
    }

    return new Promise((resolve, reject) => {
      this.imap!.openBox('INBOX', false, (err) => {
        if (err) {
          reject(err);
          return;
        }

        // Search for the message
        this.imap!.search([['HEADER', 'MESSAGE-ID', messageId]], (err, results) => {
          if (err || !results || results.length === 0) {
            reject(err || new Error('Message not found'));
            return;
          }

          const method = add ? 'addFlags' : 'delFlags';
          this.imap![method](results[0], flag, (err) => {
            if (err) {
              reject(err);
            } else {
              resolve();
            }
          });
        });
      });
    });
  }

  async deleteEmail(messageId: string): Promise<void> {
    await this.setFlag(messageId, '\\Deleted', true);
  }

  async searchEmails(query: SearchQuery): Promise<Email[]> {
    if (!this.imap) throw new Error('Not authenticated');
    
    if (!this.isConnected) {
      await this.connectImap();
    }

    return new Promise((resolve, reject) => {
      const emails: Email[] = [];
      
      this.imap!.openBox('INBOX', true, (err, box) => {
        if (err) {
          reject(err);
          return;
        }

        // Build IMAP search criteria
        const criteria: any[] = [];
        
        if (query.from) {
          criteria.push(['FROM', query.from]);
        }
        
        if (query.to) {
          criteria.push(['TO', query.to]);
        }
        
        if (query.subject) {
          criteria.push(['SUBJECT', query.subject]);
        }
        
        if (query.body) {
          criteria.push(['TEXT', query.body]);
        }
        
        if (query.hasAttachment) {
          // IMAP doesn't have direct attachment search
          criteria.push(['HEADER', 'Content-Type', 'multipart']);
        }
        
        if (query.isUnread) {
          criteria.push('UNSEEN');
        }
        
        if (query.isStarred) {
          criteria.push('FLAGGED');
        }
        
        if (query.after) {
          criteria.push(['SINCE', query.after]);
        }
        
        if (query.before) {
          criteria.push(['BEFORE', query.before]);
        }
        
        if (query.larger) {
          criteria.push(['LARGER', query.larger]);
        }
        
        if (query.smaller) {
          criteria.push(['SMALLER', query.smaller]);
        }

        // Default to ALL if no criteria
        if (criteria.length === 0) {
          criteria.push('ALL');
        }

        this.imap!.search(criteria, (err, results) => {
          if (err) {
            reject(err);
            return;
          }

          if (!results || results.length === 0) {
            resolve([]);
            return;
          }

          // Limit results
          const limitedResults = results.slice(-100);

          const fetch = this.imap!.fetch(limitedResults, {
            bodies: '',
            struct: true,
            envelope: true,
          });

          fetch.on('message', (msg, seqno) => {
            let buffer = '';
            let attributes: any = {};

            msg.on('body', (stream) => {
              stream.on('data', (chunk) => {
                buffer += chunk.toString('utf8');
              });

              stream.once('end', async () => {
                try {
                  const parsed = await simpleParser(buffer);
                  const email = this.parseIMAPMessage(parsed, attributes);
                  emails.push(email);
                } catch (error) {
                  console.error('Failed to parse email:', error);
                }
              });
            });

            msg.once('attributes', (attrs) => {
              attributes = attrs;
            });
          });

          fetch.once('error', reject);
          
          fetch.once('end', () => {
            resolve(emails.sort((a, b) => b.date.getTime() - a.date.getTime()));
          });
        });
      });
    });
  }

  getProviderInfo(): ProviderInfo {
    return {
      name: 'IMAP',
      type: 'imap',
      features: {
        oauth: false,
        webhooks: false,
        labels: false,
        folders: true,
        threading: false,
        push: false,
      },
    };
  }

  async getQuota(): Promise<QuotaInfo> {
    if (!this.imap) throw new Error('Not authenticated');
    
    if (!this.isConnected) {
      await this.connectImap();
    }

    return new Promise((resolve, reject) => {
      this.imap!.getQuota('INBOX', (err, quota) => {
        if (err || !quota) {
          // Many IMAP servers don't support quota
          resolve({
            used: 0,
            total: 0,
            percentage: 0,
          });
        } else {
          const storage = quota.storage || quota.STORAGE;
          if (storage) {
            resolve({
              used: storage.usage || 0,
              total: storage.limit || 0,
              percentage: storage.limit ? (storage.usage / storage.limit) * 100 : 0,
            });
          } else {
            resolve({
              used: 0,
              total: 0,
              percentage: 0,
            });
          }
        }
      });
    });
  }
}