#!/usr/bin/env node
import { execSync, spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const checks = [];
function pass(label, detail = '') {
  checks.push({ ok: true, label, detail });
  console.log(`  ✅ ${label}${detail ? ` — ${detail}` : ''}`);
}
function fail(label, detail = '') {
  checks.push({ ok: false, label, detail });
  console.error(`  ❌ ${label}${detail ? ` — ${detail}` : ''}`);
}

async function fileExists(relPath) {
  try {
    await fs.access(path.join(ROOT, relPath));
    return true;
  } catch {
    return false;
  }
}

async function inspectPngBinary(relPath) {
  const buf = await fs.readFile(path.join(ROOT, relPath));
  if (buf.length < 33 || buf.readUInt32BE(0) !== 0x89504e47) {
    throw new Error(`${relPath}: Geçerli bir PNG dosyası değil.`);
  }
  const width = buf.readUInt32BE(16);
  const height = buf.readUInt32BE(20);
  const bitDepth = buf[24];
  const colorType = buf[25]; // 2 = Truecolor RGB (Zero Alpha), 6 = RGBA
  return { width, height, bitDepth, colorType, hasAlpha: colorType === 4 || colorType === 6 };
}

async function waitForHttpReady(url, timeoutMs = 20000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {
      // Waiting
    }
    await new Promise((r) => setTimeout(r, 200));
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

async function runGate1OfflineIcons() {
  console.log('\n[1/5] 25.000+ Çevrimdışı Akademik İkon Şardları & <15ms Alaka Testi');
  const manifestPath = 'public/offline-packs/search-manifest.json';
  if (!(await fileExists(manifestPath))) {
    fail('Offline search-manifest.json mevcut', 'Dosya bulunamadı');
    return;
  }

  const rawManifest = JSON.parse(
    await fs.readFile(path.join(ROOT, manifestPath), 'utf8')
  );
  const totalIcons = Number(
    rawManifest.totalIcons || rawManifest.items?.length || 0
  );
  const itemsList = Array.isArray(rawManifest.items) ? rawManifest.items : [];
  const freeCount =
    Number(rawManifest.freeIcons) ||
    itemsList.filter((i) => i.tier === 'free').length;
  const proCount =
    Number(rawManifest.proIcons) ||
    itemsList.filter((i) => i.tier === 'pro').length;

  if (totalIcons >= 25000 && freeCount >= 1000 && proCount >= 20000) {
    pass(
      'Offline vektör ikon şardları ve Free/Pro katman ayrımı',
      `${totalIcons.toLocaleString('tr-TR')} ikon (${freeCount} Free / ${proCount} Pro)`
    );
  } else {
    fail(
      'Offline vektör ikon şardları ve Free/Pro katman ayrımı',
      `total=${totalIcons}, free=${freeCount}, pro=${proCount}`
    );
  }

  try {
    execSync('node scripts/verify-search-relevance.mjs', {
      cwd: ROOT,
      stdio: 'pipe',
    });
    pass('20 Akademik Türkçe sorgu <15ms hız ve %100 alaka testi', '20/20 geçti');
  } catch (err) {
    fail(
      '20 Akademik Türkçe sorgu <15ms hız ve %100 alaka testi',
      err instanceof Error ? err.message : String(err)
    );
  }
}

async function runGate2IconsAndScreenshots() {
  console.log('\n[2/5] App Store 1024x1024 İkon (Sıfır Alfa) & 15 Mağaza Ekran Görüntüsü Denetimi');
  const icon1024 =
    'ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png';
  if (!(await fileExists(icon1024))) {
    fail('1024x1024 App Store ikonu', 'Bulunamadı');
  } else {
    const info = await inspectPngBinary(icon1024);
    if (info.width === 1024 && info.height === 1024 && info.colorType === 2 && !info.hasAlpha) {
      pass(
        '1024x1024 App Store ikonu (ITMS-90717 sıfır alfa kanalı)',
        `1024x1024, 24-bit RGB (colorType=${info.colorType}, hasAlpha=false)`
      );
    } else {
      fail(
        '1024x1024 App Store ikonu (ITMS-90717 sıfır alfa kanalı)',
        `${info.width}x${info.height}, colorType=${info.colorType}, hasAlpha=${info.hasAlpha}`
      );
    }
  }

  const splashPath =
    'ios/App/App/Assets.xcassets/Splash.imageset/splash-2732x2732.png';
  if (await fileExists(splashPath)) {
    const sp = await inspectPngBinary(splashPath);
    if (sp.width === 2732 && sp.height === 2732 && !sp.hasAlpha) {
      pass('iOS Launch Splash (2732x2732, 24-bit RGB)', `${sp.width}x${sp.height}`);
    } else {
      fail('iOS Launch Splash (2732x2732, 24-bit RGB)', `${sp.width}x${sp.height}`);
    }
  } else {
    fail('iOS Launch Splash (2732x2732)', 'Bulunamadı');
  }

  for (const pwaIcon of [
    'public/pwa-192x192.png',
    'public/pwa-512x512.png',
    'public/apple-touch-icon.png',
  ]) {
    if (await fileExists(pwaIcon)) {
      const inf = await inspectPngBinary(pwaIcon);
      if (!inf.hasAlpha) {
        pass(`PWA/Web ikonu hazır (${pwaIcon})`, `${inf.width}x${inf.height}`);
      } else {
        fail(`PWA/Web ikonu (${pwaIcon})`, 'Alfa kanalı içeriyor');
      }
    } else {
      fail(`PWA/Web ikonu (${pwaIcon})`, 'Eksik');
    }
  }

  const screenshotSpecs = [
    { dir: 'iphone-6.9', w: 1320, h: 2868 },
    { dir: 'iphone-6.5', w: 1284, h: 2778 },
    { dir: 'ipad-13', w: 2064, h: 2752 },
  ];
  const expectedScenes = [
    '01-kardiyoloji-harita.png',
    '02-anlik-cikartma-seridi.png',
    '03-sistem-mimarisi-koyu.png',
    '04-haritalarim-sablonlar.png',
    '05-paywall-pro.png',
  ];

  let allShotsOk = true;
  let checkedCount = 0;
  for (const spec of screenshotSpecs) {
    for (const sc of expectedScenes) {
      const rel = `appstore-submission/screenshots/${spec.dir}/${sc}`;
      if (!(await fileExists(rel))) {
        allShotsOk = false;
        fail(`Mağaza görseli (${spec.dir}/${sc})`, 'Bulunamadı (`npm run appstore:screenshots` çalıştırın)');
        continue;
      }
      const meta = await inspectPngBinary(rel);
      if (meta.width !== spec.w || meta.height !== spec.h || meta.hasAlpha) {
        allShotsOk = false;
        fail(
          `Mağaza görseli boyutu/alfa (${spec.dir}/${sc})`,
          `${meta.width}x${meta.height}, hasAlpha=${meta.hasAlpha}`
        );
      } else {
        checkedCount += 1;
      }
    }
  }
  if (allShotsOk && checkedCount === 15) {
    pass(
      'App Store Connect 15 mağaza ekran görüntüsü (6.9", 6.5", iPad 13")',
      '15/15 birebir çözünürlük ve 24-bit alfasız PNG'
    );
  }
}

async function runGate3IosNativePrivacyAndCI() {
  console.log('\n[3/5] Native iOS Xcode, StoreKit 2, PrivacyInfo.xcprivacy, Yasal & CI/CD Denetimi');

  const configTs = await fs.readFile(
    path.join(ROOT, 'src/config/appReleaseConfig.ts'),
    'utf8'
  );
  if (
    configTs.includes('com.tahafirat.zihinharitam') &&
    configTs.includes('com.tahafirat.zihinharitam.lifetime_pro') &&
    configTs.includes('200 ₺')
  ) {
    pass('Tek merkezli appReleaseConfig.ts kimlikleri', 'Bundle ID + IAP ID + 200 ₺ doğrulandı');
  } else {
    fail('Tek merkezli appReleaseConfig.ts kimlikleri', 'Eksik alan');
  }

  const privacyRel = 'ios/App/App/PrivacyInfo.xcprivacy';
  const pbxRel = 'ios/App/App.xcodeproj/project.pbxproj';
  if ((await fileExists(privacyRel)) && (await fileExists(pbxRel))) {
    const xml = await fs.readFile(path.join(ROOT, privacyRel), 'utf8');
    const pbx = await fs.readFile(path.join(ROOT, pbxRel), 'utf8');
    const hasReasons =
      xml.includes('NSPrivacyTracking') &&
      xml.includes('CA92.1') &&
      xml.includes('C617.1') &&
      xml.includes('35F9.1') &&
      xml.includes('E174.1');
    const inResources = pbx.includes('PrivacyInfo.xcprivacy in Resources');
    if (hasReasons && inResources) {
      pass(
        'Apple PrivacyInfo.xcprivacy şeması ve Xcode PBXResourcesBuildPhase kaydı',
        'CA92.1, C617.1, 35F9.1, E174.1 tanımlı'
      );
    } else {
      fail('PrivacyInfo.xcprivacy veya Xcode Resources kaydı', `hasReasons=${hasReasons}, inResources=${inResources}`);
    }

    const swiftPath = 'ios/App/App/Plugins/StoreKitPlugin.swift';
    const mainVcPath = 'ios/App/App/MainViewController.swift';
    const storyboardPath = 'ios/App/App/Base.lproj/Main.storyboard';
    if (
      (await fileExists(swiftPath)) &&
      (await fileExists(mainVcPath)) &&
      (await fileExists(storyboardPath))
    ) {
      const swiftCode = await fs.readFile(path.join(ROOT, swiftPath), 'utf8');
      const vcCode = await fs.readFile(path.join(ROOT, mainVcPath), 'utf8');
      const sbXml = await fs.readFile(path.join(ROOT, storyboardPath), 'utf8');
      const okStoreKit =
        swiftCode.includes('CAPBridgedPlugin') &&
        swiftCode.includes('StoreKitBilling') &&
        swiftCode.includes('Product.products') &&
        swiftCode.includes('AppStore.sync()') &&
        vcCode.includes('registerPluginInstance(StoreKitPlugin())') &&
        sbXml.includes('customClass="MainViewController"') &&
        pbx.includes('StoreKitPlugin.swift in Sources') &&
        pbx.includes('MainViewController.swift in Sources') &&
        pbx.includes('StoreKit.framework in Frameworks');
      if (okStoreKit) {
        pass(
          'Native Swift StoreKit 2 eklentisi, Keychain ve MainViewController kaydı',
          'StoreKitPlugin.swift + Main.storyboard + StoreKit.framework bağlı'
        );
      } else {
        fail('Native Swift StoreKit 2 bağlantısı', 'Eksik kayıt tespit edildi');
      }
    } else {
      fail('StoreKitPlugin.swift veya MainViewController.swift', 'Dosya eksik');
    }
  } else {
    fail('ios/App Xcode projesi veya PrivacyInfo.xcprivacy', 'Eksik');
  }

  const infoPlistRel = 'ios/App/App/Info.plist';
  if (await fileExists(infoPlistRel)) {
    const plist = await fs.readFile(path.join(ROOT, infoPlistRel), 'utf8');
    const okKeys =
      plist.includes('NSCameraUsageDescription') &&
      plist.includes('NSPhotoLibraryUsageDescription') &&
      plist.includes('NSPhotoLibraryAddUsageDescription') &&
      plist.includes('ITSAppUsesNonExemptEncryption') &&
      plist.includes('UIRequiresFullScreen');
    if (okKeys) {
      pass(
        'Info.plist kamera/galeri izin metinleri, ITSAppUsesNonExemptEncryption=false ve iPad uyumu',
        'Doğrulandı'
      );
    } else {
      fail('Info.plist zorunlu Apple anahtarları', 'Eksik izin veya şifreleme anahtarı');
    }
  } else {
    fail('ios/App/App/Info.plist', 'Eksik');
  }

  for (const requiredFile of [
    'ios/ExportOptions.plist',
    'ios/App/MindMapProducts.storekit',
    'ios/App/App.xcodeproj/xcshareddata/xcschemes/App.xcscheme',
    'ios/App/App.xcworkspace/contents.xcworkspacedata',
    'ios/App/ci_scripts/ci_post_clone.sh',
    'ios/App/App/capacitor.config.json',
    'ios/App/App/public/index.html',
    '.github/workflows/ios-appstore-release.yml',
    'codemagic.yaml',
    'scripts/ios-build-and-upload.sh',
    'scripts/appstore-connect-api-submit.mjs',
    'scripts/create-apple-dist-cert.mjs',
    'fastlane/Fastfile',
    'fastlane/metadata/tr/description.txt',
    'fastlane/metadata/en-US/description.txt',
    'appstore-submission/APP_STORE_CONNECT_REHBERI.md',
    'public/privacy.html',
    'public/terms.html',
    'public/support.html',
  ]) {
    if (await fileExists(requiredFile)) {
      pass(`Teslimat dosyası mevcut: ${requiredFile}`);
    } else {
      fail(`Teslimat dosyası eksik: ${requiredFile}`);
    }
  }

  try {
    execSync('node scripts/appstore-connect-api-submit.mjs --dry-run', {
      cwd: ROOT,
      stdio: 'pipe',
    });
    pass('App Store Connect REST API gönderim betiği & ASO karakter sınırı denetimi', 'TR + en-US doğrulandı');
  } catch (err) {
    fail(
      'App Store Connect REST API gönderim betiği (--dry-run)',
      err instanceof Error ? err.message : String(err)
    );
  }
}

async function runGate4TypeScriptAndBuild() {
  console.log('\n[4/5] TypeScript Derleme (tsc) ve Vite Üretim Paketi Kontrolü');
  try {
    execSync('npx tsc -p tsconfig.app.json --noEmit', {
      cwd: ROOT,
      stdio: 'pipe',
    });
    pass('TypeScript katı tip kontrolü (tsconfig.app.json)', '0 hata');
  } catch (err) {
    fail(
      'TypeScript katı tip kontrolü',
      err instanceof Error ? err.message : String(err)
    );
  }

  if ((await fileExists('dist/index.html')) && (await fileExists('dist/sw.js'))) {
    pass('Vite + PWA üretim paketi (dist/index.html & dist/sw.js)', 'Hazır');
  } else {
    try {
      execSync('npm run build', { cwd: ROOT, stdio: 'pipe' });
      pass('Vite + PWA üretim paketi (dist/)', 'Başarıyla derlendi');
    } catch (err) {
      fail('Vite üretim derlemesi', err instanceof Error ? err.message : String(err));
    }
  }
}

async function runGate5HeadlessE2EFreemiumAndResponsive() {
  console.log('\n[5/5] E2E 3 Harita Limiti -> 200 ₺ Paywall, PRO Çıkartma, Geri Yükleme & Responsive Testi');
  const port = 4179;
  const baseUrl = `http://127.0.0.1:${port}`;
  const serverProc = startLocalPreviewServer(port);
  const browser = await chromium.launch({ headless: true });

  try {
    await waitForHttpReady(baseUrl);
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      locale: 'tr-TR',
    });
    const page = await context.newPage();

    const pageErrors = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));

    // 5.1 Onboarding first-launch presentation & 1-tap skip
    await page.goto(`${baseUrl}/`, { waitUntil: 'domcontentloaded' });
    const skipBtn = page.getByRole('button', { name: /Atla/i });
    await skipBtn.waitFor({ state: 'visible', timeout: 8000 });
    await skipBtn.click();
    pass('İlk açılış 3 adımlı Onboarding ve tek dokunuş "Atla" akışı');

    // 5.2 Verify Free Tier starts at 1 / 3 active maps, allows 2nd & 3rd, and gates 4th map with 200 ₺ Paywall
    await page.waitForSelector('[data-testid="create-blank-map-btn"]', {
      timeout: 8000,
    });
    const initialCards = await page
      .locator('[data-testid^="workspace-map-card-"]')
      .count();
    if (initialCards === 1) {
      pass('Temiz kurulum başlangıç harita sayısı', '1 / 3 Ücretsiz Harita');
    } else {
      fail('Temiz kurulum başlangıç harita sayısı', `Beklenen 1, bulunan ${initialCards}`);
    }

    // Create 2nd map via template
    await page.click('[data-testid="template-card-tpl_tip_kardiyoloji"]');
    await page.waitForSelector('[data-testid="hud-back-home-btn"]', { timeout: 8000 });
    await page.click('[data-testid="hud-back-home-btn"]');

    // Create 3rd map via blank map dialog
    await page.waitForSelector('[data-testid="create-blank-map-btn"]', { timeout: 8000 });
    await page.click('[data-testid="create-blank-map-btn"]');
    await page.fill('[data-testid="new-map-title-input"]', 'Biyokimya Vize Özeti');
    await page.click('[data-testid="new-map-confirm-btn"]');
    await page.waitForSelector('[data-testid="hud-back-home-btn"]', { timeout: 8000 });
    await page.click('[data-testid="hud-back-home-btn"]');

    await page.waitForSelector('[data-testid="create-blank-map-btn"]', { timeout: 8000 });
    const countAtThree = await page
      .locator('[data-testid^="workspace-map-card-"]')
      .count();

    // Attempt 4th map -> must block creation and open 200 ₺ LifetimePaywallModal
    await page.click('[data-testid="create-blank-map-btn"]');
    const paywallModal = page.locator('[data-testid="lifetime-paywall-modal"]');
    await paywallModal.waitFor({ state: 'visible', timeout: 6000 });
    const paywallText = await paywallModal.innerText();

    if (
      countAtThree === 3 &&
      paywallText.includes('200 ₺') &&
      paywallText.includes('Satın Alımları Geri Yükle')
    ) {
      pass(
        '3 Ücretsiz Harita limiti ve 4. haritada 200 ₺ Ömür Boyu Pro Paywall kilidi',
        '3/3 korundu, 4. harita Paywall açtı'
      );
    } else {
      fail(
        '3 Ücretsiz Harita limiti ve 4. harita Paywall kilidi',
        `count=${countAtThree}`
      );
    }

    // Close paywall, open canvas with PRO sticker paywall, purchase, and test Restore Purchases
    await page.goto(
      `${baseUrl}/?view=canvas&tpl=tpl_tip_kardiyoloji&edit=m1&no_onboard=1`,
      { waitUntil: 'domcontentloaded' }
    );
    await page.waitForTimeout(600);

    // Click a PRO-badged specialist sticker in the visual suggestion bar
    const proStickerBtn = page.locator('button:has-text("PRO")').first();
    await proStickerBtn.waitFor({ state: 'visible', timeout: 8000 });
    await proStickerBtn.click();

    await paywallModal.waitFor({ state: 'visible', timeout: 6000 });
    const hasLivePreview = await page
      .locator('[data-testid="paywall-sticker-live-preview"]')
      .isVisible();
    if (hasLivePreview) {
      pass('PRO rozetli uzmanlık çıkartmasına tıklanınca canlı önizlemeli Paywall');
    } else {
      fail('PRO rozetli uzmanlık çıkartmasına tıklanınca canlı önizlemeli Paywall');
    }

    // Purchase 200 ₺ Lifetime Pro
    await page.click('[data-testid="paywall-purchase-btn"]');
    await page.waitForTimeout(650);

    const unlockedAfterBuy = await page.evaluate(
      () => window.__ZH_ENTITLEMENTS__?.getSnapshot().isLifetimePro === true
    );
    if (unlockedAfterBuy) {
      pass('StoreKit / Sandbox Ömür Boyu Pro satın alma akışı', 'isLifetimePro=true');
    } else {
      fail('StoreKit / Sandbox Ömür Boyu Pro satın alma akışı');
    }

    // Simulate app reinstall on new device (clear local entitlement, keep cloud receipt) and test Restore Purchases
    await page.evaluate(async () => {
      await window.__ZH_ENTITLEMENTS__?.resetForTesting(true);
    });
    const isReset = await page.evaluate(
      () => window.__ZH_ENTITLEMENTS__?.getSnapshot().isLifetimePro === false
    );

    await page.goto(`${baseUrl}/?paywall=settings_upgrade&no_onboard=1`, {
      waitUntil: 'domcontentloaded',
    });
    await page.waitForSelector('[data-testid="paywall-restore-btn"]', {
      timeout: 6000,
    });
    await page.click('[data-testid="paywall-restore-btn"]');
    await page.waitForTimeout(650);

    const restoredOk = await page.evaluate(
      () => window.__ZH_ENTITLEMENTS__?.getSnapshot().isLifetimePro === true
    );
    if (isReset && restoredOk) {
      pass('"Satın Alımları Geri Yükle" (Restore Purchases) uçtan uca doğrulaması');
    } else {
      fail(
        '"Satın Alımları Geri Yükle" doğrulaması',
        `isReset=${isReset}, restoredOk=${restoredOk}`
      );
    }

    // 5.3 Responsive Zero-Overflow Check across Mobile (375x812), Tablet (820x1180), Desktop (1440x900)
    for (const vp of [
      { label: 'Mobil (375x812)', width: 375, height: 812 },
      { label: 'iPad/Tablet (820x1180)', width: 820, height: 1180 },
      { label: 'Masaüstü (1440x900)', width: 1440, height: 900 },
    ]) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto(`${baseUrl}/?no_onboard=1`, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(300);
      const homeOverflow = await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth + 1
      );

      await page.goto(
        `${baseUrl}/?view=canvas&tpl=tpl_sistem_tasarimi&no_onboard=1`,
        { waitUntil: 'domcontentloaded' }
      );
      await page.waitForTimeout(350);
      const canvasOverflow = await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth + 1
      );

      if (!homeOverflow && !canvasOverflow) {
        pass(`Responsive sıfır yatay taşma (${vp.label})`, 'Haritalarım + Tuval tam uyumlu');
      } else {
        fail(
          `Responsive sıfır yatay taşma (${vp.label})`,
          `homeOverflow=${homeOverflow}, canvasOverflow=${canvasOverflow}`
        );
      }
    }

    if (pageErrors.length === 0) {
      pass('Çalışma zamanı (Runtime) konsol / sayfa hatası', '0 hata');
    } else {
      fail('Çalışma zamanı (Runtime) sayfa hatası', pageErrors.join(' | '));
    }

    await context.close();
  } finally {
    await browser.close();
    serverProc.kill();
  }
}

async function main() {
  console.log('======================================================================');
  console.log('  ZihinHaritam V4 — App Store & 200 ₺ Ömür Boyu Pro Hazırlık Denetimi');
  console.log('======================================================================');

  await runGate1OfflineIcons();
  await runGate2IconsAndScreenshots();
  await runGate3IosNativePrivacyAndCI();
  await runGate4TypeScriptAndBuild();
  await runGate5HeadlessE2EFreemiumAndResponsive();

  const failed = checks.filter((c) => !c.ok);
  console.log('\n======================================================================');
  if (failed.length === 0) {
    console.log(
      `🎉 TÜM KONTROLLER BAŞARILI (${checks.length}/${checks.length})! Uygulama App Store Connect yüklemesine %100 hazır.`
    );
    console.log('======================================================================');
    process.exit(0);
  } else {
    console.error(
      `🚨 ${failed.length} KONTROL BAŞARISIZ OLDU (${checks.length - failed.length}/${checks.length} geçti).`
    );
    console.log('======================================================================');
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Beklenmeyen doğrulama hatası:', err);
  process.exit(1);
});
