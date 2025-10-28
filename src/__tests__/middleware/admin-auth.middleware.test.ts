import { authenticate, authorize } from '../../middleware/auth.middleware';
import { createMockRequest, createMockResponse, createMockNext } from '../utils/testUtils';
import { AuthUtils } from '../../utils/auth';
import { createUserData } from '../factories/userFactory';

// Mock UserRepository
const mockUserRepository = {
  findById: jest.fn(),
};

jest.mock('../../repositories/user.repository', () => ({
  UserRepository: jest.fn().mockImplementation(() => mockUserRepository),
}));

describe('Admin Authorization Middleware', () => {
  let mockRequest: any;
  let mockResponse: any;
  let mockNext: jest.Mock;

  beforeEach(() => {
    mockRequest = createMockRequest();
    mockResponse = createMockResponse();
    mockNext = createMockNext();
    
    jest.clearAllMocks();
  });

  describe('authenticate middleware', () => {
    it('should authenticate valid admin token', async () => {
      // Arrange
      const adminUser = createUserData({
        userType: 'ADMIN',
        isVerified: true,
        isActive: true,
      });

      const token = AuthUtils.generateAccessToken({
        userId: adminUser.id,
        email: adminUser.email,
        userType: adminUser.userType,
      });

      mockRequest.headers.authorization = `Bearer ${token}`;
      mockUserRepository.findById.mockResolvedValue(adminUser);

      // Act
      await authenticate(mockRequest, mockResponse, mockNext);

      // Assert
      expect(mockNext).toHaveBeenCalledWith();
      expect(mockRequest.user).toEqual({
        id: adminUser.id,
        email: adminUser.email,
        userType: adminUser.userType,
      });
    });

    it('should reject request without authorization header', async () => {
      // Arrange
      mockRequest.headers = {};

      // Act
      await authenticate(mockRequest, mockResponse, mockNext);

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Access token is required',
          timestamp: expect.any(String),
          path: expect.any(String),
        },
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should reject invalid token format', async () => {
      // Arrange
      mockRequest.headers.authorization = 'InvalidTokenFormat';

      // Act
      await authenticate(mockRequest, mockResponse, mockNext);

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Invalid token format',
          timestamp: expect.any(String),
          path: expect.any(String),
        },
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should reject expired token', async () => {
      // Arrange
      const expiredToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJ0ZXN0LXVzZXIiLCJlbWFpbCI6InRlc3RAZXhhbXBsZS5jb20iLCJ1c2VyVHlwZSI6IkFETUlOIiwiaWF0IjoxNjAwMDAwMDAwLCJleHAiOjE2MDAwMDA5MDB9.invalid';
      mockRequest.headers.authorization = `Bearer ${expiredToken}`;

      // Act
      await authenticate(mockRequest, mockResponse, mockNext);

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Invalid or expired token',
          timestamp: expect.any(String),
          path: expect.any(String),
        },
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should reject token for inactive user', async () => {
      // Arrange
      const inactiveUser = createUserData({
        userType: 'ADMIN',
        isVerified: true,
        isActive: false, // Inactive user
      });

      const token = AuthUtils.generateAccessToken({
        userId: inactiveUser.id,
        email: inactiveUser.email,
        userType: inactiveUser.userType,
      });

      mockRequest.headers.authorization = `Bearer ${token}`;
      mockUserRepository.findById.mockResolvedValue(inactiveUser);

      // Act
      await authenticate(mockRequest, mockResponse, mockNext);

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Account has been deactivated',
          timestamp: expect.any(String),
          path: expect.any(String),
        },
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should reject token for non-existent user', async () => {
      // Arrange
      const token = AuthUtils.generateAccessToken({
        userId: 'nonexistent-user',
        email: 'nonexistent@example.com',
        userType: 'ADMIN',
      });

      mockRequest.headers.authorization = `Bearer ${token}`;
      mockUserRepository.findById.mockResolvedValue(null);

      // Act
      await authenticate(mockRequest, mockResponse, mockNext);

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'User not found',
          timestamp: expect.any(String),
          path: expect.any(String),
        },
      });
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('authorize middleware for admin access', () => {
    beforeEach(() => {
      // Set up authenticated user in request
      mockRequest.user = {
        id: 'admin-user',
        email: 'admin@example.com',
        userType: 'ADMIN',
      };
    });

    it('should allow access for admin user', async () => {
      // Arrange
      const authorizeAdmin = authorize(['ADMIN']);

      // Act
      await authorizeAdmin(mockRequest, mockResponse, mockNext);

      // Assert
      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should deny access for tenant user', async () => {
      // Arrange
      mockRequest.user.userType = 'TENANT';
      const authorizeAdmin = authorize(['ADMIN']);

      // Act
      await authorizeAdmin(mockRequest, mockResponse, mockNext);

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Insufficient permissions',
          timestamp: expect.any(String),
          path: expect.any(String),
        },
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should deny access for landlord user', async () => {
      // Arrange
      mockRequest.user.userType = 'LANDLORD';
      const authorizeAdmin = authorize(['ADMIN']);

      // Act
      await authorizeAdmin(mockRequest, mockResponse, mockNext);

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Insufficient permissions',
          timestamp: expect.any(String),
          path: expect.any(String),
        },
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should deny access when user is not authenticated', async () => {
      // Arrange
      mockRequest.user = undefined;
      const authorizeAdmin = authorize(['ADMIN']);

      // Act
      await authorizeAdmin(mockRequest, mockResponse, mockNext);

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
          timestamp: expect.any(String),
          path: expect.any(String),
        },
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should allow access for multiple allowed roles', async () => {
      // Arrange
      const authorizeMultiple = authorize(['ADMIN', 'LANDLORD']);
      mockRequest.user.userType = 'LANDLORD';

      // Act
      await authorizeMultiple(mockRequest, mockResponse, mockNext);

      // Assert
      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should handle database errors during authentication', async () => {
      // Arrange
      const adminUser = createUserData({
        userType: 'ADMIN',
        isVerified: true,
        isActive: true,
      });

      const token = AuthUtils.generateAccessToken({
        userId: adminUser.id,
        email: adminUser.email,
        userType: adminUser.userType,
      });

      mockRequest.headers.authorization = `Bearer ${token}`;
      mockUserRepository.findById.mockRejectedValue(new Error('Database connection failed'));

      // Act
      await authenticate(mockRequest, mockResponse, mockNext);

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Authentication failed',
          timestamp: expect.any(String),
          path: expect.any(String),
        },
      });
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('admin route protection scenarios', () => {
    it('should protect admin routes with both authenticate and authorize middleware', async () => {
      // Arrange
      const adminUser = createUserData({
        userType: 'ADMIN',
        isVerified: true,
        isActive: true,
      });

      const token = AuthUtils.generateAccessToken({
        userId: adminUser.id,
        email: adminUser.email,
        userType: adminUser.userType,
      });

      mockRequest.headers.authorization = `Bearer ${token}`;
      mockUserRepository.findById.mockResolvedValue(adminUser);

      const authorizeAdmin = authorize(['ADMIN']);

      // Act - First authenticate
      await authenticate(mockRequest, mockResponse, mockNext);
      
      // Then authorize (if authentication succeeded)
      if (mockNext.mock.calls.length > 0) {
        await authorizeAdmin(mockRequest, mockResponse, mockNext);
      }

      // Assert
      expect(mockNext).toHaveBeenCalledTimes(2); // Called by both middleware
      expect(mockRequest.user).toEqual({
        id: adminUser.id,
        email: adminUser.email,
        userType: adminUser.userType,
      });
    });

    it('should block non-admin users from admin routes', async () => {
      // Arrange
      const tenantUser = createUserData({
        userType: 'TENANT',
        isVerified: true,
        isActive: true,
      });

      const token = AuthUtils.generateAccessToken({
        userId: tenantUser.id,
        email: tenantUser.email,
        userType: tenantUser.userType,
      });

      mockRequest.headers.authorization = `Bearer ${token}`;
      mockUserRepository.findById.mockResolvedValue(tenantUser);

      const authorizeAdmin = authorize(['ADMIN']);

      // Act - First authenticate
      await authenticate(mockRequest, mockResponse, mockNext);
      
      // Reset mocks for authorization step
      mockNext.mockClear();
      mockResponse.status.mockClear();
      mockResponse.json.mockClear();
      
      // Then authorize (authentication should have succeeded)
      await authorizeAdmin(mockRequest, mockResponse, mockNext);

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Insufficient permissions',
          timestamp: expect.any(String),
          path: expect.any(String),
        },
      });
      expect(mockNext).not.toHaveBeenCalled(); // Authorization should block
    });
  });
});