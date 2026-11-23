const http = require("node:http");
const fs = require("node:fs/promises");
const path = require("node:path");
const crypto = require("node:crypto");

const ROOT = __dirname;
const CONTENT_PATH = path.join(ROOT, "content.json");
const HOST = process.env.HOST || "127.0.0.1";
const PORT = Number(process.env.PORT || 4173);
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || "admin";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "";
const SESSION_TTL_MS = 8 * 60 * 60 * 1000;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_LIMIT = 5;
const sessions = new Map();
const loginAttempts = new Map();
const passwordDigest = crypto.createHash("sha256").update(ADMIN_PASSWORD).digest();
let currentContent;

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function assertRecord(value, label) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new HttpError(400, `${label} harus berupa objek.`);
  }
}

function assertText(value, label, maxLength = 1000) {
  if (typeof value !== "string" || value.length > maxLength) {
    throw new HttpError(400, `${label} tidak valid.`);
  }
}

function assertArray(value, label, maxLength = 100) {
  if (!Array.isArray(value) || value.length > maxLength) {
    throw new HttpError(400, `${label} tidak valid.`);
  }
}

function assertHexColor(value, label) {
  if (typeof value !== "string" || !/^#[\da-f]{6}$/i.test(value)) {
    throw new HttpError(400, `${label} harus berupa kode warna hex.`);
  }
}

function assertTextFields(object, fields, label) {
  assertRecord(object, label);
  for (const [field, maxLength] of fields) {
    assertText(object[field], `${label}.${field}`, maxLength);
  }
}

function assertTextList(items, label, maxLength = 100) {
  assertArray(items, label, maxLength);
  items.forEach((item, index) => assertText(item, `${label}[${index}]`));
}

