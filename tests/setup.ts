import { jest } from '@jest/globals';
import dotenv from 'dotenv';
import path from 'path';

// Load test environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env.test') });

// Set test environment
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-key';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/vivier_test';

// Mock console methods in tests
global.console = {
  ...console,
  error: jest.fn(),
  warn: jest.fn(),
  log: jest.fn(),
  info: jest.fn(),
  debug: jest.fn()
};

// Mock timers
jest.useFakeTimers();

// Clear all mocks after each test
afterEach(() => {
  jest.clearAllMocks();
  jest.clearAllTimers();
});

// Cleanup after all tests
afterAll(async () => {
  // Close database connections, cleanup resources
  jest.useRealTimers();
});