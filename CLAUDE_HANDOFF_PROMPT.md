# Claude Handoff Prompt - Fix TypeScript API

## Your Mission

You are taking over a project that needs its main TypeScript API fixed and deployed. A temporary JavaScript API is currently running, but the goal is to get the full-featured TypeScript API working and deployed to replace it.

## Current System State

### What's Working ✅
1. **Database**: 
   - Supabase PostgreSQL fully configured
   - All tables created and functional
   - Users table tested and working
   - Credentials in `.env.deployment`

2. **Simple API** (Temporary):
   - JavaScript/Express server at https://vivier-api-s7xwcum6vq-uc.a.run.app
   - Basic auth and database connectivity working
   - Keeping frontend functional while main API is fixed

3. **Frontend**:
   - Next.js app deployed to Vercel
   - Currently using simple API
   - Ready to switch to main API once deployed

### What Needs Fixing 🔧
1. **Main TypeScript API** (`/api-server/`):
   - Multiple TypeScript compilation errors
   - Full features ready but not compiling
   - Needs to be fixed and deployed

## Your Primary Task: Fix the TypeScript API

### Step 1: Assess Current Errors
```bash
cd api-server
npm install
npm run build  # This will show all TypeScript errors
```

### Step 2: Priority Files to Fix

**High Priority - Core Functionality:**
1. `/api-server/src/services/ai/groq.service.ts` - AI responses
2. `/api-server/src/controllers/auth.controller.ts` - Authentication
3. `/api-server/src/services/database/database.service.ts` - Database connection

**Medium Priority - Email Features:**
4. `/api-server/src/services/email/gmail.service.ts` - Gmail integration
5. `/api-server/src/services/email/outlook.service.ts` - Outlook integration
6. `/api-server/src/controllers/email.controller.ts` - Email endpoints

**Low Priority - Optional Features:**
7. `/api-server/src/services/whatsapp/whatsapp.service.ts` - WhatsApp bot
8. `/api-server/src/services/ai/openai.service.ts` - OpenAI integration

### Step 3: Common Fixes Needed

1. **Import Path Issues**: Change absolute to relative imports
2. **Missing Type Definitions**: Install @types packages
3. **Async Function Types**: Add proper Promise<T> return types
4. **Database Integration**: Connect to existing Supabase instance

### Step 4: Test Locally
```bash
# After fixing compilation errors
npm run build
npm run dev

# Test endpoints
curl http://localhost:8080/health
curl -X POST http://localhost:8080/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"test123"}'
```

### Step 5: Deploy to Cloud Run
```bash
# Once TypeScript errors are fixed
cd ..
./deployment/gcp/deploy-api.sh

# Or deploy directly:
gcloud run deploy vivier-api-main \
  --source api-server \
  --region=us-central1 \
  --allow-unauthenticated \
  --set-env-vars-from-file=.env.deployment
```

## Key Information

### Database Connection
- Supabase is ready with all tables created
- Use credentials from `.env.deployment`
- No schema changes needed
- Connect using @supabase/supabase-js

### Environment Variables
All working credentials in `.env.deployment`:
- `SUPABASE_URL` ✅
- `SUPABASE_SERVICE_KEY` ✅
- `JWT_SECRET` ✅
- `GROQ_API_KEY` ✅
- `OPENAI_API_KEY` (optional)

### Testing Commands
```bash
# Check TypeScript compilation
cd api-server && npm run build

# Run locally
npm run dev

# Check deployed API health
curl https://vivier-api-main-xxxxx.run.app/health

# Test AI generation (after getting token from login)
curl -X POST https://vivier-api-main-xxxxx.run.app/api/ai/generate \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"prompt":"Test email response","style":"professional"}'
```

## Success Criteria

1. ✅ TypeScript compiles without errors
2. ✅ API starts locally and connects to Supabase
3. ✅ Authentication endpoints work
4. ✅ AI generation produces real responses (using Groq)
5. ✅ API deploys successfully to Cloud Run
6. ✅ Frontend can connect to new API

## Approach Recommendations

1. **Start Small**: Fix compilation errors first, don't add features
2. **Test Incrementally**: Test each service as you fix it
3. **Use Simple API as Reference**: The JavaScript API shows what works
4. **Disable Optional Features**: Comment out WhatsApp/Email OAuth if blocking
5. **Focus on Core**: Auth + AI + Database are priority

## Quick Wins

1. **Fix Import Paths**: Most errors are likely import related
2. **Install Missing Types**: `npm install --save-dev @types/...`
3. **Update Database Config**: Point to Supabase instead of local
4. **Simplify Complex Services**: Stub out email services initially

## Files to Check First

```bash
# See main compilation errors
cd api-server && npm run build 2>&1 | head -50

# Check current package.json for scripts
cat api-server/package.json

# Review main server file
cat api-server/src/index.ts

# Check database configuration
cat api-server/src/config/database.config.ts
```

## Deployment Validation

After deployment, verify:
```bash
# 1. Health check passes
curl https://vivier-api-main-xxxxx.run.app/health

# 2. Can create user
curl -X POST https://vivier-api-main-xxxxx.run.app/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"deploy@test.com","password":"test123"}'

# 3. Check in Supabase dashboard
# Go to: https://supabase.com/dashboard/project/ftkricctldivgsdenegs
# Check users table for new user

# 4. AI generation works
# (Use token from login response)
```

## Important Notes

- Database is ready - no migration needed
- Simple API stays running as fallback
- Don't modify simple API code
- Focus on TypeScript API only
- Email OAuth can be added later
- WhatsApp bot is optional

## Emergency Rollback

If something goes wrong:
- Simple API continues working at current URL
- Frontend stays connected to simple API
- No data loss (same database)
- Can iterate on fixes without downtime

Remember: The goal is to get the TypeScript API working with its full feature set. The simple API proves the infrastructure works - now we need the complete solution deployed.