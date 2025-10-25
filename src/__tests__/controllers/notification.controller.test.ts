import request from 'supertest';
import express from 'express';
import { notificationRoutes } from '../../routes/notification.routes';
import { NotificationService } from '../../services/notification.service';
import { NotificationType, NotificationChannel } from '../../types/notification.types';

// Mock the notification service
jest.mock('../../services/notification.service');
jest.mock('../../utils/logger');

const app = express();
app.use(express.json());
app.use('/api/notifications', notificationRoutes);

// Mock authentication middleware
jest.mock('../../middleware/auth.middleware', () => ({
  authMiddleware: (req: any, res: any, next: any) => {
    req.user = {
      id: 'user-1',
      email: 'test@example.com',
      userType: 'TENANT',
    };
    next();
  },
}));

describe('NotificationController', () => {
  let mockNotificationService: jest.Mocked<NotificationService>;

  beforeEach(() => {
    mockNotificationService = NotificationService.prototype as jest.Mocked<NotificationService>;
    jest.clearAllMocks();
  });

  describe('GET /api/notifications', () => {
    it('should get notifications with default pagination', async () => {
      const mockNotifications = {
        notifications: [
          {
            id: 'notification-1',
            type: NotificationType.NEW_MESSAGE,
            title: 'New Message',
            message: 'You have a new message',
            isRead: false,
            channel: NotificationChannel.EMAIL,
            createdAt: new Date(),
          },
        ],
        total: 1,
        page: 1,
        limit: 20,
        totalPages: 1,
      };

      mockNotificationService.getNotifications.mockResolvedValue(mockNotifications);

      const response = await request(app)
        .get('/api/notifications')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockNotifications);
      expect(mockNotificationService.getNotifications).toHaveBeenCalledWith(
        'user-1',
        {},
        1,
        20
      );
    });

    it('should get notifications with filters', async () => {
      const mockNotifications = {
        notifications: [],
        total: 0,
        page: 1,
        limit: 10,
        totalPages: 0,
      };

      mockNotificationService.getNotifications.mockResolvedValue(mockNotifications);

      const response = await request(app)
        .get('/api/notifications')
        .query({
          page: '1',
          limit: '10',
          type: 'NEW_MESSAGE',
          isRead: 'false',
          channel: 'EMAIL',
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(mockNotificationService.getNotifications).toHaveBeenCalledWith(
        'user-1',
        {
          type: 'NEW_MESSAGE',
          isRead: false,
          channel: 'EMAIL',
        },
        1,
        10
      );
    });

    it('should handle service errors', async () => {
      mockNotificationService.getNotifications.mockRejectedValue(new Error('Service error'));

      const response = await request(app)
        .get('/api/notifications')
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('NOTIFICATION_FETCH_ERROR');
    });
  });

  describe('GET /api/notifications/stats', () => {
    it('should get notification statistics', async () => {
      const mockStats = {
        total: 10,
        unread: 3,
        byType: { [NotificationType.NEW_MESSAGE]: 5 },
        byStatus: { SENT: 8 },
      };

      mockNotificationService.getNotificationStats.mockResolvedValue(mockStats);

      const response = await request(app)
        .get('/api/notifications/stats')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockStats);
      expect(mockNotificationService.getNotificationStats).toHaveBeenCalledWith('user-1');
    });
  });

  describe('PATCH /api/notifications/:notificationId/read', () => {
    it('should mark notification as read', async () => {
      const mockNotification = {
        id: 'notification-1',
        isRead: true,
      };

      mockNotificationService.markAsRead.mockResolvedValue(mockNotification as any);

      const response = await request(app)
        .patch('/api/notifications/notification-1/read')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockNotification);
      expect(mockNotificationService.markAsRead).toHaveBeenCalledWith('notification-1');
    });

    it('should handle notification not found', async () => {
      mockNotificationService.markAsRead.mockResolvedValue(null);

      const response = await request(app)
        .patch('/api/notifications/nonexistent/read')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('NOTIFICATION_NOT_FOUND');
    });
  });

  describe('PATCH /api/notifications/read-all', () => {
    it('should mark all notifications as read', async () => {
      mockNotificationService.markAllAsRead.mockResolvedValue(5);

      const response = await request(app)
        .patch('/api/notifications/read-all')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.markedAsRead).toBe(5);
      expect(mockNotificationService.markAllAsRead).toHaveBeenCalledWith('user-1');
    });
  });

  describe('GET /api/notifications/preferences', () => {
    it('should get notification preferences', async () => {
      const mockPreferences = [
        {
          userId: 'user-1',
          notificationType: NotificationType.NEW_MESSAGE,
          emailEnabled: true,
          webPushEnabled: false,
        },
      ];

      mockNotificationService.getNotificationPreferences.mockResolvedValue(mockPreferences);

      const response = await request(app)
        .get('/api/notifications/preferences')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockPreferences);
      expect(mockNotificationService.getNotificationPreferences).toHaveBeenCalledWith('user-1');
    });
  });

  describe('PUT /api/notifications/preferences', () => {
    it('should update notification preferences', async () => {
      const requestData = {
        preferences: [
          {
            notificationType: NotificationType.NEW_MESSAGE,
            emailEnabled: false,
            webPushEnabled: true,
          },
        ],
      };

      const mockUpdatedPreferences = [
        {
          userId: 'user-1',
          notificationType: NotificationType.NEW_MESSAGE,
          emailEnabled: false,
          webPushEnabled: true,
        },
      ];

      mockNotificationService.updateNotificationPreferences.mockResolvedValue(mockUpdatedPreferences);

      const response = await request(app)
        .put('/api/notifications/preferences')
        .send(requestData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockUpdatedPreferences);
      expect(mockNotificationService.updateNotificationPreferences).toHaveBeenCalledWith(
        'user-1',
        requestData
      );
    });

    it('should validate request body', async () => {
      const invalidRequestData = {
        preferences: [
          {
            notificationType: 'INVALID_TYPE',
            emailEnabled: 'not-boolean',
          },
        ],
      };

      const response = await request(app)
        .put('/api/notifications/preferences')
        .send(invalidRequestData)
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/notifications/test', () => {
    it('should send test notification', async () => {
      const requestData = {
        type: NotificationType.NEW_MESSAGE,
        title: 'Test Notification',
        message: 'This is a test',
        channels: [NotificationChannel.EMAIL],
      };

      mockNotificationService.sendNotification.mockResolvedValue();

      const response = await request(app)
        .post('/api/notifications/test')
        .send(requestData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Test notification sent');
      expect(mockNotificationService.sendNotification).toHaveBeenCalledWith(
        {
          userId: 'user-1',
          type: requestData.type,
          title: requestData.title,
          message: requestData.message,
          data: undefined,
        },
        requestData.channels
      );
    });

    it('should validate test notification request', async () => {
      const invalidRequestData = {
        type: 'INVALID_TYPE',
        title: '',
        message: 'Test',
      };

      const response = await request(app)
        .post('/api/notifications/test')
        .send(invalidRequestData)
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/notifications/web-push/public-key', () => {
    it('should get web push public key', async () => {
      mockNotificationService.getWebPushPublicKey.mockReturnValue('test-public-key');

      const response = await request(app)
        .get('/api/notifications/web-push/public-key')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.publicKey).toBe('test-public-key');
    });

    it('should handle missing web push configuration', async () => {
      mockNotificationService.getWebPushPublicKey.mockReturnValue(null);

      const response = await request(app)
        .get('/api/notifications/web-push/public-key')
        .expect(503);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('WEB_PUSH_NOT_CONFIGURED');
    });
  });

  describe('GET /api/notifications/test/email', () => {
    beforeEach(() => {
      // Mock admin user
      jest.doMock('../../middleware/auth.middleware', () => ({
        authMiddleware: (req: any, res: any, next: any) => {
          req.user = {
            id: 'admin-1',
            email: 'admin@example.com',
            userType: 'ADMIN',
          };
          next();
        },
      }));
    });

    it('should test email service for admin user', async () => {
      mockNotificationService.testEmailService.mockResolvedValue(true);

      // Create a new app instance with admin user
      const adminApp = express();
      adminApp.use(express.json());
      adminApp.use((req: any, res: any, next: any) => {
        req.user = {
          id: 'admin-1',
          email: 'admin@example.com',
          userType: 'ADMIN',
        };
        next();
      });
      adminApp.use('/api/notifications', notificationRoutes);

      const response = await request(adminApp)
        .get('/api/notifications/test/email')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.emailServiceConnected).toBe(true);
      expect(mockNotificationService.testEmailService).toHaveBeenCalled();
    });

    it('should deny access for non-admin users', async () => {
      const response = await request(app)
        .get('/api/notifications/test/email')
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INSUFFICIENT_PERMISSIONS');
    });
  });
});