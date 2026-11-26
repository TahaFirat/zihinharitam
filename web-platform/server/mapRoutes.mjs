import {
  HttpError,
  assertCsrfToken,
  hmacDigest,
  readJsonBody,
  sendJson,
  validateAndSanitizeMindMapDoc,
} from './security.mjs';

export async function handleMapRoute(req, res, pathname, ctx) {
  if (!pathname.startsWith('/api/v1/maps')) return false;

  const { vault, serverSecret, session } = ctx;
  if (!session) {
    throw new HttpError(401, 'Bulut haritalarına erişmek için oturum açın.', 'UNAUTHORIZED');
  }

  const method = (req.method || 'GET').toUpperCase();
  const ipHash = hmacDigest(serverSecret, req._clientIp || '127.0.0.1');

  // GET /api/v1/maps
  if (method === 'GET' && pathname === '/api/v1/maps') {
    const rows = vault.stmts.listMapsForUser.all(session.user_id);
    const maps = rows
      .map((row) => {
        try {
          return {
            ...JSON.parse(row.payload_json),
            _cloudVersion: row.version,
          };
        } catch {
          return null;
        }
      })
      .filter(Boolean);

    sendJson(res, 200, { maps, syncedAt: Date.now() });
    return true;
  }

  // POST /api/v1/maps/sync
  if (method === 'POST' && pathname === '/api/v1/maps/sync') {
    assertCsrfToken(req, session);
    const body = await readJsonBody(req, 8 * 1024 * 1024);
    const incoming = Array.isArray(body.maps) ? body.maps : [];
    const deletedIds = Array.isArray(body.deletedIds) ? body.deletedIds : [];
    if (incoming.length > 50) {
      throw new HttpError(400, 'Tek eşitleme isteğinde en fazla 50 harita gönderilebilir.', 'TOO_MANY_MAPS');
    }
    if (deletedIds.length > 120) {
      throw new HttpError(400, 'Tek eşitleme isteğinde en fazla 120 silme kaydı gönderilebilir.', 'TOO_MANY_DELETES');
    }

    let deleted = 0;
    const deleteNow = Date.now();
    for (const rawDelId of deletedIds) {
      if (typeof rawDelId !== 'string' || !/^[a-zA-Z0-9_-]{3,96}$/.test(rawDelId)) {
        continue;
      }
      const info = vault.stmts.softDeleteMapForUser.run(deleteNow, deleteNow, rawDelId, session.user_id);
      if (info.changes) deleted += 1;
    }

    let upserted = 0;
    for (const rawDoc of incoming) {
      const clean = validateAndSanitizeMindMapDoc(rawDoc);
      vault.stmts.upsertMapForUser.run(
        clean.id,
        session.user_id,
        clean.title,
        clean.department,
        clean.docKind,
        clean.nodeCount,
        clean.payloadJson,
        clean.updatedAt
      );
      upserted += 1;
    }

    const latestRows = vault.stmts.listMapsForUser.all(session.user_id);
    const mergedMaps = latestRows
      .map((row) => {
        try {
          return JSON.parse(row.payload_json);
        } catch {
          return null;
        }
      })
      .filter(Boolean);

    sendJson(res, 200, {
      ok: true,
      upserted,
      deleted,
      totalCloudMaps: mergedMaps.length,
      maps: mergedMaps,
      syncedAt: Date.now(),
    });
    return true;
  }

  // GET /api/v1/maps/:mapId (IDOR-locked to session.user_id)
  if (method === 'GET' && pathname.startsWith('/api/v1/maps/')) {
    const mapId = pathname.slice('/api/v1/maps/'.length);
    if (!/^[a-zA-Z0-9_-]{3,96}$/.test(mapId)) {
      throw new HttpError(400, 'Geçersiz harita kimliği.', 'INVALID_MAP_ID');
    }
    const row = vault.stmts.getMapForUser.get(mapId, session.user_id);
    if (!row) {
      throw new HttpError(404, 'Harita bulunamadı.', 'MAP_NOT_FOUND');
    }
    sendJson(res, 200, {
      map: JSON.parse(row.payload_json),
      version: row.version,
    });
    return true;
  }

  // DELETE /api/v1/maps/:mapId (IDOR-locked to session.user_id)
  if (method === 'DELETE' && pathname.startsWith('/api/v1/maps/')) {
    assertCsrfToken(req, session);
    const mapId = pathname.slice('/api/v1/maps/'.length);
    if (!/^[a-zA-Z0-9_-]{3,96}$/.test(mapId)) {
      throw new HttpError(400, 'Geçersiz harita kimliği.', 'INVALID_MAP_ID');
    }
    const now = Date.now();
    const info = vault.stmts.softDeleteMapForUser.run(now, now, mapId, session.user_id);
    if (!info.changes) {
      throw new HttpError(404, 'Harita bulunamadı.', 'MAP_NOT_FOUND');
    }
    vault.logAudit(session.user_id, 'CLOUD_MAP_DELETED', ipHash, `Bulut haritası silindi (${mapId})`);
    sendJson(res, 200, { ok: true });
    return true;
  }

  return false;
}
