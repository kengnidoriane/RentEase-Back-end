import { PropertyType, VerificationStatus, Prisma } from '@prisma/client';

export interface CreatePropertyData {
  id?: string;
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
  rejectionReason?: string | null;
}

export const createPropertyData = (
  overrides: CreatePropertyData = {}
): any => ({
  id: overrides.id || 'property-123',
  title: overrides.title || 'Beautiful Apartment in City Center',
  description:
    overrides.description || 'A lovely apartment with modern amenities and great location.',
  price: new Prisma.Decimal(overrides.price || 1200),
  currency: overrides.currency || 'EUR',
  propertyType: overrides.propertyType || PropertyType.APARTMENT,
  bedrooms: overrides.bedrooms || 2,
  bathrooms: overrides.bathrooms || 1,
  area: new Prisma.Decimal(overrides.area || 75),
  address: overrides.address || '123 Main Street',
  city: overrides.city || 'Paris',
  latitude: new Prisma.Decimal(overrides.latitude || 48.8566),
  longitude: new Prisma.Decimal(overrides.longitude || 2.3522),
  landlordId: overrides.landlordId || 'landlord-id',
  isVerified: overrides.isVerified ?? false,
  isActive: overrides.isActive ?? true,
  verificationStatus: overrides.verificationStatus || VerificationStatus.PENDING,
  rejectionReason: overrides.rejectionReason ?? null,
  createdAt: new Date(),
  updatedAt: new Date(),
});

export const createVerifiedPropertyData = (
  overrides: CreatePropertyData = {}
): any => {
  return createPropertyData({
    isVerified: true,
    verificationStatus: VerificationStatus.APPROVED,
    ...overrides,
  });
};
