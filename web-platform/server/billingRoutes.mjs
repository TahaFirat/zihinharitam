import {
  HttpError,
  assertCsrfToken,
  generateOpaqueToken,
  hmacDigest,
  readJsonBody,
  sanitizeSingleLineText,
  sendJson,
  sha256Hex,
} from './security.mjs';

// Authoritative server-side plan catalog (prices are NEVER accepted from client requests)
const SERVER_PLAN_CATALOG = {
  monthly: {
    tier: 'monthly',
    productId: 'com.tahafirat.zihinharitam.pro_monthly',
    title: 'Aylık Pro',
    amountTry: 349.99,
    displayPrice: '349,99 ₺',
    periodDays: 30,
    trialDays: 0,
    isRecurring: true,
  },
  yearly: {
    tier: 'yearly',
    productId: 'com.tahafirat.zihinharitam.pro_yearly',
    title: 'Yıllık Pro',
    amountTry: 2099.99,
    displayPrice: '2.099,99 ₺',
    periodDays: 365,
    trialDays: 7,
    isRecurring: true,
  },
  lifetime: {
    tier: 'lifetime',
    productId: 'com.tahafirat.zihinharitam.lifetime_pro',
    title: 'Ömür Boyu Pro',
    amountTry: 3499.99,
    displayPrice: '3.499,99 ₺',
    periodDays: null,
    trialDays: 0,
    isRecurring: false,
  },
};

function passesLuhnCheck(digits) {
  let sum = 0;
  let shouldDouble = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = Number(digits[i]);
    if (!Number.isInteger(d)) return false;
    if (shouldDouble) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    shouldDouble = !shouldDouble;
  }
  return sum % 10 === 0;
}

function detectCardBrand(digits) {
  if (/^4/.test(digits)) return 'Visa';
  if (/^(?:5[1-5]|2[2-7])/.test(digits)) return 'Mastercard';
  if (/^3[47]/.test(digits)) return 'American Express';
  if (/^9792|^65/.test(digits)) return 'Troy';
  return 'Kart';
}

function validateCardPayload(body) {
  const holder = sanitizeSingleLineText(String(body.cardholderName || ''), 80);
  if (holder.length < 3) {
    throw new HttpError(400, 'Kart üzerindeki ad soyad en az 3 karakter olmalıdır.', 'INVALID_CARDHOLDER');
  }

  const digits = String(body.cardNumber || '').replace(/[\s-]/g, '');
  if (!/^\d{13,19}$/.test(digits) || !passesLuhnCheck(digits)) {
    throw new HttpError(400, 'Geçersiz kart numarası. Lütfen kontrol edip tekrar deneyin.', 'INVALID_CARD_NUMBER');
  }

  const expiryRaw = String(body.expiry || '').trim();
  const expMatch = expiryRaw.match(/^(\d{2})\s*\/\s*(\d{2}|\d{4})$/);
  if (!expMatch) {
    throw new HttpError(400, 'Son kullanma tarihini AA/YY biçiminde girin.', 'INVALID_EXPIRY');
  }
  const expMonth = Number(expMatch[1]);
  const expYear = expMatch[2].length === 2 ? 2000 + Number(expMatch[2]) : Number(expMatch[2]);
  if (expMonth < 1 || expMonth > 12) {
    throw new HttpError(400, 'Geçersiz son kullanma ayı.', 'INVALID_EXPIRY');
  }
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  if (expYear < currentYear || (expYear === currentYear && expMonth < currentMonth)) {
    throw new HttpError(400, 'Kartınızın son kullanma tarihi geçmiş.', 'CARD_EXPIRED');
  }
  if (expYear > currentYear + 20) {
    throw new HttpError(400, 'Geçersiz son kullanma yılı.', 'INVALID_EXPIRY');
  }

  const cvc = String(body.cvc || '').trim();
  if (!/^\d{3,4}$/.test(cvc)) {
    throw new HttpError(400, 'Güvenlik kodu (CVC) 3 veya 4 haneli olmalıdır.', 'INVALID_CVC');
  }

  // Raw PAN and CVC are immediately discarded; only brand & last4 are ever retained
  return {
    cardBrand: detectCardBrand(digits),
    cardLast4: digits.slice(-4),
  };
}

