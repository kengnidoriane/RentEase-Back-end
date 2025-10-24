import { PropertyService } from '../services/property.service';
import { PropertyRepository } from '../repositories/property.repository';
import { PrismaClient, UserType, VerificationStatus } from '@prisma/client';
import { AppError } from '../utils/errors';

// Mock the repository
jest.mock('../repositories/property.repository');
const MockedPropertyRepository = PropertyRepository as jest.MockedClass<typeof PropertyRepository>;

// Mock Prisma
const mockPrisma = {
  user: {
    findUnique: jest.fn(),
  },
  propertyImage: {
    findMany: jest.fn(),
    createMany: jest.fn(),
    findFirst: jest.fn(),
    delete: jest.fn(),
  },
} as unknown as PrismaClient;

describe('PropertyService - Simple Tests', () => {
  let propertyService: PropertyService;
  let mockPropertyRepository: jest.Mocked<PropertyRepository>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockPropertyRepository = new MockedPropertyRepository(mockPrisma) as jest.Mocked<PropertyRepository>;
    propertyService = new PropertyService(mockPrisma);
    // Replace the repository instance with our mock
    (propertyService as any).propertyRepository = mockPropertyRepository;
  });

  describe('createProperty', () => {
    const landlordId = 'landlord-123';
    const propertyData = {
      title: 'Test Property',
      description: 'A beautiful test property',
      price: 1200,
      propertyType: 'APARTMENT' as const,
      bedrooms: 2,
      bathrooms: 1,
      area: 75,
      address: '123 Test Street',
      city: 'Paris',
      latitude: 48.8566,
      longitude: 2.3522,
    };

    it('should create property for verified landlord', async () => {
      // Arrange
      const landlord = {
        id: landlordId,
        email: 'landlord@example.com',
        password: 'hashedpassword',
        firstName: 'John',
        lastName: 'Doe',
        phone: '+1234567890',
        userType: UserType.LANDLORD,
        profilePicture: null,
        isVerified: true,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      
      const expectedProperty = {
        id: 'property-123',
        ...propertyData,
        landlordId,
        isVerified: false,
        verificationStatus: VerificationStatus.PENDING,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.user.findUnique = jest.fn().mockResolvedValue(landlord);
      mockPropertyRepository.create.mockResolvedValue(expectedProperty as any);

      // Act
      const result = await propertyService.createProperty(landlordId, propertyData);

      // Assert
      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: landlordId },
      });
      expect(mockPropertyRepository.create).toHaveBeenCalledWith({
        ...propertyData,
        landlord: { connect: { id: landlordId } },
        verificationStatus: 'PENDING',
        isVerified: false,
      });
      expect(result).toEqual(expectedProperty);
    });

    it('should throw error if landlord not found', async () => {
      // Arrange
      mockPrisma.user.findUnique = jest.fn().mockResolvedValue(null);

      // Act & Assert
      await expect(propertyService.createProperty(landlordId, propertyData))
        .rejects.toThrow(new AppError('Landlord not found', 404));
    });

    it('should throw error if user is not a landlord', async () => {
      // Arrange
      const tenant = {
        id: landlordId,
        email: 'tenant@example.com',
        password: 'hashedpassword',
        firstName: 'Jane',
        lastName: 'Doe',
        phone: '+1234567890',
        userType: UserType.TENANT,
        profilePicture: null,
        isVerified: true,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockPrisma.user.findUnique = jest.fn().mockResolvedValue(tenant);

      // Act & Assert
      await expect(propertyService.createProperty(landlordId, propertyData))
        .rejects.toThrow(new AppError('Only landlords can create properties', 403));
    });

    it('should throw error if landlord is not verified', async () => {
      // Arrange
      const unverifiedLandlord = {
        id: landlordId,
        email: 'landlord@example.com',
        password: 'hashedpassword',
        firstName: 'John',
        lastName: 'Doe',
        phone: '+1234567890',
        userType: UserType.LANDLORD,
        profilePicture: null,
        isVerified: false,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockPrisma.user.findUnique = jest.fn().mockResolvedValue(unverifiedLandlord);

      // Act & Assert
      await expect(propertyService.createProperty(landlordId, propertyData))
        .rejects.toThrow(new AppError('Landlord must be verified to create properties', 403));
    });
  });

  describe('searchProperties', () => {
    it('should search properties with basic query', async () => {
      // Arrange
      const query = {
        search: 'apartment',
        page: 1,
        limit: 20,
      };
      const properties = [{
        id: 'property-123',
        title: 'Test Apartment',
        description: 'A nice apartment',
        price: 1200,
        currency: 'EUR',
        propertyType: 'APARTMENT',
        bedrooms: 2,
        bathrooms: 1,
        area: 75,
        address: '123 Test Street',
        city: 'Paris',
        latitude: 48.8566,
        longitude: 2.3522,
        landlordId: 'landlord-123',
        isVerified: true,
        isActive: true,
        verificationStatus: VerificationStatus.APPROVED,
        rejectionReason: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }];
      const total = 1;

      mockPropertyRepository.search.mockResolvedValue({
        properties: properties as any,
        total,
      });

      // Act
      const result = await propertyService.searchProperties(query);

      // Assert
      expect(mockPropertyRepository.search).toHaveBeenCalledWith(query);
      expect(result).toEqual({
        properties,
        pagination: {
          page: 1,
          limit: 20,
          total: 1,
          totalPages: 1,
        },
      });
    });

    it('should search properties by location', async () => {
      // Arrange
      const query = {
        filters: {
          latitude: 48.8566,
          longitude: 2.3522,
          radius: 5,
        },
        page: 1,
        limit: 20,
      };
      const properties = [{
        id: 'property-123',
        title: 'Test Property',
        description: 'A nice property',
        price: 1200,
        currency: 'EUR',
        propertyType: 'APARTMENT',
        bedrooms: 2,
        bathrooms: 1,
        area: 75,
        address: '123 Test Street',
        city: 'Paris',
        latitude: 48.8566,
        longitude: 2.3522,
        landlordId: 'landlord-123',
        isVerified: true,
        isActive: true,
        verificationStatus: VerificationStatus.APPROVED,
        rejectionReason: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }];
      const total = 1;

      mockPropertyRepository.searchByLocation.mockResolvedValue({
        properties: properties as any,
        total,
      });

      // Act
      const result = await propertyService.searchProperties(query);

      // Assert
      expect(mockPropertyRepository.searchByLocation).toHaveBeenCalledWith(
        48.8566,
        2.3522,
        5,
        query.filters,
        1,
        20
      );
      expect(result).toEqual({
        properties,
        pagination: {
          page: 1,
          limit: 20,
          total: 1,
          totalPages: 1,
        },
      });
    });

    it('should calculate correct pagination', async () => {
      // Arrange
      const query = { page: 2, limit: 10 };
      const properties = Array(10).fill({
        id: 'property-123',
        title: 'Test Property',
        description: 'A nice property',
        price: 1200,
        currency: 'EUR',
        propertyType: 'APARTMENT',
        bedrooms: 2,
        bathrooms: 1,
        area: 75,
        address: '123 Test Street',
        city: 'Paris',
        latitude: 48.8566,
        longitude: 2.3522,
        landlordId: 'landlord-123',
        isVerified: true,
        isActive: true,
        verificationStatus: VerificationStatus.APPROVED,
        rejectionReason: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      const total = 25;

      mockPropertyRepository.search.mockResolvedValue({
        properties: properties as any,
        total,
      });

      // Act
      const result = await propertyService.searchProperties(query);

      // Assert
      expect(result.pagination).toEqual({
        page: 2,
        limit: 10,
        total: 25,
        totalPages: 3,
      });
    });
  });

  describe('verifyProperty', () => {
    const adminId = 'admin-123';
    const propertyId = 'property-123';

    it('should approve property by admin', async () => {
      // Arrange
      const admin = {
        id: adminId,
        email: 'admin@example.com',
        password: 'hashedpassword',
        firstName: 'Admin',
        lastName: 'User',
        phone: '+1234567890',
        userType: UserType.ADMIN,
        profilePicture: null,
        isVerified: true,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      
      const property = {
        id: propertyId,
        title: 'Test Property',
        description: 'A nice property',
        price: 1200,
        currency: 'EUR',
        propertyType: 'APARTMENT',
        bedrooms: 2,
        bathrooms: 1,
        area: 75,
        address: '123 Test Street',
        city: 'Paris',
        latitude: 48.8566,
        longitude: 2.3522,
        landlordId: 'landlord-123',
        isVerified: false,
        isActive: true,
        verificationStatus: VerificationStatus.PENDING,
        rejectionReason: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      
      const verificationRequest = {
        propertyId,
        status: 'APPROVED' as const,
      };
      
      const approvedProperty = {
        ...property,
        isVerified: true,
        verificationStatus: VerificationStatus.APPROVED,
      };

      mockPrisma.user.findUnique = jest.fn().mockResolvedValue(admin);
      mockPropertyRepository.findById.mockResolvedValue(property as any);
      mockPropertyRepository.updateVerificationStatus.mockResolvedValue(approvedProperty as any);

      // Act
      const result = await propertyService.verifyProperty(adminId, verificationRequest);

      // Assert
      expect(mockPropertyRepository.updateVerificationStatus).toHaveBeenCalledWith(
        propertyId,
        VerificationStatus.APPROVED,
        undefined
      );
      expect(result).toEqual(approvedProperty);
    });

    it('should throw error if user is not admin', async () => {
      // Arrange
      const landlord = {
        id: adminId,
        email: 'landlord@example.com',
        password: 'hashedpassword',
        firstName: 'John',
        lastName: 'Doe',
        phone: '+1234567890',
        userType: UserType.LANDLORD,
        profilePicture: null,
        isVerified: true,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      const verificationRequest = {
        propertyId,
        status: 'APPROVED' as const,
      };

      mockPrisma.user.findUnique = jest.fn().mockResolvedValue(landlord);

      // Act & Assert
      await expect(propertyService.verifyProperty(adminId, verificationRequest))
        .rejects.toThrow(new AppError('Access denied', 403));
    });
  });
});