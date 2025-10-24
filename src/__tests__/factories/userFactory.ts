import { User, UserType } from '@prisma/client';
import bcrypt from 'bcryptjs';

export interface CreateUserData {
  id?: string;
  email?: string;
  password?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  userType?: UserType;
  isVerified?: boolean;
  isActive?: boolean;
}

export const createUserData = (
  overrides: CreateUserData = {}
): Omit<User, 'createdAt' | 'updatedAt'> => ({
  id: overrides.id || `user-${Date.now()}`,
  email: overrides.email || `test${Date.now()}@example.com`,
  password: overrides.password || 'hashedPassword123',
  firstName: overrides.firstName || 'John',
  lastName: overrides.lastName || 'Doe',
  phone: overrides.phone || '+33123456789',
  userType: overrides.userType || UserType.TENANT,
  profilePicture: null,
  isVerified: overrides.isVerified ?? true,
  isActive: overrides.isActive ?? true,
});

export const createHashedPassword = async (password: string = 'password123'): Promise<string> => {
  return bcrypt.hash(password, 12);
};

export const createTenantData = (
  overrides: CreateUserData = {}
): Omit<User, 'createdAt' | 'updatedAt'> => {
  return createUserData({
    userType: UserType.TENANT,
    ...overrides,
  });
};

export const createLandlordData = (
  overrides: CreateUserData = {}
): Omit<User, 'createdAt' | 'updatedAt'> => {
  return createUserData({
    userType: UserType.LANDLORD,
    ...overrides,
  });
};

export const createAdminData = (
  overrides: CreateUserData = {}
): Omit<User, 'createdAt' | 'updatedAt'> => {
  return createUserData({
    userType: UserType.ADMIN,
    ...overrides,
  });
};
