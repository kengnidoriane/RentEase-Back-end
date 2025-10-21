import { PrismaClient } from '@prisma/client';
import { execSync } from 'child_process';
import { redisClient } from '@/config/redis';

// Test database instance
export const testPrisma = new PrismaClient({
  datasources: {
    db: {
      url:
        process.env['DATABASE_URL_TEST'] ||
        'postgresql://username:password@localhost:5432/rentease_test?schema=public',
    },
  },
});

beforeAll(async () => {
  // Set test environment
  process.env['NODE_ENV'] = 'test';

  // Connect to test database
  await testPrisma.$connect();

  // Run migrations on test database
  execSync('npx prisma migrate deploy', {
    env: { ...process.env, DATABASE_URL: process.env['DATABASE_URL_TEST'] },
  });

  // Connect to Redis (use different DB for tests)
  if (!redisClient.isOpen) {
    await redisClient.connect();
    await redisClient.select(1); // Use DB 1 for tests
  }
});

beforeEach(async () => {
  // Clean up database before each test
  await testPrisma.verificationDocument.deleteMany();
  await testPrisma.propertyImage.deleteMany();
  await testPrisma.favorite.deleteMany();
  await testPrisma.message.deleteMany();
  await testPrisma.property.deleteMany();
  await testPrisma.user.deleteMany();

  // Clear Redis cache
  await redisClient.flushDb();
});

afterAll(async () => {
  // Disconnect from test database
  await testPrisma.$disconnect();

  // Disconnect from Redis
  if (redisClient.isOpen) {
    await redisClient.quit();
  }
});
