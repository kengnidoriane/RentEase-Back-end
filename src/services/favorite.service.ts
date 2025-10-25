import { PrismaClient } from '@prisma/client';
import { FavoriteRepository } from '../repositories/favorite.repository';
import { PropertyRepository } from '../repositories/property.repository';
import { NotificationService } from './notification.service';
import { 
  CreateFavoriteRequest, 
  FavoriteResponse, 
  FavoritesListResponse, 
  FavoriteStatusResponse 
} from '../types/favorite.types';
import { AppError } from '../utils/errors';

export class FavoriteService {
  private notificationService: NotificationService;

  constructor(
    private favoriteRepository: FavoriteRepository,
    private propertyRepository: PropertyRepository
  ) {
    this.notificationService = new NotificationService(new PrismaClient());
  }

  async addToFavorites(userId: string, data: CreateFavoriteRequest): Promise<FavoriteResponse> {
    // Check if property exists and is active
    const property = await this.propertyRepository.findById(data.propertyId);
    if (!property) {
      throw new AppError('Property not found', 404);
    }

    if (!property.isActive) {
      throw new AppError('Property is not available', 400);
    }

    // Check if already favorited
    const existingFavorite = await this.favoriteRepository.findByUserAndProperty(userId, data.propertyId);
    if (existingFavorite) {
      throw new AppError('Property is already in favorites', 409);
    }

    // Prevent landlords from favoriting their own properties
    if (property.landlordId === userId) {
      throw new AppError('Cannot favorite your own property', 400);
    }

    const favorite = await this.favoriteRepository.create(userId, data);

    return {
      id: favorite.id,
      createdAt: favorite.createdAt,
      propertyId: favorite.propertyId,
      property: {
        id: property.id,
        title: property.title,
        price: Number(property.price),
        currency: property.currency,
        propertyType: property.propertyType,
        city: property.city,
        isActive: property.isActive,
        images: (property as any).images?.map((img: any) => ({
          id: img.id,
          url: img.url,
          altText: img.altText,
          order: img.order,
        })) || [],
      },
    };
  }

  async removeFromFavorites(userId: string, propertyId: string): Promise<void> {
    const deleted = await this.favoriteRepository.delete(userId, propertyId);
    if (!deleted) {
      throw new AppError('Favorite not found', 404);
    }
  }

  async removeFavoriteById(userId: string, favoriteId: string): Promise<void> {
    const deleted = await this.favoriteRepository.deleteById(favoriteId, userId);
    if (!deleted) {
      throw new AppError('Favorite not found', 404);
    }
  }

  async getUserFavorites(
    userId: string, 
    page: number = 1, 
    limit: number = 10
  ): Promise<FavoritesListResponse> {
    const { favorites, total } = await this.favoriteRepository.findByUser(userId, page, limit);
    
    const favoriteResponses: FavoriteResponse[] = favorites.map((favorite: any) => ({
      id: favorite.id,
      createdAt: favorite.createdAt,
      propertyId: favorite.propertyId,
      property: {
        id: favorite.property.id,
        title: favorite.property.title,
        price: Number(favorite.property.price),
        currency: favorite.property.currency,
        propertyType: favorite.property.propertyType,
        city: favorite.property.city,
        isActive: favorite.property.isActive,
        images: favorite.property.images?.map((img: any) => ({
          id: img.id,
          url: img.url,
          altText: img.altText,
          order: img.order,
        })) || [],
      },
    }));

    const totalPages = Math.ceil(total / limit);

    return {
      favorites: favoriteResponses,
      total,
      page,
      limit,
      totalPages,
    };
  }

  async getFavoriteStatus(userId: string, propertyId: string): Promise<FavoriteStatusResponse> {
    return this.favoriteRepository.getFavoriteStatus(userId, propertyId);
  }

  async getFavoriteStatusForProperties(userId: string, propertyIds: string[]): Promise<Record<string, boolean>> {
    return this.favoriteRepository.getFavoriteStatusForProperties(userId, propertyIds);
  }

  async getUnavailableFavorites(userId: string): Promise<FavoriteResponse[]> {
    const favorites = await this.favoriteRepository.findUnavailableFavorites(userId);
    
    return favorites.map((favorite: any) => ({
      id: favorite.id,
      createdAt: favorite.createdAt,
      propertyId: favorite.propertyId,
      property: {
        id: favorite.property.id,
        title: favorite.property.title,
        price: Number(favorite.property.price),
        currency: favorite.property.currency,
        propertyType: favorite.property.propertyType,
        city: favorite.property.city,
        isActive: favorite.property.isActive,
        images: favorite.property.images?.map((img: any) => ({
          id: img.id,
          url: img.url,
          altText: img.altText,
          order: img.order,
        })) || [],
      },
    }));
  }

  async getFavoriteCount(propertyId: string): Promise<number> {
    return this.favoriteRepository.countByProperty(propertyId);
  }

  async checkAndNotifyUnavailableFavorites(userId: string): Promise<void> {
    const unavailableFavorites = await this.getUnavailableFavorites(userId);
    
    if (unavailableFavorites.length > 0) {
      const properties = unavailableFavorites.map(fav => ({
        id: fav.property.id,
        title: fav.property.title,
      }));

      await this.notificationService.sendBatchFavoriteUnavailableNotifications(userId, properties);
    }
  }
}