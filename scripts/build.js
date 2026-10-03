#!/usr/bin/env node
/**
 * Build script for LXA
 * Prepares production bundle
 */

const fs = require('fs');
const path = require('path');

console.log('🔨 Building LXA...\n');

// Create dist directory
const distDir = path.join(__dirname, '..', 'dist');
if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true });
  console.log('✅ Created dist/ directory');
}

// Copy HTML
const htmlSrc = path.join(__dirname, '..', 'index.html');
const htmlDest = path.join(distDir, 'index.html');
fs.copyFileSync(htmlSrc, htmlDest);
console.log('✅ Copied index.html');

// Copy CSS
const cssSrc = path.join(__dirname, '..', 'style.css');
const cssDest = path.join(distDir, 'style.css');
fs.copyFileSync(cssSrc, cssDest);
console.log('✅ Copied style.css');

// Copy layout-fix CSS
const layoutSrc = path.join(__dirname, '..', 'layout-fix.css');
const layoutDest = path.join(distDir, 'layout-fix.css');
if (fs.existsSync(layoutSrc)) {
  fs.copyFileSync(layoutSrc, layoutDest);
  console.log('✅ Copied layout-fix.css');
}

// Copy responsive-compact CSS (loaded by index.html; omitting this left
// dist/ missing a stylesheet the real page requires)
const responsiveCompactSrc = path.join(__dirname, '..', 'responsive-compact.css');
const responsiveCompactDest = path.join(distDir, 'responsive-compact.css');
if (fs.existsSync(responsiveCompactSrc)) {
  fs.copyFileSync(responsiveCompactSrc, responsiveCompactDest);
  console.log('✅ Copied responsive-compact.css');
}

// Copy game engine
const engineSrc = path.join(__dirname, '..', 'game-engine.js');
const engineDest = path.join(distDir, 'game-engine.js');
fs.copyFileSync(engineSrc, engineDest);
console.log('✅ Copied game-engine.js');

// Copy renderer
const rendererSrc = path.join(__dirname, '..', 'renderer.js');
const rendererDest = path.join(distDir, 'renderer.js');
fs.copyFileSync(rendererSrc, rendererDest);
console.log('✅ Copied renderer.js');

// Copy JS modules
const jsDir = path.join(__dirname, '..', 'js');
const distJsDir = path.join(distDir, 'js');
if (fs.existsSync(jsDir) && !fs.existsSync(distJsDir)) {
  fs.mkdirSync(distJsDir, { recursive: true });
  fs.readdirSync(jsDir).forEach(file => {
    if (file.endsWith('.js')) {
      fs.copyFileSync(
        path.join(jsDir, file),
        path.join(distJsDir, file)
      );
    }
  });
  console.log('✅ Copied js/ modules');
}

// Copy manifest
const manifestSrc = path.join(__dirname, '..', 'manifest.webmanifest');
const manifestDest = path.join(distDir, 'manifest.webmanifest');
if (fs.existsSync(manifestSrc)) {
  fs.copyFileSync(manifestSrc, manifestDest);
  console.log('✅ Copied manifest.webmanifest');
}

// Copy assets
const assetsSrc = path.join(__dirname, '..', 'assets');
const assetsDest = path.join(distDir, 'assets');
if (fs.existsSync(assetsSrc)) {
  const copyRecursive = (src, dest) => {
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true });
    }
    fs.readdirSync(src).forEach(file => {
      const srcFile = path.join(src, file);
      const destFile = path.join(dest, file);
      if (fs.statSync(srcFile).isDirectory()) {
        copyRecursive(srcFile, destFile);
      } else {
        fs.copyFileSync(srcFile, destFile);
      }
    });
  };
  copyRecursive(assetsSrc, assetsDest);
  console.log('✅ Copied assets/');
}

console.log('\n📦 Build complete!');
console.log(`📍 Output: ${distDir}`);
console.log('\n🚀 Ready to deploy to Vercel or any static host.');
