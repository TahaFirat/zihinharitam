import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';

const scryptAsync = promisify(crypto.scrypt);

const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const SCRYPT_KEYLEN = 64;

const COMMON_WEAK_PASSWORDS = new Set([
  'password123!',
  'qwerty1234!',
  'admin12345!',
  '1234567890a!',
  'welcome123!',
  'zihinharitam1!',
  'letmein123!',
  'changeme123!',
  'iloveyou123!',
  'istanbul123!',
]);

const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
const EMAIL_RE = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)+$/;
const CONTROL_CHARS_RE = /[\u0000-\u001F\u007F]/g;
const DANGEROUS_HTML_RE = /<\s*(?:script|iframe|object|embed|form|meta|link|base)\b/i;
const DANGEROUS_URL_RE = /^\s*(?:javascript|vbscript|file|data\s*:\s*text\/html)/i;
const INLINE_HANDLER_RE = /\bon[a-z]+\s*=/i;

let cachedServerSecret = null;

export function getOrCreateServerSecret(dataDir) {
  if (process.env.WEB_SESSION_SECRET && process.env.WEB_SESSION_SECRET.length >= 32) {
    return process.env.WEB_SESSION_SECRET;
  }
  if (cachedServerSecret) return cachedServerSecret;
  fs.mkdirSync(dataDir, { recursive: true });
  const secretPath = path.join(dataDir, '.server-secret');
  if (fs.existsSync(secretPath)) {
    const existing = fs.readFileSync(secretPath, 'utf8').trim();
    if (existing.length >= 64) {
      cachedServerSecret = existing;
      return cachedServerSecret;
    }
  }
  const fresh = crypto.randomBytes(48).toString('hex');
  fs.writeFileSync(secretPath, fresh + '\n', { encoding: 'utf8', mode: 0o600 });
  cachedServerSecret = fresh;
  return cachedServerSecret;
}

export function generateOpaqueToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString('base64url');
}

export function sha256Hex(input) {
  return crypto.createHash('sha256').update(String(input), 'utf8').digest('hex');
}

export function hmacDigest(secret, input) {
  return crypto.createHmac('sha256', secret).update(String(input), 'utf8').digest('hex').slice(0, 32);
}

export function timingSafeEqualStr(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

export async function hashPassword(plainPassword) {
  const salt = crypto.randomBytes(32).toString('hex');
  const derived = await scryptAsync(plainPassword, salt, SCRYPT_KEYLEN, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
    maxmem: 64 * 1024 * 1024,
  });
  return `scrypt$${SCRYPT_N}$${SCRYPT_R}$${SCRYPT_P}$${salt}$${Buffer.from(derived).toString('hex')}`;
}

export async function verifyPassword(plainPassword, storedHash) {
  if (typeof plainPassword !== 'string' || typeof storedHash !== 'string') return false;
  const parts = storedHash.split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
  const n = Number(parts[1]);
  const r = Number(parts[2]);
  const p = Number(parts[3]);
  const salt = parts[4];
  const expectedHex = parts[5];
  if (!Number.isFinite(n) || !Number.isFinite(r) || !Number.isFinite(p) || !salt || !expectedHex) {
    return false;
  }
  const derived = await scryptAsync(plainPassword, salt, expectedHex.length / 2, {
    N: n,
    r,
    p,
    maxmem: 64 * 1024 * 1024,
  });
  const expectedBuf = Buffer.from(expectedHex, 'hex');
  const actualBuf = Buffer.from(derived);
  if (expectedBuf.length !== actualBuf.length) return false;
  return crypto.timingSafeEqual(expectedBuf, actualBuf);
}

let dummyHashPromise = null;
export function getDummyPasswordHash() {
  if (!dummyHashPromise) {
    dummyHashPromise = hashPassword('ZihinHaritam-Dummy-Timing-Guard-99!');
  }
  return dummyHashPromise;
}

