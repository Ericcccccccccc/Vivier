import { Router } from 'express';
import { z } from 'zod';
import { db } from '../lib/database';
import { authMiddleware } from '../middleware/auth';
import { validate } from '../middleware/validation';
import { NotFoundError } from '../types';

const router = Router();

// Validation schemas
const updateProfileSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  timezone: z.string().optional(),
  preferences: z.object({
    emailNotifications: z.boolean().optional(),
    responseStyle: z.enum(['professional', 'casual', 'friendly', 'formal']).optional(),
    autoProcess: z.boolean().optional(),
  }).optional(),
});

// GET /api/user/profile - Get user profile
router.get(
  '/profile',
  authMiddleware,
  async (req: any, res, next) => {
    try {
      const user = await db.getUserById(req.user.userId);
      
      if (!user) {
        throw new NotFoundError('User not found');
      }
      
      // Remove sensitive fields
      const { password, ...profile } = user;
      
      res.json({
        data: profile,
      });
    } catch (error) {
      next(error);
    }
  }
);

// PATCH /api/user/profile - Update profile
router.patch(
  '/profile',
  authMiddleware,
  validate(updateProfileSchema),
  async (req: any, res, next) => {
    try {
      const updates = req.body;
      
      const updated = await db.updateUser(req.user.userId, updates);
      
      // Remove sensitive fields
      const { password, ...profile } = updated;
      
      res.json({
        data: profile,
        message: 'Profile updated successfully',
      });
    } catch (error) {
      next(error);
    }
  }
);

// GET /api/user/usage - Get usage statistics
router.get(
  '/usage',
  authMiddleware,
  async (req: any, res, next) => {
    try {
      const now = new Date();
      const startOfDay = new Date(now);
      startOfDay.setUTCHours(0, 0, 0, 0);
      
      const startOfMonth = new Date(now);
      startOfMonth.setUTCDate(1);
      startOfMonth.setUTCHours(0, 0, 0, 0);
      
      // Get various usage metrics
      const [aiUsageToday, aiUsageMonth, emailsProcessed] = await Promise.all([
        db.getUsage(req.user.userId, 'ai_calls', startOfDay),
        db.getUsage(req.user.userId, 'ai_calls', startOfMonth),
        db.getUsage(req.user.userId, 'emails_processed', startOfMonth),
      ]);
      
      res.json({
        data: {
          ai: {
            today: {
              used: aiUsageToday?.count || 0,
              limit: 50,
              resetAt: new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000),
            },
            month: {
              used: aiUsageMonth?.count || 0,
              limit: 1500,
              resetAt: new Date(startOfMonth.getTime() + 30 * 24 * 60 * 60 * 1000),
            },
          },
          emails: {
            processedThisMonth: emailsProcessed?.count || 0,
          },
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

// DELETE /api/user/account - Delete user account
router.delete(
  '/account',
  authMiddleware,
  async (req: any, res, next) => {
    try {
      // This is a dangerous operation - require additional confirmation
      const confirmationToken = req.headers['x-confirmation-token'];
      
      if (!confirmationToken) {
        res.status(400).json({
          error: {
            code: 'CONFIRMATION_REQUIRED',
            message: 'Account deletion requires confirmation token',
          },
        });
        return;
      }
      
      // Delete user and all associated data
      await db.deleteUser(req.user.userId);
      
      res.json({
        message: 'Account deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  }
);

// GET /api/user/export - Export user data (GDPR compliance)
router.get(
  '/export',
  authMiddleware,
  async (req: any, res, next) => {
    try {
      // Gather all user data
      const [user, accounts, emails, usage] = await Promise.all([
        db.getUserById(req.user.userId),
        db.getEmailAccounts(req.user.userId),
        db.getUserEmails(req.user.userId),
        db.getUserUsageHistory(req.user.userId),
      ]);
      
      // Remove sensitive fields
      const { password, ...userData } = user || {};
      
      const exportData = {
        user: userData,
        emailAccounts: accounts,
        emails: emails,
        usage: usage,
        exportedAt: new Date().toISOString(),
      };
      
      res.json({
        data: exportData,
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;