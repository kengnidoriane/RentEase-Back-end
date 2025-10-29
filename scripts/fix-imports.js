#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('🔧 Fixing import paths in compiled JavaScript...');

function fixImportsInFile(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    let modified = false;

    // Get the directory of the current file to calculate relative paths
    const fileDir = path.dirname(filePath);
    const distDir = path.join(process.cwd(), 'dist');
    const relativeFromDist = path.relative(fileDir, distDir);

    // Replace @/ imports with correct relative paths
    const replacements = [
      // Direct @/ imports
      { from: /require\(['"]@\/config\/([^'"]+)['"]\)/g, to: (match, p1) => `require('${path.posix.join(relativeFromDist, 'config', p1)}')` },
      { from: /require\(['"]@\/utils\/([^'"]+)['"]\)/g, to: (match, p1) => `require('${path.posix.join(relativeFromDist, 'utils', p1)}')` },
      { from: /require\(['"]@\/services\/([^'"]+)['"]\)/g, to: (match, p1) => `require('${path.posix.join(relativeFromDist, 'services', p1)}')` },
      { from: /require\(['"]@\/middleware\/([^'"]+)['"]\)/g, to: (match, p1) => `require('${path.posix.join(relativeFromDist, 'middleware', p1)}')` },
      { from: /require\(['"]@\/controllers\/([^'"]+)['"]\)/g, to: (match, p1) => `require('${path.posix.join(relativeFromDist, 'controllers', p1)}')` },
      { from: /require\(['"]@\/routes\/([^'"]+)['"]\)/g, to: (match, p1) => `require('${path.posix.join(relativeFromDist, 'routes', p1)}')` },
      { from: /require\(['"]@\/repositories\/([^'"]+)['"]\)/g, to: (match, p1) => `require('${path.posix.join(relativeFromDist, 'repositories', p1)}')` },
      { from: /require\(['"]@\/types\/([^'"]+)['"]\)/g, to: (match, p1) => `require('${path.posix.join(relativeFromDist, 'types', p1)}')` },
      { from: /require\(['"]@\/([^'"]+)['"]\)/g, to: (match, p1) => `require('${path.posix.join(relativeFromDist, p1)}')` }
    ];

    replacements.forEach(({ from, to }) => {
      if (from.test(content)) {
        content = content.replace(from, to);
        modified = true;
      }
    });

    // Fix any remaining relative path issues
    content = content.replace(/require\(['"]\.\.\/\.\.\//g, "require('../");
    content = content.replace(/require\(['"]\.\/\.\.\//g, "require('../");

    if (modified) {
      fs.writeFileSync(filePath, content);
      console.log(`✅ Fixed imports in: ${path.relative(process.cwd(), filePath)}`);
    }
  } catch (error) {
    console.warn(`⚠️ Could not fix imports in ${filePath}:`, error.message);
  }
}

function walkDirectory(dir) {
  try {
    const files = fs.readdirSync(dir);
    
    files.forEach(file => {
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);
      
      if (stat.isDirectory()) {
        walkDirectory(filePath);
      } else if (file.endsWith('.js')) {
        fixImportsInFile(filePath);
      }
    });
  } catch (error) {
    console.warn(`⚠️ Could not process directory ${dir}:`, error.message);
  }
}

// Fix imports in the dist directory
const distDir = path.join(process.cwd(), 'dist');
if (fs.existsSync(distDir)) {
  walkDirectory(distDir);
  console.log('✅ Import path fixing completed');
} else {
  console.warn('⚠️ dist directory not found, skipping import fixes');
}