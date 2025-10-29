#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🏗️ Starting production build...');

// Step 1: Clean dist directory
console.log('🧹 Cleaning dist directory...');
if (fs.existsSync('dist')) {
  fs.rmSync('dist', { recursive: true, force: true });
}

// Step 2: Try different build strategies
const buildStrategies = [
  {
    name: 'TypeScript with alias resolution',
    command: 'npx tsc --project tsconfig.render.json && node scripts/fix-imports.js'
  },
  {
    name: 'TypeScript without aliases',
    command: 'npx tsc --project tsconfig.noalias.json'
  },
  {
    name: 'Simple TypeScript compilation',
    command: 'npx tsc src/**/*.ts --outDir dist --module commonjs --target ES2020 --skipLibCheck --esModuleInterop --allowJs --moduleResolution node'
  }
];

let buildSuccessful = false;

for (const strategy of buildStrategies) {
  console.log(`🔄 Trying: ${strategy.name}...`);
  
  try {
    execSync(strategy.command, { stdio: 'inherit' });
    
    // Check if server.js was created
    if (fs.existsSync('dist/server.js')) {
      console.log(`✅ Build successful with: ${strategy.name}`);
      buildSuccessful = true;
      break;
    } else {
      console.log(`⚠️ Build completed but server.js not found`);
    }
  } catch (error) {
    console.log(`❌ Failed with: ${strategy.name}`);
    console.log(`Error: ${error.message}`);
  }
}

if (!buildSuccessful) {
  console.log('❌ All build strategies failed');
  process.exit(1);
}

console.log('🎉 Production build completed successfully!');