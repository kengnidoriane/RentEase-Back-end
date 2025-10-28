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

/**
 * @swagger
 * /api/favorites:
 *   post:
 *     summary: Add property to favorites
 *     tags: [Favorites]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - propertyId
 *             properties:
 *               propertyId:
 *                 type: string
 *                 example: "clp987zyx654wvu321"
 *     responses:
 *       201:
 *         description: Property added to favorites successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/Favorite'
 *       400:
 *         description: Property already in favorites or validation error
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Property not found
 */
router.post('/', favoriteController.addToFavorites);

/**
 * @swagger
 * /api/favorites:
 *   get:
 *     summary: Get user's favorite properties
 *     tags: [Favorites]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Page number for pagination
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 10
 *         description: Number of favorites per page
 *       - in: query
 *         name: includeUnavailable
 *         schema:
 *           type: boolean
 *           default: false
 *         description: Include unavailable properties in results
 *     responses:
 *       200:
 *         description: Favorites retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Favorite'
 *                     meta:
 *                       type: object
 *                       properties:
 *                         pagination:
 *                           type: object
 *                           properties:
 *                             page:
 *                               type: integer
 *                             limit:
 *                               type: integer
 *                             total:
 *                               type: integer
 *                             totalPages:
 *                               type: integer
 *       401:
 *         description: Unauthorized
 */
router.get('/', favoriteController.getUserFavorites);

/**
 * @swagger
 * /api/favorites/status/{propertyId}:
 *   get:
 *     summary: Check if property is in user's favorites
 *     tags: [Favorites]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: propertyId
 *         required: true
 *         schema:
 *           type: string
 *         description: Property ID to check
 *     responses:
 *       200:
 *         description: Favorite status retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         isFavorite:
 *                           type: boolean
 *                         favoriteId:
 *                           type: string
 *                           nullable: true
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Property not found
 */
router.get('/status/:propertyId', favoriteController.getFavoriteStatus);

// Get favorite status for multiple properties (batch)
router.post('/status/batch', favoriteController.getFavoriteStatusBatch);

// Get unavailable favorites (properties that are no longer active)
router.get('/unavailable', favoriteController.getUnavailableFavorites);

// Check and notify about unavailable favorites
router.post('/check-unavailable', favoriteController.checkUnavailableFavorites);

/**
 * @swagger
 * /api/favorites/property/{propertyId}:
 *   delete:
 *     summary: Remove property from favorites
 *     tags: [Favorites]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: propertyId
 *         required: true
 *         schema:
 *           type: string
 *         description: Property ID to remove from favorites
 *     responses:
 *       200:
 *         description: Property removed from favorites successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         message:
 *                           type: string
 *                           example: "Property removed from favorites"
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Property not found in favorites
 */
router.delete('/property/:propertyId', favoriteController.removeFromFavorites);

// Remove favorite by favorite ID
router.delete('/:favoriteId', favoriteController.removeFavoriteById);

export default router;