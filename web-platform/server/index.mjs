import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createVaultDb } from './db.mjs';
import { handleAuthRoute } from './authRoutes.mjs';
import { handleMapRoute } from './mapRoutes.mjs';
import { handleShareRoute } from './shareRoutes.mjs';
import { handleBillingRoute } from './billingRoutes.mjs';
import {
  HttpError,
  applySecurityHeaders,
  assertSameOrigin,
  createRateLimiter,
  getClientIp,
  getOrCreateServerSecret,
  getSessionCookieName,
  hmacDigest,
  parseCookies,
  resolveSafeStaticPath,
  sanitizeLogValue,
  sendJson,
  sha256Hex,
} from './security.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WEB_ROOT = path.resolve(__dirname, '..');
const MAIN_PUBLIC_DIR = path.resolve(WEB_ROOT, '..', 'public');
const DIST_DIR = path.join(WEB_ROOT, 'dist');
const DATA_DIR = path.join(WEB_ROOT, 'data');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
};

const ALLOWED_PUBLIC_FILES = new Set([
  '/privacy.html',
  '/terms.html',
  '/support.html',
]);

function serveStaticFile(res, filePath, cacheControl) {
  const ext = path.extname(filePath).toLowerCase();
  const mime = MIME_TYPES[ext] || 'application/octet-stream';
  const stat = fs.statSync(filePath);
  res.statusCode = 200;
  res.setHeader('Content-Type', mime);
  res.setHeader('Content-Length', stat.size);
  if (cacheControl) {
    res.setHeader('Cache-Control', cacheControl);
  }
  if (res.req?.method === 'HEAD') {
    res.end();
    return;
  }
  const stream = fs.createReadStream(filePath);
  stream.on('error', () => {
    if (!res.headersSent) {
      res.statusCode = 500;
      res.end('Internal Error');
    }
  });
  stream.pipe(res);
}

export function createWebPlatformServer(options = {}) {
  const port = Number(options.port ?? process.env.PORT ?? 4173);
  const host = options.host ?? process.env.HOST ?? '127.0.0.1';
  const dbPath = options.dbPath ?? path.join(DATA_DIR, 'zihinharitam-web.sqlite');
  const distDir = options.distDir ?? DIST_DIR;
  const serverSecret = options.serverSecret ?? getOrCreateServerSecret(DATA_DIR);

  const vault = createVaultDb(dbPath);
  const limiters = {
    register: createRateLimiter({ windowMs: 15 * 60 * 1000, maxHits: options.maxRegisterHits ?? 8 }),
    login: createRateLimiter({ windowMs: 15 * 60 * 1000, maxHits: options.maxLoginHits ?? 15 }),
    passwordChange: createRateLimiter({ windowMs: 15 * 60 * 1000, maxHits: 6 }),
    shareUnlock: createRateLimiter({ windowMs: 15 * 60 * 1000, maxHits: 12 }),
    billing: createRateLimiter({ windowMs: 15 * 60 * 1000, maxHits: 12 }),
    apiGeneral: createRateLimiter({ windowMs: 60 * 1000, maxHits: options.maxApiHits ?? 240 }),
  };

  const cleanupInterval = setInterval(() => {
    try {
      const now = Date.now();
      vault.stmts.pruneExpiredSessions.run(now, now - 24 * 60 * 60 * 1000);
    } catch {
      // Ignore transient cleanup error
    }
  }, 15 * 60 * 1000);
  cleanupInterval.unref();

  const server = http.createServer(async (req, res) => {
    const startMs = Date.now();
    const method = (req.method || 'GET').toUpperCase();
    req._clientIp = getClientIp(req);

    let parsedUrl;
    try {
      parsedUrl = new URL(req.url || '/', `http://${req.headers.host || `${host}:${port}`}`);
    } catch {
      applySecurityHeaders(req, res, { isApi: true });
      sendJson(res, 400, { error: 'Geçersiz URL.', code: 'BAD_URL' });
      return;
    }

    const pathname = parsedUrl.pathname;
    const isApi = pathname.startsWith('/api/');
    applySecurityHeaders(req, res, { isApi });

    // Compute allowed origins dynamically for actual bound port (important when port=0 in tests)
    const addr = server.address();
    const actualPort = typeof addr === 'object' && addr ? addr.port : port;
    const allowedOrigins = new Set([
      `http://localhost:${actualPort}`,
      `http://127.0.0.1:${actualPort}`,
      'http://localhost:5174',
      'http://127.0.0.1:5174',
    ]);
    if (process.env.WEB_PUBLIC_ORIGIN) {
      allowedOrigins.add(process.env.WEB_PUBLIC_ORIGIN.trim());
    }

    try {
      if (pathname === '/api/v1/health' && method === 'GET') {
        sendJson(res, 200, {
          ok: true,
          service: 'zihinharitam-web-platform',
          version: '1.1.2',
          timestamp: Date.now(),
        });
        return;
      }

      if (isApi) {
        const ipHash = hmacDigest(serverSecret, req._clientIp);
        const generalRate = limiters.apiGeneral(ipHash);
        if (!generalRate.allowed) {
          sendJson(
            res,
            429,
            { error: 'İstek hızı sınırı aşıldı.', code: 'RATE_LIMITED' },
            { 'Retry-After': String(generalRate.retryAfterSec) }
          );
          return;
        }

        assertSameOrigin(req, allowedOrigins);

        // Resolve authenticated session from HttpOnly cookie
        const cookies = parseCookies(req.headers.cookie);
        const sidRaw = cookies[getSessionCookieName()];
        let session = null;
        if (typeof sidRaw === 'string' && sidRaw.length >= 24 && sidRaw.length <= 128) {
          const idHash = sha256Hex(sidRaw);
          const now = Date.now();
          session = vault.stmts.findActiveSessionByHash.get(idHash, now) || null;
          if (session && now - session.last_seen_at > 60_000) {
            vault.stmts.touchSession.run(now, session.session_id);
          }
        }

        const ctx = { vault, serverSecret, session, limiters };

        if (await handleAuthRoute(req, res, pathname, ctx)) return;
        if (await handleMapRoute(req, res, pathname, ctx)) return;
        if (await handleShareRoute(req, res, pathname, ctx)) return;
        if (await handleBillingRoute(req, res, pathname, ctx)) return;

        throw new HttpError(404, 'API uç noktası bulunamadı.', 'NOT_FOUND');
      }

      // Only allow GET and HEAD for static assets & SPA routes
      if (method !== 'GET' && method !== 'HEAD') {
        sendJson(res, 405, { error: 'Yönteme izin verilmiyor.', code: 'METHOD_NOT_ALLOWED' });
        return;
      }

      // 1. Offline icon packs served safely from main ../public/offline-packs
      if (pathname.startsWith('/offline-packs/')) {
        const subPath = pathname.slice('/offline-packs/'.length);
        const resolved = resolveSafeStaticPath(path.join(MAIN_PUBLIC_DIR, 'offline-packs'), subPath);
        if (resolved && fs.existsSync(resolved) && fs.statSync(resolved).isFile()) {
          serveStaticFile(res, resolved, 'public, max-age=31536000, immutable');
          return;
        }
        res.statusCode = 404;
        res.end('Not Found');
        return;
      }

      // 2. Allowlisted shared brand & legal files from ../public
      if (ALLOWED_PUBLIC_FILES.has(pathname)) {
        const resolved = resolveSafeStaticPath(MAIN_PUBLIC_DIR, pathname.slice(1));
        if (resolved && fs.existsSync(resolved) && fs.statSync(resolved).isFile()) {
          const cc = pathname.endsWith('.html') ? 'public, max-age=300' : 'public, max-age=86400';
          serveStaticFile(res, resolved, cc);
          return;
        }
      }

      // 3. Built frontend static files in web-platform/dist
      const staticCandidate = resolveSafeStaticPath(distDir, pathname === '/' ? 'index.html' : pathname);
      if (staticCandidate && fs.existsSync(staticCandidate) && fs.statSync(staticCandidate).isFile()) {
        const isHashedAsset = pathname.startsWith('/assets/');
        serveStaticFile(
          res,
          staticCandidate,
          isHashedAsset ? 'public, max-age=31536000, immutable' : 'no-cache'
        );
        return;
      }

      // Reject suspicious traversal/file extension probes explicitly with 403/404 instead of SPA fallback
      const ext = path.extname(pathname).toLowerCase();
      if (
        pathname.includes('..') ||
        pathname.includes('%2e') ||
        pathname.includes('%2E') ||
        pathname.startsWith('/.') ||
        pathname.startsWith('/server') ||
        pathname.startsWith('/data') ||
        (ext && ext !== '.html')
      ) {
        res.statusCode = 404;
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.end('Not Found');
        return;
      }

      // 4. SPA fallback for clean web routes: /, /app, /auth, /s/:slug
      const indexHtml = path.join(distDir, 'index.html');
      if (fs.existsSync(indexHtml)) {
        serveStaticFile(res, indexHtml, 'no-cache');
        return;
      }

      res.statusCode = 503;
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.end('Web frontend henuz derlenmedi. Once `npm run build` calistirin.');
    } catch (err) {
      if (err instanceof HttpError) {
        sendJson(res, err.statusCode, { error: err.message, code: err.code });
        return;
      }
      // Never leak stack traces, file paths, or SQL errors to clients
      console.error(
        `[web-platform] ERROR ${method} ${sanitizeLogValue(pathname)} (${Date.now() - startMs}ms):`,
        sanitizeLogValue(err?.message || 'Unexpected error')
      );
      if (!res.headersSent) {
        sendJson(res, 500, { error: 'Sunucu tarafında beklenmeyen bir hata oluştu.', code: 'INTERNAL_ERROR' });
      }
    }
  });

  // Slowloris & hung-connection hardening
  server.headersTimeout = 15_000;
  server.requestTimeout = 30_000;
  server.keepAliveTimeout = 10_000;

  async function start() {
    await new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(port, host, () => {
        server.off('error', reject);
        resolve();
      });
    });
    const addr = server.address();
    const boundPort = typeof addr === 'object' && addr ? addr.port : port;
    return {
      port: boundPort,
      host,
      url: `http://localhost:${boundPort}`,
    };
  }

  async function stop() {
    clearInterval(cleanupInterval);
    await new Promise((resolve) => server.close(() => resolve()));
    vault.close();
  }

  return { server, vault, start, stop };
}

// Run directly when invoked as main script
const isMain =
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (isMain) {
  const instance = createWebPlatformServer();
  instance
    .start()
    .then(({ url }) => {
      console.log(`[ZihinHaritam Web] Güvenli tam kapsamlı web sunucusu hazır: ${url}`);
    })
    .catch((err) => {
      console.error('[ZihinHaritam Web] Sunucu başlatılamadı:', err);
      process.exit(1);
    });
}
