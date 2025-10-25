import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';
import { NotificationRepository } from '../repositories/notification.repository';
import { EmailNotificationService } from './email-notification.service';
import { WebPushNotificationService } from './web-push-notification.service';
import { UserRepository } from '../repositories/user.repository';
import {
  NotificationData,
  NotificationType,
  NotificationChannel,
  NotificationStatus,
  NotificationHistory,
  NotificationPreferences,
  NotificationFilters,
  NotificationStats,
  PaginatedNotifications,

  UpdateNotificationPreferencesRequest,
} from '../types/notification.types';

export class NotificationService {
  private notificationRepository: NotificationRepository;
  private emailService: EmailNotificationService;
  private webPushService: WebPushNotificationService;
  private userRepository: UserRepository;

  constructor(prisma: PrismaClient) {
    this.notificationRepository = new NotificationRepository(prisma);
    this.emailService = new EmailNotificationService();
    this.webPushService = new WebPushNotificationService();
    this.userRepository = new UserRepository();
  }

  async sendNotification(data: NotificationData, channels?: NotificationChannel[]): Promise<void> {
    try {
      // Get user preferences if channels not specified
      const targetChannels = channels || await this.getEnabledChannels(data.userId, data.type);
      
      // Get user details for email
      const user = await this.userRepository.findById(data.userId);
      if (!user) {
        logger.error('User not found for notification', { userId: data.userId });
        return;
      }

      // Send notifications through each enabled channel
      const promises = targetChannels.map(async (channel) => {
        const notificationRecord = await this.notificationRepository.create({
          userId: data.userId,
          type: data.type,
          title: data.title,
          message: data.message,
          data: data.data,
          channel,
        });

        try {
          let success = false;

          switch (channel) {
            case NotificationChannel.EMAIL:
              success = await this.sendEmailNotification({
                ...data,
                channel,
                recipientEmail: user.email,
              });
              break;

            case NotificationChannel.WEB_PUSH:
              success = await this.sendWebPushNotification({
                ...data,
                channel,
              });
              break;

            case NotificationChannel.IN_APP:
              // In-app notifications are stored in database and marked as sent
              success = true;
              break;
          }

          await this.notificationRepository.updateStatus(
            notificationRecord.id,
            success ? NotificationStatus.SENT : NotificationStatus.FAILED
          );

          logger.info('Notification sent', {
            userId: data.userId,
            type: data.type,
            channel,
            success,
          });
        } catch (error) {
          await this.notificationRepository.updateStatus(
            notificationRecord.id,
            NotificationStatus.FAILED
          );
          
          logger.error('Failed to send notification', {
            userId: data.userId,
            type: data.type,
            channel,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      });

      await Promise.all(promises);
    } catch (error) {
      logger.error('Failed to process notification', {
        userId: data.userId,
        type: data.type,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  private async sendEmailNotification(data: NotificationData & { recipientEmail: string }): Promise<boolean> {
    return await this.emailService.sendEmail({
      ...data,
      channel: NotificationChannel.EMAIL,
    });
  }

  private async sendWebPushNotification(data: NotificationData): Promise<boolean> {
    // TODO: Get user's push subscriptions from database
    // For now, return true as if sent successfully
    logger.info('Web push notification would be sent', {
      userId: data.userId,
      type: data.type,
    });
    return true;
  }

  private async getEnabledChannels(userId: string, type: NotificationType): Promise<NotificationChannel[]> {
    const preferences = await this.notificationRepository.getPreference(userId, type);
    const channels: NotificationChannel[] = [NotificationChannel.IN_APP]; // Always include in-app

    if (!preferences) {
      // Default preferences: enable all channels
      channels.push(NotificationChannel.EMAIL, NotificationChannel.WEB_PUSH);
    } else {
      if (preferences.emailEnabled) {
        channels.push(NotificationChannel.EMAIL);
      }
      if (preferences.webPushEnabled) {
        channels.push(NotificationChannel.WEB_PUSH);
      }
    }

    return channels;
  }

  // Notification History Management
  async getNotifications(
    userId: string,
    filters?: NotificationFilters,
    page = 1,
    limit = 20
  ): Promise<PaginatedNotifications> {
    const { notifications, total } = await this.notificationRepository.findByUserId(
      userId,
      filters,
      page,
      limit
    );

    return {
      notifications,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async markAsRead(notificationId: string): Promise<NotificationHistory | null> {
    return await this.notificationRepository.markAsRead(notificationId);
  }

  async markAllAsRead(userId: string): Promise<number> {
    return await this.notificationRepository.markAllAsRead(userId);
  }

  async getNotificationStats(userId: string): Promise<NotificationStats> {
    return await this.notificationRepository.getStats(userId);
  }

  // Notification Preferences Management
  async getNotificationPreferences(userId: string): Promise<NotificationPreferences[]> {
    const preferences = await this.notificationRepository.getPreferences(userId);
    
    // Ensure all notification types have preferences
    const allTypes = Object.values(NotificationType);
    const existingTypes = preferences.map(p => p.notificationType);
    
    for (const type of allTypes) {
      if (!existingTypes.includes(type)) {
        // Create default preference
        const defaultPreference = await this.notificationRepository.createOrUpdatePreference({
          userId,
          notificationType: type,
          emailEnabled: true,
          webPushEnabled: true,
        });
        preferences.push(defaultPreference);
      }
    }

    return preferences;
  }

  async updateNotificationPreferences(
    userId: string,
    request: UpdateNotificationPreferencesRequest
  ): Promise<NotificationPreferences[]> {
    const updatedPreferences: NotificationPreferences[] = [];

    for (const preference of request.preferences) {
      const updated = await this.notificationRepository.createOrUpdatePreference({
        userId,
        notificationType: preference.notificationType,
        emailEnabled: preference.emailEnabled,
        webPushEnabled: preference.webPushEnabled,
      });
      updatedPreferences.push(updated);
    }

    return updatedPreferences;
  }

  // Specific Notification Methods
  async sendNewMessageNotification(
    recipientId: string,
    senderName: string,
    propertyTitle: string,
    messageContent: string
  ): Promise<void> {
    await this.sendNotification({
      userId: recipientId,
      type: NotificationType.NEW_MESSAGE,
      title: 'New Message',
      message: `${senderName} sent you a message about ${propertyTitle}`,
      data: {
        senderName,
        propertyTitle,
        messageContent,
      },
    });
  }

  async sendFavoriteUnavailableNotification(userId: string, propertyTitle: string): Promise<void> {
    await this.sendNotification({
      userId,
      type: NotificationType.FAVORITE_UNAVAILABLE,
      title: 'Favorite Property No Longer Available',
      message: `The property "${propertyTitle}" that you favorited is no longer available.`,
      data: { propertyTitle },
    });
  }

  async sendBatchFavoriteUnavailableNotifications(
    userId: string,
    unavailableProperties: Array<{ title: string; id: string }>
  ): Promise<void> {
    if (unavailableProperties.length === 0) return;

    if (unavailableProperties.length === 1) {
      await this.sendFavoriteUnavailableNotification(userId, unavailableProperties[0]!.title);
      return;
    }

    await this.sendNotification({
      userId,
      type: NotificationType.FAVORITE_UNAVAILABLE,
      title: 'Multiple Favorite Properties No Longer Available',
      message: `${unavailableProperties.length} of your favorite properties are no longer available.`,
      data: { properties: unavailableProperties },
    });
  }

  async sendPropertyVerifiedNotification(landlordId: string, propertyTitle: string, propertyId: string): Promise<void> {
    await this.sendNotification({
      userId: landlordId,
      type: NotificationType.PROPERTY_VERIFIED,
      title: 'Property Verified',
      message: `Your property "${propertyTitle}" has been verified and is now live.`,
      data: { propertyTitle, propertyId },
    });
  }

  async sendPropertyApprovedNotification(landlordId: string, propertyTitle: string, propertyId: string): Promise<void> {
    await this.sendNotification({
      userId: landlordId,
      type: NotificationType.PROPERTY_APPROVED,
      title: 'Property Approved',
      message: `Your property "${propertyTitle}" has been approved.`,
      data: { propertyTitle, propertyId },
    });
  }

  async sendPropertyRejectedNotification(
    landlordId: string,
    propertyTitle: string,
    propertyId: string,
    rejectionReason: string
  ): Promise<void> {
    await this.sendNotification({
      userId: landlordId,
      type: NotificationType.PROPERTY_REJECTED,
      title: 'Property Needs Review',
      message: `Your property "${propertyTitle}" needs some adjustments.`,
      data: { propertyTitle, propertyId, rejectionReason },
    });
  }

  async sendNewListingMatchNotification(
    userId: string,
    matchCount: number,
    location: string
  ): Promise<void> {
    await this.sendNotification({
      userId,
      type: NotificationType.NEW_LISTING_MATCH,
      title: 'New Properties Match Your Criteria',
      message: `We found ${matchCount} new ${matchCount === 1 ? 'property' : 'properties'} in ${location}.`,
      data: { matchCount, location },
    });
  }

  async sendInactiveUserReminder(userId: string, newListingsCount: number): Promise<void> {
    await this.sendNotification({
      userId,
      type: NotificationType.REMINDER_INACTIVE,
      title: 'We Miss You on RentEase!',
      message: `There are ${newListingsCount} new properties available.`,
      data: { newListingsCount },
    });
  }

  // Batch Operations
  async sendInactiveUserReminders(): Promise<void> {
    try {
      const inactiveUserIds = await this.notificationRepository.getInactiveUsers(7);
      
      for (const userId of inactiveUserIds) {
        // Get count of new listings since user was last active
        // For now, use a placeholder count
        const newListingsCount = 10; // TODO: Calculate actual count
        
        await this.sendInactiveUserReminder(userId, newListingsCount);
      }

      logger.info('Inactive user reminders sent', { count: inactiveUserIds.length });
    } catch (error) {
      logger.error('Failed to send inactive user reminders', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async cleanupOldNotifications(olderThanDays = 30): Promise<number> {
    return await this.notificationRepository.deleteOld(olderThanDays);
  }

  // Utility Methods
  async testEmailService(): Promise<boolean> {
    return await this.emailService.testConnection();
  }

  getWebPushPublicKey(): string | null {
    return this.webPushService.getPublicKey();
  }
}