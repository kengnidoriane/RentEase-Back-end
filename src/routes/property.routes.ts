import { Router } from 'express';
import { PropertyController } from '../controllers/property.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { validateRequest } from '../middleware/validation.middleware';
const { body, param, query } = require('express-validator');

const router = Router();
const propertyController = new PropertyController();

// Validation schemas
const createPropertyValidation = [
  body('title')
    .isString()
    .isLength({ min: 5, max: 100 })
    .withMessage('Title must be between 5 and 100 characters'),
  body('description')
    .isString()
    .isLength({ min: 20, max: 2000 })
    .withMessage('Description must be between 20 and 2000 characters'),
  body('price')
    .isNumeric()
    .isFloat({ min: 0 })
    .withMessage('Price must be a positive number'),
  body('currency')
    .optional()
    .isString()
    .isLength({ min: 3, max: 3 })
    .withMessage('Currency must be a 3-character code'),
  body('propertyType')
    .isIn(['APARTMENT', 'ROOM', 'HOUSE', 'STUDIO'])
    .withMessage('Property type must be APARTMENT, ROOM, HOUSE, or STUDIO'),
  body('bedrooms')
    .isInt({ min: 0, max: 20 })
    .withMessage('Bedrooms must be between 0 and 20'),
  body('bathrooms')
    .isInt({ min: 0, max: 20 })
    .withMessage('Bathrooms must be between 0 and 20'),
  body('area')
    .isNumeric()
    .isFloat({ min: 1 })
    .withMessage('Area must be a positive number'),
  body('address')
    .isString()
    .isLength({ min: 5, max: 200 })
    .withMessage('Address must be between 5 and 200 characters'),
  body('city')
    .isString()
    .isLength({ min: 2, max: 50 })
    .withMessage('City must be between 2 and 50 characters'),
  body('latitude')
    .isNumeric()
    .isFloat({ min: -90, max: 90 })
    .withMessage('Latitude must be between -90 and 90'),
  body('longitude')
    .isNumeric()
    .isFloat({ min: -180, max: 180 })
    .withMessage('Longitude must be between -180 and 180'),
];

const updatePropertyValidation = [
  body('title')
    .optional()
    .isString()
    .isLength({ min: 5, max: 100 })
    .withMessage('Title must be between 5 and 100 characters'),
  body('description')
    .optional()
    .isString()
    .isLength({ min: 20, max: 2000 })
    .withMessage('Description must be between 20 and 2000 characters'),
  body('price')
    .optional()
    .isNumeric()
    .isFloat({ min: 0 })
    .withMessage('Price must be a positive number'),
  body('currency')
    .optional()
    .isString()
    .isLength({ min: 3, max: 3 })
    .withMessage('Currency must be a 3-character code'),
  body('propertyType')
    .optional()
    .isIn(['APARTMENT', 'ROOM', 'HOUSE', 'STUDIO'])
    .withMessage('Property type must be APARTMENT, ROOM, HOUSE, or STUDIO'),
  body('bedrooms')
    .optional()
    .isInt({ min: 0, max: 20 })
    .withMessage('Bedrooms must be between 0 and 20'),
  body('bathrooms')
    .optional()
    .isInt({ min: 0, max: 20 })
    .withMessage('Bathrooms must be between 0 and 20'),
  body('area')
    .optional()
    .isNumeric()
    .isFloat({ min: 1 })
    .withMessage('Area must be a positive number'),
  body('address')
    .optional()
    .isString()
    .isLength({ min: 5, max: 200 })
    .withMessage('Address must be between 5 and 200 characters'),
  body('city')
    .optional()
    .isString()
    .isLength({ min: 2, max: 50 })
    .withMessage('City must be between 2 and 50 characters'),
  body('latitude')
    .optional()
    .isNumeric()
    .isFloat({ min: -90, max: 90 })
    .withMessage('Latitude must be between -90 and 90'),
  body('longitude')
    .optional()
    .isNumeric()
    .isFloat({ min: -180, max: 180 })
    .withMessage('Longitude must be between -180 and 180'),
  body('isActive')
    .optional()
    .isBoolean()
    .withMessage('isActive must be a boolean'),
];

const propertyIdValidation = [
  param('id')
    .isString()
    .isLength({ min: 1 })
    .withMessage('Property ID is required'),
];

