const fs = require('fs');
const path = require('path');

// Font files that PDFKit needs
const fontFiles = [
  'Helvetica.afm',
  'Helvetica-Bold.afm',
  'Helvetica-Oblique.afm',
  'Helvetica-BoldOblique.afm',
  'Courier.afm',
  'Courier-Bold.afm',
  'Courier-Oblique.afm',
  'Courier-BoldOblique.afm',
  'Times-Roman.afm',
  'Times-Bold.afm',
  'Times-Italic.afm',
  'Times-BoldItalic.afm',
];

const sourceDir = path.resolve('node_modules/pdfkit/js/data');

// Get the base directory (project root)
const projectRoot = path.resolve(__dirname, '..');

// Try multiple possible locations where PDFKit might look for fonts
const destDirs = [
  path.join(projectRoot, '.next/server/chunks/data'),
  path.join(projectRoot, '.next/server/vendor-chunks/data'),
  path.join(projectRoot, '.next/server/app/api'),
  // Standalone output (for Vercel)
  path.join(projectRoot, '.next/standalone/.next/server/chunks/data'),
  path.join(projectRoot, '.next/standalone/.next/server/vendor-chunks/data'),
  // Also try node_modules location (in case pdfkit is externalized)
  path.join(projectRoot, 'node_modules/pdfkit/js/data'),
];

// Also copy to public directory as fallback
const publicDestDir = path.resolve('public/fonts');

// Create destination directories and copy files
fontFiles.forEach(fontFile => {
  const sourcePath = path.join(sourceDir, fontFile);
  
  if (!fs.existsSync(sourcePath)) {
    console.warn(`Warning: Font file ${fontFile} not found at ${sourcePath}`);
    return;
  }

  destDirs.forEach(destDir => {
    try {
      // Create directory if it doesn't exist
      if (!fs.existsSync(destDir)) {
        fs.mkdirSync(destDir, { recursive: true });
      }

      const destPath = path.join(destDir, fontFile);
      fs.copyFileSync(sourcePath, destPath);
      console.log(`✓ Copied ${fontFile} to ${destPath}`);
    } catch (error) {
      // Silently skip if directory doesn't exist (normal during development)
      if (error.code !== 'ENOENT') {
        console.warn(`Warning: Could not copy ${fontFile} to ${destDir}:`, error.message);
      }
    }
  });

  // Also copy to public directory as fallback
  try {
    if (!fs.existsSync(publicDestDir)) {
      fs.mkdirSync(publicDestDir, { recursive: true });
    }
    const publicDestPath = path.join(publicDestDir, fontFile);
    fs.copyFileSync(sourcePath, publicDestPath);
    console.log(`✓ Copied ${fontFile} to ${publicDestPath}`);
  } catch (error) {
    console.warn(`Warning: Could not copy ${fontFile} to public directory:`, error.message);
  }
});

console.log('PDFKit font files copied successfully!');
