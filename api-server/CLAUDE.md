# Express API Server for Google Cloud Run

## Your Mission
Build a production-ready Express.js API that integrates the database and AI layers from previous steps. This API will run on Google Cloud Run (scales to zero, containerized).

## API Architecture Principles

1. **RESTful Design**: Consistent endpoints, proper HTTP methods
2. **Stateless**: No server-side sessions, JWT for auth
3. **Containerized**: Dockerfile optimized for Cloud Run
4. **Error Handling**: Consistent error responses
5. **Rate Limiting**: Protect free tier limits
6. **CORS Ready**: Configurable for frontend domains
7. **Health Checks**: For Cloud Run monitoring
8. **Structured Logging**: JSON logs for Cloud Logging

## API Endpoint Structure
```
GET    /health                     # Health check
GET    /metrics                     # Prometheus metrics

POST   /api/auth/register          # User registration
POST   /api/auth/login             # User login
POST   /api/auth/refresh           # Refresh JWT
POST   /api/auth/logout            # Logout (invalidate)
GET    /api/auth/verify            # Verify token

GET    /api/user/profile           # Get user profile
PATCH  /api/user/profile           # Update profile
GET    /api/user/usage             # Get usage stats
DELETE /api/user/account           # Delete account
GET    /api/user/export            # Export user data (GDPR)

GET    /api/emails                 # List emails (paginated)
GET    /api/emails/:id             # Get single email
POST   /api/emails/:id/process     # Process email with AI
DELETE /api/emails/:id             # Delete email
POST   /api/emails/:id/archive     # Archive email

POST   /api/ai/generate            # Generate response
POST   /api/ai/analyze             # Analyze email
GET    /api/ai/templates           # Get templates
POST   /api/ai/templates           # Create template
DELETE /api/ai/templates/:id       # Delete template
GET    /api/ai/usage               # Get AI usage stats

GET    /api/accounts               # List email accounts
POST   /api/accounts               # Add email account
PATCH  /api/accounts/:id          # Update account
DELETE /api/accounts/:id          # Remove account
POST   /api/accounts/:id/sync     # Trigger sync
GET    /api/accounts/:id/stats    # Get account stats
```

## Key Features Implemented

### Security
- Helmet for security headers
- CORS with configurable origins
- JWT authentication with refresh tokens
- Rate limiting (general, AI, auth)
- Input validation with Zod
- SQL injection prevention via Supabase
- XSS protection

### Performance
- Response compression
- Database connection pooling
- Efficient pagination
- Caching headers
- Graceful shutdown

### Monitoring
- Structured JSON logging with Pino
- Health check endpoint
- Prometheus metrics endpoint
- Error tracking
- Request timing

### Developer Experience
- TypeScript for type safety
- Hot reload in development
- Comprehensive error messages
- API documentation
- Test coverage

## Environment Variables

Required:
- `SUPABASE_URL`: Supabase project URL
- `SUPABASE_SERVICE_KEY`: Service role key
- `GROQ_API_KEY`: Groq API key
- `JWT_SECRET`: 32+ character secret

Optional:
- `PORT`: Server port (default: 8080)
- `NODE_ENV`: Environment (development/production)
- `FRONTEND_URL`: CORS origin
- `LOG_LEVEL`: Logging level

## Running Locally

```bash
# Install dependencies
npm install

# Set up environment
cp .env.example .env
# Edit .env with your values

# Run in development
npm run dev

# Run tests
npm test

# Build for production
npm run build
npm start
```

## Deploying to Cloud Run

```bash
# Build container
docker build -t gcr.io/[PROJECT-ID]/email-ai-api .

# Push to Container Registry
docker push gcr.io/[PROJECT-ID]/email-ai-api

# Deploy to Cloud Run
gcloud run deploy email-ai-api \
  --image gcr.io/[PROJECT-ID]/email-ai-api \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars="NODE_ENV=production" \
  --set-secrets="SUPABASE_URL=supabase-url:latest" \
  --set-secrets="SUPABASE_SERVICE_KEY=supabase-key:latest" \
  --set-secrets="GROQ_API_KEY=groq-key:latest" \
  --set-secrets="JWT_SECRET=jwt-secret:latest"
```

## API Response Formats

### Success Response
```json
{
  "data": { ... },
  "message": "Operation successful",
  "meta": {
    "page": 1,
    "pageSize": 20,
    "total": 100,
    "totalPages": 5
  }
}
```

### Error Response
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid email format",
    "details": [...]
  },
  "timestamp": "2024-01-20T10:30:00Z",
  "path": "/api/auth/register"
}
```

## Rate Limits

- General API: 100 requests/minute
- AI endpoints: 10 requests/minute
- Auth endpoints: 5 requests/15 minutes

Headers returned:
- `X-RateLimit-Limit`: Request limit
- `X-RateLimit-Remaining`: Remaining requests
- `X-RateLimit-Reset`: Reset time

## Testing Strategy

- Unit tests for services
- Integration tests for routes
- Mock database and AI providers
- Test rate limiting
- Test error handling
- Test authentication flow

## Security Considerations

1. Never log sensitive data
2. Sanitize all inputs
3. Use parameterized queries
4. Implement CSRF protection
5. Regular dependency updates
6. Security headers via Helmet
7. JWT token expiration
8. Refresh token rotation

## Monitoring & Alerting

- Cloud Logging for centralized logs
- Cloud Monitoring for metrics
- Uptime checks on /health
- Alert on high error rates
- Alert on rate limit hits
- Track API usage per user

## Scaling Considerations

- Cloud Run auto-scaling
- Database connection pooling
- Implement caching layer
- Queue for heavy operations
- CDN for static assets
- Read replicas for database

## Next Steps

1. Add WebSocket support for real-time updates
2. Implement email webhook receiver
3. Add OAuth2 for email providers
4. Create admin dashboard API
5. Add GraphQL endpoint
6. Implement API versioning