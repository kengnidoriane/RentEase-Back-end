import { UserRepository } from '@/repositories/user.repository';
import { PropertyRepository } from '@/repositories/property.repository';
import { AdminDashboardStats, AdminActivityLog, CreateAdminLogData } from '@/types/admin.types';
import { logger } from '@/utils/logger';
import { PrismaClient } from '@prisma/client';
import { prisma } from '@/config/database';

export class AdminService {
  private userRepository: UserRepository;
  private propertyRepository: PropertyRepository;
  private db: PrismaClient;

  constructor() {
    this.userRepository = new UserRepository();
    this.propertyRepository = new PropertyRepository(prisma);
    this.db = prisma;
  }

  /**
   * Get comprehensive dashboard statistics
   */
  async getDashboardStats(): Promise<AdminDashboardStats> {
    try {
      const [
        totalUsers,
        totalTenants,
        totalLandlords,
        activeUsers,
        newUsersThisMonth,
        totalProperties,
        verifiedProperties,
        pendingProperties,
        rejectedProperties,
        pendingDocuments,
        totalMessages,
        totalFavorites,
      ] = await Promise.all([
        this.db.user.count({ where: { isActive: true } }),
        this.db.user.count({ where: { userType: 'TENANT', isActive: true } }),
        this.db.user.count({ where: { userType: 'LANDLORD', isActive: true } }),
        this.db.user.count({ where: { isActive: true } }),
        this.db.user.count({
          where: {
            createdAt: {
              gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
            },
          },
        }),
        this.db.property.count({ where: { isActive: true } }),
        this.db.property.count({ where: { verificationStatus: 'APPROVED', isActive: true } }),
        this.db.property.count({ where: { verificationStatus: 'PENDING', isActive: true } }),
        this.db.property.count({ where: { verificationStatus: 'REJECTED', isActive: true } }),
        this.db.verificationDocument.count({ where: { status: 'PENDING' } }),
        this.db.message.count(),
        this.db.favorite.count(),
      ]);

      // Get properties by type
      const propertiesByType = await this.db.property.groupBy({
        by: ['propertyType'],
        where: { isActive: true },
        _count: { id: true },
      });

      // Get properties by city
      const propertiesByCity = await this.db.property.groupBy({
        by: ['city'],
        where: { isActive: true },
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
        take: 10, // Top 10 cities
      });

      const byType: Record<string, number> = {};
      propertiesByType.forEach((item) => {
        byType[item.propertyType] = item._count.id;
      });

      const byCity: Record<string, number> = {};
      propertiesByCity.forEach((item) => {
        byCity[item.city] = item._count.id;
      });

      return {
        users: {
          total: totalUsers,
          tenants: totalTenants,
          landlords: totalLandlords,
          activeUsers,
          newUsersThisMonth,
        },
        properties: {
          total: totalProperties,
          verified: verifiedProperties,
          pending: pendingProperties,
          rejected: rejectedProperties,
          byType,
          byCity,
        },
        verifications: {
          pendingDocuments,
          pendingProperties,
        },
        activity: {
          totalMessages,
          totalFavorites,
        },
      };
    } catch (error) {
      logger.error('Error getting dashboard stats:', error);
      throw new Error('Failed to get dashboard statistics');
    }
  }

  /**
   * Log admin activity for audit trail
   */
  async logAdminActivity(data: CreateAdminLogData): Promise<AdminActivityLog> {
    try {
      const activityLog = await (this.db as any).adminActivityLog.create({
        data: {
          adminId: data.adminId,
          action: data.action,
          targetType: data.targetType,
          targetId: data.targetId,
          details: data.details,
          ipAddress: data.ipAddress,
          userAgent: data.userAgent,
          timestamp: new Date(),
        },
      });

      logger.info('Admin activity logged:', {
        adminId: data.adminId,
        action: data.action,
        targetType: data.targetType,
        targetId: data.targetId,
      });

      return activityLog;
    } catch (error) {
      logger.error('Error logging admin activity:', error);
      throw new Error('Failed to log admin activity');
    }
  }

