# Vivier Architecture Documentation

## Table of Contents
1. [System Overview](#system-overview)
2. [Core Components](#core-components)
3. [Data Flow](#data-flow)
4. [Security Architecture](#security-architecture)
5. [Scalability Design](#scalability-design)
6. [Technology Decisions](#technology-decisions)
7. [Infrastructure](#infrastructure)
8. [Performance Optimization](#performance-optimization)
9. [Disaster Recovery](#disaster-recovery)
10. [Future Considerations](#future-considerations)

## System Overview

### High-Level Architecture

Vivier follows a microservices-oriented architecture with clear separation of concerns:

```
┌────────────────────────────────────────────────────────────┐
│                         Load Balancer                       │
│                    (AWS ALB / CloudFlare)                   │
└────────────────────────┬───────────────────────────────────┘
                         │
┌────────────────────────┼───────────────────────────────────┐
│                        │                                    │
│                   API Gateway                               │
│              (Rate Limiting, Auth)                          │
│                        │                                    │
└────────────────────────┼───────────────────────────────────┘
                         │
        ┌────────────────┼────────────────┐
        │                │                │
┌───────▼─────┐  ┌───────▼─────┐  ┌──────▼──────┐
│   Auth      │  │    Chat     │  │   Admin     │
│  Service    │  │   Service   │  │  Service    │
└───────┬─────┘  └───────┬─────┘  └──────┬──────┘
        │                │                │
        └────────────────┼────────────────┘
                         │
     ┌───────────────────┼───────────────────┐
     │                   │                   │
┌────▼────┐      ┌───────▼────────┐   ┌─────▼─────┐
│         │      │                │   │           │
│  Redis  │      │   PostgreSQL   │   │    S3     │
│  Cache  │      │    Database    │   │  Storage  │
│         │      │                │   │           │
└─────────┘      └────────────────┘   └───────────┘
```

### Design Principles

1. **Separation of Concerns**: Each service handles specific domain logic
2. **Stateless Services**: All state stored in database/cache
3. **API-First Design**: All functionality exposed through REST APIs
4. **Event-Driven Communication**: Services communicate via events
5. **Security by Default**: Zero-trust architecture
6. **Observable System**: Comprehensive logging and monitoring

## Core Components

### API Gateway

**Responsibilities:**
- Request routing
- Authentication/Authorization
- Rate limiting
- Request/Response transformation
- SSL termination
- CORS handling

**Implementation:**
```typescript
// src/gateway/index.ts
export class APIGateway {
  private rateLimiter: RateLimiter;
  private auth: AuthMiddleware;
  private router: Router;

  constructor() {
    this.setupMiddleware();
    this.setupRoutes();
    this.setupErrorHandling();
  }

  private setupMiddleware() {
    this.app.use(cors(corsOptions));
    this.app.use(helmet());
    this.app.use(compression());
    this.app.use(this.rateLimiter.middleware());
    this.app.use(this.auth.verify());
  }
}
```

### Authentication Service

**Architecture:**
```
┌──────────────┐     ┌──────────────┐
│   Client     │────▶│  Auth API    │
└──────────────┘     └──────┬───────┘
                            │
                    ┌───────▼────────┐
                    │  JWT Service   │
                    └───────┬────────┘
                            │
                    ┌───────▼────────┐
                    │   User Store   │
                    │  (PostgreSQL)  │
                    └────────────────┘
```

**Security Features:**
- JWT-based authentication
- Refresh token rotation
- Multi-factor authentication
- OAuth 2.0 integration
- Session management
- Password hashing (bcrypt)

### Chat Service

**Components:**
```
Chat Service
├── Message Queue
│   ├── Incoming messages
│   ├── AI provider requests
│   └── Response processing
├── AI Provider Manager
│   ├── Provider registry
│   ├── Load balancing
│   └── Fallback handling
├── Context Manager
│   ├── Conversation history
│   ├── Token optimization
│   └── Memory management
└── Stream Handler
    ├── WebSocket connections
    ├── SSE streams
    └── Chunked responses
```

**Message Processing Flow:**
```typescript
class ChatService {
  async processMessage(chatId: string, message: Message) {
    // 1. Validate and sanitize input
    const sanitized = this.sanitizer.clean(message);
    
    // 2. Load conversation context
    const context = await this.contextManager.load(chatId);
    
    // 3. Select AI provider
    const provider = this.providerManager.select(message.provider);
    
    // 4. Send to AI provider
    const response = await provider.chat(context, sanitized);
    
    // 5. Process response
    const processed = this.responseProcessor.process(response);
    
    // 6. Store in database
    await this.messageStore.save(chatId, processed);
    
    // 7. Update usage metrics
    await this.metrics.record(response.usage);
    
    // 8. Stream to client
    return this.streamer.send(processed);
  }
}
```

### Database Layer

**Schema Design:**
```sql
-- Core Tables
users (
  id UUID PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  INDEX idx_email (email)
)

chats (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  title VARCHAR(255),
  provider VARCHAR(50),
  model VARCHAR(100),
  created_at TIMESTAMP DEFAULT NOW(),
  INDEX idx_user_archived (user_id, archived)
)

messages (
  id UUID PRIMARY KEY,
  chat_id UUID REFERENCES chats(id),
  role ENUM('user', 'assistant', 'system'),
  content TEXT,
  tokens INTEGER,
  created_at TIMESTAMP DEFAULT NOW(),
  INDEX idx_chat_created (chat_id, created_at)
)

-- Partitioning Strategy
CREATE TABLE messages_2024_01 PARTITION OF messages
FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');
```

### Caching Strategy

**Multi-Level Cache:**
```
┌─────────────┐
│   Browser   │  L1: Local Storage (user preferences)
│    Cache    │
└──────┬──────┘
       │
┌──────▼──────┐
│     CDN     │  L2: Static assets, public data
│    Cache    │
└──────┬──────┘
       │
┌──────▼──────┐
│    Redis    │  L3: Session data, hot data
│    Cache    │
└──────┬──────┘
       │
┌──────▼──────┐
│  PostgreSQL │  L4: Persistent storage
│   Database  │
└─────────────┘
```

**Cache Patterns:**
```typescript
class CacheManager {
  async get<T>(key: string): Promise<T | null> {
    // Try L3 cache first
    const cached = await redis.get(key);
    if (cached) return JSON.parse(cached);
    
    // Fall back to database
    const data = await db.fetch(key);
    if (data) {
      // Write-through cache
      await redis.setex(key, 3600, JSON.stringify(data));
    }
    
    return data;
  }

  async invalidate(pattern: string) {
    const keys = await redis.keys(pattern);
    if (keys.length) {
      await redis.del(...keys);
    }
  }
}
```

## Data Flow

### Request Lifecycle

```
1. Client Request
   ↓
2. CloudFlare CDN (DDoS protection, caching)
   ↓
3. Load Balancer (SSL termination, routing)
   ↓
4. API Gateway (auth, rate limiting)
   ↓
5. Service Router (service discovery)
   ↓
6. Business Logic (service processing)
   ↓
7. Data Layer (database/cache operations)
   ↓
8. Response Processing (formatting, compression)
   ↓
9. Client Response
```

### Real-time Communication

**WebSocket Architecture:**
```
┌──────────┐     ┌────────────┐     ┌──────────┐
│  Client  │────▶│  WS Server │────▶│  Redis   │
│    #1    │     │     #1     │     │  PubSub  │
└──────────┘     └────────────┘     └────┬─────┘
                                          │
┌──────────┐     ┌────────────┐          │
│  Client  │────▶│  WS Server │◀─────────┘
│    #2    │     │     #2     │
└──────────┘     └────────────┘
```

**Event Flow:**
```typescript
class WebSocketManager {
  private connections = new Map<string, WebSocket>();
  private pubsub = new RedisPubSub();

  async handleConnection(ws: WebSocket, userId: string) {
    // Store connection
    this.connections.set(userId, ws);
    
    // Subscribe to user channel
    await this.pubsub.subscribe(`user:${userId}`, (message) => {
      ws.send(JSON.stringify(message));
    });
    
    // Handle messages
    ws.on('message', async (data) => {
      const message = JSON.parse(data);
      await this.processMessage(message, userId);
    });
    
    // Cleanup on disconnect
    ws.on('close', () => {
      this.connections.delete(userId);
      this.pubsub.unsubscribe(`user:${userId}`);
    });
  }
}
```

## Security Architecture

### Defense in Depth

```
Layer 1: Network Security
├── CloudFlare DDoS protection
├── WAF rules
└── IP whitelisting

Layer 2: Application Security
├── JWT authentication
├── RBAC authorization
├── Input validation
└── Output encoding

Layer 3: Data Security
├── Encryption at rest
├── Encryption in transit
├── Key management (AWS KMS)
└── Data masking

Layer 4: Infrastructure Security
├── VPC isolation
├── Security groups
├── Network ACLs
└── Secrets management
```

### Authentication Flow

```typescript
class AuthenticationFlow {
  async login(credentials: LoginDto): Promise<AuthResponse> {
    // 1. Rate limiting check
    await this.rateLimiter.check(credentials.email);
    
    // 2. Validate credentials
    const user = await this.userService.validate(credentials);
    if (!user) throw new UnauthorizedError();
    
    // 3. Check MFA if enabled
    if (user.mfaEnabled) {
      await this.mfaService.verify(credentials.mfaCode);
    }
    
    // 4. Generate tokens
    const accessToken = this.jwt.sign({ userId: user.id }, '15m');
    const refreshToken = this.jwt.sign({ userId: user.id }, '7d');
    
    // 5. Store refresh token
    await this.tokenStore.save(user.id, refreshToken);
    
    // 6. Log authentication event
    await this.auditLog.record({
      event: 'LOGIN',
      userId: user.id,
      ip: credentials.ip,
      userAgent: credentials.userAgent
    });
    
    return { accessToken, refreshToken, user };
  }
}
```

### API Security

**Request Validation:**
```typescript
class SecurityMiddleware {
  validateRequest = async (req: Request) => {
    // CSRF protection
    if (['POST', 'PUT', 'DELETE'].includes(req.method)) {
      this.validateCSRFToken(req);
    }
    
    // Input sanitization
    req.body = this.sanitizer.clean(req.body);
    req.query = this.sanitizer.clean(req.query);
    
    // SQL injection prevention
    this.validateSQLPatterns(req);
    
    // XSS prevention
    this.validateXSSPatterns(req);
    
    // Request size limits
    if (req.headers['content-length'] > MAX_REQUEST_SIZE) {
      throw new PayloadTooLargeError();
    }
  };
}
```

## Scalability Design

### Horizontal Scaling

```
                Load Balancer
                     │
        ┌────────────┼────────────┐
        │            │            │
    Server 1     Server 2     Server 3
        │            │            │
        └────────────┼────────────┘
                     │
              Shared State
            (Redis + PostgreSQL)
```

### Database Scaling

**Read Replicas:**
```
┌─────────────┐
│   Primary   │  Writes
│  PostgreSQL │◀─────────
└──────┬──────┘
       │ Replication
   ┌───┴────┬─────────┐
   │        │         │
┌──▼──┐  ┌──▼──┐  ┌──▼──┐
│Read │  │Read │  │Read │  Reads
│Rep 1│  │Rep 2│  │Rep 3│◀────────
└─────┘  └─────┘  └─────┘
```

**Sharding Strategy:**
```typescript
class ShardManager {
  private shards: Map<string, DatabaseConnection>;

  getShardKey(userId: string): string {
    // Consistent hashing for shard selection
    const hash = crypto.createHash('md5').update(userId).digest('hex');
    const shardIndex = parseInt(hash.substring(0, 8), 16) % this.shards.size;
    return `shard_${shardIndex}`;
  }

  async query(userId: string, sql: string) {
    const shardKey = this.getShardKey(userId);
    const connection = this.shards.get(shardKey);
    return connection.execute(sql);
  }
}
```

### Queue-Based Architecture

```
┌──────────┐     ┌──────────┐     ┌──────────┐
│   API    │────▶│  Queue   │────▶│  Worker  │
│  Server  │     │  (Bull)  │     │   Pool   │
└──────────┘     └──────────┘     └──────────┘
                       │
                 ┌─────┴─────┐
                 │   Redis   │
                 │  Backend  │
                 └───────────┘
```

**Job Processing:**
```typescript
class JobProcessor {
  constructor() {
    this.queue = new Bull('ai-processing', {
      redis: { port: 6379, host: 'redis' },
      defaultJobOptions: {
        removeOnComplete: true,
        removeOnFail: false,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000
        }
      }
    });

    this.setupWorkers();
  }

  private setupWorkers() {
    this.queue.process('chat-completion', 5, async (job) => {
      const { messages, provider, model } = job.data;
      
      try {
        const result = await this.aiProvider.complete({
          messages,
          provider,
          model
        });
        
        return result;
      } catch (error) {
        // Retry with fallback provider
        if (job.attemptsMade < 2) {
          job.data.provider = 'fallback';
        }
        throw error;
      }
    });
  }
}
```

## Technology Decisions

### Technology Stack Rationale

| Component | Technology | Rationale |
|-----------|------------|-----------|
| Runtime | Node.js | Non-blocking I/O, JavaScript ecosystem, good for real-time |
| Framework | Express.js | Mature, flexible, extensive middleware ecosystem |
| Language | TypeScript | Type safety, better IDE support, reduces runtime errors |
| Database | PostgreSQL | ACID compliance, JSON support, full-text search |
| Cache | Redis | In-memory performance, pub/sub, data structures |
| Queue | Bull | Redis-based, reliable, good monitoring |
| ORM | Prisma | Type-safe, migrations, good DX |
| Testing | Jest | Fast, good mocking, wide adoption |
| Monitoring | Sentry + Prometheus | Error tracking + metrics |

### Trade-offs

**PostgreSQL vs NoSQL:**
- Chose PostgreSQL for ACID compliance and relationships
- Trade-off: Less flexible schema, but better data integrity

**Monorepo vs Microservices:**
- Started with modular monolith for faster development
- Can split into microservices as needed
- Trade-off: Simpler deployment vs independent scaling

**REST vs GraphQL:**
- Chose REST for simplicity and caching
- Trade-off: Multiple requests vs over-fetching

## Infrastructure

### AWS Architecture

```
┌─────────────────────────────────────────────┐
│                   Route 53                   │
│                (DNS Management)              │
└─────────────────────┬───────────────────────┘
                      │
┌─────────────────────▼───────────────────────┐
│                CloudFront                    │
│            (CDN + DDoS Protection)           │
└─────────────────────┬───────────────────────┘
                      │
┌─────────────────────▼───────────────────────┐
│          Application Load Balancer           │
│            (SSL + Path Routing)              │
└─────────────────────┬───────────────────────┘
                      │
        ┌─────────────┼─────────────┐
        │             │             │
┌───────▼──────┐ ┌───▼────┐ ┌─────▼──────┐
│   ECS/EKS    │ │  RDS   │ │ ElastiCache│
│  (Compute)   │ │  (DB)  │ │  (Redis)   │
└──────────────┘ └────────┘ └────────────┘
        │             │             │
        └─────────────┼─────────────┘
                      │
              ┌───────▼────────┐
              │      S3        │
              │   (Storage)    │
              └────────────────┘
```

### Container Orchestration

**Kubernetes Configuration:**
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: vivier-api
spec:
  replicas: 3
  selector:
    matchLabels:
      app: vivier-api
  template:
    metadata:
      labels:
        app: vivier-api
    spec:
      containers:
      - name: api
        image: vivier/api:latest
        ports:
        - containerPort: 3000
        env:
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: vivier-secrets
              key: database-url
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
        livenessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
```

### CI/CD Pipeline

```yaml
# .github/workflows/pipeline.yml
name: CI/CD Pipeline

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Run tests
        run: |
          npm ci
          npm run test:ci
          npm run test:e2e

  build:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - name: Build Docker image
        run: |
          docker build -t vivier/api:${{ github.sha }} .
          docker push vivier/api:${{ github.sha }}

  deploy:
    needs: build
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      - name: Deploy to Kubernetes
        run: |
          kubectl set image deployment/vivier-api \
            api=vivier/api:${{ github.sha }}
          kubectl rollout status deployment/vivier-api
```

## Performance Optimization

### Optimization Strategies

**1. Database Optimization:**
```sql
-- Indexes for common queries
CREATE INDEX idx_messages_chat_created 
ON messages(chat_id, created_at DESC);

CREATE INDEX idx_users_email 
ON users(email);

-- Materialized views for analytics
CREATE MATERIALIZED VIEW user_stats AS
SELECT 
  user_id,
  COUNT(DISTINCT chat_id) as total_chats,
  COUNT(*) as total_messages,
  SUM(tokens) as total_tokens
FROM messages
GROUP BY user_id;
```

**2. Query Optimization:**
```typescript
class QueryOptimizer {
  async getChatWithMessages(chatId: string) {
    // Use single query with join instead of N+1
    return this.db.chat.findUnique({
      where: { id: chatId },
      include: {
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 50 // Limit initial load
        },
        _count: {
          select: { messages: true }
        }
      }
    });
  }
}
```

**3. Caching Strategy:**
```typescript
class CacheStrategy {
  private readonly TTL = {
    user: 3600,        // 1 hour
    chat: 1800,        // 30 minutes
    aiResponse: 86400, // 24 hours for identical queries
  };

  async getCached<T>(
    key: string, 
    fetcher: () => Promise<T>,
    ttl?: number
  ): Promise<T> {
    const cached = await redis.get(key);
    if (cached) return JSON.parse(cached);

    const fresh = await fetcher();
    await redis.setex(key, ttl || this.TTL.user, JSON.stringify(fresh));
    
    return fresh;
  }
}
```

**4. Response Compression:**
```typescript
app.use(compression({
  filter: (req, res) => {
    if (req.headers['x-no-compression']) return false;
    return compression.filter(req, res);
  },
  level: 6 // Balance between CPU and compression ratio
}));
```

### Performance Metrics

**Key Metrics to Monitor:**
- P50, P95, P99 response times
- Requests per second (RPS)
- Error rate
- Database query time
- Cache hit ratio
- Memory usage
- CPU utilization

**Monitoring Implementation:**
```typescript
class MetricsCollector {
  private prometheus = new PrometheusClient();

  recordApiCall(endpoint: string, duration: number, status: number) {
    this.prometheus.histogram('api_duration_seconds', duration, {
      endpoint,
      status,
      method: req.method
    });

    this.prometheus.counter('api_requests_total', 1, {
      endpoint,
      status
    });
  }

  recordDatabaseQuery(query: string, duration: number) {
    this.prometheus.histogram('db_query_duration_seconds', duration, {
      query_type: this.getQueryType(query)
    });
  }
}
```

## Disaster Recovery

### Backup Strategy

```
Daily Backups:
├── Database: Full backup to S3
├── Redis: RDB snapshots
└── Application logs: CloudWatch

Weekly Backups:
├── Complete system snapshot
└── Configuration backup

Monthly:
└── Disaster recovery drill
```

### Recovery Procedures

**RTO (Recovery Time Objective): 1 hour**
**RPO (Recovery Point Objective): 1 hour**

```typescript
class DisasterRecovery {
  async performFailover() {
    // 1. Switch DNS to backup region
    await route53.updateRecord({
      name: 'api.vivier.ai',
      target: BACKUP_LOAD_BALANCER
    });

    // 2. Restore database from snapshot
    await rds.restoreFromSnapshot({
      snapshotId: this.getLatestSnapshot(),
      instanceId: 'vivier-db-recovery'
    });

    // 3. Clear and warm cache
    await redis.flushall();
    await this.warmCache();

    // 4. Scale up backup infrastructure
    await ecs.updateService({
      service: 'vivier-api',
      desiredCount: 10
    });

    // 5. Notify team
    await this.notifyOncall('Failover completed');
  }
}
```

## Future Considerations

### Planned Improvements

**Short Term (3 months):**
- Implement GraphQL API alongside REST
- Add support for more AI providers
- Implement federated authentication
- Enhanced caching with Redis Cluster

**Medium Term (6 months):**
- Multi-region deployment
- Event sourcing for audit logs
- Machine learning for usage prediction
- Advanced analytics dashboard

**Long Term (12 months):**
- Kubernetes migration
- Service mesh implementation
- AI model fine-tuning platform
- White-label solution

### Scaling Projections

```
Current: 1K users, 10K requests/day
6 months: 10K users, 100K requests/day
1 year: 50K users, 1M requests/day
2 years: 200K users, 10M requests/day
```

### Architecture Evolution

```
Phase 1 (Current): Modular Monolith
├── Single deployable unit
├── Logical separation of concerns
└── Shared database

Phase 2 (6 months): Service-Oriented
├── Separate services
├── API gateway
└── Shared database

Phase 3 (12 months): Microservices
├── Independent services
├── Service mesh
├── Per-service databases
└── Event-driven architecture
```

---

This architecture is designed to be scalable, maintainable, and secure while providing flexibility for future growth and changes.