#!/usr/bin/env node
/**
 * Windows Üzerinden Mac Gerektirmeden Apple Distribution Sertifikası (.p12) Üretici
 *
 * Git for Windows içindeki OpenSSL + App Store Connect REST API (/v1/certificates) kullanarak:
 *  1. 2048-bit RSA özel anahtarı ve CSR oluşturur (.secrets/ klasöründe, gitignore korumalı),
 *  2. Apple'dan resmi "IOS_DISTRIBUTION / DISTRIBUTION" sertifikasını alır,
 *  3. GitHub Actions için hazır ".secrets/apple_distribution.p12" ve
 *     ".secrets/BUILD_CERTIFICATE_BASE64.txt" dosyalarını üretir.
 */

import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');
const SECRETS_DIR = path.join(ROOT, '.secrets');

function loadDotEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  for (const raw of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const idx = line.indexOf('=');
    if (idx <= 0) continue;
    const k = line.slice(0, idx).trim();
    const v = line.slice(idx + 1).trim().replace(/^['"]|['"]$/g, '');
    if (!process.env[k]) process.env[k] = v;
  }
}

loadDotEnvFile(path.join(ROOT, '.env.appstore'));
loadDotEnvFile(path.join(ROOT, '.env'));

function findOpenSsl() {
  const candidates = [
    'openssl',
    'C:\\Program Files\\Git\\usr\\bin\\openssl.exe',
    'C:\\Program Files\\OpenSSL-Win64\\bin\\openssl.exe',
  ];
  for (const bin of candidates) {
    try {
      execFileSync(bin, ['version'], { stdio: 'ignore' });
      return bin;
    } catch {
      // try next
    }
  }
  throw new Error('OpenSSL bulunamadı (Git for Windows C:\\Program Files\\Git\\usr\\bin\\openssl.exe bekleniyordu).');
}

function base64Url(input) {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(input, 'utf8');
  return buf.toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function makeJwt(keyId, issuerId, pem) {
  const now = Math.floor(Date.now() / 1000);
  const head = base64Url(JSON.stringify({ alg: 'ES256', kid: keyId, typ: 'JWT' }));
  const body = base64Url(JSON.stringify({ iss: issuerId, iat: now - 10, exp: now + 600, aud: 'appstoreconnect-v1' }));
  const sig = crypto.sign('sha256', Buffer.from(`${head}.${body}`, 'utf8'), {
    key: pem,
    dsaEncoding: 'ieee-p1363',
  });
  return `${head}.${body}.${base64Url(sig)}`;
}

async function main() {
  const keyId = process.env.APPSTORE_KEY_ID || '';
  const issuerId = process.env.APPSTORE_ISSUER_ID || '';
  const keyPath =
    process.env.APPSTORE_PRIVATE_KEY_PATH ||
    path.join(SECRETS_DIR, `AuthKey_${keyId}.p8`);
  const pem = process.env.APPSTORE_PRIVATE_KEY_P8
    ? process.env.APPSTORE_PRIVATE_KEY_P8.replace(/\\n/g, '\n').trim()
    : fs.existsSync(keyPath)
      ? fs.readFileSync(keyPath, 'utf8').trim()
      : '';

  if (!keyId || !issuerId || !pem) {
    console.error('Eksik bilgi! Önce .env.appstore içinde APPSTORE_KEY_ID, APPSTORE_ISSUER_ID ve APPSTORE_PRIVATE_KEY_PATH tanımlayın.');
    process.exit(1);
  }

  const openssl = findOpenSsl();
  fs.mkdirSync(SECRETS_DIR, { recursive: true });

  const p12Password = process.env.P12_PASSWORD || crypto.randomBytes(12).toString('hex');
  const keyFile = path.join(SECRETS_DIR, 'apple_distribution.key');
  const csrFile = path.join(SECRETS_DIR, 'apple_distribution.csr');
  const cerDerFile = path.join(SECRETS_DIR, 'apple_distribution.cer');
  const cerPemFile = path.join(SECRETS_DIR, 'apple_distribution_cert.pem');
  const p12File = path.join(SECRETS_DIR, 'apple_distribution.p12');
  const b64File = path.join(SECRETS_DIR, 'BUILD_CERTIFICATE_BASE64.txt');
  const passFile = path.join(SECRETS_DIR, 'P12_PASSWORD.txt');

  console.log('==> [1/4] 2048-bit RSA özel anahtar ve CSR üretiliyor...');
  execFileSync(openssl, ['genrsa', '-out', keyFile, '2048'], { stdio: 'inherit' });
  execFileSync(
    openssl,
    ['req', '-new', '-key', keyFile, '-out', csrFile, '-subj', '/CN=ZihinHaritam Distribution/O=Taha Firat/C=TR'],
    { stdio: 'inherit' }
  );

  const csrContent = fs
    .readFileSync(csrFile, 'utf8')
    .replace(/-----BEGIN CERTIFICATE REQUEST-----/g, '')
    .replace(/-----END CERTIFICATE REQUEST-----/g, '')
    .replace(/\s+/g, '');

  console.log('==> [2/4] App Store Connect API üzerinden Apple Distribution sertifikası talep ediliyor...');
  const token = makeJwt(keyId, issuerId, pem);
  const res = await fetch('https://api.appstoreconnect.apple.com/v1/certificates', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      data: {
        type: 'certificates',
        attributes: {
          certificateType: 'DISTRIBUTION',
          csrContent,
        },
      },
    }),
  });

  const json = await res.json();
  if (!res.ok) {
    console.error('Apple Sertifika API Hatası:', JSON.stringify(json, null, 2));
    process.exit(1);
  }

  const certB64 = json.data.attributes.certificateContent;
  fs.writeFileSync(cerDerFile, Buffer.from(certB64, 'base64'));

  console.log('==> [3/4] .cer sertifikası ve özel anahtar .p12 paketine dönüştürülüyor...');
  execFileSync(openssl, ['x509', '-inform', 'DER', '-in', cerDerFile, '-out', cerPemFile], { stdio: 'inherit' });
  const sslVersion = execFileSync(openssl, ['version'], { encoding: 'utf8' }).trim();
  const pkcs12Args = [
    'pkcs12',
    '-export',
    ...(sslVersion.startsWith('OpenSSL 3') ? ['-legacy'] : []),
    '-inkey',
    keyFile,
    '-in',
    cerPemFile,
    '-out',
    p12File,
    '-passout',
    `pass:${p12Password}`,
  ];
  execFileSync(openssl, pkcs12Args, { stdio: 'inherit' });

  const p12Base64 = fs.readFileSync(p12File).toString('base64');
  fs.writeFileSync(b64File, p12Base64, 'utf8');
  fs.writeFileSync(passFile, p12Password, 'utf8');

  console.log('\n✅ BAŞARILI! Mac kullanmadan Apple Distribution .p12 sertifikanız üretildi:');
  console.log(`   • .p12 Dosyası          : ${p12File}`);
  console.log(`   • GitHub Secret Base64  : ${b64File}`);
  console.log(`   • P12_PASSWORD          : ${passFile}`);
}

main().catch((e) => {
  console.error('HATA:', e.message);
  process.exit(1);
});
