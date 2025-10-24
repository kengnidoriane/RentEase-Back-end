import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { User, UserType } from '@prisma/client';

export const createMockRequest = (overrides: Partial<Request> = {}): Partial<Request> => ({
  body: {},
  params: {},
  query: {},
  headers: {},
  ...overrides,
});

export const createMockResponse = (): Partial<Response> => {
  const res: Partial<Response> = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.send = jest.fn().mockReturnValue(res);
  res.cookie = jest.fn().mockReturnValue(res);
  res.clearCookie = jest.fn().mockReturnValue(res);
  return res;
};

export const createMockNext = () => jest.fn();

export const generateTestToken = (userId: string, userType: UserType = UserType.TENANT): string => {
  return jwt.sign({ userId, userType }, process.env.JWT_SECRET || 'test-secret', {
    expiresIn: '1h',
  });
};

export const createAuthenticatedRequest = (
  user: Partial<User> & { userId?: string; userType?: string },
  overrides: Partial<Request> = {}
): Partial<Request> => {
  const token = generateTestToken(user.id || 'test-id', user.userType || UserType.TENANT);
  return createMockRequest({
    headers: {
      authorization: `Bearer ${token}`,
    },
    user: {
      userId: user.id || user.userId || 'test-id',
      email: user.email || 'test@example.com',
      userType: user.userType || UserType.TENANT,
      id: user.id || user.userId || 'test-id',
    },
    ...overrides,
  });
};
