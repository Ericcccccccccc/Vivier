import { EmailProvider, EmailAccountConfig, IMAPConfig } from './interface';
import { GmailProvider } from './providers/gmail';
import { OutlookProvider } from './providers/outlook';
import { IMAPProvider } from './providers/imap';

export interface ProviderDetectionResult {
  provider: 'gmail' | 'outlook' | 'imap';
  confidence: number;
  config?: Partial<IMAPConfig>;
}

export class EmailProviderFactory {
  private static readonly providerDomains: Record<string, 'gmail' | 'outlook'> = {
    'gmail.com': 'gmail',
    'googlemail.com': 'gmail',
    'outlook.com': 'outlook',
    'hotmail.com': 'outlook',
    'live.com': 'outlook',
    'msn.com': 'outlook',
    'outlook.fr': 'outlook',
    'outlook.de': 'outlook',
    'outlook.es': 'outlook',
    'outlook.it': 'outlook',
    'outlook.jp': 'outlook',
    'hotmail.fr': 'outlook',
    'hotmail.de': 'outlook',
    'hotmail.es': 'outlook',
    'hotmail.it': 'outlook',
    'hotmail.co.uk': 'outlook',
  };

  private static readonly imapConfigs: Record<string, Partial<IMAPConfig>> = {
    'yahoo.com': {
      imapHost: 'imap.mail.yahoo.com',
      imapPort: 993,
      smtpHost: 'smtp.mail.yahoo.com',
      smtpPort: 587,
      secure: true,
    },
    'yahoo.co.uk': {
      imapHost: 'imap.mail.yahoo.com',
      imapPort: 993,
      smtpHost: 'smtp.mail.yahoo.com',
      smtpPort: 587,
      secure: true,
    },
    'icloud.com': {
      imapHost: 'imap.mail.me.com',
      imapPort: 993,
      smtpHost: 'smtp.mail.me.com',
      smtpPort: 587,
      secure: true,
    },
    'me.com': {
      imapHost: 'imap.mail.me.com',
      imapPort: 993,
      smtpHost: 'smtp.mail.me.com',
      smtpPort: 587,
      secure: true,
    },
    'mac.com': {
      imapHost: 'imap.mail.me.com',
      imapPort: 993,
      smtpHost: 'smtp.mail.me.com',
      smtpPort: 587,
      secure: true,
    },
    'aol.com': {
      imapHost: 'imap.aol.com',
      imapPort: 993,
      smtpHost: 'smtp.aol.com',
      smtpPort: 587,
      secure: true,
    },
    'zoho.com': {
      imapHost: 'imap.zoho.com',
      imapPort: 993,
      smtpHost: 'smtp.zoho.com',
      smtpPort: 587,
      secure: true,
    },
    'protonmail.com': {
      imapHost: '127.0.0.1', // ProtonMail Bridge required
      imapPort: 1143,
      smtpHost: '127.0.0.1',
      smtpPort: 1025,
      secure: false,
    },
    'fastmail.com': {
      imapHost: 'imap.fastmail.com',
      imapPort: 993,
      smtpHost: 'smtp.fastmail.com',
      smtpPort: 587,
      secure: true,
    },
    'gmx.com': {
      imapHost: 'imap.gmx.com',
      imapPort: 993,
      smtpHost: 'smtp.gmx.com',
      smtpPort: 587,
      secure: true,
    },
    'mail.com': {
      imapHost: 'imap.mail.com',
      imapPort: 993,
      smtpHost: 'smtp.mail.com',
      smtpPort: 587,
      secure: true,
    },
    'yandex.com': {
      imapHost: 'imap.yandex.com',
      imapPort: 993,
      smtpHost: 'smtp.yandex.com',
      smtpPort: 587,
      secure: true,
    },
  };

