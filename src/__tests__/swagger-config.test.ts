describe('Swagger Configuration Test', () => {
  it('should create swagger spec without errors', () => {
    // Mock process.env to avoid the property access issue
    const originalEnv = process.env;
    process.env = { ...originalEnv, NODE_ENV: 'test', PORT: '3000' };

    try {
      const { swaggerSpec } = require('../config/swagger');
      
      expect(swaggerSpec).toBeDefined();
      expect(swaggerSpec.openapi).toBe('3.0.0');
      expect(swaggerSpec.info).toBeDefined();
      expect(swaggerSpec.info.title).toBe('RentEase API');
      expect(swaggerSpec.info.version).toBe('1.0.0');
      
      // Check security schemes
      expect(swaggerSpec.components?.securitySchemes).toBeDefined();
      expect(swaggerSpec.components?.securitySchemes?.bearerAuth).toBeDefined();
      expect(swaggerSpec.components?.securitySchemes?.bearerAuth.type).toBe('http');
      expect(swaggerSpec.components?.securitySchemes?.bearerAuth.scheme).toBe('bearer');
      
      // Check schemas
      const schemas = swaggerSpec.components?.schemas;
      expect(schemas).toBeDefined();
      expect(schemas?.ApiResponse).toBeDefined();
      expect(schemas?.User).toBeDefined();
      expect(schemas?.Property).toBeDefined();
      expect(schemas?.Message).toBeDefined();
      expect(schemas?.Favorite).toBeDefined();
      expect(schemas?.ValidationError).toBeDefined();
      
      // Check tags
      expect(swaggerSpec.tags).toBeDefined();
      const tagNames = swaggerSpec.tags?.map((tag: any) => tag.name) || [];
      expect(tagNames).toContain('Authentication');
      expect(tagNames).toContain('Users');
      expect(tagNames).toContain('Properties');
      expect(tagNames).toContain('Messages');
      expect(tagNames).toContain('Favorites');
      expect(tagNames).toContain('Notifications');
      expect(tagNames).toContain('Admin');
      
    } finally {
      process.env = originalEnv;
    }
  });
});