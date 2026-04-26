#!/usr/bin/env node
/**
 * Ultra SaaS – Environment Validator
 * Kontrollon të gjitha çelësat dhe lidhjet kritike para nisjes së serverit.
 * 
 * Përdorim:
 *   node scripts/check-env.js
 *   node scripts/check-env.js --strict   (del me kod 1 nëse ndonjë warning)
 *
 * @version 1.0.0
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';

// Ngarko .env nëse nuk është ngarkuar nga runtime
try {
  const envPath = resolve(process.cwd(), '.env');
  const lines = readFileSync(envPath, 'utf-8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx < 0) continue;
    const key = trimmed.slice(0, idx).trim();
    const value = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, '');
    if (!process.env[key]) process.env[key] = value;
  }
} catch {
  // .env nuk ekziston — vazhdo me variablat e mjedisit
}

const STRICT = process.argv.includes('--strict');

let errors = 0;
let warnings = 0;

function ok(label, msg = '') {
  console.log(`  ✅ ${label}${msg ? ': ' + msg : ''}`);
}

function warn(label, msg = '') {
  console.warn(`  ⚠️  ${label}${msg ? ': ' + msg : ''}`);
  warnings++;
}

function fail(label, msg = '') {
  console.error(`  ❌ ${label}${msg ? ': ' + msg : ''}`);
  errors++;
}

function check(key, { required = true, prefix = null, minLength = 8 } = {}) {
  const val = process.env[key];
  if (!val || val.trim() === '') {
    if (required) fail(key, 'MUNGON ose bosh');
    else warn(key, 'Opsionale — nuk është vendosur');
    return false;
  }
  if (minLength && val.length < minLength) {
    warn(key, `Duhet të jetë të paktën ${minLength} karaktere`);
    return false;
  }
  if (prefix && !val.startsWith(prefix)) {
    warn(key, `Duhet të fillojë me '${prefix}'`);
    return false;
  }
  ok(key);
  return true;
}

// ─────────────────────────────────────────────
console.log('\n🔍 Ultra SaaS – Verifikim i mjedisit\n');
console.log('━'.repeat(50));

// 1. DATABASE
console.log('\n📦 Database (Prisma / PostgreSQL)');
check('DATABASE_URL', { prefix: 'postgresql://', minLength: 20 });

// 2. AUTHENTICATION
console.log('\n🔐 Autentifikim & Siguri');
check('NEXTAUTH_SECRET', { minLength: 32 });
check('INTERNAL_API_KEY', { minLength: 16 });

// 3. STRIPE
console.log('\n💳 Stripe Payments');
const stripeKey = process.env.STRIPE_SECRET_KEY;
if (!stripeKey) {
  fail('STRIPE_SECRET_KEY', 'MUNGON');
} else if (stripeKey.startsWith('sk_live_')) {
  ok('STRIPE_SECRET_KEY', 'Live key aktive');
} else if (stripeKey.startsWith('sk_test_')) {
  warn('STRIPE_SECRET_KEY', 'Test key — mos përdor në produksion');
} else {
  fail('STRIPE_SECRET_KEY', 'Format i pavlefshëm');
}
check('STRIPE_WEBHOOK_SECRET', { prefix: 'whsec_', required: false });

// 4. BLOCKCHAIN / BRIDGE
console.log('\n⛓️  Blockchain & Bridge');
check('SOLANA_RPC_URL', { prefix: 'https://', required: false });
check('ALB_TOKEN_MINT_ADDRESS', { minLength: 32, required: false });
check('BRIDGE_API_KEY', { required: false });

// 5. LORA MESH
console.log('\n📡 LoRa Mesh Gateway');
const loraUrl = process.env.LORA_GATEWAY_URL;
if (!loraUrl) {
  warn('LORA_GATEWAY_URL', 'Nuk është vendosur — Mesh Gateway do të jetë offline');
} else {
  ok('LORA_GATEWAY_URL', loraUrl);
}
check('LORA_AUTH_TOKEN', { required: false, minLength: 8 });

// 6. MESSAGING
console.log('\n💬 NodeSMS / Twilio');
check('TWILIO_ACCOUNT_SID', { prefix: 'AC', required: false });
check('TWILIO_AUTH_TOKEN', { required: false });

// 7. AGI
console.log('\n🧠 AGI / ASI');
const agiMode = process.env.ASI_DASHBOARD_MODE || 'development';
if (agiMode === 'enterprise') {
  ok('ASI_DASHBOARD_MODE', 'enterprise');
} else {
  warn('ASI_DASHBOARD_MODE', `'${agiMode}' — rekomandohet 'enterprise' për produksion`);
}
check('AGI_CORE_URL', { required: false, prefix: 'http' });

// 8. NEXT.JS
console.log('\n🌐 Next.js');
check('NEXT_PUBLIC_APP_URL', { prefix: 'http', required: false });
const nodeEnv = process.env.NODE_ENV;
if (nodeEnv === 'production') {
  ok('NODE_ENV', 'production');
} else {
  warn('NODE_ENV', `'${nodeEnv || 'undefined'}' — vendos 'production' për deployment`);
}

// 9. KLOUD BRIDGE
console.log('\n☁️  Kloud Bridge Integration');
check('KLOUD_BRIDGE_URL', { prefix: 'https://', required: false, minLength: 20 });

// 10. OPENAPI LINK
console.log('\n📘 OpenAPI Integration');
check('OPENAPI_EXTERNAL_URL', { prefix: 'https://', required: false, minLength: 20 });

// ─────────────────────────────────────────────
// LIDHJA ME DATABASE (nëse Prisma është i disponueshëm)
console.log('\n🔗 Teste lidhjesh live');

async function testDatabaseConnection() {
  try {
    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient({ log: [] });
    await prisma.$connect();
    await prisma.$disconnect();
    ok('Database', 'Lidhja u krye me sukses');
  } catch (e) {
    if (e.code === 'MODULE_NOT_FOUND') {
      warn('Database', 'Prisma nuk është instaluar (@prisma/client mungon)');
    } else {
      fail('Database', `Lidhja dështoi: ${e.message}`);
    }
  }
}

async function testLoRaGateway() {
  const url = process.env.LORA_GATEWAY_URL;
  const token = process.env.LORA_AUTH_TOKEN;
  if (!url) {
    warn('LoRa Gateway', 'LORA_GATEWAY_URL nuk është vendosur, duke kapërcyer');
    return;
  }
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    const res = await fetch(`${url}/status`, { headers, signal: controller.signal });
    clearTimeout(timeout);
    if (res.ok) {
      ok('LoRa Gateway', `Online (HTTP ${res.status})`);
    } else {
      warn('LoRa Gateway', `Përgjigje HTTP ${res.status}`);
    }
  } catch (e) {
    if (e.name === 'AbortError') {
      warn('LoRa Gateway', 'Timeout pas 5s — gateway mund të jetë offline');
    } else {
      warn('LoRa Gateway', `Nuk mund t'u lidh: ${e.message}`);
    }
  }
}

// Ekzekuto testet async
await testDatabaseConnection();
await testLoRaGateway();

// ─────────────────────────────────────────────
// REZULTATI FINAL
console.log('\n' + '━'.repeat(50));
if (errors > 0) {
  console.error(`\n🚨 Verifikimi DËSHTOI — ${errors} gabime kritike, ${warnings} paralajmërime.`);
  console.error('   Serveri nuk mund të niset. Rregulloji variablat e mjedisit dhe provo sërish.\n');
  process.exit(1);
} else if (warnings > 0 && STRICT) {
  console.warn(`\n⛔ Modaliteti --strict: ${warnings} paralajmërime trajtohen si gabime.`);
  process.exit(1);
} else if (warnings > 0) {
  console.warn(`\n✅ Sistemi mund të niset — por ka ${warnings} paralajmërime. Shqyrto sa më sipër.\n`);
} else {
  console.log('\n🚀 Çdo gjë është në rregull. Sistemi është gati për Produksion!\n');
}
