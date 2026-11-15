#!/usr/bin/env node
import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const DEVICE_TARGETS = [
  {
    slug: 'iphone-6.9',
    label: 'iPhone 6.9" (1320x2868)',
    viewport: { width: 440, height: 956 },
    deviceScaleFactor: 3,
    pxW: 1320,
    pxH: 2868,
    isMobile: true,
  },
  {
    slug: 'iphone-6.5',
    label: 'iPhone 6.5" (1284x2778)',
    viewport: { width: 428, height: 926 },
    deviceScaleFactor: 3,
    pxW: 1284,
    pxH: 2778,
    isMobile: true,
  },
  {
    slug: 'ipad-13',
    label: 'iPad Pro 13" (2064x2752)',
    viewport: { width: 1032, height: 1376 },
    deviceScaleFactor: 2,
    pxW: 2064,
    pxH: 2752,
    isMobile: false,
  },
];

const SCENES = [
  {
    filename: '01-kardiyoloji-harita.png',
    query: '?view=canvas&tpl=tpl_tip_kardiyoloji&no_onboard=1',
    bgHex: '#FAF9F5',
    prepare: async (page, device) => {
      await page.waitForSelector('canvas', { timeout: 10000 });
      await page.waitForTimeout(550);
      if (device?.isMobile) {
        const cx = Math.round(device.viewport.width / 2);
        const cy = Math.round(device.viewport.height / 2);
        await page.mouse.move(cx, cy);
        await page.mouse.wheel(0, -290);
        await page.waitForTimeout(350);
      }
    },
  },
  {
    filename: '02-anlik-cikartma-seridi.png',
    query: '?view=canvas&tpl=tpl_tip_kardiyoloji&edit=m1&no_onboard=1',
    bgHex: '#FAF9F5',
    prepare: async (page) => {
      await page.waitForSelector('canvas', { timeout: 10000 });
      await page.waitForTimeout(900);
    },
  },
  {
    filename: '03-sistem-mimarisi-koyu.png',
    query: '?view=canvas&tpl=tpl_sistem_tasarimi&dark=1&exam=hide_text&no_onboard=1',
    bgHex: '#0F141D',
    prepare: async (page, device) => {
      await page.waitForSelector('canvas', { timeout: 10000 });
      await page.waitForTimeout(550);
      if (device?.isMobile) {
        const cx = Math.round(device.viewport.width / 2);
        const cy = Math.round(device.viewport.height / 2);
        await page.mouse.move(cx, cy);
        await page.mouse.wheel(0, -340);
        await page.waitForTimeout(350);
      }
    },
  },
  {
    filename: '04-haritalarim-sablonlar.png',
    query: '?no_onboard=1',
    bgHex: '#FAF9F5',
    prepare: async (page) => {
      await page.waitForSelector('[data-testid="create-blank-map-btn"]', {
        timeout: 10000,
      });
      // Seed 2 additional showcase templates into the 3 free slots so library looks rich
      const cardsCount = await page
        .locator('[data-testid^="workspace-map-card-"]')
        .count();
      if (cardsCount < 3) {
        await page.click('[data-testid="template-card-tpl_tip_kardiyoloji"]');
        await page.waitForSelector('[data-testid="hud-back-home-btn"]', {
          timeout: 8000,
        });
        await page.click('[data-testid="hud-back-home-btn"]');
        await page.waitForSelector('[data-testid="template-card-tpl_hukuk_istinaf"]', {
          timeout: 8000,
        });
        await page.click('[data-testid="template-card-tpl_hukuk_istinaf"]');
        await page.waitForSelector('[data-testid="hud-back-home-btn"]', {
          timeout: 8000,
        });
        await page.click('[data-testid="hud-back-home-btn"]');
      }
      await page.waitForTimeout(450);
    },
  },
  {
    filename: '05-paywall-pro.png',
    query: '?view=canvas&tpl=tpl_tip_kardiyoloji&edit=m1&no_onboard=1',
    bgHex: '#FAF9F5',
    prepare: async (page) => {
      await page.waitForSelector('canvas', { timeout: 10000 });
      const proStickerBtn = page.locator('button:has-text("PRO")').first();
      await proStickerBtn.waitFor({ state: 'visible', timeout: 8000 });
      await proStickerBtn.click();
      await page.waitForSelector('[data-testid="lifetime-paywall-modal"]', {
        timeout: 10000,
      });
      await page.waitForTimeout(550);
    },
  },
];

async function waitForHttpReady(url, timeoutMs = 20000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {
      // Server still booting
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`Önizleme sunucusu zaman aşımına uğradı: ${url}`);
}

function startLocalPreviewServer(port) {
  const viteBin = path.join(ROOT, 'node_modules', 'vite', 'bin', 'vite.js');
  return spawn(
    process.execPath,
    [viteBin, 'preview', '--port', String(port), '--strictPort', '--host', '127.0.0.1'],
    {
      cwd: ROOT,
      stdio: 'ignore',
    }
  );
}

async function main() {
  // Ensure dist/ exists
  try {
    await fs.access(path.join(ROOT, 'dist', 'index.html'));
  } catch {
    throw new Error(
      'dist/index.html bulunamadı. Önce `npm run build` komutunu çalıştırın.'
    );
  }

  const port = 4178;
  const baseUrl = process.env.APP_SCREENSHOT_URL || `http://127.0.0.1:${port}`;
  let serverProc = null;

  if (!process.env.APP_SCREENSHOT_URL) {
    serverProc = startLocalPreviewServer(port);
    await waitForHttpReady(baseUrl);
  }

  const browser = await chromium.launch({ headless: true });

  try {
    for (const device of DEVICE_TARGETS) {
      const outDir = path.join(
        ROOT,
        'appstore-submission',
        'screenshots',
        device.slug
      );
      await fs.mkdir(outDir, { recursive: true });

      const context = await browser.newContext({
        viewport: device.viewport,
        deviceScaleFactor: device.deviceScaleFactor,
        isMobile: device.isMobile,
        hasTouch: true,
        locale: 'tr-TR',
      });

      const page = await context.newPage();

      for (const scene of SCENES) {
        await page.goto(`${baseUrl}/${scene.query}`, {
          waitUntil: 'domcontentloaded',
        });
        await scene.prepare(page, device);

        const rawShot = await page.screenshot({
          type: 'png',
          fullPage: false,
        });

        const opaqueRgbShot = await sharp(rawShot)
          .resize(device.pxW, device.pxH, { fit: 'cover' })
          .flatten({ background: scene.bgHex })
          .removeAlpha()
          .png({ compressionLevel: 9, palette: false })
          .toBuffer();

        if (opaqueRgbShot[25] !== 2) {
          throw new Error(
            `Alfa kanalı hatası (${device.slug}/${scene.filename}): colorType=${opaqueRgbShot[25]}`
          );
        }

        const outPath = path.join(outDir, scene.filename);
        await fs.writeFile(outPath, opaqueRgbShot);
        console.log(
          `[Screenshot] ✓ ${device.label} -> ${device.slug}/${scene.filename}`
        );
      }

      await context.close();
    }

    console.log(
      '\n[App Store Screenshots] 15/15 yüksek çözünürlüklü 24-bit RGB mağaza görseli üretildi!'
    );
  } finally {
    await browser.close();
    if (serverProc) {
      serverProc.kill();
    }
  }
}

main().catch((err) => {
  console.error('[App Store Screenshots] HATA:', err);
  process.exit(1);
});
