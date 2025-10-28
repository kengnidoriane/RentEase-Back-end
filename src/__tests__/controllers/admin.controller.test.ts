import { AdminController } from '../../controllers/admin.controller';
import { UserRepository } from '../../repositories/user.repository';
import { createMockRequest, createMockResponse } from '../utils/testUtils';
import { AuthenticatedRequest } from '../../types/auth.types';

// Mock UserRepository
jest.mock('../../repositories/user.repository');
const MockedUserRepository = UserRepository as jest.MockedClass<typeof UserRepository>;

describe('AdminController', () => {
  let adminController: AdminController;
  let mockUserRepository: jest.Mocked<UserRepository>;
  let mockRequest: Partial<AuthenticatedRequest>;
  let mockResponse: any;

  beforeEach(() => {
    mockUserRepository = new MockedUserRepository() as jest.Mocked<UserRepository>;
    adminController = new AdminController();
    
    // Replace the repository instance with our mock
    (adminController as any).userRepository = mockUserRepository;

    mockRequest = createMockRequest({
      user: {
        id: 'admin-id',
        email: 'admin@example.com',
        userType: 'ADMIN',
      },
      path: '/api/admin/users',
    }) as Partial<AuthenticatedRequest>;

    mockResponse = createMockResponse();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getAllUsers', () => {
    it('should get all users with pagination', async () => {
      // Arrange
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
        {
          id: 'user-2',
          email: 'user2@example.com',
          firstName: 'Jane',
          lastName: 'Smith',
          userType: 'LANDLORD',
          isVerified: true,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
          password: 'hashedPassword',
        },
      ];

      mockRequest.query = { page: '1', limit: '10' };
      mockUserRepository.findAll.mockResolvedValueOnce({
        users: mockUsers,
        total: 2,
      });

      // Act
      await adminController.getAllUsers(mockRequest as AuthenticatedRequest, mockResponse);

      // Assert
      expect(mockUserRepository.findAll).toHaveBeenCalledWith(1, 10);
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
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
              createdAt: expect.any(Date),
              updatedAt: expect.any(Date),
            },
            {
              id: 'user-2',
              email: 'user2@example.com',
              firstName: 'Jane',
              lastName: 'Smith',
              userType: 'LANDLORD',
              isVerified: true,
              isActive: true,
              createdAt: expect.any(Date),
              updatedAt: expect.any(Date),
            },
          ],
          pagination: {
            page: 1,
            limit: 10,
            total: 2,
            totalPages: 1,
          },
        },
      });
    });

    it('should use default pagination values', async () => {
      // Arrange
      mockRequest.query = {};
      mockUserRepository.findAll.mockResolvedValueOnce({
        users: [],
        total: 0,
      });

      // Act
      await adminController.getAllUsers(mockRequest as AuthenticatedRequest, mockResponse);

      // Assert
      expect(mockUserRepository.findAll).toHaveBeenCalledWith(1, 10);
    });

    it('should handle repository errors', async () => {
      // Arrange
      mockUserRepository.findAll.mockRejectedValueOnce(new Error('Database error'));

      // Act
      await adminController.getAllUsers(mockRequest as AuthenticatedRequest, mockResponse);

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to get users',
          timestamp: expect.any(String),
          path: '/api/admin/users',
        },
      });
    });
  });

  describe('getUserById', () => {
    it('should get user by ID with verification documents', async () => {
      // Arrange
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

      mockRequest.params = { userId: 'user-123' };
      mockUserRepository.findWithVerificationDocuments.mockResolvedValueOnce(mockUser);

      // Act
      await adminController.getUserById(mockRequest as AuthenticatedRequest, mockResponse);

      // Assert
      expect(mockUserRepository.findWithVerificationDocuments).toHaveBeenCalledWith('user-123');
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
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
            createdAt: expect.any(Date),
            updatedAt: expect.any(Date),
            verificationDocuments: [],
          },
        },
      });
    });

    it('should return 400 when userId is missing', async () => {
      // Arrange
      mockRequest.params = {};

      // Act
      await adminController.getUserById(mockRequest as AuthenticatedRequest, mockResponse);

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'User ID is required',
          timestamp: expect.any(String),
          path: '/api/admin/users',
        },
      });
    });

    it('should return 404 when user not found', async () => {
      // Arrange
      mockRequest.params = { userId: 'nonexistent-user' };
      mockUserRepository.findWithVerificationDocuments.mockResolvedValueOnce(null);

      // Act
      await adminController.getUserById(mockRequest as AuthenticatedRequest, mockResponse);

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'USER_NOT_FOUND',
          message: 'User not found',
          timestamp: expect.any(String),
          path: '/api/admin/users',
        },
      });
    });

    it('should handle repository errors', async () => {
      // Arrange
      mockRequest.params = { userId: 'user-123' };
      mockUserRepository.findWithVerificationDocuments.mockRejectedValueOnce(new Error('Database error'));

      // Act
      await adminController.getUserById(mockRequest as AuthenticatedRequest, mockResponse);

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to get user',
          timestamp: expect.any(String),
          path: '/api/admin/users',
        },
      });
    });
  });

  describe('updateUserStatus', () => {
    it('should update user status successfully', async () => {
      // Arrange
      const mockUser = {
        id: 'user-123',
        email: 'user@example.com',
        firstName: 'John',
        lastName: 'Doe',
        userType: 'TENANT',
        isVerified: true,
        isActive: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        password: 'hashedPassword',
      };

      mockRequest.params = { userId: 'user-123' };
      mockRequest.body = { isActive: false };
      mockUserRepository.findById.mockResolvedValueOnce({ ...mockUser, isActive: true });
      mockUserRepository.update.mockResolvedValueOnce(mockUser);

      // Act
      await adminController.updateUserStatus(mockRequest as AuthenticatedRequest, mockResponse);

      // Assert
      expect(mockUserRepository.findById).toHaveBeenCalledWith('user-123');
      expect(mockUserRepository.update).toHaveBeenCalledWith('user-123', { isActive: false });
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
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
            createdAt: expect.any(Date),
            updatedAt: expect.any(Date),
          },
          message: 'User deactivated successfully',
        },
      });
    });

    it('should return 400 when userId is missing', async () => {
      // Arrange
      mockRequest.params = {};
      mockRequest.body = { isActive: false };

      // Act
      await adminController.updateUserStatus(mockRequest as AuthenticatedRequest, mockResponse);

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'User ID is required',
          timestamp: expect.any(String),
          path: '/api/admin/users',
        },
      });
    });

    it('should return 404 when user not found', async () => {
      // Arrange
      mockRequest.params = { userId: 'nonexistent-user' };
      mockRequest.body = { isActive: false };
      mockUserRepository.findById.mockResolvedValueOnce(null);

      // Act
      await adminController.updateUserStatus(mockRequest as AuthenticatedRequest, mockResponse);

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'USER_NOT_FOUND',
          message: 'User not found',
          timestamp: expect.any(String),
          path: '/api/admin/users',
        },
      });
    });

    it('should handle repository errors', async () => {
      // Arrange
      mockRequest.params = { userId: 'user-123' };
      mockRequest.body = { isActive: false };
      mockUserRepository.findById.mockRejectedValueOnce(new Error('Database error'));

      // Act
      await adminController.updateUserStatus(mockRequest as AuthenticatedRequest, mockResponse);

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to update user status',
          timestamp: expect.any(String),
          path: '/api/admin/users',
        },
      });
    });
  });

  describe('reviewVerificationDocument', () => {
    it('should approve verification document successfully', async () => {
      // Arrange
      const mockDocument = {
        id: 'doc-123',
        documentType: 'ID',
        documentUrl: 'https://example.com/doc.pdf',
        status: 'APPROVED',
        uploadedAt: new Date(),
        reviewedAt: new Date(),
        userId: 'user-123',
      };

      mockRequest.params = { documentId: 'doc-123' };
      mockRequest.body = { status: 'APPROVED' };
      mockUserRepository.updateVerificationDocumentStatus.mockResolvedValueOnce(mockDocument);

      // Act
      await adminController.reviewVerificationDocument(mockRequest as AuthenticatedRequest, mockResponse);

      // Assert
      expect(mockUserRepository.updateVerificationDocumentStatus).toHaveBeenCalledWith(
        'doc-123',
        'APPROVED',
        undefined
      );
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: {
          document: mockDocument,
          message: 'Document approved successfully',
        },
      });
    });

    it('should reject verification document with reason', async () => {
      // Arrange
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

      mockRequest.params = { documentId: 'doc-123' };
      mockRequest.body = { status: 'REJECTED', rejectionReason: 'Document is not clear' };
      mockUserRepository.updateVerificationDocumentStatus.mockResolvedValueOnce(mockDocument);

      // Act
      await adminController.reviewVerificationDocument(mockRequest as AuthenticatedRequest, mockResponse);

      // Assert
      expect(mockUserRepository.updateVerificationDocumentStatus).toHaveBeenCalledWith(
        'doc-123',
        'REJECTED',
        'Document is not clear'
      );
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: {
          document: mockDocument,
          message: 'Document rejected successfully',
        },
      });
    });

    it('should return 400 when documentId is missing', async () => {
      // Arrange
      mockRequest.params = {};
      mockRequest.body = { status: 'APPROVED' };

      // Act
      await adminController.reviewVerificationDocument(mockRequest as AuthenticatedRequest, mockResponse);

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Document ID is required',
          timestamp: expect.any(String),
          path: '/api/admin/users',
        },
      });
    });

    it('should return 400 when rejecting without reason', async () => {
      // Arrange
      mockRequest.params = { documentId: 'doc-123' };
      mockRequest.body = { status: 'REJECTED' }; // Missing rejectionReason

      // Act
      await adminController.reviewVerificationDocument(mockRequest as AuthenticatedRequest, mockResponse);

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Rejection reason is required when rejecting a document',
          timestamp: expect.any(String),
          path: '/api/admin/users',
        },
      });
    });

    it('should return 404 when document not found', async () => {
      // Arrange
      mockRequest.params = { documentId: 'nonexistent-doc' };
      mockRequest.body = { status: 'APPROVED' };
      mockUserRepository.updateVerificationDocumentStatus.mockRejectedValueOnce(
        new Error('Document not found')
      );

      // Act
      await adminController.reviewVerificationDocument(mockRequest as AuthenticatedRequest, mockResponse);

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'DOCUMENT_NOT_FOUND',
          message: 'Document not found',
          timestamp: expect.any(String),
          path: '/api/admin/users',
        },
      });
    });

    it('should handle repository errors', async () => {
      // Arrange
      mockRequest.params = { documentId: 'doc-123' };
      mockRequest.body = { status: 'APPROVED' };
      mockUserRepository.updateVerificationDocumentStatus.mockRejectedValueOnce(
        new Error('Database error')
      );

      // Act
      await adminController.reviewVerificationDocument(mockRequest as AuthenticatedRequest, mockResponse);

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Database error',
          timestamp: expect.any(String),
          path: '/api/admin/users',
        },
      });
    });
  });

  describe('getPendingVerificationDocuments', () => {
    it('should get pending verification documents', async () => {
      // Arrange
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

      mockUserRepository.getPendingVerificationDocuments.mockResolvedValueOnce(mockDocuments);

      // Act
      await adminController.getPendingVerificationDocuments(mockRequest as AuthenticatedRequest, mockResponse);

      // Assert
      expect(mockUserRepository.getPendingVerificationDocuments).toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: { documents: mockDocuments },
      });
    });

    it('should handle repository errors', async () => {
      // Arrange
      mockUserRepository.getPendingVerificationDocuments.mockRejectedValueOnce(new Error('Database error'));

      // Act
      await adminController.getPendingVerificationDocuments(mockRequest as AuthenticatedRequest, mockResponse);

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to get pending documents',
          timestamp: expect.any(String),
          path: '/api/admin/users',
        },
      });
    });
  });

  describe('getDashboardStats', () => {
    it('should get dashboard statistics', async () => {
      // Arrange
      const mockStats = {
        totalUsers: 100,
        totalTenants: 60,
        totalLandlords: 30,
        pendingVerifications: 10,
        totalProperties: 200,
      };

      mockUserRepository.getDashboardStats.mockResolvedValueOnce(mockStats);

      // Act
      await adminController.getDashboardStats(mockRequest as AuthenticatedRequest, mockResponse);

      // Assert
      expect(mockUserRepository.getDashboardStats).toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: mockStats,
      });
    });

    it('should handle repository errors', async () => {
      // Arrange
      mockUserRepository.getDashboardStats.mockRejectedValueOnce(new Error('Database error'));

      // Act
      await adminController.getDashboardStats(mockRequest as AuthenticatedRequest, mockResponse);

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to get dashboard statistics',
          timestamp: expect.any(String),
          path: '/api/admin/users',
        },
      });
    });
  });
});