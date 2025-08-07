import { Router } from 'express';
import { z } from 'zod';
import { db } from '../lib/database';
import { authMiddleware } from '../middleware/auth';
import { validate, validateParams } from '../middleware/validation';
import { NotFoundError, ForbiddenError, ConflictError } from '../types';

const router = Router();

// Validation schemas
const createAccountSchema = z.object({
  email: z.string().email(),
  provider: z.enum(['gmail', 'outlook', 'yahoo', 'other']),
  credentials: z.object({
    accessToken: z.string().optional(),
    refreshToken: z.string().optional(),
    apiKey: z.string().optional(),
    password: z.string().optional(),
  }).optional(),
  settings: z.object({
    syncEnabled: z.boolean().optional(),
    autoReply: z.boolean().optional(),
    folders: z.array(z.string()).optional(),
  }).optional(),
});

const updateAccountSchema = z.object({
  syncEnabled: z.boolean().optional(),
  autoReply: z.boolean().optional(),
  folders: z.array(z.string()).optional(),
  credentials: z.object({
    accessToken: z.string().optional(),
    refreshToken: z.string().optional(),
  }).optional(),
});

const accountIdSchema = z.object({
  id: z.string().uuid(),
});

// GET /api/accounts - List email accounts
router.get(
  '/',
  authMiddleware,
  async (req: any, res, next) => {
    try {
      const accounts = await db.getEmailAccounts(req.user.userId);
      
      // Remove sensitive credentials
      const sanitized = accounts.map(account => {
        const { credentials, ...safe } = account;
        return {
          ...safe,
          hasCredentials: !!credentials,
        };
      });
      
      res.json({
        data: sanitized,
      });
    } catch (error) {
      next(error);
    }
  }
);

// POST /api/accounts - Add email account
router.post(
  '/',
  authMiddleware,
  validate(createAccountSchema),
  async (req: any, res, next) => {
    try {
      const { email, provider, credentials, settings } = req.body;
      
      // Check if account already exists
      const existing = await db.getEmailAccountByEmail(req.user.userId, email);
      if (existing) {
        throw new ConflictError('Email account already exists');
      }
      
      // Create account
      const account = await db.createEmailAccount({
        user_id: req.user.userId,
        email,
        provider,
        credentials: credentials ? JSON.stringify(credentials) : null,
        settings: settings ? JSON.stringify(settings) : null,
        is_active: true,
      });
      
      // Remove sensitive fields
      const { credentials: creds, ...safeAccount } = account;
      
      res.status(201).json({
        data: {
          ...safeAccount,
          hasCredentials: !!creds,
        },
        message: 'Email account added successfully',
      });
    } catch (error) {
      next(error);
    }
  }
);

// PATCH /api/accounts/:id - Update account
router.patch(
  '/:id',
  authMiddleware,
  validateParams(accountIdSchema),
  validate(updateAccountSchema),
  async (req: any, res, next) => {
    try {
      // Check ownership
      const account = await db.getEmailAccount(req.params.id);
      
      if (!account) {
        throw new NotFoundError('Account not found');
      }
      
      if (account.user_id !== req.user.userId) {
        throw new ForbiddenError('Access denied');
      }
      
      // Update account
      const updates: any = {};
      
      if (req.body.syncEnabled !== undefined) {
        updates.sync_enabled = req.body.syncEnabled;
      }
      
      if (req.body.autoReply !== undefined) {
        updates.auto_reply = req.body.autoReply;
      }
      
      if (req.body.folders) {
        const currentSettings = account.settings ? JSON.parse(account.settings) : {};
        updates.settings = JSON.stringify({
          ...currentSettings,
          folders: req.body.folders,
        });
      }
      
      if (req.body.credentials) {
        const currentCreds = account.credentials ? JSON.parse(account.credentials) : {};
        updates.credentials = JSON.stringify({
          ...currentCreds,
          ...req.body.credentials,
        });
      }
      
      const updated = await db.updateEmailAccount(req.params.id, updates);
      
      // Remove sensitive fields
      const { credentials, ...safeAccount } = updated;
      
      res.json({
        data: {
          ...safeAccount,
          hasCredentials: !!credentials,
        },
        message: 'Account updated successfully',
      });
    } catch (error) {
      next(error);
    }
  }
);

// DELETE /api/accounts/:id - Remove account
router.delete(
  '/:id',
  authMiddleware,
  validateParams(accountIdSchema),
  async (req: any, res, next) => {
    try {
      // Check ownership
      const account = await db.getEmailAccount(req.params.id);
      
      if (!account) {
        throw new NotFoundError('Account not found');
      }
      
      if (account.user_id !== req.user.userId) {
        throw new ForbiddenError('Access denied');
      }
      
      // Delete account and associated emails
      await db.deleteEmailAccount(req.params.id);
      
      res.json({
        message: 'Account removed successfully',
      });
    } catch (error) {
      next(error);
    }
  }
);

// POST /api/accounts/:id/sync - Trigger manual sync
router.post(
  '/:id/sync',
  authMiddleware,
  validateParams(accountIdSchema),
  async (req: any, res, next) => {
    try {
      // Check ownership
      const account = await db.getEmailAccount(req.params.id);
      
      if (!account) {
        throw new NotFoundError('Account not found');
      }
      
      if (account.user_id !== req.user.userId) {
        throw new ForbiddenError('Access denied');
      }
      
      // Trigger sync (this would be implemented with a queue/job system)
      // For now, just update last sync time
      await db.updateEmailAccount(req.params.id, {
        last_sync: new Date(),
      });
      
      res.json({
        message: 'Sync initiated successfully',
        data: {
          accountId: req.params.id,
          syncStarted: new Date().toISOString(),
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

// GET /api/accounts/:id/stats - Get account statistics
router.get(
  '/:id/stats',
  authMiddleware,
  validateParams(accountIdSchema),
  async (req: any, res, next) => {
    try {
      // Check ownership
      const account = await db.getEmailAccount(req.params.id);
      
      if (!account) {
        throw new NotFoundError('Account not found');
      }
      
      if (account.user_id !== req.user.userId) {
        throw new ForbiddenError('Access denied');
      }
      
      // Get statistics
      const stats = await db.getEmailAccountStats(req.params.id);
      
      res.json({
        data: {
          totalEmails: stats.total || 0,
          unreadEmails: stats.unread || 0,
          processedEmails: stats.processed || 0,
          lastSync: account.last_sync,
          oldestEmail: stats.oldest_email,
          newestEmail: stats.newest_email,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;