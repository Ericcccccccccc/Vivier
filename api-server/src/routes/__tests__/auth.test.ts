import request from 'supertest';
import { app } from '../../index';
import { db } from '../../lib/database';
import bcrypt from 'bcrypt';

describe('Auth Endpoints', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  
  describe('POST /api/auth/register', () => {
    it('should register new user', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        password: 'hashed-password',
        created_at: new Date(),
        updated_at: new Date(),
      };
      
      (db.getUserByEmail as jest.Mock).mockResolvedValue(null);
      (db.createUser as jest.Mock).mockResolvedValue(mockUser);
      (db.storeRefreshToken as jest.Mock).mockResolvedValue(true);
      
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'test@example.com',
          password: 'SecurePass123!',
        });
      
      expect(response.status).toBe(201);
      expect(response.body.data).toHaveProperty('accessToken');
      expect(response.body.data).toHaveProperty('refreshToken');
      expect(response.body.data.user.email).toBe('test@example.com');
      expect(response.body.data.user).not.toHaveProperty('password');
    });
    
    it('should reject duplicate email', async () => {
      (db.getUserByEmail as jest.Mock).mockResolvedValue({
        id: 'existing-user',
        email: 'duplicate@example.com',
      });
      
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'duplicate@example.com',
          password: 'password123',
        });
      
      expect(response.status).toBe(409);
      expect(response.body.error.code).toBe('CONFLICT');
    });
    
    it('should validate email format', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'invalid-email',
          password: 'password123',
        });
      
      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
    
    it('should enforce minimum password length', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'test@example.com',
          password: 'short',
        });
      
      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });
  
  describe('POST /api/auth/login', () => {
    it('should login with valid credentials', async () => {
      const hashedPassword = await bcrypt.hash('password123', 10);
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        password: hashedPassword,
        created_at: new Date(),
        updated_at: new Date(),
      };
      
      (db.getUserByEmail as jest.Mock).mockResolvedValue(mockUser);
      (db.updateLastLogin as jest.Mock).mockResolvedValue(true);
      (db.storeRefreshToken as jest.Mock).mockResolvedValue(true);
      
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'password123',
        });
      
      expect(response.status).toBe(200);
      expect(response.body.data).toHaveProperty('accessToken');
      expect(response.body.data).toHaveProperty('refreshToken');
      expect(response.body.data.user.email).toBe('test@example.com');
    });
    
    it('should reject invalid password', async () => {
      const hashedPassword = await bcrypt.hash('correct-password', 10);
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        password: hashedPassword,
      };
      
      (db.getUserByEmail as jest.Mock).mockResolvedValue(mockUser);
      
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'wrong-password',
        });
      
      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('UNAUTHORIZED');
    });
    
    it('should reject non-existent user', async () => {
      (db.getUserByEmail as jest.Mock).mockResolvedValue(null);
      
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'password123',
        });
      
      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('UNAUTHORIZED');
    });
  });
  
  describe('POST /api/auth/refresh', () => {
    it('should refresh valid token', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        created_at: new Date(),
        updated_at: new Date(),
      };
      
      (db.validateRefreshToken as jest.Mock).mockResolvedValue(true);
      (db.getUserById as jest.Mock).mockResolvedValue(mockUser);
      (db.storeRefreshToken as jest.Mock).mockResolvedValue(true);
      
      // Create a valid refresh token
      const jwt = require('jsonwebtoken');
      const refreshToken = jwt.sign(
        { userId: 'user-123', email: 'test@example.com' },
        process.env.JWT_SECRET
      );
      
      const response = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken });
      
      expect(response.status).toBe(200);
      expect(response.body.data).toHaveProperty('accessToken');
      expect(response.body.data).toHaveProperty('refreshToken');
    });
    
    it('should reject invalid refresh token', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: 'invalid-token' });
      
      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('UNAUTHORIZED');
    });
  });
  
  describe('GET /api/auth/verify', () => {
    it('should verify valid token', async () => {
      const jwt = require('jsonwebtoken');
      const token = jwt.sign(
        { userId: 'user-123', email: 'test@example.com' },
        process.env.JWT_SECRET
      );
      
      const response = await request(app)
        .get('/api/auth/verify')
        .set('Authorization', `Bearer ${token}`);
      
      expect(response.status).toBe(200);
      expect(response.body.data.valid).toBe(true);
      expect(response.body.data.user.userId).toBe('user-123');
    });
    
    it('should reject missing token', async () => {
      const response = await request(app)
        .get('/api/auth/verify');
      
      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('UNAUTHORIZED');
    });
    
    it('should reject invalid token', async () => {
      const response = await request(app)
        .get('/api/auth/verify')
        .set('Authorization', 'Bearer invalid-token');
      
      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('UNAUTHORIZED');
    });
  });
});