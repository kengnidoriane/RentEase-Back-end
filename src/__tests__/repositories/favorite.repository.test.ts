import { FavoriteRepository } from '../../repositories/favorite.repository';
import { PrismaClient } from '@prisma/client';
import { CreateFavoriteRequest } from '../../types/favorite.types';

// Mock Prisma Client
const mockPrisma = {
  favorite: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    delete: jest.fn(),
  },
} as unknown as jest.Mocked<PrismaClient>;

describe('FavoriteRepository', () => {
  let favoriteRepository: FavoriteRepository;

  beforeEach(() => {
    favoriteRepository = new FavoriteRepository(mockPrisma);
    jest.clearAllMocks();
  });

  describe('create', () => {
    const userId = 'user-123';
    const request: CreateFavoriteRequest = { propertyId: 'property-123' };

    it('should create a new favorite', async () => {
      const mockFavorite = {
        id: 'favorite-123',
        userId,
        propertyId: request.propertyId,
        createdAt: new Date(),
      };

      mockPrisma.favorite.create.mockResolvedValue(mockFavorite);

      const result = await favoriteRepository.create(userId, request);

      expect(result).toEqual(mockFavorite);
      expect(mockPrisma.favorite.create).toHaveBeenCalledWith({
        data: {
          userId,
          propertyId: request.propertyId,
        },
      });
    });

    it('should handle database errors during creation', async () => {
      const dbError = new Error('Database connection failed');
      mockPrisma.favorite.create.mockRejectedValue(dbError);

      await expect(favoriteRepository.create(userId, request)).rejects.toThrow(dbError);
    });
  });

  describe('findByUserAndProperty', () => {
    const userId = 'user-123';
    const propertyId = 'property-123';

    it('should find existing favorite', async () => {
      const mockFavorite = {
        id: 'favorite-123',
        userId,
        propertyId,
        createdAt: new Date(),
      };

      mockPrisma.favorite.findUnique.mockResolvedValue(mockFavorite);

      const result = await favoriteRepository.findByUserAndProperty(userId, propertyId);

      expect(result).toEqual(mockFavorite);
      expect(mockPrisma.favorite.findUnique).toHaveBeenCalledWith({
        where: {
          userId_propertyId: {
            userId,
            propertyId,
          },
        },
      });
    });

    it('should return null if favorite does not exist', async () => {
      mockPrisma.favorite.findUnique.mockResolvedValue(null);

      const result = await favoriteRepository.findByUserAndProperty(userId, propertyId);

      expect(result).toBeNull();
    });
  });

  describe('findByUser', () => {
    const userId = 'user-123';
    const page = 1;
    const limit = 10;

    it('should return paginated favorites with property details', async () => {
      const mockFavorites = [
        {
          id: 'favorite-1',
          userId,
          propertyId: 'property-1',
          createdAt: new Date(),
          property: {
            id: 'property-1',
            title: 'Test Property 1',
            price: 1000,
            currency: 'EUR',
            propertyType: 'APARTMENT',
            city: 'Paris',
            isActive: true,
            images: [
              {
                id: 'img-1',
                url: 'https://example.com/image1.jpg',
                altText: 'Property image',
                order: 1,
              },
            ],
          },
        },
      ];

      const mockTotal = 1;

      mockPrisma.favorite.findMany.mockResolvedValue(mockFavorites);
      mockPrisma.favorite.count.mockResolvedValue(mockTotal);

      const result = await favoriteRepository.findByUser(userId, page, limit);

      expect(result).toEqual({
        favorites: mockFavorites,
        total: mockTotal,
      });

      expect(mockPrisma.favorite.findMany).toHaveBeenCalledWith({
        where: { userId },
        include: {
          property: {
            include: {
              images: {
                orderBy: { order: 'asc' },
                take: 1,
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: 0,
        take: limit,
      });

      expect(mockPrisma.favorite.count).toHaveBeenCalledWith({
        where: { userId },
      });
    });

    it('should handle pagination correctly', async () => {
      const page2 = 2;
      const limit5 = 5;

      mockPrisma.favorite.findMany.mockResolvedValue([]);
      mockPrisma.favorite.count.mockResolvedValue(0);

      await favoriteRepository.findByUser(userId, page2, limit5);

      expect(mockPrisma.favorite.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 5, // (page2 - 1) * limit5
          take: limit5,
        })
      );
    });

    it('should use default pagination values', async () => {
      mockPrisma.favorite.findMany.mockResolvedValue([]);
      mockPrisma.favorite.count.mockResolvedValue(0);

      await favoriteRepository.findByUser(userId);

      expect(mockPrisma.favorite.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 0, // (1 - 1) * 10
          take: 10,
        })
      );
    });
  });

  describe('delete', () => {
    const userId = 'user-123';
    const propertyId = 'property-123';

    it('should successfully delete favorite', async () => {
      mockPrisma.favorite.delete.mockResolvedValue({} as any);

      const result = await favoriteRepository.delete(userId, propertyId);

      expect(result).toBe(true);
      expect(mockPrisma.favorite.delete).toHaveBeenCalledWith({
        where: {
          userId_propertyId: {
            userId,
            propertyId,
          },
        },
      });
    });

    it('should return false if favorite does not exist', async () => {
      mockPrisma.favorite.delete.mockRejectedValue(new Error('Record not found'));

      const result = await favoriteRepository.delete(userId, propertyId);

      expect(result).toBe(false);
    });
  });

  describe('deleteById', () => {
    const favoriteId = 'favorite-123';
    const userId = 'user-123';

    it('should successfully delete favorite by ID', async () => {
      mockPrisma.favorite.delete.mockResolvedValue({} as any);

      const result = await favoriteRepository.deleteById(favoriteId, userId);

      expect(result).toBe(true);
      expect(mockPrisma.favorite.delete).toHaveBeenCalledWith({
        where: {
          id: favoriteId,
          userId,
        },
      });
    });

    it('should return false if favorite does not exist or belongs to different user', async () => {
      mockPrisma.favorite.delete.mockRejectedValue(new Error('Record not found'));

      const result = await favoriteRepository.deleteById(favoriteId, userId);

      expect(result).toBe(false);
    });
  });

  describe('getFavoriteStatus', () => {
    const userId = 'user-123';
    const propertyId = 'property-123';

    it('should return favorited status with favorite ID', async () => {
      const mockFavorite = {
        id: 'favorite-123',
        userId,
        propertyId,
        createdAt: new Date(),
      };

      mockPrisma.favorite.findUnique.mockResolvedValue(mockFavorite);

      const result = await favoriteRepository.getFavoriteStatus(userId, propertyId);

      expect(result).toEqual({
        isFavorited: true,
        favoriteId: mockFavorite.id,
      });
    });

    it('should return not favorited status', async () => {
      mockPrisma.favorite.findUnique.mockResolvedValue(null);

      const result = await favoriteRepository.getFavoriteStatus(userId, propertyId);

      expect(result).toEqual({
        isFavorited: false,
      });
    });
  });

  describe('getFavoriteStatusForProperties', () => {
    const userId = 'user-123';
    const propertyIds = ['property-1', 'property-2', 'property-3'];

    it('should return favorite status for multiple properties', async () => {
      const mockFavorites = [
        { propertyId: 'property-1' },
        { propertyId: 'property-3' },
      ];

      mockPrisma.favorite.findMany.mockResolvedValue(mockFavorites);

      const result = await favoriteRepository.getFavoriteStatusForProperties(userId, propertyIds);

      expect(result).toEqual({
        'property-1': true,
        'property-2': false,
        'property-3': true,
      });

      expect(mockPrisma.favorite.findMany).toHaveBeenCalledWith({
        where: {
          userId,
          propertyId: { in: propertyIds },
        },
        select: {
          propertyId: true,
        },
      });
    });

    it('should handle empty property IDs array', async () => {
      const result = await favoriteRepository.getFavoriteStatusForProperties(userId, []);

      expect(result).toEqual({});
      expect(mockPrisma.favorite.findMany).toHaveBeenCalledWith({
        where: {
          userId,
          propertyId: { in: [] },
        },
        select: {
          propertyId: true,
        },
      });
    });
  });

  describe('countByProperty', () => {
    const propertyId = 'property-123';

    it('should return favorite count for property', async () => {
      const expectedCount = 5;
      mockPrisma.favorite.count.mockResolvedValue(expectedCount);

      const result = await favoriteRepository.countByProperty(propertyId);

      expect(result).toBe(expectedCount);
      expect(mockPrisma.favorite.count).toHaveBeenCalledWith({
        where: { propertyId },
      });
    });

    it('should return 0 if property has no favorites', async () => {
      mockPrisma.favorite.count.mockResolvedValue(0);

      const result = await favoriteRepository.countByProperty(propertyId);

      expect(result).toBe(0);
    });
  });

  describe('findUnavailableFavorites', () => {
    const userId = 'user-123';

    it('should return favorites for inactive properties', async () => {
      const mockUnavailableFavorites = [
        {
          id: 'favorite-1',
          userId,
          propertyId: 'property-1',
          createdAt: new Date(),
          property: {
            id: 'property-1',
            title: 'Unavailable Property',
            price: 1000,
            currency: 'EUR',
            propertyType: 'APARTMENT',
            city: 'Paris',
            isActive: false,
            images: [],
          },
        },
      ];

      mockPrisma.favorite.findMany.mockResolvedValue(mockUnavailableFavorites);

      const result = await favoriteRepository.findUnavailableFavorites(userId);

      expect(result).toEqual(mockUnavailableFavorites);
      expect(mockPrisma.favorite.findMany).toHaveBeenCalledWith({
        where: {
          userId,
          property: {
            isActive: false,
          },
        },
        include: {
          property: {
            include: {
              images: {
                orderBy: { order: 'asc' },
                take: 1,
              },
            },
          },
        },
      });
    });

    it('should return empty array if all favorites are available', async () => {
      mockPrisma.favorite.findMany.mockResolvedValue([]);

      const result = await favoriteRepository.findUnavailableFavorites(userId);

      expect(result).toEqual([]);
    });
  });

  describe('Error handling', () => {
    it('should propagate database errors', async () => {
      const dbError = new Error('Database connection lost');
      mockPrisma.favorite.findMany.mockRejectedValue(dbError);

      await expect(favoriteRepository.findByUser('user-123')).rejects.toThrow(dbError);
    });

    it('should handle constraint violations', async () => {
      const constraintError = new Error('Unique constraint violation');
      mockPrisma.favorite.create.mockRejectedValue(constraintError);

      await expect(
        favoriteRepository.create('user-123', { propertyId: 'property-123' })
      ).rejects.toThrow(constraintError);
    });
  });
});