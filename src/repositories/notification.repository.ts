import { PrismaClient } from '@prisma/client';
import {
  NotificationHistory,
  NotificationPreferences,
  NotificationFilters,
  NotificationStats,
  NotificationType,
  NotificationChannel,
  NotificationStatus,
} from '../types/notification.types';

export class NotificationRepository {
  constructor(private prisma: PrismaClient) {}

  async create(data: {
    userId: string;
    type: NotificationType;
    title: string;
    message: string;
    data?: any;
    channel: NotificationChannel;
    status?: NotificationStatus;
  }): Promise<NotificationHistory> {
    const notification = await this.prisma.notification.create({
      data: {
        userId: data.userId,
        type: data.type,
        title: data.title,
        message: data.message,
        data: data.data,
        channel: data.channel,
        status: data.status || NotificationStatus.PENDING,
      },
    });

    return this.mapToNotificationHistory(notification);
  }

  async findById(id: string): Promise<NotificationHistory | null> {
    const notification = await this.prisma.notification.findUnique({
      where: { id },
    });

    return notification ? this.mapToNotificationHistory(notification) : null;
  }

  async findByUserId(
    userId: string,
    filters?: NotificationFilters,
    page = 1,
    limit = 20
  ): Promise<{ notifications: NotificationHistory[]; total: number }> {
    const where: any = { userId };

    if (filters?.type) where.type = filters.type;
    if (filters?.isRead !== undefined) where.isRead = filters.isRead;
    if (filters?.channel) where.channel = filters.channel;
    if (filters?.status) where.status = filters.status;
    if (filters?.startDate || filters?.endDate) {
      where.createdAt = {};
      if (filters.startDate) where.createdAt.gte = filters.startDate;
      if (filters.endDate) where.createdAt.lte = filters.endDate;
    }

    const [notifications, total] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.notification.count({ where }),
    ]);

    return {
      notifications: notifications.map(this.mapToNotificationHistory),
      total,
    };
  }

  async markAsRead(id: string): Promise<NotificationHistory | null> {
    const notification = await this.prisma.notification.update({
      where: { id },
      data: { isRead: true },
    });

    return this.mapToNotificationHistory(notification);
  }

  async markAllAsRead(userId: string): Promise<number> {
    const result = await this.prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });

    return result.count;
  }

  async updateStatus(id: string, status: NotificationStatus, sentAt?: Date): Promise<NotificationHistory | null> {
    const notification = await this.prisma.notification.update({
      where: { id },
      data: { 
        status,
        ...(sentAt || status === NotificationStatus.SENT ? { sentAt: sentAt || new Date() } : {}),
      },
    });

    return this.mapToNotificationHistory(notification);
  }

  async getStats(userId: string): Promise<NotificationStats> {
    const notifications = await this.prisma.notification.findMany({
      where: { userId },
      select: { type: true, status: true, isRead: true },
    });

    const total = notifications.length;
    const unread = notifications.filter(n => !n.isRead).length;

    const byType = notifications.reduce((acc, n) => {
      acc[n.type] = (acc[n.type] || 0) + 1;
      return acc;
    }, {} as Record<NotificationType, number>);

    const byStatus = notifications.reduce((acc, n) => {
      acc[n.status] = (acc[n.status] || 0) + 1;
      return acc;
    }, {} as Record<NotificationStatus, number>);

    return { total, unread, byType, byStatus };
  }

  async deleteOld(olderThanDays: number): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    const result = await this.prisma.notification.deleteMany({
      where: {
        createdAt: { lt: cutoffDate },
        isRead: true,
      },
    });

    return result.count;
  }

  // Notification Preferences
  async createOrUpdatePreference(data: {
    userId: string;
    notificationType: NotificationType;
    emailEnabled: boolean;
    webPushEnabled: boolean;
  }): Promise<NotificationPreferences> {
    const preference = await this.prisma.notificationPreference.upsert({
      where: {
        userId_notificationType: {
          userId: data.userId,
          notificationType: data.notificationType,
        },
      },
      update: {
        emailEnabled: data.emailEnabled,
        webPushEnabled: data.webPushEnabled,
      },
      create: data,
    });

    return this.mapToNotificationPreferences(preference);
  }

  async getPreferences(userId: string): Promise<NotificationPreferences[]> {
    const preferences = await this.prisma.notificationPreference.findMany({
      where: { userId },
    });

    return preferences.map(this.mapToNotificationPreferences);
  }

  async getPreference(
    userId: string,
    notificationType: NotificationType
  ): Promise<NotificationPreferences | null> {
    const preference = await this.prisma.notificationPreference.findUnique({
      where: {
        userId_notificationType: {
          userId,
          notificationType,
        },
      },
    });

    return preference ? this.mapToNotificationPreferences(preference) : null;
  }

  async getInactiveUsers(daysSinceLastActive: number): Promise<string[]> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysSinceLastActive);

    const users = await this.prisma.user.findMany({
      where: {
        OR: [
          { lastActiveAt: { lt: cutoffDate } },
          { lastActiveAt: null, createdAt: { lt: cutoffDate } },
        ],
        isActive: true,
      },
      select: { id: true },
    });

    return users.map(user => user.id);
  }

  private mapToNotificationHistory(notification: any): NotificationHistory {
    return {
      id: notification.id,
      type: notification.type,
      title: notification.title,
      message: notification.message,
      data: notification.data,
      isRead: notification.isRead,
      channel: notification.channel,
      status: notification.status,
      sentAt: notification.sentAt,
      createdAt: notification.createdAt,
      userId: notification.userId,
    };
  }

  private mapToNotificationPreferences(preference: any): NotificationPreferences {
    return {
      userId: preference.userId,
      notificationType: preference.notificationType,
      emailEnabled: preference.emailEnabled,
      webPushEnabled: preference.webPushEnabled,
    };
  }
}