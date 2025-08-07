#!/usr/bin/env node

/**
 * Test database connection script
 * Verifies that the database is properly configured and accessible
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

async function testConnection() {
  console.log('🔍 Testing database connection...\n');

  // Check environment variables
  const requiredEnvVars = ['SUPABASE_URL', 'SUPABASE_ANON_KEY'];
  const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

  if (missingVars.length > 0) {
    console.error('❌ Missing required environment variables:', missingVars.join(', '));
    console.error('Please ensure your .env file is properly configured');
    process.exit(1);
  }

  // Initialize Supabase client
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY
  );

  try {
    console.log('📡 Connecting to Supabase...');
    console.log(`   URL: ${process.env.SUPABASE_URL}`);
    console.log(`   Using: ${process.env.SUPABASE_SERVICE_KEY ? 'Service Key' : 'Anon Key'}\n`);

    // Test 1: Basic connectivity
    console.log('Test 1: Basic connectivity');
    const { data: healthCheck, error: healthError } = await supabase
      .from('users')
      .select('count')
      .limit(1);

    if (healthError && !healthError.message.includes('does not exist')) {
      throw healthError;
    }
    console.log('✅ Basic connectivity test passed\n');

    // Test 2: Check tables exist
    console.log('Test 2: Checking tables');
    const tables = [
      'users',
      'email_accounts',
      'emails',
      'ai_responses',
      'response_templates',
      'notification_logs',
      'usage_metrics'
    ];

    for (const table of tables) {
      const { error } = await supabase
        .from(table)
        .select('count')
        .limit(1);

      if (error && !error.message.includes('does not exist')) {
        console.log(`❌ Table '${table}' check failed:`, error.message);
      } else if (error) {
        console.log(`⚠️  Table '${table}' does not exist (run migrations)`);
      } else {
        console.log(`✅ Table '${table}' exists`);
      }
    }
    console.log('');

    // Test 3: Test write permissions (if using service key)
    if (process.env.SUPABASE_SERVICE_KEY) {
      console.log('Test 3: Write permissions');
      
      // Create a test user
      const testEmail = `test-${Date.now()}@example.com`;
      const { data: user, error: createError } = await supabase
        .from('users')
        .insert({ email: testEmail })
        .select()
        .single();

      if (createError) {
        console.log('⚠️  Write test failed:', createError.message);
        console.log('   This might be expected if RLS is enabled');
      } else {
        console.log('✅ Successfully created test user');
        
        // Clean up test user
        const { error: deleteError } = await supabase
          .from('users')
          .delete()
          .eq('id', user.id);

        if (!deleteError) {
          console.log('✅ Successfully cleaned up test user');
        }
      }
      console.log('');
    }

    // Test 4: Check RLS status
    console.log('Test 4: Row Level Security (RLS) status');
    try {
      // This is a simplified check - actual RLS status would need admin access
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .limit(1);

      if (error && error.message.includes('row-level security')) {
        console.log('✅ RLS is enabled (as expected)');
      } else {
        console.log('⚠️  RLS might not be properly configured');
      }
    } catch (e) {
      console.log('⚠️  Could not determine RLS status');
    }
    console.log('');

    // Summary
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✨ Database connection test completed successfully!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  } catch (error) {
    console.error('\n❌ Database connection test failed:');
    console.error(error.message || error);
    console.error('\nTroubleshooting tips:');
    console.error('1. Check your internet connection');
    console.error('2. Verify your Supabase URL and keys are correct');
    console.error('3. Ensure your Supabase project is active');
    console.error('4. Check if there are any IP restrictions on your Supabase project');
    process.exit(1);
  }
}

// Run the test
testConnection().catch(console.error);