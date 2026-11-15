#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

/**
 * Full-bleed 1024x1024 vector master artwork (text-free per Apple HIG):
 * - Deep Indigo Studio gradient base (#1E1B4B -> #252163 -> #0F172A) with warm radial highlight
 * - 4 vibrant organic Bezier branches (#38BDF8, #10B981, #F59E0B, #F43F5E)
 * - Central crisp white die-cut sticker emblem with four-point creative spark
 */
const MASTER_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <defs>
    <linearGradient id="bgGrad" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#272366"/>
      <stop offset="52%" stop-color="#1E1B4B"/>
      <stop offset="100%" stop-color="#111827"/>
    </linearGradient>
    <radialGradient id="warmGlow" cx="50%" cy="44%" r="54%">
      <stop offset="0%" stop-color="#4F46E5" stop-opacity="0.48"/>
      <stop offset="65%" stop-color="#1E1B4B" stop-opacity="0.12"/>
      <stop offset="100%" stop-color="#1E1B4B" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="skyBranch" x1="0" y1="1" x2="1" y2="0">
      <stop offset="0%" stop-color="#0EA5E9"/>
      <stop offset="100%" stop-color="#38BDF8"/>
    </linearGradient>
    <linearGradient id="amberBranch" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#F59E0B"/>
      <stop offset="100%" stop-color="#FBBF24"/>
    </linearGradient>
    <linearGradient id="emeraldBranch" x1="1" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#10B981"/>
      <stop offset="100%" stop-color="#34D399"/>
    </linearGradient>
    <linearGradient id="roseBranch" x1="1" y1="1" x2="0" y2="0">
      <stop offset="0%" stop-color="#F43F5E"/>
      <stop offset="100%" stop-color="#FB7185"/>
    </linearGradient>
  </defs>

  <!-- Solid 100% opaque full-bleed background -->
  <rect x="0" y="0" width="1024" height="1024" fill="url(#bgGrad)"/>
  <rect x="0" y="0" width="1024" height="1024" fill="url(#warmGlow)"/>

  <!-- Subtle architectural notebook orbit ring -->
  <circle cx="512" cy="512" r="338" fill="none" stroke="#6366F1" stroke-opacity="0.18" stroke-width="6" stroke-dasharray="18 22"/>

  <!-- 4 Organic Tapered Mind-Map Branches -->
  <path d="M 512 512 C 512 378, 636 332, 760 264" fill="none" stroke="url(#skyBranch)" stroke-width="46" stroke-linecap="round"/>
  <path d="M 512 512 C 512 384, 388 336, 264 268" fill="none" stroke="url(#roseBranch)" stroke-width="46" stroke-linecap="round"/>
  <path d="M 512 512 C 512 644, 392 692, 268 758" fill="none" stroke="url(#emeraldBranch)" stroke-width="46" stroke-linecap="round"/>
  <path d="M 512 512 C 512 644, 632 692, 756 758" fill="none" stroke="url(#amberBranch)" stroke-width="46" stroke-linecap="round"/>

  <!-- Satellite Die-Cut Sticker Nodes -->
  <!-- Top-Right Sky Node -->
  <circle cx="768" cy="258" r="88" fill="#FFFFFF"/>
  <circle cx="768" cy="258" r="64" fill="#0EA5E9"/>
  <circle cx="750" cy="240" r="18" fill="#BAE6FD"/>

  <!-- Top-Left Rose Node -->
  <circle cx="256" cy="262" r="88" fill="#FFFFFF"/>
  <circle cx="256" cy="262" r="64" fill="#F43F5E"/>
  <path d="M 256 290 C 230 270, 222 246, 238 234 C 248 226, 256 236, 256 242 C 256 236, 264 226, 274 234 C 290 246, 282 270, 256 290 Z" fill="#FFFFFF"/>

  <!-- Bottom-Left Emerald Node -->
  <circle cx="262" cy="762" r="88" fill="#FFFFFF"/>
  <circle cx="262" cy="762" r="64" fill="#10B981"/>
  <rect x="234" y="734" width="56" height="56" rx="14" fill="#FFFFFF"/>

  <!-- Bottom-Right Amber Node -->
  <circle cx="762" cy="762" r="88" fill="#FFFFFF"/>
  <circle cx="762" cy="762" r="64" fill="#F59E0B"/>
  <polygon points="762,724 796,784 728,784" fill="#FFFFFF" stroke="#FFFFFF" stroke-width="8" stroke-linejoin="round"/>

  <!-- Center Vinyl Die-Cut Sticker Star Hub -->
  <rect x="356" y="356" width="312" height="312" rx="92" fill="#FFFFFF"/>
  <rect x="382" y="382" width="260" height="260" rx="74" fill="#EEF2FF"/>
  <path
    d="M 512 406 C 526 468, 556 498, 618 512 C 556 526, 526 556, 512 618 C 498 556, 468 526, 406 512 C 468 498, 498 468, 512 406 Z"
    fill="#312E81"
  />
  <circle cx="574" cy="444" r="16" fill="#F59E0B"/>
