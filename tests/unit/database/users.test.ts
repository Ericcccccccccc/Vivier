import { describe, expect, test, jest, beforeEach, afterEach } from '@jest/globals';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import { UserService } from '../../../src/database/services/user.service';

// Mock Prisma Client
jest.mock('@prisma/client', () => {
  const mockPrismaClient = {
    user: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn()
    },
    $transaction: jest.fn(),
    $disconnect: jest.fn()
  };
  return { PrismaClient: jest.fn(() => mockPrismaClient) };
});

jest.mock('bcrypt');

describe('UserService', () => {
  let userService: UserService;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = new PrismaClient();
    userService = new UserService(mockPrisma);
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('createUser', () => {
    test('should create a new user with hashed password', async () => {
      const userData = {
        email: 'test@example.com',
        password: 'password123',
        name: 'Test User'
      };

      const hashedPassword = 'hashed_password';
      const createdUser = {
        id: '123',
        email: userData.email,
        name: userData.name,
        password: hashedPassword,
        createdAt: new Date(),
        updatedAt: new Date(),
        emailVerified: false,
        role: 'USER'
      };

      (bcrypt.hash as jest.Mock).mockResolvedValue(hashedPassword);
      mockPrisma.user.create.mockResolvedValue(createdUser);

      const result = await userService.createUser(userData);

      expect(bcrypt.hash).toHaveBeenCalledWith(userData.password, 10);
      expect(mockPrisma.user.create).toHaveBeenCalledWith({
        data: {
          email: userData.email,
          name: userData.name,
          password: hashedPassword,
          role: 'USER'
        }
      });
      expect(result).toEqual(createdUser);
    });

    test('should throw error if email already exists', async () => {
      const userData = {
        email: 'existing@example.com',
        password: 'password123',
        name: 'Test User'
      };

      mockPrisma.user.create.mockRejectedValue(new Error('Unique constraint failed'));

      await expect(userService.createUser(userData)).rejects.toThrow('Unique constraint failed');
    });
  });

  describe('findUserByEmail', () => {
    test('should find user by email', async () => {
      const email = 'test@example.com';
      const user = {
        id: '123',
        email,
        name: 'Test User',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockPrisma.user.findUnique.mockResolvedValue(user);

      const result = await userService.findUserByEmail(email);

      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { email },
        include: {
          subscription: true,
          preferences: true
        }
      });
      expect(result).toEqual(user);
    });

    test('should return null if user not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      const result = await userService.findUserByEmail('nonexistent@example.com');

      expect(result).toBeNull();
    });
  });

  describe('updateUser', () => {
    test('should update user data', async () => {
      const userId = '123';
      const updateData = {
        name: 'Updated Name',
        emailVerified: true
      };

      const updatedUser = {
        id: userId,
        email: 'test@example.com',
        ...updateData,
        updatedAt: new Date()
      };

      mockPrisma.user.update.mockResolvedValue(updatedUser);

      const result = await userService.updateUser(userId, updateData);

      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: userId },
        data: updateData
      });
      expect(result).toEqual(updatedUser);
    });

    test('should hash new password if provided', async () => {
      const userId = '123';
      const updateData = {
        password: 'newpassword123'
      };
      const hashedPassword = 'new_hashed_password';

      (bcrypt.hash as jest.Mock).mockResolvedValue(hashedPassword);
      mockPrisma.user.update.mockResolvedValue({ id: userId });

      await userService.updateUser(userId, updateData);

      expect(bcrypt.hash).toHaveBeenCalledWith(updateData.password, 10);
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: userId },
        data: { password: hashedPassword }
      });
    });
  });

  describe('validatePassword', () => {
    test('should return true for valid password', async () => {
      const password = 'password123';
      const hashedPassword = 'hashed_password';

      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await userService.validatePassword(password, hashedPassword);

      expect(bcrypt.compare).toHaveBeenCalledWith(password, hashedPassword);
      expect(result).toBe(true);
    });

    test('should return false for invalid password', async () => {
      const password = 'wrongpassword';
      const hashedPassword = 'hashed_password';

      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      const result = await userService.validatePassword(password, hashedPassword);

      expect(result).toBe(false);
    });
  });

  describe('deleteUser', () => {
    test('should delete user and cascade related data', async () => {
      const userId = '123';

      mockPrisma.$transaction.mockImplementation(async (callback: any) => {
        return callback(mockPrisma);
      });

      await userService.deleteUser(userId);

      expect(mockPrisma.$transaction).toHaveBeenCalled();
      expect(mockPrisma.user.delete).toHaveBeenCalledWith({
        where: { id: userId }
      });
    });
  });

  describe('getUserStats', () => {
    test('should return user statistics', async () => {
      const userId = '123';
      const stats = {
        totalChats: 10,
        totalMessages: 150,
        tokensUsed: 50000,
        lastActive: new Date()
      };

      mockPrisma.user.findUnique.mockResolvedValue({
        id: userId,
        chats: { length: stats.totalChats },
        _count: { messages: stats.totalMessages },
        usage: { tokensUsed: stats.tokensUsed },
        lastActive: stats.lastActive
      });

      const result = await userService.getUserStats(userId);

      expect(result).toMatchObject({
        totalChats: expect.any(Number),
        totalMessages: expect.any(Number)
      });
    });
  });
});