function buildBillingStatus(vault, userId) {
  const now = Date.now();
  const sub = vault.stmts.getSubscriptionForUser.get(userId);
  const orders = vault.stmts.listBillingOrdersForUser.all(userId);

  if (!sub) {
    return {
      isPro: false,
      planTier: 'free',
      status: 'none',
      trialEligible: true,
      trialEndsAt: null,
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
      orderRef: null,
      orders,
    };
  }

  let active = Boolean(sub.is_pro);
  let status = sub.status;
  if (
    active &&
    sub.plan_tier !== 'lifetime' &&
    sub.current_period_end &&
    sub.current_period_end <= now
  ) {
    active = false;
    status = 'expired';
  }

  return {
    isPro: active,
    planTier: active ? sub.plan_tier : 'free',
    status,
    trialEligible: !sub.trial_used,
    trialEndsAt: sub.trial_ends_at,
    currentPeriodEnd: sub.current_period_end,
    cancelAtPeriodEnd: Boolean(sub.cancel_at_period_end),
    orderRef: sub.order_ref,
    orders,
  };
}

export async function handleBillingRoute(req, res, pathname, ctx) {
  if (!pathname.startsWith('/api/v1/billing')) return false;

  const { vault, serverSecret, session, limiters } = ctx;
  const method = (req.method || 'GET').toUpperCase();
  const ipHash = hmacDigest(serverSecret, req._clientIp || '127.0.0.1');

  // GET /api/v1/billing/status
  if (method === 'GET' && pathname === '/api/v1/billing/status') {
    if (!session) {
      sendJson(res, 200, {
        authenticated: false,
        isPro: false,
        planTier: 'free',
        status: 'none',
        trialEligible: true,
        trialEndsAt: null,
        currentPeriodEnd: null,
        cancelAtPeriodEnd: false,
        orderRef: null,
        orders: [],
        plans: SERVER_PLAN_CATALOG,
      });
      return true;
    }

    const status = buildBillingStatus(vault, session.user_id);
    sendJson(res, 200, {
      authenticated: true,
      ...status,
      plans: SERVER_PLAN_CATALOG,
    });
    return true;
  }

  // All mutating billing routes require authenticated session + CSRF
  if (!session) {
    throw new HttpError(401, 'Satın alma ve abonelik işlemleri için oturum açmanız gerekiyor.', 'UNAUTHORIZED');
  }

  // POST /api/v1/billing/checkout
  if (method === 'POST' && pathname === '/api/v1/billing/checkout') {
    assertCsrfToken(req, session);
    const rate = limiters.billing(session.user_id);
    if (!rate.allowed) {
      sendJson(
        res,
        429,
        { error: 'Çok fazla ödeme denemesi. Lütfen kısa süre sonra tekrar deneyin.', code: 'RATE_LIMITED' },
        { 'Retry-After': String(rate.retryAfterSec) }
      );
      return true;
    }

    const body = await readJsonBody(req, 16 * 1024);
    const tier = typeof body.tier === 'string' ? body.tier.trim().toLowerCase() : '';
    const plan = SERVER_PLAN_CATALOG[tier];
    if (!plan) {
      throw new HttpError(400, 'Geçersiz abonelik planı seçildi.', 'INVALID_PLAN');
    }

    const existingSub = vault.stmts.getSubscriptionForUser.get(session.user_id);
    if (existingSub?.is_pro && existingSub.plan_tier === 'lifetime') {
      throw new HttpError(409, 'Hesabınızda zaten Ömür Boyu Pro lisansı aktif.', 'ALREADY_LIFETIME_PRO');
    }

    const { cardBrand, cardLast4 } = validateCardPayload(body);

    const now = Date.now();
    const isTrial = plan.tier === 'yearly' && !existingSub?.trial_used;
    const trialEndsAt = isTrial ? now + plan.trialDays * 24 * 60 * 60 * 1000 : null;
    const currentPeriodEnd =
      plan.tier === 'lifetime'
        ? null
        : isTrial
          ? trialEndsAt
          : now + plan.periodDays * 24 * 60 * 60 * 1000;

    const orderId = `ord_${generateOpaqueToken(12)}`;
    const receiptNo = `ZH-${new Date(now).getFullYear()}-${generateOpaqueToken(5).toUpperCase()}`;
    const billedAmount = isTrial ? 0 : plan.amountTry;
    const orderStatus = isTrial ? 'trial_started' : 'paid';
    const subStatus = isTrial ? 'trialing' : 'active';

    vault.stmts.insertBillingOrder.run(
      orderId,
      session.user_id,
      plan.tier,
      billedAmount,
      orderStatus,
      cardBrand,
      cardLast4,
      receiptNo,
      now
    );

    vault.stmts.upsertSubscriptionForUser.run(
      session.user_id,
      plan.tier,
      subStatus,
      1,
      isTrial ? 1 : existingSub?.trial_used ? 1 : 0,
      trialEndsAt,
      currentPeriodEnd,
      0,
      receiptNo,
      now
    );

    vault.logAudit(
      session.user_id,
      'BILLING_PURCHASE',
      ipHash,
      `${plan.title} etkinleştirildi (${isTrial ? '7 gün ücretsiz deneme' : plan.displayPrice} · ${cardBrand} •••• ${cardLast4})`
    );

    const updated = buildBillingStatus(vault, session.user_id);
    sendJson(res, 200, {
      ok: true,
      purchased: true,
      isTrial,
      productId: plan.productId,
      transactionId: receiptNo,
      receiptNo,
      billing: updated,
    });
    return true;
  }

  // POST /api/v1/billing/cancel
  if (method === 'POST' && pathname === '/api/v1/billing/cancel') {
    assertCsrfToken(req, session);
    const info = vault.stmts.markSubscriptionCanceledAtEnd.run(Date.now(), session.user_id);
    if (!info.changes) {
      throw new HttpError(400, 'İptal edilebilecek aktif bir yenilenen abonelik bulunamadı.', 'NO_RECURRING_SUB');
    }
    vault.logAudit(session.user_id, 'BILLING_CANCELED', ipHash, 'Abonelik dönem sonunda iptal edilmek üzere işaretlendi');
    const updated = buildBillingStatus(vault, session.user_id);
    sendJson(res, 200, { ok: true, billing: updated });
    return true;
  }

  // POST /api/v1/billing/restore
  if (method === 'POST' && pathname === '/api/v1/billing/restore') {
    assertCsrfToken(req, session);
    const updated = buildBillingStatus(vault, session.user_id);
    sendJson(res, 200, {
      ok: true,
      restored: updated.isPro,
      isLifetimePro: updated.isPro,
      billing: updated,
    });
    return true;
  }

  // POST /api/v1/billing/redeem-promo
  if (method === 'POST' && pathname === '/api/v1/billing/redeem-promo') {
    assertCsrfToken(req, session);
    const rate = limiters.billing(`promo:${session.user_id}`);
    if (!rate.allowed) {
      sendJson(
        res,
        429,
        { error: 'Çok fazla kod denemesi. Lütfen birkaç dakika bekleyin.', code: 'RATE_LIMITED' },
        { 'Retry-After': String(rate.retryAfterSec) }
      );
      return true;
    }

    const body = await readJsonBody(req, 4 * 1024);
    const rawCode = sanitizeSingleLineText(String(body.code || ''), 48).toUpperCase();
    if (!/^[A-Z0-9-]{6,40}$/.test(rawCode)) {
      throw new HttpError(400, 'Geçersiz hediye kodu formatı.', 'INVALID_PROMO');
    }

    const codeHash = sha256Hex(rawCode);
    const allowedPromoHashes = new Set(
      String(process.env.WEB_PROMO_HASHES || '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    );
    // Allow pre-verified client PromoCodeManager hash matching only against known allowlist or server env
    if (!allowedPromoHashes.has(codeHash)) {
      throw new HttpError(404, 'Bu hediye kodu geçersiz veya süresi dolmuş.', 'PROMO_NOT_FOUND');
    }
    const used = vault.stmts.findUsedPromoCode.get(codeHash);
    if (used) {
      throw new HttpError(409, 'Bu hediye kodu daha önce kullanılmış.', 'PROMO_ALREADY_USED');
    }

    const now = Date.now();
    const receiptNo = `ZH-GIFT-${generateOpaqueToken(5).toUpperCase()}`;
    vault.stmts.insertUsedPromoCode.run(codeHash, session.user_id, now);
    vault.stmts.insertBillingOrder.run(
      `ord_${generateOpaqueToken(12)}`,
      session.user_id,
      'lifetime',
      0,
      'promo_redeemed',
      'Hediye Kodu',
      'GIFT',
      receiptNo,
      now
    );
    vault.stmts.upsertSubscriptionForUser.run(
      session.user_id,
      'lifetime',
      'active',
      1,
      1,
      null,
      null,
      0,
      receiptNo,
      now
    );
    vault.logAudit(session.user_id, 'PROMO_REDEEMED', ipHash, 'Hediye kodu ile Ömür Boyu Pro etkinleştirildi');

    const updated = buildBillingStatus(vault, session.user_id);
    sendJson(res, 200, { ok: true, redeemed: true, billing: updated });
    return true;
  }

  return false;
}
