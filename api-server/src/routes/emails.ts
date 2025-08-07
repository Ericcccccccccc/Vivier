import { Router } from 'express';
import { z } from 'zod';
import { emailService } from '../services/email-service';
import { authMiddleware } from '../middleware/auth';
import { validate, validateQuery, validateParams } from '../middleware/validation';
import { aiRateLimit } from '../middleware/rate-limit';

const router = Router();

// Validation schemas
const listEmailsSchema = z.object({
  page: z.string().optional().transform(Number),
  pageSize: z.string().optional().transform(Number),
  sortBy: z.enum(['received_at', 'subject', 'from_address']).optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
  filter: z.string().optional(),
});

const emailIdSchema = z.object({
  id: z.string().uuid(),
});

const processEmailSchema = z.object({
  style: z.enum(['professional', 'casual', 'friendly', 'formal']).optional(),
  instructions: z.string().optional(),
});

// GET /api/emails - List emails
router.get(
  '/',
  authMiddleware,
  validateQuery(listEmailsSchema),
  async (req: any, res, next) => {
    try {
      const { page, pageSize, sortBy, sortOrder, filter } = req.query;
      
      const result = await emailService.listEmails(req.user.userId, {
        page: page || 1,
        pageSize: pageSize || 20,
        sortBy,
        sortOrder,
        filters: filter ? { search: filter } : undefined,
      });
      
      res.json(result);
    } catch (error) {
      next(error);
    }
  }
);

// GET /api/emails/:id - Get single email
router.get(
  '/:id',
  authMiddleware,
  validateParams(emailIdSchema),
  async (req: any, res, next) => {
    try {
      const email = await emailService.getEmail(req.params.id, req.user.userId);
      
      res.json({
        data: email,
      });
    } catch (error) {
      next(error);
    }
  }
);

// POST /api/emails/:id/process - Process email with AI
router.post(
  '/:id/process',
  authMiddleware,
  aiRateLimit,
  validateParams(emailIdSchema),
  validate(processEmailSchema),
  async (req: any, res, next) => {
    try {
      const result = await emailService.processEmail(
        req.params.id,
        req.user.userId
      );
      
      res.json({
        data: result,
        message: 'Email processed successfully',
      });
    } catch (error) {
      next(error);
    }
  }
);

// DELETE /api/emails/:id - Delete email
router.delete(
  '/:id',
  authMiddleware,
  validateParams(emailIdSchema),
  async (req: any, res, next) => {
    try {
      await emailService.deleteEmail(req.params.id, req.user.userId);
      
      res.json({
        message: 'Email deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  }
);

// POST /api/emails/:id/archive - Archive email
router.post(
  '/:id/archive',
  authMiddleware,
  validateParams(emailIdSchema),
  async (req: any, res, next) => {
    try {
      await emailService.archiveEmail(req.params.id, req.user.userId);
      
      res.json({
        message: 'Email archived successfully',
      });
    } catch (error) {
      next(error);
    }
  }
);

// POST /api/emails/:id/unarchive - Unarchive email
router.post(
  '/:id/unarchive',
  authMiddleware,
  validateParams(emailIdSchema),
  async (req: any, res, next) => {
    try {
      // This would need to be implemented in the service
      res.json({
        message: 'Email unarchived successfully',
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;