function validateContent(content) {
  assertRecord(content, "Konten");

  assertRecord(content.theme, "Tema");
  for (const key of ["ink", "inkSoft", "paper", "sand", "tan", "green"]) {
    assertHexColor(content.theme[key], `Tema.${key}`);
  }
  assertRecord(content.layout, "Layout");
  const layoutRanges = {
    containerWidth: [720, 1800],
    sectionSpacing: [40, 200],
    cardRadius: [8, 48],
    galleryRatio: [0.6, 1.4],
    galleryGap: [1, 8],
    galleryStagger: [0, 20]
  };
  for (const [key, [min, max]] of Object.entries(layoutRanges)) {
    const value = content.layout[key];
    if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max) {
      throw new HttpError(400, `Nilai layout ${key} harus berada antara ${min} dan ${max}.`);
    }
  }

  assertTextFields(content.brand, [["name", 80], ["orderButton", 80], ["tagline", 500]], "Brand");
  assertArray(content.navigation, "Navigasi", 20);
  content.navigation.forEach((item, index) => {
    assertTextFields(item, [["label", 80], ["href", 100]], `Navigasi[${index}]`);
    if (!/^#[a-z\d_-]+$/i.test(item.href)) throw new HttpError(400, "Tautan navigasi harus menuju bagian halaman.");
  });

  assertTextFields(content.hero, [
    ["eyebrow", 160], ["title", 500], ["description", 1000],
    ["primaryButton", 80], ["whatsappButton", 80]
  ], "Hero");
  assertArray(content.hero.stats, "Statistik hero", 8);
  content.hero.stats.forEach((item, index) => assertTextFields(item, [["value", 40], ["label", 100]], `Statistik[${index}]`));
  assertArray(content.hero.gallery, "Galeri hero", 4);
  if (content.hero.gallery.length !== 4) throw new HttpError(400, "Galeri hero harus memiliki empat tile.");
  content.hero.gallery.forEach((item, index) => {
    assertText(item.label, `Galeri[${index}].label`, 80);
    assertHexColor(item.start, `Galeri[${index}].start`);
    assertHexColor(item.end, `Galeri[${index}].end`);
  });

  assertTextList(content.serviceRibbon, "Ribbon layanan", 30);
  assertTextFields(content.servicesHeading, [
    ["eyebrow", 120], ["title", 300], ["description", 500], ["priceLabel", 80], ["addButton", 80]
  ], "Judul layanan");
  assertArray(content.services, "Layanan", 50);
  const serviceIds = new Set();
  content.services.forEach((item, index) => {
    assertTextFields(item, [["id", 80], ["icon", 12], ["name", 120], ["description", 1000]], `Layanan[${index}]`);
    if (!/^[a-z\d-]+$/i.test(item.id) || serviceIds.has(item.id)) throw new HttpError(400, "ID layanan harus unik dan hanya berisi huruf, angka, atau tanda hubung.");
    serviceIds.add(item.id);
    if (!Number.isSafeInteger(item.price) || item.price < 0 || item.price > 1_000_000_000_000) {
      throw new HttpError(400, `Harga layanan ${item.name} tidak valid.`);
    }
  });

  assertTextFields(content.portfolioHeading, [
    ["eyebrow", 120], ["title", 300], ["viewAllButton", 80], ["viewAllNote", 300]
  ], "Judul portofolio");
  assertArray(content.portfolioFilters, "Filter portofolio", 30);
  content.portfolioFilters.forEach((item, index) => assertTextFields(item, [["label", 80], ["value", 100]], `Filter[${index}]`));
  assertArray(content.projects, "Portofolio", 100);
  content.projects.forEach((item, index) => {
    assertTextFields(item, [["name", 160], ["category", 100], ["client", 120], ["year", 8]], `Portofolio[${index}]`);
    assertArray(item.colors, `Warna portofolio[${index}]`, 2);
    if (item.colors.length !== 2) throw new HttpError(400, "Setiap project harus memiliki dua warna.");
    item.colors.forEach((color, colorIndex) => assertHexColor(color, `Warna portofolio[${index}][${colorIndex}]`));
  });

  assertTextFields(content.about, [["eyebrow", 120], ["title", 300], ["description", 1200]], "Tentang");
  assertArray(content.about.imageColors, "Warna gambar tentang", 3);
  if (content.about.imageColors.length !== 3) throw new HttpError(400, "Visual tentang harus memiliki tiga warna.");
  content.about.imageColors.forEach((color, index) => assertHexColor(color, `Warna gambar tentang[${index}]`));
  assertArray(content.about.features, "Poin tentang", 30);
  content.about.features.forEach((item, index) => assertTextFields(item, [["icon", 12], ["title", 120], ["description", 500]], `Poin tentang[${index}]`));

  assertTextFields(content.process, [["eyebrow", 120], ["title", 300]], "Proses");
  assertArray(content.process.steps, "Langkah proses", 20);
  content.process.steps.forEach((item, index) => assertTextFields(item, [["number", 12], ["title", 120], ["description", 500]], `Langkah proses[${index}]`));

  assertTextFields(content.testimonials, [["eyebrow", 120], ["title", 300]], "Testimoni");
  assertArray(content.testimonials.items, "Testimoni", 50);
  content.testimonials.items.forEach((item, index) => assertTextFields(item, [["quote", 1000], ["name", 120], ["role", 120]], `Testimoni[${index}]`));

  assertTextFields(content.contact, [["title", 300], ["description", 1000], ["whatsappButton", 80], ["cartButton", 80]], "Kontak");
  assertTextFields(content.footer, [
    ["servicesTitle", 80], ["companyTitle", 80], ["contactTitle", 80], ["checkoutLabel", 80],
    ["description", 500], ["whatsappDisplay", 40], ["whatsappNumber", 15],
    ["email", 160], ["instagramHandle", 100], ["instagramUrl", 300], ["copyright", 200]
  ], "Footer");
  if (!/^\d{8,15}$/.test(content.footer.whatsappNumber)) throw new HttpError(400, "Nomor WhatsApp harus berupa 8–15 digit.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(content.footer.email)) throw new HttpError(400, "Alamat email footer tidak valid.");
  let instagramUrl;
  try {
    instagramUrl = new URL(content.footer.instagramUrl);
  } catch {
    throw new HttpError(400, "Tautan Instagram tidak valid.");
  }
  if (instagramUrl.protocol !== "https:") throw new HttpError(400, "Tautan Instagram harus menggunakan HTTPS.");
  return content;
}

function sendJson(response, status, payload, extraHeaders = {}) {
  const body = JSON.stringify(payload);
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "Content-Length": Buffer.byteLength(body),
    ...extraHeaders
  });
  response.end(body);
}

