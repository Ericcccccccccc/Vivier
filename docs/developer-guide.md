# Vivier Developer Guide

## Table of Contents
1. [Getting Started](#getting-started)
2. [Architecture Overview](#architecture-overview)
3. [Development Setup](#development-setup)
4. [Project Structure](#project-structure)
5. [API Development](#api-development)
6. [Database Management](#database-management)
7. [AI Provider Integration](#ai-provider-integration)
8. [Testing Strategy](#testing-strategy)
9. [Deployment](#deployment)
10. [Contributing](#contributing)

## Getting Started

### Prerequisites

- **Node.js**: v18.0.0 or higher
- **PostgreSQL**: v14 or higher
- **Redis**: v6.2 or higher
- **Docker**: v20.10 or higher (optional)
- **Git**: v2.30 or higher

### Quick Start

```bash
# Clone the repository
git clone https://github.com/your-org/vivier.git
cd vivier

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your configuration

# Run database migrations
npm run db:migrate

# Seed database (development only)
npm run db:seed

# Start development server
npm run dev
```

## Architecture Overview

### Technology Stack

**Backend:**
- Node.js with TypeScript
- Express.js for API server
- Prisma ORM for database
- Redis for caching and queues
- Bull for job processing

**Frontend:**
- Next.js 14 with App Router
- React 18 with TypeScript
- Tailwind CSS for styling
- Zustand for state management
- React Query for data fetching

**Infrastructure:**
- PostgreSQL for primary database
- Redis for caching and sessions
- S3/CloudStorage for file uploads
- WebSocket for real-time features

### System Architecture

```
┌─────────────────┐     ┌─────────────────┐
│                 │     │                 │
│   Web Client    │────▶│   API Gateway   │
│                 │     │                 │
└─────────────────┘     └────────┬────────┘
                                 │
                    ┌────────────┼────────────┐
                    │            │            │
              ┌─────▼─────┐ ┌───▼───┐ ┌─────▼─────┐
              │           │ │       │ │           │
              │ Auth API  │ │Chat API│ │ Admin API │
              │           │ │       │ │           │
              └─────┬─────┘ └───┬───┘ └─────┬─────┘
                    │           │            │
                    └───────────┼────────────┘
                                │
                  ┌─────────────┼─────────────┐
                  │             │             │
            ┌─────▼─────┐ ┌────▼────┐ ┌─────▼─────┐
            │           │ │         │ │           │
            │PostgreSQL │ │  Redis  │ │    S3     │
            │           │ │         │ │           │
            └───────────┘ └─────────┘ └───────────┘
```

## Development Setup

### Environment Variables

Create a `.env` file with the following variables:

```env
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/vivier"

# Redis
REDIS_URL="redis://localhost:6379"

# Authentication
JWT_SECRET="your-secret-key"
JWT_EXPIRY="7d"

# AI Providers
OPENAI_API_KEY="sk-..."
ANTHROPIC_API_KEY="sk-ant-..."
GOOGLE_AI_KEY="..."

# Storage
AWS_ACCESS_KEY_ID="..."
AWS_SECRET_ACCESS_KEY="..."
AWS_REGION="us-east-1"
S3_BUCKET="vivier-uploads"

# Email
SMTP_HOST="smtp.gmail.com"
SMTP_PORT="587"
SMTP_USER="your-email@gmail.com"
SMTP_PASS="your-app-password"

# Stripe (Payment)
STRIPE_SECRET_KEY="sk_test_..."
STRIPE_WEBHOOK_SECRET="whsec_..."

# Application
NODE_ENV="development"
PORT="3000"
CLIENT_URL="http://localhost:3001"
```

### Docker Setup

Use Docker Compose for local development:

```yaml
# docker-compose.yml
version: '3.8'

services:
  postgres:
    image: postgres:14-alpine
    environment:
      POSTGRES_USER: vivier
      POSTGRES_PASSWORD: vivier
      POSTGRES_DB: vivier
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:6.2-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data

  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - DATABASE_URL=postgresql://vivier:vivier@postgres:5432/vivier
      - REDIS_URL=redis://redis:6379
    depends_on:
      - postgres
      - redis
    volumes:
      - .:/app
      - /app/node_modules

volumes:
  postgres_data:
  redis_data:
```

Run with:
```bash
docker-compose up -d
```

## Project Structure

```
vivier/
├── src/
│   ├── api/              # API routes and controllers
│   │   ├── auth/
│   │   ├── chats/
│   │   ├── users/
│   │   └── middleware/
│   ├── database/         # Database models and migrations
│   │   ├── prisma/
│   │   ├── seeds/
│   │   └── services/
│   ├── ai-providers/     # AI provider integrations
│   │   ├── openai/
│   │   ├── anthropic/
│   │   └── interfaces/
│   ├── services/         # Business logic
│   │   ├── auth.service.ts
│   │   ├── chat.service.ts
│   │   └── payment.service.ts
│   ├── utils/           # Utility functions
│   ├── types/           # TypeScript types
│   └── config/          # Configuration files
├── tests/               # Test files
│   ├── unit/
│   ├── integration/
│   └── e2e/
├── docs/                # Documentation
├── scripts/             # Build and deployment scripts
└── package.json
```

## API Development

### Creating New Endpoints

1. **Define Route**:
```typescript
// src/api/routes/example.route.ts
import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { ExampleController } from '../controllers/example.controller';

const router = Router();
const controller = new ExampleController();

router.get('/examples', authenticate, controller.list);
router.post('/examples', authenticate, controller.create);
router.get('/examples/:id', authenticate, controller.get);
router.put('/examples/:id', authenticate, controller.update);
router.delete('/examples/:id', authenticate, controller.delete);

export default router;
```

2. **Implement Controller**:
```typescript
// src/api/controllers/example.controller.ts
import { Request, Response } from 'express';
import { ExampleService } from '../../services/example.service';

export class ExampleController {
  private service = new ExampleService();

  list = async (req: Request, res: Response) => {
    try {
      const { page = 1, limit = 20 } = req.query;
      const result = await this.service.list({
        page: Number(page),
        limit: Number(limit),
        userId: req.user.id
      });
      res.json({ success: true, ...result });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  };

  create = async (req: Request, res: Response) => {
    try {
      const result = await this.service.create({
        ...req.body,
        userId: req.user.id
      });
      res.status(201).json({ success: true, data: result });
    } catch (error) {
      res.status(400).json({ success: false, error: error.message });
    }
  };
}
```

3. **Add Validation**:
```typescript
// src/api/validators/example.validator.ts
import { body, param, query } from 'express-validator';

export const createExampleValidator = [
  body('name').isString().trim().notEmpty(),
  body('description').optional().isString(),
  body('type').isIn(['type1', 'type2'])
];

export const listExampleValidator = [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 })
];
```

### Middleware

**Authentication Middleware**:
```typescript
// src/api/middleware/auth.ts
import jwt from 'jsonwebtoken';

export const authenticate = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) throw new Error('No token provided');
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = await UserService.findById(decoded.userId);
    
    if (!req.user) throw new Error('User not found');
    next();
  } catch (error) {
    res.status(401).json({ error: 'Unauthorized' });
  }
};
```

**Rate Limiting**:
```typescript
// src/api/middleware/rateLimit.ts
import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';

export const apiLimiter = rateLimit({
  store: new RedisStore({
    client: redis,
    prefix: 'rate-limit:'
  }),
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP'
});

export const authLimiter = rateLimit({
  store: new RedisStore({
    client: redis,
    prefix: 'auth-limit:'
  }),
  windowMs: 15 * 60 * 1000,
  max: 5,
  skipSuccessfulRequests: true
});
```

## Database Management

### Prisma Schema

```prisma
// prisma/schema.prisma
model User {
  id            String   @id @default(cuid())
  email         String   @unique
  password      String
  name          String?
  role          Role     @default(USER)
  emailVerified Boolean  @default(false)
  
  chats         Chat[]
  messages      Message[]
  subscription  Subscription?
  
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  
  @@index([email])
}

model Chat {
  id        String   @id @default(cuid())
  title     String
  userId    String
  user      User     @relation(fields: [userId], references: [id])
  
  provider  String
  model     String
  settings  Json?
  
  messages  Message[]
  
  archived  Boolean  @default(false)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  
  @@index([userId, archived])
}
```

### Migrations

```bash
# Create a new migration
npm run db:migrate:dev -- --name add_user_preferences

# Apply migrations
npm run db:migrate:deploy

# Reset database (development only)
npm run db:reset

# Generate Prisma client
npm run db:generate
```

### Database Service Example

```typescript
// src/database/services/user.service.ts
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

export class UserService {
  constructor(private prisma: PrismaClient) {}

  async create(data: CreateUserDto) {
    const hashedPassword = await bcrypt.hash(data.password, 10);
    
    return this.prisma.user.create({
      data: {
        ...data,
        password: hashedPassword
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true
      }
    });
  }

  async findByEmail(email: string) {
    return this.prisma.user.findUnique({
      where: { email },
      include: {
        subscription: true
      }
    });
  }

  async updateLastActive(userId: string) {
    return this.prisma.user.update({
      where: { id: userId },
      data: { lastActiveAt: new Date() }
    });
  }
}
```

## AI Provider Integration

### Creating a New Provider

1. **Implement Provider Interface**:
```typescript
// src/ai-providers/interfaces/provider.interface.ts
export interface AIProvider {
  chat(messages: Message[], options?: ChatOptions): Promise<ChatResponse>;
  validateApiKey(): Promise<boolean>;
  getAvailableModels(): string[];
  estimateTokens(text: string): number;
  calculateCost(usage: TokenUsage, model: string): number;
}
```

2. **Provider Implementation**:
```typescript
// src/ai-providers/custom/custom.provider.ts
export class CustomProvider implements AIProvider {
  constructor(private config: ProviderConfig) {}

  async chat(messages: Message[], options?: ChatOptions): Promise<ChatResponse> {
    const response = await fetch(this.config.endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        messages,
        model: options?.model || 'default',
        temperature: options?.temperature || 0.7
      })
    });

    const data = await response.json();
    
    return {
      content: data.content,
      usage: {
        promptTokens: data.usage.input,
        completionTokens: data.usage.output,
        totalTokens: data.usage.total
      }
    };
  }

  async validateApiKey(): Promise<boolean> {
    try {
      await this.chat([{ role: 'user', content: 'test' }]);
      return true;
    } catch {
      return false;
    }
  }
}
```

3. **Register Provider**:
```typescript
// src/ai-providers/registry.ts
import { OpenAIProvider } from './openai/openai.provider';
import { AnthropicProvider } from './anthropic/anthropic.provider';
import { CustomProvider } from './custom/custom.provider';

export class ProviderRegistry {
  private providers = new Map<string, AIProvider>();

  constructor() {
    this.register('openai', new OpenAIProvider(process.env.OPENAI_API_KEY));
    this.register('anthropic', new AnthropicProvider(process.env.ANTHROPIC_API_KEY));
    this.register('custom', new CustomProvider({ /* config */ }));
  }

  register(name: string, provider: AIProvider) {
    this.providers.set(name, provider);
  }

  get(name: string): AIProvider {
    const provider = this.providers.get(name);
    if (!provider) throw new Error(`Provider ${name} not found`);
    return provider;
  }
}
```

## Testing Strategy

### Unit Tests

```typescript
// tests/unit/services/chat.service.test.ts
import { ChatService } from '../../../src/services/chat.service';
import { PrismaClient } from '@prisma/client';

describe('ChatService', () => {
  let service: ChatService;
  let mockPrisma: jest.Mocked<PrismaClient>;

  beforeEach(() => {
    mockPrisma = createMockPrisma();
    service = new ChatService(mockPrisma);
  });

  describe('createChat', () => {
    it('should create a new chat', async () => {
      const chatData = {
        userId: 'user123',
        title: 'Test Chat',
        provider: 'openai',
        model: 'gpt-4'
      };

      mockPrisma.chat.create.mockResolvedValue({
        id: 'chat123',
        ...chatData
      });

      const result = await service.createChat(chatData);

      expect(result).toHaveProperty('id');
      expect(result.title).toBe('Test Chat');
      expect(mockPrisma.chat.create).toHaveBeenCalledWith({
        data: chatData
      });
    });
  });
});
```

### Integration Tests

```typescript
// tests/integration/api/auth.test.ts
import request from 'supertest';
import { app } from '../../../src/app';

describe('Auth API', () => {
  describe('POST /api/auth/register', () => {
    it('should register a new user', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'test@example.com',
          password: 'SecurePass123!',
          name: 'Test User'
        });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('token');
      expect(response.body.user.email).toBe('test@example.com');
    });
  });
});
```

### E2E Tests

```typescript
// tests/e2e/specs/chat.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Chat Flow', () => {
  test('should complete full chat interaction', async ({ page }) => {
    // Login
    await page.goto('/login');
    await page.fill('[name="email"]', 'test@example.com');
    await page.fill('[name="password"]', 'password');
    await page.click('button[type="submit"]');

    // Create chat
    await page.click('[data-testid="new-chat"]');
    await page.selectOption('[data-testid="provider"]', 'openai');
    
    // Send message
    await page.fill('[data-testid="message-input"]', 'Hello');
    await page.click('[data-testid="send"]');
    
    // Verify response
    await expect(page.locator('.ai-response')).toBeVisible();
  });
});
```

### Running Tests

```bash
# Unit tests
npm run test:unit

# Integration tests
npm run test:integration

# E2E tests
npm run test:e2e

# All tests with coverage
npm run test:coverage

# Watch mode
npm run test:watch
```

## Deployment

### Production Build

```bash
# Build application
npm run build

# Run production server
npm run start

# Health check
curl http://localhost:3000/health
```

### Docker Deployment

```dockerfile
# Dockerfile
FROM node:18-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build
RUN npm prune --production

FROM node:18-alpine

WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./

EXPOSE 3000
CMD ["node", "dist/index.js"]
```

### CI/CD Pipeline

```yaml
# .github/workflows/deploy.yml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: npm run test
      - run: npm run build

  deploy:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Deploy to production
        run: |
          # Your deployment script
          echo "Deploying to production"
```

### Environment Configuration

```bash
# Production environment
NODE_ENV=production
DATABASE_URL=postgresql://user:pass@prod-db:5432/vivier
REDIS_URL=redis://prod-redis:6379
LOG_LEVEL=info
ENABLE_METRICS=true
```

### Monitoring

```typescript
// src/utils/monitoring.ts
import * as Sentry from '@sentry/node';
import { ProfilingIntegration } from '@sentry/profiling-node';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  integrations: [
    new ProfilingIntegration()
  ],
  tracesSampleRate: 0.1,
  profilesSampleRate: 0.1
});

// Custom metrics
export const metrics = {
  incrementCounter(name: string, tags?: Record<string, string>) {
    // Send to monitoring service
  },
  
  recordDuration(name: string, duration: number) {
    // Record timing metric
  }
};
```

## Contributing

### Development Workflow

1. **Fork the repository**
2. **Create feature branch**: `git checkout -b feature/amazing-feature`
3. **Make changes**
4. **Write/update tests**
5. **Run tests**: `npm test`
6. **Commit changes**: `git commit -m 'Add amazing feature'`
7. **Push branch**: `git push origin feature/amazing-feature`
8. **Open Pull Request**

### Code Style

We use ESLint and Prettier for code formatting:

```bash
# Lint code
npm run lint

# Fix linting issues
npm run lint:fix

# Format code
npm run format
```

### Commit Guidelines

Follow Conventional Commits:

```
feat: add new chat export feature
fix: resolve memory leak in websocket connection
docs: update API documentation
style: format code with prettier
refactor: simplify auth middleware
test: add tests for chat service
chore: update dependencies
```

### Pull Request Template

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
- [ ] Unit tests pass
- [ ] Integration tests pass
- [ ] Manual testing completed

## Checklist
- [ ] Code follows style guidelines
- [ ] Self-review completed
- [ ] Documentation updated
- [ ] No new warnings
```

---

For more information, visit our [GitHub repository](https://github.com/your-org/vivier) or contact the development team.