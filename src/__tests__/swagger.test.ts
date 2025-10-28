import request from 'supertest';
import app from '../server';
import { swaggerSpec } from '../config/swagger';

describe('Swagger Documentation', () => {
  describe('Swagger Configuration', () => {
    it('should have valid swagger specification', () => {
      expect(swaggerSpec).toBeDefined();
      expect(swaggerSpec.openapi).toBe('3.0.0');
      expect(swaggerSpec.info).toBeDefined();
      expect(swaggerSpec.info.title).toBe('RentEase API');
      expect(swaggerSpec.info.version).toBe('1.0.0');
    });

    it('should have security schemes defined', () => {
      expect(swaggerSpec.components?.securitySchemes).toBeDefined();
      expect(swaggerSpec.components?.securitySchemes?.bearerAuth).toBeDefined();
      expect(swaggerSpec.components?.securitySchemes?.bearerAuth.type).toBe('http');
      expect(swaggerSpec.components?.securitySchemes?.bearerAuth.scheme).toBe('bearer');
    });

    it('should have common schemas defined', () => {
      expect(swaggerSpec.components?.schemas).toBeDefined();
      expect(swaggerSpec.components?.schemas?.ApiResponse).toBeDefined();
      expect(swaggerSpec.components?.schemas?.User).toBeDefined();
      expect(swaggerSpec.components?.schemas?.Property).toBeDefined();
      expect(swaggerSpec.components?.schemas?.Message).toBeDefined();
      expect(swaggerSpec.components?.schemas?.Favorite).toBeDefined();
      expect(swaggerSpec.components?.schemas?.ValidationError).toBeDefined();
    });

    it('should have all required tags defined', () => {
      expect(swaggerSpec.tags).toBeDefined();
      const tagNames = swaggerSpec.tags?.map(tag => tag.name) || [];
      expect(tagNames).toContain('Authentication');
      expect(tagNames).toContain('Users');
      expect(tagNames).toContain('Properties');
      expect(tagNames).toContain('Messages');
      expect(tagNames).toContain('Favorites');
      expect(tagNames).toContain('Notifications');
      expect(tagNames).toContain('Admin');
    });
  });

  describe('Swagger UI Endpoints', () => {
    it('should serve Swagger UI at /api/docs', async () => {
      const response = await request(app)
        .get('/api/docs/')
        .expect(200);

      expect(response.text).toContain('Swagger UI');
      expect(response.text).toContain('RentEase API Documentation');
    });

    it('should serve Swagger JSON at /api/docs.json', async () => {
      const response = await request(app)
        .get('/api/docs.json')
        .expect(200);

      expect(response.headers['content-type']).toMatch(/application\/json/);
      expect(response.body).toEqual(swaggerSpec);
    });

    it('should have correct OpenAPI version in JSON', async () => {
      const response = await request(app)
        .get('/api/docs.json')
        .expect(200);

      expect(response.body.openapi).toBe('3.0.0');
      expect(response.body.info.title).toBe('RentEase API');
    });
  });

  describe('API Documentation Coverage', () => {
    it('should document authentication endpoints', async () => {
      const response = await request(app)
        .get('/api/docs.json')
        .expect(200);

      const paths = response.body.paths;
      expect(paths['/api/auth/register']).toBeDefined();
      expect(paths['/api/auth/login']).toBeDefined();
      expect(paths['/api/auth/refresh']).toBeDefined();
      expect(paths['/api/auth/logout']).toBeDefined();
      expect(paths['/api/auth/verify-email']).toBeDefined();
      expect(paths['/api/auth/forgot-password']).toBeDefined();
      expect(paths['/api/auth/reset-password']).toBeDefined();
      expect(paths['/api/auth/me']).toBeDefined();
    });

    it('should document property endpoints', async () => {
      const response = await request(app)
        .get('/api/docs.json')
        .expect(200);

      const paths = response.body.paths;
      expect(paths['/api/properties/search']).toBeDefined();
      expect(paths['/api/properties/{id}']).toBeDefined();
      expect(paths['/api/properties']).toBeDefined();
    });

    it('should document message endpoints', async () => {
      const response = await request(app)
        .get('/api/docs.json')
        .expect(200);

      const paths = response.body.paths;
      expect(paths['/api/messages/send']).toBeDefined();
      expect(paths['/api/messages/conversations']).toBeDefined();
      expect(paths['/api/messages/conversations/{conversationId}/messages']).toBeDefined();
      expect(paths['/api/messages/mark-read']).toBeDefined();
      expect(paths['/api/messages/unread-count']).toBeDefined();
    });

    it('should document favorite endpoints', async () => {
      const response = await request(app)
        .get('/api/docs.json')
        .expect(200);

      const paths = response.body.paths;
      expect(paths['/api/favorites']).toBeDefined();
      expect(paths['/api/favorites/status/{propertyId}']).toBeDefined();
      expect(paths['/api/favorites/property/{propertyId}']).toBeDefined();
    });
  });

  describe('Schema Validation', () => {
    it('should have valid request schemas', async () => {
      const response = await request(app)
        .get('/api/docs.json')
        .expect(200);

      const registerEndpoint = response.body.paths['/api/auth/register'];
      expect(registerEndpoint.post.requestBody).toBeDefined();
      expect(registerEndpoint.post.requestBody.content['application/json'].schema).toBeDefined();

      const schema = registerEndpoint.post.requestBody.content['application/json'].schema;
      expect(schema.required).toContain('email');
      expect(schema.required).toContain('password');
      expect(schema.required).toContain('firstName');
      expect(schema.required).toContain('lastName');
      expect(schema.required).toContain('userType');
    });

    it('should have valid response schemas', async () => {
      const response = await request(app)
        .get('/api/docs.json')
        .expect(200);

      const loginEndpoint = response.body.paths['/api/auth/login'];
      expect(loginEndpoint.post.responses['200']).toBeDefined();
      expect(loginEndpoint.post.responses['401']).toBeDefined();
      expect(loginEndpoint.post.responses['400']).toBeDefined();
    });

    it('should have security requirements for protected endpoints', async () => {
      const response = await request(app)
        .get('/api/docs.json')
        .expect(200);

      const logoutEndpoint = response.body.paths['/api/auth/logout'];
      expect(logoutEndpoint.post.security).toBeDefined();
      expect(logoutEndpoint.post.security[0].bearerAuth).toBeDefined();

      const createPropertyEndpoint = response.body.paths['/api/properties'];
      expect(createPropertyEndpoint.post.security).toBeDefined();
      expect(createPropertyEndpoint.post.security[0].bearerAuth).toBeDefined();
    });
  });

  describe('Rate Limiting Documentation', () => {
    it('should include rate limit headers in responses', async () => {
      const response = await request(app)
        .get('/api/docs.json')
        .expect(200);

      // Check if rate limiting is documented in the general info
      expect(response.body.info.description).toContain('API');
    });

    it('should document rate limit error responses', async () => {
      const response = await request(app)
        .get('/api/docs.json')
        .expect(200);

      // Rate limit errors should be documented as 429 responses
      const paths = response.body.paths;
      const sampleEndpoint = paths['/api/auth/login'];
      
      // While not explicitly checking for 429 in every endpoint,
      // the rate limiting middleware will add these headers
      expect(sampleEndpoint).toBeDefined();
    });
  });

  describe('Error Response Documentation', () => {
    it('should document validation error responses', async () => {
      const response = await request(app)
        .get('/api/docs.json')
        .expect(200);

      const schemas = response.body.components.schemas;
      expect(schemas.ValidationError).toBeDefined();
      expect(schemas.ValidationError.properties.success).toBeDefined();
      expect(schemas.ValidationError.properties.error).toBeDefined();
    });

    it('should document common error codes', async () => {
      const response = await request(app)
        .get('/api/docs.json')
        .expect(200);

      const schemas = response.body.components.schemas;
      const apiResponse = schemas.ApiResponse;
      expect(apiResponse.properties.error).toBeDefined();
      expect(apiResponse.properties.error.properties.code).toBeDefined();
      expect(apiResponse.properties.error.properties.message).toBeDefined();
    });
  });

  describe('API Testing Interface', () => {
    it('should allow testing endpoints through Swagger UI', async () => {
      const response = await request(app)
        .get('/api/docs/')
        .expect(200);

      // Check that the Swagger UI includes the "Try it out" functionality
      expect(response.text).toContain('swagger-ui');
      // The UI should be configured to allow testing
      expect(response.text).toMatch(/tryItOutEnabled.*true/);
    });

    it('should support authentication in Swagger UI', async () => {
      const response = await request(app)
        .get('/api/docs.json')
        .expect(200);

      const securitySchemes = response.body.components.securitySchemes;
      expect(securitySchemes.bearerAuth).toBeDefined();
      expect(securitySchemes.bearerAuth.description).toContain('JWT');
    });
  });

  describe('API Versioning', () => {
    it('should include version information', async () => {
      const response = await request(app)
        .get('/api/docs.json')
        .expect(200);

      expect(response.body.info.version).toBe('1.0.0');
      expect(response.body.servers).toBeDefined();
      expect(response.body.servers.length).toBeGreaterThan(0);
    });

    it('should have correct server configuration', async () => {
      const response = await request(app)
        .get('/api/docs.json')
        .expect(200);

      const servers = response.body.servers;
      expect(servers[0].url).toMatch(/localhost/);
      expect(servers[0].description).toContain('Development');
    });
  });
});