#!/usr/bin/env node

/**
 * Seed database with test data
 * Creates sample users, email accounts, emails, and AI responses
 */

const { createClient } = require('@supabase/supabase-js');
const { faker } = require('@faker-js/faker');
const crypto = require('crypto');
require('dotenv').config();

// Initialize Supabase client with service key for bypassing RLS
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY
);

// Helper function to encrypt credentials (simplified for demo)
function encryptCredentials(data) {
  const cipher = crypto.createCipher('aes-256-cbc', 'demo-encryption-key');
  let encrypted = cipher.update(JSON.stringify(data), 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return encrypted;
}

async function seedDatabase() {
  console.log('🌱 Starting database seeding...\n');

  try {
    // Step 1: Create test users
    console.log('Creating users...');
    const users = [];
    for (let i = 0; i < 3; i++) {
      const tier = i === 0 ? 'free' : i === 1 ? 'pro' : 'enterprise';
      const { data: user, error } = await supabase
        .from('users')
        .insert({
          email: faker.internet.email(),
          settings: {
            notifications_enabled: true,
            auto_reply: faker.datatype.boolean(),
            time_zone: faker.location.timeZone(),
            language: 'en',
            theme: faker.helpers.arrayElement(['light', 'dark', 'system']),
          },
          subscription_tier: tier,
        })
        .select()
        .single();

      if (error) {
        console.error(`Failed to create user ${i + 1}:`, error.message);
        continue;
      }

      users.push(user);
      console.log(`✅ Created ${tier} user: ${user.email}`);
    }

    // Step 2: Create email accounts for each user
    console.log('\nCreating email accounts...');
    const emailAccounts = [];
    for (const user of users) {
      const numAccounts = faker.number.int({ min: 1, max: 2 });
      
      for (let i = 0; i < numAccounts; i++) {
        const provider = faker.helpers.arrayElement(['gmail', 'outlook', 'imap']);
        const { data: account, error } = await supabase
          .from('email_accounts')
          .insert({
            user_id: user.id,
            email_address: faker.internet.email(),
            provider: provider,
            encrypted_credentials: encryptCredentials({
              access_token: faker.string.alphanumeric(40),
              refresh_token: faker.string.alphanumeric(40),
            }),
            settings: {
              sync_interval_minutes: faker.helpers.arrayElement([5, 10, 15, 30]),
              auto_categorize: true,
            },
            last_sync: faker.date.recent(),
          })
          .select()
          .single();

        if (error) {
          console.error(`Failed to create email account:`, error.message);
          continue;
        }

        emailAccounts.push(account);
        console.log(`✅ Created ${provider} account: ${account.email_address}`);
      }
    }

    // Step 3: Create emails for each account
    console.log('\nCreating emails...');
    const emails = [];
    for (const account of emailAccounts) {
      const numEmails = faker.number.int({ min: 5, max: 15 });
      
      for (let i = 0; i < numEmails; i++) {
        const threadId = i % 3 === 0 ? faker.string.uuid() : null; // Some emails in threads
        const { data: email, error } = await supabase
          .from('emails')
          .insert({
            account_id: account.id,
            message_id: faker.string.uuid(),
            thread_id: threadId,
            subject: faker.lorem.sentence(),
            from_address: faker.internet.email(),
            to_addresses: [account.email_address],
            cc_addresses: faker.helpers.maybe(() => [faker.internet.email()], { probability: 0.2 }),
            body_text: faker.lorem.paragraphs(faker.number.int({ min: 1, max: 3 })),
            body_html: `<p>${faker.lorem.paragraphs(faker.number.int({ min: 1, max: 3 }))}</p>`,
            received_at: faker.date.recent({ days: 30 }),
            processed_at: faker.helpers.maybe(() => faker.date.recent(), { probability: 0.7 }),
            metadata: {
              importance: faker.helpers.arrayElement(['low', 'normal', 'high']),
              is_read: faker.datatype.boolean(),
              is_starred: faker.datatype.boolean(),
              categories: faker.helpers.arrayElements(['personal', 'work', 'newsletter', 'social'], { min: 1, max: 2 }),
            },
          })
          .select()
          .single();

        if (error) {
          console.error(`Failed to create email:`, error.message);
          continue;
        }

        emails.push(email);
      }
    }
    console.log(`✅ Created ${emails.length} emails`);

    // Step 4: Create AI responses for some emails
    console.log('\nCreating AI responses...');
    const responsesToCreate = Math.floor(emails.length * 0.6); // 60% of emails get responses
    const selectedEmails = faker.helpers.arrayElements(emails, responsesToCreate);
    
    for (const email of selectedEmails) {
      const { data: response, error } = await supabase
        .from('ai_responses')
        .insert({
          email_id: email.id,
          response_text: faker.lorem.paragraph(),
          model_used: faker.helpers.arrayElement(['gpt-4', 'gpt-3.5-turbo', 'claude-2']),
          confidence_score: faker.number.float({ min: 0.7, max: 1.0, precision: 0.01 }),
          tokens_used: faker.number.int({ min: 50, max: 500 }),
          response_time_ms: faker.number.int({ min: 500, max: 3000 }),
          user_edited: faker.datatype.boolean({ probability: 0.2 }),
          sent_at: faker.helpers.maybe(() => faker.date.recent(), { probability: 0.5 }),
        })
        .select()
        .single();

      if (error) {
        console.error(`Failed to create AI response:`, error.message);
      }
    }
    console.log(`✅ Created ${responsesToCreate} AI responses`);

    // Step 5: Create response templates
    console.log('\nCreating response templates...');
    for (const user of users) {
      const numTemplates = faker.number.int({ min: 2, max: 5 });
      
      for (let i = 0; i < numTemplates; i++) {
        const { error } = await supabase
          .from('response_templates')
          .insert({
            user_id: user.id,
            name: faker.helpers.arrayElement(['Quick Reply', 'Meeting Request', 'Follow Up', 'Thank You', 'Decline']),
            description: faker.lorem.sentence(),
            template_text: faker.lorem.paragraph(),
            variables: [
              { name: 'recipient_name', type: 'text', required: true },
              { name: 'date', type: 'date', required: false },
            ],
            category: faker.helpers.arrayElement(['business', 'personal', 'automated']),
            usage_count: faker.number.int({ min: 0, max: 20 }),
          });

        if (error) {
          console.error(`Failed to create template:`, error.message);
        }
      }
    }
    console.log(`✅ Created templates for ${users.length} users`);

    // Step 6: Create usage metrics
    console.log('\nCreating usage metrics...');
    const currentMonth = new Date();
    currentMonth.setDate(1);
    const nextMonth = new Date(currentMonth);
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    nextMonth.setDate(0);

    for (const user of users) {
      const metrics = ['ai_calls', 'emails_processed', 'templates_created'];
      
      for (const metric of metrics) {
        const { error } = await supabase
          .from('usage_metrics')
          .insert({
            user_id: user.id,
            metric_type: metric,
            count: faker.number.int({ min: 10, max: 100 }),
            period_start: currentMonth.toISOString().split('T')[0],
            period_end: nextMonth.toISOString().split('T')[0],
          });

        if (error && !error.message.includes('duplicate')) {
          console.error(`Failed to create usage metric:`, error.message);
        }
      }
    }
    console.log(`✅ Created usage metrics for ${users.length} users`);

    // Summary
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✨ Database seeding completed successfully!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`Created:`);
    console.log(`  - ${users.length} users`);
    console.log(`  - ${emailAccounts.length} email accounts`);
    console.log(`  - ${emails.length} emails`);
    console.log(`  - ${responsesToCreate} AI responses`);
    console.log(`  - Templates and usage metrics`);

  } catch (error) {
    console.error('\n❌ Seeding failed:', error.message || error);
    process.exit(1);
  }
}

// Run seeding
seedDatabase().catch(console.error);