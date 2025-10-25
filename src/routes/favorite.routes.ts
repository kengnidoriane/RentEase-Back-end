import { Router } from 'express';
import { FavoriteController } from '../controllers/favorite.controller';
import { FavoriteService } from '../services/favorite.service';
import { FavoriteRepository } from '../repositories/favorite.repository';
import { PropertyRepository } from '../repositories/property.repository';
import { authenticate } from '../middleware/auth.middleware';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

// Initialize dependencies
const favoriteRepository = new FavoriteRepository(prisma);
const propertyRepository = new PropertyRepository(prisma);
const favoriteService = new FavoriteService(favoriteRepository, propertyRepository);
const favoriteController = new FavoriteController(favoriteService);

// All routes require authentication
router.use(authenticate);

// Add property to favorites
router.post('/', favoriteController.addToFavorites);

// Get user's favorites with pagination
router.get('/', favoriteController.getUserFavorites);

// Get favorite status for a specific property
router.get('/status/:propertyId', favoriteController.getFavoriteStatus);

// Get favorite status for multiple properties (batch)
router.post('/status/batch', favoriteController.getFavoriteStatusBatch);

// Get unavailable favorites (properties that are no longer active)
router.get('/unavailable', favoriteController.getUnavailableFavorites);

// Check and notify about unavailable favorites
router.post('/check-unavailable', favoriteController.checkUnavailableFavorites);

// Remove property from favorites by property ID
router.delete('/property/:propertyId', favoriteController.removeFromFavorites);

// Remove favorite by favorite ID
router.delete('/:favoriteId', favoriteController.removeFavoriteById);

export default router;