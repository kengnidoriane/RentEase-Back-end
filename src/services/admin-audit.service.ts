import { PrismaClient } from '@prisma/client';
import { prisma } from '@/config/database';
import { AdminActivityLog, CreateAdminLogData } from '@/types/admin.types';
import { logger } from '@/utils/logger';

export class AdminAuditService {
  private db: PrismaClient;

  constructor() {
    this.db = prisma;
  }

  /**
   * Log admin activity with enhanced details
   */
  async logActivity(data: CreateAdminLogData): Promise<AdminActivityLog> {
    try {
      const activityLog = await this.db.adminActivityLog.create({
        data: {
          adminId: data.adminId,
          action: data.action,
          targetType: data.targetType,
          targetId: data.targetId,
          details: data.details || {},
          ipAddress: data.ipAddress,
          userAgent: data.userAgent,
          timestamp: new Date(),
        },
        include: {
          admin: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
      });

      logger.info('Admin activity logged:', {
        adminId: data.adminId,
        action: data.action,
        targetType: data.targetType,
        targetId: data.targetId,
        timestamp: activityLog.timestamp,
      });

      return activityLog;
    } catch (error) {
      logger.error('Error logging admin activity:', error);
      throw new Error('Failed to log admin activity');
    }
  }

  /**
   * Get activity logs with advanced filtering
   */
  async getActivityLogs(options: {
    page?: number;
    limit?: number;
    adminId?: string;
    action?: string;
    targetType?: string;
    targetId?: string;
    startDate?: Date;
    endDate?: Date;
  }): Promise<{ logs: AdminActivityLog[]; total: number; summary: any }> {
    try {
      const {
        page = 1,
        limit = 50,
        adminId,
        action,
        targetType,
        targetId,
        startDate,
        endDate,
      } = options;

      const skip = (page - 1) * limit;
      const where: any = {};

      if (adminId) where.adminId = adminId;
      if (action) where.action = action;
      if (targetType) where.targetType = targetType;
      if (targetId) where.targetId = targetId;
      
      if (startDate || endDate) {
        where.timestamp = {};
        if (startDate) where.timestamp.gte = startDate;
        if (endDate) where.timestamp.lte = endDate;
      }

      const [logs, total, actionSummary] = await Promise.all([
        this.db.adminActivityLog.findMany({
          where,
          skip,
          take: limit,
          orderBy: { timestamp: 'desc' },
          include: {
            admin: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
          },
        }),
        this.db.adminActivityLog.count({ where }),
        this.db.adminActivityLog.groupBy({
          by: ['action'],
          where,
          _count: { id: true },
          orderBy: { _count: { id: 'desc' } },
        }),
      ]);

      const summary = {
        totalActions: total,
        actionBreakdown: actionSummary.reduce((acc, item) => {
          acc[item.action] = item._count.id;
          return acc;
        }, {} as Record<string, number>),
      };

      return { logs, total, summary };
    } catch (error) {
      logger.error('Error getting activity logs:', error);
      throw new Error('Failed to get activity logs');
    }
  }

  /**
   * Get admin activity summary for dashboard
   */
  async getActivitySummary(days: number = 30): Promise<{
    totalActions: number;
    uniqueAdmins: number;
    topActions: Array<{ action: string; count: number }>;
    dailyActivity: Array<{ date: string; count: number }>;
  }> {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const [totalActions, uniqueAdmins, topActions, dailyActivity] = await Promise.all([
        this.db.adminActivityLog.count({
          where: { timestamp: { gte: startDate } },
        }),
        this.db.adminActivityLog.findMany({
          where: { timestamp: { gte: startDate } },
          select: { adminId: true },
          distinct: ['adminId'],
        }),
        this.db.adminActivityLog.groupBy({
          by: ['action'],
          where: { timestamp: { gte: startDate } },
          _count: { id: true },
          orderBy: { _count: { id: 'desc' } },
          take: 10,
        }),
        this.db.$queryRaw`
          SELECT 
            DATE(timestamp) as date,
            COUNT(*) as count
          FROM admin_activity_logs 
          WHERE timestamp >= ${startDate}
          GROUP BY DATE(timestamp)
          ORDER BY date DESC
        ` as Array<{ date: Date; count: bigint }>,
      ]);

      return {
        totalActions,
        uniqueAdmins: uniqueAdmins.length,
        topActions: topActions.map(item => ({
          action: item.action,
          count: item._count.id,
        })),
        dailyActivity: dailyActivity.map(item => ({
          date: item.date.toISOString().split('T')[0],
          count: Number(item.count),
        })),
      };
    } catch (error) {
      logger.error('Error getting activity summary:', error);
      throw new Error('Failed to get activity summary');
    }
  }

  /**
   * Get audit trail for specific target
   */
  async getTargetAuditTrail(
    targetType: string,
    targetId: string,
    limit: number = 100
  ): Promise<AdminActivityLog[]> {
    try {
      return await this.db.adminActivityLog.findMany({
        where: {
          targetType,
          targetId,
        },
        include: {
          admin: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
        orderBy: { timestamp: 'desc' },
        take: limit,
      });
    } catch (error) {
      logger.error('Error getting target audit trail:', error);
      throw new Error('Failed to get audit trail');
    }
  }

  /**
   * Clean up old audit logs (for maintenance)
   */
  async cleanupOldLogs(daysToKeep: number = 365): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

      const result = await this.db.adminActivityLog.deleteMany({
        where: {
          timestamp: {
            lt: cutoffDate,
          },
        },
      });

      logger.info(`Cleaned up ${result.count} old admin activity logs`);
      return result.count;
    } catch (error) {
      logger.error('Error cleaning up old logs:', error);
      throw new Error('Failed to cleanup old logs');
    }
  }
}