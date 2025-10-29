#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🏗️ Starting simple production build...');

// Step 1: Clean dist directory
console.log('🧹 Cleaning dist directory...');
if (fs.existsSync('dist')) {
  fs.rmSync('dist', { recursive: true, force: true });
}

try {
  // Step 2: Convert imports and build from temp directory
  console.log('🔄 Converting imports...');
  execSync('node scripts/convert-imports.js', { stdio: 'inherit' });
  
  // Step 3: Build from temp directory
  console.log('🔨 Building from converted source...');
  // Create a temporary tsconfig for src-temp
  const tempTsConfig = {
    "compilerOptions": {
      "target": "ES2020",
      "module": "commonjs",
      "moduleResolution": "node",
      "rootDir": "./src-temp",
      "outDir": "./dist",
      "strict": false,
      "esModuleInterop": true,
      "skipLibCheck": true,
      "forceConsistentCasingInFileNames": false,
      "resolveJsonModule": true,
      "allowJs": true,
      "checkJs": false,
      "noEmit": false,
      "noEmitOnError": false,
      "allowUnreachableCode": true,
      "allowUnusedLabels": true,
      "noImplicitAny": false,
      "noImplicitReturns": false,
      "noImplicitThis": false,
      "noUnusedLocals": false,
      "noUnusedParameters": false,
      "exactOptionalPropertyTypes": false,
      "noImplicitOverride": false,
      "noPropertyAccessFromIndexSignature": false,
      "noUncheckedIndexedAccess": false,
      "allowSyntheticDefaultImports": true,
      "experimentalDecorators": true,
      "emitDecoratorMetadata": true
    },
    "include": ["src-temp/**/*"],
    "exclude": [
      "node_modules",
      "**/*.test.ts",
      "**/*.spec.ts",
      "src-temp/__tests__/**/*"
    ]
  };
  
  fs.writeFileSync('tsconfig.temp.json', JSON.stringify(tempTsConfig, null, 2));
  
  execSync('npx tsc --project tsconfig.temp.json', { stdio: 'inherit' });
  
  // Clean up temp tsconfig
  if (fs.existsSync('tsconfig.temp.json')) {
    fs.unlinkSync('tsconfig.temp.json');
  }
  
  // Step 4: Clean up temp directory
  console.log('🧹 Cleaning up temporary files...');
  if (fs.existsSync('src-temp')) {
    fs.rmSync('src-temp', { recursive: true, force: true });
  }
  
  // Step 5: Verify build
  if (fs.existsSync('dist/server.js')) {
    console.log('✅ Simple build completed successfully!');
  } else {
    throw new Error('server.js not found in dist directory');
  }
  
} catch (error) {
  console.error('❌ Simple build failed:', error.message);
  
  // Cleanup on failure
  if (fs.existsSync('src-temp')) {
    fs.rmSync('src-temp', { recursive: true, force: true });
  }
  
  process.exit(1);
}