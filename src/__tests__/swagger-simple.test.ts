import request from 'supertest';
import express from 'express';
import swaggerUi from 'swagger-ui-express';
import { swaggerSpec } from '../config/swagger';

// Create a simple test app
const app = express();

// Set up Swagger UI
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.get('/api/docs.json', (_req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(swaggerSpec);
});

describe('Swagger Setup', () => {
  it('should have valid swagger specification', () => {
    expect(swaggerSpec).toBeDefined();
    expect((swaggerSpec as any).openapi).toBe('3.0.0');
    expect((swaggerSpec as any).info).toBeDefined();
    expect((swaggerSpec as any).info.title).toBe('RentEase API');
    expect((swaggerSpec as any).info.version).toBe('1.0.0');
  });

  it('should serve Swagger JSON at /api/docs.json', async () => {
    const response = await request(app)
      .get('/api/docs.json')
      .expect(200);

    expect(response.headers['content-type']).toMatch(/application\/json/);
    expect(response.body).toEqual(swaggerSpec);
  });

  it('should have security schemes defined', () => {
    const components = (swaggerSpec as any).components;
    expect(components?.securitySchemes).toBeDefined();
    expect(components?.securitySchemes?.bearerAuth).toBeDefined();
    expect(components?.securitySchemes?.bearerAuth.type).toBe('http');
    expect(components?.securitySchemes?.bearerAuth.scheme).toBe('bearer');
  });

  it('should have common schemas defined', () => {
    const schemas = (swaggerSpec as any).components?.schemas;
    expect(schemas).toBeDefined();
    expect(schemas?.ApiResponse).toBeDefined();
    expect(schemas?.User).toBeDefined();
    expect(schemas?.Property).toBeDefined();
    expect(schemas?.Message).toBeDefined();
    expect(schemas?.Favorite).toBeDefined();
    expect(schemas?.ValidationError).toBeDefined();
  });

  it('should have all required tags defined', () => {
    const tags = (swaggerSpec as any).tags;
    expect(tags).toBeDefined();
    const tagNames = tags?.map((tag: any) => tag.name) || [];
    expect(tagNames).toContain('Authentication');
    expect(tagNames).toContain('Users');
    expect(tagNames).toContain('Properties');
    expect(tagNames).toContain('Messages');
    expect(tagNames).toContain('Favorites');
    expect(tagNames).toContain('Notifications');
    expect(tagNames).toContain('Admin');
  });

  it('should serve Swagger UI at /api/docs', async () => {
    const response = await request(app)
      .get('/api/docs/')
      .expect(200);

    expect(response.text).toContain('Swagger UI');
  });
});