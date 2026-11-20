#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const MASTER_PNG_PATH = path.join(ROOT, 'assets', 'app-icon-master.png');

/**
 * Fallback & Favicon vibrant luminous SVG matching our sunlit sky-aqua-azure 3D master icon.
 */
const MASTER_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <defs>
    <linearGradient id="bgGrad" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0EA5E9"/>
      <stop offset="48%" stop-color="#22D3EE"/>
      <stop offset="100%" stop-color="#6366F1"/>
    </linearGradient>
    <radialGradient id="sunGlow" cx="35%" cy="32%" r="58%">
      <stop offset="0%" stop-color="#BAE6FD" stop-opacity="0.65"/>
      <stop offset="100%" stop-color="#2563EB" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="sparkGrad" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#FB7185"/>
      <stop offset="50%" stop-color="#FBBF24"/>
      <stop offset="100%" stop-color="#A855F7"/>
    </linearGradient>
  </defs>
  <rect x="0" y="0" width="1024" height="1024" fill="url(#bgGrad)"/>
  <rect x="0" y="0" width="1024" height="1024" fill="url(#sunGlow)"/>
  <path d="M 512 512 C 512 378, 636 332, 760 264" fill="none" stroke="#FBBF24" stroke-width="58" stroke-linecap="round"/>
  <path d="M 512 512 C 512 384, 388 336, 264 268" fill="none" stroke="#FB7185" stroke-width="58" stroke-linecap="round"/>
  <path d="M 512 512 C 512 644, 392 692, 268 758" fill="none" stroke="#34D399" stroke-width="58" stroke-linecap="round"/>
  <path d="M 512 512 C 512 644, 632 692, 756 758" fill="none" stroke="#C084FC" stroke-width="58" stroke-linecap="round"/>
  <circle cx="768" cy="258" r="92" fill="#FFFFFF"/><circle cx="768" cy="258" r="66" fill="#F59E0B"/>
  <circle cx="256" cy="262" r="92" fill="#FFFFFF"/><circle cx="256" cy="262" r="66" fill="#F43F5E"/>
  <circle cx="262" cy="762" r="92" fill="#FFFFFF"/><circle cx="262" cy="762" r="66" fill="#10B981"/>
  <circle cx="762" cy="762" r="92" fill="#FFFFFF"/><circle cx="762" cy="762" r="66" fill="#A855F7"/>
  <rect x="352" y="352" width="320" height="320" rx="96" fill="#FFFFFF"/>
  <path d="M 512 404 C 526 468, 556 498, 620 512 C 556 526, 526 556, 512 620 C 498 556, 468 526, 404 512 C 468 498, 498 468, 512 404 Z" fill="url(#sparkGrad)"/>
