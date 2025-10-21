import { BaseTest } from './base/BaseTest';
import { UserType } from '@prisma/client';

describe('Example Test Suite', () => {
  const baseTest = new BaseTest();

  beforeEach(async () => {
    await baseTest.cleanupDatabase();
  });

  describe('Database Connection', () => {
    it('should connect to test database successfully', async () => {
      const result = await baseTest['prisma'].$queryRaw`SELECT 1 as test`;
      expect(result).toBeDefined();
    });
  });

  describe('User Factory', () => {
    it('should create a test user', async () => {
      const user = await baseTest['createTestUser']({
        email: 'test@example.com',
        userType: UserType.TENANT,
      });

      expect(user).toBeDefined();
      expect(user.email).toBe('test@example.com');
      expect(user.userType).toBe(UserType.TENANT);
      expect(user.id).toBeDefined();
    });
  });

  describe('Property Factory', () => {
    it('should create a test property', async () => {
      const landlord = await baseTest['createTestUser']({
        userType: UserType.LANDLORD,
      });

      const property = await baseTest['createTestProperty'](landlord.id, {
        title: 'Test Property',
        price: 1000,
      });

      expect(property).toBeDefined();
      expect(property.title).toBe('Test Property');
      expect(property.price).toBe(1000);
      expect(property.landlordId).toBe(landlord.id);
    });
  });
});
