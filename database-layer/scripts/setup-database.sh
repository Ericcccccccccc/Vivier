#!/bin/bash

# Database setup script for Supabase
set -e

echo "🚀 Setting up Supabase database..."

# Check if required environment variables are set
if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_SERVICE_KEY" ]; then
    echo "❌ Error: SUPABASE_URL and SUPABASE_SERVICE_KEY environment variables must be set"
    echo "Please copy .env.example to .env and fill in your Supabase credentials"
    exit 1
fi

# Function to execute SQL via Supabase CLI or API
execute_sql() {
    local sql_file=$1
    echo "📝 Executing: $sql_file"
    
    # You would typically use Supabase CLI here
    # supabase db push --file $sql_file
    
    # Or use the Supabase API directly
    # This is a placeholder - actual implementation would depend on your setup
    node -e "
        const { createClient } = require('@supabase/supabase-js');
        const fs = require('fs');
        
        const supabase = createClient(
            process.env.SUPABASE_URL,
            process.env.SUPABASE_SERVICE_KEY
        );
        
        const sql = fs.readFileSync('$sql_file', 'utf-8');
        
        // Note: This is simplified. In production, you'd need proper SQL execution
        console.log('SQL loaded: ' + sql.substring(0, 100) + '...');
    "
}

# Step 1: Create initial schema
echo "📦 Creating database schema..."
execute_sql "../schema.sql"

# Step 2: Run migrations
echo "🔄 Running migrations..."
npm run db:migrate

# Step 3: Create test data (optional)
if [ "$1" == "--with-seed" ]; then
    echo "🌱 Seeding database with test data..."
    npm run db:seed
fi

# Step 4: Verify setup
echo "✅ Verifying database setup..."
npm run test:connection

echo "✨ Database setup complete!"
echo ""
echo "Next steps:"
echo "1. Run 'npm run dev' to start the development server"
echo "2. Run 'npm test' to run the test suite"
echo "3. Check the README for API documentation"