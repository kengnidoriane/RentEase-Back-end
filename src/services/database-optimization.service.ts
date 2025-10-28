import { PrismaClient } from '@prisma/client';
import { logger } from '@/utils/logger';

/**
 * Database optimization service for query performance monitoring and optimization
 */
export class DatabaseOptimizationService {
  private prisma: PrismaClient;
  private queryMetrics: Map<string, { count: number; totalTime: number; avgTime: number }> = new Map();

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
    this.setupQueryLogging();
  }

  /**
   * Setup query logging and performance monitoring
   */
  private setupQueryLogging(): void {
    // Enable query logging in development
    if (process.env.NODE_ENV === 'development') {
      this.prisma.$on('query', (e) => {
        const queryKey = this.normalizeQuery(e.query);
        const duration = e.duration;

        // Update metrics
        const existing = this.queryMetrics.get(queryKey);
        if (existing) {
          existing.count++;
          existing.totalTime += duration;
          existing.avgTime = existing.totalTime / existing.count;
        } else {
          this.queryMetrics.set(queryKey, {
            count: 1,
            totalTime: duration,
            avgTime: duration,
          });
        }

        // Log slow queries
        if (duration > 1000) { // Queries taking more than 1 second
          logger.warn('Slow query detected', {
            query: e.query,
            duration: `${duration}ms`,
            params: e.params,
          });
        }
      });
    }
  }

  /**
   * Normalize query for metrics tracking
   */
  private normalizeQuery(query: string): string {
    return query
      .replace(/\$\d+/g, '$?') // Replace parameter placeholders
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();
  }

  /**
   * Get query performance metrics
   */
  public getQueryMetrics(): Array<{
    query: string;
    count: number;
    totalTime: number;
    avgTime: number;
  }> {
    return Array.from(this.queryMetrics.entries()).map(([query, metrics]) => ({
      query,
      ...metrics,
    }));
  }

  /**
   * Get slow queries (average time > threshold)
   */
  public getSlowQueries(thresholdMs: number = 500): Array<{
    query: string;
    count: number;
    avgTime: number;
  }> {
    return this.getQueryMetrics()
      .filter(metric => metric.avgTime > thresholdMs)
      .sort((a, b) => b.avgTime - a.avgTime);
  }

  /**
   * Optimize property search queries with proper indexing
   */
  public async optimizedPropertySearch(params: {
    city?: string;
    propertyType?: string;
    minPrice?: number;
    maxPrice?: number;
    bedrooms?: number;
    limit?: number;
    offset?: number;
  }) {
    const {
      city,
      propertyType,
      minPrice,
      maxPrice,
      bedrooms,
      limit = 20,
      offset = 0,
    } = params;

    // Build optimized where clause using indexed fields
    const where: any = {
      isVerified: true,
      isActive: true,
    };

    if (city) {
      where.city = {
        contains: city,
        mode: 'insensitive',
      };
    }

    if (propertyType) {
      where.propertyType = propertyType;
    }

    if (minPrice !== undefined || maxPrice !== undefined) {
      where.price = {};
      if (minPrice !== undefined) where.price.gte = minPrice;
      if (maxPrice !== undefined) where.price.lte = maxPrice;
    }

    if (bedrooms !== undefined) {
      where.bedrooms = bedrooms;
    }

    // Use optimized query with proper select and include
    return this.prisma.property.findMany({
      where,
      select: {
        id: true,
        title: true,
        price: true,
        currency: true,
        propertyType: true,
        bedrooms: true,
        bathrooms: true,
        area: true,
        city: true,
        latitude: true,
        longitude: true,
        createdAt: true,
        landlord: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            isVerified: true,
          },
        },
        images: {
          select: {
            id: true,
            url: true,
            altText: true,
            order: true,
          },
          orderBy: {
            order: 'asc',
          },
          take: 1, // Only get the first image for listing
        },
        _count: {
          select: {
            favorites: true,
          },
        },
      },
      orderBy: [
        { createdAt: 'desc' },
        { id: 'desc' }, // Secondary sort for consistent pagination
      ],
      take: limit,
      skip: offset,
    });
  }

  /**
   * Optimize user messages query with conversation grouping
   */
  public async optimizedUserMessages(userId: string, limit: number = 50) {
    // Get latest message per conversation
    const conversations = await this.prisma.$queryRaw`
      SELECT DISTINCT ON (conversation_id)
        m.id,
        m.content,
        m.is_read,
        m.created_at,
        m.conversation_id,
        m.sender_id,
        m.receiver_id,
        m.property_id,
        sender.first_name as sender_first_name,
        sender.last_name as sender_last_name,
        receiver.first_name as receiver_first_name,
        receiver.last_name as receiver_last_name,
        p.title as property_title
      FROM messages m
      JOIN users sender ON m.sender_id = sender.id
      JOIN users receiver ON m.receiver_id = receiver.id
      JOIN properties p ON m.property_id = p.id
      WHERE m.sender_id = ${userId} OR m.receiver_id = ${userId}
      ORDER BY m.conversation_id, m.created_at DESC
      LIMIT ${limit}
    `;

    return conversations;
  }

  /**
   * Optimize admin statistics queries
   */
  public async optimizedAdminStats() {
    // Use parallel queries for better performance
    const [
      totalUsers,
      totalProperties,
      totalMessages,
      pendingVerifications,
      recentActivity,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.property.count(),
      this.prisma.message.count(),
      this.prisma.property.count({
        where: { verificationStatus: 'PENDING' },
      }),
      this.prisma.adminActivityLog.findMany({
        take: 10,
        orderBy: { timestamp: 'desc' },
        select: {
          id: true,
          action: true,
          targetType: true,
          targetId: true,
          timestamp: true,
          admin: {
            select: {
              firstName: true,
              lastName: true,
            },
          },
        },
      }),
    ]);

    return {
      totalUsers,
      totalProperties,
      totalMessages,
      pendingVerifications,
      recentActivity,
    };
  }

  /**
   * Batch update operations for better performance
   */
  public async batchUpdatePropertyStatus(
    propertyIds: string[],
    status: 'APPROVED' | 'REJECTED',
    rejectionReason?: string
  ) {
    const updateData: any = {
      verificationStatus: status,
      isVerified: status === 'APPROVED',
    };

    if (status === 'REJECTED' && rejectionReason) {
      updateData.rejectionReason = rejectionReason;
    }

    return this.prisma.property.updateMany({
      where: {
        id: {
          in: propertyIds,
        },
      },
      data: updateData,
    });
  }

  /**
   * Cleanup old data for performance
   */
  public async cleanupOldData() {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    // Clean up old notifications
    const deletedNotifications = await this.prisma.notification.deleteMany({
      where: {
        createdAt: {
          lt: thirtyDaysAgo,
        },
        isRead: true,
      },
    });

    // Clean up old admin activity logs
    const deletedLogs = await this.prisma.adminActivityLog.deleteMany({
      where: {
        timestamp: {
          lt: sixMonthsAgo,
        },
      },
    });

    logger.info('Database cleanup completed', {
      deletedNotifications: deletedNotifications.count,
      deletedLogs: deletedLogs.count,
    });

    return {
      deletedNotifications: deletedNotifications.count,
      deletedLogs: deletedLogs.count,
    };
  }

  /**
   * Analyze database performance
   */
  public async analyzePerformance() {
    const slowQueries = this.getSlowQueries(500);
    const totalQueries = Array.from(this.queryMetrics.values()).reduce(
      (sum, metric) => sum + metric.count,
      0
    );
    const avgQueryTime = Array.from(this.queryMetrics.values()).reduce(
      (sum, metric) => sum + metric.avgTime,
      0
    ) / this.queryMetrics.size;

    return {
      totalQueries,
      uniqueQueries: this.queryMetrics.size,
      avgQueryTime: Math.round(avgQueryTime * 100) / 100,
      slowQueries: slowQueries.slice(0, 10), // Top 10 slow queries
      recommendations: this.generateOptimizationRecommendations(slowQueries),
    };
  }

  /**
   * Generate optimization recommendations
   */
  private generateOptimizationRecommendations(slowQueries: any[]): string[] {
    const recommendations: string[] = [];

    if (slowQueries.length > 0) {
      recommendations.push('Consider adding database indexes for slow queries');
    }

    if (slowQueries.some(q => q.query.includes('LIKE') || q.query.includes('ilike'))) {
      recommendations.push('Consider using full-text search for text queries');
    }

    if (slowQueries.some(q => q.query.includes('ORDER BY') && !q.query.includes('LIMIT'))) {
      recommendations.push('Add LIMIT clauses to ordered queries');
    }

    return recommendations;
  }

  /**
   * Reset query metrics
   */
  public resetMetrics(): void {
    this.queryMetrics.clear();
    logger.info('Query metrics reset');
  }
}