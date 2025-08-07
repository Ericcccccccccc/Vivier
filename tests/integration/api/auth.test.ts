import { describe, expect, test, jest, beforeAll, afterAll, beforeEach } from '@jest/globals';
import request from 'supertest';
import { app } from '../../../src/api/app';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

describe('Auth API Integration Tests', () => {
  let testUser: any;
  let authToken: string;

  beforeAll(async () => {
    // Setup test database
    await prisma.$connect();
    // Clean up test data
    await prisma.user.deleteMany({ where: { email: { contains: 'test' } } });
  });

  afterAll(async () => {
    // Cleanup
    await prisma.user.deleteMany({ where: { email: { contains: 'test' } } });
    await prisma.$disconnect();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/auth/register', () => {
    test('should register a new user', async () => {
      const userData = {
        email: 'test@example.com',
        password: 'SecurePass123!',
        name: 'Test User'
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(201);

      expect(response.body).toMatchObject({
        success: true,
        user: {
          email: userData.email,
          name: userData.name
        }
      });
      expect(response.body.token).toBeDefined();
      expect(response.body.user.password).toBeUndefined();

      // Verify user in database
      const dbUser = await prisma.user.findUnique({
        where: { email: userData.email }
      });
      expect(dbUser).toBeTruthy();
      expect(await bcrypt.compare(userData.password, dbUser!.password)).toBe(true);
    });

    test('should reject duplicate email', async () => {
      const userData = {
        email: 'duplicate@example.com',
        password: 'SecurePass123!',
        name: 'Test User'
      };

      // First registration
      await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(201);

      // Duplicate registration
      const response = await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        error: expect.stringContaining('already exists')
      });
    });

    test('should validate password strength', async () => {
      const userData = {
        email: 'weak@example.com',
        password: '123',
        name: 'Test User'
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        error: expect.stringContaining('password')
      });
    });

    test('should validate email format', async () => {
      const userData = {
        email: 'invalid-email',
        password: 'SecurePass123!',
        name: 'Test User'
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        error: expect.stringContaining('email')
      });
    });
  });

  describe('POST /api/auth/login', () => {
    beforeAll(async () => {
      // Create test user for login tests
      const hashedPassword = await bcrypt.hash('TestPass123!', 10);
      testUser = await prisma.user.create({
        data: {
          email: 'login@example.com',
          password: hashedPassword,
          name: 'Login Test User'
        }
      });
    });

    test('should login with valid credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'login@example.com',
          password: 'TestPass123!'
        })
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        user: {
          email: 'login@example.com',
          name: 'Login Test User'
        }
      });
      expect(response.body.token).toBeDefined();

      // Verify JWT token
      const decoded = jwt.verify(response.body.token, process.env.JWT_SECRET!);
      expect(decoded).toHaveProperty('userId', testUser.id);

      authToken = response.body.token;
    });

    test('should reject invalid password', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'login@example.com',
          password: 'WrongPassword'
        })
        .expect(401);

      expect(response.body).toMatchObject({
        success: false,
        error: 'Invalid credentials'
      });
    });

    test('should reject non-existent user', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'TestPass123!'
        })
        .expect(401);

      expect(response.body).toMatchObject({
        success: false,
        error: 'Invalid credentials'
      });
    });

    test('should handle rate limiting', async () => {
      // Make multiple login attempts
      const attempts = Array(6).fill(null);
      
      for (let i = 0; i < 5; i++) {
        await request(app)
          .post('/api/auth/login')
          .send({
            email: 'login@example.com',
            password: 'WrongPassword'
          });
      }

      // 6th attempt should be rate limited
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'login@example.com',
          password: 'TestPass123!'
        })
        .expect(429);

      expect(response.body).toMatchObject({
        success: false,
        error: expect.stringContaining('Too many')
      });
    });
  });

  describe('POST /api/auth/refresh', () => {
    test('should refresh valid token', async () => {
      // Login first to get token
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'login@example.com',
          password: 'TestPass123!'
        });

      const oldToken = loginResponse.body.token;

      // Wait a bit to ensure new token is different
      await new Promise(resolve => setTimeout(resolve, 1000));

      const response = await request(app)
        .post('/api/auth/refresh')
        .set('Authorization', `Bearer ${oldToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true
      });
      expect(response.body.token).toBeDefined();
      expect(response.body.token).not.toBe(oldToken);
    });

    test('should reject expired token', async () => {
      // Create expired token
      const expiredToken = jwt.sign(
        { userId: testUser.id },
        process.env.JWT_SECRET!,
        { expiresIn: '-1h' }
      );

      const response = await request(app)
        .post('/api/auth/refresh')
        .set('Authorization', `Bearer ${expiredToken}`)
        .expect(401);

      expect(response.body).toMatchObject({
        success: false,
        error: expect.stringContaining('expired')
      });
    });
  });

  describe('POST /api/auth/logout', () => {
    test('should logout user and invalidate token', async () => {
      const response = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        message: 'Logged out successfully'
      });

      // Token should be blacklisted now
      const protectedResponse = await request(app)
        .get('/api/user/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(401);
    });
  });

  describe('POST /api/auth/forgot-password', () => {
    test('should send password reset email', async () => {
      const response = await request(app)
        .post('/api/auth/forgot-password')
        .send({
          email: 'login@example.com'
        })
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        message: 'Password reset email sent'
      });

      // Verify reset token was created in database
      const user = await prisma.user.findUnique({
        where: { email: 'login@example.com' }
      });
      expect(user?.resetToken).toBeDefined();
      expect(user?.resetTokenExpiry).toBeDefined();
    });

    test('should handle non-existent email gracefully', async () => {
      const response = await request(app)
        .post('/api/auth/forgot-password')
        .send({
          email: 'nonexistent@example.com'
        })
        .expect(200);

      // Should return success to prevent email enumeration
      expect(response.body).toMatchObject({
        success: true,
        message: 'Password reset email sent'
      });
    });
  });

  describe('POST /api/auth/reset-password', () => {
    let resetToken: string;

    beforeAll(async () => {
      // Generate reset token for user
      resetToken = jwt.sign(
        { userId: testUser.id, type: 'reset' },
        process.env.JWT_SECRET!,
        { expiresIn: '1h' }
      );

      await prisma.user.update({
        where: { id: testUser.id },
        data: {
          resetToken,
          resetTokenExpiry: new Date(Date.now() + 3600000)
        }
      });
    });

    test('should reset password with valid token', async () => {
      const response = await request(app)
        .post('/api/auth/reset-password')
        .send({
          token: resetToken,
          password: 'NewSecurePass123!'
        })
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        message: 'Password reset successfully'
      });

      // Verify can login with new password
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'login@example.com',
          password: 'NewSecurePass123!'
        })
        .expect(200);

      expect(loginResponse.body.success).toBe(true);
    });

    test('should reject invalid reset token', async () => {
      const response = await request(app)
        .post('/api/auth/reset-password')
        .send({
          token: 'invalid-token',
          password: 'NewSecurePass123!'
        })
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        error: expect.stringContaining('Invalid')
      });
    });

    test('should reject expired reset token', async () => {
      const expiredToken = jwt.sign(
        { userId: testUser.id, type: 'reset' },
        process.env.JWT_SECRET!,
        { expiresIn: '-1h' }
      );

      const response = await request(app)
        .post('/api/auth/reset-password')
        .send({
          token: expiredToken,
          password: 'NewSecurePass123!'
        })
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        error: expect.stringContaining('expired')
      });
    });
  });

  describe('GET /api/auth/verify-email/:token', () => {
    test('should verify email with valid token', async () => {
      const verifyToken = jwt.sign(
        { userId: testUser.id, type: 'verify' },
        process.env.JWT_SECRET!,
        { expiresIn: '24h' }
      );

      await prisma.user.update({
        where: { id: testUser.id },
        data: { emailVerificationToken: verifyToken }
      });

      const response = await request(app)
        .get(`/api/auth/verify-email/${verifyToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        message: 'Email verified successfully'
      });

      // Check user is verified
      const user = await prisma.user.findUnique({
        where: { id: testUser.id }
      });
      expect(user?.emailVerified).toBe(true);
    });
  });
});