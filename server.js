const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { DatabaseSync } = require("node:sqlite");
const { ImapFlow } = require("imapflow");
const { simpleParser } = require("mailparser");

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, "public");
const DATA_DIR = path.join(__dirname, "data");
const DB_PATH = path.join(DATA_DIR, "neurodesk.sqlite");
const packageInfo = require("./package.json");

fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new DatabaseSync(DB_PATH);

db.exec(`
  CREATE TABLE IF NOT EXISTS tickets (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    contact TEXT,
    area TEXT NOT NULL,
    urgency TEXT NOT NULL,
    status TEXT NOT NULL,
    source TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS config (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    username TEXT PRIMARY KEY,
    password_hash TEXT NOT NULL,
    salt TEXT NOT NULL
  );
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS processed_emails (
    message_id TEXT PRIMARY KEY,
    processed_at TEXT NOT NULL
  );
`);

// Run column migrations immediately — must be before prepared statements are compiled
(function runMigrations() {
  const cols = db.prepare("PRAGMA table_info(tickets)").all().map(c => c.name);
  if (!cols.includes("contact"))     db.exec("ALTER TABLE tickets ADD COLUMN contact TEXT");
  if (!cols.includes("subject"))     db.exec("ALTER TABLE tickets ADD COLUMN subject TEXT");
  if (!cols.includes("description")) db.exec("ALTER TABLE tickets ADD COLUMN description TEXT");
})();

// ── Sessions (in-memory, 24 h) ────────────────────────────────────────────────

const sessions = new Map();
const SESSION_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const SESSION_COOKIE_MAX_AGE = 86400;

function hashPassword(password, salt) {
  return crypto.createHash("sha256").update(salt + password).digest("hex");
}

function createSession(username) {
  const token = crypto.randomBytes(32).toString("hex");
  sessions.set(token, { username, expiresAt: Date.now() + SESSION_MAX_AGE_MS });
  return token;
}

function getSession(token) {
  if (!token) return null;
  const session = sessions.get(token);
  if (!session) return null;
  if (Date.now() > session.expiresAt) { sessions.delete(token); return null; }
  return session;
}

function parseCookies(req) {
  const cookies = {};
  (req.headers.cookie || "").split(";").forEach(part => {
    const idx = part.indexOf("=");
    if (idx < 0) return;
    const name = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    if (name) cookies[name] = decodeURIComponent(value);
  });
  return cookies;
}

function getAuthSession(req) {
  return getSession(parseCookies(req).nd_session || "");
}

// ── Config defaults ───────────────────────────────────────────────────────────

const DEFAULT_EMAIL_CONFIG = {
  enabled: false,
  host: "", port: 993,
  secure: true,
  username: "",
  password: "",
  folder: "INBOX",
  pollIntervalMinutes: 5,
  defaultArea: "Correo",
  defaultUrgency: "media"
};

let emailConfig       = JSON.parse(JSON.stringify(DEFAULT_EMAIL_CONFIG));
const emailPollStatus = { lastPoll: null, lastError: null, ticketsCreated: 0, polling: false };
let emailPollerTimer  = null;

const DEFAULT_CONFIG = {
  sla: { baja: 24, media: 8, alta: 4, critica: 1 },
  fields: {
    contact: { enabled: true, label: "Contacto" },
    area: { enabled: true, label: "Área" }
  }
};

let appConfig = JSON.parse(JSON.stringify(DEFAULT_CONFIG));

const ticketStatuses = ["abierto", "en_proceso", "en_espera", "resuelto"];

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml"
};

// ── Prepared statements ───────────────────────────────────────────────────────

