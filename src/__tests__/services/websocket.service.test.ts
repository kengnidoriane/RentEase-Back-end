import { Server as HTTPServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';
import { WebSocketService } from '../../services/websocket.service';

// Mock dependencies
jest.mock('socket.io');
jest.mock('@prisma/client');
jest.mock('jsonwebtoken');

const MockedSocketIOServer = SocketIOServer as jest.MockedClass<typeof SocketIOServer>;
const MockedPrismaClient = PrismaClient as jest.MockedClass<typeof PrismaClient>;
const mockedJwt = jwt as jest.Mocked<typeof jwt>;

describe('WebSocketService', () => {
  let webSocketService: WebSocketService;
  let mockServer: jest.Mocked<HTTPServer>;
  let mockIo: jest.Mocked<SocketIOServer>;
  let mockPrisma: jest.Mocked<PrismaClient>;
  let mockSocket: jest.Mocked<Socket>;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Create mock HTTP server
    mockServer = {
      listen: jest.fn(),
      close: jest.fn(),
    } as any;

    // Create mock Socket.IO server
    mockIo = {
      use: jest.fn(),
      on: jest.fn(),
      to: jest.fn().mockReturnThis(),
      emit: jest.fn(),
    } as any;

    // Create mock Prisma client
    mockPrisma = new MockedPrismaClient() as jest.Mocked<PrismaClient>;
    
    // Mock Prisma methods
    mockPrisma.user = {
      findUnique: jest.fn(),
    } as any;
    
    mockPrisma.message = {
      findFirst: jest.fn(),
    } as any;

    // Create mock socket
    mockSocket = {
      id: 'socket-id',
      userId: 'user-id',
      user: { id: 'user-id', firstName: 'John', lastName: 'Doe' },
      handshake: {
        auth: { token: 'valid-token' },
        headers: {},
      },
      join: jest.fn(),
      leave: jest.fn(),
      to: jest.fn().mockReturnThis(),
      emit: jest.fn(),
      on: jest.fn(),
    } as any;

    // Mock SocketIOServer constructor
    MockedSocketIOServer.mockImplementation(() => mockIo);

    // Mock PrismaClient constructor
    MockedPrismaClient.mockImplementation(() => mockPrisma);

    // Set up environment variables
    process.env.JWT_SECRET = 'test-secret';
    process.env.NODE_ENV = 'test';
    process.env.FRONTEND_URL = 'http://localhost:3000';
  });

  describe('constructor', () => {
    it('should initialize WebSocket service with correct configuration', () => {
      // Act
      webSocketService = new WebSocketService(mockServer);

      // Assert
      expect(MockedSocketIOServer).toHaveBeenCalledWith(mockServer, {
        cors: {
          origin: ['http://localhost:3000', 'http://localhost:5173'],
          credentials: true,
        },
      });
      expect(mockIo.use).toHaveBeenCalled(); // Authentication middleware
      expect(mockIo.on).toHaveBeenCalledWith('connection', expect.any(Function));
    });

    it('should use production URL in production environment', () => {
      // Arrange
      process.env.NODE_ENV = 'production';
      process.env.FRONTEND_URL = 'https://rentease.com';

      // Act
      webSocketService = new WebSocketService(mockServer);

      // Assert
      expect(MockedSocketIOServer).toHaveBeenCalledWith(mockServer, {
        cors: {
          origin: 'https://rentease.com',
          credentials: true,
        },
      });
    });
  });

  describe('authentication middleware', () => {
    let authMiddleware: (socket: any, next: any) => void;

    beforeEach(() => {
      webSocketService = new WebSocketService(mockServer);
      
      // Get the authentication middleware function
      const useCall = mockIo.use.mock.calls[0];
      authMiddleware = useCall[0];
    });

    it('should authenticate valid token from auth object', async () => {
      // Arrange
      const mockNext = jest.fn();
      const mockUser = {
        id: 'user-id',
        firstName: 'John',
        lastName: 'Doe',
        isActive: true,
      };

      mockedJwt.verify.mockReturnValueOnce({ userId: 'user-id' } as any);
      mockPrisma.user.findUnique.mockResolvedValueOnce(mockUser as any);

      // Act
      await authMiddleware(mockSocket, mockNext);

      // Assert
      expect(mockedJwt.verify).toHaveBeenCalledWith('valid-token', 'test-secret');
      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'user-id' },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          isActive: true,
        },
      });
      expect(mockSocket.userId).toBe('user-id');
      expect(mockSocket.user).toEqual(mockUser);
      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should authenticate valid token from authorization header', async () => {
      // Arrange
      const mockNext = jest.fn();
      const mockUser = {
        id: 'user-id',
        firstName: 'John',
        lastName: 'Doe',
        isActive: true,
      };

      mockSocket.handshake.auth.token = undefined;
      mockSocket.handshake.headers.authorization = 'Bearer header-token';

      mockedJwt.verify.mockReturnValueOnce({ userId: 'user-id' } as any);
      mockPrisma.user.findUnique.mockResolvedValueOnce(mockUser as any);

      // Act
      await authMiddleware(mockSocket, mockNext);

      // Assert
      expect(mockedJwt.verify).toHaveBeenCalledWith('header-token', 'test-secret');
      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should reject connection without token', async () => {
      // Arrange
      const mockNext = jest.fn();
      mockSocket.handshake.auth.token = undefined;
      mockSocket.handshake.headers.authorization = undefined;

      // Act
      await authMiddleware(mockSocket, mockNext);

      // Assert
      expect(mockNext).toHaveBeenCalledWith(new Error('Authentication token required'));
    });

    it('should reject connection with invalid token', async () => {
      // Arrange
      const mockNext = jest.fn();
      mockedJwt.verify.mockImplementationOnce(() => {
        throw new Error('Invalid token');
      });

      // Act
      await authMiddleware(mockSocket, mockNext);

      // Assert
      expect(mockNext).toHaveBeenCalledWith(new Error('Authentication failed'));
    });

    it('should reject connection for inactive user', async () => {
      // Arrange
      const mockNext = jest.fn();
      const inactiveUser = {
        id: 'user-id',
        firstName: 'John',
        lastName: 'Doe',
        isActive: false,
      };

      mockedJwt.verify.mockReturnValueOnce({ userId: 'user-id' } as any);
      mockPrisma.user.findUnique.mockResolvedValueOnce(inactiveUser as any);

      // Act
      await authMiddleware(mockSocket, mockNext);

      // Assert
      expect(mockNext).toHaveBeenCalledWith(new Error('User not found or inactive'));
    });

    it('should reject connection for non-existent user', async () => {
      // Arrange
      const mockNext = jest.fn();

      mockedJwt.verify.mockReturnValueOnce({ userId: 'user-id' } as any);
      mockPrisma.user.findUnique.mockResolvedValueOnce(null);

      // Act
      await authMiddleware(mockSocket, mockNext);

      // Assert
      expect(mockNext).toHaveBeenCalledWith(new Error('User not found or inactive'));
    });
  });

  describe('connection handling', () => {
    let connectionHandler: (socket: any) => void;

    beforeEach(() => {
      webSocketService = new WebSocketService(mockServer);
      
      // Get the connection handler function
      const onCall = mockIo.on.mock.calls.find(call => call[0] === 'connection');
      connectionHandler = onCall![1];
    });

    it('should handle new connection', () => {
      // Act
      connectionHandler(mockSocket);

      // Assert
      expect(mockSocket.join).toHaveBeenCalledWith('user_user-id');
      expect(mockSocket.on).toHaveBeenCalledWith('join_conversation', expect.any(Function));
      expect(mockSocket.on).toHaveBeenCalledWith('leave_conversation', expect.any(Function));
      expect(mockSocket.on).toHaveBeenCalledWith('new_message', expect.any(Function));
      expect(mockSocket.on).toHaveBeenCalledWith('typing', expect.any(Function));
      expect(mockSocket.on).toHaveBeenCalledWith('stop_typing', expect.any(Function));
      expect(mockSocket.on).toHaveBeenCalledWith('message_read', expect.any(Function));
      expect(mockSocket.on).toHaveBeenCalledWith('disconnect', expect.any(Function));
    });

    it('should track connected users', () => {
      // Act
      connectionHandler(mockSocket);

      // Assert
      expect(webSocketService.isUserOnline('user-id')).toBe(true);
      expect(webSocketService.getConnectedUsers()).toContain('user-id');
    });
  });

  describe('conversation management', () => {
    let joinConversationHandler: (conversationId: string) => void;
    let leaveConversationHandler: (conversationId: string) => void;

    beforeEach(() => {
      webSocketService = new WebSocketService(mockServer);
      
      const onCall = mockIo.on.mock.calls.find(call => call[0] === 'connection');
      const connectionHandler = onCall![1];
      connectionHandler(mockSocket);

      // Get event handlers
      const joinCall = mockSocket.on.mock.calls.find(call => call[0] === 'join_conversation');
      joinConversationHandler = joinCall![1];

      const leaveCall = mockSocket.on.mock.calls.find(call => call[0] === 'leave_conversation');
      leaveConversationHandler = leaveCall![1];
    });

    it('should allow user to join conversation they participate in', async () => {
      // Arrange
      const conversationId = 'conversation-id';
      mockPrisma.message.findFirst.mockResolvedValueOnce({
        id: 'message-id',
        conversationId,
        senderId: 'user-id',
        receiverId: 'other-user-id',
      } as any);

      // Act
      await joinConversationHandler(conversationId);

      // Assert
      expect(mockSocket.join).toHaveBeenCalledWith(conversationId);
      expect(mockPrisma.message.findFirst).toHaveBeenCalledWith({
        where: {
          conversationId,
          OR: [
            { senderId: 'user-id' },
            { receiverId: 'user-id' },
          ],
        },
      });
    });

    it('should reject user from joining conversation they do not participate in', async () => {
      // Arrange
      const conversationId = 'conversation-id';
      mockPrisma.message.findFirst.mockResolvedValueOnce(null);

      // Act
      await joinConversationHandler(conversationId);

      // Assert
      expect(mockSocket.join).not.toHaveBeenCalledWith(conversationId);
      expect(mockSocket.emit).toHaveBeenCalledWith('error', { message: 'Access denied to conversation' });
    });

    it('should handle database errors when joining conversation', async () => {
      // Arrange
      const conversationId = 'conversation-id';
      const error = new Error('Database error');
      mockPrisma.message.findFirst.mockRejectedValueOnce(error);

      // Act
      await joinConversationHandler(conversationId);

      // Assert
      expect(mockSocket.emit).toHaveBeenCalledWith('error', { message: 'Failed to join conversation' });
    });

    it('should allow user to leave conversation', () => {
      // Arrange
      const conversationId = 'conversation-id';

      // Act
      leaveConversationHandler(conversationId);

      // Assert
      expect(mockSocket.leave).toHaveBeenCalledWith(conversationId);
    });
  });

  describe('message handling', () => {
    let newMessageHandler: (data: any) => void;

    beforeEach(() => {
      webSocketService = new WebSocketService(mockServer);
      
      const onCall = mockIo.on.mock.calls.find(call => call[0] === 'connection');
      const connectionHandler = onCall![1];
      connectionHandler(mockSocket);

      const messageCall = mockSocket.on.mock.calls.find(call => call[0] === 'new_message');
      newMessageHandler = messageCall![1];
    });

    it('should broadcast new message to conversation participants', () => {
      // Arrange
      const messageData = {
        conversationId: 'conversation-id',
        content: 'Hello world',
        propertyId: 'property-id',
      };

      // Act
      newMessageHandler(messageData);

      // Assert
      expect(mockSocket.to).toHaveBeenCalledWith('conversation-id');
      expect(mockSocket.emit).toHaveBeenCalledWith('new_message', {
        ...messageData,
        sender: mockSocket.user,
      });
    });

    it('should not broadcast message without conversation ID', () => {
      // Arrange
      const messageData = {
        content: 'Hello world',
        propertyId: 'property-id',
      };

      // Act
      newMessageHandler(messageData);

      // Assert
      expect(mockSocket.to).not.toHaveBeenCalled();
    });
  });

  describe('typing indicators', () => {
    let typingHandler: (data: any) => void;
    let stopTypingHandler: (data: any) => void;

    beforeEach(() => {
      webSocketService = new WebSocketService(mockServer);
      
      const onCall = mockIo.on.mock.calls.find(call => call[0] === 'connection');
      const connectionHandler = onCall![1];
      connectionHandler(mockSocket);

      const typingCall = mockSocket.on.mock.calls.find(call => call[0] === 'typing');
      typingHandler = typingCall![1];

      const stopTypingCall = mockSocket.on.mock.calls.find(call => call[0] === 'stop_typing');
      stopTypingHandler = stopTypingCall![1];
    });

    it('should broadcast typing indicator', () => {
      // Arrange
      const data = { conversationId: 'conversation-id' };

      // Act
      typingHandler(data);

      // Assert
      expect(mockSocket.to).toHaveBeenCalledWith('conversation-id');
      expect(mockSocket.emit).toHaveBeenCalledWith('user_typing', {
        userId: 'user-id',
        user: mockSocket.user,
        conversationId: 'conversation-id',
      });
    });

    it('should broadcast stop typing indicator', () => {
      // Arrange
      const data = { conversationId: 'conversation-id' };

      // Act
      stopTypingHandler(data);

      // Assert
      expect(mockSocket.to).toHaveBeenCalledWith('conversation-id');
      expect(mockSocket.emit).toHaveBeenCalledWith('user_stop_typing', {
        userId: 'user-id',
        user: mockSocket.user,
        conversationId: 'conversation-id',
      });
    });
  });

  describe('message read handling', () => {
    let messageReadHandler: (data: any) => void;

    beforeEach(() => {
      webSocketService = new WebSocketService(mockServer);
      
      const onCall = mockIo.on.mock.calls.find(call => call[0] === 'connection');
      const connectionHandler = onCall![1];
      connectionHandler(mockSocket);

      const readCall = mockSocket.on.mock.calls.find(call => call[0] === 'message_read');
      messageReadHandler = readCall![1];
    });

    it('should broadcast message read status', () => {
      // Arrange
      const data = {
        messageIds: ['message-1', 'message-2'],
        conversationId: 'conversation-id',
      };

      // Act
      messageReadHandler(data);

      // Assert
      expect(mockSocket.to).toHaveBeenCalledWith('conversation-id');
      expect(mockSocket.emit).toHaveBeenCalledWith('messages_read', {
        messageIds: ['message-1', 'message-2'],
        readBy: 'user-id',
        conversationId: 'conversation-id',
      });
    });
  });

  describe('disconnect handling', () => {
    let disconnectHandler: () => void;

    beforeEach(() => {
      webSocketService = new WebSocketService(mockServer);
      
      const onCall = mockIo.on.mock.calls.find(call => call[0] === 'connection');
      const connectionHandler = onCall![1];
      connectionHandler(mockSocket);

      const disconnectCall = mockSocket.on.mock.calls.find(call => call[0] === 'disconnect');
      disconnectHandler = disconnectCall![1];
    });

    it('should remove user from connected users on disconnect', () => {
      // Arrange - user is connected
      expect(webSocketService.isUserOnline('user-id')).toBe(true);

      // Act
      disconnectHandler();

      // Assert
      expect(webSocketService.isUserOnline('user-id')).toBe(false);
      expect(webSocketService.getConnectedUsers()).not.toContain('user-id');
    });
  });

  describe('public notification methods', () => {
    beforeEach(() => {
      webSocketService = new WebSocketService(mockServer);
      
      // Simulate a connected user
      const onCall = mockIo.on.mock.calls.find(call => call[0] === 'connection');
      const connectionHandler = onCall![1];
      connectionHandler(mockSocket);
    });

    it('should notify user of new message', () => {
      // Arrange
      const receiverId = 'user-id';
      const message = { id: 'message-id', content: 'Hello' };

      // Act
      webSocketService.notifyNewMessage(receiverId, message);

      // Assert
      expect(mockIo.to).toHaveBeenCalledWith('socket-id');
      expect(mockIo.emit).toHaveBeenCalledWith('new_message_notification', message);
    });

    it('should not notify offline user of new message', () => {
      // Arrange
      const offlineUserId = 'offline-user-id';
      const message = { id: 'message-id', content: 'Hello' };

      // Act
      webSocketService.notifyNewMessage(offlineUserId, message);

      // Assert
      expect(mockIo.to).not.toHaveBeenCalled();
    });

    it('should notify user of message read status', () => {
      // Arrange
      const senderId = 'user-id';
      const data = {
        messageIds: ['message-1'],
        conversationId: 'conversation-id',
      };

      // Act
      webSocketService.notifyMessageRead(senderId, data);

      // Assert
      expect(mockIo.to).toHaveBeenCalledWith('socket-id');
      expect(mockIo.emit).toHaveBeenCalledWith('messages_read_notification', data);
    });

    it('should return list of connected users', () => {
      // Act
      const connectedUsers = webSocketService.getConnectedUsers();

      // Assert
      expect(connectedUsers).toEqual(['user-id']);
    });

    it('should check if user is online', () => {
      // Act & Assert
      expect(webSocketService.isUserOnline('user-id')).toBe(true);
      expect(webSocketService.isUserOnline('offline-user-id')).toBe(false);
    });
  });
});