export function sanitizeSingleLineText(value, maxLen = 120) {
  if (typeof value !== 'string') return '';
  return value
    .replace(CONTROL_CHARS_RE, ' ')
    .replace(/[<>]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLen);
}

export function sanitizeLogValue(value, maxLen = 180) {
  return String(value ?? '')
    .replace(/[\r\n\t\u0000-\u001F\u007F]/g, ' ')
    .trim()
    .slice(0, maxLen);
}

export function validateEmail(raw) {
  if (typeof raw !== 'string') return { ok: false, error: 'Geçerli bir e-posta adresi girin.' };
  const cleaned = raw.trim().toLowerCase();
  if (!cleaned || cleaned.length > 254 || CONTROL_CHARS_RE.test(cleaned) || !EMAIL_RE.test(cleaned)) {
    return { ok: false, error: 'Geçerli bir e-posta adresi girin.' };
  }
  return { ok: true, email: cleaned };
}

export function validateDisplayName(raw) {
  const cleaned = sanitizeSingleLineText(raw, 64);
  if (cleaned.length < 2) {
    return { ok: false, error: 'Ad soyad en az 2 karakter olmalıdır.' };
  }
  return { ok: true, displayName: cleaned };
}

export function validatePasswordStrength(password, email = '') {
  if (typeof password !== 'string') {
    return { ok: false, error: 'Şifre gereklidir.' };
  }
  if (password.length < 10 || password.length > 128) {
    return { ok: false, error: 'Şifre 10 ile 128 karakter arasında olmalıdır.' };
  }
  if (!/[a-zçğıöşü]/.test(password)) {
    return { ok: false, error: 'Şifre en az 1 küçük harf içermelidir.' };
  }
  if (!/[A-ZÇĞİÖŞÜ]/.test(password)) {
    return { ok: false, error: 'Şifre en az 1 büyük harf içermelidir.' };
  }
  if (!/\d/.test(password)) {
    return { ok: false, error: 'Şifre en az 1 rakam içermelidir.' };
  }
  if (!/[^A-Za-z0-9ÇĞİÖŞÜçğıöşü\s]/.test(password)) {
    return { ok: false, error: 'Şifre en az 1 özel karakter (!@#$%^&* vb.) içermelidir.' };
  }
  const lower = password.toLowerCase();
  if (COMMON_WEAK_PASSWORDS.has(lower)) {
    return { ok: false, error: 'Bu şifre çok yaygın; lütfen daha benzersiz bir şifre seçin.' };
  }
  const localPart = String(email || '').split('@')[0]?.toLowerCase() || '';
  if (localPart.length >= 4 && lower.includes(localPart)) {
    return { ok: false, error: 'Şifreniz e-posta adresinizi içermemelidir.' };
  }
  return { ok: true };
}

export function parseCookies(cookieHeader) {
  const result = Object.create(null);
  if (typeof cookieHeader !== 'string' || !cookieHeader) return result;
  for (const part of cookieHeader.split(';')) {
    const eq = part.indexOf('=');
    if (eq <= 0) continue;
    const key = part.slice(0, eq).trim();
    const val = part.slice(eq + 1).trim();
    if (!key || FORBIDDEN_KEYS.has(key)) continue;
    try {
      result[key] = decodeURIComponent(val);
    } catch {
      result[key] = val;
    }
  }
  return result;
}

export function isHttpsRequest(req) {
  if (req.socket?.encrypted) return true;
  const proto = String(req.headers['x-forwarded-proto'] || '').toLowerCase();
  return proto === 'https';
}

export function getSessionCookieName() {
  return 'zh_sid';
}

export function buildSessionCookie(req, token, maxAgeSeconds) {
  const parts = [
    `${getSessionCookieName()}=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${Math.max(0, Math.floor(maxAgeSeconds))}`,
  ];
  if (isHttpsRequest(req)) {
    parts.push('Secure');
  }
  return parts.join('; ');
}

