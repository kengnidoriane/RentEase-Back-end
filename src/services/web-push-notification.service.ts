import webpush from 'web-push';
import { logger } from '../utils/logger';
import { WebPushNotificationData, NotificationType } from '../types/notification.types';

export interface PushSubscription {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

export class WebPushNotificationService {
  constructor() {
    // Configure web-push with VAPID keys
    const vapidPublicKey = process.env['VAPID_PUBLIC_KEY'];
    const vapidPrivateKey = process.env['VAPID_PRIVATE_KEY'];
    const vapidSubject = process.env['VAPID_SUBJECT'] || 'mailto:admin@rentease.com';

    if (vapidPublicKey && vapidPrivateKey) {
      webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
    } else {
      logger.warn('VAPID keys not configured. Web push notifications will not work.');
    }
  }

  async sendNotification(
    subscription: PushSubscription,
    data: WebPushNotificationData
  ): Promise<boolean> {
    try {
      const payload = this.generatePayload(data);
      
      const options = {
        TTL: 24 * 60 * 60, // 24 hours
        urgency: this.getUrgency(data.type),
      };

      await webpush.sendNotification(subscription, JSON.stringify(payload), options);
      
      logger.info('Web push notification sent successfully', {
        endpoint: subscription.endpoint.substring(0, 50) + '...',
        type: data.type,
      });

      return true;
    } catch (error) {
      logger.error('Failed to send web push notification', {
        error: error instanceof Error ? error.message : 'Unknown error',
        endpoint: subscription.endpoint.substring(0, 50) + '...',
        type: data.type,
      });
      return false;
    }
  }

  async sendToMultipleSubscriptions(
    subscriptions: PushSubscription[],
    data: WebPushNotificationData
  ): Promise<{ successful: number; failed: number }> {
    const results = await Promise.allSettled(
      subscriptions.map(subscription => this.sendNotification(subscription, data))
    );

    const successful = results.filter(result => 
      result.status === 'fulfilled' && result.value === true
    ).length;
    
    const failed = results.length - successful;

    logger.info('Batch web push notification results', {
      total: subscriptions.length,
      successful,
      failed,
      type: data.type,
    });

    return { successful, failed };
  }

  private generatePayload(data: WebPushNotificationData): any {
    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    
    const payload = {
      title: data.title,
      body: data.message,
      icon: data.icon || '/icons/icon-192x192.png',
      badge: data.badge || '/icons/badge-72x72.png',
      tag: data.type,
      data: {
        type: data.type,
        userId: data.userId,
        url: this.getNotificationUrl(data.type, data.data, baseUrl),
        ...data.data,
      },
      actions: data.actions || this.getDefaultActions(data.type, baseUrl),
      requireInteraction: this.requiresInteraction(data.type),
      silent: false,
    };

    return payload;
  }

  private getNotificationUrl(type: NotificationType, data: any, baseUrl: string): string {
    switch (type) {
      case NotificationType.NEW_MESSAGE:
        return `${baseUrl}/messages`;
      
      case NotificationType.FAVORITE_UNAVAILABLE:
        return `${baseUrl}/favorites`;
      
      case NotificationType.PROPERTY_VERIFIED:
      case NotificationType.PROPERTY_APPROVED:
      case NotificationType.PROPERTY_REJECTED:
        return data?.propertyId ? `${baseUrl}/properties/${data.propertyId}` : `${baseUrl}/dashboard`;
      
      case NotificationType.NEW_LISTING_MATCH:
        return `${baseUrl}/search`;
      
      case NotificationType.REMINDER_INACTIVE:
        return baseUrl;
      
      default:
        return baseUrl;
    }
  }

  private getDefaultActions(type: NotificationType, _baseUrl: string): Array<{ action: string; title: string; icon?: string }> {
    switch (type) {
      case NotificationType.NEW_MESSAGE:
        return [
          { action: 'view', title: 'View Message', icon: '/icons/message.png' },
          { action: 'dismiss', title: 'Dismiss' },
        ];
      
      case NotificationType.FAVORITE_UNAVAILABLE:
        return [
          { action: 'search', title: 'Find Similar', icon: '/icons/search.png' },
          { action: 'dismiss', title: 'Dismiss' },
        ];
      
      case NotificationType.PROPERTY_VERIFIED:
      case NotificationType.PROPERTY_APPROVED:
        return [
          { action: 'view', title: 'View Property', icon: '/icons/property.png' },
          { action: 'dismiss', title: 'Dismiss' },
        ];
      
      case NotificationType.PROPERTY_REJECTED:
        return [
          { action: 'edit', title: 'Edit Property', icon: '/icons/edit.png' },
          { action: 'dismiss', title: 'Dismiss' },
        ];
      
      case NotificationType.NEW_LISTING_MATCH:
        return [
          { action: 'view', title: 'View Properties', icon: '/icons/search.png' },
          { action: 'dismiss', title: 'Dismiss' },
        ];
      
      case NotificationType.REMINDER_INACTIVE:
        return [
          { action: 'browse', title: 'Browse Properties', icon: '/icons/home.png' },
          { action: 'dismiss', title: 'Dismiss' },
        ];
      
      default:
        return [
          { action: 'view', title: 'View', icon: '/icons/view.png' },
          { action: 'dismiss', title: 'Dismiss' },
        ];
    }
  }

  private getUrgency(type: NotificationType): 'very-low' | 'low' | 'normal' | 'high' {
    switch (type) {
      case NotificationType.NEW_MESSAGE:
        return 'high';
      
      case NotificationType.FAVORITE_UNAVAILABLE:
      case NotificationType.PROPERTY_APPROVED:
      case NotificationType.PROPERTY_REJECTED:
        return 'normal';
      
      case NotificationType.NEW_LISTING_MATCH:
        return 'normal';
      
      case NotificationType.REMINDER_INACTIVE:
        return 'low';
      
      default:
        return 'normal';
    }
  }

  private requiresInteraction(type: NotificationType): boolean {
    // Only require interaction for important notifications
    return type === NotificationType.NEW_MESSAGE || 
           type === NotificationType.PROPERTY_REJECTED;
  }

  generateVapidKeys(): { publicKey: string; privateKey: string } {
    return webpush.generateVAPIDKeys();
  }

  getPublicKey(): string | null {
    return process.env['VAPID_PUBLIC_KEY'] || null;
  }
}