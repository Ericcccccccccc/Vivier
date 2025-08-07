// Test setup file
import dotenv from 'dotenv';

// Load test environment variables
dotenv.config({ path: '.env.test' });

// Set test environment
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-key-for-testing-purposes-only-32chars';

// Mock database and AI providers
jest.mock('../lib/database', () => ({
  db: {
    connect: jest.fn().mockResolvedValue(true),
    disconnect: jest.fn().mockResolvedValue(true),
    healthCheck: jest.fn().mockResolvedValue(true),
    getUserByEmail: jest.fn(),
    getUserById: jest.fn(),
    createUser: jest.fn(),
    updateUser: jest.fn(),
    deleteUser: jest.fn(),
    getEmailAccounts: jest.fn(),
    getEmailAccount: jest.fn(),
    createEmailAccount: jest.fn(),
    updateEmailAccount: jest.fn(),
    deleteEmailAccount: jest.fn(),
    getEmail: jest.fn(),
    getEmails: jest.fn(),
    deleteEmail: jest.fn(),
    archiveEmail: jest.fn(),
    markEmailProcessed: jest.fn(),
    saveAIResponse: jest.fn(),
    getAIResponses: jest.fn(),
    getUsage: jest.fn(),
    incrementUsage: jest.fn(),
    storeRefreshToken: jest.fn(),
    validateRefreshToken: jest.fn(),
    revokeRefreshToken: jest.fn(),
    revokeAllRefreshTokens: jest.fn(),
    updateLastLogin: jest.fn(),
    getEmailAccountByEmail: jest.fn(),
    getEmailAccountStats: jest.fn(),
    getUserEmails: jest.fn(),
    getUserUsageHistory: jest.fn(),
    getUserTemplates: jest.fn(),
    getUserTemplate: jest.fn(),
    createUserTemplate: jest.fn(),
    deleteUserTemplate: jest.fn(),
    logAIGeneration: jest.fn(),
  },
}));

jest.mock('../lib/ai', () => ({
  ai: {
    generateEmailResponse: jest.fn(),
    generate: jest.fn(),
    streamGenerate: jest.fn(),
    analyzeEmail: jest.fn(),
    getTemplates: jest.fn(),
  },
}));