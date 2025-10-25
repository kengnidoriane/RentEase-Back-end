import { Request, Response, NextFunction } from 'express';
import { PropertyService } from '../services/property.service';
import { prisma } from '../config/database';
import {
  CreatePropertyRequest,
  UpdatePropertyRequest,
  PropertySearchQuery,
  PropertyVerificationRequest,
} from '../types/property.types';
import { AuthenticatedRequest } from '../types/auth.types';

export class PropertyController {
  private propertyService: PropertyService;

  constructor() {
    this.propertyService = new PropertyService(prisma);
  }

  createProperty = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user?.id) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'User not authenticated' }
        });
      }
      
      const landlordId = req.user.id;
      const propertyData: CreatePropertyRequest = req.body;

      const property = await this.propertyService.createProperty(landlordId, propertyData);

      res.status(201).json({
        success: true,
        data: property,
        message: 'Property created successfully. It will be reviewed before being published.',
      });
    } catch (error) {
      next(error);
    }
  };

  getProperty = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.params['id']) {
        return res.status(400).json({
          success: false,
          error: { code: 'BAD_REQUEST', message: 'Property ID is required' }
        });
      }
      
      const id = req.params['id'];
      const userId = req.user?.id;

      // Use the enhanced method that includes favorite status
      const property = await this.propertyService.getPropertyByIdWithFavorites(id, userId);

      res.json({
        success: true,
        data: property,
      });
    } catch (error) {
      next(error);
    }
  };

  getMyProperties = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user?.id) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'User not authenticated' }
        });
      }
      
      const landlordId = req.user.id;

      const properties = await this.propertyService.getPropertiesByLandlord(landlordId, landlordId);

      res.json({
        success: true,
        data: properties,
      });
    } catch (error) {
      next(error);
    }
  };

  getLandlordProperties = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user?.id || !req.params['landlordId']) {
        return res.status(400).json({
          success: false,
          error: { code: 'BAD_REQUEST', message: 'Missing required parameters' }
        });
      }
      
      const landlordId = req.params['landlordId'];
      const requesterId = req.user.id;

      const properties = await this.propertyService.getPropertiesByLandlord(landlordId, requesterId);

      res.json({
        success: true,
        data: properties,
      });
    } catch (error) {
      next(error);
    }
  };

  searchProperties = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const filters: any = {};
      
      if (req.query['city']) filters.city = req.query['city'] as string;
      if (req.query['minPrice']) filters.minPrice = Number(req.query['minPrice']);
      if (req.query['maxPrice']) filters.maxPrice = Number(req.query['maxPrice']);
      if (req.query['propertyType']) filters.propertyType = req.query['propertyType'] as any;
      if (req.query['bedrooms']) filters.bedrooms = Number(req.query['bedrooms']);
      if (req.query['bathrooms']) filters.bathrooms = Number(req.query['bathrooms']);
      if (req.query['minArea']) filters.minArea = Number(req.query['minArea']);
      if (req.query['maxArea']) filters.maxArea = Number(req.query['maxArea']);
      if (req.query['latitude']) filters.latitude = Number(req.query['latitude']);
      if (req.query['longitude']) filters.longitude = Number(req.query['longitude']);
      if (req.query['radius']) filters.radius = Number(req.query['radius']);
      if (req.query['isVerified'] !== undefined) filters.isVerified = req.query['isVerified'] === 'true';
      else filters.isVerified = true;

      const query: PropertySearchQuery = {
        search: req.query['search'] as string,
        filters,
        sortBy: (req.query['sortBy'] as any) || 'createdAt',
        sortOrder: (req.query['sortOrder'] as any) || 'desc',
        page: req.query['page'] ? Number(req.query['page']) : 1,
        limit: req.query['limit'] ? Number(req.query['limit']) : 20,
      };

      // Use the enhanced search method that includes favorite status
      const userId = req.user?.id;
      const result = await this.propertyService.searchPropertiesWithFavorites(query, userId);

      res.json({
        success: true,
        data: result.properties,
        meta: {
          pagination: result.pagination,
        },
      });
    } catch (error) {
      next(error);
    }
  };

  updateProperty = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user?.id || !req.params['id']) {
        return res.status(400).json({
          success: false,
          error: { code: 'BAD_REQUEST', message: 'Missing required parameters' }
        });
      }
      
      const id = req.params['id'];
      const landlordId = req.user.id;
      const updateData: UpdatePropertyRequest = req.body;

      const property = await this.propertyService.updateProperty(id, landlordId, updateData);

      res.json({
        success: true,
        data: property,
        message: 'Property updated successfully.',
      });
    } catch (error) {
      next(error);
    }
  };

  deleteProperty = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user?.id || !req.params['id']) {
        return res.status(400).json({
          success: false,
          error: { code: 'BAD_REQUEST', message: 'Missing required parameters' }
        });
      }
      
      const id = req.params['id'];
      const landlordId = req.user.id;

      await this.propertyService.deleteProperty(id, landlordId);

      res.json({
        success: true,
        message: 'Property deleted successfully.',
      });
    } catch (error) {
      next(error);
    }
  };

  verifyProperty = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user?.id || !req.params['id']) {
        return res.status(400).json({
          success: false,
          error: { code: 'BAD_REQUEST', message: 'Missing required parameters' }
        });
      }
      
      const adminId = req.user.id;
      const verificationData: PropertyVerificationRequest = {
        propertyId: req.params['id'],
        status: req.body.status,
        rejectionReason: req.body.rejectionReason,
      };

      const property = await this.propertyService.verifyProperty(adminId, verificationData);

      res.json({
        success: true,
        data: property,
        message: `Property ${verificationData.status.toLowerCase()} successfully.`,
      });
    } catch (error) {
      next(error);
    }
  };

  getPendingProperties = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const properties = await this.propertyService.getPendingVerificationProperties();

      res.json({
        success: true,
        data: properties,
      });
    } catch (error) {
      next(error);
    }
  };

  getPropertyStats = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const stats = await this.propertyService.getPropertyStats();

      res.json({
        success: true,
        data: stats,
      });
    } catch (error) {
      next(error);
    }
  };

  addPropertyImages = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user?.id || !req.params['id']) {
        return res.status(400).json({
          success: false,
          error: { code: 'BAD_REQUEST', message: 'Missing required parameters' }
        });
      }
      
      const id = req.params['id'];
      const landlordId = req.user.id;
      const { images } = req.body;

      const property = await this.propertyService.addPropertyImages(id, landlordId, images);

      res.json({
        success: true,
        data: property,
        message: 'Images added successfully.',
      });
    } catch (error) {
      next(error);
    }
  };

  removePropertyImage = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user?.id || !req.params['id'] || !req.params['imageId']) {
        return res.status(400).json({
          success: false,
          error: { code: 'BAD_REQUEST', message: 'Missing required parameters' }
        });
      }
      
      const id = req.params['id'];
      const imageId = req.params['imageId'];
      const landlordId = req.user.id;

      await this.propertyService.removePropertyImage(id, imageId, landlordId);

      res.json({
        success: true,
        message: 'Image removed successfully.',
      });
    } catch (error) {
      next(error);
    }
  };
}