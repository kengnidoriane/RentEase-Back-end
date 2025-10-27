import webpush from 'web-push';
import { WebPushNotificationService, PushSubscription } from '../../services/web-push-notification.service';
import { NotificationType, NotificationChannel } from '../../types/notification.types';
import { logger } from '../../utils/logger';

// Mock web-push
jest.mock('web-push');
jest.mock('../../utils/logger');

describe('WebPushNotificationService', () => {
  let webPushService: WebPushNotificationService;
  const mockWebPush = webpush as jest.Mocked<typeof webpush>;

  const mockSubscription: PushSubscription = {
    endpoint: 'https://fcm.googleapis.com/fcm/send/test-endpoint',
    keys: {
      p256dh: 'test-p256dh-key',
      auth: 'test-auth-key',
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Set up environment variables
    (process.env as any)['VAPID_PUBLIC_KEY'] = 'test-public-key';
    (process.env as any)['VAPID_PRIVATE_KEY'] = 'test-private-key';
    (process.env as any)['VAPID_SUBJECT'] = 'mailto:test@rentease.com';
    (process.env as any)['FRONTEND_URL'] = 'https://rentease.com';

    webPushService = new WebPushNotificationService();
  });

  afterEach(() => {
    delete (process.env as any).VAPID_PUBLIC_KEY;
    delete (process.env as any).VAPID_PRIVATE_KEY;
    delete (process.env as any).VAPID_SUBJECT;
    delete (process.env as any).FRONTEND_URL;
  });

  describe('constructor', () => {
    it('should configure VAPID details when keys are provided', () => {
      new WebPushNotificationService();

      expect(mockWebPush.setVapidDetails).toHaveBeenCalledWith(
        'mailto:test@rentease.com',
        'test-public-key',
        'test-private-key'
      );
    });

    it('should use default subject when not provided', () => {
      const originalSubject = (process.env as any)['VAPID_SUBJECT'];
      delete (process.env as any).VAPID_SUBJECT;

      new WebPushNotificationService();

      expect(mockWebPush.setVapidDetails).toHaveBeenCalledWith(
        'mailto:admin@rentease.com',
        'test-public-key',
        'test-private-key'
      );

      // Restore original value
      (process.env as any)['VAPID_SUBJECT'] = originalSubject;
    });

    it('should log warning when VAPID keys are not configured', () => {
      const originalPublic = (process.env as any)['VAPID_PUBLIC_KEY'];
      const originalPrivate = (process.env as any)['VAPID_PRIVATE_KEY'];
      
      delete (process.env as any).VAPID_PUBLIC_KEY;
      delete (process.env as any).VAPID_PRIVATE_KEY;

      // Clear previous mock calls
      mockWebPush.setVapidDetails.mockClear();

      new WebPushNotificationService();

      expect(mockWebPush.setVapidDetails).not.toHaveBeenCalled();
      expect(logger.warn).toHaveBeenCalledWith(
        'VAPID keys not configured. Web push notifications will not work.'
      );

      // Restore original values
      (process.env as any)['VAPID_PUBLIC_KEY'] = originalPublic;
      (process.env as any)['VAPID_PRIVATE_KEY'] = originalPrivate;
    });
  });

  describe('sendNotification', () => {
    const mockNotificationData = {
      userId: 'user-1',
      type: NotificationType.NEW_MESSAGE,
      title: 'New Message',
      message: 'You have a new message from John',
      channel: NotificationChannel.WEB_PUSH as const,
      data: {
        senderName: 'John Doe',
        propertyTitle: 'Nice Apartment',
      },
    };

    it('should send web push notification successfully', async () => {
      mockWebPush.sendNotification.mockResolvedValue({} as any);

      const result = await webPushService.sendNotification(mockSubscription, mockNotificationData);

      expect(result).toBe(true);
      expect(mockWebPush.sendNotification).toHaveBeenCalledWith(
        mockSubscription,
        expect.stringContaining('"title":"New Message"'),
        {
          TTL: 24 * 60 * 60,
          urgency: 'high',
        }
      );
      expect(logger.info).toHaveBeenCalledWith('Web push notification sent successfully', {
        endpoint: 'https://fcm.googleapis.com/fcm/send/test-endpoint...',
        type: NotificationType.NEW_MESSAGE,
      });
    });

    it('should handle notification sending failure', async () => {
      const error = new Error('Push service unavailable');
      mockWebPush.sendNotification.mockRejectedValue(error);

      const result = await webPushService.sendNotification(mockSubscription, mockNotificationData);

      expect(result).toBe(false);
      expect(logger.error).toHaveBeenCalledWith('Failed to send web push notification', {
        error: 'Push service unavailable',
        endpoint: 'https://fcm.googleapis.com/fcm/send/test-endpoint...',
        type: NotificationType.NEW_MESSAGE,
      });
    });

    it('should generate correct payload for new message notification', async () => {
      mockWebPush.sendNotification.mockResolvedValue({} as any);

      await webPushService.sendNotification(mockSubscription, mockNotificationData);

      const payloadString = mockWebPush.sendNotification.mock.calls[0]![1] as string;
      const payload = JSON.parse(payloadString);

      expect(payload).toMatchObject({
        title: 'New Message',
        body: 'You have a new message from John',
        icon: '/icons/icon-192x192.png',
        badge: '/icons/badge-72x72.png',
        tag: NotificationType.NEW_MESSAGE,
        data: {
          type: NotificationType.NEW_MESSAGE,
          userId: 'user-1',
          url: 'https://rentease.com/messages',
          senderName: 'John Doe',
          propertyTitle: 'Nice Apartment',
        },
        requireInteraction: true,
        silent: false,
      });

      expect(payload.actions).toEqual([
        { action: 'view', title: 'View Message', icon: '/icons/message.png' },
        { action: 'dismiss', title: 'Dismiss' },
      ]);
    });

    it('should use custom icon and badge when provided', async () => {
      const customNotificationData = {
        ...mockNotificationData,
        icon: '/custom-icon.png',
        badge: '/custom-badge.png',
      };

      mockWebPush.sendNotification.mockResolvedValue({} as any);

      await webPushService.sendNotification(mockSubscription, customNotificationData);

      const payloadString = mockWebPush.sendNotification.mock.calls[0]![1] as string;
      const payload = JSON.parse(payloadString);

      expect(payload.icon).toBe('/custom-icon.png');
      expect(payload.badge).toBe('/custom-badge.png');
    });

    it('should use custom actions when provided', async () => {
      const customActions = [
        { action: 'reply', title: 'Reply', icon: '/reply.png' },
        { action: 'archive', title: 'Archive' },
      ];

      const customNotificationData = {
        ...mockNotificationData,
        actions: customActions,
      };

      mockWebPush.sendNotification.mockResolvedValue({} as any);

      await webPushService.sendNotification(mockSubscription, customNotificationData);

      const payloadString = mockWebPush.sendNotification.mock.calls[0]![1] as string;
      const payload = JSON.parse(payloadString);

      expect(payload.actions).toEqual(customActions);
    });
  });

  describe('sendToMultipleSubscriptions', () => {
    const mockSubscriptions: PushSubscription[] = [
      mockSubscription,
      {
        endpoint: 'https://fcm.googleapis.com/fcm/send/test-endpoint-2',
        keys: { p256dh: 'key2', auth: 'auth2' },
      },
      {
        endpoint: 'https://fcm.googleapis.com/fcm/send/test-endpoint-3',
        keys: { p256dh: 'key3', auth: 'auth3' },
      },
    ];

    const mockNotificationData = {
      userId: 'user-1',
      type: NotificationType.FAVORITE_UNAVAILABLE,
      title: 'Property Unavailable',
      message: 'Your favorite property is no longer available',
      channel: NotificationChannel.WEB_PUSH as const,
    };

    it('should send notifications to all subscriptions successfully', async () => {
      mockWebPush.sendNotification.mockResolvedValue({} as any);

      const result = await webPushService.sendToMultipleSubscriptions(
        mockSubscriptions,
        mockNotificationData
      );

      expect(result).toEqual({ successful: 3, failed: 0 });
      expect(mockWebPush.sendNotification).toHaveBeenCalledTimes(3);
      expect(logger.info).toHaveBeenCalledWith('Batch web push notification results', {
        total: 3,
        successful: 3,
        failed: 0,
        type: NotificationType.FAVORITE_UNAVAILABLE,
      });
    });

    it('should handle partial failures', async () => {
      mockWebPush.sendNotification
        .mockResolvedValueOnce({} as any) // First succeeds
        .mockRejectedValueOnce(new Error('Failed')) // Second fails
        .mockResolvedValueOnce({} as any); // Third succeeds

      const result = await webPushService.sendToMultipleSubscriptions(
        mockSubscriptions,
        mockNotificationData
      );

      expect(result).toEqual({ successful: 2, failed: 1 });
      expect(mockWebPush.sendNotification).toHaveBeenCalledTimes(3);
    });

    it('should handle all failures', async () => {
      mockWebPush.sendNotification.mockRejectedValue(new Error('Service unavailable'));

      const result = await webPushService.sendToMultipleSubscriptions(
        mockSubscriptions,
        mockNotificationData
      );

      expect(result).toEqual({ successful: 0, failed: 3 });
    });
  });

  describe('payload generation for different notification types', () => {
    beforeEach(() => {
      mockWebPush.sendNotification.mockResolvedValue({} as any);
    });

    it('should generate correct URL for favorite unavailable notification', async () => {
      const notificationData = {
        userId: 'user-1',
        type: NotificationType.FAVORITE_UNAVAILABLE,
        title: 'Property Unavailable',
        message: 'Property no longer available',
        channel: NotificationChannel.WEB_PUSH as const,
      };

      await webPushService.sendNotification(mockSubscription, notificationData);

      const payloadString = mockWebPush.sendNotification.mock.calls[0]![1] as string;
      const payload = JSON.parse(payloadString);

      expect(payload.data.url).toBe('https://rentease.com/favorites');
      expect(payload.actions).toEqual([
        { action: 'search', title: 'Find Similar', icon: '/icons/search.png' },
        { action: 'dismiss', title: 'Dismiss' },
      ]);
    });

    it('should generate correct URL for property verified notification', async () => {
      const notificationData = {
        userId: 'landlord-1',
        type: NotificationType.PROPERTY_VERIFIED,
        title: 'Property Verified',
        message: 'Your property has been verified',
        channel: NotificationChannel.WEB_PUSH as const,
        data: { propertyId: 'prop-123' },
      };

      await webPushService.sendNotification(mockSubscription, notificationData);

      const payloadString = mockWebPush.sendNotification.mock.calls[0]![1] as string;
      const payload = JSON.parse(payloadString);

      expect(payload.data.url).toBe('https://rentease.com/properties/prop-123');
      expect(payload.actions).toEqual([
        { action: 'view', title: 'View Property', icon: '/icons/property.png' },
        { action: 'dismiss', title: 'Dismiss' },
      ]);
    });

    it('should generate correct URL for property rejected notification', async () => {
      const notificationData = {
        userId: 'landlord-1',
        type: NotificationType.PROPERTY_REJECTED,
        title: 'Property Needs Review',
        message: 'Your property needs adjustments',
        channel: NotificationChannel.WEB_PUSH as const,
        data: { propertyId: 'prop-123' },
      };

      await webPushService.sendNotification(mockSubscription, notificationData);

      const payloadString = mockWebPush.sendNotification.mock.calls[0]![1] as string;
      const payload = JSON.parse(payloadString);

      expect(payload.data.url).toBe('https://rentease.com/properties/prop-123');
      expect(payload.actions).toEqual([
        { action: 'edit', title: 'Edit Property', icon: '/icons/edit.png' },
        { action: 'dismiss', title: 'Dismiss' },
      ]);
      expect(payload.requireInteraction).toBe(true);
    });

    it('should generate correct URL for new listing match notification', async () => {
      const notificationData = {
        userId: 'user-1',
        type: NotificationType.NEW_LISTING_MATCH,
        title: 'New Properties Available',
        message: 'Found 3 new properties',
        channel: NotificationChannel.WEB_PUSH as const,
      };

      await webPushService.sendNotification(mockSubscription, notificationData);

      const payloadString = mockWebPush.sendNotification.mock.calls[0]![1] as string;
      const payload = JSON.parse(payloadString);

      expect(payload.data.url).toBe('https://rentease.com/search');
      expect(payload.actions).toEqual([
        { action: 'view', title: 'View Properties', icon: '/icons/search.png' },
        { action: 'dismiss', title: 'Dismiss' },
      ]);
    });

    it('should generate correct URL for inactive user reminder', async () => {
      const notificationData = {
        userId: 'user-1',
        type: NotificationType.REMINDER_INACTIVE,
        title: 'We Miss You!',
        message: 'Check out new properties',
        channel: NotificationChannel.WEB_PUSH as const,
      };

      await webPushService.sendNotification(mockSubscription, notificationData);

      const payloadString = mockWebPush.sendNotification.mock.calls[0]![1] as string;
      const payload = JSON.parse(payloadString);

      expect(payload.data.url).toBe('https://rentease.com');
      expect(payload.actions).toEqual([
        { action: 'browse', title: 'Browse Properties', icon: '/icons/home.png' },
        { action: 'dismiss', title: 'Dismiss' },
      ]);
    });

    it('should use dashboard URL when property ID is missing', async () => {
      const notificationData = {
        userId: 'landlord-1',
        type: NotificationType.PROPERTY_VERIFIED,
        title: 'Property Verified',
        message: 'Your property has been verified',
        channel: NotificationChannel.WEB_PUSH as const,
        data: {}, // No propertyId
      };

      await webPushService.sendNotification(mockSubscription, notificationData);

      const payloadString = mockWebPush.sendNotification.mock.calls[0]![1] as string;
      const payload = JSON.parse(payloadString);

      expect(payload.data.url).toBe('https://rentease.com/dashboard');
    });
  });

  describe('urgency levels', () => {
    beforeEach(() => {
      mockWebPush.sendNotification.mockResolvedValue({} as any);
    });

    it('should set high urgency for new message notifications', async () => {
      const notificationData = {
        userId: 'user-1',
        type: NotificationType.NEW_MESSAGE,
        title: 'New Message',
        message: 'You have a message',
        channel: NotificationChannel.WEB_PUSH as const,
      };

      await webPushService.sendNotification(mockSubscription, notificationData);

      expect(mockWebPush.sendNotification).toHaveBeenCalledWith(
        mockSubscription,
        expect.any(String),
        expect.objectContaining({ urgency: 'high' })
      );
    });

    it('should set normal urgency for property notifications', async () => {
      const notificationData = {
        userId: 'user-1',
        type: NotificationType.PROPERTY_APPROVED,
        title: 'Property Approved',
        message: 'Your property was approved',
        channel: NotificationChannel.WEB_PUSH as const,
      };

      await webPushService.sendNotification(mockSubscription, notificationData);

      expect(mockWebPush.sendNotification).toHaveBeenCalledWith(
        mockSubscription,
        expect.any(String),
        expect.objectContaining({ urgency: 'normal' })
      );
    });

    it('should set low urgency for inactive user reminders', async () => {
      const notificationData = {
        userId: 'user-1',
        type: NotificationType.REMINDER_INACTIVE,
        title: 'We Miss You',
        message: 'Come back',
        channel: NotificationChannel.WEB_PUSH as const,
      };

      await webPushService.sendNotification(mockSubscription, notificationData);

      expect(mockWebPush.sendNotification).toHaveBeenCalledWith(
        mockSubscription,
        expect.any(String),
        expect.objectContaining({ urgency: 'low' })
      );
    });
  });

  describe('requireInteraction', () => {
    beforeEach(() => {
      mockWebPush.sendNotification.mockResolvedValue({} as any);
    });

    it('should require interaction for new message notifications', async () => {
      const notificationData = {
        userId: 'user-1',
        type: NotificationType.NEW_MESSAGE,
        title: 'New Message',
        message: 'You have a message',
        channel: NotificationChannel.WEB_PUSH as const,
      };

      await webPushService.sendNotification(mockSubscription, notificationData);

      const payloadString = mockWebPush.sendNotification.mock.calls[0]![1] as string;
      const payload = JSON.parse(payloadString);

      expect(payload.requireInteraction).toBe(true);
    });

    it('should require interaction for property rejected notifications', async () => {
      const notificationData = {
        userId: 'user-1',
        type: NotificationType.PROPERTY_REJECTED,
        title: 'Property Rejected',
        message: 'Property needs review',
        channel: NotificationChannel.WEB_PUSH as const,
      };

      await webPushService.sendNotification(mockSubscription, notificationData);

      const payloadString = mockWebPush.sendNotification.mock.calls[0]![1] as string;
      const payload = JSON.parse(payloadString);

      expect(payload.requireInteraction).toBe(true);
    });

    it('should not require interaction for other notification types', async () => {
      const notificationData = {
        userId: 'user-1',
        type: NotificationType.FAVORITE_UNAVAILABLE,
        title: 'Property Unavailable',
        message: 'Property no longer available',
        channel: NotificationChannel.WEB_PUSH as const,
      };

      await webPushService.sendNotification(mockSubscription, notificationData);

      const payloadString = mockWebPush.sendNotification.mock.calls[0]![1] as string;
      const payload = JSON.parse(payloadString);

      expect(payload.requireInteraction).toBe(false);
    });
  });

  describe('utility methods', () => {
    it('should generate VAPID keys', () => {
      const mockKeys = { publicKey: 'pub-key', privateKey: 'priv-key' };
      mockWebPush.generateVAPIDKeys.mockReturnValue(mockKeys);

      const result = webPushService.generateVapidKeys();

      expect(result).toEqual(mockKeys);
      expect(mockWebPush.generateVAPIDKeys).toHaveBeenCalled();
    });

    it('should return public key when configured', () => {
      const result = webPushService.getPublicKey();

      expect(result).toBe('test-public-key');
    });

    it('should return null when public key is not configured', () => {
      const originalKey = (process.env as any)['VAPID_PUBLIC_KEY'];
      delete (process.env as any).VAPID_PUBLIC_KEY;

      const newService = new WebPushNotificationService();
      const result = newService.getPublicKey();

      expect(result).toBeNull();

      // Restore original value
      (process.env as any)['VAPID_PUBLIC_KEY'] = originalKey;
    });
  });

  describe('default frontend URL', () => {
    it('should use default URL when FRONTEND_URL is not set', async () => {
      const originalUrl = (process.env as any)['FRONTEND_URL'];
      delete (process.env as any).FRONTEND_URL;
      mockWebPush.sendNotification.mockResolvedValue({} as any);

      const notificationData = {
        userId: 'user-1',
        type: NotificationType.NEW_MESSAGE,
        title: 'New Message',
        message: 'You have a message',
        channel: NotificationChannel.WEB_PUSH as const,
      };

      await webPushService.sendNotification(mockSubscription, notificationData);

      const payloadString = mockWebPush.sendNotification.mock.calls[0]![1] as string;
      const payload = JSON.parse(payloadString);

      expect(payload.data.url).toBe('http://localhost:3000/messages');

      // Restore original value
      (process.env as any)['FRONTEND_URL'] = originalUrl;
    });
  });
});