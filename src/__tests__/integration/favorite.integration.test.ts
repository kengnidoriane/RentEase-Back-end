import request from 'supertest';
import app from '../../server';
import { PrismaClient } from '@prisma/client';
import { createUserData } from '../factories/userFactory';
import { createPropertyData } from '../factories/propertyFactory';
import { generateTestToken } from '../utils/testUtils';

const prisma = new PrismaClient();

describe('Favorites API Integration Tests', () => {
  let tenantToken: string;
  let landlordToken: string;
  let tenantId: string;
  let landlordId: string;
  let propertyId: string;

  beforeAll(async () => {
    // Create test users
    const tenantData = createUserData({
      email: 'tenant@test.com',
      userType: 'TENANT',
      isVerified: true,
    });
    const tenant = await prisma.user.create({ data: tenantData });
    tenantId = tenant.id;
    tenantToken = generateTestToken(tenant.id, tenant.userType);

    const landlordData = createUserData({
      email: 'landlord@test.com',
      userType: 'LANDLORD',
      isVerified: true,
    });
    const landlord = await prisma.user.create({ data: landlordData });
    landlordId = landlord.id;
    landlordToken = generateTestToken(landlord.id, landlord.userType);

    // Create test property
    const propertyData = createPropertyData({
      landlordId: landlord.id,
      title: 'Test Property for Favorites',
      isActive: true,
      isVerified: true,
    });
    const property = await prisma.property.create({ data: propertyData });
    propertyId = property.id;
  });

  afterAll(async () => {
    // Clean up test data
    await prisma.favorite.deleteMany({
      where: {
        OR: [{ userId: tenantId }, { userId: landlordId }],
      },
    });
    await prisma.propertyImage.deleteMany({
      where: { propertyId },
    });
    await prisma.property.deleteMany({
      where: { id: propertyId },
    });
    await prisma.user.deleteMany({
      where: {
        id: { in: [tenantId, landlordId] },
      },
    });
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    // Clean up favorites before each test
    await prisma.favorite.deleteMany({
      where: {
        OR: [{ userId: tenantId }, { userId: landlordId }],
      },
    });
  });

  describe('POST /api/favorites', () => {
    it('should add property to favorites successfully', async () => {
      const response = await request(app)
        .post('/api/favorites')
        .set('Authorization', `Bearer ${tenantToken}`)
        .send({ propertyId })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.propertyId).toBe(propertyId);
      expect(response.body.data.property.title).toBe('Test Property for Favorites');
      expect(response.body.message).toBe('Property added to favorites successfully');
    });

    it('should return 409 if property is already favorited', async () => {
      // Add to favorites first
      await request(app)
        .post('/api/favorites')
        .set('Authorization', `Bearer ${tenantToken}`)
        .send({ propertyId })
        .expect(201);

      // Try to add again
      const response = await request(app)
        .post('/api/favorites')
        .set('Authorization', `Bearer ${tenantToken}`)
        .send({ propertyId })
        .expect(409);

      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toBe('Property is already in favorites');
    });

    it('should return 400 if landlord tries to favorite their own property', async () => {
      const response = await request(app)
        .post('/api/favorites')
        .set('Authorization', `Bearer ${landlordToken}`)
        .send({ propertyId })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toBe('Cannot favorite your own property');
    });

    it('should return 404 if property does not exist', async () => {
      const response = await request(app)
        .post('/api/favorites')
        .set('Authorization', `Bearer ${tenantToken}`)
        .send({ propertyId: 'non-existent-id' })
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toBe('Property not found');
    });

    it('should return 401 if user is not authenticated', async () => {
      const response = await request(app)
        .post('/api/favorites')
        .send({ propertyId })
        .expect(401);

      expect(response.body.success).toBe(false);
    });

    it('should return 400 if propertyId is missing', async () => {
      const response = await request(app)
        .post('/api/favorites')
        .set('Authorization', `Bearer ${tenantToken}`)
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toBe('Property ID is required');
    });
  });

  describe('GET /api/favorites', () => {
    beforeEach(async () => {
      // Add property to favorites for testing
      await request(app)
        .post('/api/favorites')
        .set('Authorization', `Bearer ${tenantToken}`)
        .send({ propertyId });
    });

    it('should get user favorites successfully', async () => {
      const response = await request(app)
        .get('/api/favorites')
        .set('Authorization', `Bearer ${tenantToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.favorites).toHaveLength(1);
      expect(response.body.data.favorites[0].propertyId).toBe(propertyId);
      expect(response.body.data.total).toBe(1);
      expect(response.body.data.page).toBe(1);
      expect(response.body.data.limit).toBe(10);
    });

    it('should support pagination', async () => {
      const response = await request(app)
        .get('/api/favorites?page=1&limit=5')
        .set('Authorization', `Bearer ${tenantToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.page).toBe(1);
      expect(response.body.data.limit).toBe(5);
    });

    it('should return empty list if user has no favorites', async () => {
      // Remove the favorite first
      await request(app)
        .delete(`/api/favorites/property/${propertyId}`)
        .set('Authorization', `Bearer ${tenantToken}`);

      const response = await request(app)
        .get('/api/favorites')
        .set('Authorization', `Bearer ${tenantToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.favorites).toHaveLength(0);
      expect(response.body.data.total).toBe(0);
    });
  });

  describe('GET /api/favorites/status/:propertyId', () => {
    it('should return favorite status for favorited property', async () => {
      // Add to favorites first
      await request(app)
        .post('/api/favorites')
        .set('Authorization', `Bearer ${tenantToken}`)
        .send({ propertyId });

      const response = await request(app)
        .get(`/api/favorites/status/${propertyId}`)
        .set('Authorization', `Bearer ${tenantToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.isFavorited).toBe(true);
      expect(response.body.data.favoriteId).toBeDefined();
    });

    it('should return favorite status for non-favorited property', async () => {
      const response = await request(app)
        .get(`/api/favorites/status/${propertyId}`)
        .set('Authorization', `Bearer ${tenantToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.isFavorited).toBe(false);
      expect(response.body.data.favoriteId).toBeUndefined();
    });
  });

  describe('POST /api/favorites/status/batch', () => {
    it('should return favorite status for multiple properties', async () => {
      // Add to favorites first
      await request(app)
        .post('/api/favorites')
        .set('Authorization', `Bearer ${tenantToken}`)
        .send({ propertyId });

      const response = await request(app)
        .post('/api/favorites/status/batch')
        .set('Authorization', `Bearer ${tenantToken}`)
        .send({ propertyIds: [propertyId, 'non-existent-id'] })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data[propertyId]).toBe(true);
      expect(response.body.data['non-existent-id']).toBe(false);
    });

    it('should return 400 if propertyIds is not provided', async () => {
      const response = await request(app)
        .post('/api/favorites/status/batch')
        .set('Authorization', `Bearer ${tenantToken}`)
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toBe('Property IDs array is required');
    });
  });

  describe('DELETE /api/favorites/property/:propertyId', () => {
    beforeEach(async () => {
      // Add property to favorites for testing
      await request(app)
        .post('/api/favorites')
        .set('Authorization', `Bearer ${tenantToken}`)
        .send({ propertyId });
    });

    it('should remove property from favorites successfully', async () => {
      const response = await request(app)
        .delete(`/api/favorites/property/${propertyId}`)
        .set('Authorization', `Bearer ${tenantToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Property removed from favorites successfully');

      // Verify it's removed
      const statusResponse = await request(app)
        .get(`/api/favorites/status/${propertyId}`)
        .set('Authorization', `Bearer ${tenantToken}`);

      expect(statusResponse.body.data.isFavorited).toBe(false);
    });

    it('should return 404 if favorite does not exist', async () => {
      // Remove it first
      await request(app)
        .delete(`/api/favorites/property/${propertyId}`)
        .set('Authorization', `Bearer ${tenantToken}`);

      // Try to remove again
      const response = await request(app)
        .delete(`/api/favorites/property/${propertyId}`)
        .set('Authorization', `Bearer ${tenantToken}`)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toBe('Favorite not found');
    });
  });

  describe('GET /api/favorites/unavailable', () => {
    it('should return unavailable favorites', async () => {
      // Add to favorites first
      await request(app)
        .post('/api/favorites')
        .set('Authorization', `Bearer ${tenantToken}`)
        .send({ propertyId });

      // Make property inactive
      await prisma.property.update({
        where: { id: propertyId },
        data: { isActive: false },
      });

      const response = await request(app)
        .get('/api/favorites/unavailable')
        .set('Authorization', `Bearer ${tenantToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.favorites).toHaveLength(1);
      expect(response.body.data.favorites[0].property.isActive).toBe(false);
      expect(response.body.data.count).toBe(1);

      // Restore property for cleanup
      await prisma.property.update({
        where: { id: propertyId },
        data: { isActive: true },
      });
    });

    it('should return empty list if all favorites are available', async () => {
      // Add to favorites first
      await request(app)
        .post('/api/favorites')
        .set('Authorization', `Bearer ${tenantToken}`)
        .send({ propertyId });

      const response = await request(app)
        .get('/api/favorites/unavailable')
        .set('Authorization', `Bearer ${tenantToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.favorites).toHaveLength(0);
      expect(response.body.data.count).toBe(0);
      expect(response.body.message).toBe('All your favorites are still available');
    });
  });

  describe('DELETE /api/favorites/:favoriteId', () => {
    let favoriteId: string;

    beforeEach(async () => {
      // Add property to favorites and get the favorite ID
      const addResponse = await request(app)
        .post('/api/favorites')
        .set('Authorization', `Bearer ${tenantToken}`)
        .send({ propertyId });
      
      favoriteId = addResponse.body.data.id;
    });

    it('should remove favorite by ID successfully', async () => {
      const response = await request(app)
        .delete(`/api/favorites/${favoriteId}`)
        .set('Authorization', `Bearer ${tenantToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Favorite removed successfully');

      // Verify it's removed
      const statusResponse = await request(app)
        .get(`/api/favorites/status/${propertyId}`)
        .set('Authorization', `Bearer ${tenantToken}`);

      expect(statusResponse.body.data.isFavorited).toBe(false);
    });

    it('should return 404 if favorite ID does not exist', async () => {
      const response = await request(app)
        .delete('/api/favorites/non-existent-id')
        .set('Authorization', `Bearer ${tenantToken}`)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toBe('Favorite not found');
    });

    it('should return 404 if user tries to delete another users favorite', async () => {
      // Create another user
      const anotherUserData = createUserData({
        email: 'another@test.com',
        userType: 'TENANT',
        isVerified: true,
      });
      const anotherUser = await prisma.user.create({ data: anotherUserData });
      const anotherUserToken = generateTestToken(anotherUser.id, anotherUser.userType);

      const response = await request(app)
        .delete(`/api/favorites/${favoriteId}`)
        .set('Authorization', `Bearer ${anotherUserToken}`)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toBe('Favorite not found');

      // Cleanup
      await prisma.user.delete({ where: { id: anotherUser.id } });
    });
  });

  describe('POST /api/favorites/check-unavailable', () => {
    beforeEach(async () => {
      // Add property to favorites for testing
      await request(app)
        .post('/api/favorites')
        .set('Authorization', `Bearer ${tenantToken}`)
        .send({ propertyId });
    });

    it('should check and notify about unavailable favorites', async () => {
      // Make property inactive
      await prisma.property.update({
        where: { id: propertyId },
        data: { isActive: false },
      });

      await request(app)
        .post('/api/favorites/check-unavailable')
        .set('Authorization', `Bearer ${tenantToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.success).toBe(true);
          expect(res.body.message).toBe('Checked for unavailable favorites and sent notifications if needed');
        });

      // Restore property for cleanup
      await prisma.property.update({
        where: { id: propertyId },
        data: { isActive: true },
      });
    });

    it('should handle case with no unavailable favorites', async () => {
      await request(app)
        .post('/api/favorites/check-unavailable')
        .set('Authorization', `Bearer ${tenantToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.success).toBe(true);
          expect(res.body.message).toBe('Checked for unavailable favorites and sent notifications if needed');
        });
    });
  });

  describe('Pagination and Validation Tests', () => {
    beforeEach(async () => {
      // Add property to favorites for testing
      await request(app)
        .post('/api/favorites')
        .set('Authorization', `Bearer ${tenantToken}`)
        .send({ propertyId });
    });

    it('should validate pagination parameters', async () => {
      const response = await request(app)
        .get('/api/favorites?page=0&limit=101')
        .set('Authorization', `Bearer ${tenantToken}`)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toBe('Page must be greater than 0');
    });

    it('should validate limit parameter', async () => {
      const response = await request(app)
        .get('/api/favorites?page=1&limit=101')
        .set('Authorization', `Bearer ${tenantToken}`)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toBe('Limit must be between 1 and 100');
    });

    it('should validate batch status request', async () => {
      const response = await request(app)
        .post('/api/favorites/status/batch')
        .set('Authorization', `Bearer ${tenantToken}`)
        .send({ propertyIds: Array.from({ length: 51 }, (_, i) => `property-${i}`) })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toBe('Maximum 50 property IDs allowed per request');
    });
  });

  describe('Error Handling Tests', () => {
    it('should handle inactive property when adding to favorites', async () => {
      // Create an inactive property
      const inactivePropertyData = createPropertyData({
        landlordId: landlordId,
        title: 'Inactive Property',
        isActive: false,
        isVerified: true,
      });
      const inactiveProperty = await prisma.property.create({ data: inactivePropertyData });

      const response = await request(app)
        .post('/api/favorites')
        .set('Authorization', `Bearer ${tenantToken}`)
        .send({ propertyId: inactiveProperty.id })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toBe('Property is not available');

      // Cleanup
      await prisma.property.delete({ where: { id: inactiveProperty.id } });
    });

    it('should handle missing propertyId parameter', async () => {
      const response = await request(app)
        .get('/api/favorites/status/')
        .set('Authorization', `Bearer ${tenantToken}`)
        .expect(404); // Route not found due to missing parameter
    });

    it('should handle missing favoriteId parameter', async () => {
      const response = await request(app)
        .delete('/api/favorites/')
        .set('Authorization', `Bearer ${tenantToken}`)
        .expect(404); // Route not found due to missing parameter
    });
  });

  describe('Concurrent Operations Tests', () => {
    it('should handle concurrent favorite additions', async () => {
      // Create multiple properties
      const properties = await Promise.all([
        prisma.property.create({
          data: createPropertyData({
            landlordId: landlordId,
            title: 'Property 1',
            isActive: true,
            isVerified: true,
          }),
        }),
        prisma.property.create({
          data: createPropertyData({
            landlordId: landlordId,
            title: 'Property 2',
            isActive: true,
            isVerified: true,
          }),
        }),
        prisma.property.create({
          data: createPropertyData({
            landlordId: landlordId,
            title: 'Property 3',
            isActive: true,
            isVerified: true,
          }),
        }),
      ]);

      // Add all properties to favorites concurrently
      const responses = await Promise.all(
        properties.map(property =>
          request(app)
            .post('/api/favorites')
            .set('Authorization', `Bearer ${tenantToken}`)
            .send({ propertyId: property.id })
        )
      );

      // All should succeed
      responses.forEach(response => {
        expect(response.status).toBe(201);
        expect(response.body.success).toBe(true);
      });

      // Verify all are in favorites
      const favoritesResponse = await request(app)
        .get('/api/favorites')
        .set('Authorization', `Bearer ${tenantToken}`);

      expect(favoritesResponse.body.data.total).toBe(4); // 3 new + 1 from beforeEach

      // Cleanup
      await Promise.all([
        prisma.property.delete({ where: { id: properties[0]!.id } }),
        prisma.property.delete({ where: { id: properties[1]!.id } }),
        prisma.property.delete({ where: { id: properties[2]!.id } }),
      ]);
    });
  });
});