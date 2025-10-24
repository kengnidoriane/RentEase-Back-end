import { PrismaClient } from '@prisma/client';
import { MessageService } from '../../services/message.service';
import { createTestUser, createTestProperty } from '../factories/userFactory';

// Mock Prisma
jest.mock('@prisma/client');
const MockedPrismaClient = PrismaClient as jest.MockedClass<typeof PrismaClient>;

describe('MessageService', () => {
  let messageService: MessageService;
  let mockPrisma: jest.Mocked<PrismaClient>;

  beforeEach(() => {
    mockPrisma = new MockedPrismaClient() as jest.Mocked<PrismaClient>;
    messageService = new MessageService(mockPrisma);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('sendMessage', () => {
    it('should send a message successfully', async () => {
      // Arrange
      const senderId = 'sender-id';
      const receiverId = 'receiver-id';
      const propertyId = 'property-id';
      const content = 'Hello, is this property still available?';

      const mockReceiver = createTestUser({ id: receiverId });
      const mockProperty = createTestProperty({ id: propertyId });
      const mockMessage = {
        id: 'message-id',
        content,
        senderId,
        receiverId,
        propertyId,
        conversationId: 'conversation-id',
        isRead: false,
        createdAt: new Date(),
        sender: {
          id: senderId,
          firstName: 'John',
          lastName: 'Doe',
          profilePicture: null,
        },
        receiver: {
          id: receiverId,
          firstName: 'Jane',
          lastName: 'Smith',
          profilePicture: null,
        },
        property: {
          id: propertyId,
          title: 'Test Property',
        },
      };

      mockPrisma.user.findUnique.mockResolvedValueOnce(mockReceiver);
      mockPrisma.property.findUnique.mockResolvedValueOnce(mockProperty);
      mockPrisma.message.create.mockResolvedValueOnce(mockMessage as any);

      // Act
      const result = await messageService.sendMessage(senderId, {
        content,
        receiverId,
        propertyId,
      });

      // Assert
      expect(result).toEqual(mockMessage);
      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: receiverId },
      });
      expect(mockPrisma.property.findUnique).toHaveBeenCalledWith({
        where: { id: propertyId },
      });
      expect(mockPrisma.message.create).toHaveBeenCalled();
    });

    it('should throw error when receiver not found', async () => {
      // Arrange
      const senderId = 'sender-id';
      const receiverId = 'invalid-receiver-id';
      const propertyId = 'property-id';
      const content = 'Hello';

      mockPrisma.user.findUnique.mockResolvedValueOnce(null);

      // Act & Assert
      await expect(
        messageService.sendMessage(senderId, {
          content,
          receiverId,
          propertyId,
        })
      ).rejects.toThrow('Receiver not found or inactive');
    });

    it('should throw error when property not found', async () => {
      // Arrange
      const senderId = 'sender-id';
      const receiverId = 'receiver-id';
      const propertyId = 'invalid-property-id';
      const content = 'Hello';

      const mockReceiver = createTestUser({ id: receiverId });
      mockPrisma.user.findUnique.mockResolvedValueOnce(mockReceiver);
      mockPrisma.property.findUnique.mockResolvedValueOnce(null);

      // Act & Assert
      await expect(
        messageService.sendMessage(senderId, {
          content,
          receiverId,
          propertyId,
        })
      ).rejects.toThrow('Property not found or inactive');
    });

    it('should throw error when trying to send message to self', async () => {
      // Arrange
      const userId = 'user-id';
      const propertyId = 'property-id';
      const content = 'Hello';

      // Act & Assert
      await expect(
        messageService.sendMessage(userId, {
          content,
          receiverId: userId,
          propertyId,
        })
      ).rejects.toThrow('Cannot send message to yourself');
    });

    it('should filter message content', async () => {
      // Arrange
      const senderId = 'sender-id';
      const receiverId = 'receiver-id';
      const propertyId = 'property-id';
      const content = 'Contact me at john@example.com or call 1234567890';

      const mockReceiver = createTestUser({ id: receiverId });
      const mockProperty = createTestProperty({ id: propertyId });
      const mockMessage = {
        id: 'message-id',
        content: content + '\n\n[System: Please keep communication on the platform for your security]',
        senderId,
        receiverId,
        propertyId,
        conversationId: 'conversation-id',
        isRead: false,
        createdAt: new Date(),
      };

      mockPrisma.user.findUnique.mockResolvedValueOnce(mockReceiver);
      mockPrisma.property.findUnique.mockResolvedValueOnce(mockProperty);
      mockPrisma.message.create.mockResolvedValueOnce(mockMessage as any);

      // Act
      const result = await messageService.sendMessage(senderId, {
        content,
        receiverId,
        propertyId,
      });

      // Assert
      expect(result.content).toContain('[System: Please keep communication on the platform for your security]');
    });
  });

  describe('getConversations', () => {
    it('should return user conversations', async () => {
      // Arrange
      const userId = 'user-id';
      const mockConversations = [
        {
          id: 'conversation-1',
          propertyId: 'property-1',
          participants: ['user-id', 'other-user-id'],
          lastMessage: {
            id: 'message-1',
            content: 'Hello',
            createdAt: new Date(),
          },
          unreadCount: 2,
          property: {
            id: 'property-1',
            title: 'Test Property',
            images: [],
          },
          otherParticipant: {
            id: 'other-user-id',
            firstName: 'John',
            lastName: 'Doe',
            profilePicture: null,
          },
        },
      ];

      // Mock the complex query in findConversationsByUserId
      mockPrisma.message.findMany.mockResolvedValueOnce([
        {
          conversationId: 'conversation-1',
          propertyId: 'property-1',
          senderId: 'other-user-id',
          receiverId: userId,
          createdAt: new Date(),
          property: {
            id: 'property-1',
            title: 'Test Property',
            images: [],
          },
        },
      ] as any);

      mockPrisma.user.findUnique.mockResolvedValueOnce({
        id: 'other-user-id',
        firstName: 'John',
        lastName: 'Doe',
        profilePicture: null,
      } as any);

      mockPrisma.message.findFirst.mockResolvedValueOnce({
        id: 'message-1',
        content: 'Hello',
        createdAt: new Date(),
        sender: {
          id: 'other-user-id',
          firstName: 'John',
          lastName: 'Doe',
          profilePicture: null,
        },
      } as any);

      mockPrisma.message.count.mockResolvedValueOnce(2);

      // Act
      const result = await messageService.getConversations(userId);

      // Assert
      expect(Array.isArray(result)).toBe(true);
      expect(mockPrisma.message.findMany).toHaveBeenCalled();
    });
  });

  describe('markMessagesAsRead', () => {
    it('should mark messages as read', async () => {
      // Arrange
      const userId = 'user-id';
      const messageIds = ['message-1', 'message-2'];

      mockPrisma.message.updateMany.mockResolvedValueOnce({ count: 2 });

      // Act
      const result = await messageService.markMessagesAsRead(userId, { messageIds });

      // Assert
      expect(result.markedCount).toBe(2);
      expect(mockPrisma.message.updateMany).toHaveBeenCalledWith({
        where: {
          id: { in: messageIds },
          receiverId: userId,
          isRead: false,
        },
        data: { isRead: true },
      });
    });
  });

  describe('getUnreadCount', () => {
    it('should return unread message count', async () => {
      // Arrange
      const userId = 'user-id';
      const expectedCount = 5;

      mockPrisma.message.count.mockResolvedValueOnce(expectedCount);

      // Act
      const result = await messageService.getUnreadCount(userId);

      // Assert
      expect(result).toBe(expectedCount);
      expect(mockPrisma.message.count).toHaveBeenCalledWith({
        where: {
          receiverId: userId,
          isRead: false,
        },
      });
    });
  });
});