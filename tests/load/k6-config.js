import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');
const chatResponseTime = new Trend('chat_response_time');
const loginTime = new Trend('login_time');

// Test configuration
export const options = {
  stages: [
    { duration: '2m', target: 10 },   // Ramp up to 10 users
    { duration: '5m', target: 50 },   // Ramp up to 50 users
    { duration: '10m', target: 100 }, // Ramp up to 100 users
    { duration: '5m', target: 100 },  // Stay at 100 users
    { duration: '5m', target: 0 },    // Ramp down to 0 users
  ],
  thresholds: {
    http_req_duration: ['p(95)<3000'], // 95% of requests under 3s
    errors: ['rate<0.1'],               // Error rate under 10%
    chat_response_time: ['p(95)<5000'], // 95% of chat responses under 5s
  },
  ext: {
    loadimpact: {
      projectID: 3572087,
      name: 'Vivier Load Test'
    }
  }
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const TEST_USER = {
  email: 'loadtest@example.com',
  password: 'LoadTest123!'
};

// Helper function to authenticate
function authenticate() {
  const loginRes = http.post(
    `${BASE_URL}/api/auth/login`,
    JSON.stringify(TEST_USER),
    {
      headers: { 'Content-Type': 'application/json' },
      tags: { name: 'login' }
    }
  );

  loginTime.add(loginRes.timings.duration);

  const success = check(loginRes, {
    'login successful': (r) => r.status === 200,
    'token received': (r) => JSON.parse(r.body).token !== undefined
  });

  if (!success) {
    errorRate.add(1);
    return null;
  }

  errorRate.add(0);
  return JSON.parse(loginRes.body).token;
}

// Setup function - runs once per VU
export function setup() {
  // Create test user if needed
  const registerRes = http.post(
    `${BASE_URL}/api/auth/register`,
    JSON.stringify({
      ...TEST_USER,
      name: 'Load Test User'
    }),
    { headers: { 'Content-Type': 'application/json' } }
  );

  // User might already exist, that's ok
  if (registerRes.status !== 201 && registerRes.status !== 400) {
    throw new Error('Failed to setup test user');
  }

  return { baseUrl: BASE_URL };
}

// Main test scenario
export default function (data) {
  // Authenticate
  const token = authenticate();
  if (!token) {
    sleep(1);
    return;
  }

  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };

  // Scenario 1: Create a chat
  const createChatRes = http.post(
    `${BASE_URL}/api/chats`,
    JSON.stringify({
      title: `Load Test Chat ${Date.now()}`,
      provider: 'openai',
      model: 'gpt-3.5-turbo'
    }),
    { headers, tags: { name: 'create_chat' } }
  );

  const chatCreated = check(createChatRes, {
    'chat created': (r) => r.status === 201,
    'chat has ID': (r) => JSON.parse(r.body).chat?.id !== undefined
  });

  if (!chatCreated) {
    errorRate.add(1);
    sleep(1);
    return;
  }

  const chatId = JSON.parse(createChatRes.body).chat.id;
  errorRate.add(0);

  // Scenario 2: Send messages
  for (let i = 0; i < 3; i++) {
    const startTime = Date.now();
    
    const messageRes = http.post(
      `${BASE_URL}/api/chats/${chatId}/messages`,
      JSON.stringify({
        content: `Load test message ${i}: What is ${Math.floor(Math.random() * 100)} + ${Math.floor(Math.random() * 100)}?`
      }),
      { headers, tags: { name: 'send_message' } }
    );

    chatResponseTime.add(Date.now() - startTime);

    const messageSuccess = check(messageRes, {
      'message sent': (r) => r.status === 200,
      'AI responded': (r) => JSON.parse(r.body).aiMessage !== undefined
    });

    errorRate.add(messageSuccess ? 0 : 1);

    sleep(Math.random() * 2 + 1); // Random delay 1-3 seconds
  }

  // Scenario 3: Get chat history
  const historyRes = http.get(
    `${BASE_URL}/api/chats/${chatId}`,
    { headers, tags: { name: 'get_chat' } }
  );

  check(historyRes, {
    'chat retrieved': (r) => r.status === 200,
    'has messages': (r) => JSON.parse(r.body).chat?.messages?.length > 0
  });

  // Scenario 4: List all chats
  const listRes = http.get(
    `${BASE_URL}/api/chats`,
    { headers, tags: { name: 'list_chats' } }
  );

  check(listRes, {
    'chats listed': (r) => r.status === 200,
    'has chats array': (r) => Array.isArray(JSON.parse(r.body).chats)
  });

  // Scenario 5: Search chats
  const searchRes = http.post(
    `${BASE_URL}/api/chats/search`,
    JSON.stringify({ query: 'test' }),
    { headers, tags: { name: 'search_chats' } }
  );

  check(searchRes, {
    'search completed': (r) => r.status === 200
  });

  // Clean up - delete chat
  http.del(
    `${BASE_URL}/api/chats/${chatId}`,
    null,
    { headers, tags: { name: 'delete_chat' } }
  );

  sleep(Math.random() * 3 + 2); // Random delay 2-5 seconds
}

// Teardown function - runs once after all iterations
export function teardown(data) {
  console.log('Load test completed');
}