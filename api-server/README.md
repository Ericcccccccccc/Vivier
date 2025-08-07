# Email AI API Server

Production-ready Express.js API server for the Email AI system, designed to run on Google Cloud Run.

## Features

- 🔐 JWT-based authentication with refresh tokens
- 🚀 RESTful API design
- 📧 Email management and processing
- 🤖 AI-powered email responses
- ⚡ Rate limiting and usage tracking
- 🐳 Docker containerized
- 📊 Health checks and metrics
- 🔄 Auto-scaling on Cloud Run

## Quick Start

1. **Clone and install:**
```bash
cd api-server
npm install
```

2. **Configure environment:**
```bash
cp .env.example .env
# Edit .env with your credentials
```

3. **Run development server:**
```bash
npm run dev
```

4. **Run tests:**
```bash
npm test
```

## API Documentation

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `POST /api/auth/refresh` - Refresh access token
- `POST /api/auth/logout` - Logout and invalidate tokens

### Emails
- `GET /api/emails` - List emails (paginated)
- `GET /api/emails/:id` - Get email details
- `POST /api/emails/:id/process` - Process email with AI
- `DELETE /api/emails/:id` - Delete email

### AI
- `POST /api/ai/generate` - Generate AI response
- `POST /api/ai/analyze` - Analyze email content
- `GET /api/ai/templates` - Get response templates

### User
- `GET /api/user/profile` - Get user profile
- `PATCH /api/user/profile` - Update profile
- `GET /api/user/usage` - Get usage statistics

## Deployment

### Build Docker Image
```bash
docker build -t email-ai-api .
```

### Deploy to Cloud Run
```bash
gcloud run deploy email-ai-api \
  --image gcr.io/[PROJECT-ID]/email-ai-api \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated
```

## Architecture

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Client    │────▶│   Express   │────▶│  Supabase   │
└─────────────┘     │     API     │     └─────────────┘
                    └─────────────┘
                           │
                           ▼
                    ┌─────────────┐
                    │  Groq AI    │
                    └─────────────┘
```

## Security

- Helmet.js for security headers
- Rate limiting on all endpoints
- JWT token expiration
- Input validation with Zod
- SQL injection prevention
- XSS protection

## License

MIT