import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

/**
 * 100% Parameterized Prepared-Statement SQLite Vault (Node.js 24 native `node:sqlite`)
 * Zero string interpolation in SQL queries -> Immune to SQL Injection by construction.
 */
export function createVaultDb(dbPath) {
  if (dbPath !== ':memory:') {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  }
  const db = new DatabaseSync(dbPath);

  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
    PRAGMA synchronous = NORMAL;
    PRAGMA busy_timeout = 5000;
    PRAGMA secure_delete = ON;

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE COLLATE NOCASE,
      display_name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user',
      failed_login_attempts INTEGER NOT NULL DEFAULT 0,
      locked_until INTEGER NOT NULL DEFAULT 0,
      password_changed_at INTEGER NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessions (
      session_id TEXT PRIMARY KEY,
      id_hash TEXT NOT NULL UNIQUE,
      user_id TEXT NOT NULL,
      csrf_token TEXT NOT NULL,
      ip_hash TEXT NOT NULL,
      ua_summary TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      last_seen_at INTEGER NOT NULL,
      expires_at INTEGER NOT NULL,
      revoked_at INTEGER DEFAULT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
    CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);

    CREATE TABLE IF NOT EXISTS cloud_maps (
      id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      title TEXT NOT NULL,
      department TEXT NOT NULL,
      doc_kind TEXT NOT NULL DEFAULT 'mindmap',
      node_count INTEGER NOT NULL DEFAULT 0,
      payload_json TEXT NOT NULL,
      version INTEGER NOT NULL DEFAULT 1,
      updated_at INTEGER NOT NULL,
      deleted_at INTEGER DEFAULT NULL,
      PRIMARY KEY (id, user_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_cloud_maps_user_updated ON cloud_maps(user_id, updated_at DESC);

    CREATE TABLE IF NOT EXISTS shared_links (
      slug TEXT PRIMARY KEY,
      map_id TEXT NOT NULL,
      owner_id TEXT NOT NULL,
      title TEXT NOT NULL,
      snapshot_json TEXT NOT NULL,
      password_hash TEXT DEFAULT NULL,
      expires_at INTEGER DEFAULT NULL,
      view_count INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      revoked_at INTEGER DEFAULT NULL,
      FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_shared_links_owner ON shared_links(owner_id, created_at DESC);

    CREATE TABLE IF NOT EXISTS security_audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      event_type TEXT NOT NULL,
      ip_hash TEXT NOT NULL,
      detail TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_audit_user_created ON security_audit_logs(user_id, created_at DESC);

    CREATE TABLE IF NOT EXISTS subscriptions (
      user_id TEXT PRIMARY KEY,
      plan_tier TEXT NOT NULL DEFAULT 'free',
      status TEXT NOT NULL DEFAULT 'none',
      is_pro INTEGER NOT NULL DEFAULT 0,
      trial_used INTEGER NOT NULL DEFAULT 0,
      trial_ends_at INTEGER DEFAULT NULL,
      current_period_end INTEGER DEFAULT NULL,
      cancel_at_period_end INTEGER NOT NULL DEFAULT 0,
      order_ref TEXT DEFAULT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS billing_orders (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      plan_tier TEXT NOT NULL,
      amount_try REAL NOT NULL,
      currency TEXT NOT NULL DEFAULT 'TRY',
      status TEXT NOT NULL,
      card_brand TEXT NOT NULL,
      card_last4 TEXT NOT NULL,
      receipt_no TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_orders_user_created ON billing_orders(user_id, created_at DESC);

    CREATE TABLE IF NOT EXISTS used_promo_codes (
      code_hash TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      redeemed_at INTEGER NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);

  const stmts = {
    // Users
    findUserByEmail: db.prepare(
      `SELECT id, email, display_name, password_hash, role, failed_login_attempts, locked_until, password_changed_at, created_at, updated_at
       FROM users WHERE email = ? LIMIT 1`
    ),
    findUserById: db.prepare(
      `SELECT id, email, display_name, password_hash, role, failed_login_attempts, locked_until, password_changed_at, created_at, updated_at
       FROM users WHERE id = ? LIMIT 1`
    ),
    insertUser: db.prepare(
      `INSERT INTO users (id, email, display_name, password_hash, role, failed_login_attempts, locked_until, password_changed_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'user', 0, 0, ?, ?, ?)`
    ),
    updateLoginFailure: db.prepare(
      `UPDATE users SET failed_login_attempts = ?, locked_until = ?, updated_at = ? WHERE id = ?`
    ),
    resetLoginFailures: db.prepare(
      `UPDATE users SET failed_login_attempts = 0, locked_until = 0, updated_at = ? WHERE id = ?`
    ),
    updateUserProfile: db.prepare(
      `UPDATE users SET display_name = ?, updated_at = ? WHERE id = ?`
    ),
    updateUserPassword: db.prepare(
      `UPDATE users SET password_hash = ?, password_changed_at = ?, updated_at = ? WHERE id = ?`
    ),
    deleteUserById: db.prepare(`DELETE FROM users WHERE id = ?`),

    // Sessions
    insertSession: db.prepare(
      `INSERT INTO sessions (session_id, id_hash, user_id, csrf_token, ip_hash, ua_summary, created_at, last_seen_at, expires_at, revoked_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)`
    ),
    findActiveSessionByHash: db.prepare(
      `SELECT s.session_id, s.id_hash, s.user_id, s.csrf_token, s.ip_hash, s.ua_summary, s.created_at, s.last_seen_at, s.expires_at,
              u.email, u.display_name, u.role, u.created_at AS user_created_at
       FROM sessions s
       INNER JOIN users u ON u.id = s.user_id
       WHERE s.id_hash = ? AND s.revoked_at IS NULL AND s.expires_at > ?
       LIMIT 1`
    ),
    touchSession: db.prepare(
      `UPDATE sessions SET last_seen_at = ? WHERE session_id = ?`
    ),
    revokeSessionByIdAndUser: db.prepare(
      `UPDATE sessions SET revoked_at = ? WHERE session_id = ? AND user_id = ? AND revoked_at IS NULL`
    ),
    revokeOtherSessionsForUser: db.prepare(
      `UPDATE sessions SET revoked_at = ? WHERE user_id = ? AND session_id != ? AND revoked_at IS NULL`
    ),
    revokeAllSessionsForUser: db.prepare(
      `UPDATE sessions SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL`
    ),
    listActiveSessionsForUser: db.prepare(
      `SELECT session_id, ua_summary, created_at, last_seen_at, expires_at
       FROM sessions
       WHERE user_id = ? AND revoked_at IS NULL AND expires_at > ?
       ORDER BY last_seen_at DESC
       LIMIT 25`
    ),
    pruneExpiredSessions: db.prepare(
      `DELETE FROM sessions WHERE expires_at <= ? OR (revoked_at IS NOT NULL AND revoked_at <= ?)`
    ),

    // Cloud Maps (strictly scoped by user_id to prevent IDOR)
    listMapsForUser: db.prepare(
      `SELECT id, title, department, doc_kind, node_count, payload_json, version, updated_at
       FROM cloud_maps
       WHERE user_id = ? AND deleted_at IS NULL
       ORDER BY updated_at DESC
       LIMIT 200`
    ),
    getMapForUser: db.prepare(
      `SELECT id, title, department, doc_kind, node_count, payload_json, version, updated_at
       FROM cloud_maps
       WHERE id = ? AND user_id = ? AND deleted_at IS NULL
       LIMIT 1`
    ),
    upsertMapForUser: db.prepare(
      `INSERT INTO cloud_maps (id, user_id, title, department, doc_kind, node_count, payload_json, version, updated_at, deleted_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, NULL)
       ON CONFLICT(id, user_id) DO UPDATE SET
         title = excluded.title,
         department = excluded.department,
         doc_kind = excluded.doc_kind,
         node_count = excluded.node_count,
         payload_json = excluded.payload_json,
         version = cloud_maps.version + 1,
         updated_at = excluded.updated_at,
         deleted_at = NULL
       WHERE excluded.updated_at >= cloud_maps.updated_at OR cloud_maps.deleted_at IS NOT NULL`
    ),
    softDeleteMapForUser: db.prepare(
      `UPDATE cloud_maps SET deleted_at = ?, updated_at = ? WHERE id = ? AND user_id = ?`
    ),

    // Shared Links
    insertSharedLink: db.prepare(
      `INSERT INTO shared_links (slug, map_id, owner_id, title, snapshot_json, password_hash, expires_at, view_count, created_at, revoked_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, NULL)`
    ),
    listSharedLinksForOwner: db.prepare(
      `SELECT slug, map_id, title, (password_hash IS NOT NULL) AS has_password, expires_at, view_count, created_at
       FROM shared_links
       WHERE owner_id = ? AND revoked_at IS NULL
       ORDER BY created_at DESC
       LIMIT 50`
    ),
    revokeSharedLinkForOwner: db.prepare(
      `UPDATE shared_links SET revoked_at = ? WHERE slug = ? AND owner_id = ? AND revoked_at IS NULL`
    ),
    findPublicSharedLink: db.prepare(
      `SELECT slug, map_id, title, snapshot_json, password_hash, expires_at, view_count, created_at
       FROM shared_links
       WHERE slug = ? AND revoked_at IS NULL
       LIMIT 1`
    ),
    incrementShareViewCount: db.prepare(
      `UPDATE shared_links SET view_count = view_count + 1 WHERE slug = ?`
    ),

    // Security Audit Logs
    insertAuditLog: db.prepare(
      `INSERT INTO security_audit_logs (user_id, event_type, ip_hash, detail, created_at)
       VALUES (?, ?, ?, ?, ?)`
    ),
    listAuditLogsForUser: db.prepare(
      `SELECT id, event_type, detail, created_at
       FROM security_audit_logs
       WHERE user_id = ?
       ORDER BY created_at DESC
       LIMIT 30`
    ),

    // Subscriptions & Billing Orders (strictly bound to user_id)
    getSubscriptionForUser: db.prepare(
      `SELECT user_id, plan_tier, status, is_pro, trial_used, trial_ends_at, current_period_end, cancel_at_period_end, order_ref, updated_at
       FROM subscriptions
       WHERE user_id = ?
       LIMIT 1`
    ),
    upsertSubscriptionForUser: db.prepare(
      `INSERT INTO subscriptions (user_id, plan_tier, status, is_pro, trial_used, trial_ends_at, current_period_end, cancel_at_period_end, order_ref, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(user_id) DO UPDATE SET
         plan_tier = excluded.plan_tier,
         status = excluded.status,
         is_pro = excluded.is_pro,
         trial_used = MAX(subscriptions.trial_used, excluded.trial_used),
         trial_ends_at = excluded.trial_ends_at,
         current_period_end = excluded.current_period_end,
         cancel_at_period_end = excluded.cancel_at_period_end,
         order_ref = excluded.order_ref,
         updated_at = excluded.updated_at`
    ),
    markSubscriptionCanceledAtEnd: db.prepare(
      `UPDATE subscriptions SET cancel_at_period_end = 1, updated_at = ? WHERE user_id = ? AND plan_tier IN ('monthly', 'yearly') AND is_pro = 1`
    ),
    insertBillingOrder: db.prepare(
      `INSERT INTO billing_orders (id, user_id, plan_tier, amount_try, currency, status, card_brand, card_last4, receipt_no, created_at)
       VALUES (?, ?, ?, ?, 'TRY', ?, ?, ?, ?, ?)`
    ),
    listBillingOrdersForUser: db.prepare(
      `SELECT id, plan_tier, amount_try, currency, status, card_brand, card_last4, receipt_no, created_at
       FROM billing_orders
       WHERE user_id = ?
       ORDER BY created_at DESC
       LIMIT 20`
    ),
    findUsedPromoCode: db.prepare(
      `SELECT code_hash, user_id, redeemed_at FROM used_promo_codes WHERE code_hash = ? LIMIT 1`
    ),
    insertUsedPromoCode: db.prepare(
      `INSERT INTO used_promo_codes (code_hash, user_id, redeemed_at) VALUES (?, ?, ?)`
    ),
  };

  function logAudit(userId, eventType, ipHash, detail) {
    stmts.insertAuditLog.run(userId, eventType, ipHash, String(detail || '').slice(0, 200), Date.now());
  }

  function close() {
    db.close();
  }

  return { db, stmts, logAudit, close };
}