</svg>`;

const IOS_ICON_SLOTS = [
  // iPhone
  { idiom: 'iphone', size: '20x20', scale: '2x', px: 40, filename: 'AppIcon-20@2x.png' },
  { idiom: 'iphone', size: '20x20', scale: '3x', px: 60, filename: 'AppIcon-20@3x.png' },
  { idiom: 'iphone', size: '29x29', scale: '2x', px: 58, filename: 'AppIcon-29@2x.png' },
  { idiom: 'iphone', size: '29x29', scale: '3x', px: 87, filename: 'AppIcon-29@3x.png' },
  { idiom: 'iphone', size: '40x40', scale: '2x', px: 80, filename: 'AppIcon-40@2x.png' },
  { idiom: 'iphone', size: '40x40', scale: '3x', px: 120, filename: 'AppIcon-40@3x.png' },
  { idiom: 'iphone', size: '60x60', scale: '2x', px: 120, filename: 'AppIcon-60@2x.png' },
  { idiom: 'iphone', size: '60x60', scale: '3x', px: 180, filename: 'AppIcon-60@3x.png' },
  // iPad
  { idiom: 'ipad', size: '20x20', scale: '1x', px: 20, filename: 'AppIcon-20@1x~ipad.png' },
  { idiom: 'ipad', size: '20x20', scale: '2x', px: 40, filename: 'AppIcon-20@2x~ipad.png' },
  { idiom: 'ipad', size: '29x29', scale: '1x', px: 29, filename: 'AppIcon-29@1x~ipad.png' },
  { idiom: 'ipad', size: '29x29', scale: '2x', px: 58, filename: 'AppIcon-29@2x~ipad.png' },
  { idiom: 'ipad', size: '40x40', scale: '1x', px: 40, filename: 'AppIcon-40@1x~ipad.png' },
  { idiom: 'ipad', size: '40x40', scale: '2x', px: 80, filename: 'AppIcon-40@2x~ipad.png' },
  { idiom: 'ipad', size: '76x76', scale: '1x', px: 76, filename: 'AppIcon-76@1x~ipad.png' },
  { idiom: 'ipad', size: '76x76', scale: '2x', px: 152, filename: 'AppIcon-76@2x~ipad.png' },
  { idiom: 'ipad', size: '83.5x83.5', scale: '2x', px: 167, filename: 'AppIcon-83.5@2x~ipad.png' },
  // App Store Marketing 1024x1024 (Zero Alpha Required by Apple ITMS-90717!)
  { idiom: 'ios-marketing', size: '1024x1024', scale: '1x', px: 1024, filename: 'AppIcon-512@2x.png' },
];

async function renderOpaqueIconPng(masterBuffer, sizePx, flattenBg = '#0EA5E9') {
  const buf = await sharp(masterBuffer)
    .resize(sizePx, sizePx, { fit: 'cover', kernel: sharp.kernel.lanczos3 })
    .flatten({ background: flattenBg })
    .removeAlpha()
    .png({ compressionLevel: 9, palette: false })
    .toBuffer();

  // Verify PNG IHDR colorType byte at offset 25 === 2 (24-bit Truecolor RGB, ZERO alpha)
  const colorType = buf[25];
  if (colorType !== 2) {
    throw new Error(
      `Alfa kanalı hatası! Üretilen PNG colorType=${colorType} (beklenen: 2 / 24-bit RGB).`
    );
  }
  return buf;
}

async function renderSplashPng(masterBuffer) {
  const iconSize = 480;
  const radius = 112;
  const roundedMask = Buffer.from(
    `<svg width="${iconSize}" height="${iconSize}" xmlns="http://www.w3.org/2000/svg"><rect x="0" y="0" width="${iconSize}" height="${iconSize}" rx="${radius}" ry="${radius}" fill="#ffffff"/></svg>`
  );

  const roundedIcon = await sharp(masterBuffer)
    .resize(iconSize, iconSize, { fit: 'cover', kernel: sharp.kernel.lanczos3 })
    .ensureAlpha()
    .composite([{ input: roundedMask, blend: 'dest-in' }])
    .png()
    .toBuffer();

  const shadowSvg = Buffer.from(
    `<svg width="2732" height="2732" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="splashHalo" cx="50%" cy="50%" r="24%">
          <stop offset="0%" stop-color="#38BDF8" stop-opacity="0.18"/>
          <stop offset="100%" stop-color="#FAF9F5" stop-opacity="0"/>
        </radialGradient>
      </defs>
      <rect x="0" y="0" width="2732" height="2732" fill="#FAF9F5"/>
      <rect x="0" y="0" width="2732" height="2732" fill="url(#splashHalo)"/>
    </svg>`
  );

  const buf = await sharp(shadowSvg)
    .composite([
      {
        input: roundedIcon,
        left: Math.round((2732 - iconSize) / 2),
        top: Math.round((2732 - iconSize) / 2),
      },
    ])
    .flatten({ background: '#FAF9F5' })
    .removeAlpha()
    .png({ compressionLevel: 9, palette: false })
    .toBuffer();

  if (buf[25] !== 2) {
    throw new Error(`Splash PNG alfa kanalı hatası: colorType=${buf[25]}`);
  }
  return buf;
}

async function main() {
  const appIconDir = path.join(ROOT, 'ios', 'App', 'App', 'Assets.xcassets', 'AppIcon.appiconset');
  const splashDir = path.join(ROOT, 'ios', 'App', 'App', 'Assets.xcassets', 'Splash.imageset');
  const publicDir = path.join(ROOT, 'public');
  const submissionDir = path.join(ROOT, 'appstore-submission');

  await fs.mkdir(appIconDir, { recursive: true });
  await fs.mkdir(splashDir, { recursive: true });
  await fs.mkdir(publicDir, { recursive: true });
  await fs.mkdir(submissionDir, { recursive: true });

  let masterBuffer;
  try {
    masterBuffer = await fs.readFile(MASTER_PNG_PATH);
  } catch {
    masterBuffer = await sharp(Buffer.from(MASTER_ICON_SVG), { density: 144 }).png().toBuffer();
  }

  // 1. Generate all 18 iOS AppIcon sizes (strictly 24-bit RGB without alpha)
  for (const slot of IOS_ICON_SLOTS) {
    const pngBuf = await renderOpaqueIconPng(masterBuffer, slot.px, '#0EA5E9');
    await fs.writeFile(path.join(appIconDir, slot.filename), pngBuf);
  }

  const iconContentsJson = {
    images: IOS_ICON_SLOTS.map((s) => ({
      filename: s.filename,
      idiom: s.idiom,
      scale: s.scale,
      size: s.size,
    })),
    info: { author: 'xcode', version: 1 },
  };
  await fs.writeFile(
    path.join(appIconDir, 'Contents.json'),
    JSON.stringify(iconContentsJson, null, 2) + '\n',
    'utf8'
  );

  // Copy 1024x1024 marketing icon to appstore-submission/AppIcon-1024.png
  await fs.copyFile(
    path.join(appIconDir, 'AppIcon-512@2x.png'),
    path.join(submissionDir, 'AppIcon-1024.png')
  );

  // 2. Generate 2732x2732 iOS Splash screens (1x, 2x, 3x slots)
  const splashBuf = await renderSplashPng(masterBuffer);
  for (const sf of ['splash-2732x2732.png', 'splash-2732x2732-1.png', 'splash-2732x2732-2.png']) {
    await fs.writeFile(path.join(splashDir, sf), splashBuf);
  }
  const splashContentsJson = {
    images: [
      { idiom: 'universal', filename: 'splash-2732x2732-2.png', scale: '1x' },
      { idiom: 'universal', filename: 'splash-2732x2732-1.png', scale: '2x' },
      { idiom: 'universal', filename: 'splash-2732x2732.png', scale: '3x' },
    ],
    info: { version: 1, author: 'xcode' },
  };
  await fs.writeFile(
    path.join(splashDir, 'Contents.json'),
    JSON.stringify(splashContentsJson, null, 2) + '\n',
    'utf8'
  );

  // 3. Generate Web / PWA Icons & Favicon
  await fs.writeFile(path.join(publicDir, 'pwa-192x192.png'), await renderOpaqueIconPng(masterBuffer, 192));
  await fs.writeFile(path.join(publicDir, 'pwa-512x512.png'), await renderOpaqueIconPng(masterBuffer, 512));
  await fs.writeFile(path.join(publicDir, 'apple-touch-icon.png'), await renderOpaqueIconPng(masterBuffer, 180));
  await fs.writeFile(path.join(publicDir, 'favicon.svg'), MASTER_ICON_SVG, 'utf8');

  const meta1024 = await sharp(path.join(appIconDir, 'AppIcon-512@2x.png')).metadata();
  console.log(
    `[Icons & Splash] 18 iOS ikon boyutu + 2732x2732 Splash + PWA ikonları üretildi. ` +
      `1024x1024 doğrulaması: ${meta1024.width}x${meta1024.height}, channels=${meta1024.channels}, hasAlpha=${meta1024.hasAlpha}`
  );
}

main().catch((err) => {
  console.error('[Icons & Splash] HATA:', err);
  process.exit(1);
});
