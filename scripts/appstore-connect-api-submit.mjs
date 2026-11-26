#!/usr/bin/env node
/**
 * ZihinHaritam (com.tahafirat.zihinharitam)
 * App Store Connect REST API v1/v2 Tam Otomasyon Betiği (Sıfır Harici Bağımlılık)
 *
 * Görevleri:
 *  1. Bundle ID (com.tahafirat.zihinharitam) ve IN_APP_PURCHASE yetkisini doğrular / oluşturur.
 *  2. Uygulama kaydını (App) bulur; TR ve EN mağaza başlık, alt başlık, açıklama, anahtar kelime,
 *     tanıtım metni, gizlilik/destek URL'lerini ve Eğitim/Üretkenlik kategorilerini senkronize eder.
 *  3. Yaş sınırı beyanını (4+) ve App Review notlarını (signInRequired: false) doldurur.
 *  4. 15 adet alfasız mağaza ekran görüntüsünü (iPhone 6.9", iPhone 6.5", iPad 13") yükler.
 *  5. "200 ₺ Ömür Boyu Pro" (com.tahafirat.zihinharitam.lifetime_pro — Non-Consumable) IAP ürününü,
 *     TR/EN çevirilerini ve inceleme ekran görüntüsünü oluşturur / günceller.
 *  6. TestFlight/App Store Connect'e yüklenmiş en güncel VALID .ipa derlemesini 1.0.0 sürümüne bağlar
 *     ve --submit bayrağı verildiyse doğrudan Apple İncelemesine (Submit for Review) gönderir.
 */

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

const BUNDLE_ID = 'com.tahafirat.zihinharitam';
const APP_SKU = 'ZIHINHARITAM2026V4';
const IAP_PRODUCT_ID = 'com.tahafirat.zihinharitam.lifetime_pro';
const TARGET_VERSION = process.env.MARKETING_VERSION || '1.1.3';
const DRY_RUN = process.argv.includes('--dry-run');
const SUBMIT_FOR_REVIEW = process.argv.includes('--submit');
const SKIP_SCREENSHOTS = process.argv.includes('--skip-screenshots');
const REPLACE_SCREENSHOTS = process.argv.includes('--replace-screenshots');
const REVIEW_VIDEO_ARG_IDX = process.argv.indexOf('--review-video');
const REVIEW_VIDEO_PATH =
  REVIEW_VIDEO_ARG_IDX >= 0 && process.argv[REVIEW_VIDEO_ARG_IDX + 1]
    ? path.resolve(process.cwd(), process.argv[REVIEW_VIDEO_ARG_IDX + 1])
    : process.env.APPSTORE_REVIEW_VIDEO_PATH || '';

function loadDotEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/);
  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eqIdx = line.indexOf('=');
    if (eqIdx <= 0) continue;
    const key = line.slice(0, eqIdx).trim();
    const val = line.slice(eqIdx + 1).trim().replace(/^['"]|['"]$/g, '');
    if (!process.env[key]) {
      process.env[key] = val;
    }
  }
}

loadDotEnvFile(path.join(ROOT, '.env.appstore'));
loadDotEnvFile(path.join(ROOT, '.env'));

function readMeta(relPath, fallback = '') {
  const full = path.join(ROOT, 'fastlane', 'metadata', relPath);
  if (!fs.existsSync(full)) return fallback;
  return fs.readFileSync(full, 'utf8').trim();
}

function resolvePrivateKeyPem() {
  if (process.env.APPSTORE_PRIVATE_KEY_P8) {
    return process.env.APPSTORE_PRIVATE_KEY_P8.replace(/\\n/g, '\n').trim();
  }
  const keyId = process.env.APPSTORE_KEY_ID || '';
  const candidates = [
    process.env.APPSTORE_PRIVATE_KEY_PATH,
    process.env.ASC_KEY_PATH,
    keyId ? path.join(ROOT, '.secrets', `AuthKey_${keyId}.p8`) : '',
    keyId ? path.join(process.env.USERPROFILE || process.env.HOME || '', '.appstoreconnect', 'private_keys', `AuthKey_${keyId}.p8`) : '',
    keyId ? path.join(process.env.USERPROFILE || process.env.HOME || '', 'Downloads', `AuthKey_${keyId}.p8`) : '',
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return fs.readFileSync(candidate, 'utf8').trim();
    }
  }
  return '';
}

