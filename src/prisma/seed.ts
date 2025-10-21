import { PrismaClient, UserType } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seeding...');

  // Create admin user
  const adminPassword = await bcrypt.hash('admin123', 12);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@rentease.com' },
    update: {},
    create: {
      email: 'admin@rentease.com',
      password: adminPassword,
      firstName: 'Admin',
      lastName: 'User',
      phone: '+33123456789',
      userType: UserType.ADMIN,
      isVerified: true,
    },
  });

  // Create sample landlord
  const landlordPassword = await bcrypt.hash('landlord123', 12);
  const landlord = await prisma.user.upsert({
    where: { email: 'landlord@example.com' },
    update: {},
    create: {
      email: 'landlord@example.com',
      password: landlordPassword,
      firstName: 'John',
      lastName: 'Landlord',
      phone: '+33123456790',
      userType: UserType.LANDLORD,
      isVerified: true,
    },
  });

  // Create sample tenant
  const tenantPassword = await bcrypt.hash('tenant123', 12);
  const tenant = await prisma.user.upsert({
    where: { email: 'tenant@example.com' },
    update: {},
    create: {
      email: 'tenant@example.com',
      password: tenantPassword,
      firstName: 'Jane',
      lastName: 'Tenant',
      phone: '+33123456791',
      userType: UserType.TENANT,
      isVerified: true,
    },
  });

  console.log('✅ Users created successfully');
  console.log(`Admin: ${admin.email}, Landlord: ${landlord.email}, Tenant: ${tenant.email}`);
  console.log('🌱 Database seeding completed!');
}

main()
  .catch(e => {
    console.error('❌ Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
