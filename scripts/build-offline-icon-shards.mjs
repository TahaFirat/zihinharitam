import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { enrichEnglishIconTokensWithTurkish } from '../src/core/visuals/taxonomyData.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const OUT_DIR = path.join(ROOT_DIR, 'public', 'offline-packs');
const SHARDS_DIR = path.join(OUT_DIR, 'shards');
const MANIFEST_PATH = path.join(OUT_DIR, 'search-manifest.json');
const HASH_PATH = path.join(OUT_DIR, '.build-hash');

const SHARD_COUNT = 24;

const PACK_CONFIGS = [
  { prefix: 'fluent-emoji-flat', defaultMultiColor: true, qualityBoost: 1.32 },
  { prefix: 'fluent-color', defaultMultiColor: true, qualityBoost: 1.28 },
  { prefix: 'openmoji', defaultMultiColor: true, qualityBoost: 1.25 },
  { prefix: 'icon-park', defaultMultiColor: true, qualityBoost: 1.22 },
  { prefix: 'flat-color-icons', defaultMultiColor: true, qualityBoost: 1.22 },
  { prefix: 'logos', defaultMultiColor: true, qualityBoost: 1.15 },
  { prefix: 'devicon', defaultMultiColor: true, qualityBoost: 1.16 },
  { prefix: 'skill-icons', defaultMultiColor: true, qualityBoost: 1.16 },
  { prefix: 'healthicons', defaultMultiColor: false, qualityBoost: 1.26 },
  { prefix: 'medical-icon', defaultMultiColor: false, qualityBoost: 1.24 },
  { prefix: 'game-icons', defaultMultiColor: false, qualityBoost: 1.20 },
  { prefix: 'ph', defaultMultiColor: false, qualityBoost: 1.12 },
  { prefix: 'carbon', defaultMultiColor: false, qualityBoost: 1.12 },
  { prefix: 'tabler', defaultMultiColor: false, qualityBoost: 1.08 },
];

const UI_NOISE_REGEX =
  /^(arrow|arrows|chevron|chevrons|caret|corner|align|indent|outdent|justification|sort-alpha|sort-ascending|sort-descending|letter-[a-z0-9]|number-[0-9]|alphabet|digit|square-letter|circle-letter|hexagon-letter|octagon-letter|pentagon-letter|roman-numeral|border-|layout-sidebar|layout-navbar|layout-bottombar|grip-|dots-vertical|dots-horizontal|minus|plus|equal|slash|backslash|tallymark|[0-9]+|[a-z])$/i;

const SKIN_TONE_SUFFIX =
  /-(light|medium-light|medium|medium-dark|dark)-skin-tone$/i;

const CHROMATIC_COLOR_REGEX =
  /#(?!(?:000|000000|fff|ffffff|111|111111|222|222222)\b)[0-9a-f]{3,8}\b|url\(#|rgb\((?!0,\s*0,\s*0)/i;

function computeInputsHash() {
  const h = crypto.createHash('sha256');
  for (const rel of [
    'scripts/build-offline-icon-shards.mjs',
    'src/core/visuals/taxonomyData.js',
    'src/core/visuals/taxonomyBankExtra.js',
  ]) {
    const full = path.join(ROOT_DIR, rel);
    if (fs.existsSync(full)) {
      h.update(fs.readFileSync(full));
    }
  }
  h.update(JSON.stringify(PACK_CONFIGS));
  return h.digest('hex').slice(0, 24);
}

function shardsUpToDate(expectedHash) {
  if (!fs.existsSync(HASH_PATH) || !fs.existsSync(MANIFEST_PATH)) return false;
  const savedHash = fs.readFileSync(HASH_PATH, 'utf8').trim();
  if (savedHash !== expectedHash) return false;
  for (let i = 0; i < SHARD_COUNT; i++) {
    const sp = path.join(SHARDS_DIR, `shard-${String(i).padStart(2, '0')}.json`);
    if (!fs.existsSync(sp)) return false;
  }
  return true;
}

