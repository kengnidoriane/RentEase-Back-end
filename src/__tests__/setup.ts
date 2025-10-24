// Mock Redis service for tests
jest.mock('@/services/redis.service', () => ({
  RedisService: jest.fn().mockImplementation(() => ({
    storeEmailVerificationToken: jest.fn().mockResolvedValue(undefined),
    getEmailFromVerificationToken: jest.fn().mockResolvedValue('test@example.com'),
    storePasswordResetToken: jest.fn().mockResolvedValue(undefined),
    getEmailFromResetToken: jest.fn().mockResolvedValue('test@example.com'),
    storeRefreshToken: jest.fn().mockResolvedValue(undefined),
    getRefreshToken: jest.fn().mockResolvedValue('refresh-token'),
    deleteRefreshToken: jest.fn().mockResolvedValue(undefined),
    blacklistAccessToken: jest.fn().mockResolvedValue(undefined),
    isTokenBlacklisted: jest.fn().mockResolvedValue(false),
    flushAll: jest.fn().mockResolvedValue(undefined),
  })),
}));

// Mock database config
jest.mock('@/config/database', () => ({
  connectDatabase: jest.fn().mockResolvedValue(undefined),
  disconnectDatabase: jest.fn().mockResolvedValue(undefined),
}));

// Mock Redis config
jest.mock('@/config/redis', () => ({
  connectRedis: jest.fn().mockResolvedValue(undefined),
  disconnectRedis: jest.fn().mockResolvedValue(undefined),
  redisClient: {
    isOpen: false,
    connect: jest.fn().mockResolvedValue(undefined),
    select: jest.fn().mockResolvedValue(undefined),
    flushDb: jest.fn().mockResolvedValue(undefined),
    quit: jest.fn().mockResolvedValue(undefined),
  },
}));

// Set test environment
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';
process.env.JWT_EXPIRES_IN = '15m';
process.env.JWT_REFRESH_EXPIRES_IN = '7d';
