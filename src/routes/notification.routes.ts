import { Router } from 'express';
import { notificationController } from '../controllers/notification.controller';
import { AuthMiddleware } from '../middleware/auth.middleware';

const authMiddleware = new AuthMiddleware().authenticate;
import { validateRequest } from '../middleware/validation.middleware';
import { z } from 'zod';

const router = Router();

// Validation schemas
const updatePreferencesSchema = z.object({
  preferences: z.array(z.object({
    notificationType: z.enum([
      'NEW_MESSAGE',
      'FAVORITE_UNAVAILABLE',
      'PROPERTY_VERIFIED',
      'NEW_LISTING_MATCH',
      'REMINDER_INACTIVE',
      'PROPERTY_APPROVED',
      'PROPERTY_REJECTED',
    ]),
    emailEnabled: z.boolean(),
    webPushEnabled: z.boolean(),
  })),
});

const testNotificationSchema = z.object({
  type: z.enum([
    'NEW_MESSAGE',
    'FAVORITE_UNAVAILABLE',
    'PROPERTY_VERIFIED',
    'NEW_LISTING_MATCH',
    'REMINDER_INACTIVE',
    'PROPERTY_APPROVED',
    'PROPERTY_REJECTED',
  ]),
  title: z.string().min(1).max(200),
  message: z.string().min(1).max(500),
  data: z.any().optional(),
  channels: z.array(z.enum(['EMAIL', 'WEB_PUSH', 'IN_APP'])).optional(),
});

const queryFiltersSchema = z.object({
  page: z.string().regex(/^\d+$/).optional(),
  limit: z.string().regex(/^\d+$/).optional(),
  type: z.enum([
    'NEW_MESSAGE',
    'FAVORITE_UNAVAILABLE',
    'PROPERTY_VERIFIED',
    'NEW_LISTING_MATCH',
    'REMINDER_INACTIVE',
    'PROPERTY_APPROVED',
    'PROPERTY_REJECTED',
  ]).optional(),
  isRead: z.enum(['true', 'false']).optional(),
  channel: z.enum(['EMAIL', 'WEB_PUSH', 'IN_APP']).optional(),
  status: z.enum(['PENDING', 'SENT', 'FAILED', 'DELIVERED']).optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});

// Public routes
router.get('/web-push/public-key', notificationController.getWebPushPublicKey);

// Protected routes - require authentication
router.use(authMiddleware);

// Get notifications with filtering and pagination
router.get(
  '/',
  notificationController.getNotifications
);

// Get notification statistics
router.get('/stats', notificationController.getStats);

// Mark specific notification as read
router.patch('/:notificationId/read', notificationController.markAsRead);

// Mark all notifications as read
router.patch('/read-all', notificationController.markAllAsRead);

// Get notification preferences
router.get('/preferences', notificationController.getPreferences);

// Update notification preferences
router.put(
  '/preferences',
  validateRequest(updatePreferencesSchema),
  notificationController.updatePreferences
);

// Send test notification (for development/testing)
router.post(
  '/test',
  validateRequest(testNotificationSchema),
  notificationController.sendTestNotification
);

// Test email service connection (admin only)
router.get('/test/email', notificationController.testEmailService);

export { router as notificationRoutes };