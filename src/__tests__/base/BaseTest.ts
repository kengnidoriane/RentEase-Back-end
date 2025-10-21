import { testPrisma } from '../setup';
import { User, Property } from '@prisma/client';
import { createUserData, createHashedPassword } from '../factories/userFactory';
import { createPropertyData } from '../factories/propertyFactory';

export abstract class BaseTest {
  protected prisma = testPrisma;

  protected async createTestUser(overrides = {}): Promise<User> {
    const userData = createUserData(overrides);
    const hashedPassword = await createHashedPassword();

    return this.prisma.user.create({
      data: {
        ...userData,
        password: hashedPassword,
      },
    });
  }

  protected async createTestProperty(landlordId: string, overrides = {}): Promise<Property> {
    const propertyData = createPropertyData({ landlordId, ...overrides });

    return this.prisma.property.create({
      data: propertyData,
    });
  }

  protected async cleanupDatabase(): Promise<void> {
    await this.prisma.verificationDocument.deleteMany();
    await this.prisma.propertyImage.deleteMany();
    await this.prisma.favorite.deleteMany();
    await this.prisma.message.deleteMany();
    await this.prisma.property.deleteMany();
    await this.prisma.user.deleteMany();
  }
}
