export interface Message {
  id: string;
  content: string;
  isRead: boolean;
  createdAt: Date;
  conversationId: string;
  senderId: string;
  receiverId: string;
  propertyId: string;
  sender?: {
    id: string;
    firstName: string;
    lastName: string;
    profilePicture?: string;
  };
  receiver?: {
    id: string;
    firstName: string;
    lastName: string;
    profilePicture?: string;
  };
  property?: {
    id: string;
    title: string;
  };
}

export interface Conversation {
  id: string;
  propertyId: string;
  participants: string[];
  lastMessage?: Message;
  unreadCount: number;
  property: {
    id: string;
    title: string;
    images: Array<{ url: string; altText: string }>;
  };
  otherParticipant: {
    id: string;
    firstName: string;
    lastName: string;
    profilePicture?: string;
  };
}

export interface CreateMessageRequest {
  content: string;
  receiverId: string;
  propertyId: string;
}

export interface MessageResponse {
  success: boolean;
  data?: Message;
  error?: string;
}

export interface ConversationsResponse {
  success: boolean;
  data?: Conversation[];
  error?: string;
}

export interface ConversationMessagesResponse {
  success: boolean;
  data?: {
    messages: Message[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  };
  error?: string;
}

export interface MarkAsReadRequest {
  messageIds: string[];
}

export interface WebSocketMessage {
  type: 'new_message' | 'message_read' | 'typing' | 'stop_typing';
  data: any;
  conversationId?: string;
}