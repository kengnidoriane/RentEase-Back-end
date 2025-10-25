import { FavoriteRepository } from '../repositories/favorite.repository';
import { FavoriteService } from '../services/favorite.service';
import { PropertyRepository } from '../repositories/property.repository';

// Mock Prisma Client
const mockPrismaClient = {
  favorite: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    delete: jest.fn(),
  },
  property: {
    findUnique: jest.fn(),
  },
} as any;

describe('Favorites Simple Test', () => {
  let favoriteRepository: FavoriteRepository;
  let propertyRepository: PropertyRepository;
  let favoriteService: FavoriteService;

  beforeEach(() => {
    favoriteRepository = new FavoriteRepository(mockPrismaClient);
    propertyRepository = new PropertyRepository(mockPrismaClient);
    favoriteService = new FavoriteService(favoriteRepository, propertyRepository);
    jest.clearAllMocks();
  });

  it('should create favorite repository', () => {
    expect(favoriteRepository).toBeDefined();
  });

  it('should create favorite service', () => {
    expect(favoriteService).toBeDefined();
  });

  it('should have correct methods in favorite repository', () => {
    expect(typeof favoriteRepository.create).toBe('function');
    expect(typeof favoriteRepository.findByUserAndProperty).toBe('function');
    expect(typeof favoriteRepository.findByUser).toBe('function');
    expect(typeof favoriteRepository.delete).toBe('function');
    expect(typeof favoriteRepository.getFavoriteStatus).toBe('function');
  });

  it('should have correct methods in favorite service', () => {
    expect(typeof favoriteService.addToFavorites).toBe('function');
    expect(typeof favoriteService.removeFromFavorites).toBe('function');
    expect(typeof favoriteService.getUserFavorites).toBe('function');
    expect(typeof favoriteService.getFavoriteStatus).toBe('function');
    expect(typeof favoriteService.getUnavailableFavorites).toBe('function');
  });

  it('should create favorite successfully', async () => {
    const userId = 'user-123';
    const propertyId = 'property-123';
    const mockFavorite = {
      id: 'favorite-123',
      createdAt: new Date(),
      userId,
      propertyId,
    };

    mockPrismaClient.favorite.create.mockResolvedValue(mockFavorite);

    const result = await favoriteRepository.create(userId, { propertyId });

    expect(result).toEqual(mockFavorite);
    expect(mockPrismaClient.favorite.create).toHaveBeenCalledWith({
      data: {
        userId,
        propertyId,
      },
    });
  });

  it('should find favorite by user and property', async () => {
    const userId = 'user-123';
    const propertyId = 'property-123';
    const mockFavorite = {
      id: 'favorite-123',
      createdAt: new Date(),
      userId,
      propertyId,
    };

    mockPrismaClient.favorite.findUnique.mockResolvedValue(mockFavorite);

    const result = await favoriteRepository.findByUserAndProperty(userId, propertyId);

    expect(result).toEqual(mockFavorite);
    expect(mockPrismaClient.favorite.findUnique).toHaveBeenCalledWith({
      where: {
        userId_propertyId: {
          userId,
          propertyId,
        },
      },
    });
  });

  it('should get favorite status', async () => {
    const userId = 'user-123';
    const propertyId = 'property-123';
    const mockFavorite = {
      id: 'favorite-123',
      createdAt: new Date(),
      userId,
      propertyId,
    };

    mockPrismaClient.favorite.findUnique.mockResolvedValue(mockFavorite);

    const result = await favoriteRepository.getFavoriteStatus(userId, propertyId);

    expect(result).toEqual({
      isFavorited: true,
      favoriteId: mockFavorite.id,
    });
  });

  it('should return false for non-favorited property', async () => {
    const userId = 'user-123';
    const propertyId = 'property-123';

    mockPrismaClient.favorite.findUnique.mockResolvedValue(null);

    const result = await favoriteRepository.getFavoriteStatus(userId, propertyId);

    expect(result).toEqual({
      isFavorited: false,
      favoriteId: undefined,
    });
  });
});