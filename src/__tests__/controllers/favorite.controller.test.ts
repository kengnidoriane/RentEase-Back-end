import { FavoriteController } from '../../controllers/favorite.controller';
import { FavoriteService } from '../../services/favorite.service';
import { AppError } from '../../utils/errors';
import { createMockRequest, createMockResponse, createMockNext } from '../utils/testUtils';
import { AuthenticatedRequest } from '../../types/auth.types';
import { UserType } from '@prisma/client';

// Mock the service
jest.mock('../../services/favorite.service');

const createAuthenticatedMockRequest = (userId: string, overrides: any = {}) => {
  return createMockRequest({
    user: { 
      id: userId, 
      userId, 
      email: 'test@example.com', 
      userType: UserType.TENANT 
    },
    ...overrides,
  }) as AuthenticatedRequest;
};

describe('FavoriteController', () => {
  let favoriteController: FavoriteController;
  let mockFavoriteService: jest.Mocked<FavoriteService>;
  let mockResponse: any;
  let mockNext: jest.Mock;

  beforeEach(() => {
    mockFavoriteService = new FavoriteService({} as any, {} as any) as jest.Mocked<FavoriteService>;
    favoriteController = new FavoriteController(mockFavoriteService);
    mockResponse = createMockResponse();
    mockNext = createMockNext();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('addToFavorites', () => {
    const userId = 'user-123';
    const propertyId = 'property-123';

    it('should add property to favorites successfully', async () => {
      const mockRequest = createAuthenticatedMockRequest(userId, {
        body: { propertyId },
      });

      const mockFavoriteResponse = {
        id: 'favorite-123',
        createdAt: new Date(),
        propertyId,
        property: {
          id: propertyId,
          title: 'Test Property',
          price: 1000,
          currency: 'EUR',
          propertyType: 'APARTMENT',
          city: 'Paris',
          isActive: true,
          images: [],
        },
      };

      mockFavoriteService.addToFavorites.mockResolvedValue(mockFavoriteResponse);

      await favoriteController.addToFavorites(mockRequest, mockResponse, mockNext);

      expect(mockFavoriteService.addToFavorites).toHaveBeenCalledWith(userId, { propertyId });
      expect(mockResponse.status).toHaveBeenCalledWith(201);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: mockFavoriteResponse,
        message: 'Property added to favorites successfully',
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 400 if propertyId is missing', async () => {
      const mockRequest = createAuthenticatedMockRequest(userId, {
        body: {},
      });

      await favoriteController.addToFavorites(mockRequest, mockResponse, mockNext);

      expect(mockNext).toHaveBeenCalledWith(new AppError('Property ID is required', 400));
      expect(mockFavoriteService.addToFavorites).not.toHaveBeenCalled();
    });

    it('should handle service errors', async () => {
      const mockRequest = createAuthenticatedMockRequest(userId, {
        body: { propertyId },
      });

      const serviceError = new AppError('Property not found', 404);
      mockFavoriteService.addToFavorites.mockRejectedValue(serviceError);

      await favoriteController.addToFavorites(mockRequest, mockResponse, mockNext);

      expect(mockNext).toHaveBeenCalledWith(serviceError);
      expect(mockResponse.status).not.toHaveBeenCalled();
    });
  });

  describe('removeFromFavorites', () => {
    const userId = 'user-123';
    const propertyId = 'property-123';

    it('should remove property from favorites successfully', async () => {
      const mockRequest = createAuthenticatedMockRequest(userId, {
        params: { propertyId },
      });

      mockFavoriteService.removeFromFavorites.mockResolvedValue();

      await favoriteController.removeFromFavorites(mockRequest, mockResponse, mockNext);

      expect(mockFavoriteService.removeFromFavorites).toHaveBeenCalledWith(userId, propertyId);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        message: 'Property removed from favorites successfully',
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 400 if propertyId is missing', async () => {
      const mockRequest = createAuthenticatedMockRequest(userId, {
        params: {},
      });

      await favoriteController.removeFromFavorites(mockRequest, mockResponse, mockNext);

      expect(mockNext).toHaveBeenCalledWith(new AppError('Property ID is required', 400));
      expect(mockFavoriteService.removeFromFavorites).not.toHaveBeenCalled();
    });
  });

  describe('getUserFavorites', () => {
    const userId = 'user-123';

    it('should get user favorites with default pagination', async () => {
      const mockRequest = createAuthenticatedMockRequest(userId, {
        query: {},
      });

      const mockFavoritesResponse = {
        favorites: [],
        total: 0,
        page: 1,
        limit: 10,
        totalPages: 0,
      };

      mockFavoriteService.getUserFavorites.mockResolvedValue(mockFavoritesResponse);

      await favoriteController.getUserFavorites(mockRequest, mockResponse, mockNext);

      expect(mockFavoriteService.getUserFavorites).toHaveBeenCalledWith(userId, 1, 10);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: mockFavoritesResponse,
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should validate page parameter', async () => {
      const mockRequest = createAuthenticatedMockRequest(userId, {
        query: { page: '0' },
      });

      await favoriteController.getUserFavorites(mockRequest, mockResponse, mockNext);

      expect(mockNext).toHaveBeenCalledWith(new AppError('Page must be greater than 0', 400));
      expect(mockFavoriteService.getUserFavorites).not.toHaveBeenCalled();
    });

    it('should validate limit parameter', async () => {
      const mockRequest = createAuthenticatedMockRequest(userId, {
        query: { limit: '101' },
      });

      await favoriteController.getUserFavorites(mockRequest, mockResponse, mockNext);

      expect(mockNext).toHaveBeenCalledWith(new AppError('Limit must be between 1 and 100', 400));
      expect(mockFavoriteService.getUserFavorites).not.toHaveBeenCalled();
    });
  });

  describe('getFavoriteStatus', () => {
    const userId = 'user-123';
    const propertyId = 'property-123';

    it('should get favorite status successfully', async () => {
      const mockRequest = createAuthenticatedMockRequest(userId, {
        params: { propertyId },
      });

      const mockStatus = { isFavorited: true, favoriteId: 'favorite-123' };
      mockFavoriteService.getFavoriteStatus.mockResolvedValue(mockStatus);

      await favoriteController.getFavoriteStatus(mockRequest, mockResponse, mockNext);

      expect(mockFavoriteService.getFavoriteStatus).toHaveBeenCalledWith(userId, propertyId);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: mockStatus,
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 400 if propertyId is missing', async () => {
      const mockRequest = createAuthenticatedMockRequest(userId, {
        params: {},
      });

      await favoriteController.getFavoriteStatus(mockRequest, mockResponse, mockNext);

      expect(mockNext).toHaveBeenCalledWith(new AppError('Property ID is required', 400));
      expect(mockFavoriteService.getFavoriteStatus).not.toHaveBeenCalled();
    });
  });

  describe('getFavoriteStatusBatch', () => {
    const userId = 'user-123';

    it('should get batch favorite status successfully', async () => {
      const propertyIds = ['property-1', 'property-2', 'property-3'];
      const mockRequest = createAuthenticatedMockRequest(userId, {
        body: { propertyIds },
      });

      const mockStatuses = {
        'property-1': true,
        'property-2': false,
        'property-3': true,
      };

      mockFavoriteService.getFavoriteStatusForProperties.mockResolvedValue(mockStatuses);

      await favoriteController.getFavoriteStatusBatch(mockRequest, mockResponse, mockNext);

      expect(mockFavoriteService.getFavoriteStatusForProperties).toHaveBeenCalledWith(userId, propertyIds);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: mockStatuses,
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 400 if propertyIds is not an array', async () => {
      const mockRequest = createAuthenticatedMockRequest(userId, {
        body: { propertyIds: 'not-an-array' },
      });

      await favoriteController.getFavoriteStatusBatch(mockRequest, mockResponse, mockNext);

      expect(mockNext).toHaveBeenCalledWith(new AppError('Property IDs array is required', 400));
      expect(mockFavoriteService.getFavoriteStatusForProperties).not.toHaveBeenCalled();
    });
  });
});