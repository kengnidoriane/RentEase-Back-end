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

/**
 * @swagger
 * /api/messages/send:
 *   post:
 *     summary: Send a message to another user
 *     tags: [Messages]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - content
 *               - receiverId
 *               - propertyId
 *             properties:
 *               content:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 1000
 *                 example: "Hi, I'm interested in your property. Is it still available?"
 *               receiverId:
 *                 type: string
 *                 example: "clp123abc456def789"
 *               propertyId:
 *                 type: string
 *                 example: "clp987zyx654wvu321"
 *     responses:
 *       201:
 *         description: Message sent successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/Message'
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ValidationError'
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Receiver or property not found
 */
router.post(
  '/send',
  authenticate,
  validateRequest(sendMessageSchema),
  messageController.sendMessage.bind(messageController)
);

/**
 * @swagger
 * /api/messages/conversations:
 *   get:
 *     summary: Get user's conversations
 *     tags: [Messages]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Conversations retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           conversationId:
 *                             type: string
 *                           otherUser:
 *                             $ref: '#/components/schemas/User'
 *                           property:
 *                             $ref: '#/components/schemas/Property'
 *                           lastMessage:
 *                             $ref: '#/components/schemas/Message'
 *                           unreadCount:
 *                             type: integer
 *       401:
 *         description: Unauthorized
 */
router.get(
  '/conversations',
  authenticate,
  messageController.getConversations.bind(messageController)
);

/**
 * @swagger
 * /api/messages/conversations/{conversationId}/messages:
 *   get:
 *     summary: Get messages from a specific conversation
 *     tags: [Messages]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: conversationId
 *         required: true
 *         schema:
 *           type: string
 *         description: Conversation ID
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Page number for pagination
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *         description: Number of messages per page
 *     responses:
 *       200:
 *         description: Messages retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Message'
 *                     meta:
 *                       type: object
 *                       properties:
 *                         pagination:
 *                           type: object
 *                           properties:
 *                             page:
 *                               type: integer
 *                             limit:
 *                               type: integer
 *                             total:
 *                               type: integer
 *                             totalPages:
 *                               type: integer
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Conversation not found
 */
router.get(
  '/conversations/:conversationId/messages',
  authenticate,
  validateRequest(conversationMessagesSchema),
  messageController.getConversationMessages.bind(messageController)
);

/**
 * @swagger
 * /api/messages/mark-read:
 *   patch:
 *     summary: Mark messages as read
 *     tags: [Messages]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - messageIds
 *             properties:
 *               messageIds:
 *                 type: array
 *                 items:
 *                   type: string
 *                 minItems: 1
 *                 example: ["clp123abc456def789", "clp987zyx654wvu321"]
 *     responses:
 *       200:
 *         description: Messages marked as read successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         updatedCount:
 *                           type: integer
 *                           description: Number of messages marked as read
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ValidationError'
 *       401:
 *         description: Unauthorized
 */
router.patch(
  '/mark-read',
  authenticate,
  validateRequest(markAsReadSchema),
  messageController.markAsRead.bind(messageController)
);

/**
 * @swagger
 * /api/messages/unread-count:
 *   get:
 *     summary: Get count of unread messages
 *     tags: [Messages]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Unread count retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         unreadCount:
 *                           type: integer
 *                           description: Total number of unread messages
 *       401:
 *         description: Unauthorized
 */
router.get(
  '/unread-count',
  authenticate,
  messageController.getUnreadCount.bind(messageController)
);

export default router;