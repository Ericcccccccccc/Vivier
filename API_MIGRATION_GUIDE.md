# Vivier API Migration Guide - TypeScript API Focus

## Current Architecture Overview

This project has TWO different API implementations:

### 1. Simple API (`/api-simple/`) - TEMPORARY SOLUTION ✅
- **Location**: `/api-simple/index.js`
- **Language**: Plain JavaScript (Node.js + Express)
- **Status**: Working and deployed to Cloud Run
- **URL**: https://vivier-api-s7xwcum6vq-uc.a.run.app
- **Purpose**: Temporary API to keep frontend working while main API is fixed
- **Database**: ✅ Supabase tables created and working (users table confirmed)

### 2. Main API (`/api-server/`) - TARGET FOR DEPLOYMENT 🎯
- **Location**: `/api-server/src/`
- **Language**: TypeScript
- **Status**: Has compilation errors that need fixing
- **Features**: Full functionality including:
  - Gmail/Outlook email integration
  - WhatsApp bot integration
  - Real AI providers (Groq, OpenAI)
  - Advanced authentication with Passport
  - TypeORM for database management
  - Comprehensive error handling
  - Testing infrastructure

## Current Status

### What's Working ✅
1. **Database**: Supabase tables are created and functional
   - Users table confirmed working with simple API
   - All required tables exist in Supabase
   - Connection credentials in `.env.deployment`

2. **Simple API**: Deployed and running as temporary solution
   - Basic auth working
   - Connected to Supabase database
   - Keeping frontend functional

3. **Frontend**: Deployed to Vercel
   - Currently using simple API
   - Will need URL update once main API is deployed

### What Needs Fixing 🔧
1. **TypeScript Compilation Errors** in `/api-server/`
2. **Deploy Main API** to Cloud Run
3. **Update Frontend** to use main API URL

## Task: Fix and Deploy the TypeScript API

### Step 1: Identify TypeScript Errors
```bash
cd api-server
npm install
npm run build  # This will show all compilation errors
```

### Step 2: Main Files Requiring Fixes

#### Priority 1 - Core Services
- `/api-server/src/services/email/gmail.service.ts`
- `/api-server/src/services/email/outlook.service.ts`
- `/api-server/src/services/ai/groq.service.ts`
- `/api-server/src/services/ai/openai.service.ts`

#### Priority 2 - Controllers
- `/api-server/src/controllers/auth.controller.ts`
- `/api-server/src/controllers/email.controller.ts`
- `/api-server/src/controllers/ai.controller.ts`

#### Priority 3 - Additional Services
- `/api-server/src/services/whatsapp/whatsapp.service.ts`
- `/api-server/src/services/database/database.service.ts`

### Step 3: Common TypeScript Issues to Fix

1. **Import Path Issues**
   ```typescript
   // Wrong
   import { Something } from 'src/services/...'
   
   // Correct
   import { Something } from '../services/...'
   ```

2. **Type Definition Issues**
   ```typescript
   // Add proper type definitions
   interface EmailData {
     from: string;
     to: string;
     subject: string;
     body: string;
   }
   ```

3. **Async/Await Issues**
   ```typescript
   // Ensure async functions return Promise<T>
   async function fetchEmails(): Promise<Email[]> {
     // implementation
   }
   ```

4. **Missing Dependencies**
   ```bash
   # Install missing type definitions
   npm install --save-dev @types/node @types/express @types/passport
   ```

### Step 4: Database Configuration

Update `/api-server/src/config/database.config.ts` to use Supabase:
```typescript
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

export const supabase = createClient(supabaseUrl, supabaseServiceKey);
```

### Step 5: Deploy the Fixed API

1. **Create Dockerfile** (if not exists):
```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build
EXPOSE 8080
CMD ["npm", "start"]
```

2. **Deploy to Cloud Run**:
```bash
# Use existing deployment script
./deployment/gcp/deploy-api.sh

# Or deploy directly:
gcloud run deploy vivier-api-main \
  --source api-server \
  --region=us-central1 \
  --allow-unauthenticated \
  --set-env-vars-from-file=.env.deployment \
  --min-instances=0 \
  --max-instances=10
```

### Step 6: Update Frontend Configuration

Once main API is deployed:
1. Get the new API URL from Cloud Run
2. Update `/web-app/.env.production`:
   ```
   NEXT_PUBLIC_API_URL=https://vivier-api-main-xxxxx.run.app
   ```
3. Redeploy frontend to Vercel

## Environment Variables Required

All credentials are in `.env.deployment`:
- `SUPABASE_URL` ✅ (Working)
- `SUPABASE_SERVICE_KEY` ✅ (Working)
- `SUPABASE_ANON_KEY` ✅ (Working)
- `JWT_SECRET` ✅
- `GROQ_API_KEY` ✅
- `OPENAI_API_KEY` (Optional)
- Gmail OAuth credentials (to be configured)
- Outlook OAuth credentials (to be configured)

## Testing After Deployment

1. **Health Check**:
```bash
curl https://vivier-api-main-xxxxx.run.app/health
```

2. **Authentication**:
```bash
# Register
curl -X POST https://vivier-api-main-xxxxx.run.app/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"test123","name":"Test User"}'

# Login
curl -X POST https://vivier-api-main-xxxxx.run.app/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"test123"}'
```

3. **AI Generation**:
```bash
curl -X POST https://vivier-api-main-xxxxx.run.app/api/ai/generate \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"prompt":"Write a professional email response","style":"professional"}'
```

## Migration Timeline

1. **Phase 1** (Immediate):
   - Fix TypeScript compilation errors
   - Ensure database connectivity
   - Test locally

2. **Phase 2** (Day 1):
   - Deploy main API to Cloud Run
   - Test all endpoints
   - Monitor logs for errors

3. **Phase 3** (Day 2):
   - Update frontend to use new API
   - Full end-to-end testing
   - Decommission simple API

## Key Differences from Simple API

| Feature | Simple API | Main API (Target) |
|---------|------------|-------------------|
| Language | JavaScript | TypeScript |
| Email Integration | Mock data | Real Gmail/Outlook |
| AI Responses | Static/Basic Groq | Full Groq/OpenAI |
| Authentication | Basic JWT | Passport + Strategies |
| Database | Direct Supabase | TypeORM + Supabase |
| Error Handling | Basic | Comprehensive |
| Testing | None | Jest + Supertest |
| API Documentation | None | Swagger/OpenAPI |

## Success Criteria

The main API deployment is successful when:
1. ✅ All TypeScript compilation errors are resolved
2. ✅ API deploys successfully to Cloud Run
3. ✅ All endpoints return expected responses
4. ✅ Database operations work correctly
5. ✅ AI generation produces real responses
6. ✅ Frontend works with new API URL
7. ✅ Email integration is functional (can be post-deployment)

## Rollback Plan

If issues arise:
1. Simple API remains deployed as fallback
2. Frontend can quickly switch back via environment variable
3. Database is already working, no data loss risk

## Notes for Developer

- Focus on fixing TypeScript errors first
- Don't worry about perfect implementation initially
- Email OAuth can be configured post-deployment
- WhatsApp bot is optional, can be disabled if causing issues
- The simple API proves the infrastructure works
- Database is ready and tested - no schema changes needed