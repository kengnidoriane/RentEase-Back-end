import { Property, PropertyType, VerificationStatus } from '@prisma/client';

export interface CreatePropertyData {
  title?: string;
  description?: string;
  price?: number;
  currency?: string;
  propertyType?: PropertyType;
  bedrooms?: number;
  bathrooms?: number;
  area?: number;
  address?: string;
  city?: string;
  latitude?: number;
  longitude?: number;
  landlordId?: string;
  isVerified?: boolean;
  isActive?: boolean;
  verificationStatus?: VerificationStatus;
}

export const createPropertyData = (
  overrides: CreatePropertyData = {}
): Omit<Property, 'id' | 'createdAt' | 'updatedAt'> => ({
  title: overrides.title || 'Beautiful Apartment in City Center',
  description:
    overrides.description || 'A lovely apartment with modern amenities and great location.',
  price: overrides.price || 1200,
  currency: overrides.currency || 'EUR',
  propertyType: overrides.propertyType || PropertyType.APARTMENT,
  bedrooms: overrides.bedrooms || 2,
  bathrooms: overrides.bathrooms || 1,
  area: overrides.area || 75,
  address: overrides.address || '123 Main Street',
  city: overrides.city || 'Paris',
  latitude: overrides.latitude || 48.8566,
  longitude: overrides.longitude || 2.3522,
  landlordId: overrides.landlordId || 'landlord-id',
  isVerified: overrides.isVerified ?? false,
  isActive: overrides.isActive ?? true,
  verificationStatus: overrides.verificationStatus || VerificationStatus.PENDING,
  rejectionReason: null,
});

export const createVerifiedPropertyData = (
  overrides: CreatePropertyData = {}
): Omit<Property, 'id' | 'createdAt' | 'updatedAt'> => {
  return createPropertyData({
    isVerified: true,
    verificationStatus: VerificationStatus.APPROVED,
    ...overrides,
  });
};
