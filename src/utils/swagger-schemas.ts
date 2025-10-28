import { z } from 'zod';

/**
 * Common validation schemas for Swagger documentation and request validation
 */

// Common parameter schemas
export const idParamSchema = z.object({
  id: z.string().min(1, 'ID is required'),
});

export const paginationQuerySchema = z.object({
  page: z.string().optional().transform((val) => (val ? parseInt(val, 10) : 1)),
  limit: z.string().optional().transform((val) => (val ? parseInt(val, 10) : 10)),
});

// User schemas
export const registerBodySchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  firstName: z.string().min(2, 'First name must be at least 2 characters'),
  lastName: z.string().min(2, 'Last name must be at least 2 characters'),
  phone: z.string().min(10, 'Phone number must be at least 10 characters'),
  userType: z.enum(['TENANT', 'LANDLORD'], {
    errorMap: () => ({ message: 'User type must be TENANT or LANDLORD' }),
  }),
});

export const loginBodySchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(1, 'Password is required'),
});

export const refreshTokenBodySchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

export const emailVerificationBodySchema = z.object({
  token: z.string().min(1, 'Verification token is required'),
});

export const passwordResetRequestBodySchema = z.object({
  email: z.string().email('Invalid email format'),
});

export const passwordResetConfirmBodySchema = z.object({
  token: z.string().min(1, 'Reset token is required'),
  newPassword: z.string().min(8, 'Password must be at least 8 characters'),
});

// Property schemas
export const createPropertyBodySchema = z.object({
  title: z.string().min(5, 'Title must be at least 5 characters').max(100, 'Title too long'),
  description: z.string().min(20, 'Description must be at least 20 characters').max(2000, 'Description too long'),
  price: z.number().positive('Price must be positive'),
  currency: z.string().length(3, 'Currency must be 3 characters').optional().default('EUR'),
  propertyType: z.enum(['APARTMENT', 'ROOM', 'HOUSE', 'STUDIO'], {
    errorMap: () => ({ message: 'Invalid property type' }),
  }),
  bedrooms: z.number().int().min(0, 'Bedrooms cannot be negative').max(20, 'Too many bedrooms'),
  bathrooms: z.number().int().min(0, 'Bathrooms cannot be negative').max(20, 'Too many bathrooms'),
  area: z.number().positive('Area must be positive'),
  address: z.string().min(5, 'Address must be at least 5 characters').max(200, 'Address too long'),
  city: z.string().min(2, 'City must be at least 2 characters').max(50, 'City name too long'),
  latitude: z.number().min(-90, 'Invalid latitude').max(90, 'Invalid latitude'),
  longitude: z.number().min(-180, 'Invalid longitude').max(180, 'Invalid longitude'),
});

export const updatePropertyBodySchema = createPropertyBodySchema.partial().extend({
  isActive: z.boolean().optional(),
});

export const propertySearchQuerySchema = z.object({
  page: z.string().optional().transform((val) => (val ? parseInt(val, 10) : 1)),
  limit: z.string().optional().transform((val) => (val ? parseInt(val, 10) : 10)),
  minPrice: z.string().optional().transform((val) => (val ? parseFloat(val) : undefined)),
  maxPrice: z.string().optional().transform((val) => (val ? parseFloat(val) : undefined)),
  bedrooms: z.string().optional().transform((val) => (val ? parseInt(val, 10) : undefined)),
  bathrooms: z.string().optional().transform((val) => (val ? parseInt(val, 10) : undefined)),
  propertyType: z.enum(['APARTMENT', 'ROOM', 'HOUSE', 'STUDIO']).optional(),
  city: z.string().optional(),
  sortBy: z.enum(['price', 'createdAt', 'relevance', 'distance']).optional().default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
  latitude: z.string().optional().transform((val) => (val ? parseFloat(val) : undefined)),
  longitude: z.string().optional().transform((val) => (val ? parseFloat(val) : undefined)),
  radius: z.string().optional().transform((val) => (val ? parseFloat(val) : undefined)),
});

export const verifyPropertyBodySchema = z.object({
  status: z.enum(['APPROVED', 'REJECTED'], {
    errorMap: () => ({ message: 'Status must be APPROVED or REJECTED' }),
  }),
  rejectionReason: z.string().min(10, 'Rejection reason must be at least 10 characters').max(500, 'Rejection reason too long').optional(),
}).refine(
  (data) => {
    if (data.status === 'REJECTED' && !data.rejectionReason) {
      return false;
    }
    return true;
  },
  {
    message: 'Rejection reason is required when status is REJECTED',
    path: ['rejectionReason'],
  }
);

export const addPropertyImagesBodySchema = z.object({
  images: z.array(
    z.object({
      url: z.string().url('Invalid image URL'),
      altText: z.string().min(1, 'Alt text is required').max(200, 'Alt text too long'),
    })
  ).min(1, 'At least one image is required').max(10, 'Maximum 10 images allowed'),
});

