import { AdminService } from '../../services/admin.service';
import { CreateAdminLogData, AdminAction } from '../../types/admin.types';

// Mock Prisma client
const mockPrisma = {
  adminActivityLog: {
    create: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
  },
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
};

jest.mock('@/config/database', () => ({
  prisma: mockPrisma,
}));

// Mock repositories
jest.mock('../../repositories/user.repository');
jest.mock('../../repositories/property.repository');

describe('Admin Audit Logging Service', () => {
  let adminService: AdminService;

  beforeEach(() => {
    adminService = new AdminService();
    jest.clearAllMocks();
  });

  describe('logAdminActivity', () => {
    it('should log user suspension activity', async () => {
      // Arrange
      const logData: CreateAdminLogData = {
        adminId: 'admin-123',
        action: 'USER_SUSPENDED',
        targetType: 'USER',
        targetId: 'user-456',
        details: {
          reason: 'Violation of terms of service',
          previousStatus: 'active',
          newStatus: 'suspended',
        },
        ipAddress: '192.168.1.100',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      };

      const expectedLog = {
        id: 'log-123',
        adminId: 'admin-123',
        action: 'USER_SUSPENDED',
        targetType: 'USER',
        targetId: 'user-456',
        details: logData.details,
        ipAddress: '192.168.1.100',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        timestamp: new Date('2024-01-15T10:30:00Z'),
      };

      mockPrisma.adminActivityLog.create.mockResolvedValue(expectedLog);

      // Act
      const result = await adminService.logAdminActivity(logData);

      // Assert
      expect(mockPrisma.adminActivityLog.create).toHaveBeenCalledWith({
        data: {
          adminId: 'admin-123',
          action: 'USER_SUSPENDED',
          targetType: 'USER',
          targetId: 'user-456',
          details: {
            reason: 'Violation of terms of service',
            previousStatus: 'active',
            newStatus: 'suspended',
          },
          ipAddress: '192.168.1.100',
          userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          timestamp: expect.any(Date),
        },
      });

      expect(result).toEqual(expectedLog);
    });

    it('should log property approval activity', async () => {
      // Arrange
      const logData: CreateAdminLogData = {
        adminId: 'admin-456',
        action: 'PROPERTY_APPROVED',
        targetType: 'PROPERTY',
        targetId: 'property-789',
        details: {
          propertyTitle: 'Beautiful apartment in Paris',
          landlordId: 'landlord-123',
          previousStatus: 'pending',
          newStatus: 'approved',
        },
      };

      const expectedLog = {
        id: 'log-456',
        ...logData,
        timestamp: new Date(),
      };

      mockPrisma.adminActivityLog.create.mockResolvedValue(expectedLog);

      // Act
      const result = await adminService.logAdminActivity(logData);

      // Assert
      expect(mockPrisma.adminActivityLog.create).toHaveBeenCalledWith({
        data: {
          adminId: 'admin-456',
          action: 'PROPERTY_APPROVED',
          targetType: 'PROPERTY',
          targetId: 'property-789',
          details: {
            propertyTitle: 'Beautiful apartment in Paris',
            landlordId: 'landlord-123',
            previousStatus: 'pending',
            newStatus: 'approved',
          },
          ipAddress: undefined,
          userAgent: undefined,
          timestamp: expect.any(Date),
        },
      });

      expect(result).toEqual(expectedLog);
    });

    it('should log document rejection activity', async () => {
      // Arrange
      const logData: CreateAdminLogData = {
        adminId: 'admin-789',
        action: 'DOCUMENT_REJECTED',
        targetType: 'DOCUMENT',
        targetId: 'doc-123',
        details: {
          documentType: 'ID',
          userId: 'user-456',
          rejectionReason: 'Document image is not clear enough',
          previousStatus: 'pending',
          newStatus: 'rejected',
        },
        ipAddress: '10.0.0.1',
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
      };

      const expectedLog = {
        id: 'log-789',
        ...logData,
        timestamp: new Date(),
      };

      mockPrisma.adminActivityLog.create.mockResolvedValue(expectedLog);

      // Act
      const result = await adminService.logAdminActivity(logData);

      // Assert
      expect(mockPrisma.adminActivityLog.create).toHaveBeenCalledWith({
        data: {
          adminId: 'admin-789',
          action: 'DOCUMENT_REJECTED',
          targetType: 'DOCUMENT',
          targetId: 'doc-123',
          details: {
            documentType: 'ID',
            userId: 'user-456',
            rejectionReason: 'Document image is not clear enough',
            previousStatus: 'pending',
            newStatus: 'rejected',
          },
          ipAddress: '10.0.0.1',
          userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
          timestamp: expect.any(Date),
        },
      });

      expect(result).toEqual(expectedLog);
    });

    it('should log admin login activity', async () => {
      // Arrange
      const logData: CreateAdminLogData = {
        adminId: 'admin-123',
        action: 'ADMIN_LOGIN',
        targetType: 'USER',
        targetId: 'admin-123',
        details: {
          loginMethod: 'email_password',
          sessionId: 'session-abc123',
        },
        ipAddress: '203.0.113.1',
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X)',
      };

      const expectedLog = {
        id: 'log-login-123',
        ...logData,
        timestamp: new Date(),
      };

      mockPrisma.adminActivityLog.create.mockResolvedValue(expectedLog);

      // Act
      const result = await adminService.logAdminActivity(logData);

      // Assert
      expect(result).toEqual(expectedLog);
    });

    it('should handle logging errors gracefully', async () => {
      // Arrange
      const logData: CreateAdminLogData = {
        adminId: 'admin-123',
        action: 'USER_SUSPENDED',
        targetType: 'USER',
        targetId: 'user-456',
        details: { reason: 'Test' },
      };

      mockPrisma.adminActivityLog.create.mockRejectedValue(new Error('Database connection failed'));

      // Act & Assert
      await expect(adminService.logAdminActivity(logData)).rejects.toThrow('Failed to log admin activity');
    });

    it('should log activity without optional fields', async () => {
      // Arrange
      const logData: CreateAdminLogData = {
        adminId: 'admin-123',
        action: 'USER_ACTIVATED',
        targetType: 'USER',
        targetId: 'user-456',
        details: {},
        // No ipAddress or userAgent
      };

      const expectedLog = {
        id: 'log-minimal',
        ...logData,
        ipAddress: null,
        userAgent: null,
        timestamp: new Date(),
      };

      mockPrisma.adminActivityLog.create.mockResolvedValue(expectedLog);

      // Act
      const result = await adminService.logAdminActivity(logData);

      // Assert
      expect(mockPrisma.adminActivityLog.create).toHaveBeenCalledWith({
        data: {
          adminId: 'admin-123',
          action: 'USER_ACTIVATED',
          targetType: 'USER',
          targetId: 'user-456',
          details: {},
          ipAddress: undefined,
          userAgent: undefined,
          timestamp: expect.any(Date),
        },
      });

      expect(result).toEqual(expectedLog);
    });
  });

  describe('getActivityLogs', () => {
    it('should retrieve activity logs with pagination', async () => {
      // Arrange
      const mockLogs = [
        {
          id: 'log-1',
          adminId: 'admin-123',
          action: 'USER_SUSPENDED',
          targetType: 'USER',
          targetId: 'user-456',
          details: { reason: 'Terms violation' },
          ipAddress: '192.168.1.1',
          userAgent: 'Mozilla/5.0',
          timestamp: new Date('2024-01-15T10:30:00Z'),
          admin: {
            id: 'admin-123',
            firstName: 'John',
            lastName: 'Admin',
            email: 'admin@example.com',
          },
        },
        {
          id: 'log-2',
          adminId: 'admin-123',
          action: 'PROPERTY_APPROVED',
          targetType: 'PROPERTY',
          targetId: 'property-789',
          details: { propertyTitle: 'Nice apartment' },
          ipAddress: '192.168.1.1',
          userAgent: 'Mozilla/5.0',
          timestamp: new Date('2024-01-15T11:00:00Z'),
          admin: {
            id: 'admin-123',
            firstName: 'John',
            lastName: 'Admin',
            email: 'admin@example.com',
          },
        },
      ];

      mockPrisma.adminActivityLog.findMany.mockResolvedValue(mockLogs);
      mockPrisma.adminActivityLog.count.mockResolvedValue(2);

      // Act
      const result = await adminService.getActivityLogs(1, 10);

      // Assert
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

      expect(result).toEqual({
        logs: mockLogs,
        total: 2,
      });
    });

    it('should filter logs by admin ID', async () => {
      // Arrange
      const mockLogs = [
        {
          id: 'log-1',
          adminId: 'admin-456',
          action: 'DOCUMENT_APPROVED',
          targetType: 'DOCUMENT',
          targetId: 'doc-123',
          details: {},
          timestamp: new Date(),
          admin: {
            id: 'admin-456',
            firstName: 'Jane',
            lastName: 'Admin',
            email: 'jane@example.com',
          },
        },
      ];

      mockPrisma.adminActivityLog.findMany.mockResolvedValue(mockLogs);
      mockPrisma.adminActivityLog.count.mockResolvedValue(1);

      // Act
      const result = await adminService.getActivityLogs(1, 10, 'admin-456');

      // Assert
      expect(mockPrisma.adminActivityLog.findMany).toHaveBeenCalledWith({
        where: { adminId: 'admin-456' },
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

      expect(result.logs).toEqual(mockLogs);
    });

    it('should filter logs by action type', async () => {
      // Arrange
      mockPrisma.adminActivityLog.findMany.mockResolvedValue([]);
      mockPrisma.adminActivityLog.count.mockResolvedValue(0);

      // Act
      await adminService.getActivityLogs(1, 10, undefined, 'USER_SUSPENDED');

      // Assert
      expect(mockPrisma.adminActivityLog.findMany).toHaveBeenCalledWith({
        where: { action: 'USER_SUSPENDED' },
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

    it('should filter logs by target type', async () => {
      // Arrange
      mockPrisma.adminActivityLog.findMany.mockResolvedValue([]);
      mockPrisma.adminActivityLog.count.mockResolvedValue(0);

      // Act
      await adminService.getActivityLogs(1, 10, undefined, undefined, 'PROPERTY');

      // Assert
      expect(mockPrisma.adminActivityLog.findMany).toHaveBeenCalledWith({
        where: { targetType: 'PROPERTY' },
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

    it('should filter logs by multiple criteria', async () => {
      // Arrange
      mockPrisma.adminActivityLog.findMany.mockResolvedValue([]);
      mockPrisma.adminActivityLog.count.mockResolvedValue(0);

      // Act
      await adminService.getActivityLogs(2, 5, 'admin-123', 'PROPERTY_APPROVED', 'PROPERTY');

      // Assert
      expect(mockPrisma.adminActivityLog.findMany).toHaveBeenCalledWith({
        where: {
          adminId: 'admin-123',
          action: 'PROPERTY_APPROVED',
          targetType: 'PROPERTY',
        },
        skip: 5, // (page 2 - 1) * limit 5
        take: 5,
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

    it('should handle database errors when retrieving logs', async () => {
      // Arrange
      mockPrisma.adminActivityLog.findMany.mockRejectedValue(new Error('Database error'));

      // Act & Assert
      await expect(adminService.getActivityLogs()).rejects.toThrow('Failed to get activity logs');
    });

    it('should use default pagination values', async () => {
      // Arrange
      mockPrisma.adminActivityLog.findMany.mockResolvedValue([]);
      mockPrisma.adminActivityLog.count.mockResolvedValue(0);

      // Act
      await adminService.getActivityLogs();

      // Assert
      expect(mockPrisma.adminActivityLog.findMany).toHaveBeenCalledWith({
        where: {},
        skip: 0, // Default page 1
        take: 50, // Default limit
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
  });

  describe('audit trail integrity', () => {
    it('should ensure all admin actions are logged', async () => {
      // This test verifies that critical admin actions trigger audit logging
      const criticalActions: AdminAction[] = [
        'USER_SUSPENDED',
        'USER_ACTIVATED',
        'PROPERTY_APPROVED',
        'PROPERTY_REJECTED',
        'DOCUMENT_APPROVED',
        'DOCUMENT_REJECTED',
      ];

      for (const action of criticalActions) {
        // Arrange
        const logData: CreateAdminLogData = {
          adminId: 'admin-123',
          action,
          targetType: action.includes('USER') ? 'USER' : action.includes('PROPERTY') ? 'PROPERTY' : 'DOCUMENT',
          targetId: 'target-123',
          details: { test: true },
        };

        const expectedLog = { id: `log-${action}`, ...logData, timestamp: new Date() };
        mockPrisma.adminActivityLog.create.mockResolvedValue(expectedLog);

        // Act
        const result = await adminService.logAdminActivity(logData);

        // Assert
        expect(result.action).toBe(action);
        expect(mockPrisma.adminActivityLog.create).toHaveBeenCalledWith({
          data: expect.objectContaining({
            action,
            adminId: 'admin-123',
          }),
        });

        // Clear mock for next iteration
        mockPrisma.adminActivityLog.create.mockClear();
      }
    });

    it('should include sufficient detail for audit purposes', async () => {
      // Arrange
      const comprehensiveLogData: CreateAdminLogData = {
        adminId: 'admin-123',
        action: 'USER_SUSPENDED',
        targetType: 'USER',
        targetId: 'user-456',
        details: {
          reason: 'Multiple policy violations',
          violationType: 'spam',
          reportCount: 5,
          previousWarnings: 2,
          suspensionDuration: '30 days',
          reviewDate: '2024-02-15',
        },
        ipAddress: '192.168.1.100',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      };

      const expectedLog = {
        id: 'comprehensive-log',
        ...comprehensiveLogData,
        timestamp: new Date(),
      };

      mockPrisma.adminActivityLog.create.mockResolvedValue(expectedLog);

      // Act
      const result = await adminService.logAdminActivity(comprehensiveLogData);

      // Assert
      expect(result.details).toEqual({
        reason: 'Multiple policy violations',
        violationType: 'spam',
        reportCount: 5,
        previousWarnings: 2,
        suspensionDuration: '30 days',
        reviewDate: '2024-02-15',
      });

      expect(result.ipAddress).toBe('192.168.1.100');
      expect(result.userAgent).toBe('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
    });
  });
});