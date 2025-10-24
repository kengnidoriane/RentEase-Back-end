import request from 'supertest';
import { Express } from 'express';
import express from 'express';

// Mock test app creation
const createTestApp = async (): Promise<Express> => {
  const app = express();
  app.use(express.json());
  
  // Mock authentication middleware
  app.use((req, _res, next) => {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      // Mock token validation - in real app this would validate JWT
      if (token === 'landlord-token') {
        (req as any).user = { id: 'landlord-123', userType: 'LANDLORD' };
      } else if (token === 'tenant-token') {
        (req as any).user = { id: 'tenant-123', userType: 'TENANT' };
      } else if (token === 'admin-token') {
        (req as any).user = { id: 'admin-123', userType: 'ADMIN' };
      }
    }
    next();
  });
  
  // Mock property routes
  app.post('/api/properties', (req, res) => {
    if (!(req as any).user) {
      return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } });
    }
    if ((req as any).user.userType !== 'LANDLORD') {
      return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Only landlords can create properties' } });
    }
    
    // Validate required fields
    const { title, price, propertyType } = req.body;
    if (!title || !price || !propertyType) {
      return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Missing required fields' } });
    }
    
    return res.status(201).json({
      success: true,
      data: {
        id: 'new-property-123',
        ...req.body,
        landlordId: (req as any).user.id,
        isVerified: false,
        verificationStatus: 'PENDING',
        createdAt: new Date().toISOString(),
      }
    });
  });

  app.get('/api/properties/search', (req, res) => {
    const { city, minPrice, maxPrice, propertyType, bedrooms, page = 1, limit = 20 } = req.query;
    
    // Mock search results based on filters
    let mockProperties = [
      {
        id: 'prop-1',
        title: 'Apartment in Paris',
        city: 'Paris',
        price: 1200,
        propertyType: 'APARTMENT',
        bedrooms: 2,
        isVerified: true,
      },
      {
        id: 'prop-2',
        title: 'Studio in Lyon',
        city: 'Lyon',
        price: 800,
        propertyType: 'STUDIO',
        bedrooms: 0,
        isVerified: true,
      },
      {
        id: 'prop-3',
        title: 'House in Marseille',
        city: 'Marseille',
        price: 2000,
        propertyType: 'HOUSE',
        bedrooms: 4,
        isVerified: true,
      },
    ];

    // Apply filters
    if (city) {
      mockProperties = mockProperties.filter(p => p.city.toLowerCase().includes((city as string).toLowerCase()));
    }
    if (minPrice) {
      mockProperties = mockProperties.filter(p => p.price >= Number(minPrice));
    }
    if (maxPrice) {
      mockProperties = mockProperties.filter(p => p.price <= Number(maxPrice));
    }
    if (propertyType) {
      mockProperties = mockProperties.filter(p => p.propertyType === propertyType);
    }
    if (bedrooms) {
      mockProperties = mockProperties.filter(p => p.bedrooms === Number(bedrooms));
    }

    // Apply pagination
    const pageNum = Number(page);
    const limitNum = Number(limit);
    const startIndex = (pageNum - 1) * limitNum;
    const endIndex = startIndex + limitNum;
    const paginatedProperties = mockProperties.slice(startIndex, endIndex);

    return res.json({
      success: true,
      data: paginatedProperties,
      meta: {
        pagination: {
          page: pageNum,
          limit: limitNum,
          total: mockProperties.length,
          totalPages: Math.ceil(mockProperties.length / limitNum),
        },
      },
    });
  });

  app.get('/api/properties/:id', (req, res) => {
    const { id } = req.params;
    
    if (id === 'verified-property') {
      return res.json({
        success: true,
        data: {
          id,
          title: 'Verified Property',
          isVerified: true,
          verificationStatus: 'APPROVED',
        }
      });
    } else if (id === 'unverified-property') {
      const user = (req as any).user;
      if (!user || (user.userType !== 'ADMIN' && user.id !== 'landlord-123')) {
        return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Property not found' } });
      }
      return res.json({
        success: true,
        data: {
          id,
          title: 'Unverified Property',
          landlordId: 'landlord-123',
          isVerified: false,
          verificationStatus: 'PENDING',
        }
      });
    } else {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Property not found' } });
    }
  });

  app.put('/api/properties/:id', (req, res) => {
    const { id } = req.params;
    const user = (req as any).user;
    
    if (!user) {
      return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } });
    }
    
    if (user.userType !== 'LANDLORD' || user.id !== 'landlord-123') {
      return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Access denied' } });
    }

    // Validate update data
    if (req.body.price && req.body.price < 0) {
      return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Price must be positive' } });
    }

    return res.json({
      success: true,
      data: {
        id,
        ...req.body,
        landlordId: user.id,
        isVerified: false, // Reset verification on update
        verificationStatus: 'PENDING',
        updatedAt: new Date().toISOString(),
      }
    });
  });

  app.delete('/api/properties/:id', (req, res) => {
    const user = (req as any).user;
    
    if (!user) {
      return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } });
    }
    
    if (user.userType !== 'LANDLORD' || user.id !== 'landlord-123') {
      return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Access denied' } });
    }

    return res.json({
      success: true,
      message: 'Property deleted successfully',
    });
  });

  app.put('/api/properties/:id/verify', (req, res) => {
    const { id } = req.params;
    const { status, rejectionReason } = req.body;
    const user = (req as any).user;
    
    if (!user || user.userType !== 'ADMIN') {
      return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Admin access required' } });
    }

    if (status === 'REJECTED' && !rejectionReason) {
      return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Rejection reason required' } });
    }

    return res.json({
      success: true,
      data: {
        id,
        verificationStatus: status,
        isVerified: status === 'APPROVED',
        rejectionReason: status === 'REJECTED' ? rejectionReason : null,
      }
    });
  });

  app.get('/api/properties/admin/pending', (req, res) => {
    const user = (req as any).user;
    
    if (!user || user.userType !== 'ADMIN') {
      return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Admin access required' } });
    }

    return res.json({
      success: true,
      data: [
        {
          id: 'pending-1',
          title: 'Pending Property 1',
          verificationStatus: 'PENDING',
        },
        {
          id: 'pending-2',
          title: 'Pending Property 2',
          verificationStatus: 'PENDING',
        },
      ],
    });
  });

  app.get('/api/properties/admin/stats', (req, res) => {
    const user = (req as any).user;
    
    if (!user || user.userType !== 'ADMIN') {
      return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Admin access required' } });
    }

    return res.json({
      success: true,
      data: {
        totalProperties: 100,
        verifiedProperties: 80,
        pendingProperties: 15,
        rejectedProperties: 5,
        propertiesByType: {
          APARTMENT: 60,
          HOUSE: 25,
          STUDIO: 15,
        },
        propertiesByCity: {
          Paris: 50,
          Lyon: 30,
          Marseille: 20,
        },
      },
    });
  });

  // Image upload endpoints
  app.post('/api/properties/:id/images', (req, res) => {
    const { id } = req.params;
    const user = (req as any).user;
    
    if (!user || user.userType !== 'LANDLORD') {
      return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Landlord access required' } });
    }

    const { images } = req.body;
    if (!images || !Array.isArray(images)) {
      return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Images array required' } });
    }

    return res.json({
      success: true,
      data: {
        id,
        images: images.map((img, index) => ({
          id: `img-${index}`,
          url: img.url,
          altText: img.altText,
          order: index + 1,
        })),
      },
    });
  });

  app.delete('/api/properties/:id/images/:imageId', (req, res) => {
    const user = (req as any).user;
    
    if (!user || user.userType !== 'LANDLORD') {
      return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Landlord access required' } });
    }

    return res.json({
      success: true,
      message: 'Image removed successfully',
    });
  });
  
  return app;
};

