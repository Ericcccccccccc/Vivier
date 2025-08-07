import crypto from 'crypto';
import { OAuth2Config, TokenResponse } from '../interface';

export interface OAuth2Provider {
  name: string;
  authUrl: string;
  tokenUrl: string;
  scope: string;
  clientId: string;
  clientSecret: string;
  additionalParams?: Record<string, string>;
}

export class OAuth2Handler {
  private providers = new Map<string, OAuth2Provider>();
  private stateStore = new Map<string, { provider: string; timestamp: number }>();
  private redirectUri: string;

  constructor(redirectUri: string) {
    this.redirectUri = redirectUri;
    this.initializeProviders();
    
    // Clean up expired states every hour
    setInterval(() => this.cleanupExpiredStates(), 3600000);
  }

  private initializeProviders(): void {
    // Gmail OAuth2 configuration
    this.providers.set('gmail', {
      name: 'Gmail',
      authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
      tokenUrl: 'https://oauth2.googleapis.com/token',
      scope: 'https://www.googleapis.com/auth/gmail.modify https://www.googleapis.com/auth/gmail.send',
      clientId: process.env.GOOGLE_CLIENT_ID || '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
      additionalParams: {
        access_type: 'offline',
        prompt: 'consent',
      },
    });

    // Outlook OAuth2 configuration
    this.providers.set('outlook', {
      name: 'Outlook',
      authUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
      tokenUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
      scope: 'https://graph.microsoft.com/Mail.ReadWrite https://graph.microsoft.com/Mail.Send offline_access',
      clientId: process.env.MICROSOFT_CLIENT_ID || '',
      clientSecret: process.env.MICROSOFT_CLIENT_SECRET || '',
    });

    // Yahoo OAuth2 configuration
    this.providers.set('yahoo', {
      name: 'Yahoo',
      authUrl: 'https://api.login.yahoo.com/oauth2/request_auth',
      tokenUrl: 'https://api.login.yahoo.com/oauth2/get_token',
      scope: 'mail-w',
      clientId: process.env.YAHOO_CLIENT_ID || '',
      clientSecret: process.env.YAHOO_CLIENT_SECRET || '',
    });
  }

  generateState(provider: string): string {
    const state = crypto.randomBytes(32).toString('base64url');
    this.stateStore.set(state, {
      provider,
      timestamp: Date.now(),
    });
    return state;
  }

  validateState(state: string): { valid: boolean; provider?: string } {
    const stateData = this.stateStore.get(state);
    
    if (!stateData) {
      return { valid: false };
    }

    // Check if state is expired (1 hour)
    if (Date.now() - stateData.timestamp > 3600000) {
      this.stateStore.delete(state);
      return { valid: false };
    }

    this.stateStore.delete(state);
    return { valid: true, provider: stateData.provider };
  }

  private cleanupExpiredStates(): void {
    const now = Date.now();
    for (const [state, data] of this.stateStore.entries()) {
      if (now - data.timestamp > 3600000) {
        this.stateStore.delete(state);
      }
    }
  }

  getAuthUrl(provider: string, state?: string): string {
    const config = this.providers.get(provider);
    if (!config) {
      throw new Error(`Unknown OAuth provider: ${provider}`);
    }

    if (!config.clientId) {
      throw new Error(`Missing client ID for ${provider}`);
    }

    const authState = state || this.generateState(provider);
    
    const params = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: this.getRedirectUri(provider),
      response_type: 'code',
      scope: config.scope,
      state: authState,
      ...config.additionalParams,
    });

    return `${config.authUrl}?${params.toString()}`;
  }

  async exchangeCode(provider: string, code: string, codeVerifier?: string): Promise<TokenResponse> {
    const config = this.providers.get(provider);
    if (!config) {
      throw new Error(`Unknown OAuth provider: ${provider}`);
    }

    if (!config.clientId || !config.clientSecret) {
      throw new Error(`Missing client credentials for ${provider}`);
    }

    const params: Record<string, string> = {
      client_id: config.clientId,
      client_secret: config.clientSecret,
      code,
      redirect_uri: this.getRedirectUri(provider),
      grant_type: 'authorization_code',
    };

    // Add PKCE code verifier if provided
    if (codeVerifier) {
      params.code_verifier = codeVerifier;
    }

    const response = await fetch(config.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams(params),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Token exchange failed for ${provider}: ${error}`);
    }

    const data = await response.json();
    
    return {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_in: data.expires_in,
      token_type: data.token_type || 'Bearer',
      scope: data.scope,
    };
  }

  async refreshToken(provider: string, refreshToken: string): Promise<TokenResponse> {
    const config = this.providers.get(provider);
    if (!config) {
      throw new Error(`Unknown OAuth provider: ${provider}`);
    }

    if (!config.clientId || !config.clientSecret) {
      throw new Error(`Missing client credentials for ${provider}`);
    }

    const params = new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    });

    const response = await fetch(config.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Token refresh failed for ${provider}: ${error}`);
    }

    const data = await response.json();
    
    return {
      access_token: data.access_token,
      refresh_token: data.refresh_token || refreshToken,
      expires_in: data.expires_in,
      token_type: data.token_type || 'Bearer',
      scope: data.scope,
    };
  }

  async revokeToken(provider: string, token: string): Promise<void> {
    const config = this.providers.get(provider);
    if (!config) {
      throw new Error(`Unknown OAuth provider: ${provider}`);
    }

    // Different providers have different revocation endpoints
    let revokeUrl: string;
    let params: URLSearchParams;

    switch (provider) {
      case 'gmail':
        revokeUrl = 'https://oauth2.googleapis.com/revoke';
        params = new URLSearchParams({ token });
        break;
      case 'outlook':
        // Microsoft doesn't have a revocation endpoint, tokens expire naturally
        return;
      default:
        throw new Error(`Token revocation not supported for ${provider}`);
    }

    const response = await fetch(revokeUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params,
    });

    if (!response.ok && response.status !== 200) {
      const error = await response.text();
      throw new Error(`Token revocation failed for ${provider}: ${error}`);
    }
  }

  private getRedirectUri(provider: string): string {
    return `${this.redirectUri}/${provider}`;
  }

  getProviderConfig(provider: string): OAuth2Provider | undefined {
    return this.providers.get(provider);
  }

  listProviders(): string[] {
    return Array.from(this.providers.keys());
  }

  isProviderConfigured(provider: string): boolean {
    const config = this.providers.get(provider);
    return !!(config && config.clientId && config.clientSecret);
  }

  // PKCE (Proof Key for Code Exchange) support for public clients
  generatePKCEChallenge(): { codeVerifier: string; codeChallenge: string } {
    const codeVerifier = crypto.randomBytes(32).toString('base64url');
    const codeChallenge = crypto
      .createHash('sha256')
      .update(codeVerifier)
      .digest('base64url');
    
    return { codeVerifier, codeChallenge };
  }

  getAuthUrlWithPKCE(provider: string, codeChallenge: string, state?: string): string {
    const baseUrl = this.getAuthUrl(provider, state);
    const url = new URL(baseUrl);
    url.searchParams.set('code_challenge', codeChallenge);
    url.searchParams.set('code_challenge_method', 'S256');
    return url.toString();
  }
}