export function clearSessionCookie(req) {
  return buildSessionCookie(req, '', 0);
}

export function getClientIp(req) {
  const trustProxy = process.env.TRUST_PROXY === '1';
  if (trustProxy) {
    const xff = String(req.headers['x-forwarded-for'] || '').split(',')[0]?.trim();
    if (xff) return xff;
  }
  return req.socket?.remoteAddress || '127.0.0.1';
}

export function createRateLimiter({ windowMs, maxHits, maxBuckets = 25000 }) {
  const buckets = new Map();

  function prune(now) {
    if (buckets.size < 2000) return;
    for (const [k, entry] of buckets.entries()) {
      if (now >= entry.resetAt) buckets.delete(k);
    }
    if (buckets.size > maxBuckets) {
      let toDrop = buckets.size - Math.floor(maxBuckets * 0.75);
      for (const k of buckets.keys()) {
        buckets.delete(k);
        if (--toDrop <= 0) break;
      }
    }
  }

  return function checkLimit(key) {
    const now = Date.now();
    prune(now);
    const existing = buckets.get(key);
    if (!existing || now >= existing.resetAt) {
      const resetAt = now + windowMs;
      buckets.set(key, { count: 1, resetAt });
      return { allowed: true, remaining: Math.max(0, maxHits - 1), retryAfterSec: 0 };
    }
    if (existing.count >= maxHits) {
      const retryAfterSec = Math.max(1, Math.ceil((existing.resetAt - now) / 1000));
      return { allowed: false, remaining: 0, retryAfterSec };
    }
    existing.count += 1;
    return { allowed: true, remaining: Math.max(0, maxHits - existing.count), retryAfterSec: 0 };
  };
}

export function stripDangerousKeys(value, depth = 0) {
  if (depth > 24) {
    throw new HttpError(400, 'JSON derinliği güvenlik sınırını aşıyor.');
  }
  if (value === null || typeof value !== 'object') {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((item) => stripDangerousKeys(item, depth + 1));
  }
  const clean = {};
  for (const [k, v] of Object.entries(value)) {
    if (FORBIDDEN_KEYS.has(k)) continue;
    clean[k] = stripDangerousKeys(v, depth + 1);
  }
  return clean;
}

export class HttpError extends Error {
  constructor(statusCode, message, code = 'ERR_REQUEST') {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
  }
}

export async function readJsonBody(req, maxBytes = 16 * 1024) {
  const ct = String(req.headers['content-type'] || '').toLowerCase();
  if (!ct.includes('application/json')) {
    throw new HttpError(415, 'İstek gövdesi application/json olmalıdır.', 'UNSUPPORTED_MEDIA_TYPE');
  }

  const contentLength = Number(req.headers['content-length'] || 0);
  if (Number.isFinite(contentLength) && contentLength > maxBytes) {
    throw new HttpError(413, 'İstek boyutu güvenlik sınırını aşıyor.', 'PAYLOAD_TOO_LARGE');
  }

  const chunks = [];
  let total = 0;

  await new Promise((resolve, reject) => {
    let settled = false;
    req.on('data', (chunk) => {
      if (settled) return;
      total += chunk.length;
      if (total > maxBytes) {
        settled = true;
        reject(new HttpError(413, 'İstek boyutu güvenlik sınırını aşıyor.', 'PAYLOAD_TOO_LARGE'));
        req.pause();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (!settled) {
        settled = true;
        resolve();
      }
    });
    req.on('error', () => {
      if (!settled) {
        settled = true;
        reject(new HttpError(400, 'İstek gövdesi okunamadı.', 'BAD_REQUEST'));
      }
    });
  });

  if (total === 0) return {};

  const rawText = Buffer.concat(chunks).toString('utf8');
  let parsed;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    throw new HttpError(400, 'Geçersiz JSON biçimi.', 'INVALID_JSON');
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new HttpError(400, 'JSON gövdesi nesne olmalıdır.', 'INVALID_JSON_OBJECT');
  }
  return stripDangerousKeys(parsed, 0);
}