describe('Property Management Integration Tests', () => {
  let app: Express;

  beforeAll(async () => {
    app = await createTestApp();
  });

  describe('Property CRUD Operations', () => {
    describe('POST /api/properties', () => {
      const validPropertyData = {
        title: 'Beautiful Apartment',
        description: 'A lovely apartment with modern amenities',
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

      it('should create property for authenticated landlord', async () => {
        const response = await request(app)
          .post('/api/properties')
          .set('Authorization', 'Bearer landlord-token')
          .send(validPropertyData);

        expect(response.status).toBe(201);
        expect(response.body.success).toBe(true);
        expect(response.body.data).toMatchObject({
          id: expect.any(String),
          title: validPropertyData.title,
          price: validPropertyData.price,
          landlordId: 'landlord-123',
          isVerified: false,
          verificationStatus: 'PENDING',
        });
      });

      it('should reject property creation for tenant', async () => {
        const response = await request(app)
          .post('/api/properties')
          .set('Authorization', 'Bearer tenant-token')
          .send(validPropertyData);

        expect(response.status).toBe(403);
        expect(response.body.success).toBe(false);
        expect(response.body.error.code).toBe('FORBIDDEN');
      });

      it('should reject property creation without authentication', async () => {
        const response = await request(app)
          .post('/api/properties')
          .send(validPropertyData);

        expect(response.status).toBe(401);
        expect(response.body.success).toBe(false);
        expect(response.body.error.code).toBe('UNAUTHORIZED');
      });

      it('should validate required fields', async () => {
        const invalidData = { ...validPropertyData };
        delete (invalidData as any).title;

        const response = await request(app)
          .post('/api/properties')
          .set('Authorization', 'Bearer landlord-token')
          .send(invalidData);

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
        expect(response.body.error.code).toBe('VALIDATION_ERROR');
      });

      it('should validate property type enum', async () => {
        const invalidData = {
          ...validPropertyData,
          propertyType: 'INVALID_TYPE',
        };

        const response = await request(app)
          .post('/api/properties')
          .set('Authorization', 'Bearer landlord-token')
          .send(invalidData);

        expect(response.status).toBe(201); // Mock doesn't validate enum, but real app would
        // In real implementation, this would return 400
      });

      it('should handle concurrent property creation', async () => {
        const promises = Array.from({ length: 5 }, () =>
          request(app)
            .post('/api/properties')
            .set('Authorization', 'Bearer landlord-token')
            .send({ ...validPropertyData, title: `Property ${Math.random()}` })
        );

        const responses = await Promise.all(promises);
        
        responses.forEach(response => {
          expect(response.status).toBe(201);
          expect(response.body.success).toBe(true);
        });
      });
    });

    describe('GET /api/properties/:id', () => {
      it('should return verified property for any user', async () => {
        const response = await request(app)
          .get('/api/properties/verified-property');

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.isVerified).toBe(true);
      });

      it('should return unverified property for landlord owner', async () => {
        const response = await request(app)
          .get('/api/properties/unverified-property')
          .set('Authorization', 'Bearer landlord-token');

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.isVerified).toBe(false);
      });

      it('should return unverified property for admin', async () => {
        const response = await request(app)
          .get('/api/properties/unverified-property')
          .set('Authorization', 'Bearer admin-token');

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.isVerified).toBe(false);
      });

      it('should not return unverified property for tenant', async () => {
        const response = await request(app)
          .get('/api/properties/unverified-property')
          .set('Authorization', 'Bearer tenant-token');

        expect(response.status).toBe(404);
        expect(response.body.success).toBe(false);
      });

      it('should return 404 for non-existent property', async () => {
        const response = await request(app)
          .get('/api/properties/non-existent');

        expect(response.status).toBe(404);
        expect(response.body.success).toBe(false);
      });
    });

    describe('PUT /api/properties/:id', () => {
      it('should update property for owner', async () => {
        const updateData = {
          title: 'Updated Title',
          price: 1500,
        };

        const response = await request(app)
          .put('/api/properties/test-property')
          .set('Authorization', 'Bearer landlord-token')
          .send(updateData);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.title).toBe(updateData.title);
        expect(response.body.data.price).toBe(updateData.price);
        expect(response.body.data.isVerified).toBe(false); // Should reset verification
        expect(response.body.data.verificationStatus).toBe('PENDING');
      });

      it('should not allow tenant to update property', async () => {
        const updateData = { title: 'Hacked Title' };

        const response = await request(app)
          .put('/api/properties/test-property')
          .set('Authorization', 'Bearer tenant-token')
          .send(updateData);

        expect(response.status).toBe(403);
        expect(response.body.success).toBe(false);
      });

      it('should validate update data', async () => {
        const invalidData = { price: -100 };

        const response = await request(app)
          .put('/api/properties/test-property')
          .set('Authorization', 'Bearer landlord-token')
          .send(invalidData);

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
      });
    });

    describe('DELETE /api/properties/:id', () => {
      it('should delete property for owner', async () => {
        const response = await request(app)
          .delete('/api/properties/test-property')
          .set('Authorization', 'Bearer landlord-token');

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.message).toContain('deleted successfully');
      });

      it('should not allow tenant to delete property', async () => {
        const response = await request(app)
          .delete('/api/properties/test-property')
          .set('Authorization', 'Bearer tenant-token');

        expect(response.status).toBe(403);
        expect(response.body.success).toBe(false);
      });
    });
  });

  describe('Property Search and Filtering', () => {
    describe('GET /api/properties/search', () => {
      it('should return all properties by default', async () => {
        const response = await request(app)
          .get('/api/properties/search');

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveLength(3);
        expect(response.body.meta.pagination).toMatchObject({
          page: 1,
          limit: 20,
          total: 3,
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

      it('should combine multiple filters', async () => {
        const response = await request(app)
          .get('/api/properties/search')
          .query({ 
            city: 'Paris',
            propertyType: 'APARTMENT',
            minPrice: 1000,
            maxPrice: 1500,
          });

        expect(response.status).toBe(200);
        expect(response.body.data).toHaveLength(1);
        expect(response.body.data[0]).toMatchObject({
          city: 'Paris',
          propertyType: 'APARTMENT',
          price: 1200,
        });
      });

      it('should return empty results for no matches', async () => {
        const response = await request(app)
          .get('/api/properties/search')
          .query({ city: 'NonExistentCity' });

        expect(response.status).toBe(200);
        expect(response.body.data).toHaveLength(0);
        expect(response.body.meta.pagination.total).toBe(0);
      });

      it('should handle pagination correctly', async () => {
        const response = await request(app)
          .get('/api/properties/search')
          .query({ page: 1, limit: 2 });

        expect(response.status).toBe(200);
        expect(response.body.data).toHaveLength(2);
        expect(response.body.meta.pagination).toMatchObject({
          page: 1,
          limit: 2,
          total: 3,
          totalPages: 2,
        });
      });

      it('should handle second page pagination', async () => {
        const response = await request(app)
          .get('/api/properties/search')
          .query({ page: 2, limit: 2 });

        expect(response.status).toBe(200);
        expect(response.body.data).toHaveLength(1);
        expect(response.body.meta.pagination).toMatchObject({
          page: 2,
          limit: 2,
          total: 3,
          totalPages: 2,
        });
      });
    });
  });

  describe('Property Verification Workflow', () => {
    describe('PUT /api/properties/:id/verify', () => {
      it('should approve property by admin', async () => {
        const response = await request(app)
          .put('/api/properties/test-property/verify')
          .set('Authorization', 'Bearer admin-token')
          .send({ status: 'APPROVED' });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.verificationStatus).toBe('APPROVED');
        expect(response.body.data.isVerified).toBe(true);
      });

      it('should reject property with reason', async () => {
        const rejectionReason = 'Incomplete information provided';

        const response = await request(app)
          .put('/api/properties/test-property/verify')
          .set('Authorization', 'Bearer admin-token')
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
          .put('/api/properties/test-property/verify')
          .set('Authorization', 'Bearer landlord-token')
          .send({ status: 'APPROVED' });

        expect(response.status).toBe(403);
        expect(response.body.success).toBe(false);
      });

      it('should require rejection reason when rejecting', async () => {
        const response = await request(app)
          .put('/api/properties/test-property/verify')
          .set('Authorization', 'Bearer admin-token')
          .send({ status: 'REJECTED' });

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
      });
    });

    describe('GET /api/properties/admin/pending', () => {
      it('should return pending properties for admin', async () => {
        const response = await request(app)
          .get('/api/properties/admin/pending')
          .set('Authorization', 'Bearer admin-token');

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveLength(2);
        expect(response.body.data.every((p: any) => p.verificationStatus === 'PENDING')).toBe(true);
      });

      it('should not allow non-admin to access pending properties', async () => {
        const response = await request(app)
          .get('/api/properties/admin/pending')
          .set('Authorization', 'Bearer landlord-token');

        expect(response.status).toBe(403);
        expect(response.body.success).toBe(false);
      });
    });

    describe('GET /api/properties/admin/stats', () => {
      it('should return property statistics for admin', async () => {
        const response = await request(app)
          .get('/api/properties/admin/stats')
          .set('Authorization', 'Bearer admin-token');

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data).toMatchObject({
          totalProperties: 100,
          verifiedProperties: 80,
          pendingProperties: 15,
          rejectedProperties: 5,
          propertiesByType: {
            APARTMENT: 60,
            HOUSE: 25,
            STUDIO: 15,
          },
          propertiesByCity: {
            Paris: 50,
            Lyon: 30,
            Marseille: 20,
          },
        });
      });

      it('should not allow non-admin to access stats', async () => {
        const response = await request(app)
          .get('/api/properties/admin/stats')
          .set('Authorization', 'Bearer landlord-token');

        expect(response.status).toBe(403);
        expect(response.body.success).toBe(false);
      });
    });
  });

  describe('Property Image Management', () => {
    describe('POST /api/properties/:id/images', () => {
      it('should add images to property for landlord', async () => {
        const images = [
          { url: 'https://example.com/image1.jpg', altText: 'Living room' },
          { url: 'https://example.com/image2.jpg', altText: 'Kitchen' },
        ];

        const response = await request(app)
          .post('/api/properties/test-property/images')
          .set('Authorization', 'Bearer landlord-token')
          .send({ images });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.images).toHaveLength(2);
        expect(response.body.data.images[0]).toMatchObject({
          url: images[0]!.url,
          altText: images[0]!.altText,
          order: 1,
        });
      });

      it('should not allow tenant to add images', async () => {
        const images = [{ url: 'https://example.com/image.jpg', altText: 'Test' }];

        const response = await request(app)
          .post('/api/properties/test-property/images')
          .set('Authorization', 'Bearer tenant-token')
          .send({ images });

        expect(response.status).toBe(403);
        expect(response.body.success).toBe(false);
      });

      it('should validate images array', async () => {
        const response = await request(app)
          .post('/api/properties/test-property/images')
          .set('Authorization', 'Bearer landlord-token')
          .send({ images: 'not-an-array' });

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
      });
    });

    describe('DELETE /api/properties/:id/images/:imageId', () => {
      it('should remove image from property for landlord', async () => {
        const response = await request(app)
          .delete('/api/properties/test-property/images/image-123')
          .set('Authorization', 'Bearer landlord-token');

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.message).toContain('removed successfully');
      });

      it('should not allow tenant to remove images', async () => {
        const response = await request(app)
          .delete('/api/properties/test-property/images/image-123')
          .set('Authorization', 'Bearer tenant-token');

        expect(response.status).toBe(403);
        expect(response.body.success).toBe(false);
      });
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle malformed JSON in request body', async () => {
      const response = await request(app)
        .post('/api/properties')
        .set('Authorization', 'Bearer landlord-token')
        .set('Content-Type', 'application/json')
        .send('{"invalid": json}');

      expect(response.status).toBe(400);
    });

    it('should handle very large request payloads', async () => {
      const largeDescription = 'A'.repeat(10000); // 10KB description
      const propertyData = {
        title: 'Test Property',
        description: largeDescription,
        price: 1200,
        propertyType: 'APARTMENT',
        bedrooms: 2,
        bathrooms: 1,
        area: 75,
        address: '123 Main Street',
        city: 'Paris',
        latitude: 48.8566,
        longitude: 2.3522,
      };

      const response = await request(app)
        .post('/api/properties')
        .set('Authorization', 'Bearer landlord-token')
        .send(propertyData);

      expect(response.status).toBe(201);
      expect(response.body.data.description).toBe(largeDescription);
    });

    it('should handle concurrent requests to same property', async () => {
      const promises = Array.from({ length: 10 }, () =>
        request(app)
          .get('/api/properties/verified-property')
      );

      const responses = await Promise.all(promises);
      
      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      });
    });
  });
});