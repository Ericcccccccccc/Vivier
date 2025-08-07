# Database Layer - Vivier Email AI Assistant

A modular, type-safe database abstraction layer with Supabase as the primary implementation. This layer is designed to be completely swappable - any database (Firebase, MongoDB, PostgreSQL) can implement the same interface without changing business logic.

## Features

- 🔄 **Modular Architecture**: Swap database providers without changing application code
- 🔒 **Type Safety**: Full TypeScript coverage with strict typing
- 🛡️ **Error Recovery**: Comprehensive error handling with retry logic
- 🚀 **Real-time Support**: Built-in subscriptions for live updates
- 📊 **Usage Tracking**: Monitor and limit resource usage per tier
- 🔐 **Security First**: Row-level security, encryption, and authentication
- ⚡ **Performance**: Connection pooling, caching, and optimized queries
- 🧪 **Fully Tested**: Comprehensive test suite with mocking support

## Installation

```bash
# Clone the repository
git clone https://github.com/vivier/database-layer.git

# Install dependencies
cd database-layer
npm install

# Copy environment variables
cp .env.example .env

# Configure your Supabase credentials in .env
```

## Quick Start

```typescript
import { createDatabaseAdapter } from '@vivier/database-layer';

// Create adapter instance
const db = createDatabaseAdapter('supabase', {
  url: process.env.SUPABASE_URL,
  anonKey: process.env.SUPABASE_ANON_KEY,
  serviceKey: process.env.SUPABASE_SERVICE_KEY,
});

// Connect to database
await db.connect();

// Create a user
const user = await db.createUser({
  email: 'user@example.com',
  subscription_tier: 'free',
});

// Add email account
const account = await db.addEmailAccount(user.id, {
  email_address: 'user@gmail.com',
  provider: 'gmail',
  encrypted_credentials: encryptedCreds,
});

// Create email record
const email = await db.createEmail({
  account_id: account.id,
  message_id: 'msg-123',
  subject: 'Hello World',
  from_address: 'sender@example.com',
  to_addresses: ['user@gmail.com'],
  body_text: 'Email content',
  received_at: new Date(),
});

// Generate AI response
const response = await db.saveAIResponse({
  email_id: email.id,
  response_text: 'Thank you for your email...',
  model_used: 'gpt-4',
  confidence_score: 0.95,
  tokens_used: 150,
  response_time_ms: 1200,
});

// Subscribe to real-time updates
const unsubscribe = db.subscribeToEmails(account.id, (newEmail) => {
  console.log('New email received:', newEmail);
});

// Clean up
unsubscribe();
await db.disconnect();
```

## Database Schema

### Core Tables

- **users**: User accounts with settings and subscription tiers
- **email_accounts**: Multiple email accounts per user
- **emails**: Email messages with full metadata
- **ai_responses**: Generated AI responses with metrics
- **response_templates**: Reusable response templates
- **notification_logs**: Notification history and status
- **usage_metrics**: Usage tracking for billing/limits

### Security

- Row Level Security (RLS) enabled on all tables
- Service key for backend operations
- Anon key for frontend with RLS
- Encrypted credentials storage
- Audit logging for all operations

## Configuration

### Environment Variables

```bash
# Required
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key

# Optional (for backend operations)
SUPABASE_SERVICE_KEY=your-service-key

# Configuration
NODE_ENV=development
LOG_LEVEL=info
DATABASE_POOL_MIN=2
DATABASE_POOL_MAX=10
DATABASE_RETRY_ATTEMPTS=3
DATABASE_RETRY_BACKOFF_MS=1000
```

### Usage Limits

```typescript
// Free tier limits (per month)
FREE_TIER_LIMITS = {
  ai_calls: 100,
  emails_processed: 1000,
  storage_used: 100MB,
  templates_created: 10,
};

// Pro tier limits (per month)
PRO_TIER_LIMITS = {
  ai_calls: 1000,
  emails_processed: 10000,
  storage_used: 1GB,
  templates_created: 100,
};

// Enterprise tier - unlimited
```

## Scripts

```bash
# Development
npm run dev              # Watch mode
npm run build           # Build TypeScript

# Database
npm run db:migrate      # Run migrations
npm run db:seed         # Seed test data
npm run db:reset        # Reset and seed

# Testing
npm test                # Run tests
npm run test:watch      # Watch mode
npm run test:coverage   # Coverage report
npm run test:connection # Test database connection

# Code Quality
npm run lint            # ESLint
npm run format          # Prettier
```

## API Reference

### DatabaseAdapter Interface

The main interface that all database implementations must follow:

