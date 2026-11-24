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
    store: 'appstore',
    outSubdir: ['appstore-submission', 'screenshots', 'iphone-6.9'],
    label: 'iPhone 6.9" (1320x2868)',
    viewport: { width: 430, height: 932 },
    deviceScaleFactor: 3,
    pxW: 1320,
    pxH: 2868,
    isMobile: true,
    bezelType: 'iphone',
  },
  {
    slug: 'iphone-6.5',
    store: 'appstore',
    outSubdir: ['appstore-submission', 'screenshots', 'iphone-6.5'],
    label: 'iPhone 6.5" (1284x2778)',
    viewport: { width: 428, height: 926 },
    deviceScaleFactor: 3,
    pxW: 1284,
    pxH: 2778,
    isMobile: true,
    bezelType: 'iphone',
  },
  {
    slug: 'ipad-13',
    store: 'appstore',
    outSubdir: ['appstore-submission', 'screenshots', 'ipad-13'],
    label: 'iPad Pro 13" (2064x2752)',
    viewport: { width: 1032, height: 1376 },
    deviceScaleFactor: 2,
    pxW: 2064,
    pxH: 2752,
    isMobile: false,
    bezelType: 'ipad',
  },
  {
    slug: 'play-phone',
    store: 'playstore',
    outSubdir: ['playstore-submission', 'screenshots', 'phone'],
    label: 'Google Play Phone (1080x1920)',
    viewport: { width: 412, height: 892 },
    deviceScaleFactor: 2.625,
    pxW: 1080,
    pxH: 1920,
    isMobile: true,
    bezelType: 'android',
  },
  {
    slug: 'play-tablet-10',
    store: 'playstore',
    outSubdir: ['playstore-submission', 'screenshots', 'tablet-10'],
    label: 'Google Play 10" Tablet (1600x2560)',
    viewport: { width: 800, height: 1280 },
    deviceScaleFactor: 2,
    pxW: 1600,
    pxH: 2560,
    isMobile: false,
    bezelType: 'ipad',
  },
];

const SCENES = [
  {
    filename: '01-kardiyoloji-harita.png',
    query: '?view=canvas&tpl=tpl_tip_kardiyoloji&no_onboard=1',
    bgHex: '#8BD4FF',
    posterTheme: {
      bg: '#8BD4FF',
      ink: '#0B1220',
      line1: 'Fikirleri Görsel',
      line2: 'Haritaya Dönüştür',
    },
    prepare: async (page, device) => {
      await page.waitForSelector('canvas', { timeout: 10000 });
      await page.waitForTimeout(450);
      await page.click('[data-node-card-id="m1"]');
      await page.waitForSelector('[data-testid="studio-note-toggle-btn"]', { timeout: 6000 });
      await page.click('[data-testid="studio-note-toggle-btn"]');
      await page.fill(
        '[data-testid="studio-note-textarea"]',
        'Sol ventrikül sistolik fonksiyonu ve kapak akımlarının detaylı ekokardiyografik incelemesi.'
      );
      await page.click('[data-testid="studio-task-toggle-btn"]');
      await page.click('[data-testid="studio-priority-btn"]');
      await page.click('[data-testid="dock-tab-style"]');
      await page.click('[data-testid="size-btn-lg"]');
      await page.click('[data-testid="studio-done-btn"]');
      await page.waitForTimeout(400);
      if (device?.isMobile) {
        const cx = Math.round(device.viewport.width / 2);
        const cy = Math.round(device.viewport.height / 2);
        await page.mouse.move(cx, cy);
        await page.mouse.wheel(0, -240);
        await page.waitForTimeout(300);
      }
    },
  },
  {
    filename: '02-anlik-cikartma-seridi.png',
    query: '?view=canvas&tpl=tpl_tip_kardiyoloji&edit=m1&no_onboard=1',
    bgHex: '#F9B4C6',
    posterTheme: {
      bg: '#F9B4C6',
      ink: '#0B1220',
      line1: '43.000+ İkon &',
      line2: 'Akıllı Kalem',
    },
    prepare: async (page) => {
      await page.waitForSelector('canvas', { timeout: 10000 });
      await page.waitForSelector('[data-testid="bar-tier-free-btn"]', { timeout: 8000 });
      await page.click('[data-testid="bar-tier-free-btn"]');
      await page.waitForTimeout(650);
    },
  },
  {
    filename: '03-sistem-mimarisi-koyu.png',
    query: '?no_onboard=1',
    bgHex: '#FFA954',
    posterTheme: {
      bg: '#FFA954',
      ink: '#0B1220',
      line1: 'Akış Diyagramı',
      line2: 'Stüdyosu',
    },
    prepare: async (page) => {
      await page.waitForSelector('[data-testid="flowchart-template-flow_auth_2fa"]', { timeout: 10000 });
      await page.click('[data-testid="flowchart-template-flow_auth_2fa"]');
      await page.waitForSelector('[data-testid="flowchart-workspace"]', { timeout: 8000 });
      await page.waitForTimeout(550);
    },
  },
  {
    filename: '04-haritalarim-sablonlar.png',
    query: '?no_onboard=1',
    bgHex: '#92ECC7',
    posterTheme: {
      bg: '#92ECC7',
      ink: '#0B1220',
      line1: 'Hazır Şablonlar &',
      line2: 'Çevrimdışı Not',
    },
    prepare: async (page) => {
      await page.waitForSelector('[data-testid="create-blank-map-btn"]', {
        timeout: 10000,
      });
      const cardsCount = await page
        .locator('[data-testid^="workspace-map-card-"]')
        .count();
      if (cardsCount < 2) {
        await page.click('[data-testid="template-card-tpl_tip_kardiyoloji"]');
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
    query: '?view=canvas&tpl=tpl_sistem_tasarimi&no_onboard=1',
    bgHex: '#C8B6FF',
    posterTheme: {
      bg: '#C8B6FF',
      ink: '#0B1220',
      line1: 'Anahat Modu &',
      line2: '300 DPI PDF',
    },
    prepare: async (page) => {
      await page.waitForSelector('canvas', { timeout: 10000 });
      await page.waitForTimeout(400);
      await page.click('[data-testid="hud-tab-study"]');
      await page.waitForSelector('[data-testid="hud-outline-btn"]', { timeout: 6000 });
      await page.click('[data-testid="hud-outline-btn"]');
      await page.waitForSelector('[data-testid="outline-modal"]', { timeout: 6000 });
      await page.waitForTimeout(450);
    },
  },
];

function buildPosterHtml({ pxW, pxH, bezelType, theme, appShotDataUrl, isDarkApp }) {
  const isTablet = bezelType === 'ipad';
  const scaleRef = isTablet ? pxW / 2064 : pxW / 1320;
  const s = (val) => `${Math.round(val * scaleRef)}px`;

  // Ultra-clean High-Conversion App Store Search 3-Up Aesthetic:
  // Solid vibrant pastel canvas + bold 2-line dark-ink typography + sleek bottom-bleeding device frame!
  const topPad = isTablet ? Math.round(pxH * 0.046) : Math.round(pxH * 0.056);
  const sidePad = isTablet ? Math.round(pxW * 0.048) : Math.round(pxW * 0.052);
  const frameRadius = isTablet ? Math.round(52 * scaleRef) : Math.round(96 * scaleRef);
  const screenRadius = isTablet ? Math.round(36 * scaleRef) : Math.round(78 * scaleRef);
  const bezelThickness = isTablet ? Math.round(18 * scaleRef) : Math.round(20 * scaleRef);
  const statusBg = isDarkApp ? '#0F141D' : '#FAF9F5';
  const statusFg = isDarkApp ? '#F8FAFC' : '#0F172A';

  const statusBarMarkup =
    bezelType === 'iphone'
      ? `<div style="height:${s(70)};width:100%;background:${statusBg};color:${statusFg};display:flex;align-items:center;justify-content:space-between;padding:0 ${s(
          48
        )};font-size:${s(25)};font-weight:800;flex-shrink:0;position:relative;">
          <span>09:41</span>
          <div style="width:${s(196)};height:${s(46)};border-radius:999px;background:#05070B;"></div>
          <span style="font-size:${s(21)};letter-spacing:2px;">5G ▮▮▮</span>
        </div>`
      : bezelType === 'android'
      ? `<div style="height:${s(52)};width:100%;background:${statusBg};color:${statusFg};display:flex;align-items:center;justify-content:space-between;padding:0 ${s(
          38
        )};font-size:${s(21)};font-weight:700;flex-shrink:0;">
          <span>09:41</span>
          <div style="width:${s(24)};height:${s(24)};border-radius:999px;background:#05070B;"></div>
          <span>5G 100%</span>
        </div>`
      : `<div style="height:${s(44)};width:100%;background:${statusBg};color:${statusFg};display:flex;align-items:center;justify-content:space-between;padding:0 ${s(
          36
        )};font-size:${s(20)};font-weight:700;flex-shrink:0;">
          <span>09:41</span>
          <span>Wi-Fi • %100</span>
        </div>`;

  return `<!doctype html>
<html lang="tr">
<head>
<meta charset="utf-8" />
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body {
    width: ${pxW}px;
    height: ${pxH}px;
    overflow: hidden;
    font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
    background: ${theme.bg};
    color: ${theme.ink};
    -webkit-font-smoothing: antialiased;
  }
  .canvas {
    position: relative;
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: ${topPad}px ${sidePad}px 0 ${sidePad}px;
    background: linear-gradient(180deg, ${theme.bg} 0%, ${theme.bg} 100%);
  }
  .header {
    position: relative;
    z-index: 5;
    width: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    margin-bottom: ${isTablet ? s(54) : s(64)};
  }
  .headline {
    font-size: ${isTablet ? s(106) : s(104)};
    line-height: 1.08;
    font-weight: 850;
    letter-spacing: -0.035em;
    color: ${theme.ink};
    max-width: 98%;
  }
  .device-wrap {
    position: relative;
    z-index: 5;
    flex: 1;
    width: ${isTablet ? '94%' : '93%'};
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: flex-end;
  }
  .device-bezel {
    position: relative;
    width: 100%;
    height: 100%;
    background: linear-gradient(180deg, #1E2430 0%, #0A0D14 35%, #05070B 100%);
    border-radius: ${frameRadius}px ${frameRadius}px 0 0;
    padding: ${bezelThickness}px ${bezelThickness}px 0 ${bezelThickness}px;
    box-shadow:
      0 -3px 0 2px rgba(255, 255, 255, 0.35),
      0 32px 84px rgba(11, 18, 32, 0.28),
      0 10px 26px rgba(11, 18, 32, 0.16);
  }
  .screen {
    position: relative;
    width: 100%;
    height: 100%;
    border-radius: ${screenRadius}px ${screenRadius}px 0 0;
    overflow: hidden;
    background: ${statusBg};
    display: flex;
    flex-direction: column;
  }
  .screen img {
    width: 100%;
    flex: 1;
    min-height: 0;
    object-fit: cover;
    object-position: top center;
    display: block;
  }
</style>
</head>
<body>
  <div class="canvas">
    <div class="header">
      <h1 class="headline">${theme.line1}<br/>${theme.line2}</h1>
    </div>
    <div class="device-wrap">
      <div class="device-bezel">
        <div class="screen">
          ${statusBarMarkup}
          <img src="${appShotDataUrl}" alt="ZihinHaritam" />
        </div>
      </div>
    </div>
  </div>
</body>
</html>`;
}

function buildPlayFeatureGraphicHtml({ iconDataUrl, heroShotDataUrl }) {
  return `<!doctype html>
<html lang="tr">
<head>
<meta charset="utf-8" />
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body {
    width: 1024px;
    height: 500px;
    overflow: hidden;
    font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', Roboto, sans-serif;
    background: linear-gradient(135deg, #8BD4FF 0%, #BAE6FD 52%, #DDD6FE 100%);
    color: #0B1220;
  }
  .wrap {
    position: relative;
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 40px 54px;
  }
  .left {
    position: relative;
    z-index: 2;
    max-width: 540px;
  }
  .brand {
    display: flex;
    align-items: center;
    gap: 16px;
    margin-bottom: 20px;
  }
  .brand img {
    width: 82px;
    height: 82px;
    border-radius: 22px;
    box-shadow: 0 14px 32px rgba(15, 23, 42, 0.18);
    border: 2px solid rgba(255, 255, 255, 0.85);
  }
  .app-name {
    font-size: 28px;
    font-weight: 900;
    letter-spacing: -0.025em;
    color: #0B1220;
  }
  .sub-tag {
    font-size: 14px;
    font-weight: 800;
    color: #334155;
  }
  h1 {
    font-size: 46px;
    line-height: 1.08;
    font-weight: 900;
    letter-spacing: -0.035em;
    margin-bottom: 16px;
    color: #0B1220;
  }
  .pills {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
  }
  .pill {
    padding: 8px 15px;
    border-radius: 14px;
    background: rgba(255, 255, 255, 0.72);
    border: 1.5px solid rgba(15, 23, 42, 0.10);
    font-size: 14px;
    font-weight: 800;
    color: #0F172A;
  }
  .right {
    position: relative;
    z-index: 2;
    width: 344px;
    height: 446px;
    transform: translateY(28px);
    border-radius: 36px 36px 0 0;
    padding: 12px 12px 0 12px;
    background: #0A0D14;
    box-shadow: 0 24px 60px rgba(15, 23, 42, 0.28), 0 -2px 0 2px rgba(255,255,255,0.4);
  }
  .right img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    object-position: top center;
    border-radius: 26px 26px 0 0;
    display: block;
  }
</style>
</head>
<body>
  <div class="wrap">
    <div class="left">
      <div class="brand">
        <img src="${iconDataUrl}" alt="ZihinHaritam" />
        <div>
          <div class="app-name">ZihinHaritam</div>
          <div class="sub-tag">Görsel Zihin Haritası & Akıllı Not</div>
        </div>
      </div>
      <h1>Fikirleri Görsel<br/>Haritaya Dönüştür</h1>
      <div class="pills">
        <span class="pill">43.000+ İkon</span>
        <span class="pill">S-Pen & Pencil</span>
        <span class="pill">Sınav Modu</span>
      </div>
    </div>
    <div class="right">
      <img src="${heroShotDataUrl}" alt="ZihinHaritam Preview" />
    </div>
  </div>
</body>
</html>`;
}

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
  let firstTabletHeroDataUrl = null;

  try {
    for (const device of DEVICE_TARGETS) {
      const outDir = path.join(ROOT, ...device.outSubdir);
      await fs.mkdir(outDir, { recursive: true });

      const appContext = await browser.newContext({
        viewport: device.viewport,
        deviceScaleFactor: device.deviceScaleFactor,
        isMobile: device.isMobile,
        hasTouch: true,
        locale: 'tr-TR',
      });
      const appPage = await appContext.newPage();

      const posterContext = await browser.newContext({
        viewport: { width: device.pxW, height: device.pxH },
        deviceScaleFactor: 1,
        locale: 'tr-TR',
      });
      const posterPage = await posterContext.newPage();

      for (const scene of SCENES) {
        await appPage.goto(`${baseUrl}/${scene.query}`, {
          waitUntil: 'domcontentloaded',
        });
        const wantsDark = scene.query.includes('dark=1');
        await appPage.evaluate((dark) => {
          localStorage.setItem('zh_v4_theme_pref', dark ? 'dark' : 'light');
        }, wantsDark);
        if (!wantsDark) {
          await appPage.goto(`${baseUrl}/${scene.query}`, {
            waitUntil: 'domcontentloaded',
          });
        }
        await scene.prepare(appPage, device);

        const rawAppShot = await appPage.screenshot({
          type: 'png',
          fullPage: false,
        });
        const appShotDataUrl = `data:image/png;base64,${rawAppShot.toString('base64')}`;

        if (!firstTabletHeroDataUrl && !device.isMobile && scene.filename.startsWith('01-')) {
          firstTabletHeroDataUrl = appShotDataUrl;
        }

        const posterHtml = buildPosterHtml({
          pxW: device.pxW,
          pxH: device.pxH,
          bezelType: device.bezelType,
          theme: scene.posterTheme,
          appShotDataUrl,
          isDarkApp: scene.query.includes('dark=1'),
        });
        await posterPage.setContent(posterHtml, { waitUntil: 'load' });
        const rawPoster = await posterPage.screenshot({
          type: 'png',
          fullPage: false,
        });

        const opaqueRgbShot = await sharp(rawPoster)
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
          `[Store Poster] ✓ ${device.label} -> ${device.slug}/${scene.filename}`
        );
      }

      await posterContext.close();
      await appContext.close();
    }

    // Generate Google Play Store 512x512 Hi-Res Icon & 1024x500 Feature Graphic
    const playRoot = path.join(ROOT, 'playstore-submission');
    await fs.mkdir(playRoot, { recursive: true });

    const masterIconPath = path.join(ROOT, 'assets', 'app-icon-master.png');
    const icon512Buf = await sharp(masterIconPath)
      .resize(512, 512, { fit: 'cover' })
      .flatten({ background: '#ECEFF3' })
      .removeAlpha()
      .png({ compressionLevel: 9, palette: false })
      .toBuffer();
    await fs.writeFile(path.join(playRoot, 'icon-512x512.png'), icon512Buf);
    console.log('[Google Play] ✓ icon-512x512.png (512x512 24-bit RGB) üretildi!');

    const fgContext = await browser.newContext({
      viewport: { width: 1024, height: 500 },
      deviceScaleFactor: 1,
      locale: 'tr-TR',
    });
    const fgPage = await fgContext.newPage();
    const iconDataUrl = `data:image/png;base64,${icon512Buf.toString('base64')}`;
    await fgPage.setContent(
      buildPlayFeatureGraphicHtml({
        iconDataUrl,
        heroShotDataUrl: firstTabletHeroDataUrl || iconDataUrl,
      }),
      { waitUntil: 'load' }
    );
    const rawFg = await fgPage.screenshot({ type: 'png', fullPage: false });
    const opaqueFg = await sharp(rawFg)
      .resize(1024, 500, { fit: 'cover' })
      .flatten({ background: '#8BD4FF' })
      .removeAlpha()
      .png({ compressionLevel: 9, palette: false })
      .toBuffer();
    await fs.writeFile(
      path.join(playRoot, 'feature-graphic-1024x500.png'),
      opaqueFg
    );
    await fgContext.close();
    console.log(
      '[Google Play] ✓ feature-graphic-1024x500.png (1024x500 Özellik Grafiği) üretildi!'
    );

    console.log(
      '\n[Store Graphics] 15 App Store + 10 Google Play + 512px İkon + 1024x500 Özellik Grafiği başarıyla üretildi!'
    );
  } finally {
    await browser.close();
    if (serverProc) {
      serverProc.kill();
    }
  }
}

main().catch((err) => {
  console.error('[Store Screenshots] HATA:', err);
  process.exit(1);
});
