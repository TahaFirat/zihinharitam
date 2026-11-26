import {
  HttpError,
  assertCsrfToken,
  buildSessionCookie,
  clearSessionCookie,
  generateOpaqueToken,
  getDummyPasswordHash,
  hashPassword,
  hmacDigest,
  readJsonBody,
  sanitizeLogValue,
  sendJson,
  sha256Hex,
  validateDisplayName,
  validateEmail,
  validatePasswordStrength,
  verifyPassword,
} from './security.mjs';

const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_FAILED_LOGINS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000;

function summarizeUserAgent(rawUa) {
  const ua = sanitizeLogValue(rawUa || 'Tarayıcı', 160);
  let browser = 'Tarayıcı';
  if (/Edg\//i.test(ua)) browser = 'Microsoft Edge';
  else if (/Chrome\//i.test(ua)) browser = 'Google Chrome';
  else if (/Firefox\//i.test(ua)) browser = 'Mozilla Firefox';
  else if (/Safari\//i.test(ua)) browser = 'Safari';

  let os = 'Masaüstü';
  if (/Windows/i.test(ua)) os = 'Windows';
  else if (/Mac OS X|Macintosh/i.test(ua)) os = 'macOS';
  else if (/iPhone|iPad/i.test(ua)) os = 'iOS / iPadOS';
  else if (/Android/i.test(ua)) os = 'Android';
  else if (/Linux/i.test(ua)) os = 'Linux';

  return `${browser} · ${os}`;
}

function issueNewSession(req, vault, serverSecret, userId) {
  const now = Date.now();
  const rawToken = generateOpaqueToken(32);
  const idHash = sha256Hex(rawToken);
  const sessionId = `ses_${generateOpaqueToken(12)}`;
  const csrfToken = generateOpaqueToken(24);
  const ipHash = hmacDigest(serverSecret, req._clientIp || '127.0.0.1');
  const uaSummary = summarizeUserAgent(req.headers['user-agent']);

  vault.stmts.insertSession.run(
    sessionId,
    idHash,
    userId,
    csrfToken,
    ipHash,
    uaSummary,
    now,
    now,
    now + SESSION_TTL_MS
  );

  return {
    rawToken,
    sessionId,
    csrfToken,
    cookieHeader: buildSessionCookie(req, rawToken, Math.floor(SESSION_TTL_MS / 1000)),
  };
}

export async function handleAuthRoute(req, res, pathname, ctx) {
  const { vault, serverSecret, session, limiters } = ctx;
  const method = (req.method || 'GET').toUpperCase();
  const ipHash = hmacDigest(serverSecret, req._clientIp || '127.0.0.1');

  // GET /api/v1/auth/me
  if (method === 'GET' && pathname === '/api/v1/auth/me') {
    if (!session) {
      sendJson(res, 200, { authenticated: false, user: null, csrfToken: null });
      return true;
    }
    sendJson(res, 200, {
      authenticated: true,
      csrfToken: session.csrf_token,
      user: {
        id: session.user_id,
        email: session.email,
        displayName: session.display_name,
        role: session.role,
        createdAt: session.user_created_at,
      },
    });
    return true;
  }

  // POST /api/v1/auth/register
  if (method === 'POST' && pathname === '/api/v1/auth/register') {
    const rate = limiters.register(ipHash);
    if (!rate.allowed) {
      sendJson(
        res,
        429,
        { error: 'Çok fazla kayıt denemesi. Lütfen birkaç dakika sonra tekrar deneyin.', code: 'RATE_LIMITED' },
        { 'Retry-After': String(rate.retryAfterSec) }
      );
      return true;
    }

    const body = await readJsonBody(req, 16 * 1024);
    const emailRes = validateEmail(body.email);
    if (!emailRes.ok) throw new HttpError(400, emailRes.error, 'INVALID_EMAIL');

    const nameRes = validateDisplayName(body.displayName);
    if (!nameRes.ok) throw new HttpError(400, nameRes.error, 'INVALID_NAME');

    const pwRes = validatePasswordStrength(body.password, emailRes.email);
    if (!pwRes.ok) throw new HttpError(400, pwRes.error, 'WEAK_PASSWORD');

    const existing = vault.stmts.findUserByEmail.get(emailRes.email);
    if (existing) {
      // Spend equivalent scrypt work so registration timing stays uniform
      await verifyPassword(body.password, await getDummyPasswordHash());
      throw new HttpError(409, 'Bu e-posta adresi ile kayıt tamamlanamadı. Zaten hesabınız varsa giriş yapın.', 'EMAIL_CONFLICT');
    }

    const userId = `usr_${generateOpaqueToken(14)}`;
    const now = Date.now();
    const passwordHash = await hashPassword(body.password);

    try {
      vault.stmts.insertUser.run(
        userId,
        emailRes.email,
        nameRes.displayName,
        passwordHash,
        now,
        now,
        now
      );
    } catch {
      throw new HttpError(409, 'Bu e-posta adresi ile kayıt tamamlanamadı.', 'EMAIL_CONFLICT');
    }

    const issued = issueNewSession(req, vault, serverSecret, userId);
    vault.logAudit(userId, 'REGISTER', ipHash, `Yeni hesap oluşturuldu (${summarizeUserAgent(req.headers['user-agent'])})`);

    sendJson(
      res,
      201,
      {
        authenticated: true,
        csrfToken: issued.csrfToken,
        user: {
          id: userId,
          email: emailRes.email,
          displayName: nameRes.displayName,
          role: 'user',
          createdAt: now,
        },
      },
      { 'Set-Cookie': issued.cookieHeader }
    );
    return true;
  }

  // POST /api/v1/auth/login
  if (method === 'POST' && pathname === '/api/v1/auth/login') {
    const rate = limiters.login(ipHash);
    if (!rate.allowed) {
      sendJson(
        res,
        429,
        { error: 'Çok fazla giriş denemesi. Güvenlik için geçici olarak sınırlandı.', code: 'RATE_LIMITED' },
        { 'Retry-After': String(rate.retryAfterSec) }
      );
      return true;
    }

    const body = await readJsonBody(req, 16 * 1024);
    const emailRes = validateEmail(body.email);
    const password = typeof body.password === 'string' ? body.password : '';
    if (!emailRes.ok || password.length < 1 || password.length > 128) {
      await verifyPassword('invalid', await getDummyPasswordHash());
      throw new HttpError(401, 'E-posta veya şifre hatalı.', 'INVALID_CREDENTIALS');
    }

    const user = vault.stmts.findUserByEmail.get(emailRes.email);
    const now = Date.now();

    if (!user) {
      await verifyPassword(password, await getDummyPasswordHash());
      throw new HttpError(401, 'E-posta veya şifre hatalı.', 'INVALID_CREDENTIALS');
    }

    if (user.locked_until && user.locked_until > now) {
      const waitMin = Math.max(1, Math.ceil((user.locked_until - now) / 60_000));
      vault.logAudit(user.id, 'LOGIN_BLOCKED_LOCKOUT', ipHash, 'Kilitli hesaba giriş denemesi engellendi');
      throw new HttpError(
        423,
        `Çok fazla hatalı deneme nedeniyle hesap geçici olarak kilitlendi. ${waitMin} dk sonra tekrar deneyin.`,
        'ACCOUNT_LOCKED'
      );
    }

    const valid = await verifyPassword(password, user.password_hash);
    if (!valid) {
      const nextFails = (user.failed_login_attempts || 0) + 1;
      const lockedUntil = nextFails >= MAX_FAILED_LOGINS ? now + LOCKOUT_DURATION_MS : 0;
      vault.stmts.updateLoginFailure.run(nextFails, lockedUntil, now, user.id);
      vault.logAudit(
        user.id,
        lockedUntil ? 'ACCOUNT_LOCKED' : 'LOGIN_FAILED',
        ipHash,
        lockedUntil
          ? `${MAX_FAILED_LOGINS} hatalı şifre sonrası 15 dk güvenlik kilidi`
          : `Hatalı şifre denemesi (${nextFails}/${MAX_FAILED_LOGINS})`
      );
      if (lockedUntil) {
        throw new HttpError(
          423,
          'Çok fazla hatalı şifre denemesi nedeniyle hesap 15 dakika kilitlendi.',
          'ACCOUNT_LOCKED'
        );
      }
      throw new HttpError(401, 'E-posta veya şifre hatalı.', 'INVALID_CREDENTIALS');
    }

    // Rotate any existing session on re-login (prevents session fixation)
    if (session) {
      vault.stmts.revokeSessionByIdAndUser.run(now, session.session_id, session.user_id);
    }
    vault.stmts.resetLoginFailures.run(now, user.id);
    const issued = issueNewSession(req, vault, serverSecret, user.id);
    vault.logAudit(user.id, 'LOGIN_SUCCESS', ipHash, `Oturum açıldı (${summarizeUserAgent(req.headers['user-agent'])})`);

    sendJson(
      res,
      200,
      {
        authenticated: true,
        csrfToken: issued.csrfToken,
        user: {
          id: user.id,
          email: user.email,
          displayName: user.display_name,
          role: user.role,
          createdAt: user.created_at,
        },
      },
      { 'Set-Cookie': issued.cookieHeader }
    );
    return true;
  }

  // POST /api/v1/auth/logout
  if (method === 'POST' && pathname === '/api/v1/auth/logout') {
    if (session) {
      assertCsrfToken(req, session);
      vault.stmts.revokeSessionByIdAndUser.run(Date.now(), session.session_id, session.user_id);
      vault.logAudit(session.user_id, 'LOGOUT', ipHash, 'Oturum güvenli şekilde sonlandırıldı');
    }
    sendJson(res, 200, { ok: true }, { 'Set-Cookie': clearSessionCookie(req) });
    return true;
  }

  // Protected account routes below require authenticated session
  if (pathname.startsWith('/api/v1/auth/')) {
    if (!session) {
      throw new HttpError(401, 'Bu işlem için oturum açmanız gerekiyor.', 'UNAUTHORIZED');
    }

    // PATCH /api/v1/auth/profile
    if (method === 'PATCH' && pathname === '/api/v1/auth/profile') {
      assertCsrfToken(req, session);
      const body = await readJsonBody(req, 8 * 1024);
      const nameRes = validateDisplayName(body.displayName);
      if (!nameRes.ok) throw new HttpError(400, nameRes.error, 'INVALID_NAME');

      vault.stmts.updateUserProfile.run(nameRes.displayName, Date.now(), session.user_id);
      vault.logAudit(session.user_id, 'PROFILE_UPDATED', ipHash, 'Profil görünen adı güncellendi');
      sendJson(res, 200, {
        ok: true,
        user: {
          id: session.user_id,
          email: session.email,
          displayName: nameRes.displayName,
          role: session.role,
          createdAt: session.user_created_at,
        },
      });
      return true;
    }

    // POST /api/v1/auth/change-password
    if (method === 'POST' && pathname === '/api/v1/auth/change-password') {
      assertCsrfToken(req, session);
      const rate = limiters.passwordChange(session.user_id);
      if (!rate.allowed) {
        sendJson(
          res,
          429,
          { error: 'Çok fazla şifre değişikliği denemesi.', code: 'RATE_LIMITED' },
          { 'Retry-After': String(rate.retryAfterSec) }
        );
        return true;
      }

      const body = await readJsonBody(req, 8 * 1024);
      const currentPassword = typeof body.currentPassword === 'string' ? body.currentPassword : '';
      const newPassword = typeof body.newPassword === 'string' ? body.newPassword : '';

      const user = vault.stmts.findUserById.get(session.user_id);
      if (!user || !(await verifyPassword(currentPassword, user.password_hash))) {
        vault.logAudit(session.user_id, 'PASSWORD_CHANGE_FAILED', ipHash, 'Mevcut şifre doğrulanamadı');
        throw new HttpError(401, 'Mevcut şifreniz hatalı.', 'INVALID_CURRENT_PASSWORD');
      }

      const pwRes = validatePasswordStrength(newPassword, user.email);
      if (!pwRes.ok) throw new HttpError(400, pwRes.error, 'WEAK_PASSWORD');

      const now = Date.now();
      const newHash = await hashPassword(newPassword);
      vault.stmts.updateUserPassword.run(newHash, now, now, user.id);
      // Revoke ALL old sessions including the current one and issue a brand new rotated session
      vault.stmts.revokeAllSessionsForUser.run(now, user.id);
      const issued = issueNewSession(req, vault, serverSecret, user.id);
      vault.logAudit(user.id, 'PASSWORD_CHANGED', ipHash, 'Şifre değiştirildi ve tüm eski oturumlar kapatıldı');

      sendJson(
        res,
        200,
        { ok: true, csrfToken: issued.csrfToken },
        { 'Set-Cookie': issued.cookieHeader }
      );
      return true;
    }

    // GET /api/v1/auth/sessions
    if (method === 'GET' && pathname === '/api/v1/auth/sessions') {
      const rows = vault.stmts.listActiveSessionsForUser.all(session.user_id, Date.now());
      sendJson(res, 200, {
        sessions: rows.map((r) => ({
          sessionId: r.session_id,
          device: r.ua_summary,
          createdAt: r.created_at,
          lastSeenAt: r.last_seen_at,
          expiresAt: r.expires_at,
          isCurrent: r.session_id === session.session_id,
        })),
      });
      return true;
    }

    // POST /api/v1/auth/sessions/revoke-others
    if (method === 'POST' && pathname === '/api/v1/auth/sessions/revoke-others') {
      assertCsrfToken(req, session);
      vault.stmts.revokeOtherSessionsForUser.run(Date.now(), session.user_id, session.session_id);
      vault.logAudit(session.user_id, 'SESSIONS_REVOKED_OTHERS', ipHash, 'Diğer tüm cihaz oturumları sonlandırıldı');
      sendJson(res, 200, { ok: true });
      return true;
    }

    // DELETE /api/v1/auth/sessions/:sessionId
    if (method === 'DELETE' && pathname.startsWith('/api/v1/auth/sessions/')) {
      assertCsrfToken(req, session);
      const targetId = pathname.slice('/api/v1/auth/sessions/'.length);
      if (!/^[a-zA-Z0-9_-]{8,64}$/.test(targetId)) {
        throw new HttpError(400, 'Geçersiz oturum kimliği.', 'INVALID_SESSION_ID');
      }
      const info = vault.stmts.revokeSessionByIdAndUser.run(Date.now(), targetId, session.user_id);
      if (!info.changes) {
        throw new HttpError(404, 'Oturum bulunamadı.', 'SESSION_NOT_FOUND');
      }
      vault.logAudit(session.user_id, 'SESSION_REVOKED', ipHash, `Oturum sonlandırıldı (${targetId.slice(0, 10)}...)`);
      const extraHeaders = targetId === session.session_id ? { 'Set-Cookie': clearSessionCookie(req) } : {};
      sendJson(res, 200, { ok: true }, extraHeaders);
      return true;
    }

    // GET /api/v1/auth/audit-logs
    if (method === 'GET' && pathname === '/api/v1/auth/audit-logs') {
      const logs = vault.stmts.listAuditLogsForUser.all(session.user_id);
      sendJson(res, 200, { logs });
      return true;
    }

    // DELETE /api/v1/auth/account
    if (method === 'DELETE' && pathname === '/api/v1/auth/account') {
      assertCsrfToken(req, session);
      const body = await readJsonBody(req, 8 * 1024);
      const password = typeof body.password === 'string' ? body.password : '';
      const user = vault.stmts.findUserById.get(session.user_id);
      if (!user || !(await verifyPassword(password, user.password_hash))) {
        throw new HttpError(401, 'Hesabı silmek için mevcut şifrenizi doğru girmelisiniz.', 'INVALID_PASSWORD');
      }
      vault.stmts.deleteUserById.run(user.id);
      sendJson(res, 200, { ok: true }, { 'Set-Cookie': clearSessionCookie(req) });
      return true;
    }
  }

  return false;
}
