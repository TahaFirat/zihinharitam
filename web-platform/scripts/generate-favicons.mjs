import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const SRC =
  process.argv[2] ||
  'C:/Users/Taha/.gemini/antigravity/brain/4c2fe0e4-e4ed-40d0-8309-eea1f356facd/.user_uploaded/media_1795682921677_29053638.jpg';
const OUT_DIR = path.resolve('web-platform/public');

fs.mkdirSync(OUT_DIR, { recursive: true });

async function roundedPng(size, radiusRatio) {
  const r = Math.round(size * radiusRatio);
  const mask = Buffer.from(
    `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg"><rect width="${size}" height="${size}" rx="${r}" ry="${r}" fill="#ffffff"/></svg>`
  );
  return sharp(SRC)
    .resize(size, size, { fit: 'cover', kernel: sharp.kernel.lanczos3 })
    .ensureAlpha()
    .composite([{ input: mask, blend: 'dest-in' }])
    .png({ compressionLevel: 9 })
    .toBuffer();
}

async function main() {
  const fav32 = await roundedPng(32, 0.22);
  const fav64 = await roundedPng(64, 0.22);
  const fav192 = await roundedPng(192, 0.22);
  const fav512 = await roundedPng(512, 0.22);
  const apple180 = await sharp(SRC)
    .resize(180, 180, { fit: 'cover', kernel: sharp.kernel.lanczos3 })
    .removeAlpha()
    .png({ compressionLevel: 9 })
    .toBuffer();
  const app256 = await sharp(SRC)
    .resize(256, 256, { fit: 'cover', kernel: sharp.kernel.lanczos3 })
    .removeAlpha()
    .png({ compressionLevel: 9 })
    .toBuffer();

  fs.writeFileSync(path.join(OUT_DIR, 'favicon-32x32.png'), fav32);
  fs.writeFileSync(path.join(OUT_DIR, 'favicon-64x64.png'), fav64);
  fs.writeFileSync(path.join(OUT_DIR, 'favicon-192x192.png'), fav192);
  fs.writeFileSync(path.join(OUT_DIR, 'favicon-512x512.png'), fav512);
  fs.writeFileSync(path.join(OUT_DIR, 'apple-touch-icon.png'), apple180);
  fs.writeFileSync(path.join(OUT_DIR, 'app-icon.png'), app256);

  // Multi-size PNG-embedded ICO (32x32 + 64x64)
  const imgs = [
    { size: 32, buf: fav32 },
    { size: 64, buf: fav64 },
  ];
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(imgs.length, 4);

  const entries = [];
  let offset = 6 + imgs.length * 16;
  for (const img of imgs) {
    const e = Buffer.alloc(16);
    e.writeUInt8(img.size >= 256 ? 0 : img.size, 0);
    e.writeUInt8(img.size >= 256 ? 0 : img.size, 1);
    e.writeUInt8(0, 2);
    e.writeUInt8(0, 3);
    e.writeUInt16LE(1, 4);
    e.writeUInt16LE(32, 6);
    e.writeUInt32LE(img.buf.length, 8);
    e.writeUInt32LE(offset, 12);
    entries.push(e);
    offset += img.buf.length;
  }

  fs.writeFileSync(
    path.join(OUT_DIR, 'favicon.ico'),
    Buffer.concat([header, ...entries, ...imgs.map((i) => i.buf)])
  );
  console.log('FAVICONS_GENERATED_OK:', fs.readdirSync(OUT_DIR).join(', '));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