const countTicketsStmt       = db.prepare("SELECT COUNT(*) AS total FROM tickets");
const listTicketsStmt        = db.prepare(`SELECT id, name, contact, area, urgency, status, source, subject, description, created_at AS createdAt FROM tickets ORDER BY created_at DESC`);
const nextTicketNumberStmt   = db.prepare(`SELECT COALESCE(MAX(CAST(SUBSTR(id, 4) AS INTEGER)), 1000) + 1 AS nextNumber FROM tickets WHERE id LIKE 'ND-%'`);
const insertTicketStmt       = db.prepare(`INSERT INTO tickets (id, name, contact, area, urgency, status, source, subject, description, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
const updateTicketStatusStmt = db.prepare("UPDATE tickets SET status = ? WHERE id = ?");
const updateTicketFullStmt   = db.prepare(`UPDATE tickets SET name = ?, contact = ?, area = ?, urgency = ?, status = ?, subject = ?, description = ? WHERE id = ?`);
const deleteTicketStmt       = db.prepare("DELETE FROM tickets WHERE id = ?");
const upsertConfigStmt       = db.prepare(`INSERT INTO config (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`);
const getConfigStmt          = db.prepare("SELECT value FROM config WHERE key = 'app_config'");
const countUsersStmt         = db.prepare("SELECT COUNT(*) AS total FROM users");
const getUserStmt            = db.prepare("SELECT * FROM users WHERE username = ?");
const insertUserStmt         = db.prepare("INSERT INTO users (username, password_hash, salt) VALUES (?, ?, ?)");
const updatePasswordStmt     = db.prepare("UPDATE users SET password_hash = ?, salt = ? WHERE username = ?");
const getEmailConfigStmt     = db.prepare("SELECT value FROM config WHERE key = 'email_config'");
const isEmailProcessedStmt   = db.prepare("SELECT 1 FROM processed_emails WHERE message_id = ?");
const markEmailProcessedStmt = db.prepare("INSERT OR IGNORE INTO processed_emails (message_id, processed_at) VALUES (?, ?)");
const cleanOldEmailsStmt     = db.prepare("DELETE FROM processed_emails WHERE processed_at < ?");

// ── Init ──────────────────────────────────────────────────────────────────────

migrateDatabase();
loadConfig();
loadEmailConfig();
seedDemoTicket();
seedAdminUser();
startEmailPoller();

// ── Helpers ───────────────────────────────────────────────────────────────────

function sendJson(res, status, data) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(data));
}

function sendStatic(req, res) {
  const requestedPath = req.url === "/" ? "/index.html" : req.url;
  const safePath = path.normalize(decodeURIComponent(requestedPath)).replace(/^(\.\.[/\\])+/, "");
  const filePath = path.join(PUBLIC_DIR, safePath);

  if (!filePath.startsWith(PUBLIC_DIR)) { res.writeHead(403); res.end("Forbidden"); return; }

  fs.readFile(filePath, (error, data) => {
    if (error) { res.writeHead(404); res.end("Not found"); return; }
    const ext = path.extname(filePath);
    res.writeHead(200, { "Content-Type": contentTypes[ext] || "application/octet-stream" });
    res.end(data);
  });
}

function serveFile(res, filename) {
  fs.readFile(path.join(PUBLIC_DIR, filename), (err, data) => {
    if (err) { res.writeHead(404); res.end("Not found"); return; }
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(data);
  });
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", chunk => { body += chunk; if (body.length > 1_000_000) { req.destroy(); reject(new Error("Payload too large")); } });
    req.on("end", () => {
      if (!body) { resolve({}); return; }
      try { resolve(JSON.parse(body)); } catch (e) { reject(e); }
    });
  });
}

function deepMerge(defaults, overrides) {
  const result = JSON.parse(JSON.stringify(defaults));
  if (!overrides || typeof overrides !== "object") return result;
  for (const key of Object.keys(result)) {
    if (key in overrides) {
      if (typeof result[key] === "object" && result[key] !== null && !Array.isArray(result[key])) {
        result[key] = deepMerge(result[key], overrides[key]);
      } else {
        result[key] = overrides[key];
      }
    }
  }
  return result;
}

// ── Config ────────────────────────────────────────────────────────────────────

function loadConfig() {
  const row = getConfigStmt.get();
  if (!row) return;
  try { appConfig = deepMerge(DEFAULT_CONFIG, JSON.parse(row.value)); } catch (_) {}
}

function saveConfig(incoming) {
  const sla = incoming.sla || {};
  const fields = incoming.fields || {};

  const validatedSla = Object.keys(DEFAULT_CONFIG.sla).reduce((acc, key) => {
    const val = Number(sla[key]);
    acc[key] = isFinite(val) && val > 0 ? val : DEFAULT_CONFIG.sla[key];
    return acc;
  }, {});

  const validatedFields = Object.keys(DEFAULT_CONFIG.fields).reduce((acc, key) => {
    const src = fields[key] || {};
    acc[key] = {
      enabled: typeof src.enabled === "boolean" ? src.enabled : DEFAULT_CONFIG.fields[key].enabled,
      label: String(src.label || DEFAULT_CONFIG.fields[key].label).trim().slice(0, 40) || DEFAULT_CONFIG.fields[key].label
    };
    return acc;
  }, {});

  appConfig = { sla: validatedSla, fields: validatedFields };
  upsertConfigStmt.run("app_config", JSON.stringify(appConfig));
  return appConfig;
}

// ── Tickets ───────────────────────────────────────────────────────────────────

function normalizeTicket(input, source = "web") {
  const name        = String(input.name || "").trim();
  const contact     = String(input.contact || "").trim();
  const area        = String(input.area || "").trim() || "General";
  const urgency     = String(input.urgency || "").trim().toLowerCase();
  const subject     = String(input.subject || "").trim().slice(0, 200);
  const description = String(input.description || "").trim().slice(0, 4000);

  if (!name || !appConfig.sla[urgency]) return null;

  return { id: getNextTicketId(), name, contact, area, urgency, status: "abierto", source, subject, description, createdAt: new Date().toISOString() };
}

function migrateDatabase() {
  // Column migrations are handled at startup before prepared statements — nothing to do here.
}

function seedDemoTicket() {
  const { total } = countTicketsStmt.get();
  if (total > 0) return;
  insertTicket({ id: "ND-1001", name: "Paciente demo", contact: "demo@neurofic.com", area: "Agenda", urgency: "media", status: "abierto", source: "web", createdAt: new Date(Date.now() - 42 * 60 * 1000).toISOString() });
}

function seedAdminUser() {
  const { total } = countUsersStmt.get();
  if (total > 0) return;
  const username = process.env.ND_USER || "admin";
  const password = process.env.ND_PASS || "neurofic";
  const salt = crypto.randomBytes(16).toString("hex");
  insertUserStmt.run(username, hashPassword(password, salt), salt);
  console.log(`Credenciales iniciales → usuario: ${username}  contraseña: ${password}`);
}

function getNextTicketId() {
  const { nextNumber } = nextTicketNumberStmt.get();
  return `ND-${nextNumber}`;
}

function insertTicket(ticket) {
  insertTicketStmt.run(ticket.id, ticket.name, ticket.contact, ticket.area, ticket.urgency, ticket.status, ticket.source, ticket.subject || "", ticket.description || "", ticket.createdAt);
  return ticket;
}

function getTickets() { return listTicketsStmt.all(); }

function updateTicketStatus(id, status) {
  if (!ticketStatuses.includes(status)) return null;
  const result = updateTicketStatusStmt.run(status, id);
  if (result.changes === 0) return null;
  return getTickets().find(t => t.id === id);
}

function updateTicketFull(id, data) {
  const name        = String(data.name || "").trim();
  const contact     = String(data.contact || "").trim();
  const area        = String(data.area || "").trim() || "General";
  const urgency     = String(data.urgency || "").trim().toLowerCase();
  const status      = String(data.status || "").trim();
  const subject     = String(data.subject || "").trim().slice(0, 200);
  const description = String(data.description || "").trim().slice(0, 4000);

  if (!name || !appConfig.sla[urgency] || !ticketStatuses.includes(status)) return null;
  const result = updateTicketFullStmt.run(name, contact, area, urgency, status, subject, description, id);
  if (result.changes === 0) return null;
  return getTickets().find(t => t.id === id);
}

function getSlaState(ticket) {
  const elapsedHours = (Date.now() - new Date(ticket.createdAt).getTime()) / 36e5;
  const limitHours = appConfig.sla[ticket.urgency] || 8;
  return { limitHours, remainingHours: Number(Math.max(limitHours - elapsedHours, 0).toFixed(1)), breached: elapsedHours > limitHours };
}

function getStats() {
  const tickets = getTickets();
  const active = tickets.filter(t => t.status !== "resuelto");
  const breached = active.filter(t => getSlaState(t).breached);
  const byStatus = ticketStatuses.reduce((s, st) => { s[st] = tickets.filter(t => t.status === st).length; return s; }, {});
  const byUrgency = Object.keys(appConfig.sla).reduce((s, u) => { s[u] = tickets.filter(t => t.urgency === u).length; return s; }, {});
  const avgRemainingHours = active.length === 0 ? 0 : Number((active.reduce((sum, t) => sum + getSlaState(t).remainingHours, 0) / active.length).toFixed(1));
  return {
    total: tickets.length, open: active.length, breached: breached.length,
    byStatus, byUrgency, avgRemainingHours,
    slaCompliance: active.length === 0 ? 100 : Math.round(((active.length - breached.length) / active.length) * 100)
  };
}

// ── Email config & poller ─────────────────────────────────────────────────────

function loadEmailConfig() {
  const row = getEmailConfigStmt.get();
  if (!row) return;
  try { emailConfig = Object.assign(JSON.parse(JSON.stringify(DEFAULT_EMAIL_CONFIG)), JSON.parse(row.value)); } catch (_) {}
}

function saveEmailConfig(incoming) {
  const host     = String(incoming.host || "").trim();
  const port     = parseInt(incoming.port) || 993;
  const secure   = incoming.secure !== false;
  const username = String(incoming.username || "").trim();
  const password = String(incoming.password || "").trim();
  const folder   = String(incoming.folder || "INBOX").trim() || "INBOX";
  const pollIntervalMinutes = Math.max(1, parseInt(incoming.pollIntervalMinutes) || 5);
  const defaultArea    = String(incoming.defaultArea || "Correo").trim() || "Correo";
  const rawUrgency     = String(incoming.defaultUrgency || "media").trim();
  const defaultUrgency = appConfig.sla[rawUrgency] ? rawUrgency : "media";
  const enabled        = incoming.enabled === true || incoming.enabled === "true";

  emailConfig = { enabled, host, port, secure, username, password, folder, pollIntervalMinutes, defaultArea, defaultUrgency };
  upsertConfigStmt.run("email_config", JSON.stringify(emailConfig));
  startEmailPoller();
  return emailConfig;
}

function detectUrgency(subject, body) {
  const text = `${subject} ${body}`.toLowerCase();
  if (/urgent|critico|critica|emergencia|critical|urgente/.test(text)) return "critica";
  if (/alto|alta|importante|important|high/.test(text)) return "alta";
  if (/bajo|baja|cuando puedas|low|no urgente/.test(text)) return "baja";
  return "media";
}

async function pollEmails() {
  if (!emailConfig.enabled || !emailConfig.host || !emailConfig.username || !emailConfig.password) return 0;
  if (emailPollStatus.polling) return 0;

  emailPollStatus.polling = true;
  let created = 0;

  const client = new ImapFlow({
    host: emailConfig.host, port: emailConfig.port, secure: emailConfig.secure,
    auth: { user: emailConfig.username, pass: emailConfig.password },
    logger: false
  });

  try {
    await client.connect();
    const lock = await client.getMailboxLock(emailConfig.folder);
    try {
      const uids = await client.search({ seen: false });
      for (const uid of uids) {
        const message = await client.fetchOne(uid, { source: true, uid: true });
        if (!message) continue;
        const parsed = await simpleParser(message.source);
        const messageId = parsed.messageId || `uid-${uid}-${Date.now()}`;
        if (isEmailProcessedStmt.get(messageId)) continue;
        const fromAddress = parsed.from?.value?.[0];
        const fromEmail   = fromAddress?.address || "";
        const fromName    = fromAddress?.name || fromEmail;
        const subject     = (parsed.subject || "(sin asunto)").slice(0, 200);
        const bodyText    = (parsed.text || (parsed.html || "").replace(/<[^>]+>/g, "")).trim().slice(0, 4000);
        const urgency     = detectUrgency(subject, bodyText);
        const ticket = normalizeTicket({ name: fromName || fromEmail, contact: fromEmail, area: emailConfig.defaultArea, urgency, subject, description: bodyText }, "email");
        if (ticket) {
          insertTicket(ticket);
          markEmailProcessedStmt.run(messageId, new Date().toISOString());
          created++;
        }
      }
    } finally { lock.release(); }
    await client.logout();
    emailPollStatus.lastPoll  = new Date().toISOString();
    emailPollStatus.lastError = null;
    emailPollStatus.ticketsCreated += created;
  } catch (err) {
    emailPollStatus.lastError = err.message;
    try { await client.logout(); } catch (_) {}
  } finally {
    emailPollStatus.polling = false;
    const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
    cleanOldEmailsStmt.run(cutoff);
  }
  return created;
}

async function testEmailConnection(cfg) {
  const client = new ImapFlow({
    host: cfg.host, port: parseInt(cfg.port) || 993, secure: cfg.secure !== false,
    auth: { user: cfg.username, pass: cfg.password },
    logger: false
  });
  try { await client.connect(); await client.logout(); return { ok: true }; }
  catch (err) {
    const msg = err.message || "";
    let hint = msg;
    if (/command failed|authentication failed|invalid credentials|login failed/i.test(msg)) {
      hint = "Credenciales incorrectas. Para Gmail debes usar una Contraseña de Aplicación (App Password) con IMAP habilitado en la cuenta.";
    } else if (/ECONNREFUSED|ETIMEDOUT|ENOTFOUND/i.test(msg)) {
      hint = `No se pudo conectar al servidor ${cfg.host}:${cfg.port}. Verifica el host y el puerto.`;
    } else if (/self.signed|certificate/i.test(msg)) {
      hint = "Error de certificado SSL. Intenta desactivar la conexión segura.";
    }
    return { ok: false, error: hint };
  }
}

function startEmailPoller() {
  if (emailPollerTimer) { clearInterval(emailPollerTimer); emailPollerTimer = null; }
  if (!emailConfig.enabled) return;
  const intervalMs = (emailConfig.pollIntervalMinutes || 5) * 60 * 1000;
  pollEmails().catch(() => {});
  emailPollerTimer = setInterval(() => pollEmails().catch(() => {}), intervalMs);
}

// ── Auth handler ──────────────────────────────────────────────────────────────

async function handleAuth(req, res) {
  if (req.method === "GET" && req.url === "/api/auth/me") {
    const session = getAuthSession(req);
    if (!session) { sendJson(res, 401, { error: "No autenticado." }); return; }
    sendJson(res, 200, { username: session.username });
    return;
  }

  if (req.method === "POST" && req.url === "/api/auth/login") {
    try {
      const body = await readBody(req);
      const username = String(body.username || "").trim().toLowerCase();
      const password = String(body.password || "");
      const user = getUserStmt.get(username);
      if (!user || hashPassword(password, user.salt) !== user.password_hash) {
        sendJson(res, 401, { error: "Usuario o contraseña incorrectos." });
        return;
      }
      const token = createSession(username);
      res.writeHead(200, {
        "Content-Type": "application/json; charset=utf-8",
        "Set-Cookie": `nd_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${SESSION_COOKIE_MAX_AGE}`
      });
      res.end(JSON.stringify({ username }));
    } catch {
      sendJson(res, 400, { error: "No se pudo leer la solicitud." });
    }
    return;
  }

  if (req.method === "POST" && req.url === "/api/auth/logout") {
    const cookies = parseCookies(req);
    if (cookies.nd_session) sessions.delete(cookies.nd_session);
    res.writeHead(200, {
      "Content-Type": "application/json; charset=utf-8",
      "Set-Cookie": "nd_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0"
    });
    res.end(JSON.stringify({ ok: true }));
    return;
  }

  if (req.method === "POST" && req.url === "/api/auth/password") {
    const session = getAuthSession(req);
    if (!session) { sendJson(res, 401, { error: "No autenticado." }); return; }
    try {
      const body = await readBody(req);
      const current = String(body.current || "");
      const newPass = String(body.password || "").trim();
      if (newPass.length < 4) { sendJson(res, 400, { error: "Mínimo 4 caracteres." }); return; }
      const user = getUserStmt.get(session.username);
      if (!user || hashPassword(current, user.salt) !== user.password_hash) {
        sendJson(res, 401, { error: "Contraseña actual incorrecta." });
        return;
      }
      const newSalt = crypto.randomBytes(16).toString("hex");
      updatePasswordStmt.run(hashPassword(newPass, newSalt), newSalt, session.username);
      sendJson(res, 200, { ok: true });
    } catch {
      sendJson(res, 400, { error: "No se pudo cambiar la contraseña." });
    }
    return;
  }

  sendJson(res, 404, { error: "Ruta no encontrada." });
}

// ── API handler ───────────────────────────────────────────────────────────────

async function handleApi(req, res) {
  if (req.method === "GET" && req.url === "/api/version") {
    sendJson(res, 200, { version: packageInfo.version }); return;
  }

  if (req.method === "GET" && req.url === "/api/config") {
    sendJson(res, 200, appConfig); return;
  }

  if (req.method === "PUT" && req.url === "/api/config") {
    try { sendJson(res, 200, saveConfig(await readBody(req))); }
    catch { sendJson(res, 400, { error: "No se pudo guardar la configuración." }); }
    return;
  }

  if (req.method === "GET" && req.url === "/api/tickets") {
    sendJson(res, 200, getTickets().map(t => ({ ...t, sla: getSlaState(t) }))); return;
  }

  if (req.method === "GET" && req.url === "/api/stats") {
    sendJson(res, 200, getStats()); return;
  }

  if (req.method === "POST" && req.url === "/api/tickets") {
    try {
      const ticket = normalizeTicket(await readBody(req), "web");
      if (!ticket) { sendJson(res, 400, { error: "Nombre y urgencia válida son obligatorios." }); return; }
      sendJson(res, 201, insertTicket(ticket));
    } catch { sendJson(res, 400, { error: "No se pudo leer la solicitud." }); }
    return;
  }

  // DELETE single ticket
  if (req.method === "DELETE" && /^\/api\/tickets\/[^/]+$/.test(req.url)) {
    const id = decodeURIComponent(req.url.split("/")[3] || "");
    const result = deleteTicketStmt.run(id);
    if (result.changes === 0) { sendJson(res, 404, { error: "Ticket no encontrado." }); return; }
    sendJson(res, 200, { ok: true });
    return;
  }

  // DELETE bulk tickets
  if (req.method === "DELETE" && req.url === "/api/tickets") {
    try {
      const body = await readBody(req);
      const ids = Array.isArray(body.ids) ? body.ids.filter(id => typeof id === "string").slice(0, 500) : [];
      if (ids.length === 0) { sendJson(res, 400, { error: "No se proporcionaron IDs válidos." }); return; }
      const placeholders = ids.map(() => "?").join(",");
      const result = db.prepare(`DELETE FROM tickets WHERE id IN (${placeholders})`).run(...ids);
      sendJson(res, 200, { deleted: result.changes });
    } catch { sendJson(res, 400, { error: "No se pudo procesar la solicitud." }); }
    return;
  }

  if (req.method === "PATCH" && req.url.startsWith("/api/tickets/") && req.url.endsWith("/status")) {
    try {
      const id = decodeURIComponent(req.url.split("/")[3] || "");
      const body = await readBody(req);
      const ticket = updateTicketStatus(id, String(body.status || "").trim());
      if (!ticket) { sendJson(res, 400, { error: "Ticket no encontrado o estado inválido." }); return; }
      sendJson(res, 200, { ...ticket, sla: getSlaState(ticket) });
    } catch { sendJson(res, 400, { error: "No se pudo actualizar el estado." }); }
    return;
  }

  if (req.method === "PATCH" && /^\/api\/tickets\/[^/]+$/.test(req.url)) {
    try {
      const id = decodeURIComponent(req.url.split("/")[3] || "");
      const ticket = updateTicketFull(id, await readBody(req));
      if (!ticket) { sendJson(res, 400, { error: "Ticket no encontrado o datos inválidos." }); return; }
      sendJson(res, 200, { ...ticket, sla: getSlaState(ticket) });
    } catch { sendJson(res, 400, { error: "No se pudo actualizar el ticket." }); }
    return;
  }

  if (req.method === "GET" && req.url === "/api/email/config") {
    const safe = { ...emailConfig, password: emailConfig.password ? "••••••••" : "" };
    sendJson(res, 200, safe); return;
  }

  if (req.method === "PUT" && req.url === "/api/email/config") {
    try {
      const body = await readBody(req);
      if (body.password === "••••••••") body.password = emailConfig.password;
      const saved = saveEmailConfig(body);
      sendJson(res, 200, { ...saved, password: saved.password ? "••••••••" : "" });
    } catch { sendJson(res, 400, { error: "No se pudo guardar la configuración de correo." }); }
    return;
  }

  if (req.method === "POST" && req.url === "/api/email/test") {
    try {
      const body = await readBody(req);
      if (body.password === "••••••••") body.password = emailConfig.password;
      const result = await testEmailConnection(body);
      sendJson(res, result.ok ? 200 : 400, result);
    } catch { sendJson(res, 400, { error: "No se pudo probar la conexión." }); }
    return;
  }

  if (req.method === "POST" && req.url === "/api/email/poll") {
    try {
      const created = await pollEmails();
      sendJson(res, 200, { ok: true, created });
    } catch { sendJson(res, 400, { error: "Error durante el sondeo." }); }
    return;
  }

  if (req.method === "GET" && req.url === "/api/email/status") {
    sendJson(res, 200, { ...emailPollStatus }); return;
  }

  if (req.method === "POST" && req.url === "/api/email/inbound") {
    try {
      const body = await readBody(req);
      const ticket = normalizeTicket({ name: body.from || body.name, contact: body.from || body.contact, area: body.area || "Correo", urgency: body.urgency || "media" }, "email");
      if (!ticket) { sendJson(res, 400, { error: "El correo no contiene datos suficientes." }); return; }
      sendJson(res, 201, insertTicket(ticket));
    } catch { sendJson(res, 400, { error: "No se pudo procesar el correo entrante." }); }
    return;
  }

  sendJson(res, 404, { error: "Ruta no encontrada." });
}

// ── Main server ───────────────────────────────────────────────────────────────

const isPublicApi = (method, url) =>
  (method === "GET"  && (url === "/api/version" || url === "/api/config")) ||
  (method === "POST" && (url === "/api/tickets" || url === "/api/email/inbound"));

const server = http.createServer(async (req, res) => {
  // Portal — always public
  if (req.url === "/portal") { serveFile(res, "portal.html"); return; }

  // Auth endpoints — always public
  if (req.url.startsWith("/api/auth/")) { await handleAuth(req, res); return; }

  // Check session for everything else
  const session = getAuthSession(req);
  const publicApi = isPublicApi(req.method, req.url);

  if (!session && !publicApi) {
    if (req.url.startsWith("/api/")) {
      sendJson(res, 401, { error: "No autenticado." });
    } else if (req.url === "/login") {
      serveFile(res, "login.html");
    } else {
      res.writeHead(302, { Location: "/login" });
      res.end();
    }
    return;
  }

  // Redirect logged-in user away from /login
  if (req.url === "/login" && session) {
    res.writeHead(302, { Location: "/" });
    res.end();
    return;
  }

  if (req.url.startsWith("/api/")) { await handleApi(req, res); return; }

  sendStatic(req, res);
});

server.listen(PORT, () => {
  console.log(`NeuroDesk v${packageInfo.version} listo en http://localhost:${PORT}`);
  console.log(`Portal público en http://localhost:${PORT}/portal`);
});
