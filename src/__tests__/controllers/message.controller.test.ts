import { MessageController } from '../../controllers/message.controller';
import { MessageService } from '../../services/message.service';
import { createMockRequest, createMockResponse, createMockNext } from '../utils/testUtils';
import { AuthenticatedRequest } from '../../types/auth.types';

// Mock MessageService
jest.mock('../../services/message.service');
const MockedMessageService = MessageService as jest.MockedClass<typeof MessageService>;

// Mock PrismaClient
jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn().mockImplementation(() => ({})),
}));

describe('MessageController', () => {
  let messageController: MessageController;
  let mockMessageService: jest.Mocked<MessageService>;
  let mockRequest: Partial<AuthenticatedRequest>;
  let mockResponse: any;

  beforeEach(() => {
    mockMessageService = new MockedMessageService({} as any) as jest.Mocked<MessageService>;
    messageController = new MessageController();
    
    // Replace the service instance with our mock
    (messageController as any).messageService = mockMessageService;

    mockRequest = createMockRequest({
      user: {
        id: 'user-id',
        email: 'test@example.com',
        userType: 'TENANT',
      },
      path: '/api/messages/send',
    }) as Partial<AuthenticatedRequest>;

    mockResponse = createMockResponse();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('sendMessage', () => {
    it('should send message successfully', async () => {
      // Arrange
      const messageData = {
        content: 'Hello, is this property available?',
        receiverId: 'receiver-id',
        propertyId: 'property-id',
      };

      const mockMessage = {
        id: 'message-id',
        ...messageData,
        senderId: 'user-id',
        conversationId: 'conversation-id',
        isRead: false,
        createdAt: new Date(),
      };

      mockRequest.body = messageData;
      mockMessageService.sendMessage.mockResolvedValueOnce(mockMessage as any);

      // Act
      await messageController.sendMessage(mockRequest as AuthenticatedRequest, mockResponse);

      // Assert
      expect(mockMessageService.sendMessage).toHaveBeenCalledWith('user-id', messageData);
      expect(mockResponse.status).toHaveBeenCalledWith(201);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: mockMessage,
      });
    });

    it('should return 401 when user is not authenticated', async () => {
      // Arrange
      mockRequest.user = undefined;

      // Act
      await messageController.sendMessage(mockRequest as AuthenticatedRequest, mockResponse);

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'User not authenticated',
          timestamp: expect.any(String),
          path: '/api/messages/send',
        },
      });
    });

    it('should return 400 when required fields are missing', async () => {
      // Arrange
      mockRequest.body = {
        content: 'Hello',
        // Missing receiverId and propertyId
      };

      // Act
      await messageController.sendMessage(mockRequest as AuthenticatedRequest, mockResponse);

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Content, receiverId, and propertyId are required',
          timestamp: expect.any(String),
          path: '/api/messages/send',
        },
      });
    });

    it('should handle service errors', async () => {
      // Arrange
      const messageData = {
        content: 'Hello',
        receiverId: 'receiver-id',
        propertyId: 'property-id',
      };

      mockRequest.body = messageData;
      mockMessageService.sendMessage.mockRejectedValueOnce(new Error('Receiver not found'));

      // Act
      await messageController.sendMessage(mockRequest as AuthenticatedRequest, mockResponse);

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'MESSAGE_SEND_ERROR',
          message: 'Receiver not found',
          timestamp: expect.any(String),
          path: '/api/messages/send',
        },
      });
    });

    it('should handle empty content', async () => {
      // Arrange
      mockRequest.body = {
        content: '',
        receiverId: 'receiver-id',
        propertyId: 'property-id',
      };

      // Act
      await messageController.sendMessage(mockRequest as AuthenticatedRequest, mockResponse);

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Content, receiverId, and propertyId are required',
          timestamp: expect.any(String),
          path: '/api/messages/send',
        },
      });
    });
  });

  describe('getConversations', () => {
    it('should get user conversations successfully', async () => {
      // Arrange
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
        },
      ];

      mockMessageService.getConversations.mockResolvedValueOnce(mockConversations as any);

      // Act
      await messageController.getConversations(mockRequest as AuthenticatedRequest, mockResponse);

      // Assert
      expect(mockMessageService.getConversations).toHaveBeenCalledWith('user-id');
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: mockConversations,
      });
    });

    it('should return 401 when user is not authenticated', async () => {
      // Arrange
      mockRequest.user = undefined;

      // Act
      await messageController.getConversations(mockRequest as AuthenticatedRequest, mockResponse);

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'User not authenticated',
          timestamp: expect.any(String),
          path: '/api/messages/send',
        },
      });
    });

    it('should handle service errors', async () => {
      // Arrange
      mockMessageService.getConversations.mockRejectedValueOnce(new Error('Database error'));

      // Act
      await messageController.getConversations(mockRequest as AuthenticatedRequest, mockResponse);

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'CONVERSATIONS_FETCH_ERROR',
          message: 'Database error',
          timestamp: expect.any(String),
          path: '/api/messages/send',
        },
      });
    });
  });

  describe('getConversationMessages', () => {
    it('should get conversation messages successfully', async () => {
      // Arrange
      const conversationId = 'conversation-id';
      const mockResult = {
        messages: [
          {
            id: 'message-1',
            content: 'Hello',
            createdAt: new Date(),
          },
        ],
        pagination: {
          page: 1,
          limit: 50,
          total: 1,
          totalPages: 1,
        },
      };

      mockRequest.params = { conversationId };
      mockRequest.query = { page: '1', limit: '50' };
      mockMessageService.getConversationMessages.mockResolvedValueOnce(mockResult as any);

      // Act
      await messageController.getConversationMessages(mockRequest as AuthenticatedRequest, mockResponse);

      // Assert
      expect(mockMessageService.getConversationMessages).toHaveBeenCalledWith(
        conversationId,
        'user-id',
        1,
        50
      );
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: mockResult,
      });
    });

    it('should use default pagination values', async () => {
      // Arrange
      const conversationId = 'conversation-id';
      mockRequest.params = { conversationId };
      mockRequest.query = {}; // No pagination params

      mockMessageService.getConversationMessages.mockResolvedValueOnce({
        messages: [],
        pagination: { page: 1, limit: 50, total: 0, totalPages: 0 },
      } as any);

      // Act
      await messageController.getConversationMessages(mockRequest as AuthenticatedRequest, mockResponse);

      // Assert
      expect(mockMessageService.getConversationMessages).toHaveBeenCalledWith(
        conversationId,
        'user-id',
        1, // default page
        50 // default limit
      );
    });

    it('should return 400 when conversation ID is missing', async () => {
      // Arrange
      mockRequest.params = {}; // No conversationId

      // Act
      await messageController.getConversationMessages(mockRequest as AuthenticatedRequest, mockResponse);

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Conversation ID is required',
          timestamp: expect.any(String),
          path: '/api/messages/send',
        },
      });
    });

    it('should return 403 for access denied errors', async () => {
      // Arrange
      const conversationId = 'conversation-id';
      mockRequest.params = { conversationId };
      mockMessageService.getConversationMessages.mockRejectedValueOnce(
        new Error('Access denied: Not a participant in this conversation')
      );

      // Act
      await messageController.getConversationMessages(mockRequest as AuthenticatedRequest, mockResponse);

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'ACCESS_DENIED',
          message: 'Access denied: Not a participant in this conversation',
          timestamp: expect.any(String),
          path: '/api/messages/send',
        },
      });
    });

    it('should return 401 when user is not authenticated', async () => {
      // Arrange
      mockRequest.user = undefined;

      // Act
      await messageController.getConversationMessages(mockRequest as AuthenticatedRequest, mockResponse);

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(401);
    });
  });

  describe('markAsRead', () => {
    it('should mark messages as read successfully', async () => {
      // Arrange
      const messageIds = ['message-1', 'message-2'];
      mockRequest.body = { messageIds };
      mockMessageService.markMessagesAsRead.mockResolvedValueOnce({ markedCount: 2 });

      // Act
      await messageController.markAsRead(mockRequest as AuthenticatedRequest, mockResponse);

      // Assert
      expect(mockMessageService.markMessagesAsRead).toHaveBeenCalledWith('user-id', { messageIds });
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: { markedCount: 2 },
      });
    });

    it('should return 400 when messageIds is missing', async () => {
      // Arrange
      mockRequest.body = {}; // No messageIds

      // Act
      await messageController.markAsRead(mockRequest as AuthenticatedRequest, mockResponse);

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'messageIds array is required and cannot be empty',
          timestamp: expect.any(String),
          path: '/api/messages/send',
        },
      });
    });

    it('should return 400 when messageIds is empty array', async () => {
      // Arrange
      mockRequest.body = { messageIds: [] };

      // Act
      await messageController.markAsRead(mockRequest as AuthenticatedRequest, mockResponse);

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'messageIds array is required and cannot be empty',
          timestamp: expect.any(String),
          path: '/api/messages/send',
        },
      });
    });

    it('should return 400 when messageIds is not an array', async () => {
      // Arrange
      mockRequest.body = { messageIds: 'not-an-array' };

      // Act
      await messageController.markAsRead(mockRequest as AuthenticatedRequest, mockResponse);

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(400);
    });

    it('should handle service errors', async () => {
      // Arrange
      const messageIds = ['message-1'];
      mockRequest.body = { messageIds };
      mockMessageService.markMessagesAsRead.mockRejectedValueOnce(new Error('Database error'));

      // Act
      await messageController.markAsRead(mockRequest as AuthenticatedRequest, mockResponse);

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'MARK_READ_ERROR',
          message: 'Database error',
          timestamp: expect.any(String),
          path: '/api/messages/send',
        },
      });
    });

    it('should return 401 when user is not authenticated', async () => {
      // Arrange
      mockRequest.user = undefined;

      // Act
      await messageController.markAsRead(mockRequest as AuthenticatedRequest, mockResponse);

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(401);
    });
  });

  describe('getUnreadCount', () => {
    it('should get unread count successfully', async () => {
      // Arrange
      const unreadCount = 5;
      mockMessageService.getUnreadCount.mockResolvedValueOnce(unreadCount);

      // Act
      await messageController.getUnreadCount(mockRequest as AuthenticatedRequest, mockResponse);

      // Assert
      expect(mockMessageService.getUnreadCount).toHaveBeenCalledWith('user-id');
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: { unreadCount },
      });
    });

    it('should return 401 when user is not authenticated', async () => {
      // Arrange
      mockRequest.user = undefined;

      // Act
      await messageController.getUnreadCount(mockRequest as AuthenticatedRequest, mockResponse);

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'User not authenticated',
          timestamp: expect.any(String),
          path: '/api/messages/send',
        },
      });
    });

    it('should handle service errors', async () => {
      // Arrange
      mockMessageService.getUnreadCount.mockRejectedValueOnce(new Error('Database error'));

      // Act
      await messageController.getUnreadCount(mockRequest as AuthenticatedRequest, mockResponse);

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'UNREAD_COUNT_ERROR',
          message: 'Database error',
          timestamp: expect.any(String),
          path: '/api/messages/send',
        },
      });
    });
  });
});