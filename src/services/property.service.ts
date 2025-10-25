import { PrismaClient, VerificationStatus } from '@prisma/client';
import { PropertyRepository } from '../repositories/property.repository';
import { FavoriteRepository } from '../repositories/favorite.repository';
import {
  Property,
  CreatePropertyRequest,
  UpdatePropertyRequest,
  PropertySearchQuery,
  PropertySearchResult,
  PropertyVerificationRequest,
  PropertyStats,
} from '../types/property.types';
import { AppError } from '../utils/errors';

export class PropertyService {
  private propertyRepository: PropertyRepository;
  private favoriteRepository: FavoriteRepository;

  constructor(private prisma: PrismaClient) {
    this.propertyRepository = new PropertyRepository(prisma);
    this.favoriteRepository = new FavoriteRepository(prisma);
  }

  async createProperty(landlordId: string, data: CreatePropertyRequest): Promise<Property> {
    // Validate that the user is a verified landlord
    const landlord = await this.prisma.user.findUnique({
      where: { id: landlordId },
    });

    if (!landlord) {
      throw new AppError('Landlord not found', 404);
    }

    if (landlord.userType !== 'LANDLORD') {
      throw new AppError('Only landlords can create properties', 403);
    }

    if (!landlord.isVerified) {
      throw new AppError('Landlord must be verified to create properties', 403);
    }

    // Create property with pending verification status
    const property = await this.propertyRepository.create({
      ...data,
      landlord: {
        connect: { id: landlordId },
      },
      verificationStatus: 'PENDING',
      isVerified: false,
    });

    return property;
  }

  async getPropertyById(id: string, userId?: string): Promise<Property> {
    const property = await this.propertyRepository.findById(id);

    if (!property) {
      throw new AppError('Property not found', 404);
    }

    // If property is not verified, only allow landlord and admin to view
    if (!property.isVerified) {
      if (!userId) {
        throw new AppError('Property not found', 404);
      }

      const user = await this.prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        throw new AppError('User not found', 404);
      }

      if (user.userType !== 'ADMIN' && property.landlordId !== userId) {
        throw new AppError('Property not found', 404);
      }
    }

