import request from 'supertest';
import { Express } from 'express';
import { PrismaClient, UserType, PropertyType, VerificationStatus } from '@prisma/client';
import express from 'express';
import { createUserData } from '../factories/userFactory';
import { createPropertyData } from '../factories/propertyFactory';

// Mock test app creation
const createTestApp = async (): Promise<Express> => {
  const app = express();
  app.use(express.json());
  
  // Mock routes for testing
  app.post('/api/auth/login', (req, res) => {
    res.json({
      success: true,
      data: { accessToken: 'mock-token' }
    });
  });
  
  return app;
};

describe('Property Integration Tests', () => {
  let app: Express;
  let prisma: PrismaClient;
  let landlordToken: string;
  let tenantToken: string;
  let adminToken: string;
  let landlordId: string;


  beforeAll(async () => {
    app = await createTestApp();
    prisma = new PrismaClient();
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    // Clean up database
    await prisma.propertyImage.deleteMany();
    await prisma.property.deleteMany();
    await prisma.user.deleteMany();

    // Create test users
    const landlordData = createUserData({
      userType: UserType.LANDLORD,
      isVerified: true,
    });
    const tenantData = createUserData({
      email: 'tenant@example.com',
      userType: UserType.TENANT,
      isVerified: true,
    });
    const adminData = createUserData({
      email: 'admin@example.com',
      userType: UserType.ADMIN,
      isVerified: true,
    });

    const landlord = await prisma.user.create({ data: landlordData });
    const tenant = await prisma.user.create({ data: tenantData });
    const admin = await prisma.user.create({ data: adminData });

    landlordId = landlord.id;

    // Get auth tokens
    const landlordLoginResponse = await request(app)
      .post('/api/auth/login')
      .send({
        email: landlordData.email,
        password: 'password123',
      });

    const tenantLoginResponse = await request(app)
      .post('/api/auth/login')
      .send({
        email: tenantData.email,
        password: 'password123',
      });

    const adminLoginResponse = await request(app)
      .post('/api/auth/login')
      .send({
        email: adminData.email,
        password: 'password123',
      });

    landlordToken = landlordLoginResponse.body.data.accessToken;
    tenantToken = tenantLoginResponse.body.data.accessToken;
    adminToken = adminLoginResponse.body.data.accessToken;
  });

  describe('POST /api/properties', () => {
    const propertyData = {
      title: 'Beautiful Apartment',
      description: 'A lovely apartment with modern amenities and great location.',
      price: 1200,
      currency: 'EUR',
      propertyType: 'APARTMENT',
      bedrooms: 2,
      bathrooms: 1,
      area: 75,
      address: '123 Main Street',
      city: 'Paris',
      latitude: 48.8566,
      longitude: 2.3522,
    };

    it('should create property for verified landlord', async () => {
      const response = await request(app)
        .post('/api/properties')
        .set('Authorization', `Bearer ${landlordToken}`)
        .send(propertyData);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toMatchObject({
        title: propertyData.title,
        price: propertyData.price,
        landlordId,
        isVerified: false,
        verificationStatus: 'PENDING',
      });
    });

    it('should reject property creation for tenant', async () => {
      const response = await request(app)
        .post('/api/properties')
        .set('Authorization', `Bearer ${tenantToken}`)
        .send(propertyData);

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
    });

    it('should reject property creation without authentication', async () => {
      const response = await request(app)
        .post('/api/properties')
        .send(propertyData);

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    it('should validate required fields', async () => {
      const invalidData: any = { ...propertyData };
      delete invalidData.title;

      const response = await request(app)
        .post('/api/properties')
        .set('Authorization', `Bearer ${landlordToken}`)
        .send(invalidData);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toContain('validation');
    });

    it('should validate property type', async () => {
      const invalidData = {
        ...propertyData,
        propertyType: 'INVALID_TYPE',
      };

      const response = await request(app)
        .post('/api/properties')
        .set('Authorization', `Bearer ${landlordToken}`)
        .send(invalidData);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should validate price range', async () => {
      const invalidData = {
        ...propertyData,
        price: -100,
      };

      const response = await request(app)
        .post('/api/properties')
        .set('Authorization', `Bearer ${landlordToken}`)
        .send(invalidData);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/properties/search', () => {
    beforeEach(async () => {
      // Create test properties
      const property1 = createPropertyData({
        title: 'Apartment in Paris',
        city: 'Paris',
        price: 1200,
        propertyType: PropertyType.APARTMENT,
        bedrooms: 2,
        landlordId,
        isVerified: true,
        verificationStatus: VerificationStatus.APPROVED,
      });

      const property2 = createPropertyData({
        title: 'Studio in Lyon',
        city: 'Lyon',
        price: 800,
        propertyType: PropertyType.STUDIO,
        bedrooms: 0,
        landlordId,
        isVerified: true,
        verificationStatus: VerificationStatus.APPROVED,
      });

      const property3 = createPropertyData({
        title: 'House in Marseille',
        city: 'Marseille',
        price: 2000,
        propertyType: PropertyType.HOUSE,
        bedrooms: 4,
        landlordId,
        isVerified: false,
        verificationStatus: VerificationStatus.PENDING,
      });

      await prisma.property.createMany({
        data: [property1, property2, property3],
      });
    });

    it('should return all verified properties by default', async () => {
      const response = await request(app)
        .get('/api/properties/search');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(2); // Only verified properties
      expect(response.body.meta.pagination).toMatchObject({
        page: 1,
        limit: 20,
        total: 2,
        totalPages: 1,
      });
    });

    it('should filter by city', async () => {
      const response = await request(app)
        .get('/api/properties/search')
        .query({ city: 'Paris' });

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].city).toBe('Paris');
    });

    it('should filter by price range', async () => {
      const response = await request(app)
        .get('/api/properties/search')
        .query({ minPrice: 900, maxPrice: 1500 });

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].price).toBe(1200);
    });

    it('should filter by property type', async () => {
      const response = await request(app)
        .get('/api/properties/search')
        .query({ propertyType: 'STUDIO' });

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].propertyType).toBe('STUDIO');
    });

    it('should filter by bedrooms', async () => {
      const response = await request(app)
        .get('/api/properties/search')
        .query({ bedrooms: 2 });

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].bedrooms).toBe(2);
    });

    it('should support text search', async () => {
      const response = await request(app)
        .get('/api/properties/search')
        .query({ search: 'Studio' });

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].title).toContain('Studio');
    });

    it('should support pagination', async () => {
      const response = await request(app)
        .get('/api/properties/search')
        .query({ page: 1, limit: 1 });

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.meta.pagination).toMatchObject({
        page: 1,
        limit: 1,
        total: 2,
        totalPages: 2,
      });
    });

    it('should sort by price ascending', async () => {
      const response = await request(app)
        .get('/api/properties/search')
        .query({ sortBy: 'price', sortOrder: 'asc' });

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(2);
      expect(response.body.data[0].price).toBeLessThan(response.body.data[1].price);
    });

    it('should validate query parameters', async () => {
      const response = await request(app)
        .get('/api/properties/search')
        .query({ page: -1 });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/properties/:id', () => {
    let verifiedPropertyId: string;
    let unverifiedPropertyId: string;

    beforeEach(async () => {
      const verifiedProperty = await prisma.property.create({
        data: createPropertyData({
          landlordId,
          isVerified: true,
          verificationStatus: VerificationStatus.APPROVED,
        }),
      });

      const unverifiedProperty = await prisma.property.create({
        data: createPropertyData({
          title: 'Unverified Property',
          landlordId,
          isVerified: false,
          verificationStatus: VerificationStatus.PENDING,
        }),
      });

      verifiedPropertyId = verifiedProperty.id;
      unverifiedPropertyId = unverifiedProperty.id;
    });

    it('should return verified property for any user', async () => {
      const response = await request(app)
        .get(`/api/properties/${verifiedPropertyId}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(verifiedPropertyId);
    });

    it('should return unverified property for landlord owner', async () => {
      const response = await request(app)
        .get(`/api/properties/${unverifiedPropertyId}`)
        .set('Authorization', `Bearer ${landlordToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(unverifiedPropertyId);
    });

    it('should return unverified property for admin', async () => {
      const response = await request(app)
        .get(`/api/properties/${unverifiedPropertyId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(unverifiedPropertyId);
    });

    it('should not return unverified property for tenant', async () => {
      const response = await request(app)
        .get(`/api/properties/${unverifiedPropertyId}`)
        .set('Authorization', `Bearer ${tenantToken}`);

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });

    it('should return 404 for non-existent property', async () => {
      const response = await request(app)
        .get('/api/properties/non-existent-id');

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });
  });

  describe('PUT /api/properties/:id', () => {
    let propertyId: string;

    beforeEach(async () => {
      const property = await prisma.property.create({
        data: createPropertyData({
          landlordId,
          isVerified: true,
          verificationStatus: VerificationStatus.APPROVED,
        }),
      });
      propertyId = property.id;
    });

    it('should update property for owner', async () => {
      const updateData = {
        title: 'Updated Title',
        price: 1500,
      };

      const response = await request(app)
        .put(`/api/properties/${propertyId}`)
        .set('Authorization', `Bearer ${landlordToken}`)
        .send(updateData);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.title).toBe(updateData.title);
      expect(response.body.data.price).toBe(updateData.price);
      // Should reset verification status
      expect(response.body.data.isVerified).toBe(false);
      expect(response.body.data.verificationStatus).toBe('PENDING');
    });

    it('should not allow tenant to update property', async () => {
      const updateData = { title: 'Hacked Title' };

      const response = await request(app)
        .put(`/api/properties/${propertyId}`)
        .set('Authorization', `Bearer ${tenantToken}`)
        .send(updateData);

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
    });

    it('should validate update data', async () => {
      const invalidData = { price: -100 };

      const response = await request(app)
        .put(`/api/properties/${propertyId}`)
        .set('Authorization', `Bearer ${landlordToken}`)
        .send(invalidData);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('DELETE /api/properties/:id', () => {
    let propertyId: string;

    beforeEach(async () => {
      const property = await prisma.property.create({
        data: createPropertyData({ landlordId }),
      });
      propertyId = property.id;
    });

    it('should delete property for owner', async () => {
      const response = await request(app)
        .delete(`/api/properties/${propertyId}`)
        .set('Authorization', `Bearer ${landlordToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      // Verify property is soft deleted
      const deletedProperty = await prisma.property.findUnique({
        where: { id: propertyId },
      });
      expect(deletedProperty?.isActive).toBe(false);
    });

    it('should not allow tenant to delete property', async () => {
      const response = await request(app)
        .delete(`/api/properties/${propertyId}`)
        .set('Authorization', `Bearer ${tenantToken}`);

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
    });
  });

  describe('PUT /api/properties/:id/verify', () => {
    let propertyId: string;

    beforeEach(async () => {
      const property = await prisma.property.create({
        data: createPropertyData({
          landlordId,
          verificationStatus: VerificationStatus.PENDING,
        }),
      });
      propertyId = property.id;
    });

    it('should approve property by admin', async () => {
      const response = await request(app)
        .put(`/api/properties/${propertyId}/verify`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'APPROVED' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.verificationStatus).toBe('APPROVED');
      expect(response.body.data.isVerified).toBe(true);
    });

    it('should reject property with reason', async () => {
      const rejectionReason = 'Incomplete information provided';

      const response = await request(app)
        .put(`/api/properties/${propertyId}/verify`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          status: 'REJECTED',
          rejectionReason,
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.verificationStatus).toBe('REJECTED');
      expect(response.body.data.isVerified).toBe(false);
      expect(response.body.data.rejectionReason).toBe(rejectionReason);
    });

    it('should not allow landlord to verify property', async () => {
      const response = await request(app)
        .put(`/api/properties/${propertyId}/verify`)
        .set('Authorization', `Bearer ${landlordToken}`)
        .send({ status: 'APPROVED' });

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
    });

    it('should require rejection reason when rejecting', async () => {
      const response = await request(app)
        .put(`/api/properties/${propertyId}/verify`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'REJECTED' });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/properties/admin/pending', () => {
    beforeEach(async () => {
      // Create properties with different statuses
      await prisma.property.createMany({
        data: [
          createPropertyData({
            title: 'Pending Property 1',
            landlordId,
            verificationStatus: VerificationStatus.PENDING,
          }),
          createPropertyData({
            title: 'Pending Property 2',
            landlordId,
            verificationStatus: VerificationStatus.PENDING,
          }),
          createPropertyData({
            title: 'Approved Property',
            landlordId,
            verificationStatus: VerificationStatus.APPROVED,
          }),
        ],
      });
    });

    it('should return pending properties for admin', async () => {
      const response = await request(app)
        .get('/api/properties/admin/pending')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(2);
      expect(response.body.data.every((p: any) => p.verificationStatus === 'PENDING')).toBe(true);
    });

    it('should not allow landlord to access pending properties', async () => {
      const response = await request(app)
        .get('/api/properties/admin/pending')
        .set('Authorization', `Bearer ${landlordToken}`);

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/properties/admin/stats', () => {
    beforeEach(async () => {
      // Create properties with different statuses and types
      await prisma.property.createMany({
        data: [
          createPropertyData({
            landlordId,
            propertyType: PropertyType.APARTMENT,
            city: 'Paris',
            verificationStatus: VerificationStatus.APPROVED,
            isVerified: true,
          }),
          createPropertyData({
            landlordId,
            propertyType: PropertyType.STUDIO,
            city: 'Paris',
            verificationStatus: VerificationStatus.PENDING,
          }),
          createPropertyData({
            landlordId,
            propertyType: PropertyType.HOUSE,
            city: 'Lyon',
            verificationStatus: VerificationStatus.REJECTED,
          }),
        ],
      });
    });

    it('should return property statistics for admin', async () => {
      const response = await request(app)
        .get('/api/properties/admin/stats')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toMatchObject({
        totalProperties: 3,
        verifiedProperties: 1,
        pendingProperties: 1,
        rejectedProperties: 1,
        propertiesByType: {
          APARTMENT: 1,
          STUDIO: 1,
          HOUSE: 1,
        },
        propertiesByCity: {
          Paris: 2,
          Lyon: 1,
        },
      });
    });

    it('should not allow non-admin to access stats', async () => {
      const response = await request(app)
        .get('/api/properties/admin/stats')
        .set('Authorization', `Bearer ${landlordToken}`);

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
    });
  });
});