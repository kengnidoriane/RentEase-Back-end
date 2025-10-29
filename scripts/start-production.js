#!/usr/bin/env node

const { execSync } = require('child_process');

console.log('🚀 Starting RentEase Backend...');

// Check if DATABASE_URL is available
if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL is not defined!');
  console.log('Available environment variables:');
  Object.keys(process.env).forEach(key => {
    if (key.includes('DATABASE') || key.includes('REDIS') || key.includes('JWT')) {
      console.log(`${key}: ${process.env[key] ? '✅ Defined' : '❌ Missing'}`);
    }
  });
  process.exit(1);
}

console.log('✅ DATABASE_URL found');

// Check if DATABASE_URL has correct format
if (!process.env.DATABASE_URL.startsWith('postgresql://') && !process.env.DATABASE_URL.startsWith('postgres://')) {
  console.error('❌ DATABASE_URL must start with postgresql:// or postgres://');
  console.log('Current DATABASE_URL format:', process.env.DATABASE_URL.substring(0, 20) + '...');
  process.exit(1);
}

console.log('✅ DATABASE_URL format is correct');

try {
  // Try to generate Prisma client
  console.log('🔧 Generating Prisma client...');
  execSync('npx prisma generate', { stdio: 'inherit' });
  console.log('✅ Prisma client generated');

  // Try to run migrations
  console.log('🔄 Running database migrations...');
  execSync('npx prisma migrate deploy', { stdio: 'inherit' });
  console.log('✅ Migrations completed');

} catch (error) {
  console.warn('⚠️ Database setup failed, but continuing...');
  console.warn('Error:', error.message);
}

// Start the server
console.log('🌟 Starting server...');
try {
  execSync('node dist/server.js', { stdio: 'inherit' });
} catch (error) {
  console.error('❌ Server failed to start:', error.message);
  process.exit(1);
}