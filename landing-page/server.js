/**
 * Anindita Creative - Production Backend API & Static Server
 * Zero external dependencies — native Node.js HTTP/HTTPS server
 *
 * Architecture:
 * - Supabase PostgreSQL (REST API) as the single source of truth when configured
 * - Supabase GoTrue Auth (JWT Bearer + Refresh Token) for protected CMS & Orders routes
 * - Supabase Storage ('media' public bucket) for permanent CDN-hosted photos & videos
 * - Strict error propagation (zero silent failures) & transactional diff-sync (upsert + delete)
 * - Clean local JSON/disk fallback ONLY when Supabase is explicitly unconfigured
 */

'use strict';

const http = require('node:http');
const https = require('node:https');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const ROOT_DIR = path.resolve(__dirname);
const CONTENT_FILE = path.join(ROOT_DIR, 'content.json');
const CREDENTIALS_FILE = path.join(ROOT_DIR, 'admin-credentials.json');
const UPLOADS_DIR = path.join(ROOT_DIR, 'uploads');

// ==============================================================================
// 1. ENVIRONMENT LOADING (.env.local / .env)
// ==============================================================================
function loadEnvFiles() {
  const candidates = [
    path.join(ROOT_DIR, '..', '.env.local'),
    path.join(ROOT_DIR, '..', '.env'),
    path.join(ROOT_DIR, '.env.local'),
    path.join(ROOT_DIR, '.env')
  ];
  for (const envPath of candidates) {
    if (!fs.existsSync(envPath)) continue;
    try {
      const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eqIdx = trimmed.indexOf('=');
        if (eqIdx === -1) continue;
        const key = trimmed.slice(0, eqIdx).trim();
        const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '');
        if (key && process.env[key] === undefined) {
          process.env[key] = val;
        }
      }
    } catch (err) {
      console.warn(`[ENV] Gagal memuat ${envPath}:`, err.message);
    }
  }
}

loadEnvFiles();

const PORT = Number(process.env.PORT) || 4173;
const HOST = process.env.HOST || '127.0.0.1';
const STORAGE_BUCKET = process.env.SUPABASE_STORAGE_BUCKET || 'media';
const MAX_UPLOAD_BYTES = 25 * 1024 * 1024; // 25 MB binary file limit
const MAX_JSON_BODY_BYTES = 38 * 1024 * 1024; // ~38 MB to accommodate base64 of 25 MB files

if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Normalize Supabase configuration
const rawSupabaseUrl = (process.env.SUPABASE_URL || '').trim();
const rawSupabaseKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '').trim();

const isSupabaseConfigured = Boolean(
  rawSupabaseUrl &&
  !rawSupabaseUrl.includes('your-project-id') &&
  rawSupabaseKey &&
  !rawSupabaseKey.includes('your-anon-key')
);

let normalizedSupabaseUrl = rawSupabaseUrl;
const dashboardMatch = rawSupabaseUrl.match(/supabase\.com\/dashboard\/project\/([a-zA-Z0-9_-]+)/);
if (dashboardMatch && dashboardMatch[1]) {
  normalizedSupabaseUrl = `https://${dashboardMatch[1]}.supabase.co`;
}

const SUPABASE_URL = isSupabaseConfigured ? normalizedSupabaseUrl.replace(/\/$/, '') : null;
const SUPABASE_KEY = isSupabaseConfigured ? rawSupabaseKey : null;

// Local credentials (used ONLY when Supabase is NOT configured)
let localAdminCreds = {
  username: process.env.ADMIN_USERNAME || 'admin',
  password: process.env.ADMIN_PASSWORD || 'admin123'
};
try {
  if (fs.existsSync(CREDENTIALS_FILE)) {
    localAdminCreds = JSON.parse(fs.readFileSync(CREDENTIALS_FILE, 'utf8'));
  }
} catch (err) {
  console.warn('[AUTH] Gagal membaca admin-credentials.json:', err.message);
}

// Verified session caches (NO hardcoded backdoor tokens)
const verifiedSupabaseSessions = new Map(); // token -> { user, exp, verifiedAt }
const localOfflineSessions = new Map();     // token -> { user, createdAt }
const SESSION_VERIFY_TTL_MS = 5 * 60 * 1000; // Re-verify Supabase JWT online every 5 minutes

// Offline-only fallback orders array
let offlineOrdersStore = [];

// ==============================================================================
// 2. CONSTANTS & MIME TYPES
// ==============================================================================
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.jfif': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mov': 'video/quicktime',
  '.m4v': 'video/mp4',
  '.ico': 'image/x-icon'
};

const ALLOWED_UPLOAD_MIMES = new Map([
  ['image/jpeg', '.jpg'],
  ['image/jpg', '.jpg'],
  ['image/png', '.png'],
  ['image/webp', '.webp'],
  ['image/gif', '.gif'],
  ['image/svg+xml', '.svg'],
  ['image/avif', '.avif'],
  ['video/mp4', '.mp4'],
  ['video/webm', '.webm'],
  ['video/quicktime', '.mov']
]);

const VALID_ORDER_STATUSES = {
  pending_wa: 'Menunggu WhatsApp',
  processing: 'Sedang Dikerjakan',
  done: 'Selesai',
  cancelled: 'Dibatalkan'
};

// ==============================================================================
// 3. HTTP & SUPABASE CLIENT LAYER
// ==============================================================================
class HttpError extends Error {
  constructor(statusCode, message, code = null) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
  }
}

function httpsRawRequest(fullUrlString, { method = 'GET', headers = {}, body = null, timeoutMs = 25000 } = {}) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(fullUrlString);
    const reqHeaders = { ...headers };
    if (body !== null && body !== undefined) {
      reqHeaders['Content-Length'] = Buffer.isBuffer(body) ? body.length : Buffer.byteLength(body);
    }

    const req = https.request(
      {
        hostname: parsed.hostname,
        port: parsed.port || 443,
        path: parsed.pathname + parsed.search,
        method,
        headers: reqHeaders
      },
      (res) => {
        const chunks = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => {
          const rawBuffer = Buffer.concat(chunks);
          const text = rawBuffer.toString('utf8');
          let json = null;
          if (text) {
            try {
              json = JSON.parse(text);
            } catch (_) {
              json = null;
            }
          }
          resolve({
            statusCode: res.statusCode || 500,
            headers: res.headers,
            text,
            json
          });
        });
      }
    );

    req.setTimeout(timeoutMs, () => {
      req.destroy(new HttpError(504, 'Koneksi ke Supabase melebihi batas waktu (timeout).'));
    });

    req.on('error', (err) => {
      reject(err instanceof HttpError ? err : new HttpError(502, `Koneksi jaringan ke Supabase gagal: ${err.message}`));
    });

    if (body !== null && body !== undefined) {
      req.write(body);
    }
    req.end();
  });
}

