import { PrismaClient, Message } from '@prisma/client';
import { logger } from '../utils/logger';

export class MessageRepository {
  constructor(private prisma: PrismaClient) {}

  async create(data: {
    content: string;
    senderId: string;
    receiverId: string;
    propertyId: string;
    conversationId: string;
  }): Promise<Message> {
    try {
      return await this.prisma.message.create({
        data,
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
    } catch (error) {
      logger.error('Error creating message:', error);
      throw error;
    }
  }

  async findByConversationId(
    conversationId: string,
    page: number = 1,
    limit: number = 50
  ): Promise<{ messages: Message[]; total: number }> {
    try {
      const skip = (page - 1) * limit;

      const [messages, total] = await Promise.all([
        this.prisma.message.findMany({
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
          skip,
          take: limit,
        }),
        this.prisma.message.count({
          where: { conversationId },
        }),
      ]);

      return { messages, total };
    } catch (error) {
      logger.error('Error finding messages by conversation ID:', error);
      throw error;
    }
  }

  async findConversationsByUserId(userId: string): Promise<any[]> {
    try {
      // Get all unique conversations for the user
      const conversations = await this.prisma.message.findMany({
        where: {
          OR: [{ senderId: userId }, { receiverId: userId }],
        },
        select: {
          conversationId: true,
          propertyId: true,
          senderId: true,
          receiverId: true,
          createdAt: true,
          property: {
            select: {
              id: true,
              title: true,
              images: {
                select: {
                  url: true,
                  altText: true,
                },
                orderBy: { order: 'asc' },
                take: 1,
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      // Group by conversation ID and get unique conversations
      const uniqueConversations = new Map();
      
      for (const message of conversations) {
        if (!uniqueConversations.has(message.conversationId)) {
          const otherParticipantId = message.senderId === userId ? message.receiverId : message.senderId;
          
          // Get other participant details
          const otherParticipant = await this.prisma.user.findUnique({
            where: { id: otherParticipantId },
            select: {
              id: true,
              firstName: true,
              lastName: true,
              profilePicture: true,
            },
          });

          // Get last message
          const lastMessage = await this.prisma.message.findFirst({
            where: { conversationId: message.conversationId },
            orderBy: { createdAt: 'desc' },
            include: {
              sender: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  profilePicture: true,
                },
              },
            },
          });

          // Get unread count
          const unreadCount = await this.prisma.message.count({
            where: {
              conversationId: message.conversationId,
              receiverId: userId,
              isRead: false,
            },
          });

          uniqueConversations.set(message.conversationId, {
            id: message.conversationId,
            propertyId: message.propertyId,
            participants: [message.senderId, message.receiverId],
            lastMessage,
            unreadCount,
            property: message.property,
            otherParticipant,
          });
        }
      }

      return Array.from(uniqueConversations.values());
    } catch (error) {
      logger.error('Error finding conversations by user ID:', error);
      throw error;
    }
  }

  async markAsRead(messageIds: string[], userId: string): Promise<number> {
    try {
      const result = await this.prisma.message.updateMany({
        where: {
          id: { in: messageIds },
          receiverId: userId,
          isRead: false,
        },
        data: { isRead: true },
      });

      return result.count;
    } catch (error) {
      logger.error('Error marking messages as read:', error);
      throw error;
    }
  }

  async findById(id: string): Promise<Message | null> {
    try {
      return await this.prisma.message.findUnique({
        where: { id },
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
    } catch (error) {
      logger.error('Error finding message by ID:', error);
      throw error;
    }
  }

  async getUnreadCount(userId: string): Promise<number> {
    try {
      return await this.prisma.message.count({
        where: {
          receiverId: userId,
          isRead: false,
        },
      });
    } catch (error) {
      logger.error('Error getting unread count:', error);
      throw error;
    }
  }

  async generateConversationId(senderId: string, receiverId: string, propertyId: string): Promise<string> {
    // Create a consistent conversation ID based on participants and property
    const participants = [senderId, receiverId].sort();
    return `${participants[0]}_${participants[1]}_${propertyId}`;
  }
}