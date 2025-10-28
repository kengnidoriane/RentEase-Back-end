import request from 'supertest';
import express, { Express } from 'express';
import { AdminController } from '@/controllers/admin.controller';
import { authenticate, authorize } from '@/middleware/auth.middleware';
import { validateRequest, validateParams } from '@/middleware/validation.middleware';
import { AuthUtils } from '@/utils/auth';
import { createUserData } from '../factories/userFactory';
import { z } from 'zod';

// Mock external dependencies
jest.mock('@/utils/email', () => ({
  emailService: {
    sendVerificationEmail: jest.fn().mockResolvedValue(undefined),
    sendPasswordResetEmail: jest.fn().mockResolvedValue(undefined),
  },
}));

// Mock Prisma for integration tests
const mockPrisma = {
  user: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
    groupBy: jest.fn(),
  },
  property: {
    count: jest.fn(),
    groupBy: jest.fn(),
  },
  verificationDocument: {
    findMany: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
  },
  message: {
    count: jest.fn(),
  },
  favorite: {
    count: jest.fn(),
  },
  adminActivityLog: {
    create: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
  },
};

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn(() => mockPrisma),
  UserType: {
    TENANT: 'TENANT',
    LANDLORD: 'LANDLORD',
    ADMIN: 'ADMIN',
  },
}));