async function supabaseRest(endpointPath, method = 'GET', bodyData = null, { authToken = null, extraHeaders = {} } = {}) {
  if (!isSupabaseConfigured) {
    throw new HttpError(503, 'Supabase belum dikonfigurasi.');
  }

  const url = `${SUPABASE_URL}/rest/v1/${endpointPath.replace(/^\//, '')}`;
  const headers = {
    apikey: SUPABASE_KEY,
    Authorization: `Bearer ${authToken || SUPABASE_KEY}`,
    'Content-Type': 'application/json',
    ...extraHeaders
  };
  const payload = bodyData !== null && bodyData !== undefined ? JSON.stringify(bodyData) : null;

  const res = await httpsRawRequest(url, { method, headers, body: payload });
  if (res.statusCode >= 200 && res.statusCode < 300) {
    return res.json;
  }

  const errMsg = res.json?.message || res.json?.error_description || res.json?.error || res.text || `Supabase REST error (${res.statusCode})`;
  const errCode = res.json?.code || null;
  const status = res.statusCode === 401 || errCode === 'PGRST301' ? 401 : res.statusCode;
  throw new HttpError(status, errMsg, errCode);
}

async function supabaseAuth(endpointPath, method = 'POST', bodyData = null, authToken = null) {
  if (!isSupabaseConfigured) {
    throw new HttpError(503, 'Supabase Auth belum dikonfigurasi.');
  }

  const url = `${SUPABASE_URL}/auth/v1/${endpointPath.replace(/^\//, '')}`;
  const headers = {
    apikey: SUPABASE_KEY,
    Authorization: `Bearer ${authToken || SUPABASE_KEY}`,
    'Content-Type': 'application/json'
  };
  const payload = bodyData !== null && bodyData !== undefined ? JSON.stringify(bodyData) : null;

  const res = await httpsRawRequest(url, { method, headers, body: payload });
  if (res.statusCode >= 200 && res.statusCode < 300) {
    return res.json || {};
  }

  const errMsg = res.json?.error_description || res.json?.msg || res.json?.message || res.json?.error || `Supabase Auth error (${res.statusCode})`;
  throw new HttpError(res.statusCode, errMsg, res.json?.error_code || null);
}

