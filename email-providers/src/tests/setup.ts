// Test setup file for Jest

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.GOOGLE_CLIENT_ID = 'test-google-client-id';
process.env.GOOGLE_CLIENT_SECRET = 'test-google-client-secret';
process.env.MICROSOFT_CLIENT_ID = 'test-microsoft-client-id';
process.env.MICROSOFT_CLIENT_SECRET = 'test-microsoft-client-secret';
process.env.API_URL = 'http://localhost:3000';

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  error: jest.fn(),
  warn: jest.fn(),
  log: jest.fn(),
  info: jest.fn(),
  debug: jest.fn(),
};

// Add custom matchers if needed
expect.extend({
  toBeValidEmail(received: any) {
    const pass = 
      typeof received === 'object' &&
      typeof received.id === 'string' &&
      typeof received.subject === 'string' &&
      typeof received.from === 'object' &&
      Array.isArray(received.to);

    return {
      pass,
      message: () => 
        pass
          ? `Expected ${received} not to be a valid email`
          : `Expected ${received} to be a valid email`,
    };
  },
});