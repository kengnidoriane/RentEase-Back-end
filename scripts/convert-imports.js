#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('🔄 Converting @/ imports to relative imports...');

function convertImportsInFile(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    let modified = false;

    // Convert @/ imports to relative imports
    const replacements = [
      { from: /from ['"]@\/config\/([^'"]+)['"]/g, to: "from '../config/$1'" },
      { from: /from ['"]@\/utils\/([^'"]+)['"]/g, to: "from '../utils/$1'" },
      { from: /from ['"]@\/services\/([^'"]+)['"]/g, to: "from '../services/$1'" },
      { from: /from ['"]@\/middleware\/([^'"]+)['"]/g, to: "from '../middleware/$1'" },
      { from: /from ['"]@\/controllers\/([^'"]+)['"]/g, to: "from '../controllers/$1'" },
      { from: /from ['"]@\/routes\/([^'"]+)['"]/g, to: "from '../routes/$1'" },
      { from: /from ['"]@\/repositories\/([^'"]+)['"]/g, to: "from '../repositories/$1'" },
      { from: /from ['"]@\/types\/([^'"]+)['"]/g, to: "from '../types/$1'" },
      { from: /from ['"]@\/([^'"]+)['"]/g, to: "from '../$1'" },
      
      { from: /import ['"]@\/config\/([^'"]+)['"]/g, to: "import '../config/$1'" },
      { from: /import ['"]@\/utils\/([^'"]+)['"]/g, to: "import '../utils/$1'" },
      { from: /import ['"]@\/services\/([^'"]+)['"]/g, to: "import '../services/$1'" },
      { from: /import ['"]@\/middleware\/([^'"]+)['"]/g, to: "import '../middleware/$1'" },
      { from: /import ['"]@\/controllers\/([^'"]+)['"]/g, to: "import '../controllers/$1'" },
      { from: /import ['"]@\/routes\/([^'"]+)['"]/g, to: "import '../routes/$1'" },
      { from: /import ['"]@\/repositories\/([^'"]+)['"]/g, to: "import '../repositories/$1'" },
      { from: /import ['"]@\/types\/([^'"]+)['"]/g, to: "import '../types/$1'" },
      { from: /import ['"]@\/([^'"]+)['"]/g, to: "import '../$1'" }
    ];

    replacements.forEach(({ from, to }) => {
      if (from.test(content)) {
        content = content.replace(from, to);
        modified = true;
      }
    });

    if (modified) {
      fs.writeFileSync(filePath, content);
      console.log(`✅ Converted imports in: ${path.relative(process.cwd(), filePath)}`);
    }
  } catch (error) {
    console.warn(`⚠️ Could not convert imports in ${filePath}:`, error.message);
  }
}

function walkDirectory(dir) {
  try {
    const files = fs.readdirSync(dir);
    
    files.forEach(file => {
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);
      
      if (stat.isDirectory() && !file.includes('__tests__') && !file.includes('node_modules')) {
        walkDirectory(filePath);
      } else if (file.endsWith('.ts') && !file.endsWith('.test.ts') && !file.endsWith('.spec.ts')) {
        convertImportsInFile(filePath);
      }
    });
  } catch (error) {
    console.warn(`⚠️ Could not process directory ${dir}:`, error.message);
  }
}

// Create a temporary copy of src for conversion
const srcDir = path.join(process.cwd(), 'src');
const tempDir = path.join(process.cwd(), 'src-temp');

if (fs.existsSync(tempDir)) {
  fs.rmSync(tempDir, { recursive: true, force: true });
}

// Copy src to src-temp
console.log('📁 Creating temporary source copy...');
fs.cpSync(srcDir, tempDir, { recursive: true });

// Convert imports in temp directory
walkDirectory(tempDir);

console.log('✅ Import conversion completed in src-temp directory');