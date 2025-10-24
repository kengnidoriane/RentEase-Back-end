import { PrismaClient, Property, PropertyType, VerificationStatus, Prisma } from '@prisma/client';
import { PropertySearchFilters, PropertySearchQuery } from '../types/property.types';

export class PropertyRepository {
  constructor(private prisma: PrismaClient) {}

  async create(data: Prisma.PropertyCreateInput): Promise<Property> {
    return this.prisma.property.create({
      data,
      include: {
        landlord: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            profilePicture: true,
            isVerified: true,
          },
        },
        images: {
          orderBy: { order: 'asc' },
        },
        _count: {
          select: { favorites: true },
        },
      },
    });
  }

  async findById(id: string, includeInactive = false): Promise<Property | null> {
    const whereClause: Prisma.PropertyWhereInput = { id };
    if (!includeInactive) {
      whereClause.isActive = true;
    }

    return this.prisma.property.findFirst({
      where: whereClause,
      include: {
        landlord: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            profilePicture: true,
            isVerified: true,
          },
        },
        images: {
          orderBy: { order: 'asc' },
        },
        _count: {
          select: { favorites: true },
        },
      },
    });
  }

  async findByLandlordId(landlordId: string, includeInactive = false): Promise<Property[]> {
    const whereClause: Prisma.PropertyWhereInput = { landlordId };
    if (!includeInactive) {
      whereClause.isActive = true;
    }

    return this.prisma.property.findMany({
      where: whereClause,
      include: {
        landlord: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            profilePicture: true,
            isVerified: true,
          },
        },
        images: {
          orderBy: { order: 'asc' },
        },
        _count: {
          select: { favorites: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async search(query: PropertySearchQuery): Promise<{ properties: Property[]; total: number }> {
    const { search, filters, sortBy = 'createdAt', sortOrder = 'desc', page = 1, limit = 20 } = query;
    
    const whereClause: Prisma.PropertyWhereInput = {
      isActive: true,
      isVerified: filters?.isVerified ?? true,
    };

    // Text search
    if (search) {
      whereClause.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { address: { contains: search, mode: 'insensitive' } },
        { city: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Apply filters
    if (filters) {
      if (filters.city) {
        whereClause.city = { contains: filters.city, mode: 'insensitive' };
      }
      
      // Handle price filters
      const priceFilter: any = {};
      if (filters.minPrice !== undefined) {
        priceFilter.gte = filters.minPrice;
      }
      if (filters.maxPrice !== undefined) {
        priceFilter.lte = filters.maxPrice;
      }
      if (Object.keys(priceFilter).length > 0) {
        whereClause.price = priceFilter;
      }
      
      if (filters.propertyType) {
        whereClause.propertyType = filters.propertyType as PropertyType;
      }
      if (filters.bedrooms !== undefined) {
        whereClause.bedrooms = filters.bedrooms;
      }
      if (filters.bathrooms !== undefined) {
        whereClause.bathrooms = filters.bathrooms;
      }
      
      // Handle area filters
      const areaFilter: any = {};
      if (filters.minArea !== undefined) {
        areaFilter.gte = filters.minArea;
      }
      if (filters.maxArea !== undefined) {
        areaFilter.lte = filters.maxArea;
      }
      if (Object.keys(areaFilter).length > 0) {
        whereClause.area = areaFilter;
      }
    }

    // Build order by clause
    let orderBy: Prisma.PropertyOrderByWithRelationInput = {};
    switch (sortBy) {
      case 'price':
        orderBy = { price: sortOrder };
        break;
      case 'createdAt':
        orderBy = { createdAt: sortOrder };
        break;
      case 'relevance':
        // For relevance, we'll use createdAt for now
        // In a real implementation, you might use full-text search scoring
        orderBy = { createdAt: 'desc' };
        break;
      case 'distance':
        // Distance sorting requires raw SQL for geospatial calculations
        // For now, we'll fall back to createdAt
        orderBy = { createdAt: 'desc' };
        break;
      default:
        orderBy = { createdAt: 'desc' };
    }

    const skip = (page - 1) * limit;

    const [properties, total] = await Promise.all([
      this.prisma.property.findMany({
        where: whereClause,
        include: {
          landlord: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              profilePicture: true,
              isVerified: true,
            },
          },
          images: {
            orderBy: { order: 'asc' },
          },
          _count: {
            select: { favorites: true },
          },
        },
        orderBy,
        skip,
        take: limit,
      }),
      this.prisma.property.count({ where: whereClause }),
    ]);

    return { properties, total };
  }

  async searchByLocation(
    latitude: number,
    longitude: number,
    radius: number,
    filters?: PropertySearchFilters,
    page = 1,
    limit = 20
  ): Promise<{ properties: Property[]; total: number }> {
    // Using Haversine formula for distance calculation
    // This is a simplified version - in production, you might want to use PostGIS
    const radiusInDegrees = radius / 111; // Approximate conversion from km to degrees

    const whereClause: Prisma.PropertyWhereInput = {
      isActive: true,
      isVerified: filters?.isVerified ?? true,
      latitude: {
        gte: latitude - radiusInDegrees,
        lte: latitude + radiusInDegrees,
      },
      longitude: {
        gte: longitude - radiusInDegrees,
        lte: longitude + radiusInDegrees,
      },
    };

    // Apply additional filters
    if (filters) {
      // Handle price filters
      const priceFilter: any = {};
      if (filters.minPrice !== undefined) {
        priceFilter.gte = filters.minPrice;
      }
      if (filters.maxPrice !== undefined) {
        priceFilter.lte = filters.maxPrice;
      }
      if (Object.keys(priceFilter).length > 0) {
        whereClause.price = priceFilter;
      }
      
      if (filters.propertyType) {
        whereClause.propertyType = filters.propertyType as PropertyType;
      }
      if (filters.bedrooms !== undefined) {
        whereClause.bedrooms = filters.bedrooms;
      }
      if (filters.bathrooms !== undefined) {
        whereClause.bathrooms = filters.bathrooms;
      }
    }

    const skip = (page - 1) * limit;

    const [properties, total] = await Promise.all([
      this.prisma.property.findMany({
        where: whereClause,
        include: {
          landlord: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              profilePicture: true,
              isVerified: true,
            },
          },
          images: {
            orderBy: { order: 'asc' },
          },
          _count: {
            select: { favorites: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.property.count({ where: whereClause }),
    ]);

    return { properties, total };
  }

  async update(id: string, data: Prisma.PropertyUpdateInput): Promise<Property> {
    return this.prisma.property.update({
      where: { id },
      data,
      include: {
        landlord: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            profilePicture: true,
            isVerified: true,
          },
        },
        images: {
          orderBy: { order: 'asc' },
        },
        _count: {
          select: { favorites: true },
        },
      },
    });
  }

  async updateVerificationStatus(
    id: string,
    status: VerificationStatus,
    rejectionReason?: string
  ): Promise<Property> {
    const updateData: any = {
      verificationStatus: status,
      isVerified: status === 'APPROVED',
    };
    
    if (status === 'REJECTED' && rejectionReason) {
      updateData.rejectionReason = rejectionReason;
    } else if (status === 'APPROVED') {
      updateData.rejectionReason = null;
    }

    return this.prisma.property.update({
      where: { id },
      data: updateData,
      include: {
        landlord: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            profilePicture: true,
            isVerified: true,
          },
        },
        images: {
          orderBy: { order: 'asc' },
        },
        _count: {
          select: { favorites: true },
        },
      },
    });
  }

  async delete(id: string): Promise<Property> {
    return this.prisma.property.update({
      where: { id },
      data: { isActive: false },
      include: {
        landlord: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            profilePicture: true,
            isVerified: true,
          },
        },
        images: {
          orderBy: { order: 'asc' },
        },
        _count: {
          select: { favorites: true },
        },
      },
    });
  }

  async findPendingVerification(): Promise<Property[]> {
    return this.prisma.property.findMany({
      where: {
        verificationStatus: 'PENDING',
        isActive: true,
      },
      include: {
        landlord: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            profilePicture: true,
            isVerified: true,
          },
        },
        images: {
          orderBy: { order: 'asc' },
        },
        _count: {
          select: { favorites: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async getStats(): Promise<{
    totalProperties: number;
    verifiedProperties: number;
    pendingProperties: number;
    rejectedProperties: number;
    propertiesByType: Record<string, number>;
    propertiesByCity: Record<string, number>;
  }> {
    const [
      totalProperties,
      verifiedProperties,
      pendingProperties,
      rejectedProperties,
      propertiesByType,
      propertiesByCity,
    ] = await Promise.all([
      this.prisma.property.count({ where: { isActive: true } }),
      this.prisma.property.count({ where: { isActive: true, isVerified: true } }),
      this.prisma.property.count({ where: { isActive: true, verificationStatus: 'PENDING' } }),
      this.prisma.property.count({ where: { isActive: true, verificationStatus: 'REJECTED' } }),
      this.prisma.property.groupBy({
        by: ['propertyType'],
        where: { isActive: true },
        _count: { id: true },
      }),
      this.prisma.property.groupBy({
        by: ['city'],
        where: { isActive: true },
        _count: { id: true },
      }),
    ]);

    const typeStats = propertiesByType.reduce((acc, item) => {
      acc[item.propertyType] = item._count.id;
      return acc;
    }, {} as Record<string, number>);

    const cityStats = propertiesByCity.reduce((acc, item) => {
      acc[item.city] = item._count.id;
      return acc;
    }, {} as Record<string, number>);

    return {
      totalProperties,
      verifiedProperties,
      pendingProperties,
      rejectedProperties,
      propertiesByType: typeStats,
      propertiesByCity: cityStats,
    };
  }
}