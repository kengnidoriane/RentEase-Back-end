import { PropertyService } from '../../services/property.service';
import { PropertyRepository } from '../../repositories/property.repository';
import { PrismaClient, UserType, VerificationStatus } from '@prisma/client';
import { AppError } from '../../utils/errors';
import { createPropertyData, createVerifiedPropertyData } from '../factories/propertyFactory';
import { createUserData } from '../factories/userFactory';

// Mock the repository
jest.mock('../../repositories/property.repository');
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

describe('PropertyService', () => {
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
      const landlord = createUserData({
        id: landlordId,
        userType: UserType.LANDLORD,
        isVerified: true,
      });
      const expectedProperty = createPropertyData({
        ...propertyData,
        landlordId,
      });

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
      const tenant = createUserData({
        id: landlordId,
        userType: UserType.TENANT,
        isVerified: true,
      });
      mockPrisma.user.findUnique = jest.fn().mockResolvedValue(tenant);

      // Act & Assert
      await expect(propertyService.createProperty(landlordId, propertyData))
        .rejects.toThrow(new AppError('Only landlords can create properties', 403));
    });

    it('should throw error if landlord is not verified', async () => {
      // Arrange
      const unverifiedLandlord = createUserData({
        id: landlordId,
        userType: UserType.LANDLORD,
        isVerified: false,
      });
      mockPrisma.user.findUnique = jest.fn().mockResolvedValue(unverifiedLandlord);

      // Act & Assert
      await expect(propertyService.createProperty(landlordId, propertyData))
        .rejects.toThrow(new AppError('Landlord must be verified to create properties', 403));
    });
  });

  describe('getPropertyById', () => {
    const propertyId = 'property-123';
    const landlordId = 'landlord-123';
    const userId = 'user-123';

    it('should return verified property for any user', async () => {
      // Arrange
      const verifiedProperty = createVerifiedPropertyData({
        id: propertyId,
        landlordId,
      });
      mockPropertyRepository.findById.mockResolvedValue(verifiedProperty as any);

      // Act
      const result = await propertyService.getPropertyById(propertyId, userId);

      // Assert
      expect(mockPropertyRepository.findById).toHaveBeenCalledWith(propertyId);
      expect(result).toEqual(verifiedProperty);
    });

    it('should return unverified property for landlord owner', async () => {
      // Arrange
      const unverifiedProperty = createPropertyData({
        id: propertyId,
        landlordId,
        isVerified: false,
      });
      const landlord = createUserData({
        id: landlordId,
        userType: UserType.LANDLORD,
      });

      mockPropertyRepository.findById.mockResolvedValue(unverifiedProperty as any);
      mockPrisma.user.findUnique = jest.fn().mockResolvedValue(landlord);

      // Act
      const result = await propertyService.getPropertyById(propertyId, landlordId);

      // Assert
      expect(result).toEqual(unverifiedProperty);
    });

    it('should return unverified property for admin', async () => {
      // Arrange
      const unverifiedProperty = createPropertyData({
        id: propertyId,
        landlordId,
        isVerified: false,
      });
      const admin = createUserData({
        id: userId,
        userType: UserType.ADMIN,
      });

      mockPropertyRepository.findById.mockResolvedValue(unverifiedProperty as any);
      mockPrisma.user.findUnique = jest.fn().mockResolvedValue(admin);

      // Act
      const result = await propertyService.getPropertyById(propertyId, userId);

      // Assert
      expect(result).toEqual(unverifiedProperty);
    });

    it('should throw error if property not found', async () => {
      // Arrange
      mockPropertyRepository.findById.mockResolvedValue(null);

      // Act & Assert
      await expect(propertyService.getPropertyById(propertyId, userId))
        .rejects.toThrow(new AppError('Property not found', 404));
    });

    it('should throw error if unverified property accessed by non-owner tenant', async () => {
      // Arrange
      const unverifiedProperty = createPropertyData({
        id: propertyId,
        landlordId,
        isVerified: false,
      });
      const tenant = createUserData({
        id: userId,
        userType: UserType.TENANT,
      });

      mockPropertyRepository.findById.mockResolvedValue(unverifiedProperty as any);
      mockPrisma.user.findUnique = jest.fn().mockResolvedValue(tenant);

      // Act & Assert
      await expect(propertyService.getPropertyById(propertyId, userId))
        .rejects.toThrow(new AppError('Property not found', 404));
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
      const properties = [createVerifiedPropertyData()];
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
      const properties = [createVerifiedPropertyData()];
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
      const properties = Array(10).fill(createVerifiedPropertyData());
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

  describe('updateProperty', () => {
    const propertyId = 'property-123';
    const landlordId = 'landlord-123';
    const updateData = {
      title: 'Updated Title',
      price: 1500,
    };

    it('should update property for owner', async () => {
      // Arrange
      const existingProperty = createPropertyData({
        id: propertyId,
        landlordId,
        isVerified: true,
      });
      const updatedProperty = { ...existingProperty, ...updateData };

      mockPropertyRepository.findById.mockResolvedValue(existingProperty as any);
      mockPropertyRepository.update.mockResolvedValue(updatedProperty as any);

      // Act
      const result = await propertyService.updateProperty(propertyId, landlordId, updateData);

      // Assert
      expect(mockPropertyRepository.findById).toHaveBeenCalledWith(propertyId, true);
      expect(mockPropertyRepository.update).toHaveBeenCalledWith(propertyId, {
        ...updateData,
        verificationStatus: 'PENDING',
        isVerified: false,
        rejectionReason: null,
      });
      expect(result).toEqual(updatedProperty);
    });

    it('should not reset verification for non-critical updates', async () => {
      // Arrange
      const existingProperty = createPropertyData({
        id: propertyId,
        landlordId,
        isVerified: true,
      });
      const nonCriticalUpdate = { isActive: false };
      const updatedProperty = { ...existingProperty, ...nonCriticalUpdate };

      mockPropertyRepository.findById.mockResolvedValue(existingProperty as any);
      mockPropertyRepository.update.mockResolvedValue(updatedProperty as any);

      // Act
      const result = await propertyService.updateProperty(propertyId, landlordId, nonCriticalUpdate);

      // Assert
      expect(mockPropertyRepository.update).toHaveBeenCalledWith(propertyId, nonCriticalUpdate);
      expect(result).toEqual(updatedProperty);
    });

    it('should throw error if property not found', async () => {
      // Arrange
      mockPropertyRepository.findById.mockResolvedValue(null);

      // Act & Assert
      await expect(propertyService.updateProperty(propertyId, landlordId, updateData))
        .rejects.toThrow(new AppError('Property not found', 404));
    });

    it('should throw error if user is not the owner', async () => {
      // Arrange
      const existingProperty = createPropertyData({
        id: propertyId,
        landlordId: 'different-landlord',
      });
      mockPropertyRepository.findById.mockResolvedValue(existingProperty as any);

      // Act & Assert
      await expect(propertyService.updateProperty(propertyId, landlordId, updateData))
        .rejects.toThrow(new AppError('Access denied', 403));
    });
  });

  describe('verifyProperty', () => {
    const adminId = 'admin-123';
    const propertyId = 'property-123';

    it('should approve property by admin', async () => {
      // Arrange
      const admin = createUserData({
        id: adminId,
        userType: UserType.ADMIN,
      });
      const property = createPropertyData({ id: propertyId });
      const verificationRequest = {
        propertyId,
        status: 'APPROVED' as const,
      };
      const approvedProperty = createVerifiedPropertyData({ id: propertyId });

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

    it('should reject property with reason', async () => {
      // Arrange
      const admin = createUserData({
        id: adminId,
        userType: UserType.ADMIN,
      });
      const property = createPropertyData({ id: propertyId });
      const verificationRequest = {
        propertyId,
        status: 'REJECTED' as const,
        rejectionReason: 'Incomplete information',
      };
      const rejectedProperty = createPropertyData({
        id: propertyId,
        verificationStatus: VerificationStatus.REJECTED,
        rejectionReason: 'Incomplete information',
      });

      mockPrisma.user.findUnique = jest.fn().mockResolvedValue(admin);
      mockPropertyRepository.findById.mockResolvedValue(property as any);
      mockPropertyRepository.updateVerificationStatus.mockResolvedValue(rejectedProperty as any);

      // Act
      const result = await propertyService.verifyProperty(adminId, verificationRequest);

      // Assert
      expect(mockPropertyRepository.updateVerificationStatus).toHaveBeenCalledWith(
        propertyId,
        VerificationStatus.REJECTED,
        'Incomplete information'
      );
      expect(result).toEqual(rejectedProperty);
    });

    it('should throw error if user is not admin', async () => {
      // Arrange
      const landlord = createUserData({
        id: adminId,
        userType: UserType.LANDLORD,
      });
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

  describe('addPropertyImages', () => {
    const propertyId = 'property-123';
    const landlordId = 'landlord-123';
    const images = [
      { url: 'https://example.com/image1.jpg', altText: 'Living room' },
      { url: 'https://example.com/image2.jpg', altText: 'Kitchen' },
    ];

    it('should add images to property', async () => {
      // Arrange
      const property = createPropertyData({
        id: propertyId,
        landlordId,
      });
      const updatedProperty = { ...property, images };

      mockPropertyRepository.findById.mockResolvedValueOnce(property as any);
      mockPrisma.propertyImage.findMany = jest.fn().mockResolvedValue([]);
      mockPrisma.propertyImage.createMany = jest.fn().mockResolvedValue({ count: 2 });
      mockPropertyRepository.findById.mockResolvedValueOnce(updatedProperty as any);

      // Act
      const result = await propertyService.addPropertyImages(propertyId, landlordId, images);

      // Assert
      expect(mockPrisma.propertyImage.createMany).toHaveBeenCalledWith({
        data: [
          { ...images[0], propertyId, order: 1 },
          { ...images[1], propertyId, order: 2 },
        ],
      });
      expect(result).toEqual(updatedProperty);
    });

    it('should throw error if property not found', async () => {
      // Arrange
      mockPropertyRepository.findById.mockResolvedValue(null);

      // Act & Assert
      await expect(propertyService.addPropertyImages(propertyId, landlordId, images))
        .rejects.toThrow(new AppError('Property not found', 404));
    });

    it('should throw error if user is not the owner', async () => {
      // Arrange
      const property = createPropertyData({
        id: propertyId,
        landlordId: 'different-landlord',
      });
      mockPropertyRepository.findById.mockResolvedValue(property as any);

      // Act & Assert
      await expect(propertyService.addPropertyImages(propertyId, landlordId, images))
        .rejects.toThrow(new AppError('Access denied', 403));
    });
  });

  describe('removePropertyImage', () => {
    const propertyId = 'property-123';
    const imageId = 'image-123';
    const landlordId = 'landlord-123';

    it('should remove image from property', async () => {
      // Arrange
      const property = createPropertyData({
        id: propertyId,
        landlordId,
      });
      const image = {
        id: imageId,
        propertyId,
        url: 'https://example.com/image.jpg',
        altText: 'Test image',
        order: 1,
      };

      mockPropertyRepository.findById.mockResolvedValue(property as any);
      mockPrisma.propertyImage.findFirst = jest.fn().mockResolvedValue(image);
      mockPrisma.propertyImage.delete = jest.fn().mockResolvedValue(image);

      // Act
      await propertyService.removePropertyImage(propertyId, imageId, landlordId);

      // Assert
      expect(mockPrisma.propertyImage.delete).toHaveBeenCalledWith({
        where: { id: imageId },
      });
    });

    it('should throw error if image not found', async () => {
      // Arrange
      const property = createPropertyData({
        id: propertyId,
        landlordId,
      });

      mockPropertyRepository.findById.mockResolvedValue(property as any);
      mockPrisma.propertyImage.findFirst = jest.fn().mockResolvedValue(null);

      // Act & Assert
      await expect(propertyService.removePropertyImage(propertyId, imageId, landlordId))
        .rejects.toThrow(new AppError('Image not found', 404));
    });
  });
});