describe('Admin Integration Tests', () => {
  let app: Express;
  let adminUser: any;
  let adminToken: string;
  let regularUser: any;
  let regularToken: string;

  beforeAll(async () => {
    // Create Express app with admin routes
    app = express();
    app.use(express.json());
    
    const adminController = new AdminController();
    
    // Validation schemas
    const userIdParamsSchema = z.object({
      userId: z.string().min(1, 'User ID is required'),
    });

    const documentIdParamsSchema = z.object({
      documentId: z.string().min(1, 'Document ID is required'),
    });

    const updateUserStatusSchema = z.object({
      isActive: z.boolean(),
    });

    const reviewDocumentSchema = z.object({
      status: z.enum(['APPROVED', 'REJECTED']),
      rejectionReason: z.string().optional(),
    });

    // Add admin routes with middleware
    app.get('/api/admin/dashboard', authenticate, authorize(['ADMIN']), adminController.getDashboardStats);
    app.get('/api/admin/users', authenticate, authorize(['ADMIN']), adminController.getAllUsers);
    app.get('/api/admin/users/:userId', 
      authenticate, 
      authorize(['ADMIN']), 
      validateParams(userIdParamsSchema), 
      adminController.getUserById
    );
    app.put('/api/admin/users/:userId/status',
      authenticate,
      authorize(['ADMIN']),
      validateParams(userIdParamsSchema),
      validateRequest(updateUserStatusSchema),
      adminController.updateUserStatus
    );
    app.get('/api/admin/verification/documents', 
      authenticate, 
      authorize(['ADMIN']), 
      adminController.getPendingVerificationDocuments
    );
    app.put('/api/admin/verification/documents/:documentId/review',
      authenticate,
      authorize(['ADMIN']),
      validateParams(documentIdParamsSchema),
      validateRequest(reviewDocumentSchema),
      adminController.reviewVerificationDocument
    );

    // Create test users
    adminUser = createUserData({
      email: 'admin@example.com',
      userType: 'ADMIN',
      isVerified: true,
      isActive: true,
    });

    regularUser = createUserData({
      email: 'user@example.com',
      userType: 'TENANT',
      isVerified: true,
      isActive: true,
    });

    // Generate tokens
    adminToken = AuthUtils.generateAccessToken({
      userId: adminUser.id,
      email: adminUser.email,
      userType: adminUser.userType,
    });

    regularToken = AuthUtils.generateAccessToken({
      userId: regularUser.id,
      email: regularUser.email,
      userType: regularUser.userType,
    });
  });

  beforeEach(async () => {
    // Clear all mocks
    jest.clearAllMocks();
    
    // Reset mock implementations
    Object.values(mockPrisma).forEach(model => {
      Object.values(model).forEach(method => {
        if (typeof method === 'function') {
          method.mockReset();
        }
      });
    });
  });

  describe('GET /api/admin/dashboard', () => {
    it('should get dashboard statistics for admin', async () => {
      // Arrange
      mockPrisma.user.findUnique.mockResolvedValue(adminUser);
      
      // Mock dashboard stats data
      mockPrisma.user.count
        .mockResolvedValueOnce(100) // totalUsers
        .mockResolvedValueOnce(60)  // totalTenants
        .mockResolvedValueOnce(30)  // totalLandlords
        .mockResolvedValueOnce(95)  // activeUsers
        .mockResolvedValueOnce(15); // newUsersThisMonth

      mockPrisma.property.count
        .mockResolvedValueOnce(200) // totalProperties
        .mockResolvedValueOnce(150) // verifiedProperties
        .mockResolvedValueOnce(30)  // pendingProperties
        .mockResolvedValueOnce(20); // rejectedProperties

      mockPrisma.verificationDocument.count.mockResolvedValueOnce(10); // pendingDocuments
      mockPrisma.message.count.mockResolvedValueOnce(500); // totalMessages
      mockPrisma.favorite.count.mockResolvedValueOnce(300); // totalFavorites

      mockPrisma.property.groupBy
        .mockResolvedValueOnce([
          { propertyType: 'APARTMENT', _count: { id: 80 } },
          { propertyType: 'HOUSE', _count: { id: 70 } },
        ])
        .mockResolvedValueOnce([
          { city: 'Paris', _count: { id: 100 } },
          { city: 'Lyon', _count: { id: 60 } },
        ]);

      // Act
      const response = await request(app)
        .get('/api/admin/dashboard')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      // Assert
      expect(response.body).toEqual({
        success: true,
        data: {
          users: {
            total: 100,
            tenants: 60,
            landlords: 30,
            activeUsers: 95,
            newUsersThisMonth: 15,
          },
          properties: {
            total: 200,
            verified: 150,
            pending: 30,
            rejected: 20,
            byType: {
              APARTMENT: 80,
              HOUSE: 70,
            },
            byCity: {
              Paris: 100,
              Lyon: 60,
            },
          },
          verifications: {
            pendingDocuments: 10,
            pendingProperties: 30,
          },
          activity: {
            totalMessages: 500,
            totalFavorites: 300,
          },
        },
      });
    });

    it('should return 401 without authentication', async () => {
      // Act
      const response = await request(app)
        .get('/api/admin/dashboard')
        .expect(401);

      // Assert
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('UNAUTHORIZED');
    });

    it('should return 403 for non-admin users', async () => {
      // Arrange
      mockPrisma.user.findUnique.mockResolvedValue(regularUser);

      // Act
      const response = await request(app)
        .get('/api/admin/dashboard')
        .set('Authorization', `Bearer ${regularToken}`)
        .expect(403);

      // Assert
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('FORBIDDEN');
    });
  });

  describe('GET /api/admin/users', () => {
    it('should get all users with pagination', async () => {
      // Arrange
      mockPrisma.user.findUnique.mockResolvedValue(adminUser);
      
      const mockUsers = [
        {
          id: 'user-1',
          email: 'user1@example.com',
          firstName: 'John',
          lastName: 'Doe',
          userType: 'TENANT',
          isVerified: true,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
          password: 'hashedPassword',
        },
      ];

      mockPrisma.user.findMany.mockResolvedValue(mockUsers);
      mockPrisma.user.count.mockResolvedValue(1);

      // Act
      const response = await request(app)
        .get('/api/admin/users?page=1&limit=10')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      // Assert
      expect(response.body).toEqual({
        success: true,
        data: {
          users: [
            {
              id: 'user-1',
              email: 'user1@example.com',
              firstName: 'John',
              lastName: 'Doe',
              userType: 'TENANT',
              isVerified: true,
              isActive: true,
              createdAt: expect.any(String),
              updatedAt: expect.any(String),
            },
          ],
          pagination: {
            page: 1,
            limit: 10,
            total: 1,
            totalPages: 1,
          },
        },
      });
    });

    it('should return 403 for non-admin users', async () => {
      // Arrange
      mockPrisma.user.findUnique.mockResolvedValue(regularUser);

      // Act
      const response = await request(app)
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${regularToken}`)
        .expect(403);

      // Assert
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('FORBIDDEN');
    });
  });

  describe('GET /api/admin/users/:userId', () => {
    it('should get user by ID with verification documents', async () => {
      // Arrange
      mockPrisma.user.findUnique.mockResolvedValue(adminUser);
      
      const mockUser = {
        id: 'user-123',
        email: 'user@example.com',
        firstName: 'John',
        lastName: 'Doe',
        userType: 'TENANT',
        isVerified: true,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        password: 'hashedPassword',
        verificationDocuments: [],
      };

      mockPrisma.user.findUnique.mockResolvedValueOnce(mockUser);

      // Act
      const response = await request(app)
        .get('/api/admin/users/user-123')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      // Assert
      expect(response.body).toEqual({
        success: true,
        data: {
          user: {
            id: 'user-123',
            email: 'user@example.com',
            firstName: 'John',
            lastName: 'Doe',
            userType: 'TENANT',
            isVerified: true,
            isActive: true,
            createdAt: expect.any(String),
            updatedAt: expect.any(String),
            verificationDocuments: [],
          },
        },
      });
    });

    it('should return 404 when user not found', async () => {
      // Arrange
      mockPrisma.user.findUnique
        .mockResolvedValueOnce(adminUser) // For auth
        .mockResolvedValueOnce(null);     // For user lookup

      // Act
      const response = await request(app)
        .get('/api/admin/users/nonexistent-user')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);

      // Assert
      expect(response.body).toEqual({
        success: false,
        error: {
          code: 'USER_NOT_FOUND',
          message: 'User not found',
          timestamp: expect.any(String),
          path: '/api/admin/users/nonexistent-user',
        },
      });
    });
  });

  describe('PUT /api/admin/users/:userId/status', () => {
    it('should update user status successfully', async () => {
      // Arrange
      mockPrisma.user.findUnique.mockResolvedValue(adminUser);
      
      const existingUser = {
        id: 'user-123',
        email: 'user@example.com',
        firstName: 'John',
        lastName: 'Doe',
        userType: 'TENANT',
        isVerified: true,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        password: 'hashedPassword',
      };

      const updatedUser = { ...existingUser, isActive: false };

      mockPrisma.user.findUnique.mockResolvedValueOnce(existingUser);
      mockPrisma.user.update.mockResolvedValueOnce(updatedUser);

      // Act
      const response = await request(app)
        .put('/api/admin/users/user-123/status')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ isActive: false })
        .expect(200);

      // Assert
      expect(response.body).toEqual({
        success: true,
        data: {
          user: {
            id: 'user-123',
            email: 'user@example.com',
            firstName: 'John',
            lastName: 'Doe',
            userType: 'TENANT',
            isVerified: true,
            isActive: false,
            createdAt: expect.any(String),
            updatedAt: expect.any(String),
          },
          message: 'User deactivated successfully',
        },
      });
    });

    it('should return 400 for invalid request body', async () => {
      // Arrange
      mockPrisma.user.findUnique.mockResolvedValue(adminUser);

      // Act
      const response = await request(app)
        .put('/api/admin/users/user-123/status')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ isActive: 'invalid' }) // Should be boolean
        .expect(400);

      // Assert
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBeDefined();
    });
  });

  describe('GET /api/admin/verification/documents', () => {
    it('should get pending verification documents', async () => {
      // Arrange
      mockPrisma.user.findUnique.mockResolvedValue(adminUser);
      
      const mockDocuments = [
        {
          id: 'doc-1',
          documentType: 'ID',
          documentUrl: 'https://example.com/doc1.pdf',
          status: 'PENDING',
          uploadedAt: new Date(),
          userId: 'user-1',
          user: {
            id: 'user-1',
            firstName: 'John',
            lastName: 'Doe',
            email: 'john@example.com',
            userType: 'TENANT',
          },
        },
      ];

      mockPrisma.verificationDocument.findMany.mockResolvedValue(mockDocuments);

      // Act
      const response = await request(app)
        .get('/api/admin/verification/documents')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      // Assert
      expect(response.body).toEqual({
        success: true,
        data: { documents: mockDocuments },
      });
    });
  });

  describe('PUT /api/admin/verification/documents/:documentId/review', () => {
    it('should approve verification document', async () => {
      // Arrange
      mockPrisma.user.findUnique.mockResolvedValue(adminUser);
      
      const mockDocument = {
        id: 'doc-123',
        documentType: 'ID',
        documentUrl: 'https://example.com/doc.pdf',
        status: 'APPROVED',
        uploadedAt: new Date(),
        reviewedAt: new Date(),
        userId: 'user-123',
      };

      mockPrisma.verificationDocument.update.mockResolvedValue(mockDocument);

      // Act
      const response = await request(app)
        .put('/api/admin/verification/documents/doc-123/review')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'APPROVED' })
        .expect(200);

      // Assert
      expect(response.body).toEqual({
        success: true,
        data: {
          document: expect.objectContaining({
            id: 'doc-123',
            status: 'APPROVED',
          }),
          message: 'Document approved successfully',
        },
      });
    });

    it('should reject verification document with reason', async () => {
      // Arrange
      mockPrisma.user.findUnique.mockResolvedValue(adminUser);
      
      const mockDocument = {
        id: 'doc-123',
        documentType: 'ID',
        documentUrl: 'https://example.com/doc.pdf',
        status: 'REJECTED',
        rejectionReason: 'Document is not clear',
        uploadedAt: new Date(),
        reviewedAt: new Date(),
        userId: 'user-123',
      };

      mockPrisma.verificationDocument.update.mockResolvedValue(mockDocument);

      // Act
      const response = await request(app)
        .put('/api/admin/verification/documents/doc-123/review')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ 
          status: 'REJECTED', 
          rejectionReason: 'Document is not clear' 
        })
        .expect(200);

      // Assert
      expect(response.body).toEqual({
        success: true,
        data: {
          document: expect.objectContaining({
            id: 'doc-123',
            status: 'REJECTED',
            rejectionReason: 'Document is not clear',
          }),
          message: 'Document rejected successfully',
        },
      });
    });

    it('should return 400 when rejecting without reason', async () => {
      // Arrange
      mockPrisma.user.findUnique.mockResolvedValue(adminUser);

      // Act
      const response = await request(app)
        .put('/api/admin/verification/documents/doc-123/review')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'REJECTED' }) // Missing rejectionReason
        .expect(400);

      // Assert
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBeDefined();
    });
  });
});