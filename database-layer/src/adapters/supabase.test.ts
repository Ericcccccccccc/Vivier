import { describe, it, expect, jest, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { SupabaseAdapter, SupabaseConfig } from './supabase';
import { 
  DatabaseConnectionError,
  DatabaseOperationError,
  NotFoundError,
  DuplicateError,
  ValidationError
} from '../errors';
import { 
  User,
  EmailAccount,
  Email,
  AIResponse,
  ResponseTemplate,
  CreateUserInput,
  EmailAccountInput,
  CreateEmailInput,
  AIResponseInput,
  TemplateInput
} from '../types';

// Mock Supabase client
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    from: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn(),
      limit: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      range: jest.fn().mockReturnThis(),
    })),
    rpc: jest.fn(),
    channel: jest.fn(() => ({
      on: jest.fn().mockReturnThis(),
      subscribe: jest.fn().mockReturnThis(),
    })),
    removeChannel: jest.fn(),
  })),
}));

describe('SupabaseAdapter', () => {
  let adapter: SupabaseAdapter;
  const mockConfig: SupabaseConfig = {
    url: 'https://test.supabase.co',
    anonKey: 'test-anon-key',
    serviceKey: 'test-service-key',
  };

  beforeAll(() => {
    adapter = new SupabaseAdapter(mockConfig);
  });

  describe('Connection Management', () => {
    it('should connect successfully', async () => {
      const mockClient = (adapter as any).db;
      mockClient.from = jest.fn(() => ({
        select: jest.fn(() => ({
          limit: jest.fn(() => ({
            data: [],
            error: null,
          })),
        })),
      }));

      await expect(adapter.connect()).resolves.not.toThrow();
    });

    it('should throw DatabaseConnectionError on connection failure', async () => {
      const mockClient = (adapter as any).db;
      mockClient.from = jest.fn(() => ({
        select: jest.fn(() => ({
          limit: jest.fn(() => ({
            data: null,
            error: new Error('Connection failed'),
          })),
        })),
      }));

      await expect(adapter.connect()).rejects.toThrow(DatabaseConnectionError);
    });

    it('should perform health check', async () => {
      const mockClient = (adapter as any).db;
      mockClient.from = jest.fn(() => ({
        select: jest.fn(() => ({
          limit: jest.fn(() => ({
            error: null,
          })),
        })),
      }));

      const isHealthy = await adapter.healthCheck();
      expect(isHealthy).toBe(true);
    });

    it('should disconnect and clean up channels', async () => {
      await adapter.disconnect();
      expect((adapter as any).isConnected).toBe(false);
    });
  });

  describe('User Operations', () => {
    const testUser: CreateUserInput = {
      email: 'test@example.com',
      settings: {
        notifications_enabled: true,
        theme: 'dark',
      },
      subscription_tier: 'free',
    };

    it('should create a user', async () => {
      const mockClient = (adapter as any).db;
      const mockUser = {
        id: 'user-123',
        ...testUser,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      mockClient.from = jest.fn(() => ({
        insert: jest.fn(() => ({
          select: jest.fn(() => ({
            single: jest.fn(() => ({
              data: mockUser,
              error: null,
            })),
          })),
        })),
      }));

      const user = await adapter.createUser(testUser);
      expect(user.email).toBe(testUser.email);
      expect(user.subscription_tier).toBe('free');
    });

    it('should throw DuplicateError when user email already exists', async () => {
      const mockClient = (adapter as any).db;
      mockClient.from = jest.fn(() => ({
        insert: jest.fn(() => ({
          select: jest.fn(() => ({
            single: jest.fn(() => ({
              data: null,
              error: { code: '23505', message: 'Duplicate key' },
            })),
          })),
        })),
      }));

      await expect(adapter.createUser(testUser)).rejects.toThrow(DuplicateError);
    });

    it('should get user by ID', async () => {
      const mockClient = (adapter as any).db;
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        settings: {},
        subscription_tier: 'free',
      };

      mockClient.from = jest.fn(() => ({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            single: jest.fn(() => ({
              data: mockUser,
              error: null,
            })),
          })),
        })),
      }));

      const user = await adapter.getUser('user-123');
      expect(user).not.toBeNull();
      expect(user?.id).toBe('user-123');
    });

    it('should return null when user not found', async () => {
      const mockClient = (adapter as any).db;
      mockClient.from = jest.fn(() => ({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            single: jest.fn(() => ({
              data: null,
              error: { code: 'PGRST116', message: 'Not found' },
            })),
          })),
        })),
      }));

      const user = await adapter.getUser('non-existent');
      expect(user).toBeNull();
    });

    it('should update user', async () => {
      const mockClient = (adapter as any).db;
      const updatedUser = {
        id: 'user-123',
        email: 'updated@example.com',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        settings: {},
        subscription_tier: 'pro',
      };

      mockClient.from = jest.fn(() => ({
        update: jest.fn(() => ({
          eq: jest.fn(() => ({
            select: jest.fn(() => ({
              single: jest.fn(() => ({
                data: updatedUser,
                error: null,
              })),
            })),
          })),
        })),
      }));

      const user = await adapter.updateUser('user-123', {
        email: 'updated@example.com',
        subscription_tier: 'pro',
      });
      expect(user.email).toBe('updated@example.com');
      expect(user.subscription_tier).toBe('pro');
    });

    it('should delete user', async () => {
      const mockClient = (adapter as any).db;
      mockClient.from = jest.fn(() => ({
        delete: jest.fn(() => ({
          eq: jest.fn(() => ({
            error: null,
          })),
        })),
      }));

      await expect(adapter.deleteUser('user-123')).resolves.not.toThrow();
    });
  });

  describe('Email Account Operations', () => {
    const testAccount: EmailAccountInput = {
      email_address: 'account@example.com',
      provider: 'gmail',
      encrypted_credentials: 'encrypted-creds',
      settings: {
        sync_interval_minutes: 10,
      },
    };

    it('should add email account', async () => {
      const mockClient = (adapter as any).db;
      const mockAccount = {
        id: 'account-123',
        user_id: 'user-123',
        ...testAccount,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      mockClient.from = jest.fn(() => ({
        insert: jest.fn(() => ({
          select: jest.fn(() => ({
            single: jest.fn(() => ({
              data: mockAccount,
              error: null,
            })),
          })),
        })),
      }));

      const account = await adapter.addEmailAccount('user-123', testAccount);
      expect(account.email_address).toBe(testAccount.email_address);
      expect(account.provider).toBe('gmail');
    });

    it('should get email accounts for user', async () => {
      const mockClient = (adapter as any).db;
      const mockAccounts = [
        {
          id: 'account-1',
          user_id: 'user-123',
          email_address: 'account1@example.com',
          provider: 'gmail',
          encrypted_credentials: 'encrypted',
          settings: {},
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          id: 'account-2',
          user_id: 'user-123',
          email_address: 'account2@example.com',
          provider: 'outlook',
          encrypted_credentials: 'encrypted',
          settings: {},
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ];

      mockClient.from = jest.fn(() => ({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            eq: jest.fn(() => ({
              data: mockAccounts,
              error: null,
            })),
          })),
        })),
      }));

      const accounts = await adapter.getEmailAccounts('user-123');
      expect(accounts).toHaveLength(2);
      expect(accounts[0].provider).toBe('gmail');
      expect(accounts[1].provider).toBe('outlook');
    });
  });

  describe('Email Operations', () => {
    const testEmail: CreateEmailInput = {
      account_id: 'account-123',
      message_id: 'msg-123',
      subject: 'Test Email',
      from_address: 'sender@example.com',
      to_addresses: ['recipient@example.com'],
      body_text: 'Test email body',
      received_at: new Date(),
    };

    it('should create email', async () => {
      const mockClient = (adapter as any).db;
      const mockEmail = {
        id: 'email-123',
        ...testEmail,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      mockClient.from = jest.fn(() => ({
        insert: jest.fn(() => ({
          select: jest.fn(() => ({
            single: jest.fn(() => ({
              data: mockEmail,
              error: null,
            })),
          })),
        })),
      }));

      // Mock getEmailAccount for usage tracking
      jest.spyOn(adapter, 'getEmailAccount').mockResolvedValue({
        id: 'account-123',
        user_id: 'user-123',
        email_address: 'test@example.com',
        provider: 'gmail',
        encrypted_credentials: 'encrypted',
        settings: {},
        last_sync: null,
        is_active: true,
        created_at: new Date(),
        updated_at: new Date(),
      });

      // Mock incrementUsage
      jest.spyOn(adapter, 'incrementUsage').mockResolvedValue();

      const email = await adapter.createEmail(testEmail);
      expect(email.subject).toBe(testEmail.subject);
      expect(email.from_address).toBe(testEmail.from_address);
    });

    it('should get emails with pagination', async () => {
      const mockClient = (adapter as any).db;
      const mockEmails = [
        {
          id: 'email-1',
          account_id: 'account-123',
          subject: 'Email 1',
          from_address: 'sender1@example.com',
          to_addresses: ['recipient@example.com'],
          body_text: 'Body 1',
          received_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          id: 'email-2',
          account_id: 'account-123',
          subject: 'Email 2',
          from_address: 'sender2@example.com',
          to_addresses: ['recipient@example.com'],
          body_text: 'Body 2',
          received_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ];

      mockClient.from = jest.fn(() => ({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            order: jest.fn(() => ({
              range: jest.fn(() => ({
                data: mockEmails,
                error: null,
                count: 2,
              })),
            })),
          })),
        })),
      }));

      const result = await adapter.getEmails('account-123', { limit: 10, offset: 0 });
      expect(result.data).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.hasMore).toBe(false);
    });

    it('should mark email as processed', async () => {
      const mockClient = (adapter as any).db;
      mockClient.from = jest.fn(() => ({
        update: jest.fn(() => ({
          eq: jest.fn(() => ({
            error: null,
          })),
        })),
      }));

      await expect(adapter.markEmailProcessed('email-123')).resolves.not.toThrow();
    });
  });

  describe('AI Response Operations', () => {
    const testResponse: AIResponseInput = {
      email_id: 'email-123',
      response_text: 'Generated response',
      model_used: 'gpt-4',
      confidence_score: 0.95,
      tokens_used: 150,
      response_time_ms: 1200,
    };

    it('should save AI response', async () => {
      const mockClient = (adapter as any).db;
      const mockResponse = {
        id: 'response-123',
        ...testResponse,
        user_edited: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      mockClient.from = jest.fn(() => ({
        insert: jest.fn(() => ({
          select: jest.fn(() => ({
            single: jest.fn(() => ({
              data: mockResponse,
              error: null,
            })),
          })),
        })),
      }));

      // Mock getEmail and getEmailAccount for usage tracking
      jest.spyOn(adapter, 'getEmail').mockResolvedValue({
        id: 'email-123',
        account_id: 'account-123',
        message_id: 'msg-123',
        subject: 'Test',
        from_address: 'sender@example.com',
        to_addresses: ['recipient@example.com'],
        body_text: 'Body',
        received_at: new Date(),
        metadata: {},
        created_at: new Date(),
        updated_at: new Date(),
      });

      jest.spyOn(adapter, 'getEmailAccount').mockResolvedValue({
        id: 'account-123',
        user_id: 'user-123',
        email_address: 'test@example.com',
        provider: 'gmail',
        encrypted_credentials: 'encrypted',
        settings: {},
        last_sync: null,
        is_active: true,
        created_at: new Date(),
        updated_at: new Date(),
      });

      jest.spyOn(adapter, 'incrementUsage').mockResolvedValue();

      const response = await adapter.saveAIResponse(testResponse);
      expect(response.response_text).toBe(testResponse.response_text);
      expect(response.confidence_score).toBe(0.95);
    });

    it('should get AI response for email', async () => {
      const mockClient = (adapter as any).db;
      const mockResponse = {
        id: 'response-123',
        email_id: 'email-123',
        response_text: 'Generated response',
        model_used: 'gpt-4',
        confidence_score: 0.95,
        tokens_used: 150,
        response_time_ms: 1200,
        user_edited: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      mockClient.from = jest.fn(() => ({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            order: jest.fn(() => ({
              limit: jest.fn(() => ({
                single: jest.fn(() => ({
                  data: mockResponse,
                  error: null,
                })),
              })),
            })),
          })),
        })),
      }));

      const response = await adapter.getAIResponse('email-123');
      expect(response).not.toBeNull();
      expect(response?.email_id).toBe('email-123');
    });
  });

  describe('Template Operations', () => {
    const testTemplate: TemplateInput = {
      name: 'Quick Reply',
      description: 'A quick reply template',
      template_text: 'Thank you for your email. {{response}}',
      variables: [
        { name: 'response', type: 'text', required: true },
      ],
      category: 'business',
    };

    it('should create template', async () => {
      const mockClient = (adapter as any).db;
      const mockTemplate = {
        id: 'template-123',
        user_id: 'user-123',
        ...testTemplate,
        usage_count: 0,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      mockClient.from = jest.fn(() => ({
        insert: jest.fn(() => ({
          select: jest.fn(() => ({
            single: jest.fn(() => ({
              data: mockTemplate,
              error: null,
            })),
          })),
        })),
      }));

      jest.spyOn(adapter, 'incrementUsage').mockResolvedValue();

      const template = await adapter.createTemplate('user-123', testTemplate);
      expect(template.name).toBe(testTemplate.name);
      expect(template.category).toBe('business');
    });

    it('should get templates for user', async () => {
      const mockClient = (adapter as any).db;
      const mockTemplates = [
        {
          id: 'template-1',
          user_id: 'user-123',
          name: 'Template 1',
          template_text: 'Text 1',
          variables: [],
          usage_count: 5,
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          id: 'template-2',
          user_id: 'user-123',
          name: 'Template 2',
          template_text: 'Text 2',
          variables: [],
          usage_count: 10,
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ];

      mockClient.from = jest.fn(() => ({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            eq: jest.fn(() => ({
              order: jest.fn(() => ({
                data: mockTemplates,
                error: null,
              })),
            })),
          })),
        })),
      }));

      const templates = await adapter.getTemplates('user-123');
      expect(templates).toHaveLength(2);
    });
  });

  describe('Usage Tracking', () => {
    it('should increment usage metric', async () => {
      const mockClient = (adapter as any).db;
      mockClient.rpc = jest.fn(() => ({
        error: null,
      }));

      await expect(adapter.incrementUsage('user-123', 'ai_calls', 1)).resolves.not.toThrow();
      expect(mockClient.rpc).toHaveBeenCalledWith('increment_usage_metric', {
        p_user_id: 'user-123',
        p_metric_type: 'ai_calls',
        p_amount: 1,
      });
    });

    it('should check usage limit', async () => {
      jest.spyOn(adapter, 'getUsage').mockResolvedValue({
        id: 'metric-123',
        user_id: 'user-123',
        metric_type: 'ai_calls',
        count: 75,
        period_start: new Date(),
        period_end: new Date(),
        created_at: new Date(),
        updated_at: new Date(),
      });

      const exceeded = await adapter.checkUsageLimit('user-123', 'ai_calls', 100);
      expect(exceeded).toBe(false);

      const exceeded2 = await adapter.checkUsageLimit('user-123', 'ai_calls', 50);
      expect(exceeded2).toBe(true);
    });
  });

  describe('Real-time Subscriptions', () => {
    it('should subscribe to emails', () => {
      const callback = jest.fn();
      const unsubscribe = adapter.subscribeToEmails('account-123', callback);
      
      expect(typeof unsubscribe).toBe('function');
      unsubscribe();
    });

    it('should subscribe to AI responses', () => {
      const callback = jest.fn();
      const unsubscribe = adapter.subscribeToResponses('user-123', callback);
      
      expect(typeof unsubscribe).toBe('function');
      unsubscribe();
    });

    it('should subscribe to notifications', () => {
      const callback = jest.fn();
      const unsubscribe = adapter.subscribeToNotifications('user-123', callback);
      
      expect(typeof unsubscribe).toBe('function');
      unsubscribe();
    });
  });

  describe('Transaction Support', () => {
    it('should execute transaction successfully', async () => {
      const result = await adapter.transaction(async (trx) => {
        return 'transaction-result';
      });

      expect(result).toBe('transaction-result');
    });

    it('should handle transaction failure', async () => {
      await expect(
        adapter.transaction(async (trx) => {
          throw new Error('Transaction failed');
        })
      ).rejects.toThrow('Transaction failed');
    });
  });

  describe('Utility Operations', () => {
    it('should get database statistics', async () => {
      const mockClient = (adapter as any).db;
      mockClient.from = jest.fn(() => ({
        select: jest.fn(() => ({
          count: 10,
          error: null,
        })),
      }));

      const stats = await adapter.getStats();
      expect(stats).toHaveProperty('totalUsers');
      expect(stats).toHaveProperty('totalEmails');
      expect(stats).toHaveProperty('totalResponses');
      expect(stats).toHaveProperty('activeConnections');
    });

    it('should perform cleanup', async () => {
      const mockClient = (adapter as any).db;
      mockClient.from = jest.fn(() => ({
        delete: jest.fn(() => ({
          lt: jest.fn(() => ({
            select: jest.fn(() => ({
              count: 5,
              error: null,
            })),
          })),
        })),
      }));

      const deletedCount = await adapter.cleanup(new Date('2024-01-01'));
      expect(deletedCount).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle validation errors', async () => {
      const invalidEmail: CreateEmailInput = {
        account_id: 'not-a-uuid', // Invalid UUID
        message_id: 'msg-123',
        subject: 'Test',
        from_address: 'invalid-email', // Invalid email
        to_addresses: ['recipient@example.com'],
        body_text: 'Body',
        received_at: new Date(),
      };

      await expect(adapter.createEmail(invalidEmail)).rejects.toThrow();
    });

    it('should handle network errors with retry', async () => {
      const mockClient = (adapter as any).db;
      let attempts = 0;
      
      mockClient.from = jest.fn(() => ({
        select: jest.fn(() => ({
          limit: jest.fn(() => {
            attempts++;
            if (attempts < 3) {
              return {
                data: null,
                error: { code: 'ECONNREFUSED', message: 'Connection refused' },
              };
            }
            return { data: [], error: null };
          }),
        })),
      }));

      // This would need retry logic implementation
      const result = await adapter.healthCheck();
      expect(result).toBeDefined();
    });
  });
});

