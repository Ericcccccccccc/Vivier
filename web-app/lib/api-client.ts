export interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: any;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: User;
}

export interface User {
  id: string;
  email: string;
  name?: string;
  settings?: UserSettings;
  createdAt: string;
  updatedAt: string;
}

export interface UserSettings {
  notifications: boolean;
  aiModel: 'groq' | 'openai' | 'anthropic';
  responseStyle: 'professional' | 'casual' | 'brief';
  emailAccounts?: EmailAccount[];
}

export interface EmailAccount {
  id: string;
  email: string;
  provider: 'gmail' | 'outlook' | 'other';
  isActive: boolean;
}

export interface Email {
  id: string;
  userId: string;
  from: string;
  to: string;
  subject: string;
  body: string;
  isRead: boolean;
  isPriority: boolean;
  sentiment?: 'positive' | 'neutral' | 'negative';
  category?: string;
  aiResponse?: AIResponse;
  receivedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface PaginatedEmails {
  emails: Email[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface GetEmailsOptions {
  page?: number;
  limit?: number;
  filter?: string;
  category?: string;
  isRead?: boolean;
  isPriority?: boolean;
}

export interface ProcessedEmail extends Email {
  sentiment: 'positive' | 'neutral' | 'negative';
  category: string;
  suggestedResponse?: string;
}

export interface AIResponse {
  id: string;
  emailId: string;
  response: string;
  style: ResponseStyle;
  confidence: number;
  createdAt: string;
}

export type ResponseStyle = 'professional' | 'casual' | 'brief';

export interface Template {
  id: string;
  userId: string;
  name: string;
  content: string;
  category: string;
  tags: string[];
  usageCount: number;
  createdAt: string;
  updatedAt: string;
}

export class APIError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string
  ) {
    super(message);
    this.name = 'APIError';
  }
}

export class APIClient {
  private baseURL: string;
  private accessToken: string | null = null;
  private refreshToken: string | null = null;
  private refreshPromise: Promise<void> | null = null;

  constructor() {
    this.baseURL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';
    this.loadTokens();
  }

  private loadTokens(): void {
    if (typeof window !== 'undefined') {
      this.accessToken = localStorage.getItem('accessToken');
      this.refreshToken = localStorage.getItem('refreshToken');
    }
  }

  private saveTokens(accessToken: string, refreshToken: string): void {
    this.accessToken = accessToken;
    this.refreshToken = refreshToken;
    if (typeof window !== 'undefined') {
      localStorage.setItem('accessToken', accessToken);
      localStorage.setItem('refreshToken', refreshToken);
    }
  }

  private clearTokens(): void {
    this.accessToken = null;
    this.refreshToken = null;
    if (typeof window !== 'undefined') {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
    }
  }

