import { describe, expect, test, jest, beforeAll, afterAll, beforeEach } from '@jest/globals';
import request from 'supertest';
import { app } from '../../../src/api/app';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

// Mock AI providers
jest.mock('../../../src/ai-providers/openai.provider');
jest.mock('../../../src/ai-providers/anthropic.provider');

describe('Chat API Integration Tests', () => {
  let testUser: any;
  let authToken: string;
  let chatId: string;

  beforeAll(async () => {
    await prisma.$connect();
    
    // Clean up test data
    await prisma.message.deleteMany({});
    await prisma.chat.deleteMany({});
    await prisma.user.deleteMany({ where: { email: { contains: 'test' } } });

    // Create test user
    const hashedPassword = await bcrypt.hash('TestPass123!', 10);
    testUser = await prisma.user.create({
      data: {
        email: 'chattest@example.com',
        password: hashedPassword,
        name: 'Chat Test User',
        subscription: {
          create: {
            plan: 'pro',
            status: 'active',
            currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
          }
        }
      }
    });

    // Generate auth token
    authToken = jwt.sign(
      { userId: testUser.id },
      process.env.JWT_SECRET!,
      { expiresIn: '1h' }
    );
  });

  afterAll(async () => {
    await prisma.message.deleteMany({});
    await prisma.chat.deleteMany({});
    await prisma.user.deleteMany({ where: { email: { contains: 'test' } } });
    await prisma.$disconnect();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/chats', () => {
    test('should create a new chat', async () => {
      const response = await request(app)
        .post('/api/chats')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Test Chat',
          provider: 'openai',
          model: 'gpt-4'
        })
        .expect(201);

      expect(response.body).toMatchObject({
        success: true,
        chat: {
          title: 'Test Chat',
          provider: 'openai',
          model: 'gpt-4',
          userId: testUser.id
        }
      });

      chatId = response.body.chat.id;
    });

    test('should auto-generate title if not provided', async () => {
      const response = await request(app)
        .post('/api/chats')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          provider: 'anthropic',
          model: 'claude-3-opus-20240229'
        })
        .expect(201);

      expect(response.body.chat.title).toMatch(/^Chat \d{4}-\d{2}-\d{2}/);
    });

    test('should require authentication', async () => {
      const response = await request(app)
        .post('/api/chats')
        .send({
          title: 'Unauthorized Chat'
        })
        .expect(401);

      expect(response.body).toMatchObject({
        success: false,
        error: 'Unauthorized'
      });
    });
  });

  describe('GET /api/chats', () => {
    beforeAll(async () => {
      // Create multiple chats for testing
      for (let i = 0; i < 5; i++) {
        await prisma.chat.create({
          data: {
            title: `Chat ${i}`,
            userId: testUser.id,
            provider: 'openai',
            model: 'gpt-4'
          }
        });
      }
    });

    test('should get user chats', async () => {
      const response = await request(app)
        .get('/api/chats')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        chats: expect.arrayContaining([
          expect.objectContaining({
            userId: testUser.id
          })
        ])
      });
      expect(response.body.chats.length).toBeGreaterThan(0);
    });

    test('should support pagination', async () => {
      const response = await request(app)
        .get('/api/chats?page=1&limit=2')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.chats).toHaveLength(2);
      expect(response.body.pagination).toMatchObject({
        page: 1,
        limit: 2,
        total: expect.any(Number)
      });
    });

    test('should filter archived chats', async () => {
      // Archive a chat
      await prisma.chat.update({
        where: { id: chatId },
        data: { archived: true }
      });

      const response = await request(app)
        .get('/api/chats?archived=false')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const archivedChat = response.body.chats.find((c: any) => c.id === chatId);
      expect(archivedChat).toBeUndefined();
    });
  });

  describe('GET /api/chats/:id', () => {
    test('should get specific chat', async () => {
      const response = await request(app)
        .get(`/api/chats/${chatId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        chat: {
          id: chatId,
          userId: testUser.id
        }
      });
    });

    test('should include messages', async () => {
      // Add a message to the chat
      await prisma.message.create({
        data: {
          chatId,
          role: 'user',
          content: 'Test message',
          userId: testUser.id
        }
      });

      const response = await request(app)
        .get(`/api/chats/${chatId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.chat.messages).toHaveLength(1);
      expect(response.body.chat.messages[0]).toMatchObject({
        role: 'user',
        content: 'Test message'
      });
    });

    test('should prevent access to other users chats', async () => {
      // Create another user and chat
      const otherUser = await prisma.user.create({
        data: {
          email: 'other@example.com',
          password: 'password',
          name: 'Other User'
        }
      });

      const otherChat = await prisma.chat.create({
        data: {
          title: 'Private Chat',
          userId: otherUser.id,
          provider: 'openai',
          model: 'gpt-4'
        }
      });

      const response = await request(app)
        .get(`/api/chats/${otherChat.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(403);

      expect(response.body).toMatchObject({
        success: false,
        error: 'Forbidden'
      });

      // Cleanup
      await prisma.chat.delete({ where: { id: otherChat.id } });
      await prisma.user.delete({ where: { id: otherUser.id } });
    });
  });

  describe('POST /api/chats/:id/messages', () => {
    test('should send message and get AI response', async () => {
      // Mock AI response
      const mockAIProvider = require('../../../src/ai-providers/openai.provider');
      mockAIProvider.OpenAIProvider.prototype.chat = jest.fn().mockResolvedValue({
        content: 'AI response',
        usage: {
          promptTokens: 10,
          completionTokens: 20,
          totalTokens: 30
        }
      });

      const response = await request(app)
        .post(`/api/chats/${chatId}/messages`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          content: 'Hello AI'
        })
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        userMessage: {
          role: 'user',
          content: 'Hello AI'
        },
        aiMessage: {
          role: 'assistant',
          content: 'AI response'
        }
      });

      // Verify messages were saved
      const messages = await prisma.message.findMany({
        where: { chatId },
        orderBy: { createdAt: 'desc' },
        take: 2
      });

      expect(messages).toHaveLength(2);
      expect(messages[1].role).toBe('user');
      expect(messages[0].role).toBe('assistant');
    });

    test('should handle streaming responses', async () => {
      const mockAIProvider = require('../../../src/ai-providers/openai.provider');
      
      // Mock streaming response
      const mockStream = {
        [Symbol.asyncIterator]: function* () {
          yield { delta: { content: 'Streaming ' } };
          yield { delta: { content: 'response' } };
        }
      };

      mockAIProvider.OpenAIProvider.prototype.chat = jest.fn().mockResolvedValue({
        stream: mockStream,
        usage: { totalTokens: 25 }
      });

      const response = await request(app)
        .post(`/api/chats/${chatId}/messages`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          content: 'Stream test',
          stream: true
        })
        .expect(200);

      // For streaming, response would be Server-Sent Events
      // Here we're testing the non-streaming fallback
      expect(response.body.success).toBe(true);
    });

    test('should enforce rate limits', async () => {
      // Send multiple messages quickly
      for (let i = 0; i < 10; i++) {
        await request(app)
          .post(`/api/chats/${chatId}/messages`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({ content: `Message ${i}` });
      }

      // 11th message should be rate limited
      const response = await request(app)
        .post(`/api/chats/${chatId}/messages`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ content: 'Rate limited message' })
        .expect(429);

      expect(response.body).toMatchObject({
        success: false,
        error: expect.stringContaining('rate limit')
      });
    });

    test('should track token usage', async () => {
      const mockAIProvider = require('../../../src/ai-providers/openai.provider');
      mockAIProvider.OpenAIProvider.prototype.chat = jest.fn().mockResolvedValue({
        content: 'Response',
        usage: {
          promptTokens: 50,
          completionTokens: 100,
          totalTokens: 150
        }
      });

      await request(app)
        .post(`/api/chats/${chatId}/messages`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ content: 'Track tokens' })
        .expect(200);

      // Check usage was tracked
      const usage = await prisma.usage.findFirst({
        where: { userId: testUser.id },
        orderBy: { createdAt: 'desc' }
      });

      expect(usage).toMatchObject({
        tokensUsed: 150,
        provider: 'openai',
        model: 'gpt-4'
      });
    });
  });

  describe('PUT /api/chats/:id', () => {
    test('should update chat title', async () => {
      const response = await request(app)
        .put(`/api/chats/${chatId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Updated Chat Title'
        })
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        chat: {
          id: chatId,
          title: 'Updated Chat Title'
        }
      });
    });

    test('should update chat settings', async () => {
      const response = await request(app)
        .put(`/api/chats/${chatId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          settings: {
            temperature: 0.8,
            maxTokens: 2000,
            systemPrompt: 'You are a helpful assistant'
          }
        })
        .expect(200);

      expect(response.body.chat.settings).toMatchObject({
        temperature: 0.8,
        maxTokens: 2000,
        systemPrompt: 'You are a helpful assistant'
      });
    });
  });

  describe('DELETE /api/chats/:id', () => {
    test('should soft delete chat', async () => {
      const response = await request(app)
        .delete(`/api/chats/${chatId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        message: 'Chat archived successfully'
      });

      // Verify chat is archived
      const chat = await prisma.chat.findUnique({
        where: { id: chatId }
      });
      expect(chat?.archived).toBe(true);
    });

    test('should hard delete with force flag', async () => {
      const tempChat = await prisma.chat.create({
        data: {
          title: 'Temp Chat',
          userId: testUser.id,
          provider: 'openai',
          model: 'gpt-4'
        }
      });

      const response = await request(app)
        .delete(`/api/chats/${tempChat.id}?force=true`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        message: 'Chat deleted permanently'
      });

      // Verify chat is deleted
      const chat = await prisma.chat.findUnique({
        where: { id: tempChat.id }
      });
      expect(chat).toBeNull();
    });
  });

  describe('GET /api/chats/:id/export', () => {
    test('should export chat as JSON', async () => {
      const response = await request(app)
        .get(`/api/chats/${chatId}/export?format=json`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.headers['content-type']).toContain('application/json');
      expect(response.body).toHaveProperty('id', chatId);
      expect(response.body).toHaveProperty('messages');
    });

    test('should export chat as Markdown', async () => {
      const response = await request(app)
        .get(`/api/chats/${chatId}/export?format=markdown`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.headers['content-type']).toContain('text/markdown');
      expect(response.text).toContain('#');
      expect(response.text).toContain('**User:**');
    });

    test('should export chat as PDF', async () => {
      const response = await request(app)
        .get(`/api/chats/${chatId}/export?format=pdf`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.headers['content-type']).toContain('application/pdf');
      expect(response.body).toBeInstanceOf(Buffer);
    });
  });

  describe('POST /api/chats/search', () => {
    test('should search chats by content', async () => {
      // Create chat with specific content
      const searchChat = await prisma.chat.create({
        data: {
          title: 'Searchable Chat',
          userId: testUser.id,
          provider: 'openai',
          model: 'gpt-4'
        }
      });

      await prisma.message.create({
        data: {
          chatId: searchChat.id,
          role: 'user',
          content: 'unique search term quantum physics',
          userId: testUser.id
        }
      });

      const response = await request(app)
        .post('/api/chats/search')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          query: 'quantum physics'
        })
        .expect(200);

      expect(response.body.results).toContainEqual(
        expect.objectContaining({
          id: searchChat.id,
          title: 'Searchable Chat'
        })
      );
    });
  });
});