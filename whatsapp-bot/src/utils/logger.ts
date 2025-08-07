import pino from 'pino';
import * as path from 'path';

const logLevel = process.env.LOG_LEVEL || 'info';
const isDevelopment = process.env.NODE_ENV !== 'production';

// Create logger with appropriate configuration
export const logger = isDevelopment
  ? pino({
      level: logLevel,
      transport: {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'HH:MM:ss',
          ignore: 'pid,hostname',
          singleLine: false,
          messageFormat: '{msg}',
        },
      },
    })
  : pino({
      level: logLevel,
      formatters: {
        level: (label) => {
          return { level: label };
        },
      },
      timestamp: pino.stdTimeFunctions.isoTime,
      redact: {
        paths: ['apiKey', 'password', 'token', 'authorization'],
        censor: '[REDACTED]',
      },
    });

// Add child logger for different modules
export const createLogger = (module: string) => {
  return logger.child({ module });
};