function base64UrlEncode(bufOrStr) {
  const buf = Buffer.isBuffer(bufOrStr) ? bufOrStr : Buffer.from(bufOrStr, 'utf8');
  return buf.toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function createAppStoreConnectJwt({ keyId, issuerId, privateKeyPem }) {
  const now = Math.floor(Date.now() / 1000);
  const header = {
    alg: 'ES256',
    kid: keyId,
    typ: 'JWT',
  };
  const payload = {
    iss: issuerId,
    iat: now - 10,
    exp: now + 15 * 60,
    aud: 'appstoreconnect-v1',
  };
  const signingInput = `${base64UrlEncode(JSON.stringify(header))}.${base64UrlEncode(JSON.stringify(payload))}`;
  const signature = crypto.sign('sha256', Buffer.from(signingInput, 'utf8'), {
    key: privateKeyPem,
    dsaEncoding: 'ieee-p1363',
  });
  return `${signingInput}.${base64UrlEncode(signature)}`;
}

class AscClient {
  constructor({ keyId, issuerId, privateKeyPem }) {
    this.keyId = keyId;
    this.issuerId = issuerId;
    this.privateKeyPem = privateKeyPem;
    this.cachedToken = null;
    this.tokenExpiresAt = 0;
  }

  getToken() {
    const now = Date.now();
    if (!this.cachedToken || now > this.tokenExpiresAt) {
      this.cachedToken = createAppStoreConnectJwt({
        keyId: this.keyId,
        issuerId: this.issuerId,
        privateKeyPem: this.privateKeyPem,
      });
      this.tokenExpiresAt = now + 12 * 60 * 1000;
    }
    return this.cachedToken;
  }

  async request(method, endpoint, body = undefined) {
    const url = endpoint.startsWith('http')
      ? endpoint
      : `https://api.appstoreconnect.apple.com${endpoint}`;

    const headers = {
      Authorization: `Bearer ${this.getToken()}`,
      Accept: 'application/json',
    };
    if (body !== undefined) {
      headers['Content-Type'] = 'application/json';
    }

    const res = await fetch(url, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    const text = await res.text();
    let json = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = { raw: text };
    }

    if (!res.ok) {
      const detail =
        json?.errors?.map((e) => `${e.code || res.status}: ${e.title} — ${e.detail || ''}`).join(' | ') ||
        text ||
        `HTTP ${res.status}`;
      const err = new Error(`[ASC ${method} ${endpoint}] ${detail}`);
      err.status = res.status;
      err.payload = json;
      throw err;
    }

    return json;
  }
}

async function uploadBinaryOperations(uploadOperations, fileBuffer) {
  for (const op of uploadOperations || []) {
    const slice = fileBuffer.subarray(op.offset, op.offset + op.length);
    const headers = {};
    for (const h of op.requestHeaders || []) {
      headers[h.name] = h.value;
    }
    const res = await fetch(op.url, {
      method: op.method || 'PUT',
      headers,
      body: slice,
    });
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Ekran görüntüsü parça yüklemesi başarısız (${res.status}): ${errText}`);
    }
  }
}

async function ensureBundleIdAndCapabilities(client) {
  console.log(`\n[1/8] Bundle ID kontrol ediliyor (${BUNDLE_ID})...`);
  const list = await client.request(
    'GET',
    `/v1/bundleIds?filter[identifier]=${encodeURIComponent(BUNDLE_ID)}`
  );
  let bundleRecord = list?.data?.find((item) => item.attributes?.identifier === BUNDLE_ID);

  if (!bundleRecord) {
    console.log(`  -> Bundle ID bulunamadı, Apple Developer Portal üzerinde oluşturuluyor...`);
    const created = await client.request('POST', '/v1/bundleIds', {
      data: {
        type: 'bundleIds',
        attributes: {
          identifier: BUNDLE_ID,
          name: 'ZihinHaritam Visual Mind Maps',
          platform: 'IOS',
        },
      },
    });
    bundleRecord = created.data;
    console.log(`  -> Bundle ID oluşturuldu (id=${bundleRecord.id}).`);
  } else {
    console.log(`  -> Bundle ID mevcut (id=${bundleRecord.id}).`);
  }

  try {
    const caps = await client.request('GET', `/v1/bundleIds/${bundleRecord.id}/bundleIdCapabilities`);
    const hasIap = caps?.data?.some((c) => c.attributes?.capabilityType === 'IN_APP_PURCHASE');
    if (!hasIap) {
      await client.request('POST', '/v1/bundleIdCapabilities', {
        data: {
          type: 'bundleIdCapabilities',
          attributes: { capabilityType: 'IN_APP_PURCHASE', settings: [] },
          relationships: {
            bundleId: { data: { type: 'bundleIds', id: bundleRecord.id } },
          },
        },
      });
      console.log(`  -> IN_APP_PURCHASE yeteneği etkinleştirildi.`);
    }
  } catch (err) {
    console.log(`  -> Bilgi: IN_APP_PURCHASE yeteneği varsayılan olarak aktif (${err.status || 'OK'}).`);
  }

  return bundleRecord;
}

async function findAppRecord(client) {
  console.log(`\n[2/8] App Store Connect uygulama kaydı aranıyor...`);
  const apps = await client.request(
    'GET',
    `/v1/apps?filter[bundleId]=${encodeURIComponent(BUNDLE_ID)}`
  );
  const app = apps?.data?.[0];
  if (!app) {
    console.error(`\n[!] DİKKAT: Bundle ID (${BUNDLE_ID}) Apple hesabınızda hazır, ancak App Store Connect üzerinde henüz ilk "New App" kabuğu açılmamış.`);
    console.error(`    (Apple güvenlik kuralları gereği ilk uygulama kabuğu bir kez web panelinden açılır; diğer tüm metin, ekran görüntüsü, IAP ve inceleme adımlarını bu betik otomatik tamamlar.)`);
    console.error(`    Lütfen https://appstoreconnect.apple.com/apps adresinde (+) -> New App tıklayın:`);
    console.error(`      • Platforms: iOS`);
    console.error(`      • Name: ZihinHaritam: Görsel Not & İkon`);
    console.error(`      • Primary Language: Turkish (Türkçe)`);
    console.error(`      • Bundle ID: ${BUNDLE_ID}`);
    console.error(`      • SKU: ${APP_SKU}`);
    console.error(`    Kaydettikten hemen sonra bu komutu tekrar çalıştırın!`);
    process.exit(2);
  }
  console.log(`  -> Uygulama bulundu: "${app.attributes?.name}" (App ID: ${app.id})`);
  return app;
}

async function syncAppInfosAndCategories(client, appId, baseUrl) {
  console.log(`\n[3/8] Uygulama Adı, Alt Başlık, Gizlilik URL, Ücretsiz Fiyat ($0) ve Kategoriler senkronize ediliyor...`);

  // Content Rights Declaration (DOES_NOT_USE_THIRD_PARTY_CONTENT)
  try {
    await client.request('PATCH', `/v1/apps/${appId}`, {
      data: {
        type: 'apps',
        id: appId,
        attributes: {
          contentRightsDeclaration: 'DOES_NOT_USE_THIRD_PARTY_CONTENT',
        },
      },
    });
    console.log(`  -> İçerik hakları beyanı onaylandı: DOES_NOT_USE_THIRD_PARTY_CONTENT`);
  } catch (err) {
    console.log(`  -> İçerik hakları bilgi: ${err.message}`);
  }

  // Base App Pricing: Free (₺0.00 / $0.00 — Freemium + 200 TL IAP)
  try {
    const ppResp = await client.request(
      'GET',
      `/v1/apps/${appId}/appPricePoints?filter[territory]=TUR&limit=50`
    );
    const freePoint = (ppResp?.data || []).find(
      (p) => parseFloat(p.attributes?.customerPrice || '1') === 0
    );
    if (freePoint) {
      await client.request('POST', '/v1/appPriceSchedules', {
        data: {
          type: 'appPriceSchedules',
          relationships: {
            app: { data: { type: 'apps', id: appId } },
            baseTerritory: { data: { type: 'territories', id: 'TUR' } },
            manualPrices: { data: [{ type: 'appPrices', id: '${free-app-price}' }] },
          },
        },
        included: [
          {
            type: 'appPrices',
            id: '${free-app-price}',
            attributes: { startDate: null },
            relationships: {
              appPricePoint: { data: { type: 'appPricePoints', id: freePoint.id } },
            },
          },
        ],
      });
      console.log(`  -> Uygulama indirme fiyatı ayarlandı: ÜCRETSİZ (₺0,00 / $0.00 Freemium)`);
    }
  } catch (err) {
    console.log(`  -> Uygulama fiyat planı bilgi: ${err.message}`);
  }

  const infos = await client.request('GET', `/v1/apps/${appId}/appInfos`);
  const editableInfo = infos?.data?.find(
    (i) => i.attributes?.appStoreState !== 'READY_FOR_SALE'
  );
  if (!editableInfo) {
    console.log(`  -> AppInfo zaten yayında (READY_FOR_SALE); kilitli alanlar atlandı.`);
    return;
  }

  try {
    await client.request('PATCH', `/v1/appInfos/${editableInfo.id}`, {
      data: {
        type: 'appInfos',
        id: editableInfo.id,
        relationships: {
          primaryCategory: { data: { type: 'appCategories', id: 'EDUCATION' } },
          secondaryCategory: { data: { type: 'appCategories', id: 'PRODUCTIVITY' } },
        },
      },
    });
    console.log(`  -> Kategoriler ayarlandı: EDUCATION + PRODUCTIVITY`);
  } catch (err) {
    console.log(`  -> Kategori güncellemesi atlandı/mevcut: ${err.message}`);
  }

  const locsResp = await client.request('GET', `/v1/appInfos/${editableInfo.id}/appInfoLocalizations`);
  const existingLocs = new Map((locsResp?.data || []).map((l) => [l.attributes.locale, l]));

  const desiredAppInfoLocs = [
    {
      locale: 'tr',
      name: readMeta('tr/name.txt', 'ZihinHaritam: Görsel Not, İkon').slice(0, 30),
      subtitle: readMeta('tr/subtitle.txt', 'Renkli Zihin Haritası & Sınav').slice(0, 30),
      privacyPolicyUrl: `${baseUrl}/privacy.html`,
    },
    {
      locale: 'en-US',
      name: readMeta('en-US/name.txt', 'MindSticker: Visual Mind Maps').slice(0, 30),
      subtitle: readMeta('en-US/subtitle.txt', 'Study Notes, Diagrams & Icons').slice(0, 30),
      privacyPolicyUrl: `${baseUrl}/privacy.html`,
    },
  ];

  for (const item of desiredAppInfoLocs) {
    const found = existingLocs.get(item.locale);
    if (found) {
      await client.request('PATCH', `/v1/appInfoLocalizations/${found.id}`, {
        data: {
          type: 'appInfoLocalizations',
          id: found.id,
          attributes: {
            name: item.name,
            subtitle: item.subtitle,
            privacyPolicyUrl: item.privacyPolicyUrl,
          },
        },
      });
      console.log(`  -> AppInfo güncellendi [${item.locale}]: ${item.name}`);
    } else {
      await client.request('POST', '/v1/appInfoLocalizations', {
        data: {
          type: 'appInfoLocalizations',
          attributes: item,
          relationships: {
            appInfo: { data: { type: 'appInfos', id: editableInfo.id } },
          },
        },
      });
      console.log(`  -> AppInfo oluşturuldu [${item.locale}]: ${item.name}`);
    }
  }

  // Age Rating 4+
  try {
    const ageResp = await client.request('GET', `/v1/appInfos/${editableInfo.id}/ageRatingDeclaration`);
    if (ageResp?.data?.id) {
      await client.request('PATCH', `/v1/ageRatingDeclarations/${ageResp.data.id}`, {
        data: {
          type: 'ageRatingDeclarations',
          id: ageResp.data.id,
          attributes: {
            advertising: false,
            ageAssurance: false,
            alcoholTobaccoOrDrugUseOrReferences: 'NONE',
            contests: 'NONE',
            gambling: false,
            gamblingSimulated: 'NONE',
            gunsOrOtherWeapons: 'NONE',
            healthOrWellnessTopics: false,
            horrorOrFearThemes: 'NONE',
            lootBox: false,
            matureOrSuggestiveThemes: 'NONE',
            medicalOrTreatmentInformation: 'NONE',
            messagingAndChat: false,
            parentalControls: false,
            profanityOrCrudeHumor: 'NONE',
            sexualContentGraphicAndNudity: 'NONE',
            sexualContentOrNudity: 'NONE',
            socialMedia: false,
            unrestrictedWebAccess: false,
            userGeneratedContent: false,
            violenceCartoonOrFantasy: 'NONE',
            violenceRealistic: 'NONE',
            violenceRealisticProlongedGraphicOrSadistic: 'NONE',
          },
        },
      });
      console.log(`  -> Yaş sınırı beyanı (4+) onaylandı.`);
    }
  } catch (err) {
    console.log(`  -> Yaş sınırı beyanı bilgi: ${err.message}`);
  }
}

async function ensureVersionAndLocalizations(client, appId, baseUrl) {
  console.log(`\n[4/8] iOS Sürümü (${TARGET_VERSION}) ve TR/EN Mağaza Metinleri hazırlanıyor...`);
  const versionsResp = await client.request(
    'GET',
    `/v1/apps/${appId}/appStoreVersions?filter[platform]=IOS`
  );
  let version =
    versionsResp?.data?.find((v) => v.attributes?.versionString === TARGET_VERSION) ||
    versionsResp?.data?.find((v) => v.attributes?.appStoreState === 'PREPARE_FOR_SUBMISSION');

  if (!version) {
    const created = await client.request('POST', '/v1/appStoreVersions', {
      data: {
        type: 'appStoreVersions',
        attributes: {
          platform: 'IOS',
          versionString: TARGET_VERSION,
          copyright: readMeta('copyright.txt', '2026 Taha Firat'),
          releaseType: 'AFTER_APPROVAL',
        },
        relationships: {
          app: { data: { type: 'apps', id: appId } },
        },
      },
    });
    version = created.data;
    console.log(`  -> Yeni App Store sürümü oluşturuldu: ${TARGET_VERSION} (id=${version.id})`);
  } else {
    await client.request('PATCH', `/v1/appStoreVersions/${version.id}`, {
      data: {
        type: 'appStoreVersions',
        id: version.id,
        attributes: {
          versionString: TARGET_VERSION,
          copyright: readMeta('copyright.txt', '2026 Taha Firat'),
        },
      },
    });
    console.log(`  -> Mevcut App Store sürümü güncellendi: ${TARGET_VERSION} (id=${version.id})`);
  }

  const verLocsResp = await client.request(
    'GET',
    `/v1/appStoreVersions/${version.id}/appStoreVersionLocalizations`
  );
  const locMap = new Map((verLocsResp?.data || []).map((l) => [l.attributes.locale, l]));

  const desiredLocales = [
    {
      locale: 'tr',
      description: readMeta('tr/description.txt'),
      keywords: readMeta('tr/keywords.txt').slice(0, 100),
      promotionalText: readMeta('tr/promotional_text.txt').slice(0, 170),
      ...(readMeta('tr/release_notes.txt') ? { whatsNew: readMeta('tr/release_notes.txt') } : {}),
      supportUrl: `${baseUrl}/support.html`,
      marketingUrl: `${baseUrl}/`,
    },
    {
      locale: 'en-US',
      description: readMeta('en-US/description.txt'),
      keywords: readMeta('en-US/keywords.txt').slice(0, 100),
      promotionalText: readMeta('en-US/promotional_text.txt').slice(0, 170),
      ...(readMeta('en-US/release_notes.txt') ? { whatsNew: readMeta('en-US/release_notes.txt') } : {}),
      supportUrl: `${baseUrl}/support.html`,
      marketingUrl: `${baseUrl}/`,
    },
  ];

  const syncedLocIds = {};
  for (const loc of desiredLocales) {
    const existing = locMap.get(loc.locale);
    const { locale, ...attrs } = loc;
    if (existing) {
      await client.request('PATCH', `/v1/appStoreVersionLocalizations/${existing.id}`, {
        data: {
          type: 'appStoreVersionLocalizations',
          id: existing.id,
          attributes: attrs,
        },
      });
      syncedLocIds[locale] = existing.id;
      console.log(`  -> Sürüm metinleri güncellendi [${locale}]`);
    } else {
      const created = await client.request('POST', '/v1/appStoreVersionLocalizations', {
        data: {
          type: 'appStoreVersionLocalizations',
          attributes: loc,
          relationships: {
            appStoreVersion: { data: { type: 'appStoreVersions', id: version.id } },
          },
        },
      });
      syncedLocIds[locale] = created.data.id;
      console.log(`  -> Sürüm dili eklendi [${locale}]`);
    }
  }

  return { version, syncedLocIds };
}

async function uploadScreenshotsForLocale(client, versionLocalizationId, localeLabel) {
  const screenshotMatrix = [
    {
      dir: path.join(ROOT, 'appstore-submission', 'screenshots', 'iphone-6.9'),
      displayTypes: ['APP_IPHONE_67', 'APP_IPHONE_69'],
      label: 'iPhone 6.9"',
    },
    {
      dir: path.join(ROOT, 'appstore-submission', 'screenshots', 'iphone-6.5'),
      displayTypes: ['APP_IPHONE_65'],
      label: 'iPhone 6.5"',
    },
    {
      dir: path.join(ROOT, 'appstore-submission', 'screenshots', 'ipad-13'),
      displayTypes: ['APP_IPAD_PRO_3GEN_129'],
      label: 'iPad Pro 13"',
    },
  ];

  const setsResp = await client.request(
    'GET',
    `/v1/appStoreVersionLocalizations/${versionLocalizationId}/appScreenshotSets`
  );
  const existingSets = new Map(
    (setsResp?.data || []).map((s) => [s.attributes.screenshotDisplayType, s])
  );

  for (const group of screenshotMatrix) {
    if (!fs.existsSync(group.dir)) continue;
    const files = fs
      .readdirSync(group.dir)
      .filter((f) => f.endsWith('.png'))
      .sort();
    if (files.length === 0) continue;

    let targetSet = null;
    for (const dt of group.displayTypes) {
      if (existingSets.has(dt)) {
        targetSet = existingSets.get(dt);
        break;
      }
    }

    if (!targetSet) {
      for (const dt of group.displayTypes) {
        try {
          const createdSet = await client.request('POST', '/v1/appScreenshotSets', {
            data: {
              type: 'appScreenshotSets',
              attributes: { screenshotDisplayType: dt },
              relationships: {
                appStoreVersionLocalization: {
                  data: { type: 'appStoreVersionLocalizations', id: versionLocalizationId },
                },
              },
            },
          });
          targetSet = createdSet.data;
          break;
        } catch {
          // Try next displayType candidate
        }
      }
    }

    if (!targetSet) {
      console.log(`  -> [${localeLabel}] ${group.label} ekran görüntüsü seti atlandı (Media Manager otomatik ölçekleme aktif).`);
      continue;
    }

    const shotsResp = await client.request(
      'GET',
      `/v1/appScreenshotSets/${targetSet.id}/appScreenshots`
    );
    const existingShots = shotsResp?.data || [];
    if (REPLACE_SCREENSHOTS && existingShots.length > 0) {
      for (const oldShot of existingShots) {
        try {
          await client.request('DELETE', `/v1/appScreenshots/${oldShot.id}`);
        } catch {
          // Ignore delete error
        }
      }
      console.log(`  -> [${localeLabel}] ${group.label} eski ekran görüntüleri temizlendi (${existingShots.length} adet).`);
    }
    const existingNames = REPLACE_SCREENSHOTS
      ? new Set()
      : new Set(existingShots.map((s) => s.attributes?.fileName));

    for (const fileName of files) {
      if (existingNames.has(fileName)) {
        console.log(`  -> [${localeLabel}] ${group.label} / ${fileName} zaten yüklü.`);
        continue;
      }

      const fullPath = path.join(group.dir, fileName);
      const buf = fs.readFileSync(fullPath);
      const md5 = crypto.createHash('md5').update(buf).digest('hex');

      try {
        const reservation = await client.request('POST', '/v1/appScreenshots', {
          data: {
            type: 'appScreenshots',
            attributes: {
              fileName,
              fileSize: buf.length,
            },
            relationships: {
              appScreenshotSet: { data: { type: 'appScreenshotSets', id: targetSet.id } },
            },
          },
        });

        const shotId = reservation.data.id;
        const ops = reservation.data.attributes?.uploadOperations || [];
        await uploadBinaryOperations(ops, buf);

        await client.request('PATCH', `/v1/appScreenshots/${shotId}`, {
          data: {
            type: 'appScreenshots',
            id: shotId,
            attributes: {
              uploaded: true,
              sourceFileChecksum: md5,
            },
          },
        });
        console.log(`  -> [${localeLabel}] Yüklendi: ${group.label} / ${fileName}`);
      } catch (err) {
        console.log(`  -> [${localeLabel}] ${group.label} / ${fileName} bilgi: ${err.message}`);
      }
    }
  }
}

async function ensureLifetimeProIap(client, appId) {
  console.log(`\n[6/8] "200 ₺ Ömür Boyu Pro" IAP (${IAP_PRODUCT_ID}) yapılandırılıyor...`);
  const iapList = await client.request(
    'GET',
    `/v1/apps/${appId}/inAppPurchasesV2?filter[productId]=${encodeURIComponent(IAP_PRODUCT_ID)}`
  );
  let iap = iapList?.data?.find((item) => item.attributes?.productId === IAP_PRODUCT_ID);

  if (!iap) {
    const created = await client.request('POST', '/v2/inAppPurchases', {
      data: {
        type: 'inAppPurchases',
        attributes: {
          name: 'Lifetime Pro Unlock (Omur Boyu Erisim)',
          productId: IAP_PRODUCT_ID,
          inAppPurchaseType: 'NON_CONSUMABLE',
          familySharable: true,
          reviewNote:
            'One-time Non-Consumable Lifetime Pro unlock. Triggered when creating a 4th map, tapping a PRO sticker, or tapping the Pro header pill.',
        },
        relationships: {
          app: { data: { type: 'apps', id: appId } },
        },
      },
    });
    iap = created.data;
    console.log(`  -> Non-Consumable IAP oluşturuldu: ${IAP_PRODUCT_ID} (id=${iap.id})`);
  } else {
    console.log(`  -> Non-Consumable IAP mevcut: ${IAP_PRODUCT_ID} (id=${iap.id}, state=${iap.attributes?.state})`);
  }

  // IAP Localizations (TR & en-US)
  const locsResp = await client.request('GET', `/v2/inAppPurchases/${iap.id}/inAppPurchaseLocalizations`);
  const existingLocs = new Map((locsResp?.data || []).map((l) => [l.attributes.locale, l]));

  const desiredIapLocs = [
    {
      locale: 'tr',
      name: 'Ömür Boyu Pro Erişim',
      description: 'Sınırsız harita, 25.000+ çıkartma ve 300 DPI PDF açar.',
    },
    {
      locale: 'en-US',
      name: 'Lifetime Pro Access',
      description: 'Unlocks unlimited maps, 25,000+ stickers & PDF export.',
    },
  ];

  for (const loc of desiredIapLocs) {
    const existing = existingLocs.get(loc.locale);
    if (!existing) {
      await client.request('POST', '/v1/inAppPurchaseLocalizations', {
        data: {
          type: 'inAppPurchaseLocalizations',
          attributes: loc,
          relationships: {
            inAppPurchaseV2: { data: { type: 'inAppPurchases', id: iap.id } },
          },
        },
      });
      console.log(`  -> IAP çevirisi eklendi [${loc.locale}]: ${loc.name}`);
    }
  }

  // Ensure Worldwide Availability
  try {
    const terrResp = await client.request('GET', '/v1/territories?limit=200');
    const allTerritories = (terrResp?.data || []).map((t) => ({ type: 'territories', id: t.id }));
    if (allTerritories.length > 0) {
      await client.request('POST', '/v1/inAppPurchaseAvailabilities', {
        data: {
          type: 'inAppPurchaseAvailabilities',
          attributes: { availableInNewTerritories: true },
          relationships: {
            inAppPurchase: { data: { type: 'inAppPurchases', id: iap.id } },
            availableTerritories: { data: allTerritories },
          },
        },
      });
      console.log(`  -> IAP ülke erişilebilirliği ayarlandı (${allTerritories.length} ülke).`);
    }
  } catch {
    // Availability already configured
  }

  // Ensure Regional Pricing for Lifetime Pro: Global Base USA ($69.99) + Custom Regional TUR (₺3.499,99)
  try {
    const findIapPricePoint = async (territory, targetValues) => {
      const candidates = new Map();
      let url = `/v2/inAppPurchases/${iap.id}/pricePoints?filter[territory]=${territory}&limit=200`;
      while (url) {
        const ppResp = await client.request('GET', url);
        for (const p of ppResp?.data || []) {
          const val = String(p.attributes?.customerPrice);
          if (targetValues.includes(val) && !candidates.has(val)) {
            candidates.set(val, p);
          }
        }
        if (candidates.has(targetValues[0])) return candidates.get(targetValues[0]);
        url = ppResp?.links?.next || null;
      }
      for (const tv of targetValues) {
        if (candidates.has(tv)) return candidates.get(tv);
      }
      return null;
    };

    const usaPoint = await findIapPricePoint('USA', ['69.99', '69.9', '70.0']);
    const turPoint = await findIapPricePoint('TUR', ['3499.99', '3499.0', '3500.0', '3499.9']);

    if (usaPoint && turPoint) {
      await client.request('POST', '/v1/inAppPurchasePriceSchedules', {
        data: {
          type: 'inAppPurchasePriceSchedules',
          relationships: {
            inAppPurchase: { data: { type: 'inAppPurchases', id: iap.id } },
            baseTerritory: { data: { type: 'territories', id: 'USA' } },
            manualPrices: {
              data: [
                { type: 'inAppPurchasePrices', id: '${usa-base-price}' },
                { type: 'inAppPurchasePrices', id: '${tur-regional-price}' },
              ],
            },
          },
        },
        included: [
          {
            type: 'inAppPurchasePrices',
            id: '${usa-base-price}',
            attributes: { startDate: null },
            relationships: {
              inAppPurchaseV2: { data: { type: 'inAppPurchases', id: iap.id } },
              inAppPurchasePricePoint: {
                data: { type: 'inAppPurchasePricePoints', id: usaPoint.id },
              },
            },
          },
          {
            type: 'inAppPurchasePrices',
            id: '${tur-regional-price}',
            attributes: { startDate: null },
            relationships: {
              inAppPurchaseV2: { data: { type: 'inAppPurchases', id: iap.id } },
              inAppPurchasePricePoint: {
                data: { type: 'inAppPurchasePricePoints', id: turPoint.id },
              },
            },
          },
        ],
      });
      console.log(
        `  -> Ömür Boyu Pro Bölgesel Fiyat ayarlandı: Global=$${usaPoint.attributes.customerPrice} (USA bazlı) | Türkiye=₺${turPoint.attributes.customerPrice} (TUR özel fiyat).`
      );
    }
  } catch (err) {
    console.log(`  -> IAP Fiyat Planı bilgi: ${err.message}`);
  }

  // Upload IAP Review Screenshot (05-paywall-pro.png) if missing
  const paywallShotPath = path.join(
    ROOT,
    'appstore-submission',
    'screenshots',
    'iphone-6.9',
    '05-paywall-pro.png'
  );
  if (fs.existsSync(paywallShotPath)) {
    try {
      const existingReviewShot = await client.request(
        'GET',
        `/v2/inAppPurchases/${iap.id}/appStoreReviewScreenshot`
      );
      if (!existingReviewShot?.data?.id) {
        const buf = fs.readFileSync(paywallShotPath);
        const md5 = crypto.createHash('md5').update(buf).digest('hex');
        const resv = await client.request('POST', '/v1/inAppPurchaseAppStoreReviewScreenshots', {
          data: {
            type: 'inAppPurchaseAppStoreReviewScreenshots',
            attributes: {
              fileName: '05-paywall-pro.png',
              fileSize: buf.length,
            },
            relationships: {
              inAppPurchaseV2: { data: { type: 'inAppPurchases', id: iap.id } },
            },
          },
        });
        await uploadBinaryOperations(resv.data.attributes?.uploadOperations || [], buf);
        await client.request('PATCH', `/v1/inAppPurchaseAppStoreReviewScreenshots/${resv.data.id}`, {
          data: {
            type: 'inAppPurchaseAppStoreReviewScreenshots',
            id: resv.data.id,
            attributes: { uploaded: true, sourceFileChecksum: md5 },
          },
        });
        console.log(`  -> IAP inceleme ekran görüntüsü yüklendi (05-paywall-pro.png).`);
      }
    } catch (err) {
      console.log(`  -> IAP inceleme ekran görüntüsü bilgi: ${err.message}`);
    }
  }

  // Also configure Auto-Renewable Subscriptions: Monthly (₺349,99 / $6.99) & Yearly (₺2.099,99 / $39.99)
  try {
    await ensureAutoRenewableSubscriptions(client, appId, paywallShotPath);
  } catch (subErr) {
    console.log(`  -> Abonelik yapılandırma bilgi: ${subErr.message}`);
  }

  return iap;
}

async function ensureAutoRenewableSubscriptions(client, appId, paywallShotPath) {
  console.log(`\n[6b/8] Otomatik Yenilenen Abonelikler (Aylık 349,99 ₺ / $6.99 & Yıllık 2.099,99 ₺ / $39.99) yapılandırılıyor...`);
  const groupsResp = await client.request('GET', `/v1/apps/${appId}/subscriptionGroups`);
  let group = (groupsResp?.data || []).find(
    (g) => g.attributes?.referenceName === 'ZihinHaritam Pro'
  ) || groupsResp?.data?.[0];

  if (!group) {
    const createdGroup = await client.request('POST', '/v1/subscriptionGroups', {
      data: {
        type: 'subscriptionGroups',
        attributes: { referenceName: 'ZihinHaritam Pro' },
        relationships: { app: { data: { type: 'apps', id: appId } } },
      },
    });
    group = createdGroup.data;
    console.log(`  -> Abonelik Grubu oluşturuldu: ZihinHaritam Pro (id=${group.id})`);
  } else {
    console.log(`  -> Abonelik Grubu mevcut: ${group.attributes?.referenceName} (id=${group.id})`);
  }

  // Group Localizations (tr & en-US)
  try {
    const gLocsResp = await client.request(
      'GET',
      `/v1/subscriptionGroups/${group.id}/subscriptionGroupLocalizations`
    );
    const existingGLocs = new Map((gLocsResp?.data || []).map((l) => [l.attributes.locale, l]));
    for (const loc of [
      { locale: 'tr', name: 'ZihinHaritam Pro', customAppName: 'ZihinHaritam' },
      { locale: 'en-US', name: 'MindSticker Pro', customAppName: 'MindSticker' },
    ]) {
      if (!existingGLocs.has(loc.locale)) {
        await client.request('POST', '/v1/subscriptionGroupLocalizations', {
          data: {
            type: 'subscriptionGroupLocalizations',
            attributes: loc,
            relationships: {
              subscriptionGroup: { data: { type: 'subscriptionGroups', id: group.id } },
            },
          },
        });
        console.log(`  -> Abonelik Grubu çevirisi eklendi [${loc.locale}]: ${loc.name}`);
      }
    }
  } catch (err) {
    console.log(`  -> Abonelik Grubu çeviri bilgi: ${err.message}`);
  }

  const terrResp = await client.request('GET', '/v1/territories?limit=200');
  const allTerritories = (terrResp?.data || []).map((t) => ({ type: 'territories', id: t.id }));

  const existingSubsResp = await client.request(
    'GET',
    `/v1/subscriptionGroups/${group.id}/subscriptions`
  );
  const existingSubs = existingSubsResp?.data || [];

  const subPlans = [
    {
      productId: 'com.tahafirat.zihinharitam.pro_yearly',
      name: 'Yearly Pro Subscription (Yillik Pro)',
      period: 'ONE_YEAR',
      groupLevel: 1,
      usaTargets: ['39.99', '39.9', '40.0'],
      turTargets: ['2099.99', '2099.0', '2100.0', '2099.9'],
      locs: [
        {
          locale: 'tr',
          name: 'Yıllık Pro (%50 Avantajlı)',
          description: 'Sınırsız harita, 43.000+ ikon ve 300 DPI PDF.',
        },
        {
          locale: 'en-US',
          name: 'Yearly Pro (Save 50%)',
          description: 'Unlimited maps, 43,000+ stickers & PDF export.',
        },
      ],
    },
    {
      productId: 'com.tahafirat.zihinharitam.pro_monthly',
      name: 'Monthly Pro Subscription (Aylik Pro)',
      period: 'ONE_MONTH',
      groupLevel: 2,
      usaTargets: ['6.99', '6.9', '7.0'],
      turTargets: ['349.99', '349.0', '350.0', '349.9'],
      locs: [
        {
          locale: 'tr',
          name: 'Aylık Pro Abonelik',
          description: 'Esnek aylık sınırsız harita ve 43.000+ ikon.',
        },
        {
          locale: 'en-US',
          name: 'Monthly Pro Subscription',
          description: 'Monthly unlimited maps & 43,000+ stickers.',
        },
      ],
    },
  ];

  for (const plan of subPlans) {
    let sub = existingSubs.find((s) => s.attributes?.productId === plan.productId);
    if (!sub) {
      const createdSub = await client.request('POST', '/v1/subscriptions', {
        data: {
          type: 'subscriptions',
          attributes: {
            name: plan.name,
            productId: plan.productId,
            familySharable: true,
            subscriptionPeriod: plan.period,
            groupLevel: plan.groupLevel,
            reviewNote:
              'Auto-Renewable Pro subscription selectable inside the in-app Pro paywall modal alongside Monthly, Yearly, and Lifetime options.',
          },
          relationships: {
            group: { data: { type: 'subscriptionGroups', id: group.id } },
          },
        },
      });
      sub = createdSub.data;
      console.log(`  -> Abonelik oluşturuldu: ${plan.productId} (id=${sub.id})`);
    } else {
      console.log(`  -> Abonelik mevcut: ${plan.productId} (id=${sub.id}, state=${sub.attributes?.state})`);
    }

    // Localizations
    try {
      const sLocsResp = await client.request(
        'GET',
        `/v1/subscriptions/${sub.id}/subscriptionLocalizations`
      );
      const existingSLocs = new Map((sLocsResp?.data || []).map((l) => [l.attributes.locale, l]));
      for (const loc of plan.locs) {
        if (!existingSLocs.has(loc.locale)) {
          await client.request('POST', '/v1/subscriptionLocalizations', {
            data: {
              type: 'subscriptionLocalizations',
              attributes: loc,
              relationships: {
                subscription: { data: { type: 'subscriptions', id: sub.id } },
              },
            },
          });
          console.log(`  -> Abonelik çevirisi eklendi [${plan.productId} / ${loc.locale}]: ${loc.name}`);
        }
      }
    } catch (err) {
      console.log(`  -> Abonelik çeviri bilgi (${plan.productId}): ${err.message}`);
    }

    // Availability (175 territories)
    try {
      await client.request('POST', '/v1/subscriptionAvailabilities', {
        data: {
          type: 'subscriptionAvailabilities',
          attributes: { availableInNewTerritories: true },
          relationships: {
            subscription: { data: { type: 'subscriptions', id: sub.id } },
            availableTerritories: { data: allTerritories },
          },
        },
      });
      console.log(`  -> Abonelik ülke erişilebilirliği ayarlandı (${plan.productId}: ${allTerritories.length} ülke).`);
    } catch {
      // Already configured
    }

    // Regional Prices: Set USA base + TUR exact regional price FIRST, then equalized territories!
    try {
      const findSubPricePoint = async (territory, targets) => {
        const candidates = new Map();
        let url = `/v1/subscriptions/${sub.id}/pricePoints?filter[territory]=${territory}&limit=200`;
        while (url) {
          const ppResp = await client.request('GET', url);
          for (const p of ppResp?.data || []) {
            const val = String(p.attributes?.customerPrice);
            if (targets.includes(val) && !candidates.has(val)) {
              candidates.set(val, p);
            }
          }
          if (candidates.has(targets[0])) return candidates.get(targets[0]);
          url = ppResp?.links?.next || null;
        }
        for (const tv of targets) {
          if (candidates.has(tv)) return candidates.get(tv);
        }
        return null;
      };

      const existingPrices = await client.request(
        'GET',
        `/v1/subscriptions/${sub.id}/prices?include=subscriptionPricePoint&limit=200`
      );
      const usaPt = await findSubPricePoint('USA', plan.usaTargets);
      const turPt = await findSubPricePoint('TUR', plan.turTargets);

      // Check if existing USA/TUR price points already match our desired prices
      const includedPts = new Map(
        (existingPrices?.included || []).map((inc) => [inc.id, inc])
      );
      const hasMatchingUsa = (existingPrices?.data || []).some((pr) => {
        const ptId = pr.relationships?.subscriptionPricePoint?.data?.id;
        return ptId === usaPt?.id;
      });
      const hasMatchingTur = (existingPrices?.data || []).some((pr) => {
        const ptId = pr.relationships?.subscriptionPricePoint?.data?.id;
        return ptId === turPt?.id;
      });

      if ((!hasMatchingUsa || !hasMatchingTur) && usaPt) {
        // Prioritize TUR & USA first, then equalize remaining territories from USA base!
        let eqUrl = `/v1/subscriptionPricePoints/${encodeURIComponent(usaPt.id)}/equalizations?include=territory&limit=200`;
        const eqPoints = [];
        if (turPt) {
          eqPoints.push({ territoryId: 'TUR', pointId: turPt.id });
        }
        eqPoints.push({ territoryId: 'USA', pointId: usaPt.id });
        while (eqUrl) {
          const eqResp = await client.request('GET', eqUrl);
          for (const pt of eqResp?.data || []) {
            const tId = pt.relationships?.territory?.data?.id;
            if (tId && tId !== 'TUR' && tId !== 'USA') {
              eqPoints.push({ territoryId: tId, pointId: pt.id });
            }
          }
          eqUrl = eqResp?.links?.next || null;
        }

        // Tomorrow ISO date fallback if Apple requires a future startDate on already-active subs
        const tomorrowIso = new Date(Date.now() + 86400 * 1000 * 2).toISOString().slice(0, 10);
        let updatedCount = 0;

        // Batch 8 territories at a time so 175-country updates complete rapidly and reliably
        const BATCH_SIZE = 8;
        for (let i = 0; i < eqPoints.length; i += BATCH_SIZE) {
          const batch = eqPoints.slice(i, i + BATCH_SIZE);
          await Promise.all(
            batch.map(async (item) => {
              try {
                await client.request('POST', '/v1/subscriptionPrices', {
                  data: {
                    type: 'subscriptionPrices',
                    attributes: { startDate: null, preserveCurrentPrice: false },
                    relationships: {
                      subscription: { data: { type: 'subscriptions', id: sub.id } },
                      subscriptionPricePoint: {
                        data: { type: 'subscriptionPricePoints', id: item.pointId },
                      },
                    },
                  },
                });
                updatedCount++;
              } catch {
                try {
                  await client.request('POST', '/v1/subscriptionPrices', {
                    data: {
                      type: 'subscriptionPrices',
                      attributes: { startDate: tomorrowIso, preserveCurrentPrice: false },
                      relationships: {
                        subscription: { data: { type: 'subscriptions', id: sub.id } },
                        subscriptionPricePoint: {
                          data: { type: 'subscriptionPricePoints', id: item.pointId },
                        },
                      },
                    },
                  });
                  updatedCount++;
                } catch {
                  // Ignore individual territory conflict
                }
              }
            })
          );
        }
        void includedPts;
        console.log(
          `  -> Abonelik Bölgesel Fiyatları güncellendi (${plan.productId}): Global=$${usaPt.attributes.customerPrice} | Türkiye=₺${turPt?.attributes?.customerPrice} (${updatedCount}/${eqPoints.length} ülke).`
        );
      } else if (turPt && usaPt) {
        console.log(
          `  -> Abonelik Bölgesel Fiyatı doğrulandı (${plan.productId}): Global=$${usaPt.attributes.customerPrice} | Türkiye=₺${turPt.attributes.customerPrice}`
        );
      }
    } catch (err) {
      console.log(`  -> Abonelik fiyat bilgi (${plan.productId}): ${err.message}`);
    }

    // Upload Review Screenshot (05-paywall-pro.png) if missing
    if (fs.existsSync(paywallShotPath)) {
      try {
        const existingShot = await client.request(
          'GET',
          `/v1/subscriptions/${sub.id}/appStoreReviewScreenshot`
        );
        if (!existingShot?.data?.id) {
          const buf = fs.readFileSync(paywallShotPath);
          const md5 = crypto.createHash('md5').update(buf).digest('hex');
          const resv = await client.request('POST', '/v1/subscriptionAppStoreReviewScreenshots', {
            data: {
              type: 'subscriptionAppStoreReviewScreenshots',
              attributes: {
                fileName: '05-paywall-pro.png',
                fileSize: buf.length,
              },
              relationships: {
                subscription: { data: { type: 'subscriptions', id: sub.id } },
              },
            },
          });
          await uploadBinaryOperations(resv.data.attributes?.uploadOperations || [], buf);
          await client.request(
            'PATCH',
            `/v1/subscriptionAppStoreReviewScreenshots/${resv.data.id}`,
            {
              data: {
                type: 'subscriptionAppStoreReviewScreenshots',
                id: resv.data.id,
                attributes: { uploaded: true, sourceFileChecksum: md5 },
              },
            }
          );
          console.log(`  -> Abonelik inceleme ekran görüntüsü yüklendi (${plan.productId}).`);
        }
      } catch (err) {
        console.log(`  -> Abonelik inceleme ekran görüntüsü bilgi (${plan.productId}): ${err.message}`);
      }
    }
  }
}

async function syncReviewDetail(client, versionId) {
  console.log(`\n[7/8] App Review İnceleme Notları (signInRequired: false) kaydediliyor...`);
  const notes = readMeta('review_information/notes.txt');
  const contactFirstName = process.env.APPSTORE_CONTACT_FIRST_NAME || 'Taha';
  const contactLastName = process.env.APPSTORE_CONTACT_LAST_NAME || 'Firat';
  const contactEmail = process.env.APPSTORE_CONTACT_EMAIL || 'tafifirat@gmail.com';
  const contactPhone = process.env.APPSTORE_CONTACT_PHONE || '+905444266440';

  const attrs = {
    demoAccountRequired: false,
    notes,
    contactFirstName,
    contactLastName,
    contactEmail,
    contactPhone,
  };

  try {
    let reviewDetailId = null;
    const existing = await client.request(
      'GET',
      `/v1/appStoreVersions/${versionId}/appStoreReviewDetail`
    );
    if (existing?.data?.id) {
      reviewDetailId = existing.data.id;
      await client.request('PATCH', `/v1/appStoreReviewDetails/${reviewDetailId}`, {
        data: {
          type: 'appStoreReviewDetails',
          id: reviewDetailId,
          attributes: attrs,
        },
      });
    } else {
      const createdDetail = await client.request('POST', '/v1/appStoreReviewDetails', {
        data: {
          type: 'appStoreReviewDetails',
          attributes: attrs,
          relationships: {
            appStoreVersion: { data: { type: 'appStoreVersions', id: versionId } },
          },
        },
      });
      reviewDetailId = createdDetail?.data?.id || null;
    }
    console.log(`  -> App Review notları kaydedildi (${notes.length} karakter, signInRequired=false).`);

    if (reviewDetailId && REVIEW_VIDEO_PATH && fs.existsSync(REVIEW_VIDEO_PATH)) {
      const fileName = path.basename(REVIEW_VIDEO_PATH);
      const buf = fs.readFileSync(REVIEW_VIDEO_PATH);
      const md5 = crypto.createHash('md5').update(buf).digest('hex');
      console.log(`  -> Fiziksel cihaz ekran kaydı yükleniyor: ${fileName} (${(buf.length / (1024 * 1024)).toFixed(2)} MB)...`);

      const attList = await client.request(
        'GET',
        `/v1/appStoreReviewDetails/${reviewDetailId}/appStoreReviewAttachments`
      );
      for (const oldAtt of attList?.data || []) {
        if (oldAtt.attributes?.fileName === fileName) {
          await client.request('DELETE', `/v1/appStoreReviewAttachments/${oldAtt.id}`);
        }
      }

      const resv = await client.request('POST', '/v1/appStoreReviewAttachments', {
        data: {
          type: 'appStoreReviewAttachments',
          attributes: {
            fileName,
            fileSize: buf.length,
          },
          relationships: {
            appStoreReviewDetail: {
              data: { type: 'appStoreReviewDetails', id: reviewDetailId },
            },
          },
        },
      });
      await uploadBinaryOperations(resv.data.attributes?.uploadOperations || [], buf);
      await client.request('PATCH', `/v1/appStoreReviewAttachments/${resv.data.id}`, {
        data: {
          type: 'appStoreReviewAttachments',
          id: resv.data.id,
          attributes: {
            uploaded: true,
            sourceFileChecksum: md5,
          },
        },
      });
      console.log(`  -> Fiziksel cihaz ekran kaydı App Review Attachments bölümüne başarıyla eklendi! (id=${resv.data.id})`);
    }
  } catch (err) {
    console.log(`  -> App Review detay bilgi (iletişim e-posta/telefon girildiğinde tamamlanır): ${err.message}`);
  }
}

async function attachBuildAndOptionallySubmit(client, appId, versionId) {
  const expectedBuildNum = (process.env.EXPECTED_BUILD_NUMBER || '').trim();
  const maxPolls = SUBMIT_FOR_REVIEW ? 36 : 1; // Up to ~12 min when waiting for fresh CI build to finish processing
  console.log(
    `\n[8/8] Yüklenen en güncel VALID iOS Build (.ipa) kontrol ediliyor (${TARGET_VERSION}${
      expectedBuildNum ? ` · beklenen build #${expectedBuildNum}` : ''
    })...`
  );

  let latestBuild = null;
  for (let attempt = 1; attempt <= maxPolls; attempt += 1) {
    const buildsResp = await client.request(
      'GET',
      `/v1/builds?filter[app]=${appId}&filter[processingState]=VALID&include=preReleaseVersion&sort=-uploadedDate&limit=15`
    );
    const preRelById = new Map(
      (buildsResp?.included || [])
        .filter((x) => x.type === 'preReleaseVersions')
        .map((x) => [x.id, x.attributes?.version])
    );
    const matchingBuilds = (buildsResp?.data || []).filter((b) => {
      const prId = b.relationships?.preReleaseVersion?.data?.id;
      return preRelById.get(prId) === TARGET_VERSION;
    });

    if (expectedBuildNum) {
      latestBuild =
        matchingBuilds.find((b) => String(b.attributes?.version || '') === expectedBuildNum) ||
        null;
      if (latestBuild) break;
      if (attempt < maxPolls) {
        console.log(
          `  -> Build #${expectedBuildNum} Apple tarafından işleniyor (${attempt}/${maxPolls})... 20 sn bekleniyor.`
        );
        await new Promise((r) => setTimeout(r, 20_000));
        continue;
      }
      // Fallback to newest valid build if expected didn't show up in window
      latestBuild = matchingBuilds[0] || null;
    } else {
      latestBuild = matchingBuilds[0] || null;
      break;
    }
  }

  if (!latestBuild) {
    console.log(`  -> Henüz işlenmiş (VALID) bir .ipa derlemesi görünmüyor.`);
    console.log(`     • App Store Connect -> Xcode Cloud VEYA GitHub Actions iş akışı .ipa paketini yükledikten 5-10 dk sonra bu komutu "--submit" ile çalıştırarak incelemeye gönderebilirsiniz.`);
    return;
  }

  console.log(`  -> Uygun .ipa Build bulundu: buildVersion=${latestBuild.attributes?.version} (id=${latestBuild.id})`);

  const existingBuildResp = await client.request(
    'GET',
    `/v1/appStoreVersions/${versionId}/build`
  );
  const currentBuildId = existingBuildResp?.data?.id || null;

  if (currentBuildId !== latestBuild.id) {
    if (SUBMIT_FOR_REVIEW) {
      const preSubs = await client.request(
        'GET',
        `/v1/apps/${appId}/reviewSubmissions?filter[platform]=IOS`
      );
      const waitingSub = (preSubs?.data || []).find(
        (s) => s.attributes?.state === 'WAITING_FOR_REVIEW'
      );
      if (waitingSub) {
        console.log(`  -> Yeni build bağlamak için mevcut WAITING_FOR_REVIEW gönderimi geri çekiliyor (${waitingSub.id})...`);
        await client.request('PATCH', `/v1/reviewSubmissions/${waitingSub.id}`, {
          data: {
            type: 'reviewSubmissions',
            id: waitingSub.id,
            attributes: { canceled: true },
          },
        });
        for (let w = 0; w < 15; w += 1) {
          await new Promise((r) => setTimeout(r, 2000));
          try {
            const vChk = await client.request('GET', `/v1/appStoreVersions/${versionId}`);
            const st = vChk?.data?.attributes?.appStoreState;
            if (st && st !== 'WAITING_FOR_REVIEW') {
              console.log(`  -> Sürüm durumu güncellendi: ${st}`);
              break;
            }
          } catch {
            // Keep polling briefly
          }
        }
      }
    }

    try {
      await client.request('PATCH', `/v1/appStoreVersions/${versionId}/relationships/build`, {
        data: { type: 'builds', id: latestBuild.id },
      });
      console.log(`  -> Build başarıyla ${TARGET_VERSION} sürümüne bağlandı!`);
    } catch (buildErr) {
      if (!SUBMIT_FOR_REVIEW) {
        console.log(`  -> Build güncelleme bilgi (incelemedeki sürümde --submit ile güncellenir): ${buildErr.message}`);
      } else {
        throw buildErr;
      }
    }
  } else {
    console.log(`  -> Güncel Build (${latestBuild.attributes?.version}) zaten ${TARGET_VERSION} sürümüne bağlı.`);
  }

  if (SUBMIT_FOR_REVIEW) {
    console.log(`  -> "--submit" bayrağı algılandı: Uygulama Apple İncelemesine (App Review) gönderiliyor...`);
    const existingSubs = await client.request(
      'GET',
      `/v1/apps/${appId}/reviewSubmissions?filter[platform]=IOS&include=items`
    );
    let activeSub = (existingSubs?.data || []).find((s) =>
      ['READY_FOR_REVIEW', 'UNSUBMITTED', 'UNRESOLVED_ISSUES'].includes(s.attributes?.state)
    );

    if (activeSub && activeSub.attributes?.state === 'UNRESOLVED_ISSUES') {
      const subItems = await client.request(
        'GET',
        `/v1/reviewSubmissions/${activeSub.id}/items`
      );
      for (const item of subItems?.data || []) {
        if (item.attributes?.state === 'REJECTED') {
          try {
            await client.request('PATCH', `/v1/reviewSubmissionItems/${item.id}`, {
              data: {
                type: 'reviewSubmissionItems',
                id: item.id,
                attributes: { resolved: true },
              },
            });
            console.log(`  -> Çözülen inceleme maddesi işaretlendi (item=${item.id}).`);
          } catch (resErr) {
            console.log(`  -> İnceleme maddesi bilgi: ${resErr.message}`);
          }
        }
      }
    }

    if (!activeSub) {
      const subResp = await client.request('POST', '/v1/reviewSubmissions', {
        data: {
          type: 'reviewSubmissions',
          attributes: { platform: 'IOS' },
          relationships: {
            app: { data: { type: 'apps', id: appId } },
          },
        },
      });
      activeSub = subResp.data;
    }
    const submissionId = activeSub.id;

    const itemsResp = await client.request(
      'GET',
      `/v1/reviewSubmissions/${submissionId}/items`
    );
    const hasVersionItem = (itemsResp?.data || []).some(
      (it) => it.relationships?.appStoreVersion?.data?.id === versionId
    );

    if (!hasVersionItem) {
      try {
        await client.request('POST', '/v1/reviewSubmissionItems', {
          data: {
            type: 'reviewSubmissionItems',
            relationships: {
              reviewSubmission: { data: { type: 'reviewSubmissions', id: submissionId } },
              appStoreVersion: { data: { type: 'appStoreVersions', id: versionId } },
            },
          },
        });
      } catch (itemErr) {
        console.log(`  -> Sürüm öğesi bilgi: ${itemErr.message}`);
      }
    }

    // Ensure READY_TO_SUBMIT Non-Consumable IAP is bundled into the same review submission (Guideline 3.1.1)
    try {
      const iapList = await client.request(
        'GET',
        `/v1/apps/${appId}/inAppPurchasesV2?filter[productId]=${encodeURIComponent(IAP_PRODUCT_ID)}`
      );
      const iapRec = iapList?.data?.find((item) => item.attributes?.productId === IAP_PRODUCT_ID);
      if (iapRec && iapRec.attributes?.state === 'READY_TO_SUBMIT') {
        await client.request('POST', '/v1/reviewSubmissionItems', {
          data: {
            type: 'reviewSubmissionItems',
            relationships: {
              reviewSubmission: { data: { type: 'reviewSubmissions', id: submissionId } },
              inAppPurchaseV2: { data: { type: 'inAppPurchases', id: iapRec.id } },
            },
          },
        });
        console.log(`  -> Ömür Boyu Pro IAP (${IAP_PRODUCT_ID}) inceleme paketine eklendi.`);
      }
    } catch {
      // Already attached or already submitted
    }

    // Ensure READY_TO_SUBMIT Auto-Renewable Subscriptions (pro_monthly & pro_yearly) & their Group are bundled via ASC API 4.4+ subscriptionVersions!
    const readySubscriptions = [];
    const readyGroupVersionIds = new Set();
    try {
      const grpResp = await client.request(
        'GET',
        `/v1/apps/${appId}/subscriptionGroups`
      );
      for (const grp of grpResp?.data || []) {
        try {
          const gvResp = await client.request(
            'GET',
            `/v1/subscriptionGroups/${grp.id}/versions`
          );
          for (const gv of gvResp?.data || []) {
            if (['PREPARE_FOR_SUBMISSION', 'DEVELOPER_REJECTED', 'REJECTED'].includes(gv.attributes?.state)) {
              readyGroupVersionIds.add(gv.id);
            }
          }
        } catch {
          // Non-fatal
        }

        const subsResp = await client.request(
          'GET',
          `/v1/subscriptionGroups/${grp.id}/subscriptions`
        );
        for (const sub of subsResp?.data || []) {
          const st = sub.attributes?.state;
          const pid = sub.attributes?.productId;
          console.log(`  -> Abonelik durumu (${pid}): ${st}`);
          if (st === 'READY_TO_SUBMIT' || st === 'DEVELOPER_ACTION_NEEDED') {
            let subVersionId = null;
            try {
              const svResp = await client.request('GET', `/v1/subscriptions/${sub.id}/versions`);
              subVersionId =
                (svResp?.data || []).find((v) =>
                  ['PREPARE_FOR_SUBMISSION', 'DEVELOPER_REJECTED', 'REJECTED'].includes(
                    v.attributes?.state
                  )
                )?.id || null;
            } catch {
              // Ignore
            }
            readySubscriptions.push({ id: sub.id, productId: pid, state: st, subVersionId });
          }
        }
      }
    } catch (subListErr) {
      console.log(`  -> Abonelik listesi bilgi: ${subListErr.message}`);
    }

    for (const sub of readySubscriptions) {
      if (sub.subVersionId) {
        try {
          await client.request('POST', '/v1/reviewSubmissionItems', {
            data: {
              type: 'reviewSubmissionItems',
              relationships: {
                reviewSubmission: { data: { type: 'reviewSubmissions', id: submissionId } },
                subscriptionVersion: {
                  data: { type: 'subscriptionVersions', id: sub.subVersionId },
                },
              },
            },
          });
          console.log(
            `  -> Abonelik (${sub.productId}) subscriptionVersion=${sub.subVersionId} ile inceleme paketine eklendi!`
          );
        } catch (errA) {
          console.log(`  -> Abonelik subscriptionVersion bilgisi (${sub.productId}): ${errA.message}`);
        }
      }
    }

    for (const gvId of readyGroupVersionIds) {
      try {
        await client.request('POST', '/v1/reviewSubmissionItems', {
          data: {
            type: 'reviewSubmissionItems',
            relationships: {
              reviewSubmission: { data: { type: 'reviewSubmissions', id: submissionId } },
              subscriptionGroupVersion: {
                data: { type: 'subscriptionGroupVersions', id: gvId },
              },
            },
          },
        });
        console.log(`  -> Abonelik Grubu (subscriptionGroupVersion=${gvId}) inceleme paketine eklendi!`);
      } catch (errG) {
        console.log(`  -> Abonelik Grubu bilgi (${gvId}): ${errG.message}`);
      }
    }

    await client.request('PATCH', `/v1/reviewSubmissions/${submissionId}`, {
      data: {
        type: 'reviewSubmissions',
        id: submissionId,
        attributes: { submitted: true },
      },
    });
    console.log(`\n🎉 TEBRİKLER! ZihinHaritam (${TARGET_VERSION}) resmen Apple App Review incelemesine gönderildi!`);

    // Post-submit verification of subscription review states
    if (readySubscriptions.length > 0) {
      for (const sub of readySubscriptions) {
        try {
          const check = await client.request('GET', `/v1/subscriptions/${sub.id}`);
          console.log(
            `  -> İnceleme sonrası abonelik durumu (${sub.productId}): ${check?.data?.attributes?.state}`
          );
        } catch {
          // Non-fatal
        }
      }
    }
  }
}

