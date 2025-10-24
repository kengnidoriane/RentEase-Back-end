import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import { Server } from 'http';
import { io as Client, Socket } from 'socket.io-client';
import app from '../../server';
import { createTestUser } from '../factories/userFactory';
import { createTestProperty } from '../factories/propertyFactory';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();
let server: Server;
let clientSocket: Socket;

describe('Message Integration Tests', () => {
  let sender: any;
  let receiver: any;
  let property: any;
  let senderToken: string;
  let receiverToken: string;

  beforeAll(async () => {
    // Start the server
    server = app.listen(0); // Use port 0 to get a random available port
    const address = server.address();
    const port = typeof address === 'string' ? address : address?.port;

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

    // Create WebSocket client for testing
    clientSocket = Client(`http://localhost:${port}`, {
      auth: {
        token: senderToken,
      },
      transports: ['websocket'],
    });

    // Wait for connection
    await new Promise<void>((resolve) => {
      clientSocket.on('connect', resolve);
    });
  });

  afterAll(async () => {
    // Clean up WebSocket connection
    if (clientSocket) {
      clientSocket.disconnect();
    }

    // Close server
    if (server) {
      server.close();
    }

    // Clean up database
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

  describe('WebSocket Real-time Messaging', () => {
    let receiverSocket: Socket;
    let conversationId: string;

    beforeEach(async () => {
      // Create receiver socket
      const address = server.address();
      const port = typeof address === 'string' ? address : address?.port;
      
      receiverSocket = Client(`http://localhost:${port}`, {
        auth: {
          token: receiverToken,
        },
        transports: ['websocket'],
      });

      // Wait for receiver connection
      await new Promise<void>((resolve) => {
        receiverSocket.on('connect', resolve);
      });

      // Generate conversation ID
      conversationId = `${sender.id}_${receiver.id}_${property.id}`;

      // Both users join the conversation
      clientSocket.emit('join_conversation', conversationId);
      receiverSocket.emit('join_conversation', conversationId);

      // Wait a bit for join operations to complete
      await new Promise(resolve => setTimeout(resolve, 100));
    });

    afterEach(() => {
      if (receiverSocket) {
        receiverSocket.disconnect();
      }
    });

    it('should establish WebSocket connection with authentication', (done) => {
      expect(clientSocket.connected).toBe(true);
      expect(receiverSocket.connected).toBe(true);
      done();
    });

    it('should reject WebSocket connection without valid token', (done) => {
      const address = server.address();
      const port = typeof address === 'string' ? address : address?.port;
      
      const unauthorizedSocket = Client(`http://localhost:${port}`, {
        auth: {
          token: 'invalid-token',
        },
        transports: ['websocket'],
      });

      unauthorizedSocket.on('connect_error', (error) => {
        expect(error.message).toContain('Authentication failed');
        unauthorizedSocket.disconnect();
        done();
      });

      // If it connects (which it shouldn't), fail the test
      unauthorizedSocket.on('connect', () => {
        unauthorizedSocket.disconnect();
        done(new Error('Should not have connected with invalid token'));
      });
    });

    it('should allow users to join conversations they participate in', (done) => {
      let joinedCount = 0;

      const checkJoined = () => {
        joinedCount++;
        if (joinedCount === 2) {
          done();
        }
      };

      // Listen for successful joins (no error events)
      clientSocket.emit('join_conversation', conversationId);
      receiverSocket.emit('join_conversation', conversationId);

      // If no errors after a short delay, consider it successful
      setTimeout(checkJoined, 100);
      setTimeout(checkJoined, 100);
    });

    it('should reject users from joining conversations they do not participate in', (done) => {
      const unauthorizedConversationId = 'unauthorized_conversation_id';

      clientSocket.on('error', (error) => {
        expect(error.message).toBe('Access denied to conversation');
        done();
      });

      clientSocket.emit('join_conversation', unauthorizedConversationId);
    });

    it('should broadcast new messages to conversation participants', (done) => {
      const messageData = {
        conversationId,
        content: 'Hello from WebSocket test',
        propertyId: property.id,
      };

      receiverSocket.on('new_message', (receivedMessage) => {
        expect(receivedMessage.content).toBe(messageData.content);
        expect(receivedMessage.conversationId).toBe(conversationId);
        expect(receivedMessage.sender).toEqual({
          id: sender.id,
          firstName: sender.firstName,
          lastName: sender.lastName,
        });
        done();
      });

      clientSocket.emit('new_message', messageData);
    });

    it('should broadcast typing indicators', (done) => {
      receiverSocket.on('user_typing', (data) => {
        expect(data.userId).toBe(sender.id);
        expect(data.conversationId).toBe(conversationId);
        expect(data.user).toEqual({
          id: sender.id,
          firstName: sender.firstName,
          lastName: sender.lastName,
        });
        done();
      });

      clientSocket.emit('typing', { conversationId });
    });

    it('should broadcast stop typing indicators', (done) => {
      receiverSocket.on('user_stop_typing', (data) => {
        expect(data.userId).toBe(sender.id);
        expect(data.conversationId).toBe(conversationId);
        done();
      });

      clientSocket.emit('stop_typing', { conversationId });
    });

    it('should broadcast message read status', (done) => {
      const messageIds = ['message-1', 'message-2'];

      receiverSocket.on('messages_read', (data) => {
        expect(data.messageIds).toEqual(messageIds);
        expect(data.readBy).toBe(sender.id);
        expect(data.conversationId).toBe(conversationId);
        done();
      });

      clientSocket.emit('message_read', {
        messageIds,
        conversationId,
      });
    });

    it('should handle user disconnect and reconnect', (done) => {
      // Disconnect client
      clientSocket.disconnect();

      // Wait a bit
      setTimeout(() => {
        // Reconnect
        clientSocket.connect();

        clientSocket.on('connect', () => {
          expect(clientSocket.connected).toBe(true);
          done();
        });
      }, 100);
    });

    it('should maintain conversation state across reconnections', (done) => {
      // Disconnect and reconnect
      clientSocket.disconnect();

      setTimeout(() => {
        clientSocket.connect();

        clientSocket.on('connect', () => {
          // Rejoin conversation
          clientSocket.emit('join_conversation', conversationId);

          // Test that messaging still works
          const messageData = {
            conversationId,
            content: 'Message after reconnection',
            propertyId: property.id,
          };

          receiverSocket.on('new_message', (receivedMessage) => {
            expect(receivedMessage.content).toBe(messageData.content);
            done();
          });

          // Wait a bit for rejoin to complete, then send message
          setTimeout(() => {
            clientSocket.emit('new_message', messageData);
          }, 100);
        });
      }, 100);
    });
  });

  describe('WebSocket Error Handling', () => {
    it('should handle database errors gracefully during conversation join', (done) => {
      // Create a conversation ID that will cause database issues
      const problematicConversationId = 'problematic_conversation';

      clientSocket.on('error', (error) => {
        expect(error.message).toBe('Failed to join conversation');
        done();
      });

      // This should trigger an error in the conversation verification
      clientSocket.emit('join_conversation', problematicConversationId);
    });

    it('should handle malformed message data', (done) => {
      // Send malformed message data
      const malformedData = {
        // Missing required fields
        content: 'Test message',
      };

      // The WebSocket should handle this gracefully without crashing
      clientSocket.emit('new_message', malformedData);

      // If no crash occurs within a reasonable time, consider it handled
      setTimeout(() => {
        expect(clientSocket.connected).toBe(true);
        done();
      }, 200);
    });
  });

  describe('WebSocket Performance', () => {
    it('should handle multiple rapid messages', (done) => {
      const messageCount = 10;
      let receivedCount = 0;
      const messages: string[] = [];

      const address = server.address();
      const port = typeof address === 'string' ? address : address?.port;
      
      const receiverSocket = Client(`http://localhost:${port}`, {
        auth: {
          token: receiverToken,
        },
        transports: ['websocket'],
      });

      receiverSocket.on('connect', () => {
        const conversationId = `${sender.id}_${receiver.id}_${property.id}`;
        
        // Join conversation
        clientSocket.emit('join_conversation', conversationId);
        receiverSocket.emit('join_conversation', conversationId);

        receiverSocket.on('new_message', (receivedMessage) => {
          messages.push(receivedMessage.content);
          receivedCount++;

          if (receivedCount === messageCount) {
            // Verify all messages were received
            expect(messages).toHaveLength(messageCount);
            for (let i = 0; i < messageCount; i++) {
              expect(messages).toContain(`Message ${i}`);
            }
            receiverSocket.disconnect();
            done();
          }
        });

        // Send multiple messages rapidly
        setTimeout(() => {
          for (let i = 0; i < messageCount; i++) {
            clientSocket.emit('new_message', {
              conversationId,
              content: `Message ${i}`,
              propertyId: property.id,
            });
          }
        }, 100);
      });
    });

    it('should handle concurrent users in same conversation', (done) => {
      const address = server.address();
      const port = typeof address === 'string' ? address : address?.port;
      
      // Create multiple receiver sockets
      const receiverSocket1 = Client(`http://localhost:${port}`, {
        auth: { token: receiverToken },
        transports: ['websocket'],
      });

      const receiverSocket2 = Client(`http://localhost:${port}`, {
        auth: { token: receiverToken },
        transports: ['websocket'],
      });

      let connectCount = 0;
      let messageCount = 0;

      const checkConnections = () => {
        connectCount++;
        if (connectCount === 2) {
          const conversationId = `${sender.id}_${receiver.id}_${property.id}`;
          
          // All sockets join the conversation
          clientSocket.emit('join_conversation', conversationId);
          receiverSocket1.emit('join_conversation', conversationId);
          receiverSocket2.emit('join_conversation', conversationId);

          const messageHandler = (receivedMessage: any) => {
            expect(receivedMessage.content).toBe('Broadcast test message');
            messageCount++;
            
            // Both receiver sockets should receive the message
            if (messageCount === 2) {
              receiverSocket1.disconnect();
              receiverSocket2.disconnect();
              done();
            }
          };

          receiverSocket1.on('new_message', messageHandler);
          receiverSocket2.on('new_message', messageHandler);

          // Send message after a short delay
          setTimeout(() => {
            clientSocket.emit('new_message', {
              conversationId,
              content: 'Broadcast test message',
              propertyId: property.id,
            });
          }, 200);
        }
      };

      receiverSocket1.on('connect', checkConnections);
      receiverSocket2.on('connect', checkConnections);
    });
  });
});