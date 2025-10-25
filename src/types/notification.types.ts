export interface NotificationData {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  data?: any;
  channel?: NotificationChannel;
}

export interface EmailNotificationData extends NotificationData {
  channel: NotificationChannel.EMAIL;
  recipientEmail: string;
  templateId?: string;
  templateData?: Record<string, any>;
}

export interface WebPushNotificationData extends NotificationData {
  channel: NotificationChannel.WEB_PUSH;
  icon?: string;
  badge?: string;
  actions?: Array<{
    action: string;
    title: string;
    icon?: string;
  }>;
}

export interface InAppNotificationData extends NotificationData {
  channel: NotificationChannel.IN_APP;
}

export interface NotificationPreferences {
  userId: string;
  notificationType: NotificationType;
  emailEnabled: boolean;
  webPushEnabled: boolean;
}

export interface NotificationHistory {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  data?: any;
  isRead: boolean;
  channel: NotificationChannel;
  status: NotificationStatus;
  sentAt?: Date;
  createdAt: Date;
  userId: string;
}

export interface NotificationStats {
  total: number;
  unread: number;
  byType: Record<NotificationType, number>;
  byStatus: Record<NotificationStatus, number>;
}

export enum NotificationType {
  NEW_MESSAGE = 'NEW_MESSAGE',
  FAVORITE_UNAVAILABLE = 'FAVORITE_UNAVAILABLE',
  PROPERTY_VERIFIED = 'PROPERTY_VERIFIED',
  NEW_LISTING_MATCH = 'NEW_LISTING_MATCH',
  REMINDER_INACTIVE = 'REMINDER_INACTIVE',
  PROPERTY_APPROVED = 'PROPERTY_APPROVED',
  PROPERTY_REJECTED = 'PROPERTY_REJECTED',
}

export enum NotificationChannel {
  EMAIL = 'EMAIL',
  WEB_PUSH = 'WEB_PUSH',
  IN_APP = 'IN_APP',
}

export enum NotificationStatus {
  PENDING = 'PENDING',
  SENT = 'SENT',
  FAILED = 'FAILED',
  DELIVERED = 'DELIVERED',
}

export interface CreateNotificationRequest {
  type: NotificationType;
  title: string;
  message: string;
  data?: any;
  channels?: NotificationChannel[];
}

export interface UpdateNotificationPreferencesRequest {
  preferences: Array<{
    notificationType: NotificationType;
    emailEnabled: boolean;
    webPushEnabled: boolean;
  }>;
}

export interface NotificationFilters {
  type?: NotificationType;
  isRead?: boolean;
  channel?: NotificationChannel;
  status?: NotificationStatus;
  startDate?: Date;
  endDate?: Date;
}

export interface PaginatedNotifications {
  notifications: NotificationHistory[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}