```typescript
interface DatabaseAdapter {
  // Connection Management
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  healthCheck(): Promise<boolean>;

  // User Operations
  createUser(data: CreateUserInput): Promise<User>;
  getUser(id: string): Promise<User | null>;
  getUserByEmail(email: string): Promise<User | null>;
  updateUser(id: string, data: UpdateUserInput): Promise<User>;
  deleteUser(id: string): Promise<void>;

  // Email Operations
  createEmail(data: CreateEmailInput): Promise<Email>;
  getEmails(accountId: string, options?: QueryOptions): Promise<PaginatedResult<Email>>;
  markEmailProcessed(id: string): Promise<void>;

  // AI Response Operations
  saveAIResponse(data: AIResponseInput): Promise<AIResponse>;
  getAIResponse(emailId: string): Promise<AIResponse | null>;

  // Real-time Subscriptions
  subscribeToEmails(accountId: string, callback: (email: Email) => void): () => void;
  
  // Transactions
  transaction<T>(callback: (trx: DatabaseAdapter) => Promise<T>): Promise<T>;
}
```

## Error Handling

```typescript
try {
  await db.createUser(userData);
} catch (error) {
  if (error instanceof DuplicateError) {
    // Handle duplicate email
  } else if (error instanceof ValidationError) {
    // Handle validation errors
  } else if (isRetryableError(error)) {
    // Retry with backoff
    const delay = getRetryDelay(error, attemptNumber);
    await sleep(delay);
    // Retry operation
  }
}
```

## Testing

```typescript
import { SupabaseAdapter } from '@vivier/database-layer';
import { jest } from '@jest/globals';

// Mock Supabase client
jest.mock('@supabase/supabase-js');

// Create test instance
const adapter = new SupabaseAdapter(mockConfig);

// Test operations
describe('User Operations', () => {
  it('should create user', async () => {
    const user = await adapter.createUser({
      email: 'test@example.com',
    });
    expect(user.email).toBe('test@example.com');
  });
});
```

## Creating a New Adapter

To implement a new database adapter (e.g., Firebase):

```typescript
import { DatabaseAdapter } from '@vivier/database-layer';

export class FirebaseAdapter implements DatabaseAdapter {
  constructor(private config: FirebaseConfig) {
    // Initialize Firebase
  }

  async connect(): Promise<void> {
    // Connect to Firebase
  }

  async createUser(data: CreateUserInput): Promise<User> {
    // Firebase implementation
  }

  // Implement all other methods...
}
```

## Migration System

```sql
-- migrations/001_initial.sql
CREATE TABLE users (
  id UUID PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  -- ...
);
```

```typescript
// Run migrations
import { MigrationRunner } from '@vivier/database-layer';

const runner = new MigrationRunner(db);
await runner.run();
```

## Performance Tips

1. **Use batch operations** for bulk inserts
2. **Enable connection pooling** in production
3. **Add indexes** on frequently queried columns
4. **Use selective queries** - only fetch needed fields
5. **Implement caching** for frequently accessed data
6. **Monitor usage metrics** to optimize queries

## Security Best Practices

1. **Always use parameterized queries** to prevent SQL injection
2. **Enable RLS** on all tables
3. **Encrypt sensitive data** before storage
4. **Use service keys** only in backend
5. **Implement rate limiting** to prevent abuse
6. **Audit all operations** for compliance
7. **Rotate keys regularly** in production

## Troubleshooting

### Connection Issues

```bash
# Test connection
npm run test:connection

# Check environment variables
echo $SUPABASE_URL
echo $SUPABASE_ANON_KEY
```

### Migration Failures

```bash
# Reset database
npm run db:reset

# Run migrations manually
npm run db:migrate
```

### Performance Issues

```typescript
// Enable query logging
const adapter = new SupabaseAdapter({
  ...config,
  debug: true,
});

// Check database stats
const stats = await db.getStats();
console.log('Database stats:', stats);
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Write tests for new features
4. Ensure all tests pass
5. Submit a pull request

## License

MIT License - See LICENSE file for details

## Support

- Documentation: [https://docs.vivier.ai/database](https://docs.vivier.ai/database)
- Issues: [GitHub Issues](https://github.com/vivier/database-layer/issues)
- Discord: [Join our community](https://discord.gg/vivier)

## Roadmap

- [ ] Add Firebase adapter
- [ ] Add MongoDB adapter
- [ ] Add PostgreSQL native adapter
- [ ] Implement data encryption layer
- [ ] Add data export/import utilities
- [ ] Create admin dashboard
- [ ] Add GraphQL support
- [ ] Implement caching layer
- [ ] Add monitoring and analytics