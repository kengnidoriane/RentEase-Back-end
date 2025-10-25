import request from 'supertest';
import app from '../../server';
import { PrismaClient } from '@prisma/client';
import { createTestUser, createTestProperty, getAuthToken } from '../utils/testUtils';

const prisma = new PrismaClient();

describe('Favorites API Integration Tests', () => {
  let tenantToken: string;
  let landlordToken: string;
  let tenantId: string;
  let landlordId: string;
  let propertyId: string;

  beforeAll(async () => {
    // Create test users
    const tenant = await createTestUser({
      email: 'tenant@test.com',
      userType: 'TENANT',
      isVerified: true,
    });
    tenantId = tenant.id;
    tenantToken = await getAuthToken(tenant.id);

    const landlord = await createTestUser({
      email: 'landlord@test.com',
      userType: 'LANDLORD',
      isVerified: true,
    });
    landlordId = landlord.id;
    landlordToken = await getAuthToken(landlord.id);

    // Create test property
    const property = await createTestProperty({
      landlordId: landlord.id,
      title: 'Test Property for Favorites',
      isActive: true,
      isVerified: true,
    });
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
});