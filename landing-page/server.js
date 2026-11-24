/**
 * Anindita Creative - Backend Server & Static File Server
 * Zero dependencies required - runs with native Node.js
 */

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const PORT = process.env.PORT || 4173;
const HOST = process.env.HOST || '127.0.0.1';
const ROOT_DIR = __dirname;
const CONTENT_FILE = path.join(ROOT_DIR, 'content.json');

// In-memory orders store seeded from content.json
let ordersStore = [];
try {
  if (fs.existsSync(CONTENT_FILE)) {
    const raw = fs.readFileSync(CONTENT_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    ordersStore = parsed.sampleOrders || [];
  }
} catch (e) {
  console.warn('Could not read sample orders from content.json', e.message);
}

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  });
  res.end(JSON.stringify(data));
}

function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
      if (body.length > 1e6) {
        req.destroy();
        reject(new Error('Payload too large'));
      }
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = decodeURIComponent(parsedUrl.pathname);

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    res.end();
    return;
  }

  // ==========================================
  // REST API ENDPOINTS
  // ==========================================
  if (pathname.startsWith('/api/')) {
    if (pathname === '/api/content' && req.method === 'GET') {
      try {
        const raw = fs.readFileSync(CONTENT_FILE, 'utf8');
        return sendJson(res, 200, JSON.parse(raw));
      } catch (e) {
        return sendJson(res, 500, { error: 'Failed to read content file' });
      }
    }

    if (pathname === '/api/orders' && req.method === 'GET') {
      return sendJson(res, 200, ordersStore);
    }

    if (pathname === '/api/orders' && req.method === 'POST') {
      try {
        const body = await parseJsonBody(req);
        const newOrder = {
          id: 'ORD-' + Date.now().toString().slice(-6),
          createdAt: new Date().toISOString(),
          status: 'pending_wa',
          statusLabel: 'Menunggu WhatsApp',
          ...body
        };
        ordersStore.unshift(newOrder);
        return sendJson(res, 201, newOrder);
      } catch (e) {
        return sendJson(res, 400, { error: 'Invalid JSON body' });
      }
    }

    if (pathname.startsWith('/api/orders/') && req.method === 'PATCH') {
      const orderId = pathname.replace('/api/orders/', '');
      try {
        const body = await parseJsonBody(req);
        const order = ordersStore.find(o => o.id === orderId);
        if (!order) {
          return sendJson(res, 404, { error: 'Order not found' });
        }
        if (body.status) {
          order.status = body.status;
          if (body.status === 'done') order.statusLabel = 'Selesai';
          else if (body.status === 'processing') order.statusLabel = 'Sedang Dikerjakan';
          else order.statusLabel = 'Menunggu WhatsApp';
        }
        return sendJson(res, 200, order);
      } catch (e) {
        return sendJson(res, 400, { error: 'Invalid JSON body' });
      }
    }

    return sendJson(res, 404, { error: 'API route not found' });
  }

  // ==========================================
  // STATIC FILE SERVING & ROUTE REWRITES
  // ==========================================
  let relativeFilePath = pathname === '/' ? 'index.html' : pathname.replace(/^\//, '');

  // Clean URLs
  if (pathname === '/checkout') relativeFilePath = 'checkout.html';
  if (pathname === '/konfirmasi') relativeFilePath = 'konfirmasi.html';
  if (pathname === '/dashboard' || pathname === '/admin') relativeFilePath = 'dashboard.html';

  const absoluteFilePath = path.join(ROOT_DIR, relativeFilePath);

  // Security: prevent directory traversal
  if (!absoluteFilePath.startsWith(ROOT_DIR)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('Access Denied');
    return;
  }

  fs.stat(absoluteFilePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(`
        <div style="font-family:sans-serif; text-align:center; padding:50px;">
          <h1>404 — Halaman Tidak Ditemukan</h1>
          <p>Halaman yang Anda cari tidak tersedia.</p>
          <a href="/">Kembali ke Beranda</a>
        </div>
      `);
      return;
    }

    const ext = path.extname(absoluteFilePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.writeHead(200, { 'Content-Type': contentType });
    const stream = fs.createReadStream(absoluteFilePath);
    stream.pipe(res);
  });
});

server.listen(PORT, HOST, () => {
  console.log(`=======================================================`);
  console.log(`   ANINDITA CREATIVE FRONTEND & BACKEND SERVER RUNNING`);
  console.log(`=======================================================`);
  console.log(`   Storefront / Profil  : http://${HOST}:${PORT}/`);
  console.log(`   Checkout Page        : http://${HOST}:${PORT}/checkout`);
  console.log(`   Konfirmasi WhatsApp  : http://${HOST}:${PORT}/konfirmasi`);
  console.log(`   Admin Dashboard      : http://${HOST}:${PORT}/dashboard`);
  console.log(`=======================================================`);
});

