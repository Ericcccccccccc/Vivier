# AI Provider Layer - Groq Implementation

## Your Mission
Build a modular AI provider system with Groq as the primary implementation using their streaming SDK. The system must support easy swapping between providers (OpenAI, Anthropic, local models) without changing business logic.

## Groq SDK Implementation Pattern
You MUST use this exact pattern for Groq:

```javascript
import { Groq } from 'groq-sdk';

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY
});

const chatCompletion = await groq.chat.completions.create({
  messages: [
    {
      role: "system",
      content: "You are a professional email assistant. Generate concise, helpful responses."
    },
    {
      role: "user",
      content: emailContent
    }
  ],
  model: "openai/gpt-oss-120b",
  temperature: 0.7,
  max_completion_tokens: 8192,
  top_p: 1,
  stream: true,
  reasoning_effort: "medium",
  stop: null
});

// Handle streaming response
let fullResponse = '';
for await (const chunk of chatCompletion) {
  const content = chunk.choices[0]?.delta?.content || '';
  fullResponse += content;
  // Can emit progress events here
}
```

## Key Implementation Details

### 1. Interface Design
- AIProvider interface with standard methods
- Email-specific methods for sentiment, response generation, and summarization
- Token counting and rate limit checking
- Usage statistics and model information

### 2. Groq Provider Implementation
- Uses Groq SDK with streaming support
- Implements complete AIProvider interface
- Includes response caching with LRU eviction
- Rate limiting with adaptive backoff
- Usage tracking and metrics collection
- Error handling with fallback responses

### 3. Prompt Engineering
- EmailPromptBuilder for structured prompt creation
- Support for formal/casual/brief response styles
- Thread context inclusion (max 3 emails)
- Template-based prompts for common scenarios
- Prompt optimization to reduce token usage

### 4. Response Caching
- MD5 hash-based cache keys
- TTL-based expiration
- LRU eviction strategy
- Tiered cache with hot/cold separation
- Cache statistics and hit rate tracking

### 5. Rate Limiting
- Sliding window rate limiting
- Request and token limits per minute/day
- Adaptive rate limiting with error-based backoff
- Automatic retry with exponential backoff
- Rate limit status reporting

### 6. Usage Tracking
- Per-request metrics collection
- Daily/weekly/monthly aggregation
- Cost calculation and projection
- Free tier limit monitoring
- Export/import functionality

### 7. Error Handling
- Custom error classes for different scenarios
- Rate limit and token limit errors
- Network errors with retry logic
- Fallback responses for critical failures
- Error tracking and reporting

### 8. Email Templates
- Pre-defined templates for common emails
- Variable substitution with Handlebars-like syntax
- Template validation and suggestion
- Custom template support
- Category and tag-based organization

## Testing Strategy
- Comprehensive unit tests for all components
- Mock Groq responses for testing
- Rate limit and cache testing
- Error handling verification
- Streaming response testing
- Confidence calculation testing

## Important Requirements

### Streaming is Critical
Must implement streaming responses for real-time feedback

### Cache Everything
Cache responses based on email content hash to reduce API calls

### Rate Limit Protection
Never exceed 30 requests/minute or 6000 tokens/minute

### Graceful Degradation
If Groq fails, return a simple template response

### Token Estimation
Approximate tokens as length/4 for English text

### Confidence Scoring
Calculate 0-1 confidence based on response quality indicators

### Prompt Optimization
Keep prompts concise to save tokens while maintaining quality

### Error Recovery
Implement exponential backoff for retries

### Metrics Collection
Track every API call for usage analysis and cost projection

### Response Validation
Ensure responses are complete sentences with proper formatting

## Email-Specific Features

### Thread Context
Include last 3 emails maximum for context to maintain relevance

### Style Adaptation
Support formal/casual/brief response styles

### Length Control
Respect maxLength parameter to prevent overly long responses

### Signature Handling
Optionally append email signatures

### Action Detection
Identify required actions in emails

### Sentiment Matching
Match response tone to incoming email

### Language Detection
Detect and maintain email language

### Priority Classification
Identify urgent vs. non-urgent emails

### Category Detection
Classify email type (meeting, request, FYI)

### Follow-up Suggestions
Suggest follow-up actions when appropriate

## Provider Swapping
The system is designed to support multiple providers:
- Groq (implemented)
- OpenAI (interface ready)
- Anthropic (interface ready)
- Local models (interface ready)

All providers implement the same AIProvider interface, allowing seamless swapping.