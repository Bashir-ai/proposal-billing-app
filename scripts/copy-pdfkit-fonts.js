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
const destDirs = [
  path.resolve('.next/server/chunks/data'),
  path.resolve('.next/server/vendor-chunks/data'),
  path.resolve('.next/server/app/api'),
  // Also try the standalone output directory (for Vercel)
  path.resolve('.next/standalone/.next/server/chunks/data'),
  path.resolve('.next/standalone/.next/server/vendor-chunks/data'),
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
