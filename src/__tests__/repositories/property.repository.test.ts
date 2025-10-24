import { PropertyRepository } from '../../repositories/property.repository';
import { PrismaClient, PropertyType, VerificationStatus } from '@prisma/client';
import { createPropertyData } from '../factories/propertyFactory';

// Mock Prisma
const mockPrisma = {
  property: {
    create: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
    groupBy: jest.fn(),
  },
} as unknown as PrismaClient;

describe('PropertyRepository', () => {
  let propertyRepository: PropertyRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    propertyRepository = new PropertyRepository(mockPrisma);
  });

  describe('create', () => {
    it('should create property with relations', async () => {
      // Arrange
      const propertyData = {
        title: 'Test Property',
        description: 'Test description',
        price: 1200,
        landlord: { connect: { id: 'landlord-123' } },
      };
      const expectedProperty = createPropertyData();

      mockPrisma.property.create = jest.fn().mockResolvedValue(expectedProperty);

      // Act
      const result = await propertyRepository.create(propertyData as any);

      // Assert
      expect(mockPrisma.property.create).toHaveBeenCalledWith({
        data: propertyData,
        include: {
          landlord: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              profilePicture: true,
              isVerified: true,
            },
          },
          images: {
            orderBy: { order: 'asc' },
          },
          _count: {
            select: { favorites: true },
          },
        },
      });
      expect(result).toEqual(expectedProperty);
    });
  });

  describe('findById', () => {
    it('should find property by id with active filter', async () => {
      // Arrange
      const propertyId = 'property-123';
      const expectedProperty = createPropertyData({ id: propertyId });

      mockPrisma.property.findFirst = jest.fn().mockResolvedValue(expectedProperty);

      // Act
      const result = await propertyRepository.findById(propertyId);

      // Assert
      expect(mockPrisma.property.findFirst).toHaveBeenCalledWith({
        where: { id: propertyId, isActive: true },
        include: {
          landlord: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              profilePicture: true,
              isVerified: true,
            },
          },
          images: {
            orderBy: { order: 'asc' },
          },
          _count: {
            select: { favorites: true },
          },
        },
      });
      expect(result).toEqual(expectedProperty);
    });

    it('should find property by id including inactive when specified', async () => {
      // Arrange
      const propertyId = 'property-123';
      const expectedProperty = createPropertyData({ id: propertyId });

      mockPrisma.property.findFirst = jest.fn().mockResolvedValue(expectedProperty);

      // Act
      const result = await propertyRepository.findById(propertyId, true);

      // Assert
      expect(mockPrisma.property.findFirst).toHaveBeenCalledWith({
        where: { id: propertyId },
        include: expect.any(Object),
      });
      expect(result).toEqual(expectedProperty);
    });
  });

  describe('search', () => {
    it('should search properties with basic query', async () => {
      // Arrange
      const query = {
        search: 'apartment',
        page: 1,
        limit: 20,
      };
      const properties = [createPropertyData()];
      const total = 1;

      mockPrisma.property.findMany = jest.fn().mockResolvedValue(properties);
      mockPrisma.property.count = jest.fn().mockResolvedValue(total);

      // Act
      const result = await propertyRepository.search(query);

      // Assert
      expect(mockPrisma.property.findMany).toHaveBeenCalledWith({
        where: {
          isActive: true,
          isVerified: true,
          OR: [
            { title: { contains: 'apartment', mode: 'insensitive' } },
            { description: { contains: 'apartment', mode: 'insensitive' } },
            { address: { contains: 'apartment', mode: 'insensitive' } },
            { city: { contains: 'apartment', mode: 'insensitive' } },
          ],
        },
        include: expect.any(Object),
        orderBy: { createdAt: 'desc' },
        skip: 0,
        take: 20,
      });
      expect(mockPrisma.property.count).toHaveBeenCalledWith({
        where: expect.objectContaining({
          isActive: true,
          isVerified: true,
        }),
      });
      expect(result).toEqual({ properties, total });
    });

    it('should search properties with city filter', async () => {
      // Arrange
      const query = {
        filters: { city: 'Paris' },
        page: 1,
        limit: 20,
      };
      const properties = [createPropertyData()];
      const total = 1;

      mockPrisma.property.findMany = jest.fn().mockResolvedValue(properties);
      mockPrisma.property.count = jest.fn().mockResolvedValue(total);

      // Act
      const result = await propertyRepository.search(query);

      // Assert
      expect(mockPrisma.property.findMany).toHaveBeenCalledWith({
        where: {
          isActive: true,
          isVerified: true,
          city: { contains: 'Paris', mode: 'insensitive' },
        },
        include: expect.any(Object),
        orderBy: { createdAt: 'desc' },
        skip: 0,
        take: 20,
      });
      expect(result).toEqual({ properties, total });
    });

    it('should search properties with price range filter', async () => {
      // Arrange
      const query = {
        filters: { minPrice: 800, maxPrice: 1500 },
        page: 1,
        limit: 20,
      };
      const properties = [createPropertyData()];
      const total = 1;

      mockPrisma.property.findMany = jest.fn().mockResolvedValue(properties);
      mockPrisma.property.count = jest.fn().mockResolvedValue(total);

      // Act
      const result = await propertyRepository.search(query);

      // Assert
      expect(mockPrisma.property.findMany).toHaveBeenCalledWith({
        where: {
          isActive: true,
          isVerified: true,
          price: { gte: 800, lte: 1500 },
        },
        include: expect.any(Object),
        orderBy: { createdAt: 'desc' },
        skip: 0,
        take: 20,
      });
      expect(result).toEqual({ properties, total });
    });

    it('should search properties with property type filter', async () => {
      // Arrange
      const query = {
        filters: { propertyType: 'APARTMENT' as const },
        page: 1,
        limit: 20,
      };
      const properties = [createPropertyData()];
      const total = 1;

      mockPrisma.property.findMany = jest.fn().mockResolvedValue(properties);
      mockPrisma.property.count = jest.fn().mockResolvedValue(total);

      // Act
      const result = await propertyRepository.search(query);

      // Assert
      expect(mockPrisma.property.findMany).toHaveBeenCalledWith({
        where: {
          isActive: true,
          isVerified: true,
          propertyType: PropertyType.APARTMENT,
        },
        include: expect.any(Object),
        orderBy: { createdAt: 'desc' },
        skip: 0,
        take: 20,
      });
      expect(result).toEqual({ properties, total });
    });

    it('should search properties with bedrooms and bathrooms filter', async () => {
      // Arrange
      const query = {
        filters: { bedrooms: 2, bathrooms: 1 },
        page: 1,
        limit: 20,
      };
      const properties = [createPropertyData()];
      const total = 1;

      mockPrisma.property.findMany = jest.fn().mockResolvedValue(properties);
      mockPrisma.property.count = jest.fn().mockResolvedValue(total);

      // Act
      const result = await propertyRepository.search(query);

      // Assert
      expect(mockPrisma.property.findMany).toHaveBeenCalledWith({
        where: {
          isActive: true,
          isVerified: true,
          bedrooms: 2,
          bathrooms: 1,
        },
        include: expect.any(Object),
        orderBy: { createdAt: 'desc' },
        skip: 0,
        take: 20,
      });
      expect(result).toEqual({ properties, total });
    });

    it('should search properties with area range filter', async () => {
      // Arrange
      const query = {
        filters: { minArea: 50, maxArea: 100 },
        page: 1,
        limit: 20,
      };
      const properties = [createPropertyData()];
      const total = 1;

      mockPrisma.property.findMany = jest.fn().mockResolvedValue(properties);
      mockPrisma.property.count = jest.fn().mockResolvedValue(total);

      // Act
      const result = await propertyRepository.search(query);

      // Assert
      expect(mockPrisma.property.findMany).toHaveBeenCalledWith({
        where: {
          isActive: true,
          isVerified: true,
          area: { gte: 50, lte: 100 },
        },
        include: expect.any(Object),
        orderBy: { createdAt: 'desc' },
        skip: 0,
        take: 20,
      });
      expect(result).toEqual({ properties, total });
    });

    it('should sort properties by price ascending', async () => {
      // Arrange
      const query = {
        sortBy: 'price' as const,
        sortOrder: 'asc' as const,
        page: 1,
        limit: 20,
      };
      const properties = [createPropertyData()];
      const total = 1;

      mockPrisma.property.findMany = jest.fn().mockResolvedValue(properties);
      mockPrisma.property.count = jest.fn().mockResolvedValue(total);

      // Act
      const result = await propertyRepository.search(query);

      // Assert
      expect(mockPrisma.property.findMany).toHaveBeenCalledWith({
        where: {
          isActive: true,
          isVerified: true,
        },
        include: expect.any(Object),
        orderBy: { price: 'asc' },
        skip: 0,
        take: 20,
      });
      expect(result).toEqual({ properties, total });
    });

    it('should handle pagination correctly', async () => {
      // Arrange
      const query = {
        page: 3,
        limit: 10,
      };
      const properties = [createPropertyData()];
      const total = 25;

      mockPrisma.property.findMany = jest.fn().mockResolvedValue(properties);
      mockPrisma.property.count = jest.fn().mockResolvedValue(total);

      // Act
      const result = await propertyRepository.search(query);

      // Assert
      expect(mockPrisma.property.findMany).toHaveBeenCalledWith({
        where: {
          isActive: true,
          isVerified: true,
        },
        include: expect.any(Object),
        orderBy: { createdAt: 'desc' },
        skip: 20, // (page - 1) * limit = (3 - 1) * 10 = 20
        take: 10,
      });
      expect(result).toEqual({ properties, total });
    });

    it('should search unverified properties when specified', async () => {
      // Arrange
      const query = {
        filters: { isVerified: false },
        page: 1,
        limit: 20,
      };
      const properties = [createPropertyData()];
      const total = 1;

      mockPrisma.property.findMany = jest.fn().mockResolvedValue(properties);
      mockPrisma.property.count = jest.fn().mockResolvedValue(total);

      // Act
      const result = await propertyRepository.search(query);

      // Assert
      expect(mockPrisma.property.findMany).toHaveBeenCalledWith({
        where: {
          isActive: true,
          isVerified: false,
        },
        include: expect.any(Object),
        orderBy: { createdAt: 'desc' },
        skip: 0,
        take: 20,
      });
      expect(result).toEqual({ properties, total });
    });
  });

  describe('searchByLocation', () => {
    it('should search properties by location with radius', async () => {
      // Arrange
      const latitude = 48.8566;
      const longitude = 2.3522;
      const radius = 5; // 5km
      const filters = { minPrice: 800 };
      const page = 1;
      const limit = 20;
      const properties = [createPropertyData()];
      const total = 1;

      mockPrisma.property.findMany = jest.fn().mockResolvedValue(properties);
      mockPrisma.property.count = jest.fn().mockResolvedValue(total);

      // Act
      const result = await propertyRepository.searchByLocation(
        latitude,
        longitude,
        radius,
        filters,
        page,
        limit
      );

      // Assert
      const radiusInDegrees = radius / 111; // Approximate conversion
      expect(mockPrisma.property.findMany).toHaveBeenCalledWith({
        where: {
          isActive: true,
          isVerified: true,
          latitude: {
            gte: latitude - radiusInDegrees,
            lte: latitude + radiusInDegrees,
          },
          longitude: {
            gte: longitude - radiusInDegrees,
            lte: longitude + radiusInDegrees,
          },
          price: { gte: 800 },
        },
        include: expect.any(Object),
        orderBy: { createdAt: 'desc' },
        skip: 0,
        take: 20,
      });
      expect(result).toEqual({ properties, total });
    });

    it('should search properties by location with additional filters', async () => {
      // Arrange
      const latitude = 48.8566;
      const longitude = 2.3522;
      const radius = 10;
      const filters = {
        propertyType: 'APARTMENT' as const,
        bedrooms: 2,
        bathrooms: 1,
        maxPrice: 1500,
      };
      const properties = [createPropertyData()];
      const total = 1;

      mockPrisma.property.findMany = jest.fn().mockResolvedValue(properties);
      mockPrisma.property.count = jest.fn().mockResolvedValue(total);

      // Act
      const result = await propertyRepository.searchByLocation(
        latitude,
        longitude,
        radius,
        filters
      );

      // Assert
      const radiusInDegrees = radius / 111;
      expect(mockPrisma.property.findMany).toHaveBeenCalledWith({
        where: {
          isActive: true,
          isVerified: true,
          latitude: {
            gte: latitude - radiusInDegrees,
            lte: latitude + radiusInDegrees,
          },
          longitude: {
            gte: longitude - radiusInDegrees,
            lte: longitude + radiusInDegrees,
          },
          price: { lte: 1500 },
          propertyType: PropertyType.APARTMENT,
          bedrooms: 2,
          bathrooms: 1,
        },
        include: expect.any(Object),
        orderBy: { createdAt: 'desc' },
        skip: 0,
        take: 20,
      });
      expect(result).toEqual({ properties, total });
    });
  });

  describe('getStats', () => {
    it('should return property statistics', async () => {
      // Arrange
      const totalProperties = 100;
      const verifiedProperties = 80;
      const pendingProperties = 15;
      const rejectedProperties = 5;
      const propertiesByType = [
        { propertyType: PropertyType.APARTMENT, _count: { id: 60 } },
        { propertyType: PropertyType.HOUSE, _count: { id: 25 } },
        { propertyType: PropertyType.STUDIO, _count: { id: 15 } },
      ];
      const propertiesByCity = [
        { city: 'Paris', _count: { id: 50 } },
        { city: 'Lyon', _count: { id: 30 } },
        { city: 'Marseille', _count: { id: 20 } },
      ];

      mockPrisma.property.count = jest.fn()
        .mockResolvedValueOnce(totalProperties)
        .mockResolvedValueOnce(verifiedProperties)
        .mockResolvedValueOnce(pendingProperties)
        .mockResolvedValueOnce(rejectedProperties);

      mockPrisma.property.groupBy = jest.fn()
        .mockResolvedValueOnce(propertiesByType)
        .mockResolvedValueOnce(propertiesByCity);

      // Act
      const result = await propertyRepository.getStats();

      // Assert
      expect(mockPrisma.property.count).toHaveBeenCalledTimes(4);
      expect(mockPrisma.property.count).toHaveBeenNthCalledWith(1, {
        where: { isActive: true },
      });
      expect(mockPrisma.property.count).toHaveBeenNthCalledWith(2, {
        where: { isActive: true, isVerified: true },
      });
      expect(mockPrisma.property.count).toHaveBeenNthCalledWith(3, {
        where: { isActive: true, verificationStatus: 'PENDING' },
      });
      expect(mockPrisma.property.count).toHaveBeenNthCalledWith(4, {
        where: { isActive: true, verificationStatus: 'REJECTED' },
      });

      expect(mockPrisma.property.groupBy).toHaveBeenCalledTimes(2);
      expect(mockPrisma.property.groupBy).toHaveBeenNthCalledWith(1, {
        by: ['propertyType'],
        where: { isActive: true },
        _count: { id: true },
      });
      expect(mockPrisma.property.groupBy).toHaveBeenNthCalledWith(2, {
        by: ['city'],
        where: { isActive: true },
        _count: { id: true },
      });

      expect(result).toEqual({
        totalProperties,
        verifiedProperties,
        pendingProperties,
        rejectedProperties,
        propertiesByType: {
          APARTMENT: 60,
          HOUSE: 25,
          STUDIO: 15,
        },
        propertiesByCity: {
          Paris: 50,
          Lyon: 30,
          Marseille: 20,
        },
      });
    });
  });

  describe('updateVerificationStatus', () => {
    it('should approve property', async () => {
      // Arrange
      const propertyId = 'property-123';
      const status = VerificationStatus.APPROVED;
      const updatedProperty = createPropertyData({
        id: propertyId,
        verificationStatus: status,
        isVerified: true,
      });

      mockPrisma.property.update = jest.fn().mockResolvedValue(updatedProperty);

      // Act
      const result = await propertyRepository.updateVerificationStatus(propertyId, status);

      // Assert
      expect(mockPrisma.property.update).toHaveBeenCalledWith({
        where: { id: propertyId },
        data: {
          verificationStatus: status,
          isVerified: true,
          rejectionReason: null,
        },
        include: expect.any(Object),
      });
      expect(result).toEqual(updatedProperty);
    });

    it('should reject property with reason', async () => {
      // Arrange
      const propertyId = 'property-123';
      const status = VerificationStatus.REJECTED;
      const rejectionReason = 'Incomplete information';
      const updatedProperty = createPropertyData({
        id: propertyId,
        verificationStatus: status,
        isVerified: false,
        rejectionReason,
      });

      mockPrisma.property.update = jest.fn().mockResolvedValue(updatedProperty);

      // Act
      const result = await propertyRepository.updateVerificationStatus(
        propertyId,
        status,
        rejectionReason
      );

      // Assert
      expect(mockPrisma.property.update).toHaveBeenCalledWith({
        where: { id: propertyId },
        data: {
          verificationStatus: status,
          isVerified: false,
          rejectionReason,
        },
        include: expect.any(Object),
      });
      expect(result).toEqual(updatedProperty);
    });
  });
});