# AI Provider Layer

A modular AI provider system with Groq as the primary implementation, designed for email response generation with streaming support.

## Features

- 🚀 **Streaming Responses** - Real-time response generation with Groq SDK
- 📧 **Email-Optimized** - Specialized methods for email responses, sentiment analysis, and thread summarization
- 💾 **Smart Caching** - LRU cache with TTL expiration to reduce API calls
- 🚦 **Rate Limiting** - Adaptive rate limiting with automatic backoff
- 📊 **Usage Tracking** - Comprehensive metrics and cost tracking
- 🔄 **Provider Agnostic** - Easy swapping between AI providers (Groq, OpenAI, Anthropic)
- 📝 **Template Library** - Pre-defined email templates for common scenarios
- 🛡️ **Error Handling** - Graceful degradation with fallback responses

## Installation

```bash
npm install @vivier/ai-provider-layer
```

## Quick Start

```javascript
import { createEmailAIProvider } from '@vivier/ai-provider-layer';

// Create provider with automatic configuration
const provider = await createEmailAIProvider();

// Generate an email response
const response = await provider.generateEmailResponse({
  subject: 'Meeting Request',
  from: 'colleague@company.com',
  to: ['me@company.com'],
  body: 'Can we schedule a meeting for tomorrow at 2 PM?',
  responseStyle: 'formal',
});

console.log(response.text);
```

## Configuration

Create a `.env` file:

```env
GROQ_API_KEY=your_groq_api_key_here
GROQ_MODEL=openai/gpt-oss-120b
RATE_LIMIT_REQUESTS=30
RATE_LIMIT_TOKENS=6000
```

## Usage Examples

### Streaming Response

```javascript
const stream = provider.generateStreamingResponse({
  messages: [
    { role: 'user', content: 'Write a brief thank you note' }
  ],
});

for await (const chunk of stream) {
  process.stdout.write(chunk);
}
```

### Email Sentiment Analysis

```javascript
const sentiment = await provider.analyzeEmailSentiment(
  "I'm very disappointed with the project delays."
);

console.log(sentiment);
// { sentiment: 'negative', score: 0.8, urgency: 'high', ... }
```

### Thread Summarization

```javascript
const summary = await provider.summarizeEmailThread(emailThread);
console.log(summary);
```

### Using Templates

```javascript
import { EmailTemplateManager } from '@vivier/ai-provider-layer';

const templateManager = new EmailTemplateManager();
const emailText = templateManager.renderTemplate('meeting_accept', {
  meeting_type: 'Project Review',
  date: 'Tomorrow',
  time: '2 PM',
  location: 'Conference Room A',
  closing: 'Best regards',
  sender_name: 'John Smith',
});
```

## Testing

Run the test suite:

```bash
# Run all tests
npm test

# Test Groq connection
npm run test:groq

# Watch mode
npm run test:watch

# Coverage report
npm run test:coverage
```

## Architecture

```
ai-provider-layer/
├── src/
│   ├── interface.ts        # Core interfaces and types
│   ├── providers/
│   │   └── groq.ts         # Groq implementation
│   ├── prompts/
│   │   ├── email-response.ts
│   │   └── email-analysis.ts
│   ├── templates/
│   │   └── email-templates.ts
│   ├── cache.ts            # Response caching
│   ├── rate-limiter.ts     # Rate limiting
│   ├── usage-tracker.ts    # Usage metrics
│   └── errors.ts           # Error classes
└── test-groq.js           # Interactive test script
```

## Rate Limits

Default rate limits:
- 30 requests per minute
- 6,000 tokens per minute
- 1,000 requests per day
- 200,000 tokens per day

The system includes adaptive rate limiting that automatically adjusts based on error rates.

## Caching

Responses are cached based on email content hash with:
- 1-hour TTL by default
- LRU eviction when cache is full
- Tiered cache with hot/cold separation
- Cache hit rate tracking

## Error Handling

The system handles various error scenarios:
- Rate limit errors with retry after
- Token limit errors with truncation
- Network errors with exponential backoff
- Fallback responses for critical failures

## Usage Tracking

Track usage metrics including:
- Total requests and tokens
- Cost calculation and projection
- Response time analytics
- Error rates and types
- Daily/weekly/monthly aggregation

## Provider Support

Currently implemented:
- ✅ Groq (fully implemented)

Planned:
- ⏳ OpenAI
- ⏳ Anthropic
- ⏳ Local models

All providers implement the same `AIProvider` interface for easy swapping.

## License

MIT

## Contributing

See [CLAUDE.md](./CLAUDE.md) for detailed implementation guidelines.