    return property;
  }

  async getPropertiesByLandlord(landlordId: string, requesterId: string): Promise<Property[]> {
    // Verify that the requester is the landlord or an admin
    const requester = await this.prisma.user.findUnique({
      where: { id: requesterId },
    });

    if (!requester) {
      throw new AppError('User not found', 404);
    }

    if (requester.userType !== 'ADMIN' && requesterId !== landlordId) {
      throw new AppError('Access denied', 403);
    }

    const properties = await this.propertyRepository.findByLandlordId(landlordId, true);
    return properties;
  }

  async searchProperties(query: PropertySearchQuery): Promise<PropertySearchResult> {
    const { page = 1, limit = 20 } = query;

    // For location-based search
    if (query.filters?.latitude && query.filters?.longitude && query.filters?.radius) {
      const { properties, total } = await this.propertyRepository.searchByLocation(
        query.filters.latitude,
        query.filters.longitude,
        query.filters.radius,
        query.filters,
        page,
        limit
      );

      return {
        properties: properties,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    }

    // Regular search
    const { properties, total } = await this.propertyRepository.search(query);

    return {
      properties: properties,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async updateProperty(
    propertyId: string,
    landlordId: string,
    data: UpdatePropertyRequest
  ): Promise<Property> {
    const property = await this.propertyRepository.findById(propertyId, true);

    if (!property) {
      throw new AppError('Property not found', 404);
    }

    if (property.landlordId !== landlordId) {
      throw new AppError('Access denied', 403);
    }

    // If property details are being updated, reset verification status
    const shouldResetVerification = 
      data.title !== undefined ||
      data.description !== undefined ||
      data.price !== undefined ||
      data.propertyType !== undefined ||
      data.bedrooms !== undefined ||
      data.bathrooms !== undefined ||
      data.area !== undefined ||
      data.address !== undefined ||
      data.city !== undefined ||
      data.latitude !== undefined ||
      data.longitude !== undefined;

    const updateData: any = { ...data };
    if (shouldResetVerification && property.isVerified) {
      updateData.verificationStatus = 'PENDING';
      updateData.isVerified = false;
      updateData.rejectionReason = null;
    }

    const updatedProperty = await this.propertyRepository.update(propertyId, updateData);
    return updatedProperty;
  }

  async deleteProperty(propertyId: string, landlordId: string): Promise<void> {
    const property = await this.propertyRepository.findById(propertyId, true);

    if (!property) {
      throw new AppError('Property not found', 404);
    }

    if (property.landlordId !== landlordId) {
      throw new AppError('Access denied', 403);
    }

    await this.propertyRepository.delete(propertyId);
  }

  async verifyProperty(adminId: string, request: PropertyVerificationRequest): Promise<Property> {
    // Verify that the user is an admin
    const admin = await this.prisma.user.findUnique({
      where: { id: adminId },
    });

    if (!admin || admin.userType !== 'ADMIN') {
      throw new AppError('Access denied', 403);
    }

    const property = await this.propertyRepository.findById(request.propertyId, true);

    if (!property) {
      throw new AppError('Property not found', 404);
    }

    const updatedProperty = await this.propertyRepository.updateVerificationStatus(
      request.propertyId,
      request.status as VerificationStatus,
      request.rejectionReason
    );

    // TODO: Send notification to landlord about verification status change
    // This would be implemented in the notification service

    return updatedProperty;
  }

  async getPendingVerificationProperties(): Promise<Property[]> {
    const properties = await this.propertyRepository.findPendingVerification();
    return properties;
  }

  async getPropertyStats(): Promise<PropertyStats> {
    return this.propertyRepository.getStats();
  }

  async addPropertyImages(
    propertyId: string,
    landlordId: string,
    images: Array<{ url: string; altText: string }>
  ): Promise<Property> {
    const property = await this.propertyRepository.findById(propertyId, true);

    if (!property) {
      throw new AppError('Property not found', 404);
    }

    if (property.landlordId !== landlordId) {
      throw new AppError('Access denied', 403);
    }

    // Get current max order
    const currentImages = await this.prisma.propertyImage.findMany({
      where: { propertyId },
      orderBy: { order: 'desc' },
      take: 1,
    });

    const startOrder = currentImages.length > 0 ? currentImages[0]!.order + 1 : 1;

    // Add new images
    const imageData = images.map((image, index) => ({
      ...image,
      propertyId,
      order: startOrder + index,
    }));

    await this.prisma.propertyImage.createMany({
      data: imageData,
    });

    // Return updated property
    const updatedProperty = await this.propertyRepository.findById(propertyId, true);
    if (!updatedProperty) {
      throw new AppError('Property not found after update', 404);
    }
    return updatedProperty;
  }

  async removePropertyImage(
    propertyId: string,
    imageId: string,
    landlordId: string
  ): Promise<void> {
    const property = await this.propertyRepository.findById(propertyId, true);

    if (!property) {
      throw new AppError('Property not found', 404);
    }

    if (property.landlordId !== landlordId) {
      throw new AppError('Access denied', 403);
    }

    const image = await this.prisma.propertyImage.findFirst({
      where: { id: imageId, propertyId },
    });

    if (!image) {
      throw new AppError('Image not found', 404);
    }

    await this.prisma.propertyImage.delete({
      where: { id: imageId },
    });
  }

  // Helper method to add favorite status to properties
  private async addFavoriteStatusToProperties(properties: Property[], userId?: string): Promise<Property[]> {
    if (!userId) {
      return properties.map(property => ({ ...property, isFavorited: false }));
    }

    const propertyIds = properties.map(p => p.id);
    const favoriteStatuses = await this.favoriteRepository.getFavoriteStatusForProperties(userId, propertyIds);

    return properties.map(property => ({
      ...property,
      isFavorited: favoriteStatuses[property.id] || false,
    }));
  }

  // Enhanced search method with favorite status
  async searchPropertiesWithFavorites(query: PropertySearchQuery, userId?: string): Promise<PropertySearchResult> {
    const result = await this.searchProperties(query);
    const propertiesWithFavorites = await this.addFavoriteStatusToProperties(result.properties, userId);

    return {
      ...result,
      properties: propertiesWithFavorites,
    };
  }

  // Enhanced get property by id with favorite status
  async getPropertyByIdWithFavorites(id: string, userId?: string): Promise<Property> {
    const property = await this.getPropertyById(id, userId);
    
    if (userId) {
      const favoriteStatus = await this.favoriteRepository.getFavoriteStatus(userId, id);
      return { ...property, isFavorited: favoriteStatus.isFavorited };
    }

    return { ...property, isFavorited: false };
  }
}