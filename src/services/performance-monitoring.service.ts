import { Request, Response, NextFunction } from 'express';
import { redisClient } from '@/config/redis';
import { logger } from '@/utils/logger';

interface PerformanceMetrics {
  requestCount: number;
  averageResponseTime: number;
  errorRate: number;
  slowRequests: number;
  memoryUsage: NodeJS.MemoryUsage;
  cpuUsage: number;
  timestamp: Date;
}

interface RequestMetrics {
  path: string;
  method: string;
  statusCode: number;
  responseTime: number;
  timestamp: Date;
  userAgent: string | undefined;
  ip: string | undefined;
}

/**
 * Performance monitoring service for tracking API performance
 */
export class PerformanceMonitoringService {
  private metrics: RequestMetrics[] = [];
  private readonly maxMetricsHistory = 1000;
  private readonly slowRequestThreshold = 2000; // 2 seconds

  /**
   * Middleware to track request performance
   */
  public trackPerformance() {
    return (req: Request, res: Response, next: NextFunction): void => {
      const startTime = Date.now();
      const startMemory = process.memoryUsage();

      // Override res.end to capture response metrics
      const originalEnd = res.end;
      const self = this;
      (res as any).end = function(chunk?: any, encoding?: any) {
        const endTime = Date.now();
        const responseTime = endTime - startTime;
        const endMemory = process.memoryUsage();

        // Record metrics
        const metrics: RequestMetrics = {
          path: req.path,
          method: req.method,
          statusCode: res.statusCode,
          responseTime,
          timestamp: new Date(),
          userAgent: req.get('User-Agent'),
          ip: req.ip,
        };

        // Add to metrics history
        self.addMetrics(metrics);

        // Log slow requests
        if (responseTime > self.slowRequestThreshold) {
          logger.warn('Slow request detected', {
            ...metrics,
            memoryDelta: {
              rss: endMemory.rss - startMemory.rss,
              heapUsed: endMemory.heapUsed - startMemory.heapUsed,
            },
          });
        }

        // Log errors
        if (res.statusCode >= 400) {
          logger.error('Request error', metrics);
        }

        // Add performance headers
        res.set({
          'X-Response-Time': `${responseTime}ms`,
          'X-Memory-Usage': `${Math.round(endMemory.heapUsed / 1024 / 1024)}MB`,
        });

        return originalEnd.call(this, chunk, encoding);
      };

      next();
    };
  }

  /**
   * Add metrics to history
   */
  private addMetrics(metrics: RequestMetrics): void {
    this.metrics.push(metrics);

    // Keep only recent metrics
    if (this.metrics.length > this.maxMetricsHistory) {
      this.metrics = this.metrics.slice(-this.maxMetricsHistory);
    }

    // Store in Redis for persistence
    this.storeMetricsInRedis(metrics).catch(error => {
      logger.error('Failed to store metrics in Redis:', error);
    });
  }

  /**
   * Store metrics in Redis
   */
  private async storeMetricsInRedis(metrics: RequestMetrics): Promise<void> {
    try {
      const key = `performance:${Date.now()}`;
      await redisClient.setEx(key, 3600, JSON.stringify(metrics)); // Store for 1 hour
    } catch (error) {
      logger.error('Redis metrics storage error:', error);
    }
  }

  /**
   * Get current performance metrics
   */
  public getPerformanceMetrics(): PerformanceMetrics {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    
    // Filter recent metrics
    const recentMetrics = this.metrics.filter(m => m.timestamp >= oneHourAgo);
    
    if (recentMetrics.length === 0) {
      return {
        requestCount: 0,
        averageResponseTime: 0,
        errorRate: 0,
        slowRequests: 0,
        memoryUsage: process.memoryUsage(),
        cpuUsage: process.cpuUsage().user / 1000000, // Convert to seconds
        timestamp: now,
      };
    }

    const totalResponseTime = recentMetrics.reduce((sum, m) => sum + m.responseTime, 0);
    const errorCount = recentMetrics.filter(m => m.statusCode >= 400).length;
    const slowRequestCount = recentMetrics.filter(m => m.responseTime > this.slowRequestThreshold).length;

    return {
      requestCount: recentMetrics.length,
      averageResponseTime: Math.round(totalResponseTime / recentMetrics.length),
      errorRate: Math.round((errorCount / recentMetrics.length) * 100 * 100) / 100,
      slowRequests: slowRequestCount,
      memoryUsage: process.memoryUsage(),
      cpuUsage: Math.round(process.cpuUsage().user / 1000000 * 100) / 100,
      timestamp: now,
    };
  }

  /**
   * Get endpoint performance statistics
   */
  public getEndpointStats(): Array<{
    endpoint: string;
    method: string;
    requestCount: number;
    averageResponseTime: number;
    errorRate: number;
    slowRequests: number;
  }> {
    const endpointMap = new Map<string, RequestMetrics[]>();

    // Group metrics by endpoint
    this.metrics.forEach(metric => {
      const key = `${metric.method} ${metric.path}`;
      if (!endpointMap.has(key)) {
        endpointMap.set(key, []);
      }
      endpointMap.get(key)!.push(metric);
    });

    // Calculate stats for each endpoint
    return Array.from(endpointMap.entries()).map(([endpoint, metrics]) => {
      const [method, path] = endpoint.split(' ', 2);
      const totalResponseTime = metrics.reduce((sum, m) => sum + m.responseTime, 0);
      const errorCount = metrics.filter(m => m.statusCode >= 400).length;
      const slowRequestCount = metrics.filter(m => m.responseTime > this.slowRequestThreshold).length;

      return {
        endpoint: path || '',
        method: method || '',
        requestCount: metrics.length,
        averageResponseTime: Math.round(totalResponseTime / metrics.length),
        errorRate: Math.round((errorCount / metrics.length) * 100 * 100) / 100,
        slowRequests: slowRequestCount,
      };
    }).sort((a, b) => b.requestCount - a.requestCount);
  }

