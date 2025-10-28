export interface AdminDashboardStats {
  users: {
    total: number;
    tenants: number;
    landlords: number;
    activeUsers: number;
    newUsersThisMonth: number;
  };
  properties: {
    total: number;
    verified: number;
    pending: number;
    rejected: number;
    byType: Record<string, number>;
    byCity: Record<string, number>;
  };
  verifications: {
    pendingDocuments: number;
    pendingProperties: number;
  };
  activity: {
    totalMessages: number;
    totalFavorites: number;
  };
}

export interface AdminActivityLog {
  id: string;
  adminId: string;
  action: AdminAction;
  targetType: 'USER' | 'PROPERTY' | 'DOCUMENT';
  targetId: string;
  details: Record<string, any>;
  timestamp: Date;
  ipAddress?: string;
  userAgent?: string;
}

export type AdminAction = 
  | 'USER_STATUS_UPDATED'
  | 'USER_SUSPENDED'
  | 'USER_ACTIVATED'
  | 'PROPERTY_APPROVED'
  | 'PROPERTY_REJECTED'
  | 'DOCUMENT_APPROVED'
  | 'DOCUMENT_REJECTED'
  | 'ADMIN_LOGIN'
  | 'ADMIN_LOGOUT';

export interface CreateAdminLogData {
  adminId: string;
  action: AdminAction;
  targetType: 'USER' | 'PROPERTY' | 'DOCUMENT';
  targetId: string;
  details: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
}

export interface AdminUserListItem {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  userType: 'TENANT' | 'LANDLORD' | 'ADMIN';
  isVerified: boolean;
  isActive: boolean;
  createdAt: Date;
  lastLoginAt?: Date;
  propertiesCount?: number;
  messagesCount?: number;
}

export interface AdminPropertyListItem {
  id: string;
  title: string;
  price: number;
  city: string;
  propertyType: string;
  verificationStatus: 'PENDING' | 'APPROVED' | 'REJECTED';
  isActive: boolean;
  createdAt: Date;
  landlord: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
}

export interface PropertyVerificationRequest {
  propertyId: string;
  status: 'APPROVED' | 'REJECTED';
  rejectionReason?: string;
}

export interface UserStatusUpdateRequest {
  userId: string;
  isActive: boolean;
  reason?: string;
}