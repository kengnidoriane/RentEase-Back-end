import request from 'supertest';
import app from '@/server';
import { prisma } from '@/config/database';
import { redisClient } from '@/config/redis';

describe('Authentication Integration Tests', () => {
  beforeAll(async () => {
    // Connect to test database and Redis
    await prisma.$connect();
    if (!redisClient.isOpen) {
      await redisClient.connect();
    }
  });

  afterAll(async () => {
    // Clean up test data
    await prisma.user.deleteMany({
      where: {
        email: {
          contains: 'test-auth-'
        }
      }
    });
    
    await prisma.$disconnect();
    await redisClient.quit();
  });

  describe('POST /api/auth/register', () => {
    it('should register a new user successfully', async () => {
      const userData = {
        email: 'test-auth-register@example.com',
        password: 'TestPassword123!',
        firstName: 'Test',
        lastName: 'User',
        phone: '+1234567890',
        userType: 'TENANT'
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.message).toContain('Registration successful');
      expect(response.body.data.userId).toBeDefined();
    });

    it('should return error for duplicate email', async () => {
      const userData = {
        email: 'test-auth-duplicate@example.com',
        password: 'TestPassword123!',
        firstName: 'Test',
        lastName: 'User',
        phone: '+1234567890',
        userType: 'TENANT'
      };

      // Register first user
      await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(201);

      // Try to register with same email
      const response = await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(409);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('USER_EXISTS');
    });

    it('should return validation error for invalid data', async () => {
      const userData = {
        email: 'invalid-email',
        password: '123', // Too short
        firstName: 'T', // Too short
        lastName: 'U', // Too short
        phone: 'invalid-phone',
        userType: 'INVALID_TYPE'
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.error.details).toBeDefined();
    });
  });

  describe('POST /api/auth/login', () => {
    beforeAll(async () => {
      // Create a test user for login tests
      const userData = {
        email: 'test-auth-login@example.com',
        password: 'TestPassword123!',
        firstName: 'Test',
        lastName: 'Login',
        phone: '+1234567890',
        userType: 'TENANT'
      };

      await request(app)
        .post('/api/auth/register')
        .send(userData);
    });

    it('should login successfully with valid credentials', async () => {
      const loginData = {
        email: 'test-auth-login@example.com',
        password: 'TestPassword123!'
      };

      const response = await request(app)
        .post('/api/auth/login')
        .send(loginData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.user).toBeDefined();
      expect(response.body.data.accessToken).toBeDefined();
      expect(response.body.data.refreshToken).toBeDefined();
      expect(response.body.data.user.email).toBe(loginData.email);
    });

    it('should return error for invalid credentials', async () => {
      const loginData = {
        email: 'test-auth-login@example.com',
        password: 'WrongPassword123!'
      };

      const response = await request(app)
        .post('/api/auth/login')
        .send(loginData)
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INVALID_CREDENTIALS');
    });

    it('should return error for non-existent user', async () => {
      const loginData = {
        email: 'nonexistent@example.com',
        password: 'TestPassword123!'
      };

      const response = await request(app)
        .post('/api/auth/login')
        .send(loginData)
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INVALID_CREDENTIALS');
    });
  });

  describe('GET /api/auth/me', () => {
    let accessToken: string;

    beforeAll(async () => {
      // Create and login a test user
      const userData = {
        email: 'test-auth-me@example.com',
        password: 'TestPassword123!',
        firstName: 'Test',
        lastName: 'Me',
        phone: '+1234567890',
        userType: 'LANDLORD'
      };

      await request(app)
        .post('/api/auth/register')
        .send(userData);

      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: userData.email,
          password: userData.password
        });

      accessToken = loginResponse.body.data.accessToken;
    });

    it('should return current user data with valid token', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.user).toBeDefined();
      expect(response.body.data.user.email).toBe('test-auth-me@example.com');
      expect(response.body.data.user.userType).toBe('LANDLORD');
      expect(response.body.data.user.password).toBeUndefined(); // Password should not be returned
    });

    it('should return error without token', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('UNAUTHORIZED');
    });

    it('should return error with invalid token', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('UNAUTHORIZED');
    });
  });

  describe('POST /api/auth/logout', () => {
    let accessToken: string;

    beforeAll(async () => {
      // Create and login a test user
      const userData = {
        email: 'test-auth-logout@example.com',
        password: 'TestPassword123!',
        firstName: 'Test',
        lastName: 'Logout',
        phone: '+1234567890',
        userType: 'TENANT'
      };

      await request(app)
        .post('/api/auth/register')
        .send(userData);

      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: userData.email,
          password: userData.password
        });

      accessToken = loginResponse.body.data.accessToken;
    });

    it('should logout successfully', async () => {
      const response = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.message).toContain('Logged out successfully');
    });

    it('should still return success even without token (graceful logout)', async () => {
      const response = await request(app)
        .post('/api/auth/logout')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.message).toContain('Logged out successfully');
    });
  });
});