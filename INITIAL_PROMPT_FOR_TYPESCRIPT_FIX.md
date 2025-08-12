# Initial Prompt for New Claude Instance

Copy and paste this entire prompt to a new Claude instance to begin fixing the TypeScript API:

---

I need help fixing and deploying a TypeScript API for an email AI assistant project called Vivier. The project has a temporary JavaScript API running, but I need the full-featured TypeScript API fixed and deployed.

## Current Situation:
- **Working**: Supabase database with all tables created, temporary JavaScript API deployed and running
- **Not Working**: Main TypeScript API in `/api-server/` has compilation errors preventing deployment
- **Goal**: Fix TypeScript compilation errors and deploy the main API to Google Cloud Run

## Project Structure:
- `/api-server/` - Main TypeScript API (needs fixing)
- `/api-simple/` - Temporary JavaScript API (working, don't modify)
- `/web-app/` - Frontend (deployed to Vercel)
- `.env.deployment` - All credentials and environment variables
- `/API_MIGRATION_GUIDE.md` - Detailed migration instructions
- `/CLAUDE_HANDOFF_PROMPT.md` - Complete context and steps

## First Actions Needed:
1. Read the `/CLAUDE_HANDOFF_PROMPT.md` file for complete context
2. Check TypeScript compilation errors: `cd api-server && npm install && npm run build`
3. Start fixing compilation errors in priority order (auth, AI, database first)
4. Test locally once compilation works
5. Deploy to Cloud Run when ready

## Key Points:
- Database is ready (Supabase tables exist and work)
- All credentials are in `.env.deployment`
- Focus on fixing TypeScript errors, not adding features
- Simple API remains as fallback if needed
- Priority is getting core features working (auth + AI + database)

Please start by reading the handoff prompt and then checking the TypeScript compilation errors. The goal is to have a working TypeScript API deployed to Cloud Run that can replace the temporary JavaScript API.

Can you help me fix the TypeScript API and get it deployed?