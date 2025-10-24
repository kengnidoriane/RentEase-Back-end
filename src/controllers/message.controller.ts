import { Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { MessageService } from '../services/message.service';
import { logger } from '../utils/logger';
import { AuthenticatedRequest } from '../types/auth.types';
import { CreateMessageRequest, MarkAsReadRequest } from '../types/message.types';

const prisma = new PrismaClient();
const messageService = new MessageService(prisma);

export class MessageController {
  async sendMessage(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'User not authenticated',
            timestamp: new Date().toISOString(),
            path: req.path,
          },
        });
        return;
      }

      const messageData: CreateMessageRequest = req.body;

      // Validate required fields
      if (!messageData.content || !messageData.receiverId || !messageData.propertyId) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Content, receiverId, and propertyId are required',
            timestamp: new Date().toISOString(),
            path: req.path,
          },
        });
        return;
      }

      const message = await messageService.sendMessage(userId, messageData);

      res.status(201).json({
        success: true,
        data: message,
      });
    } catch (error: any) {
      logger.error('Error in sendMessage controller:', error);
      res.status(400).json({
        success: false,
        error: {
          code: 'MESSAGE_SEND_ERROR',
          message: error.message || 'Failed to send message',
          timestamp: new Date().toISOString(),
          path: req.path,
        },
      });
    }
  }

  async getConversations(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'User not authenticated',
            timestamp: new Date().toISOString(),
            path: req.path,
          },
        });
        return;
      }

      const conversations = await messageService.getConversations(userId);

      res.json({
        success: true,
        data: conversations,
      });
    } catch (error: any) {
      logger.error('Error in getConversations controller:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'CONVERSATIONS_FETCH_ERROR',
          message: error.message || 'Failed to fetch conversations',
          timestamp: new Date().toISOString(),
          path: req.path,
        },
      });
    }
  }

  async getConversationMessages(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'User not authenticated',
            timestamp: new Date().toISOString(),
            path: req.path,
          },
        });
        return;
      }

      const { conversationId } = req.params;
      const page = parseInt(req.query['page'] as string) || 1;
      const limit = parseInt(req.query['limit'] as string) || 50;

      if (!conversationId) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Conversation ID is required',
            timestamp: new Date().toISOString(),
            path: req.path,
          },
        });
        return;
      }

      const result = await messageService.getConversationMessages(
        conversationId,
        userId,
        page,
        limit
      );

      res.json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      logger.error('Error in getConversationMessages controller:', error);
      const statusCode = error.message.includes('Access denied') ? 403 : 500;
      res.status(statusCode).json({
        success: false,
        error: {
          code: statusCode === 403 ? 'ACCESS_DENIED' : 'MESSAGES_FETCH_ERROR',
          message: error.message || 'Failed to fetch conversation messages',
          timestamp: new Date().toISOString(),
          path: req.path,
        },
      });
    }
  }

  async markAsRead(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'User not authenticated',
            timestamp: new Date().toISOString(),
            path: req.path,
          },
        });
        return;
      }

      const data: MarkAsReadRequest = req.body;

      if (!data.messageIds || !Array.isArray(data.messageIds) || data.messageIds.length === 0) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'messageIds array is required and cannot be empty',
            timestamp: new Date().toISOString(),
            path: req.path,
          },
        });
        return;
      }

      const result = await messageService.markMessagesAsRead(userId, data);

      res.json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      logger.error('Error in markAsRead controller:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'MARK_READ_ERROR',
          message: error.message || 'Failed to mark messages as read',
          timestamp: new Date().toISOString(),
          path: req.path,
        },
      });
    }
  }

  async getUnreadCount(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'User not authenticated',
            timestamp: new Date().toISOString(),
            path: req.path,
          },
        });
        return;
      }

      const unreadCount = await messageService.getUnreadCount(userId);

      res.json({
        success: true,
        data: { unreadCount },
      });
    } catch (error: any) {
      logger.error('Error in getUnreadCount controller:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'UNREAD_COUNT_ERROR',
          message: error.message || 'Failed to get unread count',
          timestamp: new Date().toISOString(),
          path: req.path,
        },
      });
    }
  }
}