  /**
   * Create an email provider instance based on configuration
   */
  static create(config: EmailAccountConfig): EmailProvider {
    switch (config.provider) {
      case 'gmail':
        if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
          throw new Error('Gmail OAuth credentials not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET environment variables.');
        }
        
        return new GmailProvider({
          clientId: process.env.GOOGLE_CLIENT_ID,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          redirectUri: process.env.GOOGLE_REDIRECT_URI || `${process.env.API_URL}/auth/callback/gmail`,
          email: config.email,
        });

      case 'outlook':
        if (!process.env.MICROSOFT_CLIENT_ID || !process.env.MICROSOFT_CLIENT_SECRET) {
          throw new Error('Outlook OAuth credentials not configured. Set MICROSOFT_CLIENT_ID and MICROSOFT_CLIENT_SECRET environment variables.');
        }
        
        return new OutlookProvider({
          clientId: process.env.MICROSOFT_CLIENT_ID,
          clientSecret: process.env.MICROSOFT_CLIENT_SECRET,
          tenantId: process.env.MICROSOFT_TENANT_ID || 'common',
          redirectUri: process.env.MICROSOFT_REDIRECT_URI || `${process.env.API_URL}/auth/callback/outlook`,
        });

      case 'imap':
        const imapConfig = config as IMAPConfig;
        
        if (!imapConfig.imapHost || !imapConfig.smtpHost) {
          // Try to auto-detect configuration
          const detected = this.getIMAPConfig(config.email);
          Object.assign(imapConfig, detected);
        }
        
        if (!imapConfig.imapHost || !imapConfig.smtpHost) {
          throw new Error('IMAP/SMTP server configuration required');
        }
        
        return new IMAPProvider(imapConfig);

      default:
        throw new Error(`Unsupported email provider: ${config.provider}`);
    }
  }

  /**
   * Detect email provider from email address
   */
  static async detectProvider(email: string): Promise<ProviderDetectionResult> {
    const domain = email.split('@')[1]?.toLowerCase();
    
    if (!domain) {
      throw new Error('Invalid email address format');
    }

    // Check for known OAuth providers
    const oauthProvider = this.providerDomains[domain];
    if (oauthProvider) {
      return {
        provider: oauthProvider,
        confidence: 1.0,
      };
    }

    // Check for known IMAP configurations
    const imapConfig = this.imapConfigs[domain];
    if (imapConfig) {
      return {
        provider: 'imap',
        confidence: 0.9,
        config: imapConfig,
      };
    }

    // Try to detect based on MX records (if in Node.js environment)
    try {
      const mxDetection = await this.detectFromMXRecords(domain);
      if (mxDetection) {
        return mxDetection;
      }
    } catch (error) {
      console.error('MX record detection failed:', error);
    }

    // Default to IMAP with generic configuration
    return {
      provider: 'imap',
      confidence: 0.3,
      config: this.getGenericIMAPConfig(domain),
    };
  }

  /**
   * Get IMAP configuration for a specific email domain
   */
  static getIMAPConfig(email: string): Partial<IMAPConfig> {
    const domain = email.split('@')[1]?.toLowerCase();
    
    if (!domain) {
      throw new Error('Invalid email address format');
    }

    // Check for known configurations
    const knownConfig = this.imapConfigs[domain];
    if (knownConfig) {
      return knownConfig;
    }

    // Return generic configuration
    return this.getGenericIMAPConfig(domain);
  }

  /**
   * Generate generic IMAP configuration for unknown domains
   */
  private static getGenericIMAPConfig(domain: string): Partial<IMAPConfig> {
    return {
      imapHost: `imap.${domain}`,
      imapPort: 993,
      smtpHost: `smtp.${domain}`,
      smtpPort: 587,
      secure: true,
      tls: true,
    };
  }

  /**
   * Detect provider from MX records (requires DNS module)
   */
  private static async detectFromMXRecords(domain: string): Promise<ProviderDetectionResult | null> {
    // This would require DNS lookups
    // For now, we'll use pattern matching on the domain
    
    if (domain.includes('google') || domain.includes('gmail')) {
      return {
        provider: 'gmail',
        confidence: 0.8,
      };
    }
    
    if (domain.includes('outlook') || domain.includes('microsoft') || domain.includes('office365')) {
      return {
        provider: 'outlook',
        confidence: 0.8,
      };
    }
    
    return null;
  }

  /**
   * Validate provider credentials
   */
  static async validateCredentials(provider: string, credentials: any): Promise<boolean> {
    try {
      const config: EmailAccountConfig = {
        provider: provider as any,
        email: credentials.email || '',
        credentials: {
          type: credentials.type || 'password',
          ...credentials,
        },
      };

      const emailProvider = this.create(config);
      const authResult = await emailProvider.authenticate(config.credentials!);
      
      if (authResult.success) {
        await emailProvider.disconnect();
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Credential validation failed:', error);
      return false;
    }
  }

  /**
   * Test IMAP/SMTP connectivity
   */
  static async testIMAPConnection(config: IMAPConfig): Promise<{
    imap: boolean;
    smtp: boolean;
    error?: string;
  }> {
    const provider = new IMAPProvider(config);
    
    try {
      const authResult = await provider.authenticate({
        type: 'password',
        email: config.email,
        password: config.password,
      });
      
      if (authResult.success) {
        await provider.disconnect();
        return { imap: true, smtp: true };
      }
      
      return { 
        imap: false, 
        smtp: false, 
        error: authResult.error,
      };
    } catch (error: any) {
      return { 
        imap: false, 
        smtp: false, 
        error: error.message,
      };
    }
  }

  /**
   * Get list of supported providers
   */
  static getSupportedProviders(): Array<{
    id: string;
    name: string;
    type: 'oauth' | 'password';
    configured: boolean;
  }> {
    return [
      {
        id: 'gmail',
        name: 'Gmail',
        type: 'oauth',
        configured: !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
      },
      {
        id: 'outlook',
        name: 'Outlook',
        type: 'oauth',
        configured: !!(process.env.MICROSOFT_CLIENT_ID && process.env.MICROSOFT_CLIENT_SECRET),
      },
      {
        id: 'imap',
        name: 'IMAP/SMTP',
        type: 'password',
        configured: true, // Always available
      },
    ];
  }

  /**
   * Check if a provider is configured
   */
  static isProviderConfigured(provider: string): boolean {
    switch (provider) {
      case 'gmail':
        return !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
      case 'outlook':
        return !!(process.env.MICROSOFT_CLIENT_ID && process.env.MICROSOFT_CLIENT_SECRET);
      case 'imap':
        return true; // IMAP is always available
      default:
        return false;
    }
  }
}