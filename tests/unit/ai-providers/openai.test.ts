import { describe, expect, test, jest, beforeEach, afterEach } from '@jest/globals';
import { OpenAIProvider } from '../../../src/ai-providers/openai.provider';
import OpenAI from 'openai';

jest.mock('openai');

describe('OpenAIProvider', () => {
  let provider: OpenAIProvider;
  let mockOpenAI: jest.Mocked<OpenAI>;

  beforeEach(() => {
    mockOpenAI = {
      chat: {
        completions: {
          create: jest.fn()
        }
      },
      embeddings: {
        create: jest.fn()
      },
      moderations: {
        create: jest.fn()
      }
    } as any;

    (OpenAI as jest.MockedClass<typeof OpenAI>).mockImplementation(() => mockOpenAI);
    provider = new OpenAIProvider({ apiKey: 'test-key' });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('chat', () => {
    test('should send chat completion request', async () => {
      const messages = [
        { role: 'user' as const, content: 'Hello' }
      ];
      const options = {
        model: 'gpt-4',
        temperature: 0.7,
        maxTokens: 1000
      };

      const mockResponse = {
        id: 'chatcmpl-123',
        choices: [{
          index: 0,
          message: {
            role: 'assistant',
            content: 'Hello! How can I help you?'
          },
          finish_reason: 'stop'
        }],
        usage: {
          prompt_tokens: 10,
          completion_tokens: 20,
          total_tokens: 30
        }
      };

      mockOpenAI.chat.completions.create.mockResolvedValue(mockResponse as any);

      const result = await provider.chat(messages, options);

      expect(mockOpenAI.chat.completions.create).toHaveBeenCalledWith({
        model: options.model,
        messages,
        temperature: options.temperature,
        max_tokens: options.maxTokens,
        stream: false
      });

      expect(result).toEqual({
        content: 'Hello! How can I help you?',
        model: 'gpt-4',
        usage: {
          promptTokens: 10,
          completionTokens: 20,
          totalTokens: 30
        },
        finishReason: 'stop'
      });
    });

    test('should handle streaming responses', async () => {
      const messages = [
        { role: 'user' as const, content: 'Tell me a story' }
      ];
      const options = {
        model: 'gpt-4',
        stream: true
      };

      const mockStream = {
        [Symbol.asyncIterator]: jest.fn().mockImplementation(function* () {
          yield {
            choices: [{
              delta: { content: 'Once upon' }
            }]
          };
          yield {
            choices: [{
              delta: { content: ' a time' }
            }]
          };
        })
      };

      mockOpenAI.chat.completions.create.mockResolvedValue(mockStream as any);

      const result = await provider.chat(messages, options);

      expect(mockOpenAI.chat.completions.create).toHaveBeenCalledWith({
        model: options.model,
        messages,
        stream: true
      });
    });

    test('should handle API errors', async () => {
      const messages = [
        { role: 'user' as const, content: 'Hello' }
      ];

      mockOpenAI.chat.completions.create.mockRejectedValue(
        new Error('API Error: Rate limit exceeded')
      );

      await expect(provider.chat(messages)).rejects.toThrow('API Error: Rate limit exceeded');
    });

    test('should retry on transient errors', async () => {
      const messages = [
        { role: 'user' as const, content: 'Hello' }
      ];

      mockOpenAI.chat.completions.create
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          choices: [{
            message: { role: 'assistant', content: 'Success after retry' }
          }],
          usage: { total_tokens: 10 }
        } as any);

      const result = await provider.chat(messages, { retries: 1 });

      expect(mockOpenAI.chat.completions.create).toHaveBeenCalledTimes(2);
      expect(result.content).toBe('Success after retry');
    });
  });

  describe('generateEmbedding', () => {
    test('should generate text embeddings', async () => {
      const text = 'Sample text for embedding';
      const mockEmbedding = new Array(1536).fill(0).map(() => Math.random());

      mockOpenAI.embeddings.create.mockResolvedValue({
        data: [{
          embedding: mockEmbedding,
          index: 0
        }],
        usage: {
          prompt_tokens: 5,
          total_tokens: 5
        }
      } as any);

      const result = await provider.generateEmbedding(text);

      expect(mockOpenAI.embeddings.create).toHaveBeenCalledWith({
        model: 'text-embedding-ada-002',
        input: text
      });
      expect(result).toEqual({
        embedding: mockEmbedding,
        model: 'text-embedding-ada-002',
        usage: {
          totalTokens: 5
        }
      });
    });

    test('should handle batch embeddings', async () => {
      const texts = ['Text 1', 'Text 2', 'Text 3'];
      const mockEmbeddings = texts.map(() => 
        new Array(1536).fill(0).map(() => Math.random())
      );

      mockOpenAI.embeddings.create.mockResolvedValue({
        data: mockEmbeddings.map((embedding, index) => ({
          embedding,
          index
        })),
        usage: {
          total_tokens: 15
        }
      } as any);

      const result = await provider.generateEmbeddings(texts);

      expect(mockOpenAI.embeddings.create).toHaveBeenCalledWith({
        model: 'text-embedding-ada-002',
        input: texts
      });
      expect(result.embeddings).toHaveLength(3);
    });
  });

  describe('moderateContent', () => {
    test('should check content for policy violations', async () => {
      const content = 'This is a test message';

      mockOpenAI.moderations.create.mockResolvedValue({
        results: [{
          flagged: false,
          categories: {
            'hate': false,
            'harassment': false,
            'self-harm': false,
            'sexual': false,
            'violence': false
          },
          category_scores: {
            'hate': 0.001,
            'harassment': 0.002,
            'self-harm': 0.0001,
            'sexual': 0.003,
            'violence': 0.001
          }
        }]
      } as any);

      const result = await provider.moderateContent(content);

      expect(mockOpenAI.moderations.create).toHaveBeenCalledWith({
        input: content
      });
      expect(result).toEqual({
        flagged: false,
        categories: expect.any(Object),
        scores: expect.any(Object)
      });
    });

    test('should flag inappropriate content', async () => {
      const content = 'Inappropriate content';

      mockOpenAI.moderations.create.mockResolvedValue({
        results: [{
          flagged: true,
          categories: {
            'harassment': true
          },
          category_scores: {
            'harassment': 0.95
          }
        }]
      } as any);

      const result = await provider.moderateContent(content);

      expect(result.flagged).toBe(true);
      expect(result.categories.harassment).toBe(true);
    });
  });

  describe('validateApiKey', () => {
    test('should validate API key successfully', async () => {
      mockOpenAI.chat.completions.create.mockResolvedValue({
        choices: [{ message: { content: 'test' } }]
      } as any);

      const isValid = await provider.validateApiKey();

      expect(isValid).toBe(true);
      expect(mockOpenAI.chat.completions.create).toHaveBeenCalledWith({
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: 'test' }],
        max_tokens: 1
      });
    });

    test('should return false for invalid API key', async () => {
      mockOpenAI.chat.completions.create.mockRejectedValue(
        new Error('Invalid API key')
      );

      const isValid = await provider.validateApiKey();

      expect(isValid).toBe(false);
    });
  });

  describe('getAvailableModels', () => {
    test('should return available models', () => {
      const models = provider.getAvailableModels();

      expect(models).toContain('gpt-4');
      expect(models).toContain('gpt-4-turbo');
      expect(models).toContain('gpt-3.5-turbo');
      expect(Array.isArray(models)).toBe(true);
    });
  });

  describe('estimateTokens', () => {
    test('should estimate token count for text', () => {
      const text = 'This is a sample text for token estimation.';
      const tokens = provider.estimateTokens(text);

      expect(tokens).toBeGreaterThan(0);
      expect(typeof tokens).toBe('number');
    });

    test('should estimate tokens for messages', () => {
      const messages = [
        { role: 'user' as const, content: 'Hello' },
        { role: 'assistant' as const, content: 'Hi there!' }
      ];

      const tokens = provider.estimateTokens(messages);

      expect(tokens).toBeGreaterThan(0);
    });
  });

  describe('calculateCost', () => {
    test('should calculate cost based on token usage', () => {
      const usage = {
        promptTokens: 1000,
        completionTokens: 500,
        totalTokens: 1500
      };
      const model = 'gpt-4';

      const cost = provider.calculateCost(usage, model);

      expect(cost).toBeGreaterThan(0);
      expect(typeof cost).toBe('number');
    });

    test('should handle different model pricing', () => {
      const usage = {
        promptTokens: 1000,
        completionTokens: 500,
        totalTokens: 1500
      };

      const gpt4Cost = provider.calculateCost(usage, 'gpt-4');
      const gpt35Cost = provider.calculateCost(usage, 'gpt-3.5-turbo');

      expect(gpt4Cost).toBeGreaterThan(gpt35Cost);
    });
  });
});