  /**
   * Get system health status
   */
  public getHealthStatus(): {
    status: 'healthy' | 'warning' | 'critical';
    checks: Array<{
      name: string;
      status: 'pass' | 'warn' | 'fail';
      value?: any;
      threshold?: any;
    }>;
  } {
    const metrics = this.getPerformanceMetrics();
    const checks = [];

    // Memory usage check
    const memoryUsagePercent = (metrics.memoryUsage.heapUsed / metrics.memoryUsage.heapTotal) * 100;
    checks.push({
      name: 'memory_usage',
      status: (memoryUsagePercent > 90 ? 'fail' : memoryUsagePercent > 70 ? 'warn' : 'pass') as 'pass' | 'warn' | 'fail',
      value: `${Math.round(memoryUsagePercent)}%`,
      threshold: '70%/90%',
    });

    // Response time check
    checks.push({
      name: 'average_response_time',
      status: (metrics.averageResponseTime > 2000 ? 'fail' : metrics.averageResponseTime > 1000 ? 'warn' : 'pass') as 'pass' | 'warn' | 'fail',
      value: `${metrics.averageResponseTime}ms`,
      threshold: '1000ms/2000ms',
    });

    // Error rate check
    checks.push({
      name: 'error_rate',
      status: (metrics.errorRate > 10 ? 'fail' : metrics.errorRate > 5 ? 'warn' : 'pass') as 'pass' | 'warn' | 'fail',
      value: `${metrics.errorRate}%`,
      threshold: '5%/10%',
    });

    // Slow requests check
    const slowRequestRate = metrics.requestCount > 0 ? (metrics.slowRequests / metrics.requestCount) * 100 : 0;
    checks.push({
      name: 'slow_requests',
      status: (slowRequestRate > 20 ? 'fail' : slowRequestRate > 10 ? 'warn' : 'pass') as 'pass' | 'warn' | 'fail',
      value: `${Math.round(slowRequestRate * 100) / 100}%`,
      threshold: '10%/20%',
    });

    // Determine overall status
    const failCount = checks.filter(c => c.status === 'fail').length;
    const warnCount = checks.filter(c => c.status === 'warn').length;

    let status: 'healthy' | 'warning' | 'critical';
    if (failCount > 0) {
      status = 'critical';
    } else if (warnCount > 0) {
      status = 'warning';
    } else {
      status = 'healthy';
    }

    return { status, checks };
  }

  /**
   * Get performance alerts
   */
  public getPerformanceAlerts(): Array<{
    type: 'warning' | 'critical';
    message: string;
    timestamp: Date;
    details?: any;
  }> {
    const alerts = [];
    const metrics = this.getPerformanceMetrics();
    const now = new Date();

    // High memory usage alert
    const memoryUsagePercent = (metrics.memoryUsage.heapUsed / metrics.memoryUsage.heapTotal) * 100;
    if (memoryUsagePercent > 90) {
      alerts.push({
        type: 'critical' as const,
        message: `Critical memory usage: ${Math.round(memoryUsagePercent)}%`,
        timestamp: now,
        details: { memoryUsage: metrics.memoryUsage },
      });
    } else if (memoryUsagePercent > 70) {
      alerts.push({
        type: 'warning' as const,
        message: `High memory usage: ${Math.round(memoryUsagePercent)}%`,
        timestamp: now,
        details: { memoryUsage: metrics.memoryUsage },
      });
    }

    // High error rate alert
    if (metrics.errorRate > 10) {
      alerts.push({
        type: 'critical' as const,
        message: `Critical error rate: ${metrics.errorRate}%`,
        timestamp: now,
        details: { errorRate: metrics.errorRate, requestCount: metrics.requestCount },
      });
    } else if (metrics.errorRate > 5) {
      alerts.push({
        type: 'warning' as const,
        message: `High error rate: ${metrics.errorRate}%`,
        timestamp: now,
        details: { errorRate: metrics.errorRate, requestCount: metrics.requestCount },
      });
    }

    // Slow response time alert
    if (metrics.averageResponseTime > 2000) {
      alerts.push({
        type: 'critical' as const,
        message: `Critical response time: ${metrics.averageResponseTime}ms`,
        timestamp: now,
        details: { averageResponseTime: metrics.averageResponseTime },
      });
    } else if (metrics.averageResponseTime > 1000) {
      alerts.push({
        type: 'warning' as const,
        message: `Slow response time: ${metrics.averageResponseTime}ms`,
        timestamp: now,
        details: { averageResponseTime: metrics.averageResponseTime },
      });
    }

    return alerts;
  }

  /**
   * Clear metrics history
   */
  public clearMetrics(): void {
    this.metrics = [];
    logger.info('Performance metrics cleared');
  }

  /**
   * Export metrics for external monitoring
   */
  public exportMetrics() {
    return {
      summary: this.getPerformanceMetrics(),
      endpoints: this.getEndpointStats(),
      health: this.getHealthStatus(),
      alerts: this.getPerformanceAlerts(),
    };
  }
}

// Global instance
export const performanceMonitor = new PerformanceMonitoringService();