import { PropertyRepository } from '../repositories/property.repository';
import { PrismaClient, PropertyType } from '@prisma/client';

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

describe('PropertyRepository - Search and Filtering Tests', () => {
  let propertyRepository: PropertyRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    propertyRepository = new PropertyRepository(mockPrisma);
  });

  describe('search', () => {
    it('should search properties with text query', async () => {
      // Arrange
      const query = {
        search: 'apartment',
        page: 1,
        limit: 20,
      };
      const properties = [{
        id: 'property-123',
        title: 'Beautiful Apartment',
        description: 'A lovely apartment',
        price: 1200,
        currency: 'EUR',
        propertyType: PropertyType.APARTMENT,
        bedrooms: 2,
        bathrooms: 1,
        area: 75,
        address: '123 Main Street',
        city: 'Paris',
        latitude: 48.8566,
        longitude: 2.3522,
        landlordId: 'landlord-123',
        isVerified: true,
        isActive: true,
        verificationStatus: 'APPROVED',
        rejectionReason: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }];
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
      expect(result).toEqual({ properties, total });
    });

    it('should filter properties by city', async () => {
      // Arrange
      const query = {
        filters: { city: 'Paris' },
        page: 1,
        limit: 20,
      };
      const properties: any[] = [];
      const total = 0;

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

    it('should filter properties by price range', async () => {
      // Arrange
      const query = {
        filters: { minPrice: 800, maxPrice: 1500 },
        page: 1,
        limit: 20,
      };
      const properties: any[] = [];
      const total = 0;

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

    it('should filter properties by property type', async () => {
      // Arrange
      const query = {
        filters: { propertyType: 'APARTMENT' as const },
        page: 1,
        limit: 20,
      };
      const properties: any[] = [];
      const total = 0;

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

    it('should sort properties by price ascending', async () => {
      // Arrange
      const query = {
        sortBy: 'price' as const,
        sortOrder: 'asc' as const,
        page: 1,
        limit: 20,
      };
      const properties: any[] = [];
      const total = 0;

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
      const properties: any[] = [];
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
      const properties: any[] = [];
      const total = 0;

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
  });
});