function shouldKeepIcon(packPrefix, iconName, allKeysSet) {
  if (!iconName || iconName.length < 2) return false;
  if (UI_NOISE_REGEX.test(iconName)) return false;

  // Emoji skin-tone deduplication
  if (
    (packPrefix === 'fluent-emoji-flat' || packPrefix === 'openmoji') &&
    SKIN_TONE_SUFFIX.test(iconName)
  ) {
    const base = iconName.replace(SKIN_TONE_SUFFIX, '');
    if (allKeysSet.has(base)) return false;
  }

  if (
    packPrefix === 'fluent-emoji-flat' &&
    /-(light|medium-light|medium|medium-dark|dark)$/i.test(iconName) &&
    !/traffic-light|flashlight|sunlight|police-car-light|candle-light|light-bulb/i.test(iconName)
  ) {
    const base = iconName.replace(/-(light|medium-light|medium|medium-dark|dark)$/i, '');
    if (allKeysSet.has(`${base}-default`) || allKeysSet.has(base)) return false;
  }

  // Regional flag hex codes or PUA noise in openmoji
  if (packPrefix === 'openmoji' && /^(flag-|regional-indicator|keycap-|tag-)/i.test(iconName)) {
    return false;
  }

  // Fluent-color has -16, -20, -24, -28, -32, -48 size clones — keep single best size (24 > 32 > 20 > 28 > 48 > 16)
  if (packPrefix === 'fluent-color') {
    const m = iconName.match(/^(.*)-(16|20|24|28|32|48)$/);
    if (m) {
      const stem = m[1];
      const size = m[2];
      const prefOrder = ['24', '32', '28', '20', '48', '16'];
      for (const pref of prefOrder) {
        if (pref === size) return true;
        if (allKeysSet.has(`${stem}-${pref}`)) return false;
      }
    }
  }

  // Devicon: skip -wordmark / -plain-wordmark when clean icon exists
  if (packPrefix === 'devicon') {
    if (iconName.endsWith('-wordmark')) return false;
    if (iconName.endsWith('-plain')) {
      const orig = iconName.replace(/-plain$/, '-original');
      if (allKeysSet.has(orig)) return false;
    }
  }

  // Skill-icons: skip -dark when -light exists (avoid 2x identical badges)
  if (packPrefix === 'skill-icons' && iconName.endsWith('-dark')) {
    const light = iconName.replace(/-dark$/, '-light');
    if (allKeysSet.has(light)) return false;
  }

  // Healthicons: skip `-negative` inverted boxes & single-character icons
  if (packPrefix === 'healthicons') {
    if (iconName.endsWith('-negative') || iconName.startsWith('negative-')) return false;
    if (iconName.endsWith('-outline')) {
      const filled = iconName.replace(/-outline$/, '');
      if (allKeysSet.has(filled)) return false;
    }
    if (/^(alphabet|number|character|ui-|blood-a-|blood-b-|blood-ab-|blood-o-)/i.test(iconName) && iconName.length <= 4) {
      return false;
    }
  }

  // Phosphor (`ph`): keep `-duotone` (looks richest in Duotone Vector Stickerizer!), fallback to base only if no `-duotone`
  if (packPrefix === 'ph') {
    if (/(?:-bold|-fill|-light|-thin)$/.test(iconName)) return false;
    if (!iconName.endsWith('-duotone')) {
      if (allKeysSet.has(`${iconName}-duotone`)) return false;
    }
  }

  // Tabler: skip `-filled` / `-off` noise variants to keep distinct concepts crisp
  if (packPrefix === 'tabler') {
    if (/(?:-filled|-off)$/.test(iconName)) return false;
    if (/^(zodiac-)/i.test(iconName)) return false;
  }

  // Carbon: skip pure UI/table/Watson internal glyph noise
  if (packPrefix === 'carbon') {
    if (/^(text-|table-|row-|column-|panel-|watson-health-3d-cursor|number-)/i.test(iconName)) {
      return false;
    }
  }

  return true;
}

function cleanIconDisplayName(rawName) {
  return rawName
    .replace(/-(duotone|original|plain|light|dark|16|20|24|28|32|48)$/i, '')
    .replace(/[-_]+/g, ' ')
    .trim();
}

