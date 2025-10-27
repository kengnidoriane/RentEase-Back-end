import { NotificationRepository } from '../../repositories/notification.repository';
import {
  NotificationType,
  NotificationChannel,
  NotificationStatus,
  NotificationFilters,
} from '../../types/notification.types';

// Mock Prisma Client
const mockPrisma = {
  notification: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    deleteMany: jest.fn(),
  },
  notificationPreference: {
    upsert: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
  },
  user: {
    findMany: jest.fn(),
  },
} as any;

describe('NotificationRepository', () => {
  let notificationRepository: NotificationRepository;

  beforeEach(() => {
    notificationRepository = new NotificationRepository(mockPrisma);
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a notification', async () => {
      const notificationData = {
        userId: 'user-1',
        type: NotificationType.NEW_MESSAGE,
        title: 'New Message',
        message: 'You have a new message',
        data: { senderName: 'John' },
        channel: NotificationChannel.EMAIL,
      };

      const mockCreatedNotification = {
        id: 'notification-1',
        ...notificationData,
        status: NotificationStatus.PENDING,
        isRead: false,
        sentAt: null,
        createdAt: new Date(),
      };

      mockPrisma.notification.create.mockResolvedValue(mockCreatedNotification);

      const result = await notificationRepository.create(notificationData);

      expect(mockPrisma.notification.create).toHaveBeenCalledWith({
        data: {
          ...notificationData,
          status: NotificationStatus.PENDING,
        },
      });

      expect(result).toEqual({
        id: 'notification-1',
        type: NotificationType.NEW_MESSAGE,
        title: 'New Message',
        message: 'You have a new message',
        data: { senderName: 'John' },
        isRead: false,
        channel: NotificationChannel.EMAIL,
        status: NotificationStatus.PENDING,
        sentAt: null,
        createdAt: mockCreatedNotification.createdAt,
        userId: 'user-1',
      });
    });

    it('should create notification with custom status', async () => {
      const notificationData = {
        userId: 'user-1',
        type: NotificationType.NEW_MESSAGE,
        title: 'New Message',
        message: 'You have a new message',
        channel: NotificationChannel.EMAIL,
        status: NotificationStatus.SENT,
      };

      const mockCreatedNotification = {
        id: 'notification-1',
        ...notificationData,
        isRead: false,
        sentAt: null,
        createdAt: new Date(),
      };

      mockPrisma.notification.create.mockResolvedValue(mockCreatedNotification);

      await notificationRepository.create(notificationData);

      expect(mockPrisma.notification.create).toHaveBeenCalledWith({
        data: notificationData,
      });
    });
  });

  describe('findById', () => {
    it('should find notification by id', async () => {
      const mockNotification = {
        id: 'notification-1',
        userId: 'user-1',
        type: NotificationType.NEW_MESSAGE,
        title: 'Test',
        message: 'Test message',
        data: null,
        isRead: false,
        channel: NotificationChannel.EMAIL,
        status: NotificationStatus.SENT,
        sentAt: new Date(),
        createdAt: new Date(),
      };

      mockPrisma.notification.findUnique.mockResolvedValue(mockNotification);

      const result = await notificationRepository.findById('notification-1');

      expect(mockPrisma.notification.findUnique).toHaveBeenCalledWith({
        where: { id: 'notification-1' },
      });

      expect(result).toEqual(mockNotification);
    });

    it('should return null when notification not found', async () => {
      mockPrisma.notification.findUnique.mockResolvedValue(null);

      const result = await notificationRepository.findById('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('findByUserId', () => {
    const mockNotifications = [
      {
        id: 'notification-1',
        userId: 'user-1',
        type: NotificationType.NEW_MESSAGE,
        title: 'Message 1',
        message: 'Test message 1',
        data: null,
        isRead: false,
        channel: NotificationChannel.EMAIL,
        status: NotificationStatus.SENT,
        sentAt: new Date(),
        createdAt: new Date('2023-01-01'),
      },
      {
        id: 'notification-2',
        userId: 'user-1',
        type: NotificationType.FAVORITE_UNAVAILABLE,
        title: 'Property Unavailable',
        message: 'Property no longer available',
        data: null,
        isRead: true,
        channel: NotificationChannel.IN_APP,
        status: NotificationStatus.SENT,
        sentAt: new Date(),
        createdAt: new Date('2023-01-02'),
      },
    ];

    it('should find notifications by user id with default pagination', async () => {
      mockPrisma.notification.findMany.mockResolvedValue(mockNotifications);
      mockPrisma.notification.count.mockResolvedValue(2);

      const result = await notificationRepository.findByUserId('user-1');

      expect(mockPrisma.notification.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        orderBy: { createdAt: 'desc' },
        skip: 0,
        take: 20,
      });

      expect(mockPrisma.notification.count).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
      });

      expect(result).toEqual({
        notifications: mockNotifications,
        total: 2,
      });
    });

    it('should apply filters correctly', async () => {
      const filters: NotificationFilters = {
        type: NotificationType.NEW_MESSAGE,
        isRead: false,
        channel: NotificationChannel.EMAIL,
        status: NotificationStatus.SENT,
        startDate: new Date('2023-01-01'),
        endDate: new Date('2023-01-31'),
      };

      mockPrisma.notification.findMany.mockResolvedValue([mockNotifications[0]]);
      mockPrisma.notification.count.mockResolvedValue(1);

      const result = await notificationRepository.findByUserId('user-1', filters, 2, 10);

      expect(mockPrisma.notification.findMany).toHaveBeenCalledWith({
        where: {
          userId: 'user-1',
          type: NotificationType.NEW_MESSAGE,
          isRead: false,
          channel: NotificationChannel.EMAIL,
          status: NotificationStatus.SENT,
          createdAt: {
            gte: filters.startDate,
            lte: filters.endDate,
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: 10,
        take: 10,
      });

      expect(result).toEqual({
        notifications: [mockNotifications[0]],
        total: 1,
      });
    });

    it('should handle partial date filters', async () => {
      const filtersStartOnly: NotificationFilters = {
        startDate: new Date('2023-01-01'),
      };

      mockPrisma.notification.findMany.mockResolvedValue(mockNotifications);
      mockPrisma.notification.count.mockResolvedValue(2);

      await notificationRepository.findByUserId('user-1', filtersStartOnly);

      expect(mockPrisma.notification.findMany).toHaveBeenCalledWith({
        where: {
          userId: 'user-1',
          createdAt: {
            gte: filtersStartOnly.startDate,
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: 0,
        take: 20,
      });

      const filtersEndOnly: NotificationFilters = {
        endDate: new Date('2023-01-31'),
      };

      await notificationRepository.findByUserId('user-1', filtersEndOnly);

      expect(mockPrisma.notification.findMany).toHaveBeenLastCalledWith({
        where: {
          userId: 'user-1',
          createdAt: {
            lte: filtersEndOnly.endDate,
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: 0,
        take: 20,
      });
    });
  });

  describe('markAsRead', () => {
    it('should mark notification as read', async () => {
      const mockUpdatedNotification = {
        id: 'notification-1',
        userId: 'user-1',
        type: NotificationType.NEW_MESSAGE,
        title: 'Test',
        message: 'Test message',
        data: null,
        isRead: true,
        channel: NotificationChannel.EMAIL,
        status: NotificationStatus.SENT,
        sentAt: new Date(),
        createdAt: new Date(),
      };

      mockPrisma.notification.update.mockResolvedValue(mockUpdatedNotification);

      const result = await notificationRepository.markAsRead('notification-1');

      expect(mockPrisma.notification.update).toHaveBeenCalledWith({
        where: { id: 'notification-1' },
        data: { isRead: true },
      });

      expect(result).toEqual(mockUpdatedNotification);
    });
  });

  describe('markAllAsRead', () => {
    it('should mark all user notifications as read', async () => {
      mockPrisma.notification.updateMany.mockResolvedValue({ count: 5 });

      const result = await notificationRepository.markAllAsRead('user-1');

      expect(mockPrisma.notification.updateMany).toHaveBeenCalledWith({
        where: { userId: 'user-1', isRead: false },
        data: { isRead: true },
      });

      expect(result).toBe(5);
    });
  });

  describe('updateStatus', () => {
    it('should update notification status', async () => {
      const mockUpdatedNotification = {
        id: 'notification-1',
        userId: 'user-1',
        type: NotificationType.NEW_MESSAGE,
        title: 'Test',
        message: 'Test message',
        data: null,
        isRead: false,
        channel: NotificationChannel.EMAIL,
        status: NotificationStatus.SENT,
        sentAt: new Date(),
        createdAt: new Date(),
      };

      mockPrisma.notification.update.mockResolvedValue(mockUpdatedNotification);

      const result = await notificationRepository.updateStatus(
        'notification-1',
        NotificationStatus.SENT
      );

      expect(mockPrisma.notification.update).toHaveBeenCalledWith({
        where: { id: 'notification-1' },
        data: {
          status: NotificationStatus.SENT,
          sentAt: expect.any(Date),
        },
      });

      expect(result).toEqual(mockUpdatedNotification);
    });

    it('should update status with custom sentAt date', async () => {
      const customSentAt = new Date('2023-01-01');
      const mockUpdatedNotification = {
        id: 'notification-1',
        status: NotificationStatus.SENT,
        sentAt: customSentAt,
      };

      mockPrisma.notification.update.mockResolvedValue(mockUpdatedNotification);

      await notificationRepository.updateStatus(
        'notification-1',
        NotificationStatus.SENT,
        customSentAt
      );

      expect(mockPrisma.notification.update).toHaveBeenCalledWith({
        where: { id: 'notification-1' },
        data: {
          status: NotificationStatus.SENT,
          sentAt: customSentAt,
        },
      });
    });

    it('should not set sentAt for failed status', async () => {
      const mockUpdatedNotification = {
        id: 'notification-1',
        status: NotificationStatus.FAILED,
      };

      mockPrisma.notification.update.mockResolvedValue(mockUpdatedNotification);

      await notificationRepository.updateStatus('notification-1', NotificationStatus.FAILED);

      expect(mockPrisma.notification.update).toHaveBeenCalledWith({
        where: { id: 'notification-1' },
        data: {
          status: NotificationStatus.FAILED,
        },
      });
    });
  });

  describe('getStats', () => {
    it('should get notification statistics', async () => {
      const mockNotifications = [
        {
          type: NotificationType.NEW_MESSAGE,
          status: NotificationStatus.SENT,
          isRead: false,
        },
        {
          type: NotificationType.NEW_MESSAGE,
          status: NotificationStatus.SENT,
          isRead: true,
        },
        {
          type: NotificationType.FAVORITE_UNAVAILABLE,
          status: NotificationStatus.FAILED,
          isRead: false,
        },
      ];

      mockPrisma.notification.findMany.mockResolvedValue(mockNotifications);

      const result = await notificationRepository.getStats('user-1');

      expect(mockPrisma.notification.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        select: { type: true, status: true, isRead: true },
      });

      expect(result).toEqual({
        total: 3,
        unread: 2,
        byType: {
          [NotificationType.NEW_MESSAGE]: 2,
          [NotificationType.FAVORITE_UNAVAILABLE]: 1,
        },
        byStatus: {
          [NotificationStatus.SENT]: 2,
          [NotificationStatus.FAILED]: 1,
        },
      });
    });

    it('should handle empty notifications', async () => {
      mockPrisma.notification.findMany.mockResolvedValue([]);

      const result = await notificationRepository.getStats('user-1');

      expect(result).toEqual({
        total: 0,
        unread: 0,
        byType: {},
        byStatus: {},
      });
    });
  });

  describe('deleteOld', () => {
    it('should delete old read notifications', async () => {
      mockPrisma.notification.deleteMany.mockResolvedValue({ count: 10 });

      const result = await notificationRepository.deleteOld(30);

      expect(mockPrisma.notification.deleteMany).toHaveBeenCalledWith({
        where: {
          createdAt: { lt: expect.any(Date) },
          isRead: true,
        },
      });

      // Check that the cutoff date is approximately correct (within 1 minute)
      const actualCall = mockPrisma.notification.deleteMany.mock.calls[0][0];
      const actualCutoffDate = actualCall.where.createdAt.lt;
      const expectedCutoffDate = new Date();
      expectedCutoffDate.setDate(expectedCutoffDate.getDate() - 30);
      const timeDiff = Math.abs(actualCutoffDate.getTime() - expectedCutoffDate.getTime());
      expect(timeDiff).toBeLessThan(60000); // Less than 1 minute difference

      expect(result).toBe(10);
    });
  });

  describe('notification preferences', () => {
    describe('createOrUpdatePreference', () => {
      it('should create or update notification preference', async () => {
        const preferenceData = {
          userId: 'user-1',
          notificationType: NotificationType.NEW_MESSAGE,
          emailEnabled: true,
          webPushEnabled: false,
        };

        const mockPreference = {
          ...preferenceData,
          id: 'pref-1',
        };

        mockPrisma.notificationPreference.upsert.mockResolvedValue(mockPreference);

        const result = await notificationRepository.createOrUpdatePreference(preferenceData);

        expect(mockPrisma.notificationPreference.upsert).toHaveBeenCalledWith({
          where: {
            userId_notificationType: {
              userId: 'user-1',
              notificationType: NotificationType.NEW_MESSAGE,
            },
          },
          update: {
            emailEnabled: true,
            webPushEnabled: false,
          },
          create: preferenceData,
        });

        expect(result).toEqual({
          userId: 'user-1',
          notificationType: NotificationType.NEW_MESSAGE,
          emailEnabled: true,
          webPushEnabled: false,
        });
      });
    });

    describe('getPreferences', () => {
      it('should get all user notification preferences', async () => {
        const mockPreferences = [
          {
            userId: 'user-1',
            notificationType: NotificationType.NEW_MESSAGE,
            emailEnabled: true,
            webPushEnabled: false,
          },
          {
            userId: 'user-1',
            notificationType: NotificationType.FAVORITE_UNAVAILABLE,
            emailEnabled: false,
            webPushEnabled: true,
          },
        ];

        mockPrisma.notificationPreference.findMany.mockResolvedValue(mockPreferences);

        const result = await notificationRepository.getPreferences('user-1');

        expect(mockPrisma.notificationPreference.findMany).toHaveBeenCalledWith({
          where: { userId: 'user-1' },
        });

        expect(result).toEqual(mockPreferences);
      });
    });

    describe('getPreference', () => {
      it('should get specific notification preference', async () => {
        const mockPreference = {
          userId: 'user-1',
          notificationType: NotificationType.NEW_MESSAGE,
          emailEnabled: true,
          webPushEnabled: false,
        };

        mockPrisma.notificationPreference.findUnique.mockResolvedValue(mockPreference);

        const result = await notificationRepository.getPreference(
          'user-1',
          NotificationType.NEW_MESSAGE
        );

        expect(mockPrisma.notificationPreference.findUnique).toHaveBeenCalledWith({
          where: {
            userId_notificationType: {
              userId: 'user-1',
              notificationType: NotificationType.NEW_MESSAGE,
            },
          },
        });

        expect(result).toEqual(mockPreference);
      });

      it('should return null when preference not found', async () => {
        mockPrisma.notificationPreference.findUnique.mockResolvedValue(null);

        const result = await notificationRepository.getPreference(
          'user-1',
          NotificationType.NEW_MESSAGE
        );

        expect(result).toBeNull();
      });
    });
  });

  describe('getInactiveUsers', () => {
    it('should get users inactive for specified days', async () => {
      const mockUsers = [
        { id: 'user-1' },
        { id: 'user-2' },
        { id: 'user-3' },
      ];

      mockPrisma.user.findMany.mockResolvedValue(mockUsers);

      const result = await notificationRepository.getInactiveUsers(7);

      expect(mockPrisma.user.findMany).toHaveBeenCalledWith({
        where: {
          OR: [
            { lastActiveAt: { lt: expect.any(Date) } },
            { lastActiveAt: null, createdAt: { lt: expect.any(Date) } },
          ],
          isActive: true,
        },
        select: { id: true },
      });

      // Check that the cutoff dates are approximately correct
      const actualCall = mockPrisma.user.findMany.mock.calls[0][0];
      const orConditions = actualCall.where.OR;
      
      const lastActiveAtCutoff = orConditions[0].lastActiveAt.lt;
      const createdAtCutoff = orConditions[1].createdAt.lt;
      
      const expectedCutoffDate = new Date();
      expectedCutoffDate.setDate(expectedCutoffDate.getDate() - 7);
      
      const timeDiff1 = Math.abs(lastActiveAtCutoff.getTime() - expectedCutoffDate.getTime());
      const timeDiff2 = Math.abs(createdAtCutoff.getTime() - expectedCutoffDate.getTime());
      
      expect(timeDiff1).toBeLessThan(60000); // Less than 1 minute difference
      expect(timeDiff2).toBeLessThan(60000); // Less than 1 minute difference

      expect(result).toEqual(['user-1', 'user-2', 'user-3']);
    });

    it('should return empty array when no inactive users found', async () => {
      mockPrisma.user.findMany.mockResolvedValue([]);

      const result = await notificationRepository.getInactiveUsers(7);

      expect(result).toEqual([]);
    });
  });
});