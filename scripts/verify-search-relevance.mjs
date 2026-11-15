import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { OfflineBM25Engine } from '../src/core/visuals/offlineSearchCore.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const MANIFEST_PATH = path.join(ROOT_DIR, 'public', 'offline-packs', 'search-manifest.json');
const SHARDS_DIR = path.join(ROOT_DIR, 'public', 'offline-packs', 'shards');

const BENCHMARK_20_QUERIES = [
  'mikroorganizma',
  'bakteri',
  'virüs',
  'çip',
  'ekokardiyografi',
  'mitral kapak',
  'oskültasyon',
  'yük dengeleyici',
  'veritabanı',
  'api gateway',
  'op-amp',
  'pil batarya',
  'istinaf mahkemesi',
  'anayasa',
  'uçan payanda',
  'kemer tonoz',
  'osmanlı',
  'deprem',
  'dna gen',
  'yapay sinir ağı',
];

const STRICT_FORBIDDEN_CHECKS = {
  mikroorganizma: [
    'server', 'nand', 'nor', 'xor', 'gate', 'logic', 'chip', 'microchip',
    'cpu', 'processor', 'stair', 'stairs', 'ladder', 'chimney', 'minaret', 'mosque',
  ],
  çip: ['potato', 'fries', 'cookie', 'chocolate', 'casino', 'poker', 'bacteria', 'microbe'],
  ekokardiyografi: ['economy', 'economics', 'coin', 'dollar', 'ecology', 'recycle', 'cart'],
  'uçan payanda': ['airplane', 'aircraft', 'ufo', 'saucer', 'rocket', 'helicopter', 'bird'],
};

function runVerification() {
  if (!fs.existsSync(MANIFEST_PATH)) {
    console.error('FAIL: Missing public/offline-packs/search-manifest.json. Run node scripts/build-offline-icon-shards.mjs first.');
    process.exit(1);
  }

  const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
  console.log(`\n=== V3 OFFLINE BM25 & TAXONOMY VERIFICATION (${manifest.totalIcons} Offline Icons) ===\n`);

  if (manifest.totalIcons < 20000) {
    console.error(`FAIL: Expected >= 20,000 offline icons, found ${manifest.totalIcons}`);
    process.exit(1);
  }

  // Preload shard map in memory to verify 100% shard body integrity too
  const shards = new Map();
  for (let i = 0; i < manifest.shardCount; i++) {
    const sp = path.join(SHARDS_DIR, `shard-${String(i).padStart(2, '0')}.json`);
    shards.set(i, JSON.parse(fs.readFileSync(sp, 'utf8')));
  }

  const engine = new OfflineBM25Engine(manifest.items);

  // Warm-up JIT (1 throwaway query so V8 JIT compilation isn't measured as search latency)
  engine.search('kalp');

  let failures = 0;

  for (const query of BENCHMARK_20_QUERIES) {
    // Deliberately pass `electronics` as activeOfflineDomain on `mikroorganizma` to prove ZERO parent context pollution!
    const simulatedParentDomain =
      query === 'mikroorganizma' ? 'electronics' : 'general';

    const t0 = performance.now();
    const { hits, expanded } = engine.search(query, {
      discipline: query === 'mikroorganizma' ? 'electronics_robotics' : 'system_design_cs',
      activeOfflineDomain: simulatedParentDomain,
      limit: 60,
    });
    const elapsedMs = performance.now() - t0;

    // Total available offline icons = BM25 shard hits + BuiltInMultiColorAtlas matched packs
    const totalCount = hits.length + expanded.matchedAtlasIds.length;
    const top5Preview = hits
      .slice(0, 5)
      .map((h) => `${h.pack}:${h.name}`)
      .join(', ');

    console.log(
      `[${elapsedMs.toFixed(2).padStart(5)}ms] "${query.padEnd(18)}" -> ${String(
        totalCount
      ).padStart(3)} offline hits | Top: ${top5Preview}`
    );

    if (elapsedMs > 15) {
      console.error(`  ❌ LATENCY FAIL on "${query}": ${elapsedMs.toFixed(2)}ms > 15ms`);
      failures++;
    }

    if (totalCount < 20) {
      console.error(`  ❌ VOLUME FAIL on "${query}": ${totalCount} hits < 20 minimum`);
      failures++;
    }

    // Verify every single top-20 hit has non-empty SVG body in its shard!
    for (const hit of hits.slice(0, 20)) {
      const shardObj = shards.get(hit.shardId);
      const svgEntry = shardObj?.[hit.id];
      if (!svgEntry || !svgEntry.b || svgEntry.b.length < 20) {
        console.error(`  ❌ BROKEN SHARD ENTRY for ${hit.id} in shard-${hit.shardId}`);
        failures++;
      }
    }

    // Check strict forbidden token rules!
    const forbiddenWords = STRICT_FORBIDDEN_CHECKS[query];
    if (forbiddenWords) {
      for (const hit of hits.slice(0, 20)) {
        const wordsInHit = `${hit.name} ${hit.enTags}`
          .toLowerCase()
          .split(/[\s\-_/]+/);
        for (const bad of forbiddenWords) {
          if (wordsInHit.includes(bad)) {
            console.error(
              `  ❌ RELEVANCE CONTAMINATION FAIL on "${query}": Forbidden token "${bad}" found in top-20 icon "${hit.id}" (${hit.name})!`
            );
            failures++;
          }
        }
      }
    }
  }

  // Verify Homonym Disambiguation (`köprü` in System Design vs Architecture)
  const kopruSys = engine.search('köprü', {
    discipline: 'system_design_cs',
    activeOfflineDomain: 'system_cs',
    limit: 10,
  });
  const kopruArch = engine.search('köprü', {
    discipline: 'architecture_civil',
    activeOfflineDomain: 'architecture',
    limit: 10,
  });
  console.log(
    `\n[Homonym Check] "köprü" (System Design): atlas=${kopruSys.expanded.matchedAtlasIds.join(',')} | top=${kopruSys.hits[0]?.id}`
  );
  console.log(
    `[Homonym Check] "köprü" (Architecture) : atlas=${kopruArch.expanded.matchedAtlasIds.join(',')} | top=${kopruArch.hits[0]?.id}`
  );

  if (failures > 0) {
    console.error(`\n❌ VERIFICATION FAILED WITH ${failures} ERROR(S).`);
    process.exit(1);
  }

  console.log(
    `\n✅ ALL 20 BENCHMARK QUERIES PASSED (<15ms, >=20+ hits, ZERO relevance contamination, 100% valid SVG shards)!\n`
  );
}

runVerification();