export function assertSameOrigin(req, allowedOrigins) {
  const method = (req.method || 'GET').toUpperCase();
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') return;

  const origin = req.headers.origin;
  const referer = req.headers.referer;

  if (origin) {
    if (!allowedOrigins.has(origin)) {
      throw new HttpError(403, 'Çapraz kaynak (CORS/CSRF) isteği engellendi.', 'CSRF_ORIGIN_BLOCKED');
    }
    return;
  }

  if (referer) {
    try {
      const refOrigin = new URL(referer).origin;
      if (!allowedOrigins.has(refOrigin)) {
        throw new HttpError(403, 'Geçersiz Referer kaynağı engellendi.', 'CSRF_REFERER_BLOCKED');
      }
      return;
    } catch {
      throw new HttpError(403, 'Geçersiz Referer başlığı.', 'CSRF_REFERER_INVALID');
    }
  }

  // Require explicit anti-CSRF header if neither Origin nor Referer is provided (e.g. non-browser clients)
  const requestedWith = String(req.headers['x-requested-with'] || '');
  const hasCsrfHeader = typeof req.headers['x-csrf-token'] === 'string' && req.headers['x-csrf-token'].length >= 16;
  if (requestedWith !== 'ZihinHaritamWeb' && !hasCsrfHeader) {
    throw new HttpError(403, 'Origin veya güvenlik başlığı eksik.', 'CSRF_HEADER_MISSING');
  }
}

export function assertCsrfToken(req, session) {
  const token = String(req.headers['x-csrf-token'] || '');
  if (!session || !session.csrf_token || !timingSafeEqualStr(token, session.csrf_token)) {
    throw new HttpError(403, 'CSRF güvenlik doğrulaması başarısız. Sayfayı yenileyip tekrar deneyin.', 'CSRF_INVALID');
  }
}

export function sanitizeStringDeep(value, depth = 0) {
  if (depth > 18) return null;
  if (typeof value === 'string') {
    let s = value.replace(/\u0000/g, '');
    if (DANGEROUS_URL_RE.test(s)) {
      return '';
    }
    if (DANGEROUS_HTML_RE.test(s) || INLINE_HANDLER_RE.test(s)) {
      s = s
        .replace(/<\s*script\b[^>]*>[\s\S]*?<\s*\/\s*script\s*>/gi, '')
        .replace(/<\s*(?:script|iframe|object|embed|form|meta|link|base)\b[^>]*>/gi, '')
        .replace(/\bon[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '');
    }
    return s;
  }
  if (Array.isArray(value)) {
    return value.slice(0, 3000).map((item) => sanitizeStringDeep(item, depth + 1));
  }
  if (value && typeof value === 'object') {
    const out = {};
    let count = 0;
    for (const [k, v] of Object.entries(value)) {
      if (FORBIDDEN_KEYS.has(k)) continue;
      if (++count > 2000) break;
      out[k] = sanitizeStringDeep(v, depth + 1);
    }
    return out;
  }
  return value;
}

export function validateAndSanitizeMindMapDoc(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new HttpError(400, 'Geçersiz zihin haritası belgesi.', 'INVALID_MAP_DOC');
  }
  const id = sanitizeSingleLineText(String(raw.id || ''), 96);
  if (!id || !/^[a-zA-Z0-9_-]{3,96}$/.test(id)) {
    throw new HttpError(400, 'Geçersiz harita kimliği.', 'INVALID_MAP_ID');
  }
  const title = sanitizeSingleLineText(String(raw.title || 'Adsız Harita'), 140) || 'Adsız Harita';
  const department = sanitizeSingleLineText(String(raw.department || 'genel'), 40) || 'genel';
  const docKind = raw.kind === 'flowchart' ? 'flowchart' : 'mindmap';

  const sanitizedDoc = sanitizeStringDeep(raw, 0);
  sanitizedDoc.id = id;
  sanitizedDoc.title = title;
  sanitizedDoc.department = department;

  const nodesObj =
    sanitizedDoc.nodes && typeof sanitizedDoc.nodes === 'object' && !Array.isArray(sanitizedDoc.nodes)
      ? sanitizedDoc.nodes
      : {};
  const nodeKeys = Object.keys(nodesObj);
  if (nodeKeys.length > 1500) {
    throw new HttpError(400, 'Tek haritada maksimum 1.500 dal desteklenir.', 'MAP_TOO_MANY_NODES');
  }

  const serialized = JSON.stringify(sanitizedDoc);
  if (Buffer.byteLength(serialized, 'utf8') > 5 * 1024 * 1024) {
    throw new HttpError(413, 'Tek harita boyutu 5 MB sınırını aşıyor.', 'MAP_TOO_LARGE');
  }

  const updatedAt =
    typeof sanitizedDoc.updatedAt === 'number' && Number.isFinite(sanitizedDoc.updatedAt)
      ? Math.max(0, Math.floor(sanitizedDoc.updatedAt))
      : Date.now();

  return {
    id,
    title,
    department,
    docKind,
    nodeCount: nodeKeys.length,
    updatedAt,
    payloadJson: serialized,
    doc: sanitizedDoc,
  };
}

export function applySecurityHeaders(req, res, { isApi = false } = {}) {
  const csp = [
    "default-src 'self'",
    "script-src 'self' 'wasm-unsafe-eval' blob:",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' data: https://fonts.gstatic.com",
    "img-src 'self' data: blob: https://api.iconify.design",
    "connect-src 'self' data: blob: https://api.iconify.design https://tr.wikipedia.org https://en.wikipedia.org https://api.mymemory.translated.net",
    "worker-src 'self' blob:",
    "frame-src 'none'",
    "frame-ancestors 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ');

  res.setHeader('Content-Security-Policy', csp);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(self), microphone=(self), geolocation=(), payment=()');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
  res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');

  if (isHttpsRequest(req)) {
    res.setHeader('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
  }

  if (isApi) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.setHeader('Pragma', 'no-cache');
  }
}

export function sendJson(res, statusCode, payload, extraHeaders = {}) {
  const body = JSON.stringify(payload);
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Content-Length', Buffer.byteLength(body, 'utf8'));
  for (const [k, v] of Object.entries(extraHeaders)) {
    res.setHeader(k, v);
  }
  res.end(body);
}

export function resolveSafeStaticPath(rootDir, requestPath) {
  if (typeof requestPath !== 'string' || requestPath.includes('\0')) {
    return null;
  }
  let decoded;
  try {
    decoded = decodeURIComponent(requestPath);
  } catch {
    return null;
  }
  if (decoded.includes('\0') || decoded.includes('\\')) {
    return null;
  }
  const normalizedSegments = decoded.split('/').filter(Boolean);
  for (let i = 0; i < normalizedSegments.length; i++) {
    const seg = normalizedSegments[i];
    if (seg === '.' || seg === '..' || seg.startsWith('.')) {
      return null;
    }
    const isBuiltAssetMjs =
      i === 1 &&
      normalizedSegments.length === 2 &&
      normalizedSegments[0] === 'assets' &&
      /^[a-zA-Z0-9._-]+\.mjs$/i.test(seg);
    if (
      !isBuiltAssetMjs &&
      /\.(?:sqlite|sqlite-wal|sqlite-shm|db|env|jks|keystore|p8|p12|pem|key|mjs)$/i.test(seg)
    ) {
      return null;
    }
  }
  const resolvedRoot = path.resolve(rootDir);
  const candidate = path.resolve(resolvedRoot, ...normalizedSegments);
  if (candidate !== resolvedRoot && !candidate.startsWith(resolvedRoot + path.sep)) {
    return null;
  }
  return candidate;
}