  private async refreshAccessToken(): Promise<void> {
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    this.refreshPromise = (async () => {
      try {
        const response = await fetch(`${this.baseURL}/api/auth/refresh`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ refreshToken: this.refreshToken }),
        });

        if (!response.ok) {
          throw new Error('Failed to refresh token');
        }

        const data = await response.json();
        this.saveTokens(data.accessToken, data.refreshToken);
      } catch (error) {
        this.clearTokens();
        if (typeof window !== 'undefined') {
          window.location.href = '/login';
        }
        throw error;
      } finally {
        this.refreshPromise = null;
      }
    })();

    return this.refreshPromise;
  }

  private async request<T>(
    endpoint: string,
    options: RequestOptions = {}
  ): Promise<T> {
    const url = `${this.baseURL}/api${endpoint}`;
    
    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...(this.accessToken && {
            'Authorization': `Bearer ${this.accessToken}`,
          }),
          ...options.headers,
        },
        body: options.body ? JSON.stringify(options.body) : undefined,
      });

      // Handle token refresh
      if (response.status === 401 && this.refreshToken) {
        await this.refreshAccessToken();
        // Retry the request with new token
        return this.request(endpoint, options);
      }

      const data = await response.json();

      if (!response.ok) {
        throw new APIError(
          data.message || 'An error occurred',
          response.status,
          data.code
        );
      }

      return data;
    } catch (error) {
      if (error instanceof APIError) {
        throw error;
      }
      if (error instanceof Error) {
        throw new APIError(error.message, 500);
      }
      throw new APIError('Network error', 500);
    }
  }

  // Auth methods
  async login(email: string, password: string): Promise<AuthResponse> {
    const response = await this.request<AuthResponse>('/auth/login', {
      method: 'POST',
      body: { email, password },
    });
    
    this.saveTokens(response.accessToken, response.refreshToken);
    return response;
  }

  async register(email: string, password: string, name?: string): Promise<AuthResponse> {
    const response = await this.request<AuthResponse>('/auth/register', {
      method: 'POST',
      body: { email, password, name },
    });
    
    this.saveTokens(response.accessToken, response.refreshToken);
    return response;
  }

  async logout(): Promise<void> {
    try {
      await this.request('/auth/logout', {
        method: 'POST',
      });
    } finally {
      this.clearTokens();
    }
  }

  async getCurrentUser(): Promise<User> {
    return this.request('/auth/me');
  }

  async updateUser(data: Partial<User>): Promise<User> {
    return this.request('/auth/me', {
      method: 'PATCH',
      body: data,
    });
  }

  // Email methods
  async getEmails(options?: GetEmailsOptions): Promise<PaginatedEmails> {
    const params = new URLSearchParams();
    if (options?.page) params.set('page', options.page.toString());
    if (options?.limit) params.set('limit', options.limit.toString());
    if (options?.filter) params.set('filter', options.filter);
    if (options?.category) params.set('category', options.category);
    if (options?.isRead !== undefined) params.set('isRead', options.isRead.toString());
    if (options?.isPriority !== undefined) params.set('isPriority', options.isPriority.toString());
    
    return this.request(`/emails?${params}`);
  }

  async getEmail(id: string): Promise<Email> {
    return this.request(`/emails/${id}`);
  }

  async markAsRead(id: string): Promise<Email> {
    return this.request(`/emails/${id}/read`, {
      method: 'POST',
    });
  }

  async markAsUnread(id: string): Promise<Email> {
    return this.request(`/emails/${id}/unread`, {
      method: 'POST',
    });
  }

  async deleteEmail(id: string): Promise<void> {
    return this.request(`/emails/${id}`, {
      method: 'DELETE',
    });
  }

  async processEmail(id: string): Promise<ProcessedEmail> {
    return this.request(`/emails/${id}/process`, {
      method: 'POST',
    });
  }

  // AI methods
  async generateResponse(emailId: string, style?: ResponseStyle): Promise<AIResponse> {
    return this.request('/ai/generate', {
      method: 'POST',
      body: { emailId, style },
    });
  }

  async improveResponse(responseId: string, feedback: string): Promise<AIResponse> {
    return this.request(`/ai/responses/${responseId}/improve`, {
      method: 'POST',
      body: { feedback },
    });
  }

  // Template methods
  async getTemplates(): Promise<Template[]> {
    return this.request('/templates');
  }

  async getTemplate(id: string): Promise<Template> {
    return this.request(`/templates/${id}`);
  }

  async createTemplate(template: Omit<Template, 'id' | 'userId' | 'createdAt' | 'updatedAt'>): Promise<Template> {
    return this.request('/templates', {
      method: 'POST',
      body: template,
    });
  }

  async updateTemplate(id: string, updates: Partial<Template>): Promise<Template> {
    return this.request(`/templates/${id}`, {
      method: 'PATCH',
      body: updates,
    });
  }

  async deleteTemplate(id: string): Promise<void> {
    return this.request(`/templates/${id}`, {
      method: 'DELETE',
    });
  }

  // Settings methods
  async getSettings(): Promise<UserSettings> {
    return this.request('/settings');
  }

  async updateSettings(settings: Partial<UserSettings>): Promise<UserSettings> {
    return this.request('/settings', {
      method: 'PATCH',
      body: settings,
    });
  }

  // Email account methods
  async addEmailAccount(account: Omit<EmailAccount, 'id'>): Promise<EmailAccount> {
    return this.request('/settings/email-accounts', {
      method: 'POST',
      body: account,
    });
  }

  async removeEmailAccount(id: string): Promise<void> {
    return this.request(`/settings/email-accounts/${id}`, {
      method: 'DELETE',
    });
  }

  async toggleEmailAccount(id: string, isActive: boolean): Promise<EmailAccount> {
    return this.request(`/settings/email-accounts/${id}`, {
      method: 'PATCH',
      body: { isActive },
    });
  }

  // Analytics methods
  async getAnalytics(period: 'day' | 'week' | 'month' = 'week'): Promise<any> {
    return this.request(`/analytics?period=${period}`);
  }
}

// Singleton instance
export const apiClient = new APIClient();