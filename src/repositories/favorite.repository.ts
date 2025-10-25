import { PrismaClient, Favorite } from '@prisma/client';
import { CreateFavoriteRequest } from '../types/favorite.types';

export class FavoriteRepository {
  constructor(private prisma: PrismaClient) {}

  async create(userId: string, data: CreateFavoriteRequest): Promise<Favorite> {
    return this.prisma.favorite.create({
      data: {
        userId,
        propertyId: data.propertyId,
      },
    });
  }

  async findByUserAndProperty(userId: string, propertyId: string): Promise<Favorite | null> {
    return this.prisma.favorite.findUnique({
      where: {
        userId_propertyId: {
          userId,
          propertyId,
        },
      },
    });
  }

  async findByUser(
    userId: string,
    page: number = 1,
    limit: number = 10
  ): Promise<{ favorites: Favorite[]; total: number }> {
    const skip = (page - 1) * limit;

    const [favorites, total] = await Promise.all([
      this.prisma.favorite.findMany({
        where: { userId },
        include: {
          property: {
            include: {
              images: {
                orderBy: { order: 'asc' },
                take: 1, // Only get the first image for listing
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.favorite.count({
        where: { userId },
      }),
    ]);

    return { favorites, total };
  }

  async delete(userId: string, propertyId: string): Promise<boolean> {
    try {
      await this.prisma.favorite.delete({
        where: {
          userId_propertyId: {
            userId,
            propertyId,
          },
        },
      });
      return true;
    } catch (error) {
      return false;
    }
  }

  async deleteById(id: string, userId: string): Promise<boolean> {
    try {
      await this.prisma.favorite.delete({
        where: {
          id,
          userId, // Ensure user can only delete their own favorites
        },
      });
      return true;
    } catch (error) {
      return false;
    }
  }

  async getFavoriteStatus(userId: string, propertyId: string): Promise<{ isFavorited: boolean; favoriteId?: string }> {
    const favorite = await this.findByUserAndProperty(userId, propertyId);
    return {
      isFavorited: !!favorite,
      ...(favorite && { favoriteId: favorite.id }),
    };
  }

  async getFavoriteStatusForProperties(userId: string, propertyIds: string[]): Promise<Record<string, boolean>> {
    const favorites = await this.prisma.favorite.findMany({
      where: {
        userId,
        propertyId: { in: propertyIds },
      },
      select: {
        propertyId: true,
      },
    });

    const favoriteMap: Record<string, boolean> = {};
    propertyIds.forEach(id => {
      favoriteMap[id] = false;
    });

    favorites.forEach(favorite => {
      favoriteMap[favorite.propertyId] = true;
    });

    return favoriteMap;
  }

  async countByProperty(propertyId: string): Promise<number> {
    return this.prisma.favorite.count({
      where: { propertyId },
    });
  }

  async findUnavailableFavorites(userId: string): Promise<Favorite[]> {
    return this.prisma.favorite.findMany({
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
  }
}