</svg>`;

/**
 * Warm cream #FAF9F5 2732x2732 iOS Universal Launch Screen matching --canvas-bg
 * so transition from iOS LaunchScreen to WebView has ZERO flash.
 */
const SPLASH_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="2732" height="2732" viewBox="0 0 2732 2732">
  <rect x="0" y="0" width="2732" height="2732" fill="#FAF9F5"/>
  <g transform="translate(1110, 1110) scale(0.5)">
    <rect x="48" y="48" width="928" height="928" rx="224" fill="#1E1B4B"/>
    <path d="M 512 512 C 512 378, 636 332, 760 264" fill="none" stroke="#38BDF8" stroke-width="46" stroke-linecap="round"/>
    <path d="M 512 512 C 512 384, 388 336, 264 268" fill="none" stroke="#FB7185" stroke-width="46" stroke-linecap="round"/>
    <path d="M 512 512 C 512 644, 392 692, 268 758" fill="none" stroke="#34D399" stroke-width="46" stroke-linecap="round"/>
    <path d="M 512 512 C 512 644, 632 692, 756 758" fill="none" stroke="#FBBF24" stroke-width="46" stroke-linecap="round"/>
    <circle cx="768" cy="258" r="80" fill="#FFFFFF"/>
    <circle cx="768" cy="258" r="56" fill="#0EA5E9"/>
    <circle cx="256" cy="262" r="80" fill="#FFFFFF"/>
    <circle cx="256" cy="262" r="56" fill="#F43F5E"/>
    <circle cx="262" cy="762" r="80" fill="#FFFFFF"/>
    <circle cx="262" cy="762" r="56" fill="#10B981"/>
    <circle cx="762" cy="762" r="80" fill="#FFFFFF"/>
    <circle cx="762" cy="762" r="56" fill="#F59E0B"/>
    <rect x="364" y="364" width="296" height="296" rx="88" fill="#FFFFFF"/>
    <path
      d="M 512 412 C 525 470, 554 499, 612 512 C 554 525, 525 554, 512 612 C 499 554, 470 525, 412 512 C 470 499, 499 470, 512 412 Z"
      fill="#312E81"
    />
  </g>
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

async function renderOpaqueRgbPng(svgString, width, height, flattenBg) {
  const buf = await sharp(Buffer.from(svgString), { density: 144 })
    .resize(width, height, { fit: 'cover' })
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

async function main() {
  const appIconDir = path.join(
    ROOT,
    'ios',
    'App',
    'App',
    'Assets.xcassets',
    'AppIcon.appiconset'
  );
  const splashDir = path.join(
    ROOT,
    'ios',
    'App',
    'App',
    'Assets.xcassets',
    'Splash.imageset'
  );
  const publicDir = path.join(ROOT, 'public');
  const submissionDir = path.join(ROOT, 'appstore-submission');

  await fs.mkdir(appIconDir, { recursive: true });
  await fs.mkdir(splashDir, { recursive: true });
  await fs.mkdir(publicDir, { recursive: true });
  await fs.mkdir(submissionDir, { recursive: true });

  // 1. Generate all iOS AppIcon sizes (strictly 24-bit RGB without alpha)
  for (const slot of IOS_ICON_SLOTS) {
    const pngBuf = await renderOpaqueRgbPng(
      MASTER_ICON_SVG,
      slot.px,
      slot.px,
      '#1E1B4B'
    );
    await fs.writeFile(path.join(appIconDir, slot.filename), pngBuf);
  }

  const iconContentsJson = {
    images: IOS_ICON_SLOTS.map((s) => ({
      filename: s.filename,
      idiom: s.idiom,
      scale: s.scale,
      size: s.size,
    })),
    info: {
      author: 'xcode',
      version: 1,
    },
  };
  await fs.writeFile(
    path.join(appIconDir, 'Contents.json'),
    JSON.stringify(iconContentsJson, null, 2) + '\n',
    'utf8'
  );

  // Copy 1024x1024 marketing icon to appstore-submission/AppIcon-1024.png as well
  await fs.copyFile(
    path.join(appIconDir, 'AppIcon-512@2x.png'),
    path.join(submissionDir, 'AppIcon-1024.png')
  );

  // 2. Generate 2732x2732 iOS Splash screens (1x, 2x, 3x slots)
  const splashBuf = await renderOpaqueRgbPng(SPLASH_SVG, 2732, 2732, '#FAF9F5');
  const splashFiles = [
    'splash-2732x2732.png',
    'splash-2732x2732-1.png',
    'splash-2732x2732-2.png',
  ];
  for (const sf of splashFiles) {
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
  const pwa192 = await renderOpaqueRgbPng(MASTER_ICON_SVG, 192, 192, '#1E1B4B');
  const pwa512 = await renderOpaqueRgbPng(MASTER_ICON_SVG, 512, 512, '#1E1B4B');
  const appleTouch180 = await renderOpaqueRgbPng(
    MASTER_ICON_SVG,
    180,
    180,
    '#1E1B4B'
  );

  await fs.writeFile(path.join(publicDir, 'pwa-192x192.png'), pwa192);
  await fs.writeFile(path.join(publicDir, 'pwa-512x512.png'), pwa512);
  await fs.writeFile(path.join(publicDir, 'apple-touch-icon.png'), appleTouch180);
  await fs.writeFile(path.join(publicDir, 'favicon.svg'), MASTER_ICON_SVG, 'utf8');

  const meta1024 = await sharp(
    path.join(appIconDir, 'AppIcon-512@2x.png')
  ).metadata();
  console.log(
    `[Icons & Splash] 18 iOS ikon boyutu + 2732x2732 Splash + PWA ikonları üretildi. ` +
      `1024x1024 doğrulaması: ${meta1024.width}x${meta1024.height}, channels=${meta1024.channels}, hasAlpha=${meta1024.hasAlpha}`
  );
}

main().catch((err) => {
  console.error('[Icons & Splash] HATA:', err);
  process.exit(1);
});
