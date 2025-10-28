import { AdminService } from '../../services/admin.service';
import { UserRepository } from '../../repositories/user.repository';
import { PropertyRepository } from '../../repositories/property.repository';
import { AdminDashboardStats, CreateAdminLogData } from '../../types/admin.types';

// Mock repositories
jest.mock('../../repositories/user.repository');
jest.mock('../../repositories/property.repository');

// Mock Prisma client
const mockPrisma = {
  user: {
    count: jest.fn(),
    groupBy: jest.fn(),
  },
  property: {
    count: jest.fn(),
    groupBy: jest.fn(),
  },
  verificationDocument: {
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

jest.mock('@/config/database', () => ({
  prisma: mockPrisma,
}));

const MockedUserRepository = UserRepository as jest.MockedClass<typeof UserRepository>;
const MockedPropertyRepository = PropertyRepository as jest.MockedClass<typeof PropertyRepository>;

describe('AdminService', () => {
  let adminService: AdminService;
  let mockUserRepository: jest.Mocked<UserRepository>;
  let mockPropertyRepository: jest.Mocked<PropertyRepository>;

  beforeEach(() => {
    mockUserRepository = new MockedUserRepository() as jest.Mocked<UserRepository>;
    mockPropertyRepository = new MockedPropertyRepository() as jest.Mocked<PropertyRepository>;
    
    adminService = new AdminService();
    
    // Replace repository instances with mocks
    (adminService as any).userRepository = mockUserRepository;
    (adminService as any).propertyRepository = mockPropertyRepository;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getDashboardStats', () => {
    it('should return comprehensive dashboard statistics', async () => {
      // Arrange
      const mockCounts = [
        100, // totalUsers
        60,  // totalTenants
        30,  // totalLandlords
        95,  // activeUsers
        15,  // newUsersThisMonth
        200, // totalProperties
        150, // verifiedProperties
        30,  // pendingProperties
        20,  // rejectedProperties
        10,  // pendingDocuments
        500, // totalMessages
        300, // totalFavorites
      ];

      mockPrisma.user.count
        .mockResolvedValueOnce(mockCounts[0])  // totalUsers
        .mockResolvedValueOnce(mockCounts[1])  // totalTenants
        .mockResolvedValueOnce(mockCounts[2])  // totalLandlords
        .mockResolvedValueOnce(mockCounts[3])  // activeUsers
        .mockResolvedValueOnce(mockCounts[4]); // newUsersThisMonth

      mockPrisma.property.count
        .mockResolvedValueOnce(mockCounts[5])  // totalProperties
        .mockResolvedValueOnce(mockCounts[6])  // verifiedProperties
        .mockResolvedValueOnce(mockCounts[7])  // pendingProperties
        .mockResolvedValueOnce(mockCounts[8]); // rejectedProperties

      mockPrisma.verificationDocument.count.mockResolvedValueOnce(mockCounts[9]); // pendingDocuments
      mockPrisma.message.count.mockResolvedValueOnce(mockCounts[10]); // totalMessages
      mockPrisma.favorite.count.mockResolvedValueOnce(mockCounts[11]); // totalFavorites

      mockPrisma.property.groupBy
        .mockResolvedValueOnce([
          { propertyType: 'APARTMENT', _count: { id: 80 } },
          { propertyType: 'HOUSE', _count: { id: 70 } },
          { propertyType: 'ROOM', _count: { id: 50 } },
        ])
        .mockResolvedValueOnce([
          { city: 'Paris', _count: { id: 100 } },
          { city: 'Lyon', _count: { id: 60 } },
          { city: 'Marseille', _count: { id: 40 } },
        ]);

      // Act
      const result = await adminService.getDashboardStats();

      // Assert
      expect(result).toEqual({
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
            ROOM: 50,
          },
          byCity: {
            Paris: 100,
            Lyon: 60,
            Marseille: 40,
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
      });

      expect(mockPrisma.user.count).toHaveBeenCalledTimes(5);
      expect(mockPrisma.property.count).toHaveBeenCalledTimes(4);
      expect(mockPrisma.property.groupBy).toHaveBeenCalledTimes(2);
    });

    it('should handle database errors', async () => {
      // Arrange
      mockPrisma.user.count.mockRejectedValueOnce(new Error('Database connection failed'));

      // Act & Assert
      await expect(adminService.getDashboardStats()).rejects.toThrow('Failed to get dashboard statistics');
    });
  });

  describe('logAdminActivity', () => {
    it('should log admin activity successfully', async () => {
      // Arrange
      const logData: CreateAdminLogData = {
        adminId: 'admin-123',
        action: 'USER_SUSPENDED',
        targetType: 'USER',
        targetId: 'user-456',
        details: { reason: 'Violation of terms' },
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
      };

      const mockActivityLog = {
        id: 'log-123',
        ...logData,
        timestamp: new Date(),
      };

      mockPrisma.adminActivityLog.create.mockResolvedValueOnce(mockActivityLog);

      // Act
      const result = await adminService.logAdminActivity(logData);

      // Assert
      expect(result).toEqual(mockActivityLog);
      expect(mockPrisma.adminActivityLog.create).toHaveBeenCalledWith({
        data: {
          adminId: logData.adminId,
          action: logData.action,
          targetType: logData.targetType,
          targetId: logData.targetId,
          details: logData.details,
          ipAddress: logData.ipAddress,
          userAgent: logData.userAgent,
          timestamp: expect.any(Date),
        },
      });
    });

    it('should handle logging errors', async () => {
      // Arrange
      const logData: CreateAdminLogData = {
        adminId: 'admin-123',
        action: 'USER_SUSPENDED',
        targetType: 'USER',
        targetId: 'user-456',
        details: {},
      };

      mockPrisma.adminActivityLog.create.mockRejectedValueOnce(new Error('Database error'));

      // Act & Assert
      await expect(adminService.logAdminActivity(logData)).rejects.toThrow('Failed to log admin activity');
    });
  });

  describe('getActivityLogs', () => {
    it('should get activity logs with pagination', async () => {
      // Arrange
      const mockLogs = [
        {
          id: 'log-1',
          adminId: 'admin-123',
          action: 'USER_SUSPENDED',
          targetType: 'USER',
          targetId: 'user-456',
          details: {},
          timestamp: new Date(),
          admin: {
            id: 'admin-123',
            firstName: 'Admin',
            lastName: 'User',
            email: 'admin@example.com',
          },
        },
      ];

      mockPrisma.adminActivityLog.findMany.mockResolvedValueOnce(mockLogs);
      mockPrisma.adminActivityLog.count.mockResolvedValueOnce(1);

      // Act
      const result = await adminService.getActivityLogs(1, 10);

      // Assert
      expect(result).toEqual({
        logs: mockLogs,
        total: 1,
      });

      expect(mockPrisma.adminActivityLog.findMany).toHaveBeenCalledWith({
        where: {},
        skip: 0,
        take: 10,
        orderBy: { timestamp: 'desc' },
        include: {
          admin: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
      });
    });

    it('should filter activity logs by parameters', async () => {
      // Arrange
      mockPrisma.adminActivityLog.findMany.mockResolvedValueOnce([]);
      mockPrisma.adminActivityLog.count.mockResolvedValueOnce(0);

      // Act
      await adminService.getActivityLogs(1, 10, 'admin-123', 'USER_SUSPENDED', 'USER');

      // Assert
      expect(mockPrisma.adminActivityLog.findMany).toHaveBeenCalledWith({
        where: {
          adminId: 'admin-123',
          action: 'USER_SUSPENDED',
          targetType: 'USER',
        },
        skip: 0,
        take: 10,
        orderBy: { timestamp: 'desc' },
        include: {
          admin: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
      });
    });

    it('should handle database errors', async () => {
      // Arrange
      mockPrisma.adminActivityLog.findMany.mockRejectedValueOnce(new Error('Database error'));

      // Act & Assert
      await expect(adminService.getActivityLogs()).rejects.toThrow('Failed to get activity logs');
    });
  });

  describe('suspendUser', () => {
    it('should suspend user and log activity', async () => {
      // Arrange
      const adminId = 'admin-123';
      const userId = 'user-456';
      const reason = 'Terms violation';

      mockUserRepository.update.mockResolvedValueOnce({} as any);
      mockPrisma.adminActivityLog.create.mockResolvedValueOnce({} as any);

      // Act
      await adminService.suspendUser(adminId, userId, reason);

      // Assert
      expect(mockUserRepository.update).toHaveBeenCalledWith(userId, { isActive: false });
      expect(mockPrisma.adminActivityLog.create).toHaveBeenCalledWith({
        data: {
          adminId,
          action: 'USER_SUSPENDED',
          targetType: 'USER',
          targetId: userId,
          details: { reason },
          ipAddress: undefined,
          userAgent: undefined,
          timestamp: expect.any(Date),
        },
      });
    });

    it('should handle suspension errors', async () => {
      // Arrange
      mockUserRepository.update.mockRejectedValueOnce(new Error('User not found'));

      // Act & Assert
      await expect(adminService.suspendUser('admin-123', 'user-456', 'reason')).rejects.toThrow('Failed to suspend user');
    });
  });

  describe('activateUser', () => {
    it('should activate user and log activity', async () => {
      // Arrange
      const adminId = 'admin-123';
      const userId = 'user-456';

      mockUserRepository.update.mockResolvedValueOnce({} as any);
      mockPrisma.adminActivityLog.create.mockResolvedValueOnce({} as any);

      // Act
      await adminService.activateUser(adminId, userId);

      // Assert
      expect(mockUserRepository.update).toHaveBeenCalledWith(userId, { isActive: true });
      expect(mockPrisma.adminActivityLog.create).toHaveBeenCalledWith({
        data: {
          adminId,
          action: 'USER_ACTIVATED',
          targetType: 'USER',
          targetId: userId,
          details: {},
          ipAddress: undefined,
          userAgent: undefined,
          timestamp: expect.any(Date),
        },
      });
    });

    it('should handle activation errors', async () => {
      // Arrange
      mockUserRepository.update.mockRejectedValueOnce(new Error('User not found'));

      // Act & Assert
      await expect(adminService.activateUser('admin-123', 'user-456')).rejects.toThrow('Failed to activate user');
    });
  });

  describe('approveProperty', () => {
    it('should approve property and log activity', async () => {
      // Arrange
      const adminId = 'admin-123';
      const propertyId = 'property-456';

      mockPropertyRepository.updateVerificationStatus.mockResolvedValueOnce({} as any);
      mockPrisma.adminActivityLog.create.mockResolvedValueOnce({} as any);

      // Act
      await adminService.approveProperty(adminId, propertyId);

      // Assert
      expect(mockPropertyRepository.updateVerificationStatus).toHaveBeenCalledWith(propertyId, 'APPROVED');
      expect(mockPrisma.adminActivityLog.create).toHaveBeenCalledWith({
        data: {
          adminId,
          action: 'PROPERTY_APPROVED',
          targetType: 'PROPERTY',
          targetId: propertyId,
          details: {},
          ipAddress: undefined,
          userAgent: undefined,
          timestamp: expect.any(Date),
        },
      });
    });

    it('should handle approval errors', async () => {
      // Arrange
      mockPropertyRepository.updateVerificationStatus.mockRejectedValueOnce(new Error('Property not found'));

      // Act & Assert
      await expect(adminService.approveProperty('admin-123', 'property-456')).rejects.toThrow('Failed to approve property');
    });
  });

  describe('rejectProperty', () => {
    it('should reject property and log activity', async () => {
      // Arrange
      const adminId = 'admin-123';
      const propertyId = 'property-456';
      const reason = 'Incomplete information';

      mockPropertyRepository.updateVerificationStatus.mockResolvedValueOnce({} as any);
      mockPrisma.adminActivityLog.create.mockResolvedValueOnce({} as any);

      // Act
      await adminService.rejectProperty(adminId, propertyId, reason);

      // Assert
      expect(mockPropertyRepository.updateVerificationStatus).toHaveBeenCalledWith(propertyId, 'REJECTED', reason);
      expect(mockPrisma.adminActivityLog.create).toHaveBeenCalledWith({
        data: {
          adminId,
          action: 'PROPERTY_REJECTED',
          targetType: 'PROPERTY',
          targetId: propertyId,
          details: { reason },
          ipAddress: undefined,
          userAgent: undefined,
          timestamp: expect.any(Date),
        },
      });
    });

    it('should handle rejection errors', async () => {
      // Arrange
      mockPropertyRepository.updateVerificationStatus.mockRejectedValueOnce(new Error('Property not found'));

      // Act & Assert
      await expect(adminService.rejectProperty('admin-123', 'property-456', 'reason')).rejects.toThrow('Failed to reject property');
    });
  });

  describe('getUserStatistics', () => {
    it('should return user statistics', async () => {
      // Arrange
      mockPrisma.user.count
        .mockResolvedValueOnce(100) // totalUsers
        .mockResolvedValueOnce(95)  // activeUsers
        .mockResolvedValueOnce(80)  // verifiedUsers
        .mockResolvedValueOnce(15); // recentRegistrations

      mockPrisma.user.groupBy.mockResolvedValueOnce([
        { userType: 'TENANT', _count: { id: 60 } },
        { userType: 'LANDLORD', _count: { id: 30 } },
        { userType: 'ADMIN', _count: { id: 10 } },
      ]);

      // Act
      const result = await adminService.getUserStatistics();

      // Assert
      expect(result).toEqual({
        totalUsers: 100,
        activeUsers: 95,
        verifiedUsers: 80,
        usersByType: {
          TENANT: 60,
          LANDLORD: 30,
          ADMIN: 10,
        },
        recentRegistrations: 15,
      });
    });

    it('should handle database errors', async () => {
      // Arrange
      mockPrisma.user.count.mockRejectedValueOnce(new Error('Database error'));

      // Act & Assert
      await expect(adminService.getUserStatistics()).rejects.toThrow('Failed to get user statistics');
    });
  });

  describe('getPropertyStatistics', () => {
    it('should return property statistics', async () => {
      // Arrange
      mockPrisma.property.count
        .mockResolvedValueOnce(200) // totalProperties
        .mockResolvedValueOnce(180) // activeProperties
        .mockResolvedValueOnce(150) // verifiedProperties
        .mockResolvedValueOnce(30)  // pendingProperties
        .mockResolvedValueOnce(20); // rejectedProperties

      mockPrisma.property.groupBy.mockResolvedValueOnce([
        { city: 'Paris', _count: { id: 100 } },
        { city: 'Lyon', _count: { id: 50 } },
        { city: 'Marseille', _count: { id: 30 } },
      ]);

      // Act
      const result = await adminService.getPropertyStatistics();

      // Assert
      expect(result).toEqual({
        totalProperties: 200,
        activeProperties: 180,
        verifiedProperties: 150,
        pendingProperties: 30,
        rejectedProperties: 20,
        propertiesByCity: {
          Paris: 100,
          Lyon: 50,
          Marseille: 30,
        },
      });
    });

    it('should handle database errors', async () => {
      // Arrange
      mockPrisma.property.count.mockRejectedValueOnce(new Error('Database error'));

      // Act & Assert
      await expect(adminService.getPropertyStatistics()).rejects.toThrow('Failed to get property statistics');
    });
  });
});