async function supabaseStorageUpload(objectPath, binaryBuffer, contentType, authToken) {
  if (!isSupabaseConfigured) {
    throw new HttpError(503, 'Supabase Storage belum dikonfigurasi.');
  }
  if (!authToken) {
    throw new HttpError(401, 'Token Supabase Auth diperlukan untuk mengunggah media.');
  }

  const encodedPath = objectPath
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');

  const uploadUrl = `${SUPABASE_URL}/storage/v1/object/${encodeURIComponent(STORAGE_BUCKET)}/${encodedPath}`;
  const res = await httpsRawRequest(uploadUrl, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${authToken}`,
      'Content-Type': contentType,
      'x-upsert': 'true',
      'cache-control': '31536000'
    },
    body: binaryBuffer,
    timeoutMs: 60000
  });

  if (res.statusCode >= 200 && res.statusCode < 300) {
    return `${SUPABASE_URL}/storage/v1/object/public/${encodeURIComponent(STORAGE_BUCKET)}/${encodedPath}`;
  }

  const errMsg = res.json?.message || res.json?.error || res.text || `Supabase Storage upload gagal (${res.statusCode})`;
  throw new HttpError(res.statusCode === 401 ? 401 : 502, `Gagal unggah ke Supabase Storage: ${errMsg}`);
}

// ==============================================================================
// 4. AUTHENTICATION & JWT VERIFICATION
// ==============================================================================
function decodeJwtPayload(token) {
  if (typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  try {
    const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
    return JSON.parse(Buffer.from(padded, 'base64').toString('utf8'));
  } catch (_) {
    return null;
  }
}

function isJwtExpired(payload) {
  if (!payload || typeof payload.exp !== 'number') return false;
  const nowSeconds = Math.floor(Date.now() / 1000);
  return payload.exp <= nowSeconds + 15; // 15-second clock skew safety margin
}

function extractBearerToken(req) {
  const authHeader = req.headers.authorization || '';
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (match && match[1]) return match[1].trim();
  return null;
}

function buildSupabaseUserObject(sbUser) {
  return {
    id: sbUser.id,
    email: sbUser.email,
    username: sbUser.user_metadata?.username || (sbUser.email ? sbUser.email.split('@')[0] : 'admin'),
    fullName: sbUser.user_metadata?.full_name || 'Administrator',
    role: sbUser.role || 'authenticated',
    provider: 'supabase'
  };
}

async function authenticateRequest(req) {
  const token = extractBearerToken(req);
  if (!token) {
    return { authenticated: false, status: 401, reason: 'Token otentikasi tidak ditemukan. Silakan login terlebih dahulu.' };
  }

  if (isSupabaseConfigured) {
    const jwtPayload = decodeJwtPayload(token);
    if (!jwtPayload) {
      return {
        authenticated: false,
        status: 401,
        expired: false,
        reason: 'Sesi tidak valid (bukan token Supabase Auth). Silakan login menggunakan akun email Supabase.'
      };
    }

    if (isJwtExpired(jwtPayload)) {
      verifiedSupabaseSessions.delete(token);
      return {
        authenticated: false,
        status: 401,
        expired: true,
        reason: 'Sesi login telah kedaluwarsa. Memperbarui sesi atau silakan login ulang.'
      };
    }

    const cached = verifiedSupabaseSessions.get(token);
    if (cached && Date.now() - cached.verifiedAt < SESSION_VERIFY_TTL_MS) {
      return {
        authenticated: true,
        token,
        user: cached.user
      };
    }

    try {
      const sbUser = await supabaseAuth('user', 'GET', null, token);
      if (sbUser && sbUser.id) {
        const user = buildSupabaseUserObject(sbUser);
        verifiedSupabaseSessions.set(token, {
          user,
          exp: jwtPayload.exp || 0,
          verifiedAt: Date.now()
        });
        return { authenticated: true, token, user };
      }
    } catch (err) {
      verifiedSupabaseSessions.delete(token);
      return {
        authenticated: false,
        status: 401,
        expired: /expired/i.test(err.message),
        reason: 'Sesi Supabase tidak valid atau telah berakhir. Silakan login kembali.'
      };
    }

    return { authenticated: false, status: 401, reason: 'Verifikasi pengguna Supabase gagal.' };
  }

  // Offline / Unconfigured Mode ONLY
  const localSession = localOfflineSessions.get(token);
  if (localSession) {
    return { authenticated: true, token, user: localSession.user };
  }

  return { authenticated: false, status: 401, reason: 'Sesi kedaluwarsa atau token tidak valid.' };
}

// ==============================================================================
// 5. CMS & ORDERS DATABASE REPOSITORY (SUPABASE)
// ==============================================================================
const SITE_CONTENT_SECTIONS = ['brand', 'stats', 'ticker', 'showcase', 'about', 'process', 'cta'];

async function fetchContentFromSupabase() {
  const [siteContentRows, servicesRows, portfolioRows, testimonialsRows] = await Promise.all([
    supabaseRest('site_content?select=id,data,updated_at', 'GET'),
    supabaseRest('services?select=*&order=sort_order.asc,id.asc', 'GET'),
    supabaseRest('portfolio?select=*&order=sort_order.asc,id.asc', 'GET'),
    supabaseRest('testimonials?select=*&order=sort_order.asc,id.asc', 'GET')
  ]);

  const content = {
    brand: {},
    stats: [],
    ticker: [],
    showcase: [],
    about: {},
    process: {},
    cta: {},
    services: [],
    portfolio: [],
    testimonials: []
  };

  if (Array.isArray(siteContentRows)) {
    for (const row of siteContentRows) {
      if (row && row.id && row.data !== undefined) {
        content[row.id] = row.data;
      }
    }
  }

  if (Array.isArray(servicesRows)) {
    content.services = servicesRows.map((s) => ({
      id: s.id,
      title: s.title || '',
      shortDesc: s.short_desc || '',
      price: Number(s.price) || 0,
      priceLabel: s.price_label || 'Mulai dari',
      package: s.package || '',
      estimate: s.estimate || '',
      icon: s.icon || 'video',
      mediaUrl: s.media_url || '',
      gradient: s.gradient || 'linear-gradient(135deg, #c59b6d 0%, #684227 60%, #3a2214 100%)'
    }));
  }

  if (Array.isArray(portfolioRows)) {
    content.portfolio = portfolioRows.map((p) => ({
      id: p.id,
      title: p.title || '',
      category: p.category || 'video',
      badge: p.badge || p.category || '',
      client: p.client || '',
      year: p.year || '',
      mediaUrl: p.media_url || '',
      gradient: p.gradient || 'linear-gradient(135deg, #442416 0%, #8c5d3b 50%, #3a1e12 100%)'
    }));
  }

  if (Array.isArray(testimonialsRows)) {
    content.testimonials = testimonialsRows.map((t) => ({
      id: t.id,
      name: t.name || '',
      role: t.role || '',
      rating: Number(t.rating) || 5,
      quote: t.quote || ''
    }));
  }

  return content;
}

function encodePostgrestInList(ids) {
  const escaped = ids.map((id) => `"${String(id).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`);
  return encodeURIComponent(`(${escaped.join(',')})`);
}

async function syncCollectionTable(tableName, rows, authToken) {
  // 1. Read existing IDs so we can prune deleted records cleanly
  const existing = await supabaseRest(`${tableName}?select=id`, 'GET', null, { authToken });
  const existingIds = Array.isArray(existing) ? existing.map((r) => String(r.id)) : [];
  const incomingIds = new Set(rows.map((r) => String(r.id)));

  // 2. Batch upsert all incoming rows
  if (rows.length > 0) {
    await supabaseRest(`${tableName}?on_conflict=id`, 'POST', rows, {
      authToken,
      extraHeaders: { Prefer: 'resolution=merge-duplicates,return=minimal' }
    });
  }

  // 3. Delete rows removed by admin
  const removedIds = existingIds.filter((id) => !incomingIds.has(id));
  if (removedIds.length > 0) {
    await supabaseRest(`${tableName}?id=in.${encodePostgrestInList(removedIds)}`, 'DELETE', null, {
      authToken,
      extraHeaders: { Prefer: 'return=minimal' }
    });
  }

  return { upserted: rows.length, deleted: removedIds.length };
}

async function saveContentToSupabase(content, authToken) {
  if (!authToken) {
    throw new HttpError(401, 'Token Supabase Auth wajib disertakan untuk menyimpan ke database.');
  }

  const nowIso = new Date().toISOString();
  const tasks = [];
  const summary = {
    site_content: 0,
    services: { upserted: 0, deleted: 0 },
    portfolio: { upserted: 0, deleted: 0 },
    testimonials: { upserted: 0, deleted: 0 }
  };

  // 1. Batch upsert site_content rows
  const siteRows = [];
  for (const sec of SITE_CONTENT_SECTIONS) {
    if (content[sec] !== undefined && content[sec] !== null) {
      siteRows.push({
        id: sec,
        data: content[sec],
        updated_at: nowIso
      });
    }
  }
  if (siteRows.length > 0) {
    tasks.push(
      supabaseRest('site_content?on_conflict=id', 'POST', siteRows, {
        authToken,
        extraHeaders: { Prefer: 'resolution=merge-duplicates,return=minimal' }
      }).then(() => {
        summary.site_content = siteRows.length;
      })
    );
  }

  // 2. Sync services (upsert + delete removed)
  if (Array.isArray(content.services)) {
    const formattedServices = content.services.map((s, idx) => ({
      id: String(s.id || `srv-${idx + 1}`).trim(),
      title: String(s.title || 'Layanan').trim(),
      short_desc: String(s.shortDesc ?? s.short_desc ?? ''),
      price: Math.max(0, Math.round(Number(s.price) || 0)),
      price_label: String(s.priceLabel ?? s.price_label ?? 'Mulai dari'),
      package: String(s.package ?? ''),
      estimate: String(s.estimate ?? ''),
      icon: String(s.icon || 'video'),
      media_url: String(s.mediaUrl ?? s.media_url ?? '').trim(),
      gradient: String(s.gradient || 'linear-gradient(135deg, #c59b6d 0%, #684227 60%, #3a2214 100%)'),
      sort_order: idx + 1,
      updated_at: nowIso
    }));
    tasks.push(
      syncCollectionTable('services', formattedServices, authToken).then((res) => {
        summary.services = res;
      })
    );
  }

  // 3. Sync portfolio (upsert + delete removed)
  if (Array.isArray(content.portfolio)) {
    const formattedPortfolio = content.portfolio.map((p, idx) => ({
      id: String(p.id || `port-${idx + 1}`).trim(),
      title: String(p.title || 'Karya').trim(),
      category: String(p.category || 'video').trim(),
      badge: String(p.badge || p.category || 'Karya').trim(),
      client: String(p.client ?? ''),
      year: String(p.year ?? ''),
      media_url: String(p.mediaUrl ?? p.media_url ?? '').trim(),
      gradient: String(p.gradient || 'linear-gradient(135deg, #442416 0%, #8c5d3b 50%, #3a1e12 100%)'),
      sort_order: idx + 1,
      updated_at: nowIso
    }));
    tasks.push(
      syncCollectionTable('portfolio', formattedPortfolio, authToken).then((res) => {
        summary.portfolio = res;
      })
    );
  }

  // 4. Sync testimonials (upsert + delete removed)
  if (Array.isArray(content.testimonials)) {
    const formattedTestimonials = content.testimonials.map((t, idx) => ({
      id: String(t.id || `test-${idx + 1}`).trim(),
      name: String(t.name || 'Klien').trim(),
      role: String(t.role ?? ''),
      rating: Math.min(5, Math.max(1, Math.round(Number(t.rating) || 5))),
      quote: String(t.quote ?? ''),
      sort_order: idx + 1,
      updated_at: nowIso
    }));
    tasks.push(
      syncCollectionTable('testimonials', formattedTestimonials, authToken).then((res) => {
        summary.testimonials = res;
      })
    );
  }

  // Strict: if ANY Supabase operation fails, Promise.all rejects immediately!
  await Promise.all(tasks);
  return { syncedAt: nowIso, summary };
}

function mapOrderRow(r) {
  return {
    id: r.id,
    customerName: r.customer_name,
    customerPhone: r.customer_phone,
    brandName: r.brand_name || '',
    deadline: r.deadline || '',
    referenceLink: r.reference_link || '',
    briefNotes: r.brief_notes || '',
    items: Array.isArray(r.items) ? r.items : [],
    subtotal: Number(r.subtotal) || 0,
    discount: Number(r.discount) || 0,
    total: Number(r.total) || 0,
    status: r.status || 'pending_wa',
    statusLabel: r.status_label || VALID_ORDER_STATUSES[r.status] || 'Menunggu WhatsApp',
    createdAt: r.created_at
  };
}

async function fetchOrdersFromSupabase(authToken) {
  const rows = await supabaseRest('orders?select=*&order=created_at.desc', 'GET', null, { authToken });
  return Array.isArray(rows) ? rows.map(mapOrderRow) : [];
}

async function insertOrderToSupabase(order) {
  const row = {
    id: order.id,
    customer_name: String(order.customerName || '').trim(),
    customer_phone: String(order.customerPhone || '').trim(),
    brand_name: String(order.brandName || '').trim(),
    deadline: String(order.deadline || '').trim(),
    reference_link: String(order.referenceLink || '').trim(),
    brief_notes: String(order.briefNotes || '').trim(),
    items: Array.isArray(order.items) ? order.items : [],
    subtotal: Math.max(0, Math.round(Number(order.subtotal) || 0)),
    discount: Math.max(0, Math.round(Number(order.discount) || 0)),
    total: Math.max(0, Math.round(Number(order.total) || 0)),
    status: VALID_ORDER_STATUSES[order.status] ? order.status : 'pending_wa',
    status_label: VALID_ORDER_STATUSES[order.status] || 'Menunggu WhatsApp'
  };

  // CRITICAL: Use 'Prefer: return=minimal' so anonymous public INSERT succeeds
  // without requiring SELECT RLS permissions on the private orders table.
  await supabaseRest('orders', 'POST', row, {
    extraHeaders: { Prefer: 'return=minimal' }
  });
  return order;
}

async function updateOrderStatusInSupabase(id, status, statusLabel, authToken) {
  const rows = await supabaseRest(
    `orders?id=eq.${encodeURIComponent(id)}`,
    'PATCH',
    { status, status_label: statusLabel, updated_at: new Date().toISOString() },
    { authToken, extraHeaders: { Prefer: 'return=representation' } }
  );
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new HttpError(404, `Pesanan dengan ID "${id}" tidak ditemukan.`);
  }
  return mapOrderRow(rows[0]);
}