const verifyPropertyValidation = [
  body('status')
    .isIn(['APPROVED', 'REJECTED'])
    .withMessage('Status must be APPROVED or REJECTED'),
  body('rejectionReason')
    .if(body('status').equals('REJECTED'))
    .isString()
    .isLength({ min: 10, max: 500 })
    .withMessage('Rejection reason is required and must be between 10 and 500 characters'),
];

const addImagesValidation = [
  body('images')
    .isArray({ min: 1, max: 10 })
    .withMessage('Images array must contain 1-10 items'),
  body('images.*.url')
    .isURL()
    .withMessage('Each image must have a valid URL'),
  body('images.*.altText')
    .isString()
    .isLength({ min: 1, max: 200 })
    .withMessage('Each image must have alt text between 1 and 200 characters'),
];

const searchValidation = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  query('minPrice')
    .optional()
    .isNumeric()
    .isFloat({ min: 0 })
    .withMessage('Min price must be a positive number'),
  query('maxPrice')
    .optional()
    .isNumeric()
    .isFloat({ min: 0 })
    .withMessage('Max price must be a positive number'),
  query('bedrooms')
    .optional()
    .isInt({ min: 0, max: 20 })
    .withMessage('Bedrooms must be between 0 and 20'),
  query('bathrooms')
    .optional()
    .isInt({ min: 0, max: 20 })
    .withMessage('Bathrooms must be between 0 and 20'),
  query('propertyType')
    .optional()
    .isIn(['APARTMENT', 'ROOM', 'HOUSE', 'STUDIO'])
    .withMessage('Property type must be APARTMENT, ROOM, HOUSE, or STUDIO'),
  query('sortBy')
    .optional()
    .isIn(['price', 'createdAt', 'relevance', 'distance'])
    .withMessage('Sort by must be price, createdAt, relevance, or distance'),
  query('sortOrder')
    .optional()
    .isIn(['asc', 'desc'])
    .withMessage('Sort order must be asc or desc'),
  query('latitude')
    .optional()
    .isNumeric()
    .isFloat({ min: -90, max: 90 })
    .withMessage('Latitude must be between -90 and 90'),
  query('longitude')
    .optional()
    .isNumeric()
    .isFloat({ min: -180, max: 180 })
    .withMessage('Longitude must be between -180 and 180'),
  query('radius')
    .optional()
    .isNumeric()
    .isFloat({ min: 0.1, max: 100 })
    .withMessage('Radius must be between 0.1 and 100 km'),
];

// Public routes
router.get('/search', searchValidation, validateRequest, propertyController.searchProperties);
router.get('/:id', propertyIdValidation, validateRequest, propertyController.getProperty);

// Protected routes - Landlords only
router.post(
  '/',
  authenticate,
  authorize(['LANDLORD']),
  createPropertyValidation,
  validateRequest,
  propertyController.createProperty
);

router.get(
  '/my/properties',
  authenticate,
  authorize(['LANDLORD']),
  propertyController.getMyProperties
);

router.put(
  '/:id',
  authenticate,
  authorize(['LANDLORD']),
  propertyIdValidation,
  updatePropertyValidation,
  validateRequest,
  propertyController.updateProperty
);

router.delete(
  '/:id',
  authenticate,
  authorize(['LANDLORD']),
  propertyIdValidation,
  validateRequest,
  propertyController.deleteProperty
);

router.post(
  '/:id/images',
  authenticate,
  authorize(['LANDLORD']),
  propertyIdValidation,
  addImagesValidation,
  validateRequest,
  propertyController.addPropertyImages
);

router.delete(
  '/:id/images/:imageId',
  authenticate,
  authorize(['LANDLORD']),
  propertyIdValidation,
  param('imageId').isString().isLength({ min: 1 }),
  validateRequest,
  propertyController.removePropertyImage
);

// Admin routes
router.get(
  '/admin/pending',
  authenticate,
  authorize(['ADMIN']),
  propertyController.getPendingProperties
);

router.get(
  '/admin/stats',
  authenticate,
  authorize(['ADMIN']),
  propertyController.getPropertyStats
);

router.get(
  '/admin/landlord/:landlordId',
  authenticate,
  authorize(['ADMIN']),
  param('landlordId').isString().isLength({ min: 1 }),
  validateRequest,
  propertyController.getLandlordProperties
);

router.put(
  '/:id/verify',
  authenticate,
  authorize(['ADMIN']),
  propertyIdValidation,
  verifyPropertyValidation,
  validateRequest,
  propertyController.verifyProperty
);

export default router;