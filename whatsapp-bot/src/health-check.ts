import { logger } from './utils/logger';
import { HealthReport } from './types';
import * as os from 'os';
import { WhatsAppBot } from './whatsapp-client';
import { APIClient } from './api-client';

export class HealthCheck {
  private bot: WhatsAppBot;
  private apiClient: APIClient;
  private startTime: Date;

  constructor(bot: WhatsAppBot, apiClient: APIClient) {
    this.bot = bot;
    this.apiClient = apiClient;
    this.startTime = new Date();
  }

  checkConnection(): boolean {
    return this.bot.isConnected();
  }

  async checkAPIConnection(): Promise<boolean> {
    try {
      const result = await this.apiClient.healthCheck();
      return result.status === 'healthy';
    } catch (error) {
      logger.error({ error }, 'API health check failed');
      return false;
    }
  }

  checkMemoryUsage(): {
    used: number;
    total: number;
    percentage: number;
    available: number;
  } {
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const usedMemory = totalMemory - freeMemory;
    const percentage = (usedMemory / totalMemory) * 100;

    return {
      used: usedMemory,
      total: totalMemory,
      percentage: Math.round(percentage),
      available: freeMemory,
    };
  }

  checkProcessMemory(): {
    rss: number;
    heapTotal: number;
    heapUsed: number;
    external: number;
  } {
    const memUsage = process.memoryUsage();
    
    return {
      rss: memUsage.rss,
      heapTotal: memUsage.heapTotal,
      heapUsed: memUsage.heapUsed,
      external: memUsage.external,
    };
  }

  checkQueueStatus(): {
    size: number;
    processing: boolean;
    failed: number;
  } {
    const queueStatus = this.bot.getMessageQueue().getQueueStatus();
    
    return {
      size: queueStatus.size,
      processing: queueStatus.pending > 0,
      failed: queueStatus.failedCount,
    };
  }

  getUptime(): number {
    return Date.now() - this.startTime.getTime();
  }

  getCPUUsage(): {
    user: number;
    system: number;
    percentage: number;
  } {
    const cpus = os.cpus();
    let user = 0;
    let nice = 0;
    let sys = 0;
    let idle = 0;
    let irq = 0;

    for (const cpu of cpus) {
      user += cpu.times.user;
      nice += cpu.times.nice;
      sys += cpu.times.sys;
      idle += cpu.times.idle;
      irq += cpu.times.irq;
    }

    const total = user + nice + sys + idle + irq;
    const percentage = 100 - Math.round((idle / total) * 100);

    return {
      user: Math.round((user / total) * 100),
      system: Math.round((sys / total) * 100),
      percentage,
    };
  }

  async generateHealthReport(): Promise<HealthReport> {
    const isConnected = this.checkConnection();
    const apiHealthy = await this.checkAPIConnection();
    const memory = this.checkMemoryUsage();
    const queue = this.checkQueueStatus();
    const uptime = this.getUptime();

    // Determine overall health status
    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    
    if (!isConnected || !apiHealthy) {
      status = 'unhealthy';
    } else if (memory.percentage > 80 || queue.failed > 10) {
      status = 'degraded';
    }

    const report: HealthReport = {
      status,
      uptime,
      memory: {
        used: memory.used,
        total: memory.total,
        percentage: memory.percentage,
      },
      queue,
      connection: {
        isConnected,
        reconnectAttempts: 0, // This would be tracked in the bot
      },
      api: {
        isReachable: apiHealthy,
        latency: apiHealthy ? await this.getAPILatency() : undefined,
      },
    };

    logger.info({ report }, 'Health report generated');
    return report;
  }

  private async getAPILatency(): Promise<number> {
    const start = Date.now();
    await this.apiClient.healthCheck();
    return Date.now() - start;
  }

  async runDiagnostics(): Promise<{
    status: string;
    checks: Array<{
      name: string;
      status: 'pass' | 'fail' | 'warning';
      message: string;
    }>;
  }> {
    const checks = [];

    // Check WhatsApp connection
    const isConnected = this.checkConnection();
    checks.push({
      name: 'WhatsApp Connection',
      status: isConnected ? 'pass' : 'fail',
      message: isConnected ? 'Connected to WhatsApp' : 'Not connected to WhatsApp',
    });

    // Check API connection
    const apiHealthy = await this.checkAPIConnection();
    checks.push({
      name: 'API Connection',
      status: apiHealthy ? 'pass' : 'fail',
      message: apiHealthy ? 'API is reachable' : 'Cannot reach API',
    });

    // Check memory usage
    const memory = this.checkMemoryUsage();
    const memoryStatus = memory.percentage < 70 ? 'pass' : memory.percentage < 85 ? 'warning' : 'fail';
    checks.push({
      name: 'Memory Usage',
      status: memoryStatus,
      message: `Using ${memory.percentage}% of available memory`,
    });

    // Check process memory
    const processMemory = this.checkProcessMemory();
    const heapUsagePercent = (processMemory.heapUsed / processMemory.heapTotal) * 100;
    const heapStatus = heapUsagePercent < 70 ? 'pass' : heapUsagePercent < 85 ? 'warning' : 'fail';
    checks.push({
      name: 'Heap Usage',
      status: heapStatus,
      message: `Heap usage: ${Math.round(heapUsagePercent)}%`,
    });

    // Check message queue
    const queue = this.checkQueueStatus();
    const queueStatus = queue.failed === 0 ? 'pass' : queue.failed < 5 ? 'warning' : 'fail';
    checks.push({
      name: 'Message Queue',
      status: queueStatus,
      message: `Queue size: ${queue.size}, Failed: ${queue.failed}`,
    });

    // Check CPU usage
    const cpu = this.getCPUUsage();
    const cpuStatus = cpu.percentage < 70 ? 'pass' : cpu.percentage < 85 ? 'warning' : 'fail';
    checks.push({
      name: 'CPU Usage',
      status: cpuStatus,
      message: `CPU usage: ${cpu.percentage}%`,
    });

    // Determine overall status
    const hasFailure = checks.some(c => c.status === 'fail');
    const hasWarning = checks.some(c => c.status === 'warning');
    const overallStatus = hasFailure ? 'unhealthy' : hasWarning ? 'degraded' : 'healthy';

    return {
      status: overallStatus,
      checks,
    };
  }

  startMonitoring(intervalMs = 60000): void {
    setInterval(async () => {
      const report = await this.generateHealthReport();
      
      if (report.status === 'unhealthy') {
        logger.error({ report }, 'System unhealthy');
        
        // Send alert to admin if configured
        if (process.env.ADMIN_WHATSAPP_ID) {
          await this.bot.sendToAdmin('⚠️ Bot health check failed! Check logs for details.');
        }
      } else if (report.status === 'degraded') {
        logger.warn({ report }, 'System degraded');
      }
    }, intervalMs);
    
    logger.info({ intervalMs }, 'Health monitoring started');
  }
}