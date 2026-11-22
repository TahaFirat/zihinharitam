import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const OUT_FILE = path.join(ROOT_DIR, 'src', 'core', 'visuals', 'cldrTrLexicon.js');

const CLDR_TR_URL =
  'https://raw.githubusercontent.com/unicode-org/cldr-json/main/cldr-json/cldr-annotations-full/annotations/tr/annotations.json';
const CLDR_EN_URL =
  'https://raw.githubusercontent.com/unicode-org/cldr-json/main/cldr-json/cldr-annotations-full/annotations/en/annotations.json';

const TR_CHAR_MAP = {
  ç: 'c', Ç: 'c', ğ: 'g', Ğ: 'g', ı: 'i', İ: 'i', I: 'i',
  ö: 'o', Ö: 'o', ş: 's', Ş: 's', ü: 'u', Ü: 'u',
};

function normTr(raw) {
  return String(raw || '')
    .replace(/[çÇğĞıİIöÖşŞüÜ]/g, (c) => TR_CHAR_MAP[c] || c)
    .toLowerCase()
    .replace(/[^a-z0-9\s-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normEnIconSlug(tts) {
  return String(tts || '')
    .toLowerCase()
    .replace(/['’.,:()!?]/g, '')
    .replace(/[^a-z0-9\s-]+/g, ' ')
    .trim()
    .replace(/\s+/g, '-');
}

// Generic category words in CLDR Turkish annotations that are too broad to map to one specific emoji
const TOO_BROAD_TR = new Set([
  'yuz', 'ifade', 'yuz ifadesi', 'insan', 'kisi', 'hayvan', 'gida', 'yiyecek',
  'icecek', 'giyim', 'nesne', 'esya', 'isaret', 'sembol', 'dugme', 'sekil',
  'renk', 'seyahat', 'yer', 'bina', 'arac', 'spor', 'oyun', 'etkinlik',
  'el', 'parmak', 'jest', 'hareket', 'ok', 'kirmizi', 'mavi', 'yesil',
  'sari', 'siyah', 'beyaz', 'turuncu', 'mor', 'pembe', 'kahverengi', 'gri',
  'kucuk', 'buyuk', 'yeni', 'eski', 'iyi', 'kotu', 'cok', 'az', 'bir', 'iki',
  'uc', 'dort', 'bes', 'alti', 'yedi', 'sekiz', 'dokuz', 'sifir', 'on',
  'erkek', 'kadin', 'cocuk', 'anne', 'baba', 'doga', 'bitki', 'meyve', 'sebze',
  'tatli', 'kahvalti', 'restoran', 'kap', 'kutu', 'kagit', 'yazi', 'metin',
  'saat', 'zaman', 'gun', 'gece', 'hava', 'su', 'deniz', 'dag', 'ev', 'okul',
  'araba', 'kitap', 'kalp', 'para', 'telefon', 'bilgisayar', 'muzik', 'ses',
  'isik', 'ates', 'yildiz', 'ay', 'gunes', 'cicek', 'agac', 'kus', 'balik',
  'kedi', 'kopek', 'at', 'kalem', 'defter', 'harita', 'bayrak', 'kale', 'tac',
  'kilic', 'kalkan', 'gemi', 'ucak', 'tren', 'otobus', 'bisiklet', 'roket',
  'komutan', 'asker', 'petek', 'bal', 'ari', 'limon', 'elma', 'avokado',
  'kahve', 'cay', 'pizza', 'pasta', 'volkan', 'yagmur', 'semsiye', 'hediye',
  'beyin', 'dis', 'keman', 'gitar', 'piyano', 'goz', 'kulak', 'burun', 'agiz',
]);

// Skip pure skin-tone / keycap / zodiac / regional-indicator / flag / obscure face emojis
const SKIP_EN_REGEX =
  /^(keycap|regional-indicator|flag-|japanese-|mahjong|playing-card|aries|taurus|gemini|cancer|leo|virgo|libra|scorpio|sagittarius|capricorn|aquarius|pisces|ophiuchus|hollow-red|large-|medium-|small-|black-square|white-square|red-circle|blue-circle|green-circle|yellow-circle|purple-circle|orange-circle|brown-circle|black-circle|white-circle|up-arrow|down-arrow|left-arrow|right-arrow|plus|minus|multiply|divide|exclamation|question|smiling-face|grinning|beaming|squinting|rolling-on|face-with|winking|kissing|zany|squinting|smirking|unamused|grimacing|lying|relieved|pensive|sleepy|drooling|sleeping|nauseated|vomiting|sneezing|hot-face|cold-face|woozy|dizzy|cowboy|partying|disguised|pleading|frowning|anguished|fearful|anxious|crying|loudly|confounded|persevering|disappointed|weary|tired|yawning|pouting|angry|cursing|pile-of-poo|clown|ogre|goblin|skull|ghost|alien|kiss-mark)/i;

async function main() {
  console.log('Fetching official Unicode CLDR Turkish & English annotations...');
  const [trRes, enRes] = await Promise.all([fetch(CLDR_TR_URL), fetch(CLDR_EN_URL)]);
  if (!trRes.ok || !enRes.ok) {
    throw new Error(`HTTP error: tr=${trRes.status}, en=${enRes.status}`);
  }
  const trJson = await trRes.json();
  const enJson = await enRes.json();

  const trAnnotations = trJson.annotations?.annotations || {};
  const enAnnotations = enJson.annotations?.annotations || {};

  // Build map: normalized Turkish term -> Set of clean English icon slugs (max 3 per Turkish term!)
  const trToEn = new Map();

  for (const [emojiKey, trEntry] of Object.entries(trAnnotations)) {
    const enEntry = enAnnotations[emojiKey];
    if (!enEntry?.tts?.[0]) continue;
    const enSlug = normEnIconSlug(enEntry.tts[0]);
    if (!enSlug || enSlug.length < 2 || enSlug.length > 34) continue;
    if (SKIP_EN_REGEX.test(enSlug)) continue;

    // Prioritize the exact Turkish `tts` name FIRST, then clean specific keywords from `default`
    const candidates = [
      ...(Array.isArray(trEntry.tts) ? trEntry.tts : []),
      ...(Array.isArray(trEntry.default) ? trEntry.default.slice(0, 6) : []),
    ];

    for (const rawTerm of candidates) {
      const trClean = normTr(rawTerm);
      if (!trClean || trClean.length < 3 || trClean.length > 28) continue;
      if (TOO_BROAD_TR.has(trClean)) continue;
      if (/^[0-9\s-]+$/.test(trClean)) continue;
      // Skip multi-word verbose descriptions (> 2 words)
      if (trClean.split(' ').length > 2) continue;

      let set = trToEn.get(trClean);
      if (!set) {
        set = new Set();
        trToEn.set(trClean, set);
      }
      if (set.size < 3) {
        set.add(enSlug);
      }
    }
  }

  // Filter out overly generic Turkish terms that mapped to >3 emojis or weird noise
  const pairs = {};
  const sortedKeys = Array.from(trToEn.keys()).sort();
  for (const k of sortedKeys) {
    const vals = Array.from(trToEn.get(k));
    if (vals.length > 0) {
      pairs[k] = vals;
    }
  }

  const outCode = `// AUTO-GENERATED FROM OFFICIAL UNICODE CLDR v49 TURKISH (tr) + ENGLISH (en) ANNOTATIONS
// Provides instant 0ms offline Turkish -> English concept mapping for ${Object.keys(pairs).length} official Turkish concepts!
export const CLDR_TR_TO_EN_CONCEPTS = ${JSON.stringify(pairs, null, 0)};
`;

  fs.writeFileSync(OUT_FILE, outCode, 'utf8');
  console.log(
    `SUCCESS: Generated ${OUT_FILE} with ${Object.keys(pairs).length} official Unicode CLDR Turkish concepts (${(
      outCode.length / 1024
    ).toFixed(1)} KB)!`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