async function readJsonBody(request, maxBytes = 2 * 1024 * 1024) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > maxBytes) throw new HttpError(413, "Ukuran request terlalu besar.");
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new HttpError(400, "Format JSON tidak valid.");
  }
}

function verifySameOrigin(request) {
  const origin = request.headers.origin;
  if (!origin) throw new HttpError(403, "Origin request tidak tersedia.");
  try {
    const parsedOrigin = new URL(origin);
    const expectedProtocol = process.env.NODE_ENV === "production" ? "https:" : "http:";
    if (parsedOrigin.host !== request.headers.host || parsedOrigin.protocol !== expectedProtocol) {
      throw new HttpError(403, "Origin request tidak diizinkan.");
    }
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(403, "Origin request tidak valid.");
  }
}

function sessionCookie(value, maxAge) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `admin_session=${value}; Path=/api; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${secure}`;
}

function sessionIdFromRequest(request) {
  const cookie = (request.headers.cookie || "").split(";").map((part) => part.trim());
  const value = cookie.find((part) => part.startsWith("admin_session="))?.slice("admin_session=".length);
  if (!value) return null;
  const session = sessions.get(value);
  if (!session) return null;
  if (session.expiresAt <= Date.now()) {
    sessions.delete(value);
    return null;
  }
  return { id: value, username: session.username };
}

function requireAdmin(request) {
  const session = sessionIdFromRequest(request);
  if (!session) throw new HttpError(401, "Sesi admin tidak valid atau sudah berakhir.");
  return session;
}

function constantTimePasswordMatch(value) {
  const supplied = crypto.createHash("sha256").update(value).digest();
  return crypto.timingSafeEqual(supplied, passwordDigest);
}

function checkLoginLimit(ip) {
  const attempt = loginAttempts.get(ip);
  if (!attempt) return;
  if (attempt.resetAt <= Date.now()) {
    loginAttempts.delete(ip);
    return;
  }
  if (attempt.count >= LOGIN_LIMIT) throw new HttpError(429, "Terlalu banyak percobaan login. Coba lagi dalam 15 menit.");
}

function recordFailedLogin(ip) {
  const now = Date.now();
  const attempt = loginAttempts.get(ip);
  if (!attempt || attempt.resetAt <= now) {
    loginAttempts.set(ip, { count: 1, resetAt: now + LOGIN_WINDOW_MS });
    return;
  }
  attempt.count += 1;
}

function clearLoginAttempts(ip) {
  loginAttempts.delete(ip);
}

async function saveContent(content) {
  const temporaryPath = path.join(ROOT, `.content-${crypto.randomBytes(8).toString("hex")}.tmp`);
  await fs.writeFile(temporaryPath, `${JSON.stringify(content, null, 2)}\n`, { flag: "wx" });
  try {
    await fs.rename(temporaryPath, CONTENT_PATH);
  } catch (error) {
    await fs.rm(temporaryPath, { force: true });
    throw error;
  }
}

function mimeType(filePath) {
  return ({
    ".css": "text/css; charset=utf-8",
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".png": "image/png",
    ".svg": "image/svg+xml"
  })[path.extname(filePath).toLowerCase()] || "application/octet-stream";
}

async function serveStatic(request, response, pathname) {
  if (request.method !== "GET" && request.method !== "HEAD") {
    throw new HttpError(405, "Metode request tidak diizinkan.");
  }
  let relativePath = pathname === "/" ? "index.html" : pathname.slice(1);
  if (pathname === "/admin" || pathname === "/admin/") relativePath = "admin/index.html";
  if (relativePath.startsWith(".") || relativePath.includes("/.")) {
    throw new HttpError(404, "Halaman tidak ditemukan.");
  }
  const filePath = path.resolve(ROOT, relativePath);
  const resolvedRelativePath = path.relative(ROOT, filePath);
  if (
    !filePath.toLowerCase().startsWith(`${ROOT}${path.sep}`.toLowerCase())
    || resolvedRelativePath.toLowerCase() === "server.js"
    || resolvedRelativePath.split(path.sep).includes("..")
  ) {
    throw new HttpError(404, "Halaman tidak ditemukan.");
  }
  let fileInfo;
  try {
    fileInfo = await fs.stat(filePath);
  } catch {
    throw new HttpError(404, "Halaman tidak ditemukan.");
  }
  if (!fileInfo.isFile()) throw new HttpError(404, "Halaman tidak ditemukan.");
  response.writeHead(200, {
    "Content-Type": mimeType(filePath),
    "Cache-Control": "no-cache",
    "Content-Length": fileInfo.size,
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "strict-origin-when-cross-origin"
  });
  if (request.method === "HEAD") {
    response.end();
    return;
  }
  const stream = require("node:fs").createReadStream(filePath);
  stream.on("error", (error) => {
    console.error("Static file read failed:", error);
    if (!response.headersSent) sendJson(response, 500, { error: "Gagal membaca file halaman." });
    else response.destroy(error);
  });
  stream.pipe(response);
}