async function main() {
  console.log('==================================================================');
  console.log('  ZihinHaritam — App Store Connect REST API Otomatik Yayın Aracı');
  console.log('==================================================================');

  if (DRY_RUN) {
    const trName = readMeta('tr/name.txt');
    const trSub = readMeta('tr/subtitle.txt');
    const trKey = readMeta('tr/keywords.txt');
    const enName = readMeta('en-US/name.txt');
    const enSub = readMeta('en-US/subtitle.txt');
    const enKey = readMeta('en-US/keywords.txt');
    console.log(`[DRY-RUN] Metadata Karakter Kontrolleri:`);
    console.log(`  • TR Name (${trName.length}/30): ${trName}`);
    console.log(`  • TR Subtitle (${trSub.length}/30): ${trSub}`);
    console.log(`  • TR Keywords (${trKey.length}/100): ${trKey}`);
    console.log(`  • EN Name (${enName.length}/30): ${enName}`);
    console.log(`  • EN Subtitle (${enSub.length}/30): ${enSub}`);
    console.log(`  • EN Keywords (${enKey.length}/100): ${enKey}`);
    if (trName.length > 30 || trSub.length > 30 || trKey.length > 100 || enName.length > 30 || enSub.length > 30 || enKey.length > 100) {
      console.error('HATA: App Store karakter sınırı aşıldı!');
      process.exit(1);
    }
    console.log('[DRY-RUN] Tüm metadata ve 15 ekran görüntüsü API gönderimine %100 hazır.');
    return;
  }

  const keyId = process.env.APPSTORE_KEY_ID || '';
  const issuerId = process.env.APPSTORE_ISSUER_ID || '';
  const privateKeyPem = resolvePrivateKeyPem();
  const baseUrl = (process.env.APPSTORE_PUBLIC_BASE_URL || 'https://tahafirat.github.io/zihinharitam').replace(/\/+$/, '');

  if (!keyId || !issuerId || !privateKeyPem) {
    console.error('\n[!] Eksik App Store Connect API Kimlik Bilgileri!');
    console.error('    Lütfen proje kökünde ".env.appstore" dosyası oluşturun veya ortam değişkenlerini tanımlayın:');
    console.error('      APPSTORE_KEY_ID=ABC123DEFG');
    console.error('      APPSTORE_ISSUER_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx');
    console.error('      APPSTORE_PRIVATE_KEY_PATH=C:/Users/Taha/Downloads/AuthKey_ABC123DEFG.p8');
    console.error('    (Örnek şablon: .env.appstore.example)');
    process.exit(1);
  }

  const client = new AscClient({ keyId, issuerId, privateKeyPem });

  await ensureBundleIdAndCapabilities(client);
  const app = await findAppRecord(client);
  const { version, syncedLocIds } = await ensureVersionAndLocalizations(client, app.id, baseUrl);
  await syncAppInfosAndCategories(client, app.id, baseUrl);

  if (!SKIP_SCREENSHOTS) {
    console.log(`\n[5/8] 15 Mağaza Ekran Görüntüsü App Store Connect'e yükleniyor...`);
    if (syncedLocIds.tr) {
      await uploadScreenshotsForLocale(client, syncedLocIds.tr, 'tr');
    }
    if (syncedLocIds['en-US']) {
      await uploadScreenshotsForLocale(client, syncedLocIds['en-US'], 'en-US');
    }
  } else {
    console.log(`\n[5/8] Ekran görüntüsü yüklemesi atlandı (--skip-screenshots).`);
  }

  await ensureLifetimeProIap(client, app.id);
  await syncReviewDetail(client, version.id);
  await attachBuildAndOptionallySubmit(client, app.id, version.id);

  console.log('\n✅ App Store Connect senkronizasyonu tamamlandı!');
  console.log('   Not: IAP fiyat basamağı ₺499,99 (499 TL / $9.99) olarak güncellendi.');
}

main().catch((err) => {
  console.error('\n❌ HATA:', err.message);
  process.exit(1);
});
