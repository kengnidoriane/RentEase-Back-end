import { Server as SocketIOServer, Socket } from 'socket.io';
import { Server as HTTPServer } from 'http';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';
import { WebSocketMessage } from '../types/message.types';

interface AuthenticatedSocket extends Socket {
  userId?: string;
  user?: {
    id: string;
    firstName: string;
    lastName: string;
  };
}

export class WebSocketService {
  private io: SocketIOServer;
  private prisma: PrismaClient;
  private connectedUsers: Map<string, string> = new Map(); // userId -> socketId

  constructor(server: HTTPServer) {
    this.prisma = new PrismaClient();
    this.io = new SocketIOServer(server, {
      cors: {
        origin: process.env.NODE_ENV === 'production' 
          ? process.env.FRONTEND_URL 
          : ['http://localhost:3000', 'http://localhost:5173'],
        credentials: true,
      },
    });

    this.setupMiddleware();
    this.setupEventHandlers();
  }

  private setupMiddleware(): void {
    // Authentication middleware
    this.io.use(async (socket: any, next) => {
      try {
        const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.replace('Bearer ', '');
        
        if (!token) {
          return next(new Error('Authentication token required'));
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
        
        // Get user details from database
        const user = await this.prisma.user.findUnique({
          where: { id: decoded.userId },
          select: {
            id: true,
            firstName: true,
            lastName: true,
            isActive: true,
          },
        });

        if (!user || !user.isActive) {
          return next(new Error('User not found or inactive'));
        }

        socket.userId = user.id;
        socket.user = user;
        next();
      } catch (error) {
        logger.error('WebSocket authentication error:', error);
        next(new Error('Authentication failed'));
      }
    });
  }

  private setupEventHandlers(): void {
    this.io.on('connection', (socket: AuthenticatedSocket) => {
      logger.info(`User ${socket.userId} connected to WebSocket`);
      
      // Store the connection
      if (socket.userId) {
        this.connectedUsers.set(socket.userId, socket.id);
      }

      // Join user to their personal room for notifications
      socket.join(`user_${socket.userId}`);

      // Handle joining conversation rooms
      socket.on('join_conversation', (conversationId: string) => {
        this.handleJoinConversation(socket, conversationId);
      });

      // Handle leaving conversation rooms
      socket.on('leave_conversation', (conversationId: string) => {
        this.handleLeaveConversation(socket, conversationId);
      });

      // Handle new message events
      socket.on('new_message', (data: WebSocketMessage) => {
        this.handleNewMessage(socket, data);
      });

      // Handle typing indicators
      socket.on('typing', (data: { conversationId: string }) => {
        this.handleTyping(socket, data.conversationId, true);
      });

      socket.on('stop_typing', (data: { conversationId: string }) => {
        this.handleTyping(socket, data.conversationId, false);
      });

      // Handle message read events
      socket.on('message_read', (data: { messageIds: string[]; conversationId: string }) => {
        this.handleMessageRead(socket, data);
      });

      // Handle disconnection
      socket.on('disconnect', () => {
        this.handleDisconnect(socket);
      });
    });
  }

  private async handleJoinConversation(socket: AuthenticatedSocket, conversationId: string): Promise<void> {
    try {
      // Verify user is part of this conversation
      const isParticipant = await this.verifyConversationParticipant(conversationId, socket.userId!);
      
      if (isParticipant) {
        socket.join(conversationId);
        logger.info(`User ${socket.userId} joined conversation ${conversationId}`);
      } else {
        socket.emit('error', { message: 'Access denied to conversation' });
      }
    } catch (error) {
      logger.error('Error joining conversation:', error);
      socket.emit('error', { message: 'Failed to join conversation' });
    }
  }

  private handleLeaveConversation(socket: AuthenticatedSocket, conversationId: string): void {
    socket.leave(conversationId);
    logger.info(`User ${socket.userId} left conversation ${conversationId}`);
  }

  private handleNewMessage(socket: AuthenticatedSocket, data: WebSocketMessage): void {
    if (data.conversationId) {
      // Broadcast to all users in the conversation except sender
      socket.to(data.conversationId).emit('new_message', {
        ...data,
        sender: socket.user,
      });
    }
  }

  private handleTyping(socket: AuthenticatedSocket, conversationId: string, isTyping: boolean): void {
    socket.to(conversationId).emit(isTyping ? 'user_typing' : 'user_stop_typing', {
      userId: socket.userId,
      user: socket.user,
      conversationId,
    });
  }

  private handleMessageRead(socket: AuthenticatedSocket, data: { messageIds: string[]; conversationId: string }): void {
    // Notify other participants that messages have been read
    socket.to(data.conversationId).emit('messages_read', {
      messageIds: data.messageIds,
      readBy: socket.userId,
      conversationId: data.conversationId,
    });
  }

  private handleDisconnect(socket: AuthenticatedSocket): void {
    logger.info(`User ${socket.userId} disconnected from WebSocket`);
    
    if (socket.userId) {
      this.connectedUsers.delete(socket.userId);
    }
  }

  private async verifyConversationParticipant(conversationId: string, userId: string): Promise<boolean> {
    try {
      const message = await this.prisma.message.findFirst({
        where: {
          conversationId,
          OR: [
            { senderId: userId },
            { receiverId: userId },
          ],
        },
      });

      return !!message;
    } catch (error) {
      logger.error('Error verifying conversation participant:', error);
      return false;
    }
  }

  // Public methods for sending notifications
  public notifyNewMessage(receiverId: string, message: any): void {
    const socketId = this.connectedUsers.get(receiverId);
    if (socketId) {
      this.io.to(socketId).emit('new_message_notification', message);
    }
  }

  public notifyMessageRead(senderId: string, data: { messageIds: string[]; conversationId: string }): void {
    const socketId = this.connectedUsers.get(senderId);
    if (socketId) {
      this.io.to(socketId).emit('messages_read_notification', data);
    }
  }

  public getConnectedUsers(): string[] {
    return Array.from(this.connectedUsers.keys());
  }

  public isUserOnline(userId: string): boolean {
    return this.connectedUsers.has(userId);
  }
}