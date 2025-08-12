// Check actual table structure
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function checkUserTableStructure() {
  console.log('Checking users table structure...\n');
  
  // Get a user to see the structure
  const { data: users, error } = await supabase
    .from('users')
    .select('*')
    .limit(1);
  
  if (error) {
    console.error('Error:', error);
    return;
  }
  
  if (users && users.length > 0) {
    console.log('User table columns:');
    Object.keys(users[0]).forEach(key => {
      const value = users[0][key];
      const type = typeof value;
      console.log(`  - ${key}: ${type} (sample: ${JSON.stringify(value).substring(0, 50)}...)`);
    });
  }
  
  console.log('\n--- Checking if we can insert a user ---\n');
  
  // Try to insert a test user with the simple schema structure
  const testUser = {
    id: 'test_' + Date.now(),
    email: 'test_' + Date.now() + '@example.com',
    password: 'hashed_password_here',
    name: 'Test User',
    settings: {
      notifications: true,
      aiModel: 'groq',
      responseStyle: 'professional',
      emailAccounts: []
    }
  };
  
  const { data: newUser, error: insertError } = await supabase
    .from('users')
    .insert(testUser)
    .select()
    .single();
  
  if (insertError) {
    console.error('Insert error:', insertError);
  } else {
    console.log('Successfully inserted user:', newUser);
    
    // Clean up test user
    const { error: deleteError } = await supabase
      .from('users')
      .delete()
      .eq('id', testUser.id);
    
    if (deleteError) {
      console.error('Failed to delete test user:', deleteError);
    } else {
      console.log('Cleaned up test user');
    }
  }
}

checkUserTableStructure().catch(console.error);