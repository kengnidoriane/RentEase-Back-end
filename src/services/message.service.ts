import { PrismaClient } from '@prisma/client';
import { MessageRepository } from '../repositories/message.repository';
import { logger } from '../utils/logger';
import { 
  Message, 
  Conversation, 
  CreateMessageRequest,
  MarkAsReadRequest 
} from '../types/message.types';

export class MessageService {
  private messageRepository: MessageRepository;

  constructor(private prisma: PrismaClient) {
    this.messageRepository = new MessageRepository(prisma);
  }

  async sendMessage(
    senderId: string,
    data: CreateMessageRequest
  ): Promise<Message> {
    try {
      // Validate that the receiver exists and is active
      const receiver = await this.prisma.user.findUnique({
        where: { id: data.receiverId },
      });

      if (!receiver || !receiver.isActive) {
        throw new Error('Receiver not found or inactive');
      }

      // Validate that the property exists and is active
      const property = await this.prisma.property.findUnique({
        where: { id: data.propertyId },
      });

      if (!property || !property.isActive) {
        throw new Error('Property not found or inactive');
      }

      // Validate that sender is not the same as receiver
      if (senderId === data.receiverId) {
        throw new Error('Cannot send message to yourself');
      }

      // Filter and validate message content
      const filteredContent = this.filterMessageContent(data.content);
      if (!filteredContent.trim()) {
        throw new Error('Message content cannot be empty');
      }

      // Generate conversation ID
      const conversationId = await this.messageRepository.generateConversationId(
        senderId,
        data.receiverId,
        data.propertyId
      );

      // Create the message
      const message = await this.messageRepository.create({
        content: filteredContent,
        senderId,
        receiverId: data.receiverId,
        propertyId: data.propertyId,
        conversationId,
      });

      logger.info(`Message sent from ${senderId} to ${data.receiverId} for property ${data.propertyId}`);
      return message;
    } catch (error) {
      logger.error('Error sending message:', error);
      throw error;
    }
  }

  async getConversations(userId: string): Promise<Conversation[]> {
    try {
      const conversations = await this.messageRepository.findConversationsByUserId(userId);
      return conversations;
    } catch (error) {
      logger.error('Error getting conversations:', error);
      throw error;
    }
  }

  async getConversationMessages(
    conversationId: string,
    userId: string,
    page: number = 1,
    limit: number = 50
  ): Promise<{ messages: Message[]; pagination: any }> {
    try {
      // Verify user is part of this conversation
      const isParticipant = await this.verifyConversationParticipant(conversationId, userId);
      if (!isParticipant) {
        throw new Error('Access denied: Not a participant in this conversation');
      }

      const { messages, total } = await this.messageRepository.findByConversationId(
        conversationId,
        page,
        limit
      );

      const totalPages = Math.ceil(total / limit);

      return {
        messages,
        pagination: {
          page,
          limit,
          total,
          totalPages,
        },
      };
    } catch (error) {
      logger.error('Error getting conversation messages:', error);
      throw error;
    }
  }

  async markMessagesAsRead(
    userId: string,
    data: MarkAsReadRequest
  ): Promise<{ markedCount: number }> {
    try {
      const markedCount = await this.messageRepository.markAsRead(data.messageIds, userId);
      
      logger.info(`Marked ${markedCount} messages as read for user ${userId}`);
      return { markedCount };
    } catch (error) {
      logger.error('Error marking messages as read:', error);
      throw error;
    }
  }

  async getUnreadCount(userId: string): Promise<number> {
    try {
      return await this.messageRepository.getUnreadCount(userId);
    } catch (error) {
      logger.error('Error getting unread count:', error);
      throw error;
    }
  }

  private async verifyConversationParticipant(
    conversationId: string,
    userId: string
  ): Promise<boolean> {
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

  private filterMessageContent(content: string): string {
    // Basic content filtering
    let filtered = content.trim();

    // Remove excessive whitespace
    filtered = filtered.replace(/\s+/g, ' ');

    // Basic profanity filter (simple implementation)
    const profanityWords = ['spam', 'scam', 'fake'];
    const words = filtered.toLowerCase().split(' ');
    const hasProfanity = words.some(word => profanityWords.includes(word));

    if (hasProfanity) {
      logger.warn('Message contains filtered content');
    }

    // Prevent sharing external contact information
    const contactPatterns = [
      /\b\d{10,}\b/, // Phone numbers
      /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/, // Email addresses
      /whatsapp|telegram|instagram|facebook/i, // Social media mentions
    ];

    const hasExternalContact = contactPatterns.some(pattern => pattern.test(filtered));
    if (hasExternalContact) {
      filtered += '\n\n[System: Please keep communication on the platform for your security]';
    }

    // Limit message length
    if (filtered.length > 1000) {
      filtered = filtered.substring(0, 1000) + '...';
    }

    return filtered;
  }
}