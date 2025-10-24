import { PrismaClient } from '@prisma/client';
import { MessageRepository } from '../../repositories/message.repository';
import { createTestUser } from '../factories/userFactory';
import { createTestProperty } from '../factories/propertyFactory';

// Mock Prisma
jest.mock('@prisma/client');
const MockedPrismaClient = PrismaClient as jest.MockedClass<typeof PrismaClient>;

describe('MessageRepository', () => {
  let messageRepository: MessageRepository;
  let mockPrisma: jest.Mocked<PrismaClient>;

  beforeEach(() => {
    mockPrisma = new MockedPrismaClient() as jest.Mocked<PrismaClient>;
    
    // Mock Prisma methods
    mockPrisma.message = {
      create: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      updateMany: jest.fn(),
    } as any;
    
    mockPrisma.user = {
      findUnique: jest.fn(),
    } as any;
    
    messageRepository = new MessageRepository(mockPrisma);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a message with all relations', async () => {
      // Arrange
      const messageData = {
        content: 'Hello, is this property available?',
        senderId: 'sender-id',
        receiverId: 'receiver-id',
        propertyId: 'property-id',
        conversationId: 'conversation-id',
      };

      const mockMessage = {
        id: 'message-id',
        ...messageData,
        isRead: false,
        createdAt: new Date(),
        sender: {
          id: 'sender-id',
          firstName: 'John',
          lastName: 'Doe',
          profilePicture: null,
        },
        receiver: {
          id: 'receiver-id',
          firstName: 'Jane',
          lastName: 'Smith',
          profilePicture: null,
        },
        property: {
          id: 'property-id',
          title: 'Test Property',
        },
      };

      mockPrisma.message.create.mockResolvedValueOnce(mockMessage as any);

      // Act
      const result = await messageRepository.create(messageData);

      // Assert
      expect(result).toEqual(mockMessage);
      expect(mockPrisma.message.create).toHaveBeenCalledWith({
        data: messageData,
        include: {
          sender: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              profilePicture: true,
            },
          },
          receiver: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              profilePicture: true,
            },
          },
          property: {
            select: {
              id: true,
              title: true,
            },
          },
        },
      });
    });

    it('should handle database errors', async () => {
      // Arrange
      const messageData = {
        content: 'Hello',
        senderId: 'sender-id',
        receiverId: 'receiver-id',
        propertyId: 'property-id',
        conversationId: 'conversation-id',
      };

      const error = new Error('Database error');
      mockPrisma.message.create.mockRejectedValueOnce(error);

      // Act & Assert
      await expect(messageRepository.create(messageData)).rejects.toThrow('Database error');
    });
  });

  describe('findByConversationId', () => {
    it('should find messages by conversation ID with pagination', async () => {
      // Arrange
      const conversationId = 'conversation-id';
      const page = 1;
      const limit = 20;

      const mockMessages = [
        {
          id: 'message-1',
          content: 'Hello',
          conversationId,
          createdAt: new Date(),
          sender: { id: 'sender-id', firstName: 'John', lastName: 'Doe' },
        },
        {
          id: 'message-2',
          content: 'Hi there',
          conversationId,
          createdAt: new Date(),
          sender: { id: 'receiver-id', firstName: 'Jane', lastName: 'Smith' },
        },
      ];

      mockPrisma.message.findMany.mockResolvedValueOnce(mockMessages as any);
      mockPrisma.message.count.mockResolvedValueOnce(2);

      // Act
      const result = await messageRepository.findByConversationId(conversationId, page, limit);

      // Assert
      expect(result.messages).toEqual(mockMessages);
      expect(result.total).toBe(2);
      expect(mockPrisma.message.findMany).toHaveBeenCalledWith({
        where: { conversationId },
        include: {
          sender: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              profilePicture: true,
            },
          },
          receiver: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              profilePicture: true,
            },
          },
          property: {
            select: {
              id: true,
              title: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: 0,
        take: 20,
      });
      expect(mockPrisma.message.count).toHaveBeenCalledWith({
        where: { conversationId },
      });
    });

    it('should calculate correct skip value for pagination', async () => {
      // Arrange
      const conversationId = 'conversation-id';
      const page = 3;
      const limit = 10;

      mockPrisma.message.findMany.mockResolvedValueOnce([]);
      mockPrisma.message.count.mockResolvedValueOnce(0);

      // Act
      await messageRepository.findByConversationId(conversationId, page, limit);

      // Assert
      expect(mockPrisma.message.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 20, // (3-1) * 10
          take: 10,
        })
      );
    });
  });

  describe('findConversationsByUserId', () => {
    it('should find unique conversations for a user', async () => {
      // Arrange
      const userId = 'user-id';
      const otherUserId = 'other-user-id';
      const propertyId = 'property-id';
      const conversationId = 'conversation-id';

      const mockMessages = [
        {
          conversationId,
          propertyId,
          senderId: userId,
          receiverId: otherUserId,
          createdAt: new Date(),
          property: {
            id: propertyId,
            title: 'Test Property',
            images: [{ url: 'image.jpg', altText: 'Property image' }],
          },
        },
      ];

      const mockOtherParticipant = {
        id: otherUserId,
        firstName: 'Jane',
        lastName: 'Smith',
        profilePicture: null,
      };

      const mockLastMessage = {
        id: 'last-message-id',
        content: 'Latest message',
        createdAt: new Date(),
        sender: mockOtherParticipant,
      };

      mockPrisma.message.findMany.mockResolvedValueOnce(mockMessages as any);
      mockPrisma.user.findUnique.mockResolvedValueOnce(mockOtherParticipant as any);
      mockPrisma.message.findFirst.mockResolvedValueOnce(mockLastMessage as any);
      mockPrisma.message.count.mockResolvedValueOnce(3); // unread count

      // Act
      const result = await messageRepository.findConversationsByUserId(userId);

      // Assert
      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        id: conversationId,
        propertyId,
        participants: [userId, otherUserId],
        lastMessage: mockLastMessage,
        unreadCount: 3,
        property: mockMessages[0].property,
        otherParticipant: mockOtherParticipant,
      });
    });

    it('should handle multiple conversations and deduplicate', async () => {
      // Arrange
      const userId = 'user-id';
      const conversationId = 'conversation-id';

      // Mock multiple messages from same conversation
      const mockMessages = [
        {
          conversationId,
          propertyId: 'property-id',
          senderId: userId,
          receiverId: 'other-user-id',
          createdAt: new Date('2023-01-02'),
          property: { id: 'property-id', title: 'Test Property', images: [] },
        },
        {
          conversationId,
          propertyId: 'property-id',
          senderId: 'other-user-id',
          receiverId: userId,
          createdAt: new Date('2023-01-01'),
          property: { id: 'property-id', title: 'Test Property', images: [] },
        },
      ];

      mockPrisma.message.findMany.mockResolvedValueOnce(mockMessages as any);
      mockPrisma.user.findUnique.mockResolvedValueOnce({
        id: 'other-user-id',
        firstName: 'Jane',
        lastName: 'Smith',
        profilePicture: null,
      } as any);
      mockPrisma.message.findFirst.mockResolvedValueOnce({
        id: 'last-message-id',
        content: 'Latest message',
        createdAt: new Date(),
        sender: { id: 'other-user-id', firstName: 'Jane', lastName: 'Smith' },
      } as any);
      mockPrisma.message.count.mockResolvedValueOnce(0);

      // Act
      const result = await messageRepository.findConversationsByUserId(userId);

      // Assert
      expect(result).toHaveLength(1); // Should deduplicate to one conversation
    });
  });

  describe('markAsRead', () => {
    it('should mark messages as read for the receiver', async () => {
      // Arrange
      const messageIds = ['message-1', 'message-2'];
      const userId = 'user-id';

      mockPrisma.message.updateMany.mockResolvedValueOnce({ count: 2 });

      // Act
      const result = await messageRepository.markAsRead(messageIds, userId);

      // Assert
      expect(result).toBe(2);
      expect(mockPrisma.message.updateMany).toHaveBeenCalledWith({
        where: {
          id: { in: messageIds },
          receiverId: userId,
          isRead: false,
        },
        data: { isRead: true },
      });
    });

    it('should return 0 if no messages were updated', async () => {
      // Arrange
      const messageIds = ['message-1'];
      const userId = 'user-id';

      mockPrisma.message.updateMany.mockResolvedValueOnce({ count: 0 });

      // Act
      const result = await messageRepository.markAsRead(messageIds, userId);

      // Assert
      expect(result).toBe(0);
    });
  });

  describe('findById', () => {
    it('should find message by ID with relations', async () => {
      // Arrange
      const messageId = 'message-id';
      const mockMessage = {
        id: messageId,
        content: 'Hello',
        createdAt: new Date(),
        sender: { id: 'sender-id', firstName: 'John', lastName: 'Doe' },
        receiver: { id: 'receiver-id', firstName: 'Jane', lastName: 'Smith' },
        property: { id: 'property-id', title: 'Test Property' },
      };

      mockPrisma.message.findUnique.mockResolvedValueOnce(mockMessage as any);

      // Act
      const result = await messageRepository.findById(messageId);

      // Assert
      expect(result).toEqual(mockMessage);
      expect(mockPrisma.message.findUnique).toHaveBeenCalledWith({
        where: { id: messageId },
        include: {
          sender: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              profilePicture: true,
            },
          },
          receiver: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              profilePicture: true,
            },
          },
          property: {
            select: {
              id: true,
              title: true,
            },
          },
        },
      });
    });

    it('should return null if message not found', async () => {
      // Arrange
      const messageId = 'non-existent-id';
      mockPrisma.message.findUnique.mockResolvedValueOnce(null);

      // Act
      const result = await messageRepository.findById(messageId);

      // Assert
      expect(result).toBeNull();
    });
  });

  describe('getUnreadCount', () => {
    it('should get unread message count for user', async () => {
      // Arrange
      const userId = 'user-id';
      const expectedCount = 5;

      mockPrisma.message.count.mockResolvedValueOnce(expectedCount);

      // Act
      const result = await messageRepository.getUnreadCount(userId);

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

  describe('generateConversationId', () => {
    it('should generate consistent conversation ID', async () => {
      // Arrange
      const senderId = 'user-1';
      const receiverId = 'user-2';
      const propertyId = 'property-id';

      // Act
      const result1 = await messageRepository.generateConversationId(senderId, receiverId, propertyId);
      const result2 = await messageRepository.generateConversationId(receiverId, senderId, propertyId);

      // Assert
      expect(result1).toBe(result2); // Should be the same regardless of order
      expect(result1).toBe('user-1_user-2_property-id');
    });

    it('should sort participants to ensure consistency', async () => {
      // Arrange
      const user1 = 'zzz-user';
      const user2 = 'aaa-user';
      const propertyId = 'property-id';

      // Act
      const result = await messageRepository.generateConversationId(user1, user2, propertyId);

      // Assert
      expect(result).toBe('aaa-user_zzz-user_property-id'); // Should be sorted alphabetically
    });
  });

  describe('error handling', () => {
    it('should handle database errors in findByConversationId', async () => {
      // Arrange
      const conversationId = 'conversation-id';
      const error = new Error('Database connection failed');

      mockPrisma.message.findMany.mockRejectedValueOnce(error);

      // Act & Assert
      await expect(
        messageRepository.findByConversationId(conversationId)
      ).rejects.toThrow('Database connection failed');
    });

    it('should handle database errors in markAsRead', async () => {
      // Arrange
      const messageIds = ['message-1'];
      const userId = 'user-id';
      const error = new Error('Update failed');

      mockPrisma.message.updateMany.mockRejectedValueOnce(error);

      // Act & Assert
      await expect(
        messageRepository.markAsRead(messageIds, userId)
      ).rejects.toThrow('Update failed');
    });

    it('should handle database errors in getUnreadCount', async () => {
      // Arrange
      const userId = 'user-id';
      const error = new Error('Count failed');

      mockPrisma.message.count.mockRejectedValueOnce(error);

      // Act & Assert
      await expect(
        messageRepository.getUnreadCount(userId)
      ).rejects.toThrow('Count failed');
    });
  });
});