// ==============================================================================
// 6. REQUEST / RESPONSE HELPERS
// ==============================================================================
function sendJson(res, statusCode, data, extraHeaders = {}) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    Pragma: 'no-cache',
    Expires: '0',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    ...extraHeaders
  });
  res.end(JSON.stringify(data));
}

function parseJsonBody(req, maxBytes = MAX_JSON_BODY_BYTES) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let totalBytes = 0;

    req.on('data', (chunk) => {
      totalBytes += chunk.length;
      if (totalBytes > maxBytes) {
        req.destroy();
        reject(new HttpError(413, 'Ukuran data terlalu besar (maksimal 25 MB per berkas).'));
        return;
      }
      chunks.push(chunk);
    });

    req.on('end', () => {
      if (chunks.length === 0) return resolve({});
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch (_) {
        reject(new HttpError(400, 'Format JSON body tidak valid.'));
      }
    });

    req.on('error', (err) => reject(new HttpError(400, `Gagal membaca request: ${err.message}`)));
  });
}

function writeLocalContentCacheSafe(content) {
  try {
    const tmpPath = `${CONTENT_FILE}.tmp`;
    fs.writeFileSync(tmpPath, JSON.stringify(content, null, 2), 'utf8');
    fs.renameSync(tmpPath, CONTENT_FILE);
  } catch (err) {
    console.warn('[CACHE] Gagal memperbarui cache lokal content.json:', err.message);
  }
}

