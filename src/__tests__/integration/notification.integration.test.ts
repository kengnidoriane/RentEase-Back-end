import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import app from '../../server';
import { createTestUser, getAuthToken, cleanupTestData } from '../utils/testUtils';
import { NotificationType, NotificationChannel } from '../../types/notification.types';

const prisma = new PrismaClient();

describe('Notification Integration Tests', () => {
  let testUser: any;
  let authToken: string;
  let adminUser: any;
  let adminToken: string;

  beforeAll(async () => {
    // Create test users
    testUser = await createTestUser({
      email: 'notification-test@example.com',
      userType: 'TENANT',
    });

    adminUser = await createTestUser({
      email: 'notification-admin@example.com',
      userType: 'ADMIN',
    });

    authToken = await getAuthToken(testUser.id);
    adminToken = await getAuthToken(adminUser.id);
  });

  afterAll(async () => {
    await cleanupTestData();
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    // Clean up notifications before each test
    await prisma.notification.deleteMany({
      where: { userId: { in: [testUser.id, adminUser.id] } },
    });
    await prisma.notificationPreference.deleteMany({
      where: { userId: { in: [testUser.id, adminUser.id] } },
    });
  });

  describe('GET /api/notifications/web-push/public-key', () => {
    it('should get web push public key without authentication', async () => {
      const response = await request(app)
        .get('/api/notifications/web-push/public-key')
        .expect(200);

      expect(response.body.success).toBe(true);
      // The key might be null if not configured in test environment
      expect(response.body.data).toHaveProperty('publicKey');
    });
  });

  describe('GET /api/notifications', () => {
    beforeEach(async () => {
      // Create test notifications
      await prisma.notification.createMany({
        data: [
          {
            userId: testUser.id,
            type: NotificationType.NEW_MESSAGE,
            title: 'Test Message 1',
            message: 'This is a test message',
            channel: NotificationChannel.EMAIL,
            status: 'SENT',
            isRead: false,
          },
          {
            userId: testUser.id,
            type: NotificationType.FAVORITE_UNAVAILABLE,
            title: 'Test Message 2',
            message: 'Property no longer available',
            channel: NotificationChannel.IN_APP,
            status: 'SENT',
            isRead: true,
          },
        ],
      });
    });

    it('should get user notifications with pagination', async () => {
      const response = await request(app)
        .get('/api/notifications')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.notifications).toHaveLength(2);
      expect(response.body.data.total).toBe(2);
      expect(response.body.data.page).toBe(1);
      expect(response.body.data.limit).toBe(20);
      expect(response.body.data.totalPages).toBe(1);
    });

    it('should filter notifications by type', async () => {
      const response = await request(app)
        .get('/api/notifications')
        .query({ type: NotificationType.NEW_MESSAGE })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.notifications).toHaveLength(1);
      expect(response.body.data.notifications[0].type).toBe(NotificationType.NEW_MESSAGE);
    });

    it('should filter notifications by read status', async () => {
      const response = await request(app)
        .get('/api/notifications')
        .query({ isRead: 'false' })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.notifications).toHaveLength(1);
      expect(response.body.data.notifications[0].isRead).toBe(false);
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .get('/api/notifications')
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/notifications/stats', () => {
    beforeEach(async () => {
      await prisma.notification.createMany({
        data: [
          {
            userId: testUser.id,
            type: NotificationType.NEW_MESSAGE,
            title: 'Test 1',
            message: 'Test',
            channel: NotificationChannel.EMAIL,
            status: 'SENT',
            isRead: false,
          },
          {
            userId: testUser.id,
            type: NotificationType.NEW_MESSAGE,
            title: 'Test 2',
            message: 'Test',
            channel: NotificationChannel.EMAIL,
            status: 'SENT',
            isRead: true,
          },
          {
            userId: testUser.id,
            type: NotificationType.FAVORITE_UNAVAILABLE,
            title: 'Test 3',
            message: 'Test',
            channel: NotificationChannel.IN_APP,
            status: 'FAILED',
            isRead: false,
          },
        ],
      });
    });

    it('should get notification statistics', async () => {
      const response = await request(app)
        .get('/api/notifications/stats')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.total).toBe(3);
      expect(response.body.data.unread).toBe(2);
      expect(response.body.data.byType).toHaveProperty(NotificationType.NEW_MESSAGE, 2);
      expect(response.body.data.byType).toHaveProperty(NotificationType.FAVORITE_UNAVAILABLE, 1);
      expect(response.body.data.byStatus).toHaveProperty('SENT', 2);
      expect(response.body.data.byStatus).toHaveProperty('FAILED', 1);
    });
  });

  describe('PATCH /api/notifications/:notificationId/read', () => {
    let notificationId: string;

    beforeEach(async () => {
      const notification = await prisma.notification.create({
        data: {
          userId: testUser.id,
          type: NotificationType.NEW_MESSAGE,
          title: 'Test Message',
          message: 'This is a test message',
          channel: NotificationChannel.EMAIL,
          status: 'SENT',
          isRead: false,
        },
      });
      notificationId = notification.id;
    });

    it('should mark notification as read', async () => {
      const response = await request(app)
        .patch(`/api/notifications/${notificationId}/read`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.isRead).toBe(true);

      // Verify in database
      const updatedNotification = await prisma.notification.findUnique({
        where: { id: notificationId },
      });
      expect(updatedNotification?.isRead).toBe(true);
    });

    it('should return 404 for non-existent notification', async () => {
      const response = await request(app)
        .patch('/api/notifications/non-existent-id/read')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('NOTIFICATION_NOT_FOUND');
    });
  });

  describe('PATCH /api/notifications/read-all', () => {
    beforeEach(async () => {
      await prisma.notification.createMany({
        data: [
          {
            userId: testUser.id,
            type: NotificationType.NEW_MESSAGE,
            title: 'Test 1',
            message: 'Test',
            channel: NotificationChannel.EMAIL,
            status: 'SENT',
            isRead: false,
          },
          {
            userId: testUser.id,
            type: NotificationType.FAVORITE_UNAVAILABLE,
            title: 'Test 2',
            message: 'Test',
            channel: NotificationChannel.IN_APP,
            status: 'SENT',
            isRead: false,
          },
        ],
      });
    });

    it('should mark all notifications as read', async () => {
      const response = await request(app)
        .patch('/api/notifications/read-all')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.markedAsRead).toBe(2);

      // Verify in database
      const unreadCount = await prisma.notification.count({
        where: { userId: testUser.id, isRead: false },
      });
      expect(unreadCount).toBe(0);
    });
  });

  describe('GET /api/notifications/preferences', () => {
    it('should get notification preferences with defaults', async () => {
      const response = await request(app)
        .get('/api/notifications/preferences')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeInstanceOf(Array);
      expect(response.body.data.length).toBeGreaterThan(0);

      // Should have preferences for all notification types
      const types = response.body.data.map((pref: any) => pref.notificationType);
      expect(types).toContain(NotificationType.NEW_MESSAGE);
      expect(types).toContain(NotificationType.FAVORITE_UNAVAILABLE);
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
          {
            notificationType: NotificationType.FAVORITE_UNAVAILABLE,
            emailEnabled: true,
            webPushEnabled: false,
          },
        ],
      };

      const response = await request(app)
        .put('/api/notifications/preferences')
        .set('Authorization', `Bearer ${authToken}`)
        .send(requestData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(2);

      // Verify in database
      const preferences = await prisma.notificationPreference.findMany({
        where: { userId: testUser.id },
      });

      const newMessagePref = preferences.find(p => p.notificationType === NotificationType.NEW_MESSAGE);
      expect(newMessagePref?.emailEnabled).toBe(false);
      expect(newMessagePref?.webPushEnabled).toBe(true);

      const favoriteUnavailablePref = preferences.find(p => p.notificationType === NotificationType.FAVORITE_UNAVAILABLE);
      expect(favoriteUnavailablePref?.emailEnabled).toBe(true);
      expect(favoriteUnavailablePref?.webPushEnabled).toBe(false);
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
        .set('Authorization', `Bearer ${authToken}`)
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
        message: 'This is a test notification',
        data: { test: true },
        channels: [NotificationChannel.IN_APP],
      };

      const response = await request(app)
        .post('/api/notifications/test')
        .set('Authorization', `Bearer ${authToken}`)
        .send(requestData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Test notification sent');

      // Verify notification was created in database
      const notification = await prisma.notification.findFirst({
        where: {
          userId: testUser.id,
          title: 'Test Notification',
          type: NotificationType.NEW_MESSAGE,
        },
      });

      expect(notification).toBeTruthy();
      expect(notification?.message).toBe('This is a test notification');
      expect(notification?.channel).toBe(NotificationChannel.IN_APP);
    });

    it('should validate test notification request', async () => {
      const invalidRequestData = {
        type: 'INVALID_TYPE',
        title: '',
        message: 'Test',
      };

      const response = await request(app)
        .post('/api/notifications/test')
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidRequestData)
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/notifications/test/email', () => {
    it('should test email service for admin user', async () => {
      const response = await request(app)
        .get('/api/notifications/test/email')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('emailServiceConnected');
    });

    it('should deny access for non-admin users', async () => {
      const response = await request(app)
        .get('/api/notifications/test/email')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INSUFFICIENT_PERMISSIONS');
    });
  });
});