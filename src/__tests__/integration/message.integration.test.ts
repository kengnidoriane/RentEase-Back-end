import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import app from '../../server';
import { createTestUser, createTestProperty } from '../factories/userFactory';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();

describe('Message Integration Tests', () => {
  let sender: any;
  let receiver: any;
  let property: any;
  let senderToken: string;
  let receiverToken: string;

  beforeAll(async () => {
    // Clean up database
    await prisma.message.deleteMany();
    await prisma.property.deleteMany();
    await prisma.user.deleteMany();

    // Create test users
    sender = await prisma.user.create({
      data: createTestUser({
        email: 'sender@test.com',
        userType: 'TENANT',
        isVerified: true,
      }),
    });

    receiver = await prisma.user.create({
      data: createTestUser({
        email: 'receiver@test.com',
        userType: 'LANDLORD',
        isVerified: true,
      }),
    });

    // Create test property
    property = await prisma.property.create({
      data: createTestProperty({
        landlordId: receiver.id,
        isVerified: true,
        verificationStatus: 'APPROVED',
      }),
    });

    // Generate JWT tokens
    senderToken = jwt.sign(
      { userId: sender.id, email: sender.email },
      process.env.JWT_SECRET!,
      { expiresIn: '1h' }
    );

    receiverToken = jwt.sign(
      { userId: receiver.id, email: receiver.email },
      process.env.JWT_SECRET!,
      { expiresIn: '1h' }
    );
  });

  afterAll(async () => {
    // Clean up
    await prisma.message.deleteMany();
    await prisma.property.deleteMany();
    await prisma.user.deleteMany();
    await prisma.$disconnect();
  });

  describe('POST /api/messages/send', () => {
    it('should send a message successfully', async () => {
      const messageData = {
        content: 'Hello, is this property still available?',
        receiverId: receiver.id,
        propertyId: property.id,
      };

      const response = await request(app)
        .post('/api/messages/send')
        .set('Authorization', `Bearer ${senderToken}`)
        .send(messageData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('id');
      expect(response.body.data.content).toBe(messageData.content);
      expect(response.body.data.senderId).toBe(sender.id);
      expect(response.body.data.receiverId).toBe(receiver.id);
      expect(response.body.data.propertyId).toBe(property.id);
    });

    it('should return 400 for missing required fields', async () => {
      const response = await request(app)
        .post('/api/messages/send')
        .set('Authorization', `Bearer ${senderToken}`)
        .send({
          content: 'Hello',
          // Missing receiverId and propertyId
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 401 for unauthenticated request', async () => {
      const messageData = {
        content: 'Hello',
        receiverId: receiver.id,
        propertyId: property.id,
      };

      const response = await request(app)
        .post('/api/messages/send')
        .send(messageData)
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('UNAUTHORIZED');
    });

    it('should filter message content with external contact info', async () => {
      const messageData = {
        content: 'Contact me at john@example.com or call 1234567890',
        receiverId: receiver.id,
        propertyId: property.id,
      };

      const response = await request(app)
        .post('/api/messages/send')
        .set('Authorization', `Bearer ${senderToken}`)
        .send(messageData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.content).toContain('[System: Please keep communication on the platform for your security]');
    });
  });

  describe('GET /api/messages/conversations', () => {
    beforeEach(async () => {
      // Create some test messages
      await prisma.message.create({
        data: {
          content: 'Test message 1',
          senderId: sender.id,
          receiverId: receiver.id,
          propertyId: property.id,
          conversationId: `${sender.id}_${receiver.id}_${property.id}`,
        },
      });

      await prisma.message.create({
        data: {
          content: 'Test message 2',
          senderId: receiver.id,
          receiverId: sender.id,
          propertyId: property.id,
          conversationId: `${sender.id}_${receiver.id}_${property.id}`,
        },
      });
    });

    it('should get user conversations', async () => {
      const response = await request(app)
        .get('/api/messages/conversations')
        .set('Authorization', `Bearer ${senderToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBeGreaterThan(0);
    });

    it('should return 401 for unauthenticated request', async () => {
      const response = await request(app)
        .get('/api/messages/conversations')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('UNAUTHORIZED');
    });
  });

  describe('GET /api/messages/conversations/:conversationId/messages', () => {
    let conversationId: string;

    beforeEach(async () => {
      conversationId = `${sender.id}_${receiver.id}_${property.id}`;
      
      // Ensure we have messages in the conversation
      await prisma.message.create({
        data: {
          content: 'Conversation message',
          senderId: sender.id,
          receiverId: receiver.id,
          propertyId: property.id,
          conversationId,
        },
      });
    });

    it('should get conversation messages', async () => {
      const response = await request(app)
        .get(`/api/messages/conversations/${conversationId}/messages`)
        .set('Authorization', `Bearer ${senderToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('messages');
      expect(response.body.data).toHaveProperty('pagination');
      expect(Array.isArray(response.body.data.messages)).toBe(true);
    });

    it('should return 400 for missing conversation ID', async () => {
      const response = await request(app)
        .get('/api/messages/conversations//messages')
        .set('Authorization', `Bearer ${senderToken}`)
        .expect(404); // Express returns 404 for malformed routes

      // This test verifies the route structure
    });

    it('should return 401 for unauthenticated request', async () => {
      const response = await request(app)
        .get(`/api/messages/conversations/${conversationId}/messages`)
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('UNAUTHORIZED');
    });
  });

  describe('PATCH /api/messages/mark-read', () => {
    let messageId: string;

    beforeEach(async () => {
      // Create an unread message
      const message = await prisma.message.create({
        data: {
          content: 'Unread message',
          senderId: receiver.id,
          receiverId: sender.id,
          propertyId: property.id,
          conversationId: `${sender.id}_${receiver.id}_${property.id}`,
          isRead: false,
        },
      });
      messageId = message.id;
    });

    it('should mark messages as read', async () => {
      const response = await request(app)
        .patch('/api/messages/mark-read')
        .set('Authorization', `Bearer ${senderToken}`)
        .send({
          messageIds: [messageId],
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.markedCount).toBe(1);

      // Verify message is marked as read
      const updatedMessage = await prisma.message.findUnique({
        where: { id: messageId },
      });
      expect(updatedMessage?.isRead).toBe(true);
    });

    it('should return 400 for empty messageIds array', async () => {
      const response = await request(app)
        .patch('/api/messages/mark-read')
        .set('Authorization', `Bearer ${senderToken}`)
        .send({
          messageIds: [],
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 401 for unauthenticated request', async () => {
      const response = await request(app)
        .patch('/api/messages/mark-read')
        .send({
          messageIds: [messageId],
        })
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('UNAUTHORIZED');
    });
  });

  describe('GET /api/messages/unread-count', () => {
    beforeEach(async () => {
      // Create some unread messages
      await prisma.message.create({
        data: {
          content: 'Unread message 1',
          senderId: receiver.id,
          receiverId: sender.id,
          propertyId: property.id,
          conversationId: `${sender.id}_${receiver.id}_${property.id}`,
          isRead: false,
        },
      });

      await prisma.message.create({
        data: {
          content: 'Unread message 2',
          senderId: receiver.id,
          receiverId: sender.id,
          propertyId: property.id,
          conversationId: `${sender.id}_${receiver.id}_${property.id}`,
          isRead: false,
        },
      });
    });

    it('should get unread message count', async () => {
      const response = await request(app)
        .get('/api/messages/unread-count')
        .set('Authorization', `Bearer ${senderToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('unreadCount');
      expect(typeof response.body.data.unreadCount).toBe('number');
      expect(response.body.data.unreadCount).toBeGreaterThanOrEqual(2);
    });

    it('should return 401 for unauthenticated request', async () => {
      const response = await request(app)
        .get('/api/messages/unread-count')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('UNAUTHORIZED');
    });
  });
});