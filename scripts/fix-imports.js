#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('🔧 Fixing import paths in compiled JavaScript...');

function fixImportsInFile(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    let modified = false;

    // Replace @/ imports with relative paths
    const replacements = [
      { from: /require\(['"]@\/config\/([^'"]+)['"]\)/g, to: "require('./config/$1')" },
      { from: /require\(['"]@\/utils\/([^'"]+)['"]\)/g, to: "require('./utils/$1')" },
      { from: /require\(['"]@\/services\/([^'"]+)['"]\)/g, to: "require('./services/$1')" },
      { from: /require\(['"]@\/middleware\/([^'"]+)['"]\)/g, to: "require('./middleware/$1')" },
      { from: /require\(['"]@\/controllers\/([^'"]+)['"]\)/g, to: "require('./controllers/$1')" },
      { from: /require\(['"]@\/routes\/([^'"]+)['"]\)/g, to: "require('./routes/$1')" },
      { from: /require\(['"]@\/repositories\/([^'"]+)['"]\)/g, to: "require('./repositories/$1')" },
      { from: /require\(['"]@\/types\/([^'"]+)['"]\)/g, to: "require('./types/$1')" },
      { from: /require\(['"]@\/([^'"]+)['"]\)/g, to: "require('./$1')" }
    ];

    replacements.forEach(({ from, to }) => {
      if (from.test(content)) {
        content = content.replace(from, to);
        modified = true;
      }
    });

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