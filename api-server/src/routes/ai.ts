import { Router } from 'express';
import { z } from 'zod';
import { aiService } from '../services/ai-service';
import { authMiddleware } from '../middleware/auth';
import { validate, validateParams } from '../middleware/validation';
import { aiRateLimit } from '../middleware/rate-limit';

const router = Router();

// Validation schemas
const generateSchema = z.object({
  prompt: z.string().min(10).max(4000),
  context: z.object({
    temperature: z.number().min(0).max(2).optional(),
    maxTokens: z.number().min(10).max(4000).optional(),
    style: z.enum(['professional', 'casual', 'friendly', 'formal']).optional(),
  }).optional(),
  stream: z.boolean().optional(),
});

const analyzeSchema = z.object({
  content: z.string().min(10).max(10000),
  type: z.enum(['email', 'document', 'general']).optional(),
});

const templateSchema = z.object({
  name: z.string().min(3).max(100),
  content: z.string().min(10).max(2000),
  category: z.enum(['greeting', 'response', 'follow-up', 'general']).optional(),
});

const templateIdSchema = z.object({
  id: z.string().uuid(),
});

// POST /api/ai/generate - Generate AI response
router.post(
  '/generate',
  authMiddleware,
  aiRateLimit,
  validate(generateSchema),
  async (req: any, res, next) => {
    try {
      const { prompt, context, stream } = req.body;
      
      if (stream) {
        // Set up SSE for streaming
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        
        // Stream the response
        const result = await aiService.generateResponse(
          req.user.userId,
          prompt,
          context,
          true
        );
        
        // Send chunks as they arrive
        for await (const chunk of result) {
          res.write(`data: ${JSON.stringify(chunk)}\n\n`);
        }
        
        res.write('data: [DONE]\n\n');
        res.end();
      } else {
        // Regular response
        const result = await aiService.generateResponse(
          req.user.userId,
          prompt,
          context,
          false
        );
        
        res.json({
          data: result,
        });
      }
    } catch (error) {
      next(error);
    }
  }
);

// POST /api/ai/analyze - Analyze content
router.post(
  '/analyze',
  authMiddleware,
  aiRateLimit,
  validate(analyzeSchema),
  async (req: any, res, next) => {
    try {
      const { content } = req.body;
      
      const result = await aiService.analyzeEmail(
        req.user.userId,
        content
      );
      
      res.json({
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
);

// GET /api/ai/templates - Get templates
router.get(
  '/templates',
  authMiddleware,
  async (req: any, res, next) => {
    try {
      const templates = await aiService.getTemplates(req.user.userId);
      
      res.json({
        data: templates,
      });
    } catch (error) {
      next(error);
    }
  }
);

// POST /api/ai/templates - Create template
router.post(
  '/templates',
  authMiddleware,
  validate(templateSchema),
  async (req: any, res, next) => {
    try {
      const { name, content, category } = req.body;
      
      const template = await aiService.createTemplate(
        req.user.userId,
        name,
        content,
        category
      );
      
      res.status(201).json({
        data: template,
        message: 'Template created successfully',
      });
    } catch (error) {
      next(error);
    }
  }
);

// DELETE /api/ai/templates/:id - Delete template
router.delete(
  '/templates/:id',
  authMiddleware,
  validateParams(templateIdSchema),
  async (req: any, res, next) => {
    try {
      await aiService.deleteTemplate(req.user.userId, req.params.id);
      
      res.json({
        message: 'Template deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  }
);

// GET /api/ai/usage - Get AI usage stats
router.get(
  '/usage',
  authMiddleware,
  async (req: any, res, next) => {
    try {
      // This would need to be implemented in the service
      res.json({
        data: {
          used: 10,
          limit: 50,
          resetAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;