function inferMimeFromExtension(ext) {
  const mime = MIME_TYPES[ext.toLowerCase()];
  if (mime && ALLOWED_UPLOAD_MIMES.has(mime)) return mime;
  return null;
}

// ==============================================================================
// 7. API ROUTE HANDLER
// ==============================================================================
async function handleApiRequest(req, res, pathname) {
  // ---- Health & Status ----
  if (pathname === '/api/supabase-status' && req.method === 'GET') {
    return sendJson(res, 200, {
      configured: isSupabaseConfigured,
      url: isSupabaseConfigured ? SUPABASE_URL : null,
      storageBucket: isSupabaseConfigured ? STORAGE_BUCKET : null,
      authMode: isSupabaseConfigured ? 'supabase' : 'local',
      message: isSupabaseConfigured
        ? 'Database PostgreSQL, Auth & Media Storage Supabase aktif.'
        : 'Mode lokal/offline (SUPABASE_URL belum dikonfigurasi di .env.local).'
    });
  }

  // ---- Auth: Login ----
  if (pathname === '/api/login' && req.method === 'POST') {
    const body = await parseJsonBody(req, 64 * 1024);
    const identifier = String(body.email || body.username || '').trim();
    const password = String(body.password || '');

    if (!identifier || !password) {
      return sendJson(res, 400, { success: false, error: 'Email dan kata sandi wajib diisi.' });
    }

    if (isSupabaseConfigured) {
      if (!identifier.includes('@')) {
        return sendJson(res, 401, {
          success: false,
          error: 'Database Supabase aktif. Gunakan alamat Email Admin Supabase (contoh: aninditaspace05@gmail.com) agar perubahan tersimpan ke database.'
        });
      }

      try {
        const authRes = await supabaseAuth('token?grant_type=password', 'POST', {
          email: identifier,
          password
        });

        if (!authRes || !authRes.access_token || !authRes.user) {
          return sendJson(res, 401, { success: false, error: 'Gagal memperoleh token sesi dari Supabase Auth.' });
        }

        const user = buildSupabaseUserObject(authRes.user);
        const jwtPayload = decodeJwtPayload(authRes.access_token);
        verifiedSupabaseSessions.set(authRes.access_token, {
          user,
          exp: jwtPayload?.exp || 0,
          verifiedAt: Date.now()
        });

        return sendJson(res, 200, {
          success: true,
          token: authRes.access_token,
          refreshToken: authRes.refresh_token || null,
          expiresAt: authRes.expires_at || jwtPayload?.exp || null,
          user,
          message: 'Login berhasil dengan Supabase Auth!'
        });
      } catch (err) {
        const msg = /invalid login credentials/i.test(err.message)
          ? 'Email atau kata sandi Supabase salah. Periksa kembali kredensial Anda.'
          : err.message;
        return sendJson(res, err.statusCode === 400 ? 401 : (err.statusCode || 401), {
          success: false,
          error: msg
        });
      }
    }

    // Offline fallback ONLY when Supabase is NOT configured
    if (identifier === localAdminCreds.username && password === localAdminCreds.password) {
      const token = 'loc_' + crypto.randomBytes(24).toString('hex');
      const localUser = {
        id: 'local-admin',
        username: localAdminCreds.username,
        email: 'admin@local',
        fullName: 'Administrator Lokal',
        role: 'authenticated',
        provider: 'local'
      };
      localOfflineSessions.set(token, { user: localUser, createdAt: Date.now() });
      return sendJson(res, 200, {
        success: true,
        token,
        user: localUser,
        message: 'Login berhasil (Mode Lokal).'
      });
    }

    return sendJson(res, 401, { success: false, error: 'Username atau kata sandi salah.' });
  }

  // ---- Auth: Refresh Token ----
  if (pathname === '/api/refresh' && req.method === 'POST') {
    if (!isSupabaseConfigured) {
      return sendJson(res, 400, { success: false, error: 'Refresh token hanya tersedia saat Supabase aktif.' });
    }
    const body = await parseJsonBody(req, 64 * 1024);
    const refreshToken = String(body.refreshToken || '').trim();
    if (!refreshToken) {
      return sendJson(res, 400, { success: false, error: 'refreshToken wajib disertakan.' });
    }

    try {
      const authRes = await supabaseAuth('token?grant_type=refresh_token', 'POST', {
        refresh_token: refreshToken
      });
      if (!authRes || !authRes.access_token || !authRes.user) {
        return sendJson(res, 401, { success: false, error: 'Refresh token tidak valid.' });
      }

      const user = buildSupabaseUserObject(authRes.user);
      const jwtPayload = decodeJwtPayload(authRes.access_token);
      verifiedSupabaseSessions.set(authRes.access_token, {
        user,
        exp: jwtPayload?.exp || 0,
        verifiedAt: Date.now()
      });

      return sendJson(res, 200, {
        success: true,
        token: authRes.access_token,
        refreshToken: authRes.refresh_token || refreshToken,
        expiresAt: authRes.expires_at || jwtPayload?.exp || null,
        user
      });
    } catch (err) {
      return sendJson(res, 401, { success: false, error: 'Sesi tidak dapat diperbarui. Silakan login kembali.' });
    }
  }

  // ---- Auth: Register ----
  if (pathname === '/api/register' && req.method === 'POST') {
    if (!isSupabaseConfigured) {
      return sendJson(res, 400, { success: false, error: 'Koneksi Supabase belum aktif.' });
    }
    const body = await parseJsonBody(req, 64 * 1024);
    const email = String(body.email || '').trim();
    const password = String(body.password || '');
    const username = String(body.username || (email.includes('@') ? email.split('@')[0] : 'admin')).trim();
    const fullName = String(body.fullName || 'Administrator').trim();

    if (!email || !email.includes('@')) {
      return sendJson(res, 400, { success: false, error: 'Alamat email tidak valid.' });
    }
    if (password.length < 6) {
      return sendJson(res, 400, { success: false, error: 'Kata sandi minimal 6 karakter.' });
    }

    try {
      const signupRes = await supabaseAuth('signup', 'POST', {
        email,
        password,
        data: { username, full_name: fullName }
      });
      return sendJson(res, 200, {
        success: true,
        user: signupRes.user || signupRes,
        message: 'Akun admin Supabase berhasil didaftarkan! Silakan masuk.'
      });
    } catch (err) {
      return sendJson(res, err.statusCode || 400, { success: false, error: 'Gagal mendaftar: ' + err.message });
    }
  }

  // ---- Auth: Logout ----
  if (pathname === '/api/logout' && req.method === 'POST') {
    const token = extractBearerToken(req);
    if (token) {
      verifiedSupabaseSessions.delete(token);
      localOfflineSessions.delete(token);
      if (isSupabaseConfigured && decodeJwtPayload(token)) {
        try {
          await supabaseAuth('logout', 'POST', null, token);
        } catch (_) {
          // Safe to ignore logout failures for already-expired tokens
        }
      }
    }
    return sendJson(res, 200, { success: true, message: 'Berhasil keluar dari sesi admin.' });
  }

  // ---- Auth: Session Check ----
  if (pathname === '/api/auth-check' && req.method === 'GET') {
    const auth = await authenticateRequest(req);
    if (auth.authenticated) {
      return sendJson(res, 200, { authenticated: true, user: auth.user });
    }
    return sendJson(res, 200, {
      authenticated: false,
      expired: Boolean(auth.expired),
      reason: auth.reason
    });
  }

  // ---- Auth: Change Password / Profile (PROTECTED) ----
  if (pathname === '/api/change-credentials' && req.method === 'POST') {
    const auth = await authenticateRequest(req);
    if (!auth.authenticated) {
      return sendJson(res, 401, { success: false, error: auth.reason });
    }

    const body = await parseJsonBody(req, 64 * 1024);
    const newPassword = String(body.password || '');
    const newUsername = String(body.username || '').trim();

    if (newPassword.length < 6) {
      return sendJson(res, 400, { success: false, error: 'Kata sandi baru minimal 6 karakter.' });
    }

    if (isSupabaseConfigured) {
      const payload = { password: newPassword };
      if (newUsername) {
        payload.data = { username: newUsername };
      }
      await supabaseAuth('user', 'PUT', payload, auth.token);
      return sendJson(res, 200, {
        success: true,
        message: 'Kata sandi akun Supabase berhasil diperbarui!'
      });
    }

    if (!newUsername) {
      return sendJson(res, 400, { success: false, error: 'Username dan password wajib diisi.' });
    }
    localAdminCreds = { username: newUsername, password: newPassword };
    fs.writeFileSync(CREDENTIALS_FILE, JSON.stringify(localAdminCreds, null, 2), 'utf8');
    return sendJson(res, 200, { success: true, message: 'Akun admin lokal berhasil diperbarui!' });
  }

  // ---- CMS Content: GET (PUBLIC) ----
  if (pathname === '/api/content' && req.method === 'GET') {
    if (isSupabaseConfigured) {
      try {
        const supabaseContent = await fetchContentFromSupabase();
        writeLocalContentCacheSafe(supabaseContent);
        return sendJson(res, 200, supabaseContent, { 'X-Data-Source': 'supabase' });
      } catch (err) {
        console.error('[SUPABASE] GET /api/content gagal:', err.message);
        // Only fall back to disk cache when Supabase is temporarily unreachable
        if (fs.existsSync(CONTENT_FILE)) {
          const cached = JSON.parse(fs.readFileSync(CONTENT_FILE, 'utf8'));
          return sendJson(res, 200, cached, {
            'X-Data-Source': 'local-fallback',
            'X-Supabase-Warning': err.message.replace(/[\r\n]+/g, ' ')
          });
        }
        throw err;
      }
    }

    if (!fs.existsSync(CONTENT_FILE)) {
      return sendJson(res, 404, { error: 'Berkas content.json tidak ditemukan.' });
    }
    const localData = JSON.parse(fs.readFileSync(CONTENT_FILE, 'utf8'));
    return sendJson(res, 200, localData, { 'X-Data-Source': 'local' });
  }

  // ---- CMS Content: POST (PROTECTED ADMIN) ----
  if (pathname === '/api/content' && req.method === 'POST') {
    const auth = await authenticateRequest(req);
    if (!auth.authenticated) {
      return sendJson(res, 401, {
        success: false,
        expired: Boolean(auth.expired),
        error: auth.reason || 'Akses ditolak. Anda harus login sebagai admin untuk mengubah konten website.'
      });
    }

    const updatedContent = await parseJsonBody(req);
    if (!updatedContent || typeof updatedContent !== 'object' || Array.isArray(updatedContent)) {
      return sendJson(res, 400, { success: false, error: 'Payload konten harus berupa objek JSON yang valid.' });
    }

    if (isSupabaseConfigured) {
      // Strict sync: if Supabase rejects the write, propagate the real error immediately
      // and do NOT pretend it succeeded!
      const syncResult = await saveContentToSupabase(updatedContent, auth.token);
      const freshContent = await fetchContentFromSupabase();
      writeLocalContentCacheSafe(freshContent);

      return sendJson(res, 200, {
        success: true,
        supabaseSynced: true,
        syncedAt: syncResult.syncedAt,
        summary: syncResult.summary,
        message: 'Semua perubahan berhasil disimpan ke database Supabase!',
        content: freshContent
      });
    }

    writeLocalContentCacheSafe(updatedContent);
    return sendJson(res, 200, {
      success: true,
      supabaseSynced: false,
      message: 'Konten berhasil disimpan ke berkas lokal.',
      content: updatedContent
    });
  }

  // ---- Media Upload: POST (PROTECTED ADMIN) ----
  if (pathname === '/api/upload' && req.method === 'POST') {
    const auth = await authenticateRequest(req);
    if (!auth.authenticated) {
      return sendJson(res, 401, {
        success: false,
        expired: Boolean(auth.expired),
        error: auth.reason || 'Akses ditolak. Hanya admin terautentikasi yang dapat mengunggah media.'
      });
    }

    const body = await parseJsonBody(req);
    const filename = String(body.filename || '').trim();
    const rawData = body.base64Data || body.filedata || body.data;
    const rawFolder = String(body.folder || 'general').toLowerCase().replace(/[^a-z0-9_-]/g, '');
    const folder = rawFolder || 'general';

    if (!filename || typeof rawData !== 'string' || !rawData) {
      return sendJson(res, 400, { success: false, error: 'Filename dan data file wajib disertakan.' });
    }

    // Parse optional data URI header: data:<mime>;base64,<payload>
    const dataUriMatch = rawData.match(/^data:([^;]+);base64,(.+)$/s);
    const detectedMime = dataUriMatch ? dataUriMatch[1].trim().toLowerCase() : null;
    const cleanBase64 = dataUriMatch ? dataUriMatch[2] : rawData;

    const rawExt = path.extname(filename).toLowerCase();
    const contentType = (detectedMime && ALLOWED_UPLOAD_MIMES.has(detectedMime))
      ? detectedMime
      : inferMimeFromExtension(rawExt);

    if (!contentType) {
      return sendJson(res, 400, {
        success: false,
        error: 'Format berkas tidak didukung. Gunakan JPG, PNG, WEBP, GIF, SVG, AVIF, MP4, WEBM, atau MOV.'
      });
    }

    const buffer = Buffer.from(cleanBase64, 'base64');
    if (buffer.length === 0) {
      return sendJson(res, 400, { success: false, error: 'Berkas kosong atau rusak.' });
    }
    if (buffer.length > MAX_UPLOAD_BYTES) {
      return sendJson(res, 413, { success: false, error: 'Ukuran berkas melebihi batas maksimal 25 MB.' });
    }

    const safeExt = ALLOWED_UPLOAD_MIMES.get(contentType) || rawExt || '.png';
    const baseName = path.basename(filename, path.extname(filename)).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 60) || 'media';
    const uniqueSuffix = `${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const uniqueFileName = `${baseName}_${uniqueSuffix}${safeExt}`;

    if (isSupabaseConfigured) {
      const objectPath = `${folder}/${uniqueFileName}`;
      const publicUrl = await supabaseStorageUpload(objectPath, buffer, contentType, auth.token);
      return sendJson(res, 200, {
        success: true,
        storage: 'supabase',
        url: publicUrl,
        path: objectPath,
        contentType,
        size: buffer.length,
        message: 'Media berhasil diunggah ke Supabase Storage!'
      });
    }

    const savePath = path.join(UPLOADS_DIR, uniqueFileName);
    fs.writeFileSync(savePath, buffer);
    return sendJson(res, 200, {
      success: true,
      storage: 'local',
      url: `/uploads/${uniqueFileName}`,
      contentType,
      size: buffer.length,
      message: 'Media berhasil diunggah ke penyimpanan lokal!'
    });
  }

  // ---- Orders: GET (PROTECTED ADMIN) ----
  if (pathname === '/api/orders' && req.method === 'GET') {
    const auth = await authenticateRequest(req);
    if (!auth.authenticated) {
      return sendJson(res, 401, {
        success: false,
        expired: Boolean(auth.expired),
        error: 'Akses ditolak. Daftar pesanan klien hanya dapat diakses oleh admin.'
      });
    }

    if (isSupabaseConfigured) {
      const orders = await fetchOrdersFromSupabase(auth.token);
      return sendJson(res, 200, orders);
    }

    return sendJson(res, 200, offlineOrdersStore);
  }

  // ---- Orders: POST (PUBLIC CHECKOUT) ----
  if (pathname === '/api/orders' && req.method === 'POST') {
    const body = await parseJsonBody(req, 512 * 1024);
    const customerName = String(body.customerName || '').trim();
    const customerPhone = String(body.customerPhone || '').trim();
    const items = Array.isArray(body.items) ? body.items : [];

    if (!customerName || !customerPhone) {
      return sendJson(res, 400, { success: false, error: 'Nama lengkap dan nomor WhatsApp wajib diisi.' });
    }
    if (items.length === 0) {
      return sendJson(res, 400, { success: false, error: 'Minimal satu layanan harus dipilih.' });
    }

    const newOrder = {
      id: `ORD-${Date.now().toString().slice(-6)}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`,
      createdAt: new Date().toISOString(),
      status: 'pending_wa',
      statusLabel: VALID_ORDER_STATUSES.pending_wa,
      customerName,
      customerPhone,
      brandName: String(body.brandName || '').trim(),
      deadline: String(body.deadline || '').trim(),
      referenceLink: String(body.referenceLink || '').trim(),
      briefNotes: String(body.briefNotes || '').trim(),
      items,
      subtotal: Math.max(0, Math.round(Number(body.subtotal) || 0)),
      discount: Math.max(0, Math.round(Number(body.discount) || 0)),
      total: Math.max(0, Math.round(Number(body.total) || 0))
    };

    if (isSupabaseConfigured) {
      await insertOrderToSupabase(newOrder);
      return sendJson(res, 201, newOrder);
    }

    offlineOrdersStore.unshift(newOrder);
    return sendJson(res, 201, newOrder);
  }

  // ---- Orders: PATCH /:id (PROTECTED ADMIN) ----
  if (pathname.startsWith('/api/orders/') && req.method === 'PATCH') {
    const auth = await authenticateRequest(req);
    if (!auth.authenticated) {
      return sendJson(res, 401, {
        success: false,
        expired: Boolean(auth.expired),
        error: 'Akses ditolak. Hanya admin yang dapat memperbarui status pesanan.'
      });
    }

    const orderId = pathname.slice('/api/orders/'.length).trim();
    if (!orderId) {
      return sendJson(res, 400, { success: false, error: 'ID pesanan tidak valid.' });
    }

    const body = await parseJsonBody(req, 64 * 1024);
    const status = String(body.status || '').trim();
    if (!VALID_ORDER_STATUSES[status]) {
      return sendJson(res, 400, {
        success: false,
        error: `Status tidak valid. Pilihan: ${Object.keys(VALID_ORDER_STATUSES).join(', ')}.`
      });
    }

    const statusLabel = VALID_ORDER_STATUSES[status];

    if (isSupabaseConfigured) {
      const updated = await updateOrderStatusInSupabase(orderId, status, statusLabel, auth.token);
      return sendJson(res, 200, updated);
    }

    const order = offlineOrdersStore.find((o) => o.id === orderId);
    if (!order) {
      return sendJson(res, 404, { success: false, error: 'Pesanan tidak ditemukan.' });
    }
    order.status = status;
    order.statusLabel = statusLabel;
    return sendJson(res, 200, order);
  }

  return sendJson(res, 404, { success: false, error: 'API route not found' });
}

// ==============================================================================
// 8. STATIC FILE SERVER (WITH VIDEO RANGE SUPPORT)
// ==============================================================================
function serveStaticFile(req, res, pathname) {
  let relativeFilePath = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');

  if (pathname === '/checkout') relativeFilePath = 'checkout.html';
  if (pathname === '/konfirmasi') relativeFilePath = 'konfirmasi.html';
  if (pathname === '/dashboard' || pathname === '/admin' || pathname === '/login') {
    relativeFilePath = 'dashboard.html';
  }

  // Block sensitive server files from public download
  const baseLower = path.basename(relativeFilePath).toLowerCase();
  if (
    baseLower === 'server.js' ||
    baseLower === 'admin-credentials.json' ||
    baseLower.startsWith('.env')
  ) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Access Denied');
    return;
  }

  const absoluteFilePath = path.resolve(ROOT_DIR, relativeFilePath);
  if (absoluteFilePath !== ROOT_DIR && !absoluteFilePath.startsWith(ROOT_DIR + path.sep)) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Access Denied');
    return;
  }

  fs.stat(absoluteFilePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(`
        <div style="font-family:sans-serif; text-align:center; padding:60px 20px; color:#25160e;">
          <h1 style="font-size:32px; margin-bottom:12px;">404 — Halaman Tidak Ditemukan</h1>
          <p style="color:#78665b; margin-bottom:24px;">Halaman yang Anda tuju tidak tersedia.</p>
          <a href="/" style="display:inline-block; padding:10px 24px; background:#2d180d; color:#fff; text-decoration:none; border-radius:999px;">Kembali ke Beranda</a>
        </div>
      `);
      return;
    }

    const ext = path.extname(absoluteFilePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    const isMediaAsset = ['.png', '.jpg', '.jpeg', '.jfif', '.webp', '.avif', '.gif', '.svg', '.mp4', '.webm', '.mov', '.ico'].includes(ext);
    const cacheHeader = isMediaAsset ? 'public, max-age=86400' : 'no-cache, no-store, must-revalidate';

    // Handle Range requests for video playback & scrubbing
    const rangeHeader = req.headers.range;
    if (rangeHeader && (ext === '.mp4' || ext === '.webm' || ext === '.mov')) {
      const match = rangeHeader.match(/bytes=(\d*)-(\d*)/);
      if (match) {
        const start = match[1] ? parseInt(match[1], 10) : 0;
        const end = match[2] ? Math.min(parseInt(match[2], 10), stats.size - 1) : stats.size - 1;
        if (start <= end && start < stats.size) {
          res.writeHead(206, {
            'Content-Range': `bytes ${start}-${end}/${stats.size}`,
            'Accept-Ranges': 'bytes',
            'Content-Length': end - start + 1,
            'Content-Type': contentType,
            'Cache-Control': cacheHeader
          });
          fs.createReadStream(absoluteFilePath, { start, end }).pipe(res);
          return;
        }
      }
    }

    res.writeHead(200, {
      'Content-Type': contentType,
      'Content-Length': stats.size,
      'Accept-Ranges': 'bytes',
      'Cache-Control': cacheHeader
    });
    fs.createReadStream(absoluteFilePath).pipe(res);
  });
}

// ==============================================================================
// 9. HTTP SERVER ENTRYPOINT
// ==============================================================================
const server = http.createServer(async (req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  let pathname;
  try {
    pathname = decodeURIComponent(parsedUrl.pathname);
  } catch (_) {
    res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Bad Request');
    return;
  }

  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    });
    res.end();
    return;
  }

  if (pathname.startsWith('/api/')) {
    try {
      await handleApiRequest(req, res, pathname);
    } catch (err) {
      const statusCode = err instanceof HttpError ? err.statusCode : 500;
      const message = err?.message || 'Terjadi kesalahan internal pada server.';
      if (statusCode >= 500) {
        console.error(`[API ${req.method} ${pathname}] ${statusCode}:`, err);
      }
      sendJson(res, statusCode, {
        success: false,
        error: message,
        code: err?.code || null
      });
    }
    return;
  }

  serveStaticFile(req, res, pathname);
});

server.listen(PORT, HOST, () => {
  console.log('=======================================================');
  console.log('   ANINDITA CREATIVE — PRODUCTION SERVER AKTIF');
  console.log('=======================================================');
  console.log(`   Website Utama        : http://${HOST}:${PORT}/`);
  console.log(`   Halaman Checkout     : http://${HOST}:${PORT}/checkout`);
  console.log(`   Konfirmasi WhatsApp  : http://${HOST}:${PORT}/konfirmasi`);
  console.log(`   Panel Admin (CMS)    : http://${HOST}:${PORT}/admin`);
  if (isSupabaseConfigured) {
    console.log(`   Database Supabase    : Terhubung (${SUPABASE_URL})`);
    console.log(`   Media Storage CDN    : Bucket "${STORAGE_BUCKET}" (Public)`);
    console.log(`   Autentikasi          : Supabase Auth (aninditaspace05@gmail.com)`);
  } else {
    console.log(`   Database Supabase    : Mode Lokal (isi SUPABASE_URL di .env.local)`);
    console.log(`   Login Lokal          : ${localAdminCreds.username}`);
  }
  console.log('=======================================================');
});
