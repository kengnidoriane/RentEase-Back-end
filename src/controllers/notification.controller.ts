import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { NotificationService } from '../services/notification.service';
import { logger } from '../utils/logger';
import { AuthenticatedRequest } from '../types/auth.types';
import {
  NotificationFilters,
  UpdateNotificationPreferencesRequest,
  CreateNotificationRequest,
} from '../types/notification.types';

const prisma = new PrismaClient();
const notificationService = new NotificationService(prisma);

export class NotificationController {
  // Get user notifications with filtering and pagination
  async getNotifications(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!.id;
      const page = parseInt(req.query['page'] as string) || 1;
      const limit = parseInt(req.query['limit'] as string) || 20;
      
      const filters: NotificationFilters = {};
      if (req.query['type']) filters.type = req.query['type'] as any;
      if (req.query['isRead'] !== undefined) filters.isRead = req.query['isRead'] === 'true';
      if (req.query['channel']) filters.channel = req.query['channel'] as any;
      if (req.query['status']) filters.status = req.query['status'] as any;
      if (req.query['startDate']) filters.startDate = new Date(req.query['startDate'] as string);
      if (req.query['endDate']) filters.endDate = new Date(req.query['endDate'] as string);

      const result = await notificationService.getNotifications(userId, filters, page, limit);

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      logger.error('Failed to get notifications', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: req.user?.id,
      });
      
      res.status(500).json({
        success: false,
        error: {
          code: 'NOTIFICATION_FETCH_ERROR',
          message: 'Failed to fetch notifications',
        },
      });
    }
  }

  // Mark notification as read
  async markAsRead(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { notificationId } = req.params;
      
      const notification = await notificationService.markAsRead(notificationId!);
      
      if (!notification) {
        res.status(404).json({
          success: false,
          error: {
            code: 'NOTIFICATION_NOT_FOUND',
            message: 'Notification not found',
          },
        });
        return;
      }

      res.json({
        success: true,
        data: notification,
      });
    } catch (error) {
      logger.error('Failed to mark notification as read', {
        error: error instanceof Error ? error.message : 'Unknown error',
        notificationId: req.params['notificationId'],
        userId: req.user?.id,
      });
      
      res.status(500).json({
        success: false,
        error: {
          code: 'NOTIFICATION_UPDATE_ERROR',
          message: 'Failed to update notification',
        },
      });
    }
  }

  // Mark all notifications as read
  async markAllAsRead(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!.id;
      
      const count = await notificationService.markAllAsRead(userId);

      res.json({
        success: true,
        data: { markedAsRead: count },
      });
    } catch (error) {
      logger.error('Failed to mark all notifications as read', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: req.user?.id,
      });
      
      res.status(500).json({
        success: false,
        error: {
          code: 'NOTIFICATION_UPDATE_ERROR',
          message: 'Failed to update notifications',
        },
      });
    }
  }

  // Get notification statistics
  async getStats(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!.id;
      
      const stats = await notificationService.getNotificationStats(userId);

      res.json({
        success: true,
        data: stats,
      });
    } catch (error) {
      logger.error('Failed to get notification stats', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: req.user?.id,
      });
      
      res.status(500).json({
        success: false,
        error: {
          code: 'NOTIFICATION_STATS_ERROR',
          message: 'Failed to fetch notification statistics',
        },
      });
    }
  }

  // Get notification preferences
  async getPreferences(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!.id;
      
      const preferences = await notificationService.getNotificationPreferences(userId);

      res.json({
        success: true,
        data: preferences,
      });
    } catch (error) {
      logger.error('Failed to get notification preferences', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: req.user?.id,
      });
      
      res.status(500).json({
        success: false,
        error: {
          code: 'NOTIFICATION_PREFERENCES_ERROR',
          message: 'Failed to fetch notification preferences',
        },
      });
    }
  }

  // Update notification preferences
  async updatePreferences(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!.id;
      const request: UpdateNotificationPreferencesRequest = req.body;
      
      const preferences = await notificationService.updateNotificationPreferences(userId, request);

      res.json({
        success: true,
        data: preferences,
      });
    } catch (error) {
      logger.error('Failed to update notification preferences', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: req.user?.id,
      });
      
      res.status(500).json({
        success: false,
        error: {
          code: 'NOTIFICATION_PREFERENCES_UPDATE_ERROR',
          message: 'Failed to update notification preferences',
        },
      });
    }
  }

  // Send test notification (for testing purposes)
  async sendTestNotification(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!.id;
      const request: CreateNotificationRequest = req.body;
      
      await notificationService.sendNotification({
        userId,
        type: request.type,
        title: request.title,
        message: request.message,
        data: request.data,
      }, request.channels);

      res.json({
        success: true,
        message: 'Test notification sent',
      });
    } catch (error) {
      logger.error('Failed to send test notification', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: req.user?.id,
      });
      
      res.status(500).json({
        success: false,
        error: {
          code: 'NOTIFICATION_SEND_ERROR',
          message: 'Failed to send test notification',
        },
      });
    }
  }

  // Get web push public key for client-side subscription
  async getWebPushPublicKey(_req: Request, res: Response): Promise<void> {
    try {
      const publicKey = notificationService.getWebPushPublicKey();
      
      if (!publicKey) {
        res.status(503).json({
          success: false,
          error: {
            code: 'WEB_PUSH_NOT_CONFIGURED',
            message: 'Web push notifications are not configured',
          },
        });
        return;
      }

      res.json({
        success: true,
        data: { publicKey },
      });
    } catch (error) {
      logger.error('Failed to get web push public key', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      
      res.status(500).json({
        success: false,
        error: {
          code: 'WEB_PUSH_KEY_ERROR',
          message: 'Failed to get web push public key',
        },
      });
    }
  }

  // Test email service connection
  async testEmailService(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      // Only allow admin users to test email service
      if (req.user!.userType !== 'ADMIN') {
        res.status(403).json({
          success: false,
          error: {
            code: 'INSUFFICIENT_PERMISSIONS',
            message: 'Admin access required',
          },
        });
        return;
      }

      const isConnected = await notificationService.testEmailService();

      res.json({
        success: true,
        data: { emailServiceConnected: isConnected },
      });
    } catch (error) {
      logger.error('Failed to test email service', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: req.user?.id,
      });
      
      res.status(500).json({
        success: false,
        error: {
          code: 'EMAIL_SERVICE_TEST_ERROR',
          message: 'Failed to test email service',
        },
      });
    }
  }
}

export const notificationController = new NotificationController();