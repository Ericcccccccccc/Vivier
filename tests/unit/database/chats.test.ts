import { describe, expect, test, jest, beforeEach, afterEach } from '@jest/globals';
import { PrismaClient } from '@prisma/client';
import { ChatService } from '../../../src/database/services/chat.service';

jest.mock('@prisma/client', () => {
  const mockPrismaClient = {
    chat: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      delete: jest.fn()
    },
    message: {
      create: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn()
    },
    $transaction: jest.fn(),
    $disconnect: jest.fn()
  };
  return { PrismaClient: jest.fn(() => mockPrismaClient) };
});

describe('ChatService', () => {
  let chatService: ChatService;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = new PrismaClient();
    chatService = new ChatService(mockPrisma);
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('createChat', () => {
    test('should create a new chat session', async () => {
      const chatData = {
        userId: 'user123',
        title: 'New Chat',
        provider: 'openai',
        model: 'gpt-4'
      };

      const createdChat = {
        id: 'chat123',
        ...chatData,
        createdAt: new Date(),
        updatedAt: new Date(),
        archived: false
      };

      mockPrisma.chat.create.mockResolvedValue(createdChat);

      const result = await chatService.createChat(chatData);

      expect(mockPrisma.chat.create).toHaveBeenCalledWith({
        data: chatData,
        include: {
          messages: {
            orderBy: { createdAt: 'asc' },
            take: 10
          }
        }
      });
      expect(result).toEqual(createdChat);
    });

    test('should generate title if not provided', async () => {
      const chatData = {
        userId: 'user123',
        provider: 'openai',
        model: 'gpt-4'
      };

      mockPrisma.chat.create.mockResolvedValue({
        id: 'chat123',
        ...chatData,
        title: expect.stringContaining('Chat'),
        createdAt: new Date()
      });

      await chatService.createChat(chatData);

      expect(mockPrisma.chat.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          title: expect.stringContaining('Chat')
        }),
        include: expect.any(Object)
      });
    });
  });

  describe('getUserChats', () => {
    test('should return user chats with pagination', async () => {
      const userId = 'user123';
      const chats = [
        { id: 'chat1', title: 'Chat 1', createdAt: new Date() },
        { id: 'chat2', title: 'Chat 2', createdAt: new Date() }
      ];

      mockPrisma.chat.findMany.mockResolvedValue(chats);

      const result = await chatService.getUserChats(userId, { page: 1, limit: 10 });

      expect(mockPrisma.chat.findMany).toHaveBeenCalledWith({
        where: { userId, archived: false },
        orderBy: { updatedAt: 'desc' },
        skip: 0,
        take: 10,
        include: {
          _count: { select: { messages: true } },
          messages: {
            take: 1,
            orderBy: { createdAt: 'desc' }
          }
        }
      });
      expect(result).toEqual(chats);
    });

    test('should filter archived chats', async () => {
      const userId = 'user123';

      mockPrisma.chat.findMany.mockResolvedValue([]);

      await chatService.getUserChats(userId, { archived: true });

      expect(mockPrisma.chat.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId, archived: true }
        })
      );
    });
  });

  describe('addMessage', () => {
    test('should add message to chat', async () => {
      const messageData = {
        chatId: 'chat123',
        role: 'user' as const,
        content: 'Hello, AI!',
        userId: 'user123'
      };

      const createdMessage = {
        id: 'msg123',
        ...messageData,
        createdAt: new Date(),
        tokens: 10
      };

      mockPrisma.message.create.mockResolvedValue(createdMessage);
      mockPrisma.chat.update.mockResolvedValue({});

      const result = await chatService.addMessage(messageData);

      expect(mockPrisma.message.create).toHaveBeenCalledWith({
        data: messageData
      });
      expect(mockPrisma.chat.update).toHaveBeenCalledWith({
        where: { id: messageData.chatId },
        data: { updatedAt: expect.any(Date) }
      });
      expect(result).toEqual(createdMessage);
    });

    test('should calculate tokens for message', async () => {
      const messageData = {
        chatId: 'chat123',
        role: 'assistant' as const,
        content: 'This is a response with multiple words for token counting.',
        userId: null
      };

      mockPrisma.message.create.mockResolvedValue({
        id: 'msg123',
        ...messageData,
        tokens: expect.any(Number)
      });

      await chatService.addMessage(messageData);

      expect(mockPrisma.message.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          tokens: expect.any(Number)
        })
      });
    });
  });

  describe('getChatMessages', () => {
    test('should return chat messages in order', async () => {
      const chatId = 'chat123';
      const messages = [
        { id: 'msg1', role: 'user', content: 'Hello', createdAt: new Date('2024-01-01') },
        { id: 'msg2', role: 'assistant', content: 'Hi!', createdAt: new Date('2024-01-02') }
      ];

      mockPrisma.message.findMany.mockResolvedValue(messages);

      const result = await chatService.getChatMessages(chatId);

      expect(mockPrisma.message.findMany).toHaveBeenCalledWith({
        where: { chatId },
        orderBy: { createdAt: 'asc' }
      });
      expect(result).toEqual(messages);
    });

    test('should support pagination for messages', async () => {
      const chatId = 'chat123';
      const limit = 50;
      const offset = 10;

      mockPrisma.message.findMany.mockResolvedValue([]);

      await chatService.getChatMessages(chatId, { limit, offset });

      expect(mockPrisma.message.findMany).toHaveBeenCalledWith({
        where: { chatId },
        orderBy: { createdAt: 'asc' },
        take: limit,
        skip: offset
      });
    });
  });

  describe('deleteChat', () => {
    test('should soft delete chat', async () => {
      const chatId = 'chat123';

      mockPrisma.chat.update.mockResolvedValue({
        id: chatId,
        archived: true
      });

      await chatService.deleteChat(chatId, false);

      expect(mockPrisma.chat.update).toHaveBeenCalledWith({
        where: { id: chatId },
        data: { archived: true }
      });
    });

    test('should hard delete chat and messages', async () => {
      const chatId = 'chat123';

      mockPrisma.$transaction.mockImplementation(async (callback: any) => {
        return callback(mockPrisma);
      });

      await chatService.deleteChat(chatId, true);

      expect(mockPrisma.$transaction).toHaveBeenCalled();
      expect(mockPrisma.message.deleteMany).toHaveBeenCalledWith({
        where: { chatId }
      });
      expect(mockPrisma.chat.delete).toHaveBeenCalledWith({
        where: { id: chatId }
      });
    });
  });

  describe('exportChat', () => {
    test('should export chat in JSON format', async () => {
      const chatId = 'chat123';
      const chat = {
        id: chatId,
        title: 'Test Chat',
        createdAt: new Date(),
        messages: [
          { role: 'user', content: 'Hello' },
          { role: 'assistant', content: 'Hi!' }
        ]
      };

      mockPrisma.chat.findUnique.mockResolvedValue(chat);

      const result = await chatService.exportChat(chatId, 'json');

      expect(result).toEqual(JSON.stringify(chat, null, 2));
    });

    test('should export chat in Markdown format', async () => {
      const chatId = 'chat123';
      const chat = {
        id: chatId,
        title: 'Test Chat',
        createdAt: new Date(),
        messages: [
          { role: 'user', content: 'Hello', createdAt: new Date() },
          { role: 'assistant', content: 'Hi!', createdAt: new Date() }
        ]
      };

      mockPrisma.chat.findUnique.mockResolvedValue(chat);

      const result = await chatService.exportChat(chatId, 'markdown');

      expect(result).toContain('# Test Chat');
      expect(result).toContain('**User:**');
      expect(result).toContain('**Assistant:**');
    });
  });

  describe('searchChats', () => {
    test('should search chats by query', async () => {
      const userId = 'user123';
      const query = 'test query';
      const chats = [
        { id: 'chat1', title: 'Test chat about query' }
      ];

      mockPrisma.chat.findMany.mockResolvedValue(chats);

      const result = await chatService.searchChats(userId, query);

      expect(mockPrisma.chat.findMany).toHaveBeenCalledWith({
        where: {
          userId,
          OR: [
            { title: { contains: query, mode: 'insensitive' } },
            {
              messages: {
                some: {
                  content: { contains: query, mode: 'insensitive' }
                }
              }
            }
          ]
        },
        include: expect.any(Object)
      });
      expect(result).toEqual(chats);
    });
  });
});