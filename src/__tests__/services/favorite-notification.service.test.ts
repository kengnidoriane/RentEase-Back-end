import { FavoriteService } from '../../services/favorite.service';
import { FavoriteRepository } from '../../repositories/favorite.repository';
import { PropertyRepository } from '../../repositories/property.repository';
import { NotificationService } from '../../services/notification.service';

// Mock the dependencies
jest.mock('../../repositories/favorite.repository');
jest.mock('../../repositories/property.repository');
jest.mock('../../services/notification.service');

describe('FavoriteService - Notification Integration Tests', () => {
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

  describe('checkAndNotifyUnavailableFavorites', () => {
    const userId = 'user-123';

    it('should send single notification for one unavailable favorite', async () => {
      const mockUnavailableFavorites = [
        {
          id: 'favorite-1',
          createdAt: new Date(),
          propertyId: 'property-1',
          property: {
            id: 'property-1',
            title: 'Beautiful Apartment',
            price: 1000,
            currency: 'EUR',
            propertyType: 'APARTMENT',
            city: 'Paris',
            isActive: false,
            images: [],
          },
        },
      ] as any;

      mockFavoriteRepository.findUnavailableFavorites.mockResolvedValue(mockUnavailableFavorites);
      mockNotificationService.sendBatchFavoriteUnavailableNotifications.mockResolvedValue();

      await favoriteService.checkAndNotifyUnavailableFavorites(userId);

      expect(mockNotificationService.sendBatchFavoriteUnavailableNotifications).toHaveBeenCalledWith(
        userId,
        [{ id: 'property-1', title: 'Beautiful Apartment' }]
      );
    });

    it('should send batch notification for multiple unavailable favorites', async () => {
      const mockUnavailableFavorites = [
        {
          id: 'favorite-1',
          createdAt: new Date(),
          propertyId: 'property-1',
          property: {
            id: 'property-1',
            title: 'Beautiful Apartment',
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
            title: 'Cozy House',
            price: 1500,
            currency: 'EUR',
            propertyType: 'HOUSE',
            city: 'Lyon',
            isActive: false,
            images: [],
          },
        },
        {
          id: 'favorite-3',
          createdAt: new Date(),
          propertyId: 'property-3',
          property: {
            id: 'property-3',
            title: 'Modern Studio',
            price: 800,
            currency: 'EUR',
            propertyType: 'STUDIO',
            city: 'Nice',
            isActive: false,
            images: [],
          },
        },
      ] as any;

      mockFavoriteRepository.findUnavailableFavorites.mockResolvedValue(mockUnavailableFavorites);
      mockNotificationService.sendBatchFavoriteUnavailableNotifications.mockResolvedValue();

      await favoriteService.checkAndNotifyUnavailableFavorites(userId);

      expect(mockNotificationService.sendBatchFavoriteUnavailableNotifications).toHaveBeenCalledWith(
        userId,
        [
          { id: 'property-1', title: 'Beautiful Apartment' },
          { id: 'property-2', title: 'Cozy House' },
          { id: 'property-3', title: 'Modern Studio' },
        ]
      );
    });

    it('should not send notification if no unavailable favorites', async () => {
      mockFavoriteRepository.findUnavailableFavorites.mockResolvedValue([]);

      await favoriteService.checkAndNotifyUnavailableFavorites(userId);

      expect(mockNotificationService.sendBatchFavoriteUnavailableNotifications).not.toHaveBeenCalled();
    });

    it('should handle notification service errors gracefully', async () => {
      const mockUnavailableFavorites = [
        {
          id: 'favorite-1',
          createdAt: new Date(),
          propertyId: 'property-1',
          property: {
            id: 'property-1',
            title: 'Beautiful Apartment',
            price: 1000,
            currency: 'EUR',
            propertyType: 'APARTMENT',
            city: 'Paris',
            isActive: false,
            images: [],
          },
        },
      ] as any;

      mockFavoriteRepository.findUnavailableFavorites.mockResolvedValue(mockUnavailableFavorites);
      mockNotificationService.sendBatchFavoriteUnavailableNotifications.mockRejectedValue(
        new Error('Notification service error')
      );

      // Should not throw error even if notification fails
      await expect(favoriteService.checkAndNotifyUnavailableFavorites(userId)).resolves.not.toThrow();

      expect(mockNotificationService.sendBatchFavoriteUnavailableNotifications).toHaveBeenCalled();
    });

    it('should handle repository errors', async () => {
      mockFavoriteRepository.findUnavailableFavorites.mockRejectedValue(
        new Error('Database connection error')
      );

      await expect(favoriteService.checkAndNotifyUnavailableFavorites(userId)).rejects.toThrow(
        'Database connection error'
      );

      expect(mockNotificationService.sendBatchFavoriteUnavailableNotifications).not.toHaveBeenCalled();
    });
  });

  describe('Notification data formatting', () => {
    const userId = 'user-123';

    it('should format property data correctly for notifications', async () => {
      const mockUnavailableFavorites = [
        {
          id: 'favorite-1',
          createdAt: new Date(),
          propertyId: 'property-1',
          property: {
            id: 'property-1',
            title: 'Apartment with Special Characters: "Luxury" & <Modern>',
            price: 1000,
            currency: 'EUR',
            propertyType: 'APARTMENT',
            city: 'Paris',
            isActive: false,
            images: [],
          },
        },
      ] as any;

      mockFavoriteRepository.findUnavailableFavorites.mockResolvedValue(mockUnavailableFavorites);
      mockNotificationService.sendBatchFavoriteUnavailableNotifications.mockResolvedValue();

      await favoriteService.checkAndNotifyUnavailableFavorites(userId);

      expect(mockNotificationService.sendBatchFavoriteUnavailableNotifications).toHaveBeenCalledWith(
        userId,
        [{ 
          id: 'property-1', 
          title: 'Apartment with Special Characters: "Luxury" & <Modern>' 
        }]
      );
    });

    it('should handle properties with empty or null titles', async () => {
      const mockUnavailableFavorites = [
        {
          id: 'favorite-1',
          createdAt: new Date(),
          propertyId: 'property-1',
          property: {
            id: 'property-1',
            title: '',
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
            title: null,
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

      expect(mockNotificationService.sendBatchFavoriteUnavailableNotifications).toHaveBeenCalledWith(
        userId,
        [
          { id: 'property-1', title: '' },
          { id: 'property-2', title: null },
        ]
      );
    });
  });
});