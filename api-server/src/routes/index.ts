import { Router } from 'express';
import authRoutes from './auth';
import emailRoutes from './emails';
import aiRoutes from './ai';
import accountRoutes from './accounts';
import userRoutes from './user';

const router = Router();

router.use('/auth', authRoutes);
router.use('/emails', emailRoutes);
router.use('/ai', aiRoutes);
router.use('/accounts', accountRoutes);
router.use('/user', userRoutes);

// API root endpoint
router.get('/', (req, res) => {
  res.json({
    message: 'Email AI API',
    version: '1.0.0',
    endpoints: {
      auth: '/api/auth',
      emails: '/api/emails',
      ai: '/api/ai',
      accounts: '/api/accounts',
      user: '/api/user',
    },
  });
});

export default router;