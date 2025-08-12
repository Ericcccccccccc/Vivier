import { UsageStats, ModelUsage, DailyUsage } from './interface';

export interface UsageMetric {
  provider: string;
  model: string;
  tokensUsed: number;
  responseTimeMs: number;
  success: boolean;
  error?: string;
  timestamp: Date;
  cost?: number;
}

export interface UsageSummary {
  totalRequests: number;
  totalTokens: number;
  totalCost: number;
  averageResponseTime: number;
  successRate: number;
  periodStart: Date;
  periodEnd: Date;
}

export interface UsageExport {
  version: string;
  exportDate: Date;
  metrics: UsageMetric[];
  summary: UsageSummary;
  byModel: Record<string, ModelUsage>;
  byDay: Record<string, DailyUsage>;
}

export class UsageTracker {
  private metrics: Map<string, UsageMetric[]>;
  private costRates: Map<string, { input: number; output: number }> = new Map();
  private freeTierLimits: {
    daily: { requests: number; tokens: number };
    monthly: { requests: number; tokens: number };
  } = {
    daily: { requests: 0, tokens: 0 },
    monthly: { requests: 0, tokens: 0 }
  };

  constructor() {
    this.metrics = new Map();
    this.initializeCostRates();
    this.initializeFreeTierLimits();
  }

  private initializeCostRates(): void {
    // Cost per 1k tokens (in USD)
    this.costRates = new Map([
      ['openai/gpt-oss-120b', { input: 0.015, output: 0.06 }],
      ['gpt-4', { input: 0.03, output: 0.06 }],
      ['gpt-3.5-turbo', { input: 0.0015, output: 0.002 }],
      ['claude-3-opus', { input: 0.015, output: 0.075 }],
      ['claude-3-sonnet', { input: 0.003, output: 0.015 }],
    ]);
  }

  private initializeFreeTierLimits(): void {
    this.freeTierLimits = {
      daily: { requests: 100, tokens: 10000 },
      monthly: { requests: 3000, tokens: 300000 },
    };
  }

  record(metric: UsageMetric): void {
    const date = metric.timestamp || new Date();
    const dayKey = this.getDayKey(date);
    
    if (!this.metrics.has(dayKey)) {
      this.metrics.set(dayKey, []);
    }
    
    // Calculate cost if not provided
    if (metric.tokensUsed && !metric.cost) {
      metric.cost = this.calculateCost(metric.model, metric.tokensUsed);
    }
    
    this.metrics.get(dayKey)!.push({
      ...metric,
      timestamp: date,
    });
    
    // Cleanup old metrics (keep last 90 days)
    this.cleanupOldMetrics();
  }

  getDaily(date: Date = new Date()): UsageSummary {
    const dayKey = this.getDayKey(date);
    const dayMetrics = this.metrics.get(dayKey) || [];
    
    return this.calculateSummary(dayMetrics, date, date);
  }

  getMonthly(date: Date = new Date()): UsageSummary {
    const startOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
    const endOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0);
    
    const monthlyMetrics: UsageMetric[] = [];
    
    for (let d = new Date(startOfMonth); d <= endOfMonth; d.setDate(d.getDate() + 1)) {
      const dayKey = this.getDayKey(d);
      const dayMetrics = this.metrics.get(dayKey) || [];
      monthlyMetrics.push(...dayMetrics);
    }
    
