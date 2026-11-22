/**
 * SHA-256 Hashed 30-Slot Friend Gift Code Registry (max 30 unique codes).
 * Plaintext codes are NEVER bundled in app source — only irreversible SHA-256 digests are stored here.
 * On iOS: Apple Guideline 3.1.1 requires using native StoreKit 2 presentOfferCodeRedeemSheet.
 * On Android / Web: Friends can redeem 1 of the 30 unique developer-issued gift codes directly.
 */
export const MAX_FRIEND_PROMO_SLOTS = 30;

export const VALID_FRIEND_PROMO_HASHES: readonly string[] = [
  '177eb7c9a6ca57bf5d4bddee1d3ef44ac37dab385b8b7b3db027c579b4454670',
  '95374396c86b23a272112a783ec76b8d5ab76e9d8d846ae097858c54eda83b61',
  '0cf4935514dc31645442789f99c8476d8fa914d1c143e8e1102355191bde6574',
  '7fac5b379c34751bac3e300e8bc9b170d986ac707b2bcd5a500b156e6efa95b1',
  'c2e266c239ed329d3d7b7c54c268745efe42920a3f382ef3b42121949c853094',
  '9ab269bb42859a3642307dbe3208ec77c8884571c4019f4e259a2bdfcd6bd09a',
  'fc401d4612d59aa86880037b20d0a66cbda50d6b8493017305ca217e7852c067',
  'ecbeed25bbdf01cf172abbd671b55706b1c967534bd4913d157590729b9d57ff',
  'bfbd71fdb2621bd70f37f8208a37b8730d07725cb6dd0e2f5df8074ab8d3149a',
  '917b99a26c1df26376a87e9aca196d1b68f622557b33fba8d1150e61eacf6261',
  '82895e041a850cfcbd39a3d48f8faeeced7e6818c6dce015d38bd1a8e1e1b7be',
  'ed92dfbda52b67e11f3cf0bafb30d33d85773b39d298b32d0bd4953565559111',
  '3e2b4f6a9ed0d364bc41bb7902ce732bf831b26ab5577fa6507c467b250359ac',
  '12538b348880b4ce020814107851e909fd73c3ae4cf983188aaaf3e0bb6260ab',
  '994b87dae44db3377006c429b31156a551199b4c81d9e01f914939205f434fc3',
  'cc2d58161226571dce1dcefe25554eb6881ac9235d5f64675fea5372e284ab45',
  '3dec6d740ea024a9161b11949cd01c076db3aa0f8087ba1162e21647389f1c20',
  '9f61194887c62a4d780238b536bb58a627a8a6cfdb606a2976878c2e5f87fe74',
  'cd8521962ad89a34c21044cb1b2315c3718390ec2debb2c86898ab0c722308fd',
  '534c54c34a636b7c2645f7681ca0f38c1ba853efd5ed5d0c6e8a0b8050a37e85',
  '13bdcc11c95497afeadb68d851efc92a9f6c17380fa33e9be113f7061029be38',
  '69b7ab6fad9c0f9249717786780f65d0d9c7854a2d07473ed711ee8fd1abb40f',
  'f801cdecaac08972c915395814b25dd011e020e40442f2d133a97f731a2b2778',
  '3f065638cf8fb6dd70cfde8bded6629ace4eb8480ff33c5648c0f186513a58cc',
  '505051ebab69bfee8133dbded5495b68ec7f37bea6a356b0941bdebe94d742da',
  'd69ed2fa12ab0f38984c28311b37ab639cbdd1d11f33f303e3b8ee1d9480c61c',
  'c99639caa6fbc546d96c780f3e826fa2261ad0e20a87c0d9ff359d5c5579ba5f',
  '94cb3d638a6b0c78bb08e48f1a43bfa4333ba69f1d5174e290094d961b2b8768',
  '67d380cf775433b5d5e5c45e55bb6ff6ee58f75131d3900e1d8cf7a874aae03e',
  'cd441d55aae0f1ee3e4993d5b04ad66de0a02d20ae9fd472e2bebf3649263980',
];

const VALID_HASH_SET = new Set<string>(VALID_FRIEND_PROMO_HASHES);
const REDEEMED_LOCAL_KEY = 'zh_v8_redeemed_promo_hashes';
const PROMO_RATE_LIMIT_KEY = 'zh_v9_promo_attempts';
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MS = 60_000;

function readAttemptState(): { fails: number; lockUntil: number } {
  try {
    const raw = localStorage.getItem(PROMO_RATE_LIMIT_KEY);
    if (raw) {
      const p = JSON.parse(raw) as { fails?: number; lockUntil?: number };
      return {
        fails: Number(p.fails) || 0,
        lockUntil: Number(p.lockUntil) || 0,
      };
    }
  } catch {
    // Ignore storage read errors
  }
  return { fails: 0, lockUntil: 0 };
}

function writeAttemptState(state: { fails: number; lockUntil: number }): void {
  try {
    localStorage.setItem(PROMO_RATE_LIMIT_KEY, JSON.stringify(state));
  } catch {
    // Ignore
  }
}

function normalizeCode(raw: string): string {
  return raw.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
}

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export function readLocallyRedeemedHashes(): string[] {
  try {
    const raw = localStorage.getItem(REDEEMED_LOCAL_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

export async function verifyAndConsumeFriendPromoCode(rawCode: string): Promise<{
  valid: boolean;
  slotNumber?: number;
  hash?: string;
  errorMessage?: string;
}> {
  const now = Date.now();
  const attempts = readAttemptState();
  if (attempts.lockUntil > now) {
    const secLeft = Math.max(1, Math.ceil((attempts.lockUntil - now) / 1000));
    return {
      valid: false,
      errorMessage: `Çok fazla hatalı deneme yapıldı. Güvenlik için lütfen ${secLeft} saniye sonra tekrar deneyin.`,
    };
  }

  const norm = normalizeCode(rawCode);
  if (norm.length < 8) {
    return { valid: false, errorMessage: 'Lütfen geçerli bir hediye kodu girin (örn. ZHPRO-01-XXXXXX).' };
  }
  const hash = await sha256Hex('zihinharitam:v1:' + norm);
  if (!VALID_HASH_SET.has(hash)) {
    const nextFails = attempts.fails + 1;
    writeAttemptState({
      fails: nextFails >= MAX_FAILED_ATTEMPTS ? 0 : nextFails,
      lockUntil: nextFails >= MAX_FAILED_ATTEMPTS ? now + LOCKOUT_MS : 0,
    });
    return { valid: false, errorMessage: 'Geçersiz veya hatalı kod. Lütfen kodu kontrol edip tekrar deneyin.' };
  }
  writeAttemptState({ fails: 0, lockUntil: 0 });
  const slotIndex = VALID_FRIEND_PROMO_HASHES.indexOf(hash);
  const localUsed = readLocallyRedeemedHashes();
  if (!localUsed.includes(hash)) {
    localUsed.push(hash);
    try {
      localStorage.setItem(REDEEMED_LOCAL_KEY, JSON.stringify(localUsed));
    } catch {
      // Ignore storage errors
    }
  }
  return { valid: true, slotNumber: slotIndex + 1, hash };
}