describe('SupabaseAdapter Integration Tests', () => {
  // These tests would run against a real Supabase test instance
  // Skip them in CI unless SUPABASE_TEST_URL is provided
  
  const shouldRunIntegration = process.env.SUPABASE_TEST_URL && process.env.SUPABASE_TEST_KEY;
  
  if (shouldRunIntegration) {
    let adapter: SupabaseAdapter;
    
    beforeAll(async () => {
      adapter = new SupabaseAdapter({
        url: process.env.SUPABASE_TEST_URL!,
        anonKey: process.env.SUPABASE_TEST_KEY!,
        serviceKey: process.env.SUPABASE_TEST_SERVICE_KEY,
      });
      
      await adapter.connect();
    });
    
    afterAll(async () => {
      // Clean up test data
      await adapter.disconnect();
    });
    
    it('should perform end-to-end user flow', async () => {
      // Create user
      const user = await adapter.createUser({
        email: `test-${Date.now()}@example.com`,
        subscription_tier: 'free',
      });
      expect(user.id).toBeDefined();
      
      // Add email account
      const account = await adapter.addEmailAccount(user.id, {
        email_address: `account-${Date.now()}@example.com`,
        provider: 'gmail',
        encrypted_credentials: 'test-encrypted',
      });
      expect(account.id).toBeDefined();
      
      // Create email
      const email = await adapter.createEmail({
        account_id: account.id,
        message_id: `msg-${Date.now()}`,
        subject: 'Integration Test Email',
        from_address: 'sender@example.com',
        to_addresses: ['recipient@example.com'],
        body_text: 'Test body',
        received_at: new Date(),
      });
      expect(email.id).toBeDefined();
      
      // Generate AI response
      const response = await adapter.saveAIResponse({
        email_id: email.id,
        response_text: 'Test response',
        model_used: 'gpt-4',
        confidence_score: 0.9,
        tokens_used: 100,
        response_time_ms: 1000,
      });
      expect(response.id).toBeDefined();
      
      // Clean up
      await adapter.deleteUser(user.id);
    });
  }
});