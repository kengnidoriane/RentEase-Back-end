import { Response, NextFunction } from 'express';
import { FavoriteService } from '../services/favorite.service';
import { CreateFavoriteRequest } from '../types/favorite.types';
import { AuthenticatedRequest } from '../types/auth.types';
import { AppError } from '../utils/errors';

export class FavoriteController {
  constructor(private favoriteService: FavoriteService) {}

  addToFavorites = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.id;
      const { propertyId } = req.body as CreateFavoriteRequest;

      if (!propertyId) {
        throw new AppError('Property ID is required', 400);
      }

      const favorite = await this.favoriteService.addToFavorites(userId, { propertyId });

      res.status(201).json({
        success: true,
        data: favorite,
        message: 'Property added to favorites successfully',
      });
    } catch (error) {
      next(error);
    }
  };

  removeFromFavorites = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.id;
      const { propertyId } = req.params;

      if (!propertyId) {
        throw new AppError('Property ID is required', 400);
      }

      await this.favoriteService.removeFromFavorites(userId, propertyId);

      res.json({
        success: true,
        message: 'Property removed from favorites successfully',
      });
    } catch (error) {
      next(error);
    }
  };

  removeFavoriteById = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.id;
      const { favoriteId } = req.params;

      if (!favoriteId) {
        throw new AppError('Favorite ID is required', 400);
      }

      await this.favoriteService.removeFavoriteById(userId, favoriteId);

      res.json({
        success: true,
        message: 'Favorite removed successfully',
      });
    } catch (error) {
      next(error);
    }
  };

  getUserFavorites = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.id;
      const page = parseInt(req.query['page'] as string) || 1;
      const limit = parseInt(req.query['limit'] as string) || 10;

      // Validate pagination parameters
      if (page < 1) {
        throw new AppError('Page must be greater than 0', 400);
      }
      if (limit < 1 || limit > 100) {
        throw new AppError('Limit must be between 1 and 100', 400);
      }

      const result = await this.favoriteService.getUserFavorites(userId, page, limit);

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  getFavoriteStatus = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.id;
      const { propertyId } = req.params;

      if (!propertyId) {
        throw new AppError('Property ID is required', 400);
      }

      const status = await this.favoriteService.getFavoriteStatus(userId, propertyId);

      res.json({
        success: true,
        data: status,
      });
    } catch (error) {
      next(error);
    }
  };

  getFavoriteStatusBatch = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.id;
      const { propertyIds } = req.body;

      if (!Array.isArray(propertyIds) || propertyIds.length === 0) {
        throw new AppError('Property IDs array is required', 400);
      }

      if (propertyIds.length > 50) {
        throw new AppError('Maximum 50 property IDs allowed per request', 400);
      }

      const statuses = await this.favoriteService.getFavoriteStatusForProperties(userId, propertyIds);

      res.json({
        success: true,
        data: statuses,
      });
    } catch (error) {
      next(error);
    }
  };

  getUnavailableFavorites = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.id;

      const unavailableFavorites = await this.favoriteService.getUnavailableFavorites(userId);

      res.json({
        success: true,
        data: {
          favorites: unavailableFavorites,
          count: unavailableFavorites.length,
        },
        message: unavailableFavorites.length > 0 
          ? `Found ${unavailableFavorites.length} unavailable favorite(s)`
          : 'All your favorites are still available',
      });
    } catch (error) {
      next(error);
    }
  };

  checkUnavailableFavorites = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.id;

      await this.favoriteService.checkAndNotifyUnavailableFavorites(userId);

      res.json({
        success: true,
        message: 'Checked for unavailable favorites and sent notifications if needed',
      });
    } catch (error) {
      next(error);
    }
  };
}