function buildShards() {
  const t0 = performance.now();
  const expectedHash = computeInputsHash();

  if (!process.argv.includes('--force') && shardsUpToDate(expectedHash)) {
    const dt = (performance.now() - t0).toFixed(1);
    console.log(`[offline-packs] 25,000+ offline icon shards already up-to-date (${dt}ms).`);
    return;
  }

  fs.mkdirSync(SHARDS_DIR, { recursive: true });

  const shardMaps = Array.from({ length: SHARD_COUNT }, () => ({}));
  const manifestItems = [];
  let freeTierCounter = 0;
  const TARGET_FREE_STARTER_CAP = 1520;

  for (const cfg of PACK_CONFIGS) {
    const jsonPath = path.join(
      ROOT_DIR,
      'node_modules',
      '@iconify-json',
      cfg.prefix,
      'icons.json'
    );
    if (!fs.existsSync(jsonPath)) {
      console.warn(`[offline-packs] Missing pack: ${cfg.prefix}`);
      continue;
    }

    const packJson = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    const defaultW = packJson.width || 24;
    const defaultH = packJson.height || 24;
    const iconsObj = packJson.icons || {};

    // Build reverse category map if pack provides `categories`
    const iconCategoryTags = new Map();
    if (packJson.categories && typeof packJson.categories === 'object') {
      for (const [catName, iconList] of Object.entries(packJson.categories)) {
        if (!Array.isArray(iconList)) continue;
        const catTokens = catName
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, ' ')
          .trim();
        for (const ic of iconList) {
          iconCategoryTags.set(ic, catTokens);
        }
      }
    }

    const allKeys = Object.keys(iconsObj);
    const allKeysSet = new Set(allKeys);
    let keptInPack = 0;

    for (const iconKey of allKeys) {
      if (!shouldKeepIcon(cfg.prefix, iconKey, allKeysSet)) continue;
      const iconData = iconsObj[iconKey];
      if (!iconData || !iconData.body) continue;

      const body = iconData.body;
      // Skip degenerate tiny paths (e.g. single dot/line < 38 chars)
      if (body.length < 38) continue;

      const w = iconData.width || defaultW;
      const h = iconData.height || defaultH;
      const left = iconData.left || 0;
      const top = iconData.top || 0;
      const viewBox = `${left} ${top} ${w} ${h}`;

      // Verify true multi-color vs monochrome (`icon-park` has some pure `#000` stroke icons!)
      const isMultiColor = cfg.defaultMultiColor
        ? CHROMATIC_COLOR_REGEX.test(body)
        : false;

      const cleanName = cleanIconDisplayName(iconKey);
      const enTokens = cleanName.split(/\s+/).filter((t) => t.length >= 2);
      const catStr = iconCategoryTags.get(iconKey) || '';
      const catTokens = catStr ? catStr.split(/\s+/).filter((t) => t.length >= 2) : [];

      const allEnTokens = Array.from(new Set([...enTokens, ...catTokens]));
      const { trTags, domain } = enrichEnglishIconTokensWithTurkish(allEnTokens, cfg.prefix);

      const fullId = `${cfg.prefix}:${iconKey}`;
      const shardId = manifestItems.length % SHARD_COUNT;

      // V4 Freemium Tier Assignment:
      // ~1,520 general starter colorful icons (`tier: 'free'`), 23,600+ specialist/academic/medical/system-design/duotone (`tier: 'pro'`)
      const isSpecialistPack =
        cfg.prefix === 'healthicons' ||
        cfg.prefix === 'medical-icon' ||
        cfg.prefix === 'carbon' ||
        cfg.prefix === 'devicon' ||
        cfg.prefix === 'skill-icons' ||
        cfg.prefix === 'logos' ||
        cfg.prefix === 'ph' ||
        cfg.prefix === 'game-icons' ||
        cfg.prefix === 'tabler';

      const isStarterCandidate =
        !isSpecialistPack &&
        isMultiColor &&
        (cfg.prefix === 'flat-color-icons' ||
          (cfg.prefix === 'fluent-emoji-flat' && keptInPack % 2 === 0) ||
          (cfg.prefix === 'fluent-color' && keptInPack % 2 === 0) ||
          (cfg.prefix === 'openmoji' && domain === 'general' && keptInPack % 8 === 0));

      let tier = 'pro';
      if (isStarterCandidate && freeTierCounter < TARGET_FREE_STARTER_CAP) {
        tier = 'free';
        freeTierCounter++;
      }

      shardMaps[shardId][fullId] = {
        v: viewBox,
        b: body,
        m: isMultiColor ? 1 : 0,
      };

      manifestItems.push({
        id: fullId,
        pack: cfg.prefix,
        name: cleanName,
        trTags,
        enTags: allEnTokens.join(' '),
        domain,
        isMultiColor,
        tier,
        shardId,
      });

      keptInPack++;
    }

    console.log(
      `[offline-packs] ${cfg.prefix.padEnd(20)} -> kept ${String(keptInPack).padStart(5)} icons`
    );
  }

  // Write 24 shard JSON files
  for (let i = 0; i < SHARD_COUNT; i++) {
    const shardFile = path.join(SHARDS_DIR, `shard-${String(i).padStart(2, '0')}.json`);
    fs.writeFileSync(shardFile, JSON.stringify(shardMaps[i]));
  }

  // Write compact search-manifest.json
  const manifestPayload = {
    version: 4,
    generatedAt: new Date().toISOString(),
    totalIcons: manifestItems.length,
    freeIcons: freeTierCounter,
    proIcons: manifestItems.length - freeTierCounter,
    shardCount: SHARD_COUNT,
    items: manifestItems,
  };
  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifestPayload));
  fs.writeFileSync(HASH_PATH, expectedHash);

  const elapsed = ((performance.now() - t0) / 1000).toFixed(2);
  const manifestSizeMb = (fs.statSync(MANIFEST_PATH).size / (1024 * 1024)).toFixed(2);
  console.log(
    `[offline-packs] SUCCESS: Compiled ${manifestItems.length} offline icons (${freeTierCounter} free starter + ${manifestItems.length - freeTierCounter} Pro specialist) across ${SHARD_COUNT} shards (manifest: ${manifestSizeMb} MB) in ${elapsed}s!`
  );
}

buildShards();