async function handleRequest(request, response) {
  try {
    const url = new URL(request.url, `http://${request.headers.host || "localhost"}`);
    const pathname = decodeURIComponent(url.pathname);
    response.setHeader("X-Content-Type-Options", "nosniff");
    response.setHeader("X-Frame-Options", "DENY");
    response.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");

    if (pathname === "/api/content" && request.method === "GET") {
      sendJson(response, 200, { content: currentContent });
      return;
    }
    if (pathname === "/api/auth/session" && request.method === "GET") {
      const session = sessionIdFromRequest(request);
      sendJson(response, 200, { authenticated: Boolean(session), username: session?.username || null });
      return;
    }
    if (pathname === "/api/auth/login" && request.method === "POST") {
      verifySameOrigin(request);
      const ip = request.socket.remoteAddress || "unknown";
      checkLoginLimit(ip);
      const body = await readJsonBody(request, 8 * 1024);
      assertRecord(body, "Request login");
      const username = typeof body.username === "string" ? body.username : "";
      const password = typeof body.password === "string" ? body.password : "";
      const usernameValid = username === ADMIN_USERNAME;
      const passwordValid = constantTimePasswordMatch(password);
      if (!usernameValid || !passwordValid) {
        recordFailedLogin(ip);
        throw new HttpError(401, "Nama pengguna atau password salah.");
      }
      clearLoginAttempts(ip);
      const id = crypto.randomBytes(32).toString("base64url");
      sessions.set(id, { username: ADMIN_USERNAME, expiresAt: Date.now() + SESSION_TTL_MS });
      sendJson(response, 200, { authenticated: true, username: ADMIN_USERNAME }, {
        "Set-Cookie": sessionCookie(id, Math.floor(SESSION_TTL_MS / 1000))
      });
      return;
    }
    if (pathname === "/api/auth/logout" && request.method === "POST") {
      verifySameOrigin(request);
      const session = sessionIdFromRequest(request);
      if (session) sessions.delete(session.id);
      sendJson(response, 200, { authenticated: false }, { "Set-Cookie": sessionCookie("", 0) });
      return;
    }
    if (pathname === "/api/content" && request.method === "PUT") {
      verifySameOrigin(request);
      requireAdmin(request);
      const updatedContent = validateContent(await readJsonBody(request));
      await saveContent(updatedContent);
      currentContent = updatedContent;
      sendJson(response, 200, { saved: true, content: currentContent });
      return;
    }
    if (pathname.startsWith("/api/")) throw new HttpError(404, "Endpoint tidak ditemukan.");
    await serveStatic(request, response, pathname);
  } catch (error) {
    if (response.headersSent) {
      response.destroy(error);
      return;
    }
    if (error instanceof HttpError) {
      sendJson(response, error.status, { error: error.message });
      return;
    }
    console.error("Request failed:", error);
    sendJson(response, 500, { error: "Terjadi kesalahan pada server." });
  }
}

async function start() {
  if (ADMIN_PASSWORD.length < 16) {
    throw new Error("Atur ADMIN_PASSWORD dengan minimal 16 karakter sebelum menjalankan server.");
  }
  currentContent = validateContent(JSON.parse(await fs.readFile(CONTENT_PATH, "utf8")));
  const server = http.createServer(handleRequest);
  server.listen(PORT, HOST, () => {
    console.log(`Anindita Creative berjalan di http://${HOST}:${PORT}`);
    console.log("Panel admin: /admin");
  });
}

start().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
