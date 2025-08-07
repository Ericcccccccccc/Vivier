import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { rateLimit } from 'express-rate-limit';
import { pinoHttp } from 'pino-http';
import pino from 'pino';
import { config } from './config';
import { errorHandler } from './middleware/error-handler';
import routes from './routes';
import { db } from './lib/database';

const logger = pino({
  level: config.LOG_LEVEL,
  ...(config.NODE_ENV === 'development' && {
    transport: {
      target: 'pino-pretty',
      options: {
        colorize: true,
      },
    },
  }),
});

const app = express();

// Security
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
    },
  },
}));

// CORS
app.use(cors({
  origin: config.FRONTEND_URL,
  credentials: true,
}));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Compression
app.use(compression());

// Logging
app.use(pinoHttp({
  logger,
  redact: ['req.headers.authorization', 'req.headers.cookie'],
  customLogLevel: (req, res, err) => {
    if (res.statusCode >= 400 && res.statusCode < 500) {
      return 'warn';
    } else if (res.statusCode >= 500 || err) {
      return 'error';
    }
    return 'info';
  },
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(config.RATE_LIMIT_WINDOW_MS),
  max: parseInt(config.RATE_LIMIT_MAX),
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many requests from this IP, please try again later',
});

app.use('/api/', limiter);

// Health check
app.get('/health', async (req, res) => {
  try {
    // Check database connection
    const dbHealthy = await db.healthCheck();
    
    if (!dbHealthy) {
      return res.status(503).json({
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        checks: {
          database: false,
        },
      });
    }
    
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      checks: {
        database: true,
      },
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      error: 'Health check failed',
    });
  }
});

// Metrics endpoint (for Prometheus)
app.get('/metrics', (req, res) => {
  res.set('Content-Type', 'text/plain');
  res.send(`
# HELP http_requests_total Total number of HTTP requests
# TYPE http_requests_total counter
http_requests_total{method="GET",status="200"} 100

# HELP nodejs_heap_size_used_bytes Process heap size used
# TYPE nodejs_heap_size_used_bytes gauge
nodejs_heap_size_used_bytes ${process.memoryUsage().heapUsed}

# HELP process_uptime_seconds Process uptime in seconds
# TYPE process_uptime_seconds gauge
process_uptime_seconds ${process.uptime()}
  `.trim());
});

// API routes
app.use('/api', routes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: {
      code: 'NOT_FOUND',
      message: 'Route not found',
    },
    timestamp: new Date().toISOString(),
    path: req.path,
  });
});

// Error handling
app.use(errorHandler);

// Graceful shutdown
const gracefulShutdown = async (signal: string) => {
  logger.info(`Received ${signal}, starting graceful shutdown...`);
  
  // Stop accepting new connections
  server.close(() => {
    logger.info('HTTP server closed');
  });
  
  // Close database connection
  try {
    await db.disconnect();
    logger.info('Database connection closed');
  } catch (error) {
    logger.error('Error closing database connection:', error);
  }
  
  // Exit process
  process.exit(0);
};

// Initialize database and start server
const startServer = async () => {
  try {
    // Connect to database
    await db.connect();
    logger.info('Database connected');
    
    // Start server
    const PORT = parseInt(config.PORT);
    const server = app.listen(PORT, '0.0.0.0', () => {
      logger.info(`Server running on port ${PORT} in ${config.NODE_ENV} mode`);
    });
    
    // Handle shutdown signals
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    
    return server;
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

// Export for testing
export { app };

// Start server if not in test mode
if (config.NODE_ENV !== 'test') {
  const server = startServer();
}