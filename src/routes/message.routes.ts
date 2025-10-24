import { Router } from 'express';
import { MessageController } from '../controllers/message.controller';
import { authenticate } from '../middleware/auth.middleware';
import { validateRequest } from '../middleware/validation.middleware';
import { z } from 'zod';

const router = Router();
const messageController = new MessageController();

// Validation schemas
const sendMessageSchema = z.object({
  body: z.object({
    content: z.string().min(1, 'Content is required').max(1000, 'Content too long'),
    receiverId: z.string().min(1, 'Receiver ID is required'),
    propertyId: z.string().min(1, 'Property ID is required'),
  }),
});

const markAsReadSchema = z.object({
  body: z.object({
    messageIds: z.array(z.string()).min(1, 'At least one message ID is required'),
  }),
});

const conversationMessagesSchema = z.object({
  params: z.object({
    conversationId: z.string().min(1, 'Conversation ID is required'),
  }),
  query: z.object({
    page: z.string().optional(),
    limit: z.string().optional(),
  }),
});

// Routes
router.post(
  '/send',
  authenticate,
  validateRequest(sendMessageSchema),
  messageController.sendMessage.bind(messageController)
);

router.get(
  '/conversations',
  authenticate,
  messageController.getConversations.bind(messageController)
);

router.get(
  '/conversations/:conversationId/messages',
  authenticate,
  validateRequest(conversationMessagesSchema),
  messageController.getConversationMessages.bind(messageController)
);

router.patch(
  '/mark-read',
  authenticate,
  validateRequest(markAsReadSchema),
  messageController.markAsRead.bind(messageController)
);

router.get(
  '/unread-count',
  authenticate,
  messageController.getUnreadCount.bind(messageController)
);

export default router;