import { logger } from '../utils/logger';

export interface NotificationData {
  userId: string;
  type: 'FAVORITE_UNAVAILABLE' | 'NEW_MESSAGE' | 'PROPERTY_VERIFIED';
  title: string;
  message: string;
  data?: any;
}

export class NotificationService {
  async sendNotification(notification: NotificationData): Promise<void> {
    try {
      // For now, just log the notification
      // In a real implementation, this would send web push notifications, emails, etc.
      logger.info('Sending notification:', {
        userId: notification.userId,
        type: notification.type,
        title: notification.title,
        message: notification.message,
      });

      // TODO: Implement actual notification sending
      // - Web push notifications
      // - Email notifications
      // - In-app notifications
    } catch (error) {
      logger.error('Failed to send notification:', error);
    }
  }

  async sendFavoriteUnavailableNotification(userId: string, propertyTitle: string): Promise<void> {
    await this.sendNotification({
      userId,
      type: 'FAVORITE_UNAVAILABLE',
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
      type: 'FAVORITE_UNAVAILABLE',
      title: 'Multiple Favorite Properties No Longer Available',
      message: `${unavailableProperties.length} of your favorite properties are no longer available.`,
      data: { properties: unavailableProperties },
    });
  }
}