import { describe, expect, test, jest, beforeEach, afterEach } from '@jest/globals';
import { AnthropicProvider } from '../../../src/ai-providers/anthropic.provider';
import Anthropic from '@anthropic-ai/sdk';

jest.mock('@anthropic-ai/sdk');

describe('AnthropicProvider', () => {
  let provider: AnthropicProvider;
  let mockAnthropic: jest.Mocked<Anthropic>;

  beforeEach(() => {
    mockAnthropic = {
      messages: {
        create: jest.fn(),
        stream: jest.fn()
      },
      completions: {
        create: jest.fn()
      }
    } as any;

    (Anthropic as jest.MockedClass<typeof Anthropic>).mockImplementation(() => mockAnthropic);
    provider = new AnthropicProvider({ apiKey: 'test-key' });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('chat', () => {
    test('should send message to Claude', async () => {
      const messages = [
        { role: 'user' as const, content: 'Hello Claude' }
      ];
      const options = {
        model: 'claude-3-opus-20240229',
        temperature: 0.7,
        maxTokens: 1000
      };

      const mockResponse = {
        id: 'msg_123',
        type: 'message',
        role: 'assistant',
        content: [{
          type: 'text',
          text: 'Hello! How can I assist you today?'
        }],
        model: 'claude-3-opus-20240229',
        usage: {
          input_tokens: 10,
          output_tokens: 20
        }
      };

      mockAnthropic.messages.create.mockResolvedValue(mockResponse as any);

      const result = await provider.chat(messages, options);

      expect(mockAnthropic.messages.create).toHaveBeenCalledWith({
        model: options.model,
        messages,
        temperature: options.temperature,
        max_tokens: options.maxTokens
      });

      expect(result).toEqual({
        content: 'Hello! How can I assist you today?',
        model: 'claude-3-opus-20240229',
        usage: {
          promptTokens: 10,
          completionTokens: 20,
          totalTokens: 30
        },
        finishReason: 'stop'
      });
    });

    test('should handle system messages', async () => {
      const messages = [
        { role: 'system' as const, content: 'You are a helpful assistant' },
        { role: 'user' as const, content: 'Hello' }
      ];

      mockAnthropic.messages.create.mockResolvedValue({
        content: [{ type: 'text', text: 'Hello!' }],
        usage: { input_tokens: 15, output_tokens: 5 }
      } as any);

      await provider.chat(messages);

      expect(mockAnthropic.messages.create).toHaveBeenCalledWith(
        expect.objectContaining({
          system: 'You are a helpful assistant',
          messages: [{ role: 'user', content: 'Hello' }]
        })
      );
    });

    test('should handle streaming responses', async () => {
      const messages = [
        { role: 'user' as const, content: 'Stream test' }
      ];
      const options = { stream: true };

      const mockStream = {
        [Symbol.asyncIterator]: jest.fn().mockImplementation(function* () {
          yield {
            type: 'content_block_delta',
            delta: { text: 'Streaming' }
          };
          yield {
            type: 'content_block_delta',
            delta: { text: ' response' }
          };
          yield {
            type: 'message_stop'
          };
        })
      };

      mockAnthropic.messages.stream.mockReturnValue(mockStream as any);

      const result = await provider.chat(messages, options);

      expect(mockAnthropic.messages.stream).toHaveBeenCalled();
    });

    test('should handle multimodal content', async () => {
      const messages = [
        {
          role: 'user' as const,
          content: [
            { type: 'text' as const, text: 'What is in this image?' },
            { type: 'image' as const, source: { type: 'base64' as const, media_type: 'image/jpeg' as const, data: 'base64data' } }
          ]
        }
      ];

      mockAnthropic.messages.create.mockResolvedValue({
        content: [{ type: 'text', text: 'I see an image' }],
        usage: { input_tokens: 100, output_tokens: 10 }
      } as any);

      await provider.chat(messages);

      expect(mockAnthropic.messages.create).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.arrayContaining([
            expect.objectContaining({
              content: expect.arrayContaining([
                expect.objectContaining({ type: 'text' }),
                expect.objectContaining({ type: 'image' })
              ])
            })
          ])
        })
      );
    });

    test('should handle API errors', async () => {
      const messages = [
        { role: 'user' as const, content: 'Error test' }
      ];

      mockAnthropic.messages.create.mockRejectedValue(
        new Error('API Error: Rate limit exceeded')
      );

      await expect(provider.chat(messages)).rejects.toThrow('API Error: Rate limit exceeded');
    });

    test('should retry on transient errors', async () => {
      const messages = [
        { role: 'user' as const, content: 'Retry test' }
      ];

      mockAnthropic.messages.create
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          content: [{ type: 'text', text: 'Success after retry' }],
          usage: { input_tokens: 5, output_tokens: 5 }
        } as any);

      const result = await provider.chat(messages, { retries: 1 });

      expect(mockAnthropic.messages.create).toHaveBeenCalledTimes(2);
      expect(result.content).toBe('Success after retry');
    });
  });

  describe('validateApiKey', () => {
    test('should validate API key successfully', async () => {
      mockAnthropic.messages.create.mockResolvedValue({
        content: [{ type: 'text', text: 'test' }]
      } as any);

      const isValid = await provider.validateApiKey();

      expect(isValid).toBe(true);
      expect(mockAnthropic.messages.create).toHaveBeenCalledWith({
        model: 'claude-3-haiku-20240307',
        messages: [{ role: 'user', content: 'test' }],
        max_tokens: 1
      });
    });

    test('should return false for invalid API key', async () => {
      mockAnthropic.messages.create.mockRejectedValue(
        new Error('Invalid API key')
      );

      const isValid = await provider.validateApiKey();

      expect(isValid).toBe(false);
    });
  });

  describe('getAvailableModels', () => {
    test('should return available Claude models', () => {
      const models = provider.getAvailableModels();

      expect(models).toContain('claude-3-opus-20240229');
      expect(models).toContain('claude-3-sonnet-20240229');
      expect(models).toContain('claude-3-haiku-20240307');
      expect(Array.isArray(models)).toBe(true);
    });
  });

  describe('estimateTokens', () => {
    test('should estimate token count for text', () => {
      const text = 'This is a sample text for token estimation in Claude.';
      const tokens = provider.estimateTokens(text);

      expect(tokens).toBeGreaterThan(0);
      expect(typeof tokens).toBe('number');
    });

    test('should estimate tokens for messages', () => {
      const messages = [
        { role: 'user' as const, content: 'Hello Claude' },
        { role: 'assistant' as const, content: 'Hello! How can I help?' }
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
      const model = 'claude-3-opus-20240229';

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

      const opusCost = provider.calculateCost(usage, 'claude-3-opus-20240229');
      const haikuCost = provider.calculateCost(usage, 'claude-3-haiku-20240307');

      expect(opusCost).toBeGreaterThan(haikuCost);
    });
  });

  describe('handleToolUse', () => {
    test('should handle tool use in responses', async () => {
      const messages = [
        { role: 'user' as const, content: 'Calculate 5 + 3' }
      ];

      const mockResponse = {
        content: [
          {
            type: 'tool_use',
            id: 'tool_123',
            name: 'calculator',
            input: { operation: 'add', a: 5, b: 3 }
          }
        ],
        usage: { input_tokens: 20, output_tokens: 15 }
      };

      mockAnthropic.messages.create.mockResolvedValue(mockResponse as any);

      const result = await provider.chat(messages);

      expect(result.toolUse).toBeDefined();
      expect(result.toolUse).toEqual({
        id: 'tool_123',
        name: 'calculator',
        input: { operation: 'add', a: 5, b: 3 }
      });
    });
  });

  describe('moderateContent', () => {
    test('should check content safety', async () => {
      const content = 'Test content for moderation';

      // Claude doesn't have a separate moderation endpoint
      // It handles safety internally
      const result = await provider.moderateContent(content);

      expect(result).toEqual({
        flagged: false,
        categories: {},
        scores: {}
      });
    });
  });
});