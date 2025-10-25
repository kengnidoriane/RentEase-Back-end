import { Decimal } from '@prisma/client/runtime/library';

export interface Property {
  id: string;
  title: string;
  description: string;
  price: Decimal;
  currency: string;
  propertyType: 'APARTMENT' | 'ROOM' | 'HOUSE' | 'STUDIO';
  bedrooms: number;
  bathrooms: number;
  area: Decimal;
  address: string;
  city: string;
  latitude: Decimal;
  longitude: Decimal;
  isVerified: boolean;
  isActive: boolean;
  verificationStatus: 'PENDING' | 'APPROVED' | 'REJECTED';
  rejectionReason?: string | null;
  createdAt: Date;
  updatedAt: Date;
  landlordId: string;
  landlord?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    profilePicture?: string;
    isVerified: boolean;
  };
  images?: PropertyImage[];
  favorites?: Favorite[];
  _count?: {
    favorites: number;
  };
  isFavorited?: boolean; // For authenticated users
}

export interface PropertyImage {
  id: string;
  url: string;
  altText: string;
  order: number;
  propertyId: string;
}

export interface Favorite {
  id: string;
  createdAt: Date;
  userId: string;
  propertyId: string;
}

export interface CreatePropertyRequest {
  title: string;
  description: string;
  price: number;
  currency?: string;
  propertyType: 'APARTMENT' | 'ROOM' | 'HOUSE' | 'STUDIO';
  bedrooms: number;
  bathrooms: number;
  area: number;
  address: string;
  city: string;
  latitude: number;
  longitude: number;
}

export interface UpdatePropertyRequest {
  title?: string;
  description?: string;
  price?: number;
  currency?: string;
  propertyType?: 'APARTMENT' | 'ROOM' | 'HOUSE' | 'STUDIO';
  bedrooms?: number;
  bathrooms?: number;
  area?: number;
  address?: string;
  city?: string;
  latitude?: number;
  longitude?: number;
  isActive?: boolean;
}

export interface PropertySearchFilters {
  city?: string;
  minPrice?: number;
  maxPrice?: number;
  propertyType?: 'APARTMENT' | 'ROOM' | 'HOUSE' | 'STUDIO';
  bedrooms?: number;
  bathrooms?: number;
  minArea?: number;
  maxArea?: number;
  latitude?: number;
  longitude?: number;
  radius?: number; // in kilometers
  isVerified?: boolean;
}

export interface PropertySearchQuery {
  search?: string;
  filters?: PropertySearchFilters;
  sortBy?: 'price' | 'createdAt' | 'relevance' | 'distance';
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

export interface PropertySearchResult {
  properties: Property[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface PropertyVerificationRequest {
  propertyId: string;
  status: 'APPROVED' | 'REJECTED';
  rejectionReason?: string;
}

export interface PropertyStats {
  totalProperties: number;
  verifiedProperties: number;
  pendingProperties: number;
  rejectedProperties: number;
  propertiesByType: Record<string, number>;
  propertiesByCity: Record<string, number>;
}