    return this.calculateSummary(monthlyMetrics, startOfMonth, endOfMonth);
  }

  getWeekly(date: Date = new Date()): UsageSummary {
    const startOfWeek = new Date(date);
    startOfWeek.setDate(date.getDate() - date.getDay());
    
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    
    const weeklyMetrics: UsageMetric[] = [];
    
    for (let d = new Date(startOfWeek); d <= endOfWeek; d.setDate(d.getDate() + 1)) {
      const dayKey = this.getDayKey(d);
      const dayMetrics = this.metrics.get(dayKey) || [];
      weeklyMetrics.push(...dayMetrics);
    }
    
    return this.calculateSummary(weeklyMetrics, startOfWeek, endOfWeek);
  }

  checkFreeTierLimit(): boolean {
    const daily = this.getDaily();
    const monthly = this.getMonthly();
    
    return (
      daily.totalRequests < this.freeTierLimits.daily.requests &&
      daily.totalTokens < this.freeTierLimits.daily.tokens &&
      monthly.totalRequests < this.freeTierLimits.monthly.requests &&
      monthly.totalTokens < this.freeTierLimits.monthly.tokens
    );
  }

  getFreeTierStatus(): {
    daily: { requestsUsed: number; tokensUsed: number; percentUsed: number };
    monthly: { requestsUsed: number; tokensUsed: number; percentUsed: number };
    withinLimits: boolean;
  } {
    const daily = this.getDaily();
    const monthly = this.getMonthly();
    
    const dailyPercentUsed = Math.max(
      (daily.totalRequests / this.freeTierLimits.daily.requests) * 100,
      (daily.totalTokens / this.freeTierLimits.daily.tokens) * 100
    );
    
    const monthlyPercentUsed = Math.max(
      (monthly.totalRequests / this.freeTierLimits.monthly.requests) * 100,
      (monthly.totalTokens / this.freeTierLimits.monthly.tokens) * 100
    );
    
    return {
      daily: {
        requestsUsed: daily.totalRequests,
        tokensUsed: daily.totalTokens,
        percentUsed: dailyPercentUsed,
      },
      monthly: {
        requestsUsed: monthly.totalRequests,
        tokensUsed: monthly.totalTokens,
        percentUsed: monthlyPercentUsed,
      },
      withinLimits: dailyPercentUsed < 100 && monthlyPercentUsed < 100,
    };
  }

  getUsageStats(): UsageStats {
    const allMetrics: UsageMetric[] = [];
    this.metrics.forEach(dayMetrics => allMetrics.push(...dayMetrics));
    
    const successfulMetrics = allMetrics.filter(m => m.success);
    const failedMetrics = allMetrics.filter(m => !m.success);
    
    const byModel: Record<string, ModelUsage> = {};
    const byDay: Record<string, DailyUsage> = {};
    
    // Group by model
    allMetrics.forEach(metric => {
      if (!byModel[metric.model]) {
        byModel[metric.model] = {
          requests: 0,
          tokens: 0,
          cost: 0,
          averageLatency: 0,
        };
      }
      
      const modelUsage = byModel[metric.model];
      modelUsage.requests++;
      modelUsage.tokens += metric.tokensUsed;
      modelUsage.cost += metric.cost || 0;
      modelUsage.averageLatency = 
        (modelUsage.averageLatency * (modelUsage.requests - 1) + metric.responseTimeMs) / 
        modelUsage.requests;
    });
    
    // Group by day
    this.metrics.forEach((dayMetrics, dayKey) => {
      const failed = dayMetrics.filter(m => !m.success);
      
      byDay[dayKey] = {
        date: dayKey,
        requests: dayMetrics.length,
        tokens: dayMetrics.reduce((sum, m) => sum + m.tokensUsed, 0),
        cost: dayMetrics.reduce((sum, m) => sum + (m.cost || 0), 0),
        errors: failed.length,
      };
    });
    
    const totalRequests = allMetrics.length;
    const totalTokens = allMetrics.reduce((sum, m) => sum + m.tokensUsed, 0);
    const totalCost = allMetrics.reduce((sum, m) => sum + (m.cost || 0), 0);
    const averageResponseTime = successfulMetrics.length > 0
      ? successfulMetrics.reduce((sum, m) => sum + m.responseTimeMs, 0) / successfulMetrics.length
      : 0;
    
    // Calculate cache hit rate (would need cache metrics integration)
    const cacheHitRate = 0; // Placeholder - integrate with cache stats
    
    const errorRate = totalRequests > 0 
      ? (failedMetrics.length / totalRequests) * 100 
      : 0;
    
    return {
      totalRequests,
      totalTokens,
      totalCost,
      averageResponseTime,
      cacheHitRate,
      errorRate,
      byModel,
      byDay,
    };
  }

  exportMetrics(startDate?: Date, endDate?: Date): UsageExport {
    const start = startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // Last 30 days
    const end = endDate || new Date();
    
    const exportMetrics: UsageMetric[] = [];
    
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dayKey = this.getDayKey(d);
      const dayMetrics = this.metrics.get(dayKey) || [];
      exportMetrics.push(...dayMetrics);
    }
    
    const summary = this.calculateSummary(exportMetrics, start, end);
    const stats = this.getUsageStats();
    
    return {
      version: '1.0.0',
      exportDate: new Date(),
      metrics: exportMetrics,
      summary,
      byModel: stats.byModel,
      byDay: stats.byDay,
    };
  }

  importMetrics(data: UsageExport): void {
    data.metrics.forEach(metric => {
      this.record(metric);
    });
  }

  getTopModels(limit: number = 5): Array<{ model: string; usage: ModelUsage }> {
    const stats = this.getUsageStats();
    
    return Object.entries(stats.byModel)
      .sort((a, b) => b[1].requests - a[1].requests)
      .slice(0, limit)
      .map(([model, usage]) => ({ model, usage }));
  }

  getErrorSummary(): {
    totalErrors: number;
    errorsByType: Record<string, number>;
    errorRate: number;
    recentErrors: UsageMetric[];
  } {
    const allMetrics: UsageMetric[] = [];
    this.metrics.forEach(dayMetrics => allMetrics.push(...dayMetrics));
    
    const errors = allMetrics.filter(m => !m.success);
    const errorsByType: Record<string, number> = {};
    
    errors.forEach(error => {
      const errorType = error.error || 'unknown';
      errorsByType[errorType] = (errorsByType[errorType] || 0) + 1;
    });
    
    return {
      totalErrors: errors.length,
      errorsByType,
      errorRate: allMetrics.length > 0 ? (errors.length / allMetrics.length) * 100 : 0,
      recentErrors: errors.slice(-10), // Last 10 errors
    };
  }

  private calculateSummary(
    metrics: UsageMetric[],
    periodStart: Date,
    periodEnd: Date
  ): UsageSummary {
    const successful = metrics.filter(m => m.success);
    
    return {
      totalRequests: metrics.length,
      totalTokens: metrics.reduce((sum, m) => sum + m.tokensUsed, 0),
      totalCost: metrics.reduce((sum, m) => sum + (m.cost || 0), 0),
      averageResponseTime: successful.length > 0
        ? successful.reduce((sum, m) => sum + m.responseTimeMs, 0) / successful.length
        : 0,
      successRate: metrics.length > 0
        ? (successful.length / metrics.length) * 100
        : 100,
      periodStart,
      periodEnd,
    };
  }

  private calculateCost(model: string, tokens: number): number {
    const rates = this.costRates.get(model);
    if (!rates) {
      return 0;
    }
    
    // Simplified cost calculation (assuming equal input/output)
    const avgRate = (rates.input + rates.output) / 2;
    return (tokens / 1000) * avgRate;
  }

  private getDayKey(date: Date): string {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }

  private cleanupOldMetrics(): void {
    const cutoffDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000); // 90 days ago
    
    for (const [dayKey, _] of this.metrics) {
      const [year, month, day] = dayKey.split('-').map(Number);
      const metricDate = new Date(year, month - 1, day);
      
      if (metricDate < cutoffDate) {
        this.metrics.delete(dayKey);
      }
    }
  }

  // Analytics methods
  getPeakUsageHours(): Array<{ hour: number; avgRequests: number }> {
    const hourlyUsage: Record<number, { total: number; count: number }> = {};
    
    this.metrics.forEach(dayMetrics => {
      dayMetrics.forEach(metric => {
        const hour = metric.timestamp.getHours();
        if (!hourlyUsage[hour]) {
          hourlyUsage[hour] = { total: 0, count: 0 };
        }
        hourlyUsage[hour].total++;
        hourlyUsage[hour].count++;
      });
    });
    
    return Object.entries(hourlyUsage)
      .map(([hour, data]) => ({
        hour: parseInt(hour),
        avgRequests: data.total / Math.max(data.count, 1),
      }))
      .sort((a, b) => b.avgRequests - a.avgRequests);
  }

  getCostProjection(days: number = 30): number {
    const recentDays = 7;
    const recentCost = this.getRecentDaysCost(recentDays);
    const dailyAverage = recentCost / recentDays;
    
    return dailyAverage * days;
  }

  private getRecentDaysCost(days: number): number {
    const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    let totalCost = 0;
    
    this.metrics.forEach((dayMetrics, dayKey) => {
      const [year, month, day] = dayKey.split('-').map(Number);
      const metricDate = new Date(year, month - 1, day);
      
      if (metricDate >= cutoffDate) {
        totalCost += dayMetrics.reduce((sum, m) => sum + (m.cost || 0), 0);
      }
    });
    
    return totalCost;
  }
}