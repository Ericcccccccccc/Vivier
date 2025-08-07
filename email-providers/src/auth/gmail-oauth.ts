import { OAuth2Client } from 'google-auth-library';
import { google } from 'googleapis';

export interface GmailOAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

export interface GmailTokens {
  access_token?: string | null;
  refresh_token?: string | null;
  scope?: string;
  token_type?: string | null;
  expiry_date?: number | null;
}

export interface TokenPayload {
  email?: string;
  email_verified?: boolean;
  name?: string;
  picture?: string;
  given_name?: string;
  family_name?: string;
  locale?: string;
  iat?: number;
  exp?: number;
  sub?: string;
}

export class GmailOAuth {
  private oauth2Client: OAuth2Client;
  
  constructor(private config: GmailOAuthConfig) {
    this.oauth2Client = new OAuth2Client(
      config.clientId,
      config.clientSecret,
      config.redirectUri
    );
  }

  /**
   * Generate the OAuth2 authorization URL
   */
  getAuthUrl(state: string, email?: string): string {
    const scopes = [
      'https://www.googleapis.com/auth/gmail.modify',
      'https://www.googleapis.com/auth/gmail.send',
      'https://www.googleapis.com/auth/userinfo.email',
      'https://www.googleapis.com/auth/userinfo.profile',
    ];

    const authUrl = this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      state: state,
      prompt: 'consent',
      login_hint: email,
      include_granted_scopes: true,
    });

    return authUrl;
  }

  /**
   * Exchange authorization code for tokens
   */
  async exchangeCode(code: string): Promise<GmailTokens> {
    try {
      const { tokens } = await this.oauth2Client.getToken(code);
      this.oauth2Client.setCredentials(tokens);
      return tokens;
    } catch (error: any) {
      throw new Error(`Failed to exchange code for tokens: ${error.message}`);
    }
  }

  /**
   * Refresh the access token using a refresh token
   */
  async refreshToken(refreshToken: string): Promise<GmailTokens> {
    try {
      this.oauth2Client.setCredentials({
        refresh_token: refreshToken,
      });
      
      const { credentials } = await this.oauth2Client.refreshAccessToken();
      return credentials;
    } catch (error: any) {
      throw new Error(`Failed to refresh token: ${error.message}`);
    }
  }

  /**
   * Verify and decode an ID token
   */
  async verifyIdToken(idToken: string): Promise<TokenPayload> {
    try {
      const ticket = await this.oauth2Client.verifyIdToken({
        idToken: idToken,
        audience: this.config.clientId,
      });
      
      const payload = ticket.getPayload();
      if (!payload) {
        throw new Error('Invalid ID token payload');
      }
      
      return payload as TokenPayload;
    } catch (error: any) {
      throw new Error(`Failed to verify ID token: ${error.message}`);
    }
  }

  /**
   * Get user profile information
   */
  async getUserProfile(accessToken: string): Promise<{
    email: string;
    name?: string;
    picture?: string;
    verified: boolean;
  }> {
    try {
      this.oauth2Client.setCredentials({
        access_token: accessToken,
      });

      const oauth2 = google.oauth2({
        version: 'v2',
        auth: this.oauth2Client,
      });

      const { data } = await oauth2.userinfo.get();

      return {
        email: data.email!,
        name: data.name || undefined,
        picture: data.picture || undefined,
        verified: data.verified_email || false,
      };
    } catch (error: any) {
      throw new Error(`Failed to get user profile: ${error.message}`);
    }
  }

  /**
   * Revoke a token
   */
  async revokeToken(token: string): Promise<void> {
    try {
      await this.oauth2Client.revokeToken(token);
    } catch (error: any) {
      throw new Error(`Failed to revoke token: ${error.message}`);
    }
  }

  /**
   * Check if a token is expired
   */
  isTokenExpired(expiryDate?: number | null): boolean {
    if (!expiryDate) return true;
    return Date.now() >= expiryDate;
  }

  /**
   * Set credentials for the OAuth2 client
   */
  setCredentials(tokens: GmailTokens): void {
    this.oauth2Client.setCredentials(tokens);
  }

  /**
   * Get the current OAuth2 client
   */
  getOAuth2Client(): OAuth2Client {
    return this.oauth2Client;
  }

  /**
   * Create a new OAuth2 client with specific tokens
   */
  createAuthenticatedClient(tokens: GmailTokens): OAuth2Client {
    const client = new OAuth2Client(
      this.config.clientId,
      this.config.clientSecret,
      this.config.redirectUri
    );
    client.setCredentials(tokens);
    return client;
  }

  /**
   * Watch for Gmail updates (push notifications)
   */
  async watchMailbox(accessToken: string, topicName: string, labelIds: string[] = ['INBOX']): Promise<{
    historyId: string;
    expiration: string;
  }> {
    try {
      this.oauth2Client.setCredentials({
        access_token: accessToken,
      });

      const gmail = google.gmail({
        version: 'v1',
        auth: this.oauth2Client,
      });

      const response = await gmail.users.watch({
        userId: 'me',
        requestBody: {
          topicName,
          labelIds,
          labelFilterAction: 'include',
        },
      });

      return {
        historyId: response.data.historyId!,
        expiration: response.data.expiration!,
      };
    } catch (error: any) {
      throw new Error(`Failed to set up Gmail watch: ${error.message}`);
    }
  }

  /**
   * Stop watching for Gmail updates
   */
  async stopWatch(accessToken: string): Promise<void> {
    try {
      this.oauth2Client.setCredentials({
        access_token: accessToken,
      });

      const gmail = google.gmail({
        version: 'v1',
        auth: this.oauth2Client,
      });

      await gmail.users.stop({
        userId: 'me',
      });
    } catch (error: any) {
      // Ignore errors when stopping watch
      console.error('Failed to stop Gmail watch:', error.message);
    }
  }
}