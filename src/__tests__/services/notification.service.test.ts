import { PrismaClient } from '@prisma/client';
import { NotificationService } from '../../services/notification.service';
import { NotificationRepository } from '../../repositories/notification.repository';
import { EmailNotificationService } from '../../services/email-notification.service';
import { WebPushNotificationService } from '../../services/web-push-notification.service';
import { UserRepository } from '../../repositories/user.repository';
import {
  NotificationType,
  NotificationChannel,
  NotificationStatus,
  NotificationData,
} from '../../types/notification.types';

// Mock dependencies
jest.mock('../../repositories/notification.repository');
jest.mock('../../services/email-notification.service');
jest.mock('../../services/web-push-notification.service');
jest.mock('../../repositories/user.repository');
jest.mock('../../utils/logger');

describe('NotificationService', () => {
  let notificationService: NotificationService;
  let mockPrisma: jest.Mocked<PrismaClient>;
  let mockNotificationRepository: jest.Mocked<NotificationRepository>;
  let mockEmailService: jest.Mocked<EmailNotificationService>;
  let mockWebPushService: jest.Mocked<WebPushNotificationService>;
  let mockUserRepository: jest.Mocked<UserRepository>;

  const mockUser = {
    id: 'user-1',
    email: 'test@example.com',
    firstName: 'John',
    lastName: 'Doe',
    userType: 'TENANT' as const,
  };

  const mockNotificationData: NotificationData = {
    userId: 'user-1',
    type: NotificationType.NEW_MESSAGE,
    title: 'New Message',
    message: 'You have a new message',
    data: { senderName: 'Jane', propertyTitle: 'Nice Apartment' },
  };

  beforeEach(() => {
    mockPrisma = {} as jest.Mocked<PrismaClient>;
    
    mockNotificationRepository = new NotificationRepository(mockPrisma) as jest.Mocked<NotificationRepository>;
    mockEmailService = new EmailNotificationService() as jest.Mocked<EmailNotificationService>;
    mockWebPushService = new WebPushNotificationService() as jest.Mocked<WebPushNotificationService>;
    mockUserRepository = new UserRepository(mockPrisma) as jest.Mocked<UserRepository>;

    notificationService = new NotificationService(mockPrisma);
    
    // Replace the private properties with mocks
    (notificationService as any).notificationRepository = mockNotificationRepository;
    (notificationService as any).emailService = mockEmailService;
    (notificationService as any).webPushService = mockWebPushService;
    (notificationService as any).userRepository = mockUserRepository;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('sendNotification', () => {
    beforeEach(() => {
      mockUserRepository.findById.mockResolvedValue(mockUser as any);
      mockNotificationRepository.create.mockResolvedValue({
        id: 'notification-1',
        ...mockNotificationData,
        channel: NotificationChannel.EMAIL,
        status: NotificationStatus.PENDING,
        isRead: false,
        createdAt: new Date(),
      });
      mockNotificationRepository.updateStatus.mockResolvedValue({} as any);
      mockNotificationRepository.getPreference.mockResolvedValue(null);
    });

    it('should send notification through all default channels when user not found', async () => {
      mockUserRepository.findById.mockResolvedValue(null);

      await notificationService.sendNotification(mockNotificationData);

      expect(mockUserRepository.findById).toHaveBeenCalledWith('user-1');
      // Should not proceed with sending when user not found
      expect(mockNotificationRepository.create).not.toHaveBeenCalled();
    });

    it('should send notification through all default channels', async () => {
      mockEmailService.sendEmail.mockResolvedValue(true);

      await notificationService.sendNotification(mockNotificationData);

      expect(mockUserRepository.findById).toHaveBeenCalledWith('user-1');
      expect(mockNotificationRepository.create).toHaveBeenCalledTimes(3); // EMAIL, WEB_PUSH, IN_APP
      expect(mockEmailService.sendEmail).toHaveBeenCalledWith({
        ...mockNotificationData,
        channel: NotificationChannel.EMAIL,
        recipientEmail: mockUser.email,
      });
    });

    it('should send notification through specified channels only', async () => {
      mockEmailService.sendEmail.mockResolvedValue(true);

      await notificationService.sendNotification(
        mockNotificationData,
        [NotificationChannel.EMAIL]
      );

      expect(mockNotificationRepository.create).toHaveBeenCalledTimes(1);
      expect(mockNotificationRepository.create).toHaveBeenCalledWith({
        userId: mockNotificationData.userId,
        type: mockNotificationData.type,
        title: mockNotificationData.title,
        message: mockNotificationData.message,
        data: mockNotificationData.data,
        channel: NotificationChannel.EMAIL,
      });
    });

    it('should handle email sending failure', async () => {
      mockEmailService.sendEmail.mockResolvedValue(false);

      await notificationService.sendNotification(
        mockNotificationData,
        [NotificationChannel.EMAIL]
      );

      expect(mockNotificationRepository.updateStatus).toHaveBeenCalledWith(
        'notification-1',
        NotificationStatus.FAILED
      );
    });

    it('should handle email sending success', async () => {
      mockEmailService.sendEmail.mockResolvedValue(true);

      await notificationService.sendNotification(
        mockNotificationData,
        [NotificationChannel.EMAIL]
      );

      expect(mockNotificationRepository.updateStatus).toHaveBeenCalledWith(
        'notification-1',
        NotificationStatus.SENT
      );
    });

    it('should mark in-app notifications as sent immediately', async () => {
      await notificationService.sendNotification(
        mockNotificationData,
        [NotificationChannel.IN_APP]
      );

      expect(mockNotificationRepository.updateStatus).toHaveBeenCalledWith(
        'notification-1',
        NotificationStatus.SENT
      );
    });
  });

  describe('getNotifications', () => {
    it('should get paginated notifications', async () => {
      const mockNotifications = [
        {
          id: 'notification-1',
          type: NotificationType.NEW_MESSAGE,
          title: 'Test',
          message: 'Test message',
          isRead: false,
          channel: NotificationChannel.EMAIL,
          status: NotificationStatus.SENT,
          createdAt: new Date(),
          userId: 'user-1',
        },
      ];

      mockNotificationRepository.findByUserId.mockResolvedValue({
        notifications: mockNotifications,
        total: 1,
      });

      const result = await notificationService.getNotifications('user-1', {}, 1, 20);

      expect(result).toEqual({
        notifications: mockNotifications,
        total: 1,
        page: 1,
        limit: 20,
        totalPages: 1,
      });
      expect(mockNotificationRepository.findByUserId).toHaveBeenCalledWith(
        'user-1',
        {},
        1,
        20
      );
    });
  });

  describe('markAsRead', () => {
    it('should mark notification as read', async () => {
      const mockNotification = {
        id: 'notification-1',
        isRead: true,
      };

      mockNotificationRepository.markAsRead.mockResolvedValue(mockNotification as any);

      const result = await notificationService.markAsRead('notification-1');

      expect(result).toEqual(mockNotification);
      expect(mockNotificationRepository.markAsRead).toHaveBeenCalledWith('notification-1');
    });
  });

  describe('markAllAsRead', () => {
    it('should mark all notifications as read', async () => {
      mockNotificationRepository.markAllAsRead.mockResolvedValue(5);

      const result = await notificationService.markAllAsRead('user-1');

      expect(result).toBe(5);
      expect(mockNotificationRepository.markAllAsRead).toHaveBeenCalledWith('user-1');
    });
  });

  describe('getNotificationStats', () => {
    it('should get notification statistics', async () => {
      const mockStats = {
        total: 10,
        unread: 3,
        byType: { [NotificationType.NEW_MESSAGE]: 5 },
        byStatus: { [NotificationStatus.SENT]: 8 },
      };

      mockNotificationRepository.getStats.mockResolvedValue(mockStats);

      const result = await notificationService.getNotificationStats('user-1');

      expect(result).toEqual(mockStats);
      expect(mockNotificationRepository.getStats).toHaveBeenCalledWith('user-1');
    });
  });

  describe('getNotificationPreferences', () => {
    it('should get notification preferences with defaults for missing types', async () => {
      const existingPreferences = [
        {
          userId: 'user-1',
          notificationType: NotificationType.NEW_MESSAGE,
          emailEnabled: true,
          webPushEnabled: false,
        },
      ];

      mockNotificationRepository.getPreferences.mockResolvedValue(existingPreferences);
      mockNotificationRepository.createOrUpdatePreference.mockResolvedValue({
        userId: 'user-1',
        notificationType: NotificationType.FAVORITE_UNAVAILABLE,
        emailEnabled: true,
        webPushEnabled: true,
      });

      const result = await notificationService.getNotificationPreferences('user-1');

      expect(result.length).toBeGreaterThan(1); // Should include defaults for missing types
      expect(mockNotificationRepository.getPreferences).toHaveBeenCalledWith('user-1');
    });
  });

  describe('updateNotificationPreferences', () => {
    it('should update notification preferences', async () => {
      const request = {
        preferences: [
          {
            notificationType: NotificationType.NEW_MESSAGE,
            emailEnabled: false,
            webPushEnabled: true,
          },
        ],
      };

      const updatedPreference = {
        userId: 'user-1',
        notificationType: NotificationType.NEW_MESSAGE,
        emailEnabled: false,
        webPushEnabled: true,
      };

      mockNotificationRepository.createOrUpdatePreference.mockResolvedValue(updatedPreference);

      const result = await notificationService.updateNotificationPreferences('user-1', request);

      expect(result).toEqual([updatedPreference]);
      expect(mockNotificationRepository.createOrUpdatePreference).toHaveBeenCalledWith({
        userId: 'user-1',
        notificationType: NotificationType.NEW_MESSAGE,
        emailEnabled: false,
        webPushEnabled: true,
      });
    });
  });

  describe('specific notification methods', () => {
    beforeEach(() => {
      jest.spyOn(notificationService, 'sendNotification').mockResolvedValue();
    });

    it('should send new message notification', async () => {
      await notificationService.sendNewMessageNotification(
        'user-1',
        'John Doe',
        'Nice Apartment',
        'Hello, is this still available?'
      );

      expect(notificationService.sendNotification).toHaveBeenCalledWith({
        userId: 'user-1',
        type: NotificationType.NEW_MESSAGE,
        title: 'New Message',
        message: 'John Doe sent you a message about Nice Apartment',
        data: {
          senderName: 'John Doe',
          propertyTitle: 'Nice Apartment',
          messageContent: 'Hello, is this still available?',
        },
      });
    });

    it('should send favorite unavailable notification', async () => {
      await notificationService.sendFavoriteUnavailableNotification('user-1', 'Nice Apartment');

      expect(notificationService.sendNotification).toHaveBeenCalledWith({
        userId: 'user-1',
        type: NotificationType.FAVORITE_UNAVAILABLE,
        title: 'Favorite Property No Longer Available',
        message: 'The property "Nice Apartment" that you favorited is no longer available.',
        data: { propertyTitle: 'Nice Apartment' },
      });
    });

    it('should send property verified notification', async () => {
      await notificationService.sendPropertyVerifiedNotification(
        'landlord-1',
        'Nice Apartment',
        'property-1'
      );

      expect(notificationService.sendNotification).toHaveBeenCalledWith({
        userId: 'landlord-1',
        type: NotificationType.PROPERTY_VERIFIED,
        title: 'Property Verified',
        message: 'Your property "Nice Apartment" has been verified and is now live.',
        data: { propertyTitle: 'Nice Apartment', propertyId: 'property-1' },
      });
    });

    it('should send batch favorite unavailable notifications', async () => {
      const unavailableProperties = [
        { title: 'Property 1', id: 'prop-1' },
        { title: 'Property 2', id: 'prop-2' },
      ];

      await notificationService.sendBatchFavoriteUnavailableNotifications(
        'user-1',
        unavailableProperties
      );

      expect(notificationService.sendNotification).toHaveBeenCalledWith({
        userId: 'user-1',
        type: NotificationType.FAVORITE_UNAVAILABLE,
        title: 'Multiple Favorite Properties No Longer Available',
        message: '2 of your favorite properties are no longer available.',
        data: { properties: unavailableProperties },
      });
    });

    it('should send single favorite unavailable notification for one property', async () => {
      const unavailableProperties = [{ title: 'Property 1', id: 'prop-1' }];

      await notificationService.sendBatchFavoriteUnavailableNotifications(
        'user-1',
        unavailableProperties
      );

      expect(notificationService.sendNotification).toHaveBeenCalledWith({
        userId: 'user-1',
        type: NotificationType.FAVORITE_UNAVAILABLE,
        title: 'Favorite Property No Longer Available',
        message: 'The property "Property 1" that you favorited is no longer available.',
        data: { propertyTitle: 'Property 1' },
      });
    });
  });

  describe('utility methods', () => {
    it('should test email service', async () => {
      mockEmailService.testConnection.mockResolvedValue(true);

      const result = await notificationService.testEmailService();

      expect(result).toBe(true);
      expect(mockEmailService.testConnection).toHaveBeenCalled();
    });

    it('should get web push public key', () => {
      mockWebPushService.getPublicKey.mockReturnValue('test-public-key');

      const result = notificationService.getWebPushPublicKey();

      expect(result).toBe('test-public-key');
      expect(mockWebPushService.getPublicKey).toHaveBeenCalled();
    });
  });

  describe('batch operations', () => {
    it('should send inactive user reminders', async () => {
      mockNotificationRepository.getInactiveUsers.mockResolvedValue(['user-1', 'user-2']);
      jest.spyOn(notificationService, 'sendInactiveUserReminder').mockResolvedValue();

      await notificationService.sendInactiveUserReminders();

      expect(mockNotificationRepository.getInactiveUsers).toHaveBeenCalledWith(7);
      expect(notificationService.sendInactiveUserReminder).toHaveBeenCalledTimes(2);
    });

    it('should cleanup old notifications', async () => {
      mockNotificationRepository.deleteOld.mockResolvedValue(10);

      const result = await notificationService.cleanupOldNotifications(30);

      expect(result).toBe(10);
      expect(mockNotificationRepository.deleteOld).toHaveBeenCalledWith(30);
    });
  });
});