import { FavoriteService } from '../../services/favorite.service';
import { FavoriteRepository } from '../../repositories/favorite.repository';
import { PropertyRepository } from '../../repositories/property.repository';
import { NotificationService } from '../../services/notification.service';
import { AppError } from '../../utils/errors';
import { CreateFavoriteRequest } from '../../types/favorite.types';

// Mock the repositories and services
jest.mock('../../repositories/favorite.repository');
jest.mock('../../repositories/property.repository');
jest.mock('../../services/notification.service');

describe('FavoriteService', () => {
  let favoriteService: FavoriteService;
  let mockFavoriteRepository: jest.Mocked<FavoriteRepository>;
  let mockPropertyRepository: jest.Mocked<PropertyRepository>;
  let mockNotificationService: jest.Mocked<NotificationService>;

  beforeEach(() => {
    mockFavoriteRepository = new FavoriteRepository({} as any) as jest.Mocked<FavoriteRepository>;
    mockPropertyRepository = new PropertyRepository({} as any) as jest.Mocked<PropertyRepository>;
    favoriteService = new FavoriteService(mockFavoriteRepository, mockPropertyRepository);
    
    // Get the mocked notification service instance
    mockNotificationService = (favoriteService as any).notificationService as jest.Mocked<NotificationService>;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('addToFavorites', () => {
    const userId = 'user-123';
    const propertyId = 'property-123';
    const landlordId = 'landlord-123';
    const request: CreateFavoriteRequest = { propertyId };

    const mockProperty = {
      id: propertyId,
      title: 'Test Property',
      price: 1000,
      currency: 'EUR',
      propertyType: 'APARTMENT',
      city: 'Paris',
      isActive: true,
      landlordId,
      images: [
        {
          id: 'img-1',
          url: 'https://example.com/image.jpg',
          altText: 'Property image',
          order: 1,
        },
      ],
    } as any;

    const mockFavorite = {
      id: 'favorite-123',
      createdAt: new Date(),
      userId,
      propertyId,
    };

    it('should successfully add property to favorites', async () => {
      mockPropertyRepository.findById.mockResolvedValue(mockProperty);
      mockFavoriteRepository.findByUserAndProperty.mockResolvedValue(null);
      mockFavoriteRepository.create.mockResolvedValue(mockFavorite);
      mockPropertyRepository.findById.mockResolvedValueOnce(mockProperty).mockResolvedValueOnce(mockProperty);

      const result = await favoriteService.addToFavorites(userId, request);

      expect(result).toEqual({
        id: mockFavorite.id,
        createdAt: mockFavorite.createdAt,
        propertyId,
        property: {
          id: mockProperty.id,
          title: mockProperty.title,
          price: Number(mockProperty.price),
          currency: mockProperty.currency,
          propertyType: mockProperty.propertyType,
          city: mockProperty.city,
          isActive: mockProperty.isActive,
          images: mockProperty.images,
        },
      });

      expect(mockPropertyRepository.findById).toHaveBeenCalledWith(propertyId);
      expect(mockFavoriteRepository.findByUserAndProperty).toHaveBeenCalledWith(userId, propertyId);
      expect(mockFavoriteRepository.create).toHaveBeenCalledWith(userId, request);
    });

    it('should throw error if property not found', async () => {
      mockPropertyRepository.findById.mockResolvedValue(null);

      await expect(favoriteService.addToFavorites(userId, request)).rejects.toThrow(
        new AppError('Property not found', 404)
      );
    });

    it('should throw error if property is not active', async () => {
      const inactiveProperty = { ...mockProperty, isActive: false };
      mockPropertyRepository.findById.mockResolvedValue(inactiveProperty);

      await expect(favoriteService.addToFavorites(userId, request)).rejects.toThrow(
        new AppError('Property is not available', 400)
      );
    });

    it('should throw error if property is already favorited', async () => {
      mockPropertyRepository.findById.mockResolvedValue(mockProperty);
      mockFavoriteRepository.findByUserAndProperty.mockResolvedValue(mockFavorite);

      await expect(favoriteService.addToFavorites(userId, request)).rejects.toThrow(
        new AppError('Property is already in favorites', 409)
      );
    });

    it('should throw error if user tries to favorite their own property', async () => {
      const ownProperty = { ...mockProperty, landlordId: userId };
      mockPropertyRepository.findById.mockResolvedValue(ownProperty);
      mockFavoriteRepository.findByUserAndProperty.mockResolvedValue(null);

      await expect(favoriteService.addToFavorites(userId, request)).rejects.toThrow(
        new AppError('Cannot favorite your own property', 400)
      );
    });
  });

  describe('removeFromFavorites', () => {
    const userId = 'user-123';
    const propertyId = 'property-123';

    it('should successfully remove property from favorites', async () => {
      mockFavoriteRepository.delete.mockResolvedValue(true);

      await favoriteService.removeFromFavorites(userId, propertyId);

      expect(mockFavoriteRepository.delete).toHaveBeenCalledWith(userId, propertyId);
    });

    it('should throw error if favorite not found', async () => {
      mockFavoriteRepository.delete.mockResolvedValue(false);

      await expect(favoriteService.removeFromFavorites(userId, propertyId)).rejects.toThrow(
        new AppError('Favorite not found', 404)
      );
    });
  });

  describe('getUserFavorites', () => {
    const userId = 'user-123';
    const page = 1;
    const limit = 10;

    const mockFavorites = [
      {
        id: 'favorite-1',
        createdAt: new Date(),
        propertyId: 'property-1',
        property: {
          id: 'property-1',
          title: 'Property 1',
          price: 1000,
          currency: 'EUR',
          propertyType: 'APARTMENT',
          city: 'Paris',
          isActive: true,
          images: [],
        },
      },
    ] as any;

    it('should return user favorites with pagination', async () => {
      mockFavoriteRepository.findByUser.mockResolvedValue({
        favorites: mockFavorites,
        total: 1,
      });

      const result = await favoriteService.getUserFavorites(userId, page, limit);

      expect(result).toEqual({
        favorites: [
          {
            id: mockFavorites[0].id,
            createdAt: mockFavorites[0].createdAt,
            propertyId: mockFavorites[0].propertyId,
            property: {
              id: mockFavorites[0].property.id,
              title: mockFavorites[0].property.title,
              price: Number(mockFavorites[0].property.price),
              currency: mockFavorites[0].property.currency,
              propertyType: mockFavorites[0].property.propertyType,
              city: mockFavorites[0].property.city,
              isActive: mockFavorites[0].property.isActive,
              images: mockFavorites[0].property.images,
            },
          },
        ],
        total: 1,
        page,
        limit,
        totalPages: 1,
      });

      expect(mockFavoriteRepository.findByUser).toHaveBeenCalledWith(userId, page, limit);
    });
  });

  describe('getFavoriteStatus', () => {
    const userId = 'user-123';
    const propertyId = 'property-123';

    it('should return favorite status', async () => {
      const mockStatus = { isFavorited: true, favoriteId: 'favorite-123' };
      mockFavoriteRepository.getFavoriteStatus.mockResolvedValue(mockStatus);

      const result = await favoriteService.getFavoriteStatus(userId, propertyId);

      expect(result).toEqual(mockStatus);
      expect(mockFavoriteRepository.getFavoriteStatus).toHaveBeenCalledWith(userId, propertyId);
    });
  });

  describe('removeFavoriteById', () => {
    const userId = 'user-123';
    const favoriteId = 'favorite-123';

    it('should successfully remove favorite by ID', async () => {
      mockFavoriteRepository.deleteById.mockResolvedValue(true);

      await favoriteService.removeFavoriteById(userId, favoriteId);

      expect(mockFavoriteRepository.deleteById).toHaveBeenCalledWith(favoriteId, userId);
    });

    it('should throw error if favorite not found', async () => {
      mockFavoriteRepository.deleteById.mockResolvedValue(false);

      await expect(favoriteService.removeFavoriteById(userId, favoriteId)).rejects.toThrow(
        new AppError('Favorite not found', 404)
      );
    });
  });

  describe('getFavoriteStatusForProperties', () => {
    const userId = 'user-123';
    const propertyIds = ['property-1', 'property-2', 'property-3'];

    it('should return favorite status for multiple properties', async () => {
      const mockStatuses = {
        'property-1': true,
        'property-2': false,
        'property-3': true,
      };
      mockFavoriteRepository.getFavoriteStatusForProperties.mockResolvedValue(mockStatuses);

      const result = await favoriteService.getFavoriteStatusForProperties(userId, propertyIds);

      expect(result).toEqual(mockStatuses);
      expect(mockFavoriteRepository.getFavoriteStatusForProperties).toHaveBeenCalledWith(userId, propertyIds);
    });
  });

  describe('getUnavailableFavorites', () => {
    const userId = 'user-123';

    const mockUnavailableFavorites = [
      {
        id: 'favorite-1',
        createdAt: new Date(),
        propertyId: 'property-1',
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
    ] as any;

    it('should return unavailable favorites', async () => {
      mockFavoriteRepository.findUnavailableFavorites.mockResolvedValue(mockUnavailableFavorites);

      const result = await favoriteService.getUnavailableFavorites(userId);

      expect(result).toEqual([
        {
          id: mockUnavailableFavorites[0].id,
          createdAt: mockUnavailableFavorites[0].createdAt,
          propertyId: mockUnavailableFavorites[0].propertyId,
          property: {
            id: mockUnavailableFavorites[0].property.id,
            title: mockUnavailableFavorites[0].property.title,
            price: Number(mockUnavailableFavorites[0].property.price),
            currency: mockUnavailableFavorites[0].property.currency,
            propertyType: mockUnavailableFavorites[0].property.propertyType,
            city: mockUnavailableFavorites[0].property.city,
            isActive: mockUnavailableFavorites[0].property.isActive,
            images: mockUnavailableFavorites[0].property.images,
          },
        },
      ]);

      expect(mockFavoriteRepository.findUnavailableFavorites).toHaveBeenCalledWith(userId);
    });

    it('should return empty array if no unavailable favorites', async () => {
      mockFavoriteRepository.findUnavailableFavorites.mockResolvedValue([]);

      const result = await favoriteService.getUnavailableFavorites(userId);

      expect(result).toEqual([]);
      expect(mockFavoriteRepository.findUnavailableFavorites).toHaveBeenCalledWith(userId);
    });
  });

  describe('getFavoriteCount', () => {
    const propertyId = 'property-123';

    it('should return favorite count for property', async () => {
      const expectedCount = 5;
      mockFavoriteRepository.countByProperty.mockResolvedValue(expectedCount);

      const result = await favoriteService.getFavoriteCount(propertyId);

      expect(result).toBe(expectedCount);
      expect(mockFavoriteRepository.countByProperty).toHaveBeenCalledWith(propertyId);
    });

    it('should return 0 if property has no favorites', async () => {
      mockFavoriteRepository.countByProperty.mockResolvedValue(0);

      const result = await favoriteService.getFavoriteCount(propertyId);

      expect(result).toBe(0);
      expect(mockFavoriteRepository.countByProperty).toHaveBeenCalledWith(propertyId);
    });
  });

  describe('checkAndNotifyUnavailableFavorites', () => {
    const userId = 'user-123';

    it('should send notifications for unavailable favorites', async () => {
      const mockUnavailableFavorites = [
        {
          id: 'favorite-1',
          createdAt: new Date(),
          propertyId: 'property-1',
          property: {
            id: 'property-1',
            title: 'Unavailable Property 1',
            price: 1000,
            currency: 'EUR',
            propertyType: 'APARTMENT',
            city: 'Paris',
            isActive: false,
            images: [],
          },
        },
        {
          id: 'favorite-2',
          createdAt: new Date(),
          propertyId: 'property-2',
          property: {
            id: 'property-2',
            title: 'Unavailable Property 2',
            price: 1200,
            currency: 'EUR',
            propertyType: 'HOUSE',
            city: 'Lyon',
            isActive: false,
            images: [],
          },
        },
      ] as any;

      mockFavoriteRepository.findUnavailableFavorites.mockResolvedValue(mockUnavailableFavorites);
      mockNotificationService.sendBatchFavoriteUnavailableNotifications.mockResolvedValue();

      await favoriteService.checkAndNotifyUnavailableFavorites(userId);

      expect(mockFavoriteRepository.findUnavailableFavorites).toHaveBeenCalledWith(userId);
      expect(mockNotificationService.sendBatchFavoriteUnavailableNotifications).toHaveBeenCalledWith(
        userId,
        [
          { id: 'property-1', title: 'Unavailable Property 1' },
          { id: 'property-2', title: 'Unavailable Property 2' },
        ]
      );
    });

    it('should not send notifications if no unavailable favorites', async () => {
      mockFavoriteRepository.findUnavailableFavorites.mockResolvedValue([]);

      await favoriteService.checkAndNotifyUnavailableFavorites(userId);

      expect(mockFavoriteRepository.findUnavailableFavorites).toHaveBeenCalledWith(userId);
      expect(mockNotificationService.sendBatchFavoriteUnavailableNotifications).not.toHaveBeenCalled();
    });
  });

  describe('getUserFavorites - edge cases', () => {
    const userId = 'user-123';

    it('should handle favorites with missing images', async () => {
      const mockFavorites = [
        {
          id: 'favorite-1',
          createdAt: new Date(),
          propertyId: 'property-1',
          property: {
            id: 'property-1',
            title: 'Property without images',
            price: 1000,
            currency: 'EUR',
            propertyType: 'APARTMENT',
            city: 'Paris',
            isActive: true,
            images: null, // No images
          },
        },
      ] as any;

      mockFavoriteRepository.findByUser.mockResolvedValue({
        favorites: mockFavorites,
        total: 1,
      });

      const result = await favoriteService.getUserFavorites(userId, 1, 10);

      expect(result.favorites[0]!.property.images).toEqual([]);
    });

    it('should calculate total pages correctly', async () => {
      const mockFavorites = Array.from({ length: 5 }, (_, i) => ({
        id: `favorite-${i + 1}`,
        createdAt: new Date(),
        propertyId: `property-${i + 1}`,
        property: {
          id: `property-${i + 1}`,
          title: `Property ${i + 1}`,
          price: 1000,
          currency: 'EUR',
          propertyType: 'APARTMENT',
          city: 'Paris',
          isActive: true,
          images: [],
        },
      })) as any;

      mockFavoriteRepository.findByUser.mockResolvedValue({
        favorites: mockFavorites,
        total: 23, // 23 total favorites
      });

      const result = await favoriteService.getUserFavorites(userId, 1, 10);

      expect(result.totalPages).toBe(3); // Math.ceil(23 / 10) = 3
      expect(result.total).toBe(23);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(10);
    });
  });
});