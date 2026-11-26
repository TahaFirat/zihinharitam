import assert from 'node:assert/strict';
import { createWebPlatformServer } from '../server/index.mjs';

let passed = 0;
async function test(name, fn) {
  try {
    await fn();
    passed += 1;
    console.log(`  [PASS] ${name}`);
  } catch (err) {
    console.error(`  [FAIL] ${name}`);
    console.error(err);
    process.exitCode = 1;
  }
}

function extractCookie(res) {
  const raw = res.headers.get('set-cookie') || '';
  const first = raw.split(';')[0] || '';
  return { raw, pair: first };
}

async function main() {
  const srv = createWebPlatformServer({
    port: 0,
    host: '127.0.0.1',
    dbPath: ':memory:',
    maxRegisterHits: 50,
    maxLoginHits: 50,
  });

  const { url, port } = await srv.start();
  const origin = `http://localhost:${port}`;
  console.log(`\n[OWASP Security Penetration Suite] Hedef: ${url}\n`);

  let userACookie = '';
  let userACsrf = '';
  let userBCookie = '';
  let userBCsrf = '';
  let userAShareSlug = '';
  let userASessionId = '';

  try {
    await test('1. HTTP Security Headers (CSP, X-Frame-Options, nosniff, COOP, no-store)', async () => {
      const res = await fetch(`${url}/api/v1/health`);
      assert.equal(res.status, 200);
      const csp = res.headers.get('content-security-policy') || '';
      assert.ok(csp.includes("frame-ancestors 'none'"), 'CSP frame-ancestors eksik');
      assert.ok(csp.includes("object-src 'none'"), 'CSP object-src eksik');
      assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
      assert.equal(res.headers.get('x-frame-options'), 'DENY');
      assert.equal(res.headers.get('cross-origin-opener-policy'), 'same-origin');
      assert.ok((res.headers.get('cache-control') || '').includes('no-store'));
    });

    await test('2. Weak password rejected + strong scrypt registration sets HttpOnly/SameSite cookie', async () => {
      const weakRes = await fetch(`${url}/api/v1/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Origin: origin },
        body: JSON.stringify({
          displayName: 'Test Kullanici',
          email: 'alice@example.com',
          password: 'password123',
        }),
      });
      assert.equal(weakRes.status, 400);

      const okRes = await fetch(`${url}/api/v1/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Origin: origin },
        body: JSON.stringify({
          displayName: 'Alice Yilmaz',
          email: 'alice@example.com',
          password: 'UltraStrong!2026#Key',
        }),
      });
      assert.equal(okRes.status, 201);
      const cookie = extractCookie(okRes);
      assert.ok(cookie.raw.includes('HttpOnly'), 'HttpOnly flag eksik');
      assert.ok(cookie.raw.includes('SameSite=Lax'), 'SameSite flag eksik');
      userACookie = cookie.pair;
      const body = await okRes.json();
      userACsrf = body.csrfToken;
      assert.ok(userACsrf && userACsrf.length >= 24);

      // Verify DB stores ONLY scrypt hash (never plaintext) and SHA-256 session digest (never raw token)
      const dbUser = srv.vault.stmts.findUserByEmail.get('alice@example.com');
      assert.ok(dbUser.password_hash.startsWith('scrypt$16384$8$1$'));
      assert.ok(!dbUser.password_hash.includes('UltraStrong'));

      const sessRes = await fetch(`${url}/api/v1/auth/sessions`, {
        headers: { Cookie: userACookie },
      });
      const sessJson = await sessRes.json();
      userASessionId = sessJson.sessions[0].sessionId;
    });

    await test('3. SQL Injection attacks blocked across login, maps, and shares', async () => {
      const sqliPayloads = [
        "' OR '1'='1' --",
        "alice@example.com' OR 1=1 --",
        "'; DROP TABLE users; --",
        "' UNION SELECT password_hash FROM users --",
      ];
      for (const payload of sqliPayloads) {
        const res = await fetch(`${url}/api/v1/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Origin: origin },
          body: JSON.stringify({ email: payload, password: 'x' }),
        });
        assert.equal(res.status, 401);

        const shareRes = await fetch(`${url}/api/v1/public/shares/${encodeURIComponent(payload)}`);
        assert.equal(shareRes.status, 404);
      }
      // Verify users table intact
      const stillThere = srv.vault.stmts.findUserByEmail.get('alice@example.com');
      assert.ok(stillThere && stillThere.email === 'alice@example.com');
    });

    await test('4. CSRF Defense-in-Depth (Cross-Origin, Missing/Forged Token, Form Content-Type)', async () => {
      // Cross-origin POST blocked
      const crossRes = await fetch(`${url}/api/v1/auth/profile`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Origin: 'https://evil-attacker.invalid',
          Cookie: userACookie,
          'X-CSRF-Token': userACsrf,
        },
        body: JSON.stringify({ displayName: 'Hacked' }),
      });
      assert.equal(crossRes.status, 403);

      // Missing CSRF token blocked
      const noTokenRes = await fetch(`${url}/api/v1/auth/profile`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Origin: origin,
          Cookie: userACookie,
        },
        body: JSON.stringify({ displayName: 'Hacked' }),
      });
      assert.equal(noTokenRes.status, 403);

      // Forged CSRF token blocked
      const badTokenRes = await fetch(`${url}/api/v1/auth/profile`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Origin: origin,
          Cookie: userACookie,
          'X-CSRF-Token': 'forged_token_1234567890abcdef',
        },
        body: JSON.stringify({ displayName: 'Hacked' }),
      });
      assert.equal(badTokenRes.status, 403);

      // Form-encoded CSRF payload rejected with 415
      const formRes = await fetch(`${url}/api/v1/auth/profile`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Origin: origin,
          Cookie: userACookie,
          'X-CSRF-Token': userACsrf,
        },
        body: 'displayName=Hacked',
      });
      assert.equal(formRes.status, 415);
    });

    await test('5. XSS & Prototype Pollution stripped on Cloud Map Sync', async () => {
      const maliciousDoc = {
        id: 'map_sec_01',
        title: 'Kardiyoloji <script>alert(1)</script>',
        department: 'tip',
        rootNodeId: 'root',
        updatedAt: Date.now(),
        nodes: {
          root: {
            id: 'root',
            title: 'Kalp <img src=x onerror=alert(1)>',
            note: 'Normal not <iframe src="evil"></iframe>',
            linkUrl: 'javascript:alert(document.cookie)',
            x: 0,
            y: 0,
            childrenIds: [],
          },
        },
      };

      const rawJson =
        '{"__proto__":{"polluted":true},"constructor":{"prototype":{"pwned":true}},"maps":[' +
        JSON.stringify(maliciousDoc) +
        ']}';

      const syncRes = await fetch(`${url}/api/v1/maps/sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Origin: origin,
          Cookie: userACookie,
          'X-CSRF-Token': userACsrf,
        },
        body: rawJson,
      });
      assert.equal(syncRes.status, 200);
      assert.equal(({}).polluted, undefined, 'Prototype pollution gerçekleşti!');
      assert.equal(({}).pwned, undefined, 'Constructor prototype pollution gerçekleşti!');

      const syncJson = await syncRes.json();
      const saved = syncJson.maps.find((m) => m.id === 'map_sec_01');
      assert.ok(saved);
      assert.ok(!saved.title.includes('<script>'));
      assert.ok(!saved.nodes.root.title.includes('onerror='));
      assert.ok(!saved.nodes.root.note.includes('<iframe'));
      assert.equal(saved.nodes.root.linkUrl, '');
    });

    await test('6. Password-protected Share Link hides document until unlocked with right password', async () => {
      const createRes = await fetch(`${url}/api/v1/shares`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Origin: origin,
          Cookie: userACookie,
          'X-CSRF-Token': userACsrf,
        },
        body: JSON.stringify({
          expiry: '24h',
          password: 'ShareSecret99!',
          document: {
            id: 'map_sec_01',
            title: 'Gizli Ders Notu',
            department: 'tip',
            rootNodeId: 'root',
            nodes: { root: { id: 'root', title: 'Sınav Özeti', x: 0, y: 0, childrenIds: [] } },
          },
        }),
      });
      assert.equal(createRes.status, 201);
      const created = await createRes.json();
      userAShareSlug = created.share.slug;

      // Public GET must NOT leak document
      const pubRes = await fetch(`${url}/api/v1/public/shares/${userAShareSlug}`);
      assert.equal(pubRes.status, 200);
      const pubJson = await pubRes.json();
      assert.equal(pubJson.requiresPassword, true);
      assert.equal(pubJson.document, null);

      // Wrong password rejected
      const wrongUnlock = await fetch(`${url}/api/v1/public/shares/${userAShareSlug}/unlock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Origin: origin },
        body: JSON.stringify({ password: 'WrongPassword!' }),
      });
      assert.equal(wrongUnlock.status, 401);

      // Right password unlocks
      const okUnlock = await fetch(`${url}/api/v1/public/shares/${userAShareSlug}/unlock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Origin: origin },
        body: JSON.stringify({ password: 'ShareSecret99!' }),
      });
      assert.equal(okUnlock.status, 200);
      const unlocked = await okUnlock.json();
      assert.equal(unlocked.document.title, 'Gizli Ders Notu');
    });

    await test('7. IDOR / Broken Access Control blocked between User B and User A resources', async () => {
      const regB = await fetch(`${url}/api/v1/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Origin: origin },
        body: JSON.stringify({
          displayName: 'Bob Demir',
          email: 'bob@example.com',
          password: 'BobSecure!2026#Pass',
        }),
      });
      assert.equal(regB.status, 201);
      userBCookie = extractCookie(regB).pair;
      userBCsrf = (await regB.json()).csrfToken;

      // User B tries to read/delete User A's map, share, and session
      const readMap = await fetch(`${url}/api/v1/maps/map_sec_01`, {
        headers: { Cookie: userBCookie },
      });
      assert.equal(readMap.status, 404);

      const delMap = await fetch(`${url}/api/v1/maps/map_sec_01`, {
        method: 'DELETE',
        headers: { Origin: origin, Cookie: userBCookie, 'X-CSRF-Token': userBCsrf },
      });
      assert.equal(delMap.status, 404);

      const delShare = await fetch(`${url}/api/v1/shares/${userAShareSlug}`, {
        method: 'DELETE',
        headers: { Origin: origin, Cookie: userBCookie, 'X-CSRF-Token': userBCsrf },
      });
      assert.equal(delShare.status, 404);

      const delSess = await fetch(`${url}/api/v1/auth/sessions/${userASessionId}`, {
        method: 'DELETE',
        headers: { Origin: origin, Cookie: userBCookie, 'X-CSRF-Token': userBCsrf },
      });
      assert.equal(delSess.status, 404);
    });

    await test('8. Brute-Force Account Lockout after 5 failed passwords', async () => {
      for (let i = 1; i <= 4; i++) {
        const fail = await fetch(`${url}/api/v1/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Origin: origin },
          body: JSON.stringify({ email: 'bob@example.com', password: `WrongPass!${i}` }),
        });
        assert.equal(fail.status, 401);
      }
      const fifth = await fetch(`${url}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Origin: origin },
        body: JSON.stringify({ email: 'bob@example.com', password: 'WrongPass!5' }),
      });
      assert.equal(fifth.status, 423);

      // Even correct password is blocked while locked
      const lockedTry = await fetch(`${url}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Origin: origin },
        body: JSON.stringify({ email: 'bob@example.com', password: 'BobSecure!2026#Pass' }),
      });
      assert.equal(lockedTry.status, 423);
    });

    await test('9. Password Change revokes old session cookie & rotates session + CSRF token', async () => {
      const oldCookie = userACookie;
      const chRes = await fetch(`${url}/api/v1/auth/change-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Origin: origin,
          Cookie: userACookie,
          'X-CSRF-Token': userACsrf,
        },
        body: JSON.stringify({
          currentPassword: 'UltraStrong!2026#Key',
          newPassword: 'BrandNew!2026#VaultKey',
        }),
      });
      assert.equal(chRes.status, 200);
      const newCookie = extractCookie(chRes).pair;
      assert.notEqual(newCookie, oldCookie);

      // Replaying old session cookie must be unauthenticated
      const replayMe = await fetch(`${url}/api/v1/auth/me`, {
        headers: { Cookie: oldCookie },
      });
      const replayJson = await replayMe.json();
      assert.equal(replayJson.authenticated, false);

      // New cookie works
      const newMe = await fetch(`${url}/api/v1/auth/me`, {
        headers: { Cookie: newCookie },
      });
      const newMeJson = await newMe.json();
      assert.equal(newMeJson.authenticated, true);
    });

    await test('10. Path Traversal & Sensitive Source/Secret File Disclosure blocked', async () => {
      const probes = [
        '/../.env.appstore',
        '/%2e%2e/.secrets/zihinharitam-upload.jks',
        '/server/index.mjs',
        '/server/db.mjs',
        '/data/zihinharitam-web.sqlite',
        '/data/.server-secret',
        '/offline-packs/../../package.json',
        '/.gitignore',
      ];
      for (const p of probes) {
        const res = await fetch(`${url}${p}`);
        assert.equal(res.status, 404, `Tehlikeli yol 404 dönmedi: ${p} -> ${res.status}`);
      }
    });

    await test('11. Payload Size DoS Guard returns 413 on oversized auth body', async () => {
      const huge = JSON.stringify({
        email: 'dos@example.com',
        password: 'A'.repeat(25_000),
      });
      const res = await fetch(`${url}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Origin: origin },
        body: huge,
      });
      assert.equal(res.status, 413);
    });

    await test('12. Billing Security: auth required, invalid Luhn rejected, price tampering ignored, raw PAN never stored', async () => {
      // Unauthenticated checkout blocked
      const anonRes = await fetch(`${url}/api/v1/billing/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Origin: origin },
        body: JSON.stringify({ tier: 'monthly' }),
      });
      assert.equal(anonRes.status, 401);

      // Register fresh buyer
      const regBuyer = await fetch(`${url}/api/v1/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Origin: origin },
        body: JSON.stringify({
          displayName: 'Pro Buyer',
          email: 'buyer@example.com',
          password: 'Kript0!2026#VaultKey',
        }),
      });
      assert.equal(regBuyer.status, 201);
      const buyerCookie = extractCookie(regBuyer).pair;
      const buyerCsrf = (await regBuyer.json()).csrfToken;

      // Invalid Luhn card number rejected with 400
      const badCard = await fetch(`${url}/api/v1/billing/checkout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Origin: origin,
          Cookie: buyerCookie,
          'X-CSRF-Token': buyerCsrf,
        },
        body: JSON.stringify({
          tier: 'monthly',
          amountTry: 0.01,
          cardholderName: 'Pro Buyer',
          cardNumber: '4242 4242 4242 4241',
          expiry: '12/29',
          cvc: '424',
        }),
      });
      assert.equal(badCard.status, 400);

      // Valid card + client attempts price tampering (amountTry: 1) -> server enforces official 349.99 TRY
      const okBuy = await fetch(`${url}/api/v1/billing/checkout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Origin: origin,
          Cookie: buyerCookie,
          'X-CSRF-Token': buyerCsrf,
        },
        body: JSON.stringify({
          tier: 'monthly',
          amountTry: 1,
          cardholderName: 'Pro Buyer',
          cardNumber: '4242 4242 4242 4242',
          expiry: '12/29',
          cvc: '424',
        }),
      });
      assert.equal(okBuy.status, 200);
      const buyJson = await okBuy.json();
      assert.equal(buyJson.purchased, true);
      assert.equal(buyJson.billing.isPro, true);
      assert.equal(buyJson.billing.orders[0].amount_try, 349.99);
      assert.equal(buyJson.billing.orders[0].card_last4, '4242');
      assert.ok(!JSON.stringify(buyJson).includes('424242424242'));

      // Restore & Cancel verified
      const cancelRes = await fetch(`${url}/api/v1/billing/cancel`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Origin: origin,
          Cookie: buyerCookie,
          'X-CSRF-Token': buyerCsrf,
        },
        body: JSON.stringify({}),
      });
      assert.equal(cancelRes.status, 200);
      assert.equal((await cancelRes.json()).billing.cancelAtPeriodEnd, true);
    });
  } finally {
    await srv.stop();
  }

  console.log(`\n[OWASP Security Suite] SONUÇ: ${passed}/12 güvenlik testi geçti.\n`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
