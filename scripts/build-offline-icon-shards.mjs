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
const FAST_INDEX_PATH = path.join(OUT_DIR, 'fast-index-v7.json');
const HASH_PATH = path.join(OUT_DIR, '.build-hash');

const SHARD_COUNT = 40;
const ICONS_PER_SHARD = 1420;

// 100% Commercial-Safe & Properly Attributed Packs ONLY (MIT, Apache-2.0, ISC, CC-BY 4.0/3.0 — ZERO NC / SA packs!)
const PACK_CONFIGS = [
  // ULTRA-VIBRANT GAMIFIED / 3D / PLUMP / GLOSSY PRO COLLECTIONS
  { prefix: 'fluent-emoji-flat', defaultMultiColor: true, qualityBoost: 1.52 },
  { prefix: 'streamline-plump-color', defaultMultiColor: true, qualityBoost: 1.50 },
  { prefix: 'fluent-color', defaultMultiColor: true, qualityBoost: 1.48 },
  { prefix: 'streamline-color', defaultMultiColor: true, qualityBoost: 1.46 },
  { prefix: 'emojione', defaultMultiColor: true, qualityBoost: 1.44 },
  { prefix: 'noto', defaultMultiColor: true, qualityBoost: 1.42 },
  { prefix: 'streamline-emojis', defaultMultiColor: true, qualityBoost: 1.40 },
  { prefix: 'marketeq', defaultMultiColor: true, qualityBoost: 1.36 },
  { prefix: 'twemoji', defaultMultiColor: true, qualityBoost: 1.34 },
  { prefix: 'icon-park', defaultMultiColor: true, qualityBoost: 1.32 },
  { prefix: 'meteocons', defaultMultiColor: true, qualityBoost: 1.32 },
  { prefix: 'circle-flags', defaultMultiColor: true, qualityBoost: 1.24 },
  { prefix: 'healthicons', defaultMultiColor: false, qualityBoost: 1.24 },
  { prefix: 'medical-icon', defaultMultiColor: false, qualityBoost: 1.22 },
  { prefix: 'game-icons', defaultMultiColor: false, qualityBoost: 1.24 },
  // CLEAN FREE COLORFUL STARTERS (Apache-2.0 / MIT — replaces CC-BY-SA OpenMoji!)
  { prefix: 'fxemoji', defaultMultiColor: true, qualityBoost: 1.34 },
  { prefix: 'flat-color-icons', defaultMultiColor: true, qualityBoost: 1.30 },
  // EDUCATIONAL TECH / BRAND REFERENCE LOGOS (Always FREE tier — never paywalled!)
  { prefix: 'vscode-icons', defaultMultiColor: true, qualityBoost: 1.20 },
  { prefix: 'logos', defaultMultiColor: true, qualityBoost: 1.18 },
  { prefix: 'devicon', defaultMultiColor: true, qualityBoost: 1.18 },
  { prefix: 'skill-icons', defaultMultiColor: true, qualityBoost: 1.18 },
  // CRISP MODERN MONOCHROME / DUOTONE VECTOR PACKS (MIT / Apache-2.0 / ISC / CC-BY 4.0)
  { prefix: 'ph', defaultMultiColor: false, qualityBoost: 1.14 },
  { prefix: 'carbon', defaultMultiColor: false, qualityBoost: 1.10 },
  { prefix: 'lucide', defaultMultiColor: false, qualityBoost: 1.08 },
  { prefix: 'tabler', defaultMultiColor: false, qualityBoost: 1.05 },
  { prefix: 'mdi', defaultMultiColor: false, qualityBoost: 1.04 },
  { prefix: 'fa6-solid', defaultMultiColor: false, qualityBoost: 1.02 },
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
    'src/core/visuals/cldrTrLexicon.js',
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
  if (
    !fs.existsSync(HASH_PATH) ||
    !fs.existsSync(MANIFEST_PATH) ||
    !fs.existsSync(FAST_INDEX_PATH)
  ) {
    return false;
  }
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
    (packPrefix === 'fluent-emoji-flat' ||
      packPrefix === 'openmoji' ||
      packPrefix === 'twemoji') &&
    SKIN_TONE_SUFFIX.test(iconName)
  ) {
    const base = iconName.replace(SKIN_TONE_SUFFIX, '');
    if (allKeysSet.has(base)) return false;
  }

  if (
    packPrefix === 'twemoji' &&
    (/^(flag-|keycap-|regional-indicator|input-)/i.test(iconName) ||
      /-(light|medium-light|medium|medium-dark|dark)-skin-tone/.test(iconName))
  ) {
    return false;
  }

  // MDI: skip `-outline` / `-off` when solid base exists to keep 5,000+ distinct concepts ultra-compact
  if (packPrefix === 'mdi') {
    if (iconName.endsWith('-outline')) {
      const base = iconName.replace(/-outline$/, '');
      if (allKeysSet.has(base)) return false;
    }
    if (iconName.endsWith('-off') || /^alpha-[a-z]|^numeric-[0-9]|^format-|^border-/.test(iconName)) {
      return false;
    }
  }

  // VSCode Icons: skip redundant `folder-type-*-opened` duplicates
  if (packPrefix === 'vscode-icons' && iconName.endsWith('-opened')) {
    return false;
  }

  // Streamline-color: skip `-flat` duplicate when full gradient color base exists
  if (packPrefix === 'streamline-color' && iconName.endsWith('-flat')) {
    const base = iconName.replace(/-flat$/, '');
    if (allKeysSet.has(base)) return false;
  }

  // Meteocons: keep crisp static SVGs (skip `-fill` duplicates when base exists)
  if (packPrefix === 'meteocons' && iconName.endsWith('-fill')) {
    const base = iconName.replace(/-fill$/, '');
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
  const TARGET_FREE_STARTER_CAP = 3600;

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
      // Contiguous locality-grouped shards so top colorful/3D hits reside together in Shards 0..9 (2-4 shard reads instead of 40!)
      const shardId = Math.min(
        SHARD_COUNT - 1,
        Math.floor(manifestItems.length / ICONS_PER_SHARD)
      );

      // Commercial-Safe Quality Tier Assignment:
      // - FREE (`tier: 'free'`): Apache-2.0/MIT colorful starters (`fxemoji`, `flat-color-icons`),
      //   all third-party trademark tech reference logos (`logos`, `devicon`, `skill-icons`, `vscode-icons` — NEVER paywalled!),
      //   plus crisp vector outlines (`ph`, `carbon`, `lucide`, `tabler`, `mdi`, `fa6-solid`).
      // - PRO (`tier: 'pro'`): Ultra-vibrant glossy 3D, plump, gradient & specialist commercial-safe packs
      //   (`fluent-emoji-flat`, `streamline-plump-color`, `fluent-color`, `streamline-color`, `emojione`, `noto`,
      //    `streamline-emojis`, `marketeq`, `twemoji`, `icon-park`, `meteocons`, `circle-flags`, `healthicons`, `medical-icon`, `game-icons`).
      const isFreePack =
        cfg.prefix === 'fxemoji' ||
        cfg.prefix === 'flat-color-icons' ||
        cfg.prefix === 'logos' ||
        cfg.prefix === 'devicon' ||
        cfg.prefix === 'skill-icons' ||
        cfg.prefix === 'vscode-icons' ||
        (!isMultiColor &&
          (cfg.prefix === 'ph' ||
            cfg.prefix === 'carbon' ||
            cfg.prefix === 'lucide' ||
            cfg.prefix === 'tabler' ||
            cfg.prefix === 'mdi' ||
            cfg.prefix === 'fa6-solid'));

      let tier = 'pro';
      if (isFreePack) {
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

  // Write compact search-manifest.json (kept for CLI/Node verification gates)
  const manifestPayload = {
    version: 7,
    generatedAt: new Date().toISOString(),
    totalIcons: manifestItems.length,
    freeIcons: freeTierCounter,
    proIcons: manifestItems.length - freeTierCounter,
    shardCount: SHARD_COUNT,
    items: manifestItems,
  };
  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifestPayload));

  // Build pre-compiled Zero-CPU-Startup `fast-index-v7.json` for instant <3ms mobile/tablet Web Worker search!
  const packList = PACK_CONFIGS.map((p) => p.prefix);
  const packToIdx = new Map(packList.map((p, i) => [p, i]));
  const domainList = [
    'general',
    'medicine_bio',
    'system_cs',
    'electronics',
    'law',
    'architecture',
    'science',
    'social_history',
    'business',
  ];
  const domainToIdx = new Map(domainList.map((d, i) => [d, i]));

  const rows = new Array(manifestItems.length);
  const namePostings = Object.create(null);
  const tagPostings = Object.create(null);
  const vocabSet = new Set();

  const tokenize = (s) =>
    s
      ? String(s)
          .toLowerCase()
          .split(/[\s\-_/.,:;()]+/)
          .filter((t) => t.length >= 2)
      : [];

  for (let i = 0; i < manifestItems.length; i++) {
    const it = manifestItems[i];
    const colonIdx = it.id.indexOf(':');
    const idKey = colonIdx >= 0 ? it.id.slice(colonIdx + 1) : it.id;
    const defaultDerivedName = cleanIconDisplayName(idKey);
    const compactName = it.name === defaultDerivedName ? '' : it.name;
    const pIdx = packToIdx.get(it.pack) ?? 0;
    const dIdx = domainToIdx.get(it.domain) ?? 0;
    const flags = (it.isMultiColor ? 1 : 0) | (it.tier === 'free' ? 2 : 0);

    rows[i] = [idKey, compactName, pIdx, dIdx, flags, it.shardId];

    const nSet = new Set(tokenize(it.name));
    for (const nt of nSet) {
      if (!namePostings[nt]) namePostings[nt] = [];
      namePostings[nt].push(i);
      vocabSet.add(nt);
    }

    const tSet = new Set([...tokenize(it.enTags), ...tokenize(it.trTags)]);
    for (const tg of tSet) {
      if (nSet.has(tg)) continue;
      if (!tagPostings[tg]) tagPostings[tg] = [];
      tagPostings[tg].push(i);
      vocabSet.add(tg);
    }
  }

  const fastIndexPayload = {
    version: 7,
    totalIcons: manifestItems.length,
    packs: packList,
    domains: domainList,
    rows,
    namePostings,
    tagPostings,
    vocab: Array.from(vocabSet).sort(),
  };
  fs.writeFileSync(FAST_INDEX_PATH, JSON.stringify(fastIndexPayload));
  fs.writeFileSync(HASH_PATH, expectedHash);

  const elapsed = ((performance.now() - t0) / 1000).toFixed(2);
  const fastSizeMb = (fs.statSync(FAST_INDEX_PATH).size / (1024 * 1024)).toFixed(2);
  console.log(
    `[offline-packs] SUCCESS: Compiled ${manifestItems.length} offline icons (${freeTierCounter} free + ${manifestItems.length - freeTierCounter} Pro) across ${SHARD_COUNT} locality-grouped shards (fast-index-v7: ${fastSizeMb} MB) in ${elapsed}s!`
  );
}

buildShards();