  /**
   * Get admin activity logs with pagination
   */
  async getActivityLogs(
    page: number = 1,
    limit: number = 50,
    adminId?: string,
    action?: string,
    targetType?: string
  ): Promise<{ logs: AdminActivityLog[]; total: number }> {
    try {
      const skip = (page - 1) * limit;
      const where: any = {};

      if (adminId) where.adminId = adminId;
      if (action) where.action = action;
      if (targetType) where.targetType = targetType;

      const [logs, total] = await Promise.all([
        (this.db as any).adminActivityLog.findMany({
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
        (this.db as any).adminActivityLog.count({ where }),
      ]);

      return { logs, total };
    } catch (error) {
      logger.error('Error getting activity logs:', error);
      throw new Error('Failed to get activity logs');
    }
  }

  /**
   * Suspend user account
   */
  async suspendUser(adminId: string, userId: string, reason: string): Promise<void> {
    try {
      await this.userRepository.update(userId, { isActive: false });

      await this.logAdminActivity({
        adminId,
        action: 'USER_SUSPENDED',
        targetType: 'USER',
        targetId: userId,
        details: { reason },
      });

      logger.info(`User suspended by admin: ${userId}`, { adminId, reason });
    } catch (error) {
      logger.error('Error suspending user:', error);
      throw new Error('Failed to suspend user');
    }
  }

  /**
   * Activate user account
   */
  async activateUser(adminId: string, userId: string): Promise<void> {
    try {
      await this.userRepository.update(userId, { isActive: true });

      await this.logAdminActivity({
        adminId,
        action: 'USER_ACTIVATED',
        targetType: 'USER',
        targetId: userId,
        details: {},
      });

      logger.info(`User activated by admin: ${userId}`, { adminId });
    } catch (error) {
      logger.error('Error activating user:', error);
      throw new Error('Failed to activate user');
    }
  }

  /**
   * Approve property
   */
  async approveProperty(adminId: string, propertyId: string): Promise<void> {
    try {
      await this.propertyRepository.updateVerificationStatus(propertyId, 'APPROVED');

      await this.logAdminActivity({
        adminId,
        action: 'PROPERTY_APPROVED',
        targetType: 'PROPERTY',
        targetId: propertyId,
        details: {},
      });

      logger.info(`Property approved by admin: ${propertyId}`, { adminId });
    } catch (error) {
      logger.error('Error approving property:', error);
      throw new Error('Failed to approve property');
    }
  }

  /**
   * Reject property
   */
  async rejectProperty(adminId: string, propertyId: string, reason: string): Promise<void> {
    try {
      await this.propertyRepository.updateVerificationStatus(propertyId, 'REJECTED', reason);

      await this.logAdminActivity({
        adminId,
        action: 'PROPERTY_REJECTED',
        targetType: 'PROPERTY',
        targetId: propertyId,
        details: { reason },
      });

      logger.info(`Property rejected by admin: ${propertyId}`, { adminId, reason });
    } catch (error) {
      logger.error('Error rejecting property:', error);
      throw new Error('Failed to reject property');
    }
  }

  /**
   * Get user statistics for admin dashboard
   */
  async getUserStatistics(): Promise<{
    totalUsers: number;
    activeUsers: number;
    verifiedUsers: number;
    usersByType: Record<string, number>;
    recentRegistrations: number;
  }> {
    try {
      const [
        totalUsers,
        activeUsers,
        verifiedUsers,
        recentRegistrations,
      ] = await Promise.all([
        this.db.user.count(),
        this.db.user.count({ where: { isActive: true } }),
        this.db.user.count({ where: { isVerified: true } }),
        this.db.user.count({
          where: {
            createdAt: {
              gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
            },
          },
        }),
      ]);

      const usersByTypeData = await this.db.user.groupBy({
        by: ['userType'],
        _count: { id: true },
      });

      const usersByType: Record<string, number> = {};
      usersByTypeData.forEach((item) => {
        usersByType[item.userType] = item._count.id;
      });

      return {
        totalUsers,
        activeUsers,
        verifiedUsers,
        usersByType,
        recentRegistrations,
      };
    } catch (error) {
      logger.error('Error getting user statistics:', error);
      throw new Error('Failed to get user statistics');
    }
  }

  /**
   * Get property statistics for admin dashboard
   */
  async getPropertyStatistics(): Promise<{
    totalProperties: number;
    activeProperties: number;
    verifiedProperties: number;
    pendingProperties: number;
    rejectedProperties: number;
    propertiesByCity: Record<string, number>;
  }> {
    try {
      const [
        totalProperties,
        activeProperties,
        verifiedProperties,
        pendingProperties,
        rejectedProperties,
      ] = await Promise.all([
        this.db.property.count(),
        this.db.property.count({ where: { isActive: true } }),
        this.db.property.count({ where: { verificationStatus: 'APPROVED' } }),
        this.db.property.count({ where: { verificationStatus: 'PENDING' } }),
        this.db.property.count({ where: { verificationStatus: 'REJECTED' } }),
      ]);

      const propertiesByCityData = await this.db.property.groupBy({
        by: ['city'],
        where: { isActive: true },
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
        take: 10,
      });

      const propertiesByCity: Record<string, number> = {};
      propertiesByCityData.forEach((item) => {
        propertiesByCity[item.city] = item._count.id;
      });

      return {
        totalProperties,
        activeProperties,
        verifiedProperties,
        pendingProperties,
        rejectedProperties,
        propertiesByCity,
      };
    } catch (error) {
      logger.error('Error getting property statistics:', error);
      throw new Error('Failed to get property statistics');
    }
  }
}