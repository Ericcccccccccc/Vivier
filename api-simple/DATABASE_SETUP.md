# Database Setup Instructions

## Quick Setup (Drop & Recreate)

Since your database is empty, this is the safest approach:

### Step 1: Open Supabase SQL Editor
1. Go to https://app.supabase.com/project/ftkricctldivgsdenegs/sql/new
2. You'll see the SQL editor

### Step 2: Drop ALL Existing Tables
Run this first to clean everything:

```sql
-- Drop ALL existing tables from previous setup
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;

-- Restore default permissions
GRANT ALL ON SCHEMA public TO postgres;
GRANT ALL ON SCHEMA public TO public;
```

### Step 3: Run the Schema File
Copy the entire contents of `supabase-schema.sql` and paste into the SQL editor, then click "Run".

### Step 4: Verify Tables Were Created
After running, you should see these tables in your Supabase dashboard:
- `users` - User accounts
- `sessions` - Auth sessions
- `emails` - Email messages
- `templates` - Response templates
- `ai_responses` - AI-generated responses

### Step 5: Test Locally
```bash
cd api-simple
npm install
npm start
```

You should see:
```
✅ Connected to Supabase - users table exists
✅ Connected to Supabase - sessions table exists
✅ Supabase connection established
Server running on port 8080
```

### Step 6: Deploy to Cloud Run
```bash
cd ..
./deployment/gcp/deploy-simple-api.sh
```

## Testing the Connection

### Create a test user:
```bash
curl -X POST http://localhost:8080/api/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"email":"test@example.com","password":"password123","name":"Test User"}'
```

### Check in Supabase:
1. Go to Table Editor in Supabase
2. Click on `users` table
3. You should see your test user

## Troubleshooting

### If you get "table already exists" errors:
Run the DROP commands in Step 2 first

### If you get "permission denied" errors:
Make sure you're using the service key (not the anon key) in your `.env.deployment`

### If connection fails:
1. Check your `.env.deployment` has correct values:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_KEY`
2. Make sure you're in the `api-simple` directory
3. Try `npm install` again

## Important Notes

- The service key bypasses Row Level Security (RLS)
- In production, implement proper RLS policies
- The schema uses TEXT for IDs (matching your simple API)
- Passwords are hashed with SHA256 (upgrade to bcrypt for production)

## Next Steps

Once tables are created and working:
1. ✅ Database connected
2. Next: Add real AI integration (Groq)
3. Then: Add email integration
4. Finally: Deploy WhatsApp bot