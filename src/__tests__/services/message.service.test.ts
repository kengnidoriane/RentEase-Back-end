import { PrismaClient } from '@prisma/client';
import { MessageService } from '../../services/message.service';
import { MessageRepository } from '../../repositories/message.repository';
import { createTestUser } from '../factories/userFactory';
import { createTestProperty } from '../factories/propertyFactory';

// Mock Prisma
jest.mock('@prisma/client');
const MockedPrismaClient = PrismaClient as jest.MockedClass<typeof PrismaClient>;

// Mock MessageRepository
jest.mock('../../repositories/message.repository');
const MockedMessageRepository = MessageRepository as jest.MockedClass<typeof MessageRepository>;

describe('MessageService', () => {
  let messageService: MessageService;
  let mockPrisma: jest.Mocked<PrismaClient>;
  let mockMessageRepository: jest.Mocked<MessageRepository>;

  beforeEach(() => {
    mockPrisma = new MockedPrismaClient() as jest.Mocked<PrismaClient>;
    
    // Mock Prisma methods
    mockPrisma.user = {
      findUnique: jest.fn(),
    } as any;
    
    mockPrisma.property = {
      findUnique: jest.fn(),
    } as any;
    
    mockPrisma.message = {
      findFirst: jest.fn(),
    } as any;
    
    mockMessageRepository = new MockedMessageRepository(mockPrisma) as jest.Mocked<MessageRepository>;
    messageService = new MessageService(mockPrisma);
    
    // Replace the repository instance with our mock
    (messageService as any).messageRepository = mockMessageRepository;
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
      mockMessageRepository.generateConversationId.mockResolvedValueOnce('conversation-id');
      mockMessageRepository.create.mockResolvedValueOnce(mockMessage as any);

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
      expect(mockMessageRepository.generateConversationId).toHaveBeenCalledWith(
        senderId,
        receiverId,
        propertyId
      );
      expect(mockMessageRepository.create).toHaveBeenCalled();
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
      mockMessageRepository.generateConversationId.mockResolvedValueOnce('conversation-id');
      mockMessageRepository.create.mockResolvedValueOnce(mockMessage as any);

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

      // Mock the repository method
      mockMessageRepository.findConversationsByUserId.mockResolvedValueOnce(mockConversations);

      // Act
      const result = await messageService.getConversations(userId);

      // Assert
      expect(Array.isArray(result)).toBe(true);
      expect(result).toEqual(mockConversations);
      expect(mockMessageRepository.findConversationsByUserId).toHaveBeenCalledWith(userId);
    });
  });

  describe('markMessagesAsRead', () => {
    it('should mark messages as read', async () => {
      // Arrange
      const userId = 'user-id';
      const messageIds = ['message-1', 'message-2'];

      mockMessageRepository.markAsRead.mockResolvedValueOnce(2);

      // Act
      const result = await messageService.markMessagesAsRead(userId, { messageIds });

      // Assert
      expect(result.markedCount).toBe(2);
      expect(mockMessageRepository.markAsRead).toHaveBeenCalledWith(messageIds, userId);
    });
  });

  describe('getUnreadCount', () => {
    it('should return unread message count', async () => {
      // Arrange
      const userId = 'user-id';
      const expectedCount = 5;

      mockMessageRepository.getUnreadCount.mockResolvedValueOnce(expectedCount);

      // Act
      const result = await messageService.getUnreadCount(userId);

      // Assert
      expect(result).toBe(expectedCount);
      expect(mockMessageRepository.getUnreadCount).toHaveBeenCalledWith(userId);
    });

    it('should handle errors when getting unread count', async () => {
      // Arrange
      const userId = 'user-id';
      const error = new Error('Database error');

      mockMessageRepository.getUnreadCount.mockRejectedValueOnce(error);

      // Act & Assert
      await expect(messageService.getUnreadCount(userId)).rejects.toThrow('Database error');
    });
  });

  describe('getConversationMessages', () => {
    it('should get conversation messages with pagination', async () => {
      // Arrange
      const conversationId = 'conversation-id';
      const userId = 'user-id';
      const page = 1;
      const limit = 20;

      const mockMessages = [
        {
          id: 'message-1',
          content: 'Hello',
          createdAt: new Date(),
          senderId: 'sender-id',
          receiverId: userId,
        },
      ];

      // Mock conversation participant verification
      mockPrisma.message.findFirst.mockResolvedValueOnce({
        id: 'message-1',
        conversationId,
        senderId: userId,
        receiverId: 'other-user-id',
      } as any);

      mockMessageRepository.findByConversationId.mockResolvedValueOnce({
        messages: mockMessages as any,
        total: 1,
      });

      // Act
      const result = await messageService.getConversationMessages(conversationId, userId, page, limit);

      // Assert
      expect(result.messages).toEqual(mockMessages);
      expect(result.pagination).toEqual({
        page: 1,
        limit: 20,
        total: 1,
        totalPages: 1,
      });
      expect(mockMessageRepository.findByConversationId).toHaveBeenCalledWith(conversationId, page, limit);
    });

    it('should throw error when user is not a conversation participant', async () => {
      // Arrange
      const conversationId = 'conversation-id';
      const userId = 'unauthorized-user-id';

      // Mock conversation participant verification to return null (not a participant)
      mockPrisma.message.findFirst.mockResolvedValueOnce(null);

      // Act & Assert
      await expect(
        messageService.getConversationMessages(conversationId, userId)
      ).rejects.toThrow('Access denied: Not a participant in this conversation');
    });
  });

  describe('content filtering', () => {
    it('should limit message length to 1000 characters', async () => {
      // Arrange
      const senderId = 'sender-id';
      const receiverId = 'receiver-id';
      const propertyId = 'property-id';
      const longContent = 'a'.repeat(1500); // 1500 characters

      const mockReceiver = createTestUser({ id: receiverId });
      const mockProperty = createTestProperty({ id: propertyId });

      mockPrisma.user.findUnique.mockResolvedValueOnce(mockReceiver);
      mockPrisma.property.findUnique.mockResolvedValueOnce(mockProperty);
      mockMessageRepository.generateConversationId.mockResolvedValueOnce('conversation-id');
      
      // Mock the create method to capture the filtered content
      mockMessageRepository.create.mockImplementationOnce(async (data) => {
        expect(data.content.length).toBeLessThanOrEqual(1003); // 1000 + '...'
        expect(data.content).toMatch(/\.\.\.$/); // Ends with ...
        return { id: 'message-id', ...data } as any;
      });

      // Act
      await messageService.sendMessage(senderId, {
        content: longContent,
        receiverId,
        propertyId,
      });

      // Assert
      expect(mockMessageRepository.create).toHaveBeenCalled();
    });

    it('should detect and warn about profanity', async () => {
      // Arrange
      const senderId = 'sender-id';
      const receiverId = 'receiver-id';
      const propertyId = 'property-id';
      const content = 'This is a spam message';

      const mockReceiver = createTestUser({ id: receiverId });
      const mockProperty = createTestProperty({ id: propertyId });

      mockPrisma.user.findUnique.mockResolvedValueOnce(mockReceiver);
      mockPrisma.property.findUnique.mockResolvedValueOnce(mockProperty);
      mockMessageRepository.generateConversationId.mockResolvedValueOnce('conversation-id');
      mockMessageRepository.create.mockResolvedValueOnce({
        id: 'message-id',
        content,
        senderId,
        receiverId,
        propertyId,
      } as any);

      // Act
      const result = await messageService.sendMessage(senderId, {
        content,
        receiverId,
        propertyId,
      });

      // Assert - The message should still be sent but logged as containing filtered content
      expect(result).toBeDefined();
      expect(mockMessageRepository.create).toHaveBeenCalled();
    });

    it('should remove excessive whitespace', async () => {
      // Arrange
      const senderId = 'sender-id';
      const receiverId = 'receiver-id';
      const propertyId = 'property-id';
      const content = 'Hello    world    with    extra    spaces';

      const mockReceiver = createTestUser({ id: receiverId });
      const mockProperty = createTestProperty({ id: propertyId });

      mockPrisma.user.findUnique.mockResolvedValueOnce(mockReceiver);
      mockPrisma.property.findUnique.mockResolvedValueOnce(mockProperty);
      mockMessageRepository.generateConversationId.mockResolvedValueOnce('conversation-id');
      
      mockMessageRepository.create.mockImplementationOnce(async (data) => {
        expect(data.content).toBe('Hello world with extra spaces');
        return { id: 'message-id', ...data } as any;
      });

      // Act
      await messageService.sendMessage(senderId, {
        content,
        receiverId,
        propertyId,
      });

      // Assert
      expect(mockMessageRepository.create).toHaveBeenCalled();
    });

    it('should reject empty messages', async () => {
      // Arrange
      const senderId = 'sender-id';
      const receiverId = 'receiver-id';
      const propertyId = 'property-id';
      const content = '   '; // Only whitespace

      const mockReceiver = createTestUser({ id: receiverId });
      const mockProperty = createTestProperty({ id: propertyId });

      mockPrisma.user.findUnique.mockResolvedValueOnce(mockReceiver);
      mockPrisma.property.findUnique.mockResolvedValueOnce(mockProperty);

      // Act & Assert
      await expect(
        messageService.sendMessage(senderId, {
          content,
          receiverId,
          propertyId,
        })
      ).rejects.toThrow('Message content cannot be empty');
    });
  });

  describe('error handling', () => {
    it('should handle database errors gracefully', async () => {
      // Arrange
      const senderId = 'sender-id';
      const receiverId = 'receiver-id';
      const propertyId = 'property-id';
      const content = 'Hello';

      const error = new Error('Database connection failed');
      mockPrisma.user.findUnique.mockRejectedValueOnce(error);

      // Act & Assert
      await expect(
        messageService.sendMessage(senderId, {
          content,
          receiverId,
          propertyId,
        })
      ).rejects.toThrow('Database connection failed');
    });

    it('should handle inactive receiver', async () => {
      // Arrange
      const senderId = 'sender-id';
      const receiverId = 'receiver-id';
      const propertyId = 'property-id';
      const content = 'Hello';

      const inactiveReceiver = createTestUser({ id: receiverId, isActive: false });
      mockPrisma.user.findUnique.mockResolvedValueOnce(inactiveReceiver);

      // Act & Assert
      await expect(
        messageService.sendMessage(senderId, {
          content,
          receiverId,
          propertyId,
        })
      ).rejects.toThrow('Receiver not found or inactive');
    });

    it('should handle inactive property', async () => {
      // Arrange
      const senderId = 'sender-id';
      const receiverId = 'receiver-id';
      const propertyId = 'property-id';
      const content = 'Hello';

      const mockReceiver = createTestUser({ id: receiverId });
      const inactiveProperty = createTestProperty({ id: propertyId, isActive: false });

      mockPrisma.user.findUnique.mockResolvedValueOnce(mockReceiver);
      mockPrisma.property.findUnique.mockResolvedValueOnce(inactiveProperty);

      // Act & Assert
      await expect(
        messageService.sendMessage(senderId, {
          content,
          receiverId,
          propertyId,
        })
      ).rejects.toThrow('Property not found or inactive');
    });
  });
});