// Message schemas
export const sendMessageBodySchema = z.object({
  content: z.string().min(1, 'Message content is required').max(1000, 'Message too long'),
  receiverId: z.string().min(1, 'Receiver ID is required'),
  propertyId: z.string().min(1, 'Property ID is required'),
});

export const markMessagesReadBodySchema = z.object({
  messageIds: z.array(z.string()).min(1, 'At least one message ID is required'),
});

export const conversationParamsSchema = z.object({
  conversationId: z.string().min(1, 'Conversation ID is required'),
});

export const conversationMessagesQuerySchema = paginationQuerySchema;

// Favorite schemas
export const addFavoriteBodySchema = z.object({
  propertyId: z.string().min(1, 'Property ID is required'),
});

export const favoriteStatusParamsSchema = z.object({
  propertyId: z.string().min(1, 'Property ID is required'),
});

export const favoriteStatusBatchBodySchema = z.object({
  propertyIds: z.array(z.string()).min(1, 'At least one property ID is required').max(50, 'Maximum 50 property IDs allowed'),
});

export const favoritesQuerySchema = paginationQuerySchema.extend({
  includeUnavailable: z.string().optional().transform((val) => val === 'true'),
});

// Notification schemas
export const notificationPreferencesBodySchema = z.object({
  emailNotifications: z.boolean().optional(),
  pushNotifications: z.boolean().optional(),
  newMessages: z.boolean().optional(),
  propertyUpdates: z.boolean().optional(),
  newMatches: z.boolean().optional(),
  favoriteUpdates: z.boolean().optional(),
});

export const markNotificationsReadBodySchema = z.object({
  notificationIds: z.array(z.string()).min(1, 'At least one notification ID is required'),
});

// Admin schemas
export const adminVerifyUserBodySchema = z.object({
  status: z.enum(['APPROVED', 'REJECTED'], {
    errorMap: () => ({ message: 'Status must be APPROVED or REJECTED' }),
  }),
  rejectionReason: z.string().min(10, 'Rejection reason must be at least 10 characters').max(500, 'Rejection reason too long').optional(),
}).refine(
  (data) => {
    if (data.status === 'REJECTED' && !data.rejectionReason) {
      return false;
    }
    return true;
  },
  {
    message: 'Rejection reason is required when status is REJECTED',
    path: ['rejectionReason'],
  }
);

export const adminUserActionBodySchema = z.object({
  action: z.enum(['SUSPEND', 'ACTIVATE', 'DELETE'], {
    errorMap: () => ({ message: 'Action must be SUSPEND, ACTIVATE, or DELETE' }),
  }),
  reason: z.string().min(10, 'Reason must be at least 10 characters').max(500, 'Reason too long').optional(),
}).refine(
  (data) => {
    if ((data.action === 'SUSPEND' || data.action === 'DELETE') && !data.reason) {
      return false;
    }
    return true;
  },
  {
    message: 'Reason is required for SUSPEND and DELETE actions',
    path: ['reason'],
  }
);

// Response schemas for validation
export const apiResponseSchema = z.object({
  success: z.boolean(),
  data: z.any().optional(),
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.any().optional(),
    timestamp: z.string(),
    path: z.string(),
  }).optional(),
  meta: z.object({
    pagination: z.object({
      page: z.number(),
      limit: z.number(),
      total: z.number(),
      totalPages: z.number(),
    }).optional(),
  }).optional(),
});

export const paginatedResponseSchema = <T extends z.ZodTypeAny>(itemSchema: T) =>
  z.object({
    success: z.literal(true),
    data: z.array(itemSchema),
    meta: z.object({
      pagination: z.object({
        page: z.number(),
        limit: z.number(),
        total: z.number(),
        totalPages: z.number(),
      }),
    }),
  });

export const errorResponseSchema = z.object({
  success: z.literal(false),
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.any().optional(),
    timestamp: z.string(),
    path: z.string(),
  }),
});

// File upload schemas
export const fileUploadSchema = z.object({
  fieldname: z.string(),
  originalname: z.string(),
  encoding: z.string(),
  mimetype: z.string(),
  size: z.number(),
  destination: z.string().optional(),
  filename: z.string().optional(),
  path: z.string().optional(),
  buffer: z.instanceof(Buffer).optional(),
});

export const imageUploadSchema = fileUploadSchema.refine(
  (file) => file.mimetype.startsWith('image/'),
  {
    message: 'File must be an image',
  }
);

// WebSocket schemas
export const webSocketMessageSchema = z.object({
  type: z.enum(['MESSAGE', 'NOTIFICATION', 'TYPING', 'ONLINE_STATUS']),
  payload: z.any(),
  timestamp: z.string(),
});

export const typingIndicatorSchema = z.object({
  conversationId: z.string(),
  isTyping: z.boolean(),
});

export const onlineStatusSchema = z.object({
  userId: z.string(),
  isOnline: z.boolean(),
  lastSeen: z.string().optional(),
});