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
    bgHex: '#0F172A',
    posterTheme: {
      grad: 'linear-gradient(155deg, #0B192C 0%, #0F3460 48%, #0284C7 100%)',
      glowA: 'rgba(56, 189, 248, 0.42)',
      glowB: 'rgba(244, 63, 94, 0.28)',
      badge: '🧠 GÖRSEL ZİHİN HARİTASI & DERS NOTU',
      badgeBg: 'rgba(56, 189, 248, 0.2)',
      badgeBorder: 'rgba(125, 211, 252, 0.45)',
      headline: 'Karmaşık Konuları Tek Bakışta Görselleştir',
      subline: 'Organik dallar, uzun açıklamalar, görev kutuları ve çapraz bağlantılar bir arada.',
      chips: ['✨ Karışmayan Akıllı Ağaç', '📝 Uzun Alt Açıklama', '🔗 Çapraz Bağlantı'],
    },
    prepare: async (page, device) => {
      await page.waitForSelector('canvas', { timeout: 10000 });
      await page.waitForTimeout(450);
      // Enrich one main branch with a crisp study note + task check + priority badge so V5 capabilities shine!
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
        await page.mouse.wheel(0, -250);
        await page.waitForTimeout(300);
      }
    },
  },
  {
    filename: '02-anlik-cikartma-seridi.png',
    query: '?view=canvas&tpl=tpl_tip_kardiyoloji&edit=m1&no_onboard=1',
    bgHex: '#1E1B4B',
    posterTheme: {
      grad: 'linear-gradient(155deg, #1E1B4B 0%, #4C1D95 52%, #9333EA 100%)',
      glowA: 'rgba(192, 132, 252, 0.44)',
      glowB: 'rgba(16, 185, 129, 0.30)',
      badge: '⚡ 43.000+ İKON • SERBEST ÇİZİM • 120 FPS',
      badgeBg: 'rgba(16, 185, 129, 0.24)',
      badgeBorder: 'rgba(110, 231, 183, 0.5)',
      headline: 'Yazarken Anında İkon & Harita Üzerine Çizim',
      subline: 'Akıllı Türkçe ikon algılama, S/M/L/XL boyut, 3D tasarım ve Apple Pencil çizimi.',
      chips: ['🎯 Akıllı İkon Eşleştirme', '✏️ Serbest Çizim', '📐 S / M / L / XL'],
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
    query: '?view=canvas&tpl=tpl_sistem_tasarimi&dark=1&exam=hide_text&no_onboard=1',
    bgHex: '#090D16',
    posterTheme: {
      grad: 'linear-gradient(155deg, #090D16 0%, #1E293B 50%, #312E81 100%)',
      glowA: 'rgba(139, 92, 246, 0.42)',
      glowB: 'rgba(245, 158, 11, 0.28)',
      badge: '🎓 AKTİF HATIRLAMA & SINAV MODU',
      badgeBg: 'rgba(245, 158, 11, 0.22)',
      badgeBorder: 'rgba(252, 211, 77, 0.5)',
      headline: 'Başlıkları Gizle, Kendini Sınavdan Önce Test Et',
      subline: 'Görsele bakıp kavramı hatırla, dokunarak aç ve çalışma sayacıyla süreni takip et.',
      chips: ['🌙 Karanlık Çalışma Modu', '⏱️ Kronometre & Sıfırla', '🧠 Kalıcı Hafıza'],
    },
    prepare: async (page, device) => {
      await page.waitForSelector('canvas', { timeout: 10000 });
      await page.click('[data-testid="hud-tab-study"]');
      await page.waitForSelector('[data-testid="hud-timer-toggle-btn"]', { timeout: 6000 });
      await page.click('[data-testid="hud-timer-toggle-btn"]');
      await page.waitForTimeout(450);
      if (device?.isMobile) {
        const cx = Math.round(device.viewport.width / 2);
        const cy = Math.round(device.viewport.height / 2);
        await page.mouse.move(cx, cy);
        await page.mouse.wheel(0, -320);
        await page.waitForTimeout(300);
      }
    },
  },
  {
    filename: '04-haritalarim-sablonlar.png',
    query: '?no_onboard=1',
    bgHex: '#064E3B',
    posterTheme: {
      grad: 'linear-gradient(155deg, #042F2E 0%, #065F46 52%, #0D9488 100%)',
      glowA: 'rgba(52, 211, 153, 0.4)',
      glowB: 'rgba(56, 189, 248, 0.28)',
      badge: '⚡ HAZIR AKADEMİK ŞABLONLAR & METİNDEN HARİTA',
      badgeBg: 'rgba(52, 211, 153, 0.22)',
      badgeBorder: 'rgba(110, 231, 183, 0.48)',
      headline: 'Tıp, Yazılım, Hukuk ve Mühendislik İçin Hazır',
      subline: 'Ders notunu yapıştırıp saniyeler içinde otomatik zihin haritasına dönüştür.',
      chips: ['📚 8 Branş Şablonu', '🪄 Metinden Otomatik Harita', '📴 %100 Çevrimdışı'],
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
    bgHex: '#1E293B',
    posterTheme: {
      grad: 'linear-gradient(155deg, #172554 0%, #3730A3 50%, #7C3AED 100%)',
      glowA: 'rgba(129, 140, 248, 0.42)',
      glowB: 'rgba(251, 191, 36, 0.30)',
      badge: '📋 HİYERARŞİK ANAHAT & PDF POSTER ÇIKTISI',
      badgeBg: 'rgba(129, 140, 248, 0.24)',
      badgeBorder: 'rgba(199, 210, 254, 0.5)',
      headline: 'Hem Görsel Harita Hem Düzenli Liste Görünümü',
      subline: 'Tek dokunuşla Anahat moduna geç, tüm ağacı düzenle ve 300 DPI A4/A3 PDF paylaş.',
      chips: ['📋 Hiyerarşik Anahat', '☑️ Görev İlerlemesi', '🖨️ 300 DPI PDF & PNG'],
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

  const topPad = isTablet ? Math.round(pxH * 0.034) : Math.round(pxH * 0.038);
  const sidePad = isTablet ? Math.round(pxW * 0.052) : Math.round(pxW * 0.056);
  const frameRadius = isTablet ? Math.round(44 * scaleRef) : Math.round(84 * scaleRef);
  const screenRadius = isTablet ? Math.round(32 * scaleRef) : Math.round(70 * scaleRef);
  const bezelThickness = isTablet ? Math.round(14 * scaleRef) : Math.round(15 * scaleRef);
  const statusBg = isDarkApp ? '#0F141D' : '#FAF9F5';
  const statusFg = isDarkApp ? '#F8FAFC' : '#0F172A';

  const statusBarMarkup =
    bezelType === 'iphone'
      ? `<div style="height:${s(68)};width:100%;background:${statusBg};color:${statusFg};display:flex;align-items:center;justify-content:space-between;padding:0 ${s(
          46
        )};font-size:${s(23)};font-weight:800;flex-shrink:0;position:relative;">
          <span>09:41</span>
          <div style="width:${s(188)};height:${s(44)};border-radius:999px;background:#05070B;"></div>
          <span style="font-size:${s(20)};letter-spacing:2px;">5G ▮▮▮</span>
        </div>`
      : bezelType === 'android'
      ? `<div style="height:${s(50)};width:100%;background:${statusBg};color:${statusFg};display:flex;align-items:center;justify-content:space-between;padding:0 ${s(
          36
        )};font-size:${s(20)};font-weight:700;flex-shrink:0;">
          <span>09:41</span>
          <div style="width:${s(22)};height:${s(22)};border-radius:999px;background:#05070B;"></div>
          <span>5G 100%</span>
        </div>`
      : `<div style="height:${s(40)};width:100%;background:${statusBg};color:${statusFg};display:flex;align-items:center;justify-content:space-between;padding:0 ${s(
          32
        )};font-size:${s(18)};font-weight:700;flex-shrink:0;">
          <span>09:41 Çar 21 Kas</span>
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
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
    background: ${theme.grad};
    color: #FFFFFF;
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
  }
  .glow-a {
    position: absolute;
    top: -8%;
    left: -12%;
    width: 68%;
    height: 42%;
    border-radius: 50%;
    background: radial-gradient(circle, ${theme.glowA} 0%, transparent 70%);
    pointer-events: none;
  }
  .glow-b {
    position: absolute;
    bottom: 6%;
    right: -14%;
    width: 72%;
    height: 46%;
    border-radius: 50%;
    background: radial-gradient(circle, ${theme.glowB} 0%, transparent 70%);
    pointer-events: none;
  }
  .header {
    position: relative;
    z-index: 5;
    width: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    margin-bottom: ${isTablet ? s(34) : s(38)};
  }
  .badge {
    display: inline-flex;
    align-items: center;
    padding: ${s(10)} ${s(26)};
    border-radius: 999px;
    background: ${theme.badgeBg};
    border: 2px solid ${theme.badgeBorder};
    font-size: ${isTablet ? s(24) : s(26)};
    font-weight: 800;
    letter-spacing: 0.04em;
    color: #F8FAFC;
    margin-bottom: ${s(20)};
    box-shadow: 0 8px 24px rgba(0,0,0,0.18);
  }
  .headline {
    font-size: ${isTablet ? s(68) : s(70)};
    line-height: 1.09;
    font-weight: 900;
    letter-spacing: -0.025em;
    color: #FFFFFF;
    text-shadow: 0 6px 24px rgba(0, 0, 0, 0.28);
    max-width: 96%;
  }
  .subline {
    margin-top: ${s(16)};
    font-size: ${isTablet ? s(30) : s(31)};
    line-height: 1.34;
    font-weight: 600;
    color: rgba(241, 245, 249, 0.9);
    max-width: 92%;
  }
  .chips {
    margin-top: ${s(22)};
    display: flex;
    flex-wrap: nowrap;
    justify-content: center;
    gap: ${s(14)};
  }
  .chip {
    padding: ${s(9)} ${s(20)};
    border-radius: ${s(18)};
    background: rgba(255, 255, 255, 0.13);
    border: 1.5px solid rgba(255, 255, 255, 0.24);
    font-size: ${isTablet ? s(22) : s(23)};
    font-weight: 800;
    color: #FFFFFF;
    white-space: nowrap;
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
    background: linear-gradient(180deg, #334155 0%, #0F172A 35%, #090D16 100%);
    border-radius: ${frameRadius}px ${frameRadius}px 0 0;
    padding: ${bezelThickness}px ${bezelThickness}px 0 ${bezelThickness}px;
    box-shadow:
      0 -4px 0 2px rgba(255,255,255,0.22),
      0 34px 90px rgba(0, 0, 0, 0.62),
      0 10px 30px rgba(0, 0, 0, 0.4);
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
    <div class="glow-a"></div>
    <div class="glow-b"></div>
    <div class="header">
      <div class="badge">${theme.badge}</div>
      <h1 class="headline">${theme.headline}</h1>
      <p class="subline">${theme.subline}</p>
      <div class="chips">
        ${theme.chips.map((c) => `<span class="chip">${c}</span>`).join('')}
      </div>
    </div>
    <div class="device-wrap">
      <div class="device-bezel">
        <div class="screen">
          ${statusBarMarkup}
          <img src="${appShotDataUrl}" alt="App Preview" />
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
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    background: linear-gradient(135deg, #091326 0%, #0F3460 48%, #4F46E5 100%);
    color: #FFFFFF;
  }
  .wrap {
    position: relative;
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 42px 52px;
  }
  .glow {
    position: absolute;
    top: -120px;
    left: 220px;
    width: 520px;
    height: 520px;
    border-radius: 50%;
    background: radial-gradient(circle, rgba(56,189,248,0.35) 0%, transparent 70%);
  }
  .left {
    position: relative;
    z-index: 2;
    max-width: 560px;
  }
  .brand {
    display: flex;
    align-items: center;
    gap: 16px;
    margin-bottom: 18px;
  }
  .brand img {
    width: 78px;
    height: 78px;
    border-radius: 20px;
    box-shadow: 0 12px 28px rgba(0,0,0,0.4);
    border: 2px solid rgba(255,255,255,0.3);
  }
  .tag {
    display: inline-block;
    padding: 5px 14px;
    border-radius: 999px;
    background: rgba(16,185,129,0.25);
    border: 1.5px solid rgba(110,231,183,0.55);
    font-size: 13px;
    font-weight: 800;
    color: #A7F3D0;
    margin-bottom: 6px;
  }
  .app-name {
    font-size: 26px;
    font-weight: 900;
    letter-spacing: -0.02em;
  }
  h1 {
    font-size: 40px;
    line-height: 1.12;
    font-weight: 900;
    letter-spacing: -0.025em;
    margin-bottom: 14px;
  }
  p {
    font-size: 18px;
    line-height: 1.4;
    color: rgba(241,245,249,0.9);
    font-weight: 600;
    margin-bottom: 20px;
  }
  .pills {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
  }
  .pill {
    padding: 7px 14px;
    border-radius: 12px;
    background: rgba(255,255,255,0.14);
    border: 1px solid rgba(255,255,255,0.26);
    font-size: 13.5px;
    font-weight: 800;
  }
  .right {
    position: relative;
    z-index: 2;
    width: 340px;
    height: 430px;
    transform: rotate(-3deg) translateY(18px);
    border-radius: 28px;
    padding: 10px;
    background: linear-gradient(180deg, #334155, #0F172A);
    box-shadow: 0 24px 60px rgba(0,0,0,0.55), 0 0 0 2px rgba(255,255,255,0.22);
  }
  .right img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    object-position: center;
    border-radius: 20px;
    display: block;
  }
</style>
</head>
<body>
  <div class="wrap">
    <div class="glow"></div>
    <div class="left">
      <div class="brand">
        <img src="${iconDataUrl}" alt="ZihinHaritam" />
        <div>
          <div class="tag">TÜRKİYE'NİN GÖRSEL DÜŞÜNME ARACI</div>
          <div class="app-name">ZihinHaritam</div>
        </div>
      </div>
      <h1>Zihin Haritası, Görsel Not & Sınav Asistanı</h1>
      <p>25.000+ İkon • Uzun Ders Açıklamaları • Galeriden Foto • 300 DPI PDF Poster</p>
      <div class="pills">
        <span class="pill">🎁 Ücretsiz İkonlar</span>
        <span class="pill">📝 Uzun Dal Notları</span>
        <span class="pill">🎓 Sınav Modu</span>
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
      .flatten({ background: '#0F172A' })
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
      .flatten({ background: '#091326' })
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
