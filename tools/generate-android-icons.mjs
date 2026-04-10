import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const root = process.cwd();
const publicDir = path.join(root, 'public');
const sourceSvg = path.join(publicDir, 'favicon.svg');

const targets = [
  { file: 'android-chrome-192x192.png', size: 192 },
  { file: 'android-chrome-512x512.png', size: 512 },
  { file: 'android-chrome-192x192-maskable.png', size: 192 },
  { file: 'android-chrome-512x512-maskable.png', size: 512 },
];

async function generateAndroidIcons() {
  if (!fs.existsSync(sourceSvg)) {
    throw new Error(`Missing source icon: ${sourceSvg}`);
  }

  const svgBuffer = fs.readFileSync(sourceSvg);

  for (const target of targets) {
    const outputFile = path.join(publicDir, target.file);
    await sharp(svgBuffer)
      .resize(target.size, target.size, {
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .png({ quality: 100, compressionLevel: 9 })
      .toFile(outputFile);

    const stat = fs.statSync(outputFile);
    console.log(`✅ ${target.file} (${target.size}x${target.size}) - ${stat.size} bytes`);
  }
}

generateAndroidIcons().catch((error) => {
  console.error('❌ Android icon generation failed:', error);
  process.exitCode = 1;
});
