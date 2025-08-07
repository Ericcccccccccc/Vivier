import { Router } from 'express';
import { z } from 'zod';
import { authService } from '../services/auth-service';
import { validate } from '../middleware/validation';
import { authRateLimit } from '../middleware/rate-limit';
import { authMiddleware } from '../middleware/auth';

const router = Router();

// Validation schemas
const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(100),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

const refreshSchema = z.object({
  refreshToken: z.string(),
});

const logoutSchema = z.object({
  refreshToken: z.string().optional(),
});

// POST /api/auth/register
router.post(
  '/register',
  authRateLimit,
  validate(registerSchema),
  async (req, res, next) => {
    try {
      const { email, password } = req.body;
      const result = await authService.register(email, password);
      
      res.status(201).json({
        data: result,
        message: 'User registered successfully',
      });
    } catch (error) {
      next(error);
    }
  }
);

// POST /api/auth/login
router.post(
  '/login',
  authRateLimit,
  validate(loginSchema),
  async (req, res, next) => {
    try {
      const { email, password } = req.body;
      const result = await authService.login(email, password);
      
      res.json({
        data: result,
        message: 'Login successful',
      });
    } catch (error) {
      next(error);
    }
  }
);

// POST /api/auth/refresh
router.post(
  '/refresh',
  validate(refreshSchema),
  async (req, res, next) => {
    try {
      const { refreshToken } = req.body;
      const result = await authService.refreshToken(refreshToken);
      
      res.json({
        data: result,
        message: 'Token refreshed successfully',
      });
    } catch (error) {
      next(error);
    }
  }
);

// POST /api/auth/logout
router.post(
  '/logout',
  authMiddleware,
  validate(logoutSchema),
  async (req: any, res, next) => {
    try {
      const { refreshToken } = req.body;
      await authService.logout(req.user.userId, refreshToken);
      
      res.json({
        message: 'Logout successful',
      });
    } catch (error) {
      next(error);
    }
  }
);

// GET /api/auth/verify
router.get(
  '/verify',
  authMiddleware,
  async (req: any, res) => {
    res.json({
      data: {
        valid: true,
        user: req.user,
      },
    });
  }
);

export default router;