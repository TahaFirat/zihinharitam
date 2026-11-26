import {
  HttpError,
  assertCsrfToken,
  generateOpaqueToken,
  hashPassword,
  hmacDigest,
  readJsonBody,
  sendJson,
  validateAndSanitizeMindMapDoc,
  verifyPassword,
} from './security.mjs';

const EXPIRY_PRESETS_MS = {
  '24h': 24 * 60 * 60 * 1000,
  '7d': 7 * 24 * 60 * 60 * 1000,
  '30d': 30 * 24 * 60 * 60 * 1000,
  never: null,
};

export async function handleShareRoute(req, res, pathname, ctx) {
  const { vault, serverSecret, session, limiters } = ctx;
  const method = (req.method || 'GET').toUpperCase();
  const ipHash = hmacDigest(serverSecret, req._clientIp || '127.0.0.1');

  // Public share read: GET /api/v1/public/shares/:slug
  if (method === 'GET' && pathname.startsWith('/api/v1/public/shares/')) {
    const slug = pathname.slice('/api/v1/public/shares/'.length);
    if (!/^[a-zA-Z0-9_-]{12,64}$/.test(slug)) {
      throw new HttpError(404, 'Paylaşım bağlantısı bulunamadı.', 'SHARE_NOT_FOUND');
    }
    const row = vault.stmts.findPublicSharedLink.get(slug);
    if (!row) {
      throw new HttpError(404, 'Paylaşım bağlantısı bulunamadı veya iptal edildi.', 'SHARE_NOT_FOUND');
    }
    if (row.expires_at && row.expires_at <= Date.now()) {
      throw new HttpError(410, 'Bu paylaşım bağlantısının süresi dolmuş.', 'SHARE_EXPIRED');
    }

    if (row.password_hash) {
      sendJson(res, 200, {
        slug: row.slug,
        title: row.title,
        requiresPassword: true,
        expiresAt: row.expires_at,
        createdAt: row.created_at,
        viewCount: row.view_count,
        document: null,
      });
      return true;
    }

    vault.stmts.incrementShareViewCount.run(slug);
    sendJson(res, 200, {
      slug: row.slug,
      title: row.title,
      requiresPassword: false,
      expiresAt: row.expires_at,
      createdAt: row.created_at,
      viewCount: row.view_count + 1,
      document: JSON.parse(row.snapshot_json),
    });
    return true;
  }

  // Public share password unlock: POST /api/v1/public/shares/:slug/unlock
  if (method === 'POST' && pathname.startsWith('/api/v1/public/shares/') && pathname.endsWith('/unlock')) {
    const slug = pathname.slice('/api/v1/public/shares/'.length, -'/unlock'.length);
    if (!/^[a-zA-Z0-9_-]{12,64}$/.test(slug)) {
      throw new HttpError(404, 'Paylaşım bağlantısı bulunamadı.', 'SHARE_NOT_FOUND');
    }
    const rate = limiters.shareUnlock(`${ipHash}:${slug}`);
    if (!rate.allowed) {
      sendJson(
        res,
        429,
        { error: 'Çok fazla şifre denemesi. Lütfen birkaç dakika bekleyin.', code: 'RATE_LIMITED' },
        { 'Retry-After': String(rate.retryAfterSec) }
      );
      return true;
    }

    const row = vault.stmts.findPublicSharedLink.get(slug);
    if (!row) {
      throw new HttpError(404, 'Paylaşım bağlantısı bulunamadı.', 'SHARE_NOT_FOUND');
    }
    if (row.expires_at && row.expires_at <= Date.now()) {
      throw new HttpError(410, 'Bu paylaşım bağlantısının süresi dolmuş.', 'SHARE_EXPIRED');
    }

    const body = await readJsonBody(req, 4 * 1024);
    const password = typeof body.password === 'string' ? body.password : '';
    if (!row.password_hash || !(await verifyPassword(password, row.password_hash))) {
      throw new HttpError(401, 'Paylaşım şifresi hatalı.', 'INVALID_SHARE_PASSWORD');
    }

    vault.stmts.incrementShareViewCount.run(slug);
    sendJson(res, 200, {
      slug: row.slug,
      title: row.title,
      requiresPassword: false,
      expiresAt: row.expires_at,
      createdAt: row.created_at,
      viewCount: row.view_count + 1,
      document: JSON.parse(row.snapshot_json),
    });
    return true;
  }

  // Authenticated share management routes
  if (!pathname.startsWith('/api/v1/shares')) return false;
  if (!session) {
    throw new HttpError(401, 'Paylaşım bağlantısı oluşturmak için oturum açın.', 'UNAUTHORIZED');
  }

  // GET /api/v1/shares
  if (method === 'GET' && pathname === '/api/v1/shares') {
    const rows = vault.stmts.listSharedLinksForOwner.all(session.user_id);
    sendJson(res, 200, {
      shares: rows.map((r) => ({
        slug: r.slug,
        mapId: r.map_id,
        title: r.title,
        hasPassword: Boolean(r.has_password),
        expiresAt: r.expires_at,
        viewCount: r.view_count,
        createdAt: r.created_at,
      })),
    });
    return true;
  }

  // POST /api/v1/shares
  if (method === 'POST' && pathname === '/api/v1/shares') {
    assertCsrfToken(req, session);
    const body = await readJsonBody(req, 3 * 1024 * 1024);
    const clean = validateAndSanitizeMindMapDoc(body.document);

    const expiryKey = typeof body.expiry === 'string' && body.expiry in EXPIRY_PRESETS_MS ? body.expiry : '7d';
    const expiryDelta = EXPIRY_PRESETS_MS[expiryKey];
    const now = Date.now();
    const expiresAt = expiryDelta ? now + expiryDelta : null;

    let passwordHash = null;
    if (typeof body.password === 'string' && body.password.trim().length > 0) {
      const pw = body.password.trim();
      if (pw.length < 6 || pw.length > 64) {
        throw new HttpError(400, 'Paylaşım şifresi 6 ile 64 karakter arasında olmalıdır.', 'INVALID_SHARE_PASSWORD');
      }
      passwordHash = await hashPassword(pw);
    }

    const slug = generateOpaqueToken(16);
    vault.stmts.insertSharedLink.run(
      slug,
      clean.id,
      session.user_id,
      clean.title,
      clean.payloadJson,
      passwordHash,
      expiresAt,
      now
    );
    vault.logAudit(
      session.user_id,
      'SHARE_CREATED',
      ipHash,
      `Paylaşım linki oluşturuldu: "${clean.title}" (${passwordHash ? 'Şifreli' : 'Açık'})`
    );

    sendJson(res, 201, {
      share: {
        slug,
        mapId: clean.id,
        title: clean.title,
        hasPassword: Boolean(passwordHash),
        expiresAt,
        viewCount: 0,
        createdAt: now,
      },
    });
    return true;
  }

  // DELETE /api/v1/shares/:slug (IDOR-locked to owner_id)
  if (method === 'DELETE' && pathname.startsWith('/api/v1/shares/')) {
    assertCsrfToken(req, session);
    const slug = pathname.slice('/api/v1/shares/'.length);
    if (!/^[a-zA-Z0-9_-]{12,64}$/.test(slug)) {
      throw new HttpError(400, 'Geçersiz paylaşım bağlantısı.', 'INVALID_SLUG');
    }
    const info = vault.stmts.revokeSharedLinkForOwner.run(Date.now(), slug, session.user_id);
    if (!info.changes) {
      throw new HttpError(404, 'Paylaşım bağlantısı bulunamadı.', 'SHARE_NOT_FOUND');
    }
    vault.logAudit(session.user_id, 'SHARE_REVOKED', ipHash, `Paylaşım bağlantısı iptal edildi (${slug.slice(0, 8)}...)`);
    sendJson(res, 200, { ok: true });
    return true;
  }

  return false;
}
