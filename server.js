const http = require("http");
const https = require("https");
const fs = require("fs");
const path = require("path");
const os = require("os");
const crypto = require("crypto");
const { ImapFlow } = require("imapflow");
const { simpleParser } = require("mailparser");
const nodemailer = require("nodemailer");

const PORT = process.env.PORT || 3000;
const HOST = process.env.ND_HOST || "0.0.0.0";
const PUBLIC_DIR = path.join(__dirname, "public");
// Datos fuera del directorio del proyecto para sobrevivir git pull y re-clones.
// Override posible con ND_STORE_PATH si se necesita una ruta específica.
const STORE_PATH = process.env.ND_STORE_PATH || path.join(os.homedir(), ".neurodesk", "data.json");
const ATTACH_DIR = path.join(path.dirname(STORE_PATH), "attachments");
const packageInfo = require("./package.json");

try {
  fs.mkdirSync(path.dirname(STORE_PATH), { recursive: true });
  fs.mkdirSync(ATTACH_DIR, { recursive: true });
} catch (err) {
  console.error("[NeuroDesk] No se pudo preparar la carpeta de datos:", err.message);
}

const EMPTY_STORE = {
  tickets: [],
  config: {},
  users: [],
  processedEmails: [],
  ticketHistory: [],
};

function loadStore() {
  try {
    const parsed = JSON.parse(fs.readFileSync(STORE_PATH, "utf8"));
    return {
      tickets: Array.isArray(parsed.tickets) ? parsed.tickets : [],
      config: parsed.config && typeof parsed.config === "object" ? parsed.config : {},
      users: Array.isArray(parsed.users) ? parsed.users : [],
      processedEmails: Array.isArray(parsed.processedEmails) ? parsed.processedEmails : [],
      ticketHistory: Array.isArray(parsed.ticketHistory) ? parsed.ticketHistory : [],
    };
  } catch (_) {
    return JSON.parse(JSON.stringify(EMPTY_STORE));
  }
}

const store = loadStore();

function saveStore() {
  try {
    fs.mkdirSync(path.dirname(STORE_PATH), { recursive: true });
    const tmpPath = `${STORE_PATH}.tmp`;
    fs.writeFileSync(tmpPath, JSON.stringify(store, null, 2));
    fs.renameSync(tmpPath, STORE_PATH);
  } catch (err) {
    console.error(
      "[NeuroDesk] No se pudo guardar datos en disco; continuando en memoria:",
      err.message
    );
  }
}

function statement(sql) {
  const compact = sql.replace(/\s+/g, " ").trim();
  if (compact.startsWith("PRAGMA table_info")) return { all: () => [] };
  if (compact.startsWith("SELECT COUNT(*) AS total FROM tickets")) {
    return { get: () => ({ total: store.tickets.length }) };
  }
  if (compact.startsWith("SELECT id, name, contact")) {
    return {
      all: () =>
        [...store.tickets].sort(
          (a, b) =>
            (a.sortOrder ?? 0) - (b.sortOrder ?? 0) ||
            String(b.createdAt).localeCompare(String(a.createdAt))
        ),
    };
  }
  if (compact.startsWith("SELECT COALESCE(MAX")) {
    return {
      get: () => {
        const max = store.tickets.reduce((highest, ticket) => {
          const match = /^ND-(\d+)$/.exec(ticket.id || "");
          return match ? Math.max(highest, Number(match[1])) : highest;
        }, 1000);
        return { nextNumber: max + 1 };
      },
    };
  }
  if (compact.startsWith("INSERT INTO tickets")) {
    return {
      run: (
        id,
        name,
        contact,
        area,
        urgency,
        status,
        source,
        subject,
        description,
        htmlBody,
        assignedTo,
        resolution,
        customFields,
        attachments,
        workedHours,
        sortOrder,
        createdAt
      ) => {
        store.tickets.push({
          id,
          name,
          contact,
          area,
          urgency,
          status,
          source,
          subject,
          description,
          htmlBody,
          assignedTo,
          resolution,
          customFields,
          attachments,
          workedHours,
          sortOrder,
          createdAt,
        });
        saveStore();
        return { changes: 1 };
      },
    };
  }
  if (compact === "UPDATE tickets SET status = ? WHERE id = ?") {
    return {
      run: (status, id) => {
        const ticket = store.tickets.find((t) => t.id === id);
        if (!ticket) return { changes: 0 };
        ticket.status = status;
        saveStore();
        return { changes: 1 };
      },
    };
  }
  if (compact.startsWith("UPDATE tickets SET name = ?")) {
    return {
      run: (
        name,
        contact,
        area,
        urgency,
        status,
        subject,
        description,
        resolution,
        customFields,
        workedHours,
        assignedTo,
        id
      ) => {
        const ticket = store.tickets.find((t) => t.id === id);
        if (!ticket) return { changes: 0 };
        Object.assign(ticket, {
          name,
          contact,
          area,
          urgency,
          status,
          subject,
          description,
          resolution,
          customFields,
          workedHours,
          assignedTo,
        });
        saveStore();
        return { changes: 1 };
      },
    };
  }
  if (compact === "UPDATE tickets SET status = ?, sort_order = ? WHERE id = ?") {
    return {
      run: (status, sortOrder, id) => {
        const ticket = store.tickets.find((t) => t.id === id);
        if (!ticket) return { changes: 0 };
        Object.assign(ticket, { status, sortOrder });
        saveStore();
        return { changes: 1 };
      },
    };
  }
  if (compact === "DELETE FROM tickets WHERE id = ?") {
    return {
      run: (id) => {
        const before = store.tickets.length;
        store.tickets = store.tickets.filter((ticket) => ticket.id !== id);
        saveStore();
        return { changes: before - store.tickets.length };
      },
    };
  }
  if (compact.startsWith("DELETE FROM tickets WHERE id IN")) {
    return {
      run: (...ids) => {
        const set = new Set(ids);
        const before = store.tickets.length;
        store.tickets = store.tickets.filter((ticket) => !set.has(ticket.id));
        saveStore();
        return { changes: before - store.tickets.length };
      },
    };
  }
  if (compact === "DELETE FROM ticket_history WHERE ticket_id = ?") {
    return {
      run: (ticketId) => {
        const before = store.ticketHistory.length;
        store.ticketHistory = store.ticketHistory.filter((item) => item.ticketId !== ticketId);
        saveStore();
        return { changes: before - store.ticketHistory.length };
      },
    };
  }
  if (compact.startsWith("INSERT INTO ticket_history")) {
    return {
      run: (id, ticketId, note, status, createdAt) => {
        store.ticketHistory.push({ id, ticketId, note, status, createdAt });
        saveStore();
        return { changes: 1 };
      },
    };
  }
  if (compact.startsWith("SELECT id, note, status")) {
    return {
      all: (ticketId) =>
        store.ticketHistory
          .filter((item) => item.ticketId === ticketId)
          .sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt))),
    };
  }
  if (compact.startsWith("INSERT INTO config")) {
    return {
      run: (key, value) => {
        store.config[key] = value;
        saveStore();
        return { changes: 1 };
      },
    };
  }
  if (compact === "SELECT value FROM config WHERE key = 'app_config'") {
    return {
      get: () => (store.config.app_config ? { value: store.config.app_config } : undefined),
    };
  }
  if (compact === "SELECT value FROM config WHERE key = 'email_config'") {
    return {
      get: () => (store.config.email_config ? { value: store.config.email_config } : undefined),
    };
  }
  if (compact === "SELECT value FROM config WHERE key = 'notifications_config'") {
    return {
      get: () =>
        store.config.notifications_config
          ? { value: store.config.notifications_config }
          : undefined,
    };
  }
  if (compact === "SELECT COUNT(*) AS total FROM users") {
    return { get: () => ({ total: store.users.length }) };
  }
  if (compact === "SELECT * FROM users WHERE username = ?") {
    return { get: (username) => store.users.find((user) => user.username === username) };
  }
  if (compact.startsWith("INSERT INTO users")) {
    return {
      run: (username, passwordHash, salt) => {
        store.users.push({ username, password_hash: passwordHash, salt });
        saveStore();
        return { changes: 1 };
      },
    };
  }
  if (compact.startsWith("UPDATE users SET password_hash")) {
    return {
      run: (passwordHash, salt, username) => {
        const user = store.users.find((item) => item.username === username);
        if (!user) return { changes: 0 };
        Object.assign(user, { password_hash: passwordHash, salt });
        saveStore();
        return { changes: 1 };
      },
    };
  }
  if (compact === "SELECT username FROM users") {
    return { all: () => store.users.map((u) => ({ username: u.username })) };
  }
  if (compact === "UPDATE users SET username = ? WHERE username = ?") {
    return {
      run: (newUsername, oldUsername) => {
        const user = store.users.find((u) => u.username === oldUsername);
        if (!user) return { changes: 0 };
        user.username = newUsername;
        saveStore();
        return { changes: 1 };
      },
    };
  }
  if (compact === "DELETE FROM users WHERE username = ?") {
    return {
      run: (username) => {
        const idx = store.users.findIndex((u) => u.username === username);
        if (idx === -1) return { changes: 0 };
        store.users.splice(idx, 1);
        saveStore();
        return { changes: 1 };
      },
    };
  }
  if (compact === "SELECT 1 FROM processed_emails WHERE message_id = ?") {
    return {
      get: (messageId) =>
        store.processedEmails.some((item) => item.messageId === messageId) ? { 1: 1 } : undefined,
    };
  }
  if (compact.startsWith("INSERT OR IGNORE INTO processed_emails")) {
    return {
      run: (messageId, processedAt) => {
        if (store.processedEmails.some((item) => item.messageId === messageId))
          return { changes: 0 };
        store.processedEmails.push({ messageId, processedAt });
        saveStore();
        return { changes: 1 };
      },
    };
  }
  if (compact === "DELETE FROM processed_emails WHERE processed_at < ?") {
    return {
      run: (cutoff) => {
        const before = store.processedEmails.length;
        store.processedEmails = store.processedEmails.filter(
          (item) => String(item.processedAt) >= cutoff
        );
        saveStore();
        return { changes: before - store.processedEmails.length };
      },
    };
  }
  throw new Error(`Unsupported storage statement: ${compact}`);
}

const db = {
  exec() {},
  prepare: statement,
};

// Run column migrations immediately — must be before prepared statements are compiled
(function runMigrations() {
  const cols = db
    .prepare("PRAGMA table_info(tickets)")
    .all()
    .map((c) => c.name);
  if (!cols.includes("contact")) db.exec("ALTER TABLE tickets ADD COLUMN contact TEXT");
  if (!cols.includes("subject")) db.exec("ALTER TABLE tickets ADD COLUMN subject TEXT");
  if (!cols.includes("description")) db.exec("ALTER TABLE tickets ADD COLUMN description TEXT");
  if (!cols.includes("resolution")) db.exec("ALTER TABLE tickets ADD COLUMN resolution TEXT");
  if (!cols.includes("custom_fields")) db.exec("ALTER TABLE tickets ADD COLUMN custom_fields TEXT");
  if (!cols.includes("sort_order")) db.exec("ALTER TABLE tickets ADD COLUMN sort_order REAL");
  if (!cols.includes("attachments")) db.exec("ALTER TABLE tickets ADD COLUMN attachments TEXT DEFAULT '[]'");
  if (!cols.includes("worked_hours")) db.exec("ALTER TABLE tickets ADD COLUMN worked_hours REAL");
  db.exec(
    "UPDATE tickets SET sort_order = strftime('%s', created_at) * -1 WHERE sort_order IS NULL"
  );
})();

// ── Sessions (in-memory, 24 h) ────────────────────────────────────────────────

const sessions = new Map();
const SESSION_MAX_AGE_MS = 24 * 60 * 60 * 1000;

const resetTokens = new Map(); // token -> { username, expiresAt }
const RESET_TOKEN_MAX_AGE_MS = 60 * 60 * 1000; // 1 hour

// ── Login rate limiting ───────────────────────────────────────────────────────
const loginAttempts = new Map();
const LOGIN_MAX = 10;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;

function getClientIp(req) {
  return (
    (req.headers["x-forwarded-for"] || "").split(",")[0].trim() ||
    req.socket.remoteAddress ||
    "unknown"
  );
}

function checkLoginRateLimit(ip) {
  const now = Date.now();
  let entry = loginAttempts.get(ip);
  if (!entry || now > entry.resetAt) entry = { count: 0, resetAt: now + LOGIN_WINDOW_MS };
  if (entry.count >= LOGIN_MAX) {
    loginAttempts.set(ip, entry);
    return false;
  }
  entry.count++;
  loginAttempts.set(ip, entry);
  return true;
}

function resetLoginRateLimit(ip) {
  loginAttempts.delete(ip);
}
const SESSION_COOKIE_MAX_AGE = 86400;

function hashPassword(password, salt) {
  return crypto
    .createHash("sha256")
    .update(salt + password)
    .digest("hex");
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
  if (Date.now() > session.expiresAt) {
    sessions.delete(token);
    return null;
  }
  return session;
}

function parseCookies(req) {
  const cookies = {};
  (req.headers.cookie || "").split(";").forEach((part) => {
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
  host: "",
  port: 993,
  secure: true,
  username: "",
  password: "",
  folder: "INBOX",
  pollIntervalMinutes: 5,
  connectedAt: null,
  ignoreSenders: "no-reply@accounts.google.com, noreply@google.com",
  defaultArea: "Correo",
  defaultUrgency: "media",
};

const DEFAULT_NOTIFICATIONS_CONFIG = {
  smtp: {
    enabled: false,
    host: "",
    port: 587,
    secure: false,
    user: "",
    pass: "",
    from: "NeuroDesk <no-reply@example.com>",
  },
  adminEmails: "",
  app_url: "",
  templates: {
    received: {
      subject: "Tu ticket #{{ticket_id}} fue recibido — NeuroDesk",
      body: 'Hola {{user_name}},\n\nHemos recibido tu ticket #{{ticket_id}}: "{{ticket_title}}".\n\nUn agente lo atenderá a la brevedad.\n\nPuedes hacer seguimiento desde:\n{{ticket_url}}\n\nGracias por comunicarte con nosotros.\n\nNeurofic · NeuroDesk',
    },
    status_changed: {
      subject: "Actualización del ticket #{{ticket_id}} — {{new_status}}",
      body: 'Hola {{user_name}},\n\nEl estado de tu ticket #{{ticket_id}} "{{ticket_title}}" ha cambiado:\n\nEstado anterior: {{old_status}}\nNuevo estado: {{new_status}}\n\nVer el ticket y su historial:\n{{ticket_url}}\n\nNeurofic · NeuroDesk',
    },
    resolved: {
      subject: "Tu ticket #{{ticket_id}} fue resuelto — NeuroDesk",
      body: 'Hola {{user_name}},\n\nNos complace informarte que tu ticket #{{ticket_id}} "{{ticket_title}}" ha sido resuelto.\n\nResumen de la atención:\n{{resolution_notes}}\n\n¿No estás de acuerdo con la solución? Simplemente responde este correo con tus comentarios y tu ticket será reabierto automáticamente para que un agente te vuelva a atender.\n\nGracias por tu confianza en Neurofic.\n\nNeurofic · NeuroDesk',
    },
  },
};

let notificationsConfig = JSON.parse(JSON.stringify(DEFAULT_NOTIFICATIONS_CONFIG));
let smtpTransporter = null;

let emailConfig = JSON.parse(JSON.stringify(DEFAULT_EMAIL_CONFIG));
const emailPollStatus = {
  lastPoll: null,
  lastError: null,
  ticketsCreated: 0,
  polling: false,
  lastMessagesChecked: 0,
  consecutiveErrors: 0,
};
let emailPollerTimer = null;
const eventClients = new Set();
const EMAIL_FALLBACK_LOOKBACK_MS = 24 * 60 * 60 * 1000;
const POLL_LOOKBACK_OVERLAP_MS = 2 * 60 * 60 * 1000; // ventana deslizante — 2h overlap
const IMAP_CONN_TIMEOUT_MS = 30 * 1000; // 30s para establecer conexión TCP/TLS
const IMAP_SOCKET_TIMEOUT_MS = 90 * 1000; // 90s sin actividad en socket
const POLL_ABSOLUTE_TIMEOUT_MS = 3 * 60 * 1000; // 2 min — mata el poll si se cuelga

const DEFAULT_CONFIG = {
  sla: { baja: 24, media: 8, alta: 4, critica: 1 },
  fields: {
    contact: { enabled: true, label: "Contacto" },
    area: { enabled: true, label: "Área" },
  },
  customFields: [],
  businessHours: {
    enabled: true,
    start: "07:00",
    end: "17:00",
    days: [1, 2, 3, 4, 5], // 0=Dom, 1=Lun, ..., 6=Sáb
  },
};

let appConfig = JSON.parse(JSON.stringify(DEFAULT_CONFIG));

const ticketStatuses = ["abierto", "en_proceso", "en_espera", "resuelto", "cerrado"];

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
};

// ── Prepared statements ───────────────────────────────────────────────────────

const countTicketsStmt = db.prepare("SELECT COUNT(*) AS total FROM tickets");
const listTicketsStmt = db.prepare(
  `SELECT id, name, contact, area, urgency, status, source, subject, description, resolution, custom_fields AS customFields, attachments, worked_hours AS workedHours, sort_order AS sortOrder, created_at AS createdAt FROM tickets ORDER BY sort_order ASC, created_at DESC`
);
const nextTicketNumberStmt = db.prepare(
  `SELECT COALESCE(MAX(CAST(SUBSTR(id, 4) AS INTEGER)), 1000) + 1 AS nextNumber FROM tickets WHERE id LIKE 'ND-%'`
);
const insertTicketStmt = db.prepare(
  `INSERT INTO tickets (id, name, contact, area, urgency, status, source, subject, description, html_body, assigned_to, resolution, custom_fields, attachments, worked_hours, sort_order, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
);
const updateTicketStatusStmt = db.prepare("UPDATE tickets SET status = ? WHERE id = ?");
const updateTicketFullStmt = db.prepare(
  `UPDATE tickets SET name = ?, contact = ?, area = ?, urgency = ?, status = ?, subject = ?, description = ?, resolution = ?, custom_fields = ?, worked_hours = ?, assigned_to = ? WHERE id = ?`
);
const updateTicketPositionStmt = db.prepare(
  "UPDATE tickets SET status = ?, sort_order = ? WHERE id = ?"
);
const deleteTicketStmt = db.prepare("DELETE FROM tickets WHERE id = ?");
const deleteTicketHistoryStmt = db.prepare("DELETE FROM ticket_history WHERE ticket_id = ?");
const insertTicketHistoryStmt = db.prepare(
  "INSERT INTO ticket_history (id, ticket_id, note, status, created_at) VALUES (?, ?, ?, ?, ?)"
);
const listTicketHistoryStmt = db.prepare(
  "SELECT id, note, status, created_at AS createdAt FROM ticket_history WHERE ticket_id = ? ORDER BY created_at DESC"
);
const upsertConfigStmt = db.prepare(
  `INSERT INTO config (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`
);
const getConfigStmt = db.prepare("SELECT value FROM config WHERE key = 'app_config'");
const countUsersStmt = db.prepare("SELECT COUNT(*) AS total FROM users");
const getUserStmt = db.prepare("SELECT * FROM users WHERE username = ?");
const insertUserStmt = db.prepare(
  "INSERT INTO users (username, password_hash, salt) VALUES (?, ?, ?)"
);
const updatePasswordStmt = db.prepare(
  "UPDATE users SET password_hash = ?, salt = ? WHERE username = ?"
);
const listUsersStmt = db.prepare("SELECT username FROM users");
const deleteUserStmt = db.prepare("DELETE FROM users WHERE username = ?");
const renameUserStmt = db.prepare("UPDATE users SET username = ? WHERE username = ?");
const getEmailConfigStmt = db.prepare("SELECT value FROM config WHERE key = 'email_config'");
const getNotificationsConfigStmt = db.prepare(
  "SELECT value FROM config WHERE key = 'notifications_config'"
);
const isEmailProcessedStmt = db.prepare("SELECT 1 FROM processed_emails WHERE message_id = ?");
const markEmailProcessedStmt = db.prepare(
  "INSERT OR IGNORE INTO processed_emails (message_id, processed_at) VALUES (?, ?)"
);
const cleanOldEmailsStmt = db.prepare("DELETE FROM processed_emails WHERE processed_at < ?");

// ── Init ──────────────────────────────────────────────────────────────────────

migrateDatabase();
loadConfig();
loadEmailConfig();
loadNotificationsConfig();
seedDemoTicket();
seedAdminUser();
if (!process.env.ND_TEST) startEmailPoller();
if (!process.env.ND_TEST) startAutoCloser();

// ── Helpers ───────────────────────────────────────────────────────────────────

function sendJson(res, status, data) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(data));
}

function sendEvent(res, event, data) {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

function notifyClients(event, data = {}) {
  for (const res of eventClients) {
    try {
      sendEvent(res, event, data);
    } catch (_) {
      eventClients.delete(res);
    }
  }
}

function handleEvents(req, res) {
  res.writeHead(200, {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
  });
  sendEvent(res, "connected", { ok: true });
  eventClients.add(res);
  req.on("close", () => eventClients.delete(res));
}

function sendStatic(req, res) {
  const requestedPath = req.url === "/" ? "/index.html" : req.url;
  const safePath = path.normalize(decodeURIComponent(requestedPath)).replace(/^(\.\.[/\\])+/, "");
  const filePath = path.join(PUBLIC_DIR, safePath);

  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  fs.readFile(filePath, (error, data) => {
    if (error) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }
    const ext = path.extname(filePath);
    const isHtml = ext === ".html";
    const cacheHeader = isHtml
      ? "no-cache, no-store, must-revalidate"
      : "public, max-age=31536000, immutable";
    res.writeHead(200, {
      "Content-Type": contentTypes[ext] || "application/octet-stream",
      "Cache-Control": cacheHeader,
    });
    res.end(data);
  });
}

function serveFile(res, filename) {
  fs.readFile(path.join(PUBLIC_DIR, filename), (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(data);
  });
}

function readBody(req, maxBytes = 1_000_000) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > maxBytes) {
        req.destroy();
        reject(new Error("Payload too large"));
      }
    });
    req.on("end", () => {
      if (!body) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(body));
      } catch (e) {
        reject(e);
      }
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
  try {
    appConfig = deepMerge(DEFAULT_CONFIG, JSON.parse(row.value));
  } catch (_) {}
}

function saveConfig(incoming) {
  const sla = incoming.sla || {};
  const fields = incoming.fields || {};
  const customFields = Array.isArray(incoming.customFields) ? incoming.customFields : [];

  const validatedSla = Object.keys(DEFAULT_CONFIG.sla).reduce((acc, key) => {
    const val = Number(sla[key]);
    acc[key] = isFinite(val) && val > 0 ? val : DEFAULT_CONFIG.sla[key];
    return acc;
  }, {});

  const validatedFields = Object.keys(DEFAULT_CONFIG.fields).reduce((acc, key) => {
    const src = fields[key] || {};
    acc[key] = {
      enabled: typeof src.enabled === "boolean" ? src.enabled : DEFAULT_CONFIG.fields[key].enabled,
      label:
        String(src.label || DEFAULT_CONFIG.fields[key].label)
          .trim()
          .slice(0, 40) || DEFAULT_CONFIG.fields[key].label,
    };
    return acc;
  }, {});

  const validatedCustomFields = customFields.slice(0, 12).map((field, index) => {
    const key =
      String(field.key || field.label || `campo_${index + 1}`)
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9_]+/g, "_")
        .replace(/^_+|_+$/g, "")
        .slice(0, 40) || `campo_${index + 1}`;
    const type = field.type === "select" ? "select" : "text";
    const options =
      type === "select"
        ? String(field.options || "")
            .split(",")
            .map((opt) => opt.trim())
            .filter(Boolean)
            .slice(0, 20)
            .join(", ")
        : "";
    return {
      key,
      label:
        String(field.label || key)
          .trim()
          .slice(0, 60) || key,
      type,
      options,
      enabled: field.enabled !== false,
    };
  });

  const bh = incoming.businessHours || {};
  const validatedBh = {
    enabled: bh.enabled === true || bh.enabled === "true",
    start: /^\d{2}:\d{2}$/.test(bh.start) ? bh.start : "07:00",
    end: /^\d{2}:\d{2}$/.test(bh.end) ? bh.end : "17:00",
    days: Array.isArray(bh.days)
      ? bh.days.map(Number).filter((d) => Number.isInteger(d) && d >= 0 && d <= 6)
      : [1, 2, 3, 4, 5],
  };

  appConfig = { sla: validatedSla, fields: validatedFields, customFields: validatedCustomFields, businessHours: validatedBh };
  upsertConfigStmt.run("app_config", JSON.stringify(appConfig));
  return appConfig;
}

// ── Tickets ───────────────────────────────────────────────────────────────────

function normalizeTicket(input, source = "web") {
  const name = String(input.name || "").trim();
  const contact = String(input.contact || "").trim();
  const area = String(input.area || "").trim() || "General";
  const urgency = String(input.urgency || "")
    .trim()
    .toLowerCase();
  const subject = String(input.subject || "")
    .trim()
    .slice(0, 200);
  const description = String(input.description || "")
    .trim()
    .slice(0, 4000);
  const htmlBody = String(input.htmlBody || "").slice(0, 200000);
  const assignedTo = String(input.assignedTo || "").trim().slice(0, 100);
  const customFields = normalizeCustomFields(input.customFields || input.custom_fields || {});

  if (!name || !appConfig.sla[urgency]) return null;

  return {
    id: getNextTicketId(),
    name,
    contact,
    area,
    urgency,
    status: "abierto",
    source,
    subject,
    description,
    htmlBody,
    assignedTo,
    resolution: "",
    customFields,
    createdAt: new Date().toISOString(),
  };
}

function normalizeCustomFields(values) {
  const allowed = appConfig.customFields || [];
  const src = values && typeof values === "object" ? values : {};
  return allowed.reduce((acc, field) => {
    if (!field.enabled) return acc;
    acc[field.key] = String(src[field.key] || "")
      .trim()
      .slice(0, 500);
    return acc;
  }, {});
}

function migrateDatabase() {
  // Column migrations are handled at startup before prepared statements — nothing to do here.
}

function seedDemoTicket() {
  const { total } = countTicketsStmt.get();
  if (total > 0) return;
  insertTicket({
    id: "ND-1001",
    name: "Paciente demo",
    contact: "demo@neurofic.com",
    area: "Agenda",
    urgency: "media",
    status: "abierto",
    source: "web",
    createdAt: new Date(Date.now() - 42 * 60 * 1000).toISOString(),
  });
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
  insertTicketStmt.run(
    ticket.id,
    ticket.name,
    ticket.contact,
    ticket.area,
    ticket.urgency,
    ticket.status,
    ticket.source,
    ticket.subject || "",
    ticket.description || "",
    ticket.htmlBody || "",
    ticket.assignedTo || "",
    ticket.resolution || "",
    JSON.stringify(ticket.customFields || {}),
    JSON.stringify(ticket.attachments || []),
    ticket.workedHours ?? null,
    Date.now() * -1,
    ticket.createdAt
  );
  notifyClients("ticketsChanged", { action: "created", id: ticket.id, source: ticket.source });
  sendTicketNotification("received", ticket).catch((err) =>
    console.error("[NeuroDesk] Notification error (received):", err.message)
  );
  return ticket;
}

function getTicketHistory(ticketId) {
  return listTicketHistoryStmt.all(ticketId);
}

function getTickets() {
  return listTicketsStmt.all().map((ticket) => {
    let customFields = {};
    try { customFields = ticket.customFields ? JSON.parse(ticket.customFields) : {}; } catch (_) {}
    let attachments = [];
    try { attachments = ticket.attachments ? JSON.parse(ticket.attachments) : []; } catch (_) {}
    return { ...ticket, customFields, attachments, history: getTicketHistory(ticket.id) };
  });
}

function addTicketHistory(ticketId, note, status) {
  const text = String(note || "")
    .trim()
    .slice(0, 4000);
  if (!text) return;
  insertTicketHistoryStmt.run(
    crypto.randomUUID(),
    ticketId,
    text,
    status,
    new Date().toISOString()
  );
}

function updateTicketStatus(id, status) {
  if (!ticketStatuses.includes(status)) return null;
  const rawTicket = store.tickets.find((t) => t.id === id);
  const oldStatus = rawTicket?.status;
  const result = updateTicketStatusStmt.run(status, id);
  if (result.changes === 0) return null;
  const updated = store.tickets.find((t) => t.id === id);
  if (updated) {
    applySlaTransition(updated, oldStatus, status);
    if ((status === "resuelto" || status === "cerrado") && !updated.resolvedAt) {
      updated.resolvedAt = new Date().toISOString();
      saveStore();
    } else if (status !== "resuelto" && status !== "cerrado" && updated.resolvedAt) {
      updated.resolvedAt = null;
      saveStore();
    }
  }
  notifyClients("ticketsChanged", { action: "status", id });
  const ticket = getTickets().find((t) => t.id === id);
  if (ticket && oldStatus !== status) {
    const notifType = status === "resuelto" ? "resolved" : "status_changed";
    sendTicketNotification(notifType, ticket, { oldStatus }).catch((err) =>
      console.error("[NeuroDesk] Notification error (status):", err.message)
    );
  }
  return ticket;
}

function updateTicketFull(id, data) {
  const name = String(data.name || "").trim();
  const contact = String(data.contact || "").trim();
  const area = String(data.area || "").trim() || "General";
  const urgency = String(data.urgency || "")
    .trim()
    .toLowerCase();
  const status = String(data.status || "").trim();
  const subject = String(data.subject || "")
    .trim()
    .slice(0, 200);
  const description = String(data.description || "")
    .trim()
    .slice(0, 4000);
  const resolution = String(data.resolution || "")
    .trim()
    .slice(0, 4000);
  const resolutionNote = String(data.resolutionNote || "")
    .trim()
    .slice(0, 4000);
  const assignedTo = String(data.assignedTo || "").trim().slice(0, 100);
  const workedHours =
    data.workedHours !== undefined && data.workedHours !== "" && data.workedHours !== null
      ? Math.max(0, parseFloat(data.workedHours) || 0) || null
      : null;
  const customFields = normalizeCustomFields(data.customFields || data.custom_fields || {});

  if (!name || !appConfig.sla[urgency] || !ticketStatuses.includes(status)) return null;
  if ((status === "resuelto" || status === "cerrado") && !resolution && !resolutionNote)
    return null;
  const rawTicket = store.tickets.find((t) => t.id === id);
  const oldStatus = rawTicket?.status;
  const result = updateTicketFullStmt.run(
    name,
    contact,
    area,
    urgency,
    status,
    subject,
    description,
    resolution,
    JSON.stringify(customFields),
    workedHours,
    assignedTo,
    id
  );
  if (result.changes === 0) return null;
  const updatedRaw = store.tickets.find((t) => t.id === id);
  if (updatedRaw) {
    applySlaTransition(updatedRaw, oldStatus, status);
    if ((status === "resuelto" || status === "cerrado") && !updatedRaw.resolvedAt) {
      updatedRaw.resolvedAt = new Date().toISOString();
      saveStore();
    } else if (status !== "resuelto" && status !== "cerrado" && updatedRaw.resolvedAt) {
      updatedRaw.resolvedAt = null;
      saveStore();
    }
  }
  if (resolutionNote) addTicketHistory(id, resolutionNote, status);
  notifyClients("ticketsChanged", { action: "updated", id });
  const ticket = getTickets().find((t) => t.id === id);
  const silent = data.silent === true || data.silent === "true";
  if (ticket && oldStatus !== status && !silent) {
    const notifType = status === "resuelto" ? "resolved" : "status_changed";
    sendTicketNotification(notifType, ticket, { oldStatus, resolutionNote }).catch((err) =>
      console.error("[NeuroDesk] Notification error (full update):", err.message)
    );
  }
  return ticket;
}

function updateTicketPosition(id, status, orderedIds) {
  if (!ticketStatuses.includes(status) || !Array.isArray(orderedIds) || !orderedIds.includes(id))
    return null;
  const rawTicket = store.tickets.find((t) => t.id === id);
  const oldStatus = rawTicket?.status;
  orderedIds
    .filter((ticketId) => typeof ticketId === "string")
    .slice(0, 500)
    .forEach((ticketId, index) => {
      updateTicketPositionStmt.run(status, index + 1, String(ticketId));
    });
  if (rawTicket) {
    applySlaTransition(rawTicket, oldStatus, status);
    if ((status === "resuelto" || status === "cerrado") && !rawTicket.resolvedAt) {
      rawTicket.resolvedAt = new Date().toISOString();
      saveStore();
    } else if (status !== "resuelto" && status !== "cerrado" && rawTicket.resolvedAt) {
      rawTicket.resolvedAt = null;
      saveStore();
    }
  }
  notifyClients("ticketsChanged", { action: "position", id });
  const ticket = getTickets().find((t) => t.id === id);
  if (ticket && oldStatus !== status) {
    const notifType = status === "resuelto" ? "resolved" : "status_changed";
    sendTicketNotification(notifType, ticket, { oldStatus }).catch((err) =>
      console.error("[NeuroDesk] Notification error (position):", err.message)
    );
  }
  return ticket;
}

function applySlaTransition(rawTicket, oldStatus, newStatus) {
  if (!rawTicket || oldStatus === newStatus) return;
  if (newStatus === "en_espera" && oldStatus !== "en_espera") {
    rawTicket.slaFrozenAt = new Date().toISOString();
    saveStore();
  } else if (oldStatus === "en_espera" && newStatus !== "en_espera") {
    if (rawTicket.slaFrozenAt) {
      const frozenMs = new Date(rawTicket.slaFrozenAt).getTime();
      const nowMs = Date.now();
      const bh = appConfig.businessHours;
      if (bh && bh.enabled) {
        rawTicket.slaBusinessPausedMs = (rawTicket.slaBusinessPausedMs || 0) + calcBusinessMs(frozenMs, nowMs, bh);
      } else {
        rawTicket.slaPausedMs = (rawTicket.slaPausedMs || 0) + (nowMs - frozenMs);
      }
      rawTicket.slaFrozenAt = null;
      saveStore();
    }
  }
}

// Returns how many milliseconds of "business time" elapsed between fromMs and toMs.
// Non-business hours and non-working days are excluded from the count.
function calcBusinessMs(fromMs, toMs, bh) {
  if (!bh || !bh.enabled || fromMs >= toMs) return Math.max(toMs - fromMs, 0);
  const days = new Set(Array.isArray(bh.days) ? bh.days : [1, 2, 3, 4, 5]);
  const parseTime = (t) => {
    const [h, m] = String(t || "00:00").split(":").map(Number);
    return ((h || 0) * 60 + (m || 0)) * 60000;
  };
  const dayStartMs = parseTime(bh.start);
  const dayEndMs = parseTime(bh.end);
  if (dayEndMs <= dayStartMs) return Math.max(toMs - fromMs, 0);

  let total = 0;
  // Start at midnight of the day containing fromMs
  const anchor = new Date(fromMs);
  anchor.setHours(0, 0, 0, 0);
  let cursor = anchor.getTime();

  while (cursor < toMs) {
    const dow = new Date(cursor).getDay();
    if (days.has(dow)) {
      const segStart = cursor + dayStartMs;
      const segEnd = cursor + dayEndMs;
      const overlapStart = Math.max(segStart, fromMs);
      const overlapEnd = Math.min(segEnd, toMs);
      if (overlapEnd > overlapStart) total += overlapEnd - overlapStart;
    }
    cursor += 86400000; // advance one day
  }
  return total;
}

function getSlaState(ticket) {
  const status = ticket.status;
  const isFinished = status === "resuelto" || status === "cerrado";
  const isPaused = status === "en_espera";
  const createdMs = new Date(ticket.createdAt).getTime();
  const bh = appConfig.businessHours;

  let endMs;
  if (isFinished) {
    let closedTs = ticket.resolvedAt;
    if (!closedTs && Array.isArray(ticket.history)) {
      const entry = ticket.history.find(
        (h) => h.status === "resuelto" || h.status === "cerrado"
      );
      if (entry) closedTs = entry.createdAt;
    }
    endMs = closedTs ? new Date(closedTs).getTime() : Date.now();
  } else if (isPaused && ticket.slaFrozenAt) {
    endMs = new Date(ticket.slaFrozenAt).getTime();
  } else {
    endMs = Date.now();
  }

  let elapsedHours;
  if (bh && bh.enabled) {
    // Business-hours mode: only count time within working hours/days
    const businessPausedMs = ticket.slaBusinessPausedMs || 0;
    const businessElapsed = Math.max(calcBusinessMs(createdMs, endMs, bh) - businessPausedMs, 0);
    elapsedHours = businessElapsed / 3.6e6;
  } else {
    const pausedMs = ticket.slaPausedMs || 0;
    elapsedHours = Math.max((endMs - createdMs - pausedMs) / 3.6e6, 0);
  }

  const limitHours = appConfig.sla[ticket.urgency] || 8;
  return {
    limitHours,
    remainingHours: Number(Math.max(limitHours - elapsedHours, 0).toFixed(1)),
    elapsedHours: Number(elapsedHours.toFixed(1)),
    breached: elapsedHours > limitHours,
    paused: isPaused,
    finished: isFinished,
    businessHours: !!(bh && bh.enabled),
  };
}

function getStats() {
  const tickets = getTickets();
  const active = tickets.filter((t) => t.status !== "resuelto" && t.status !== "cerrado");
  const breached = active.filter((t) => getSlaState(t).breached);
  const byStatus = ticketStatuses.reduce((s, st) => {
    s[st] = tickets.filter((t) => t.status === st).length;
    return s;
  }, {});
  const byUrgency = Object.keys(appConfig.sla).reduce((s, u) => {
    s[u] = tickets.filter((t) => t.urgency === u).length;
    return s;
  }, {});
  const avgRemainingHours =
    active.length === 0
      ? 0
      : Number(
          (
            active.reduce((sum, t) => sum + getSlaState(t).remainingHours, 0) / active.length
          ).toFixed(1)
        );
  return {
    total: tickets.length,
    open: active.length,
    breached: breached.length,
    byStatus,
    byUrgency,
    avgRemainingHours,
    slaCompliance:
      active.length === 0
        ? 100
        : Math.round(((active.length - breached.length) / active.length) * 100),
  };
}

// ── AI (Anthropic Claude Haiku) ───────────────────────────────────────────────

function anthropicRequest(messages, systemPrompt, maxTokens = 512) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return Promise.resolve(null);
  const body = JSON.stringify({
    model: "claude-haiku-4-5-20251001",
    max_tokens: maxTokens,
    system: systemPrompt,
    messages,
  });
  return new Promise((resolve) => {
    const req = https.request(
      {
        hostname: "api.anthropic.com",
        path: "/v1/messages",
        method: "POST",
        headers: {
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
          "content-length": Buffer.byteLength(body),
        },
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          try {
            const parsed = JSON.parse(data);
            resolve(parsed.content?.[0]?.text || null);
          } catch { resolve(null); }
        });
      }
    );
    req.on("error", () => resolve(null));
    req.setTimeout(15000, () => { req.destroy(); resolve(null); });
    req.write(body);
    req.end();
  });
}

async function aiTriageTicket(subject, body) {
  const system = `Eres un clasificador de tickets de soporte técnico para Neurofic. Analiza el asunto y cuerpo y responde SOLO con JSON válido sin markdown.
Formato: {"urgency":"media","category":"Error técnico","sentiment":"neutro","sentimentScore":40}
urgency: "baja"|"media"|"alta"|"critica"
category: categoría corta en español (máx 25 chars). Ejemplos: "Facturación","Acceso","Error técnico","Consulta","Instalación","Rendimiento"
sentiment: "positivo"|"neutro"|"negativo"|"muy_negativo"
sentimentScore: 0-100 (0=muy satisfecho, 100=muy frustrado)`;
  const text = await anthropicRequest(
    [{ role: "user", content: `Asunto: ${subject}\n\nCuerpo: ${String(body || "").slice(0, 1500)}` }],
    system
  );
  if (!text) return null;
  try {
    return JSON.parse(text.replace(/```json\n?|\n?```/g, "").trim());
  } catch { return null; }
}

async function aiSuggestReply(ticket) {
  const history = (ticket.history || [])
    .slice(-5)
    .map((h) => h.note)
    .join("\n---\n");
  const system = `Eres un agente de soporte de Neurofic. Redacta una respuesta profesional, empática y concisa en español para el siguiente ticket de soporte.
- Máximo 3 párrafos
- Tono profesional pero humano, sin frases genéricas vacías
- No uses placeholders como [NOMBRE]
- Firma como: "El equipo de soporte · Neurofic"
- Solo texto plano, sin markdown`;
  const content = `Ticket: ${ticket.id}
Asunto: ${ticket.subject || "(sin asunto)"}
Descripción: ${String(ticket.description || "").slice(0, 1500)}${history ? `\n\nHistorial reciente:\n${history.slice(0, 800)}` : ""}`;
  return await anthropicRequest([{ role: "user", content }], system, 600);
}

// ── Email config & poller ─────────────────────────────────────────────────────

function loadEmailConfig() {
  const row = getEmailConfigStmt.get();
  if (!row) return;
  try {
    emailConfig = Object.assign(
      JSON.parse(JSON.stringify(DEFAULT_EMAIL_CONFIG)),
      JSON.parse(row.value)
    );
  } catch (_) {}
}

function saveEmailConfig(incoming) {
  const host = String(incoming.host || "").trim();
  const port = parseInt(incoming.port) || 993;
  const secure = incoming.secure !== false;
  const username = String(incoming.username || "").trim();
  const password = String(incoming.password || "").trim();
  const folder = String(incoming.folder || "INBOX").trim() || "INBOX";
  const pollIntervalMinutes = Math.max(1, parseInt(incoming.pollIntervalMinutes) || 5);
  const ignoreSenders = String(incoming.ignoreSenders || DEFAULT_EMAIL_CONFIG.ignoreSenders).trim();
  const defaultArea = String(incoming.defaultArea || "Correo").trim() || "Correo";
  const rawUrgency = String(incoming.defaultUrgency || "media").trim();
  const defaultUrgency = appConfig.sla[rawUrgency] ? rawUrgency : "media";
  const enabled = incoming.enabled === true || incoming.enabled === "true";
  const accountChanged =
    host !== emailConfig.host ||
    port !== emailConfig.port ||
    secure !== emailConfig.secure ||
    username !== emailConfig.username ||
    folder !== emailConfig.folder;
  const connectedAt =
    enabled && (!emailConfig.enabled || accountChanged || !emailConfig.connectedAt)
      ? new Date(Date.now() - EMAIL_FALLBACK_LOOKBACK_MS).toISOString()
      : emailConfig.connectedAt;

  emailConfig = {
    enabled,
    host,
    port,
    secure,
    username,
    password,
    folder,
    pollIntervalMinutes,
    connectedAt,
    ignoreSenders,
    defaultArea,
    defaultUrgency,
  };
  upsertConfigStmt.run("email_config", JSON.stringify(emailConfig));
  startEmailPoller();
  return emailConfig;
}

// ── Notifications config ──────────────────────────────────────────────────────

function loadNotificationsConfig() {
  const row = getNotificationsConfigStmt.get();
  if (!row) return;
  try {
    const saved = JSON.parse(row.value);
    notificationsConfig = {
      smtp: Object.assign(
        JSON.parse(JSON.stringify(DEFAULT_NOTIFICATIONS_CONFIG.smtp)),
        saved.smtp || {}
      ),
      adminEmails: typeof saved.adminEmails === "string" ? saved.adminEmails : "",
      app_url: typeof saved.app_url === "string" ? saved.app_url : "",
      templates: {
        received: migrateTemplate(
          Object.assign({}, DEFAULT_NOTIFICATIONS_CONFIG.templates.received, (saved.templates || {}).received || {})
        ),
        status_changed: migrateTemplate(
          Object.assign({}, DEFAULT_NOTIFICATIONS_CONFIG.templates.status_changed, (saved.templates || {}).status_changed || {})
        ),
        resolved: migrateTemplate(
          Object.assign({}, DEFAULT_NOTIFICATIONS_CONFIG.templates.resolved, (saved.templates || {}).resolved || {})
        ),
      },
    };
    smtpTransporter = null;
  } catch (_) {}
}

// Appends {{ticket_url}} to any saved template body that is missing it;
// also adds the reopen-on-reply notice to resolved templates if missing.
function migrateTemplate(tpl) {
  if (!tpl.body.includes("{{ticket_url}}")) {
    tpl.body = tpl.body.trimEnd() + "\n\n{{ticket_url}}";
  }
  // Add reopen-on-reply notice to resolved template if not present
  const REOPEN_NOTICE = "¿No estás de acuerdo con la solución? Simplemente responde este correo";
  if (
    tpl.subject &&
    tpl.subject.includes("resuelto") &&
    !tpl.body.includes(REOPEN_NOTICE)
  ) {
    tpl.body = tpl.body.replace(
      /\n*Gracias por tu confianza/,
      "\n\n¿No estás de acuerdo con la solución? Simplemente responde este correo con tus comentarios y tu ticket será reabierto automáticamente para que un agente te vuelva a atender.\n\nGracias por tu confianza"
    );
    // fallback: append at end if pattern not found
    if (!tpl.body.includes(REOPEN_NOTICE)) {
      tpl.body = tpl.body.trimEnd() + "\n\n" + REOPEN_NOTICE + " con tus comentarios y tu ticket será reabierto automáticamente para que un agente te vuelva a atender.";
    }
  }
  return tpl;
}

function saveNotificationsConfig(incoming) {
  const smtp = incoming.smtp || {};
  const pass =
    smtp.pass === "••••••••" ? notificationsConfig.smtp.pass : String(smtp.pass || "").trim();
  notificationsConfig = {
    smtp: {
      enabled: smtp.enabled === true || smtp.enabled === "true",
      host: String(smtp.host || "").trim(),
      port: parseInt(smtp.port) || 587,
      secure: smtp.secure === true || smtp.secure === "true",
      user: String(smtp.user || "").trim(),
      pass,
      from: String(smtp.from || "").trim(),
    },
    adminEmails: String(incoming.adminEmails || "").trim(),
    app_url: String(incoming.app_url || "").trim().replace(/\/$/, ""),
    templates: {
      received: sanitizeTemplate(
        incoming.templates?.received,
        DEFAULT_NOTIFICATIONS_CONFIG.templates.received
      ),
      status_changed: sanitizeTemplate(
        incoming.templates?.status_changed,
        DEFAULT_NOTIFICATIONS_CONFIG.templates.status_changed
      ),
      resolved: sanitizeTemplate(
        incoming.templates?.resolved,
        DEFAULT_NOTIFICATIONS_CONFIG.templates.resolved
      ),
    },
  };
  smtpTransporter = null;
  upsertConfigStmt.run("notifications_config", JSON.stringify(notificationsConfig));
  return notificationsConfig;
}

function sanitizeTemplate(tpl, defaults) {
  if (!tpl || typeof tpl !== "object") return { ...defaults };
  return {
    subject:
      String(tpl.subject || defaults.subject)
        .trim()
        .slice(0, 500) || defaults.subject,
    body:
      String(tpl.body || defaults.body)
        .trim()
        .slice(0, 10000) || defaults.body,
  };
}

// ── Email sending (outbound SMTP) ─────────────────────────────────────────────

function escapeHtmlServer(str) {
  return String(str || "").replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[c]
  );
}

function textToHtml(text) {
  const escaped = escapeHtmlServer(text).replace(/\n/g, "<br>");
  // Convert bare URLs into a styled button
  const withLinks = escaped.replace(
    /(https?:\/\/[^\s<"]+)/g,
    '<a href="$1" style="display:inline-block;margin:12px 0 4px;padding:10px 20px;background:#0A6BFF;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;font-size:14px">Ver ticket →</a>'
  );
  return `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#1e293b;line-height:1.6">
${withLinks}
<hr style="margin-top:28px;border:0;border-top:1px solid #e2e8f0">
<p style="color:#94a3b8;font-size:12px;margin-top:10px">NeuroDesk · Neurofic</p>
</div>`;
}

function renderTemplate(template, vars) {
  return String(template || "").replace(/\{\{(\w+)\}\}/g, (match, key) =>
    vars[key] !== undefined ? String(vars[key]) : match
  );
}

function getSmtpTransporter() {
  if (smtpTransporter) return smtpTransporter;
  const cfg = notificationsConfig.smtp;
  if (!cfg || !cfg.enabled || !cfg.host || !cfg.user || !cfg.pass) return null;
  const port = cfg.port || 587;
  // port 465 → SSL nativo (secure: true); port 587/25 → STARTTLS (secure: false)
  const secure = port === 465 ? true : false;
  const transportOpts = {
    host: cfg.host,
    port,
    secure,
    auth: { user: cfg.user, pass: cfg.pass },
    tls: { rejectUnauthorized: false },
  };
  if (!secure) transportOpts.requireTLS = true;
  smtpTransporter = nodemailer.createTransport(transportOpts);
  return smtpTransporter;
}

async function sendEmail(to, subject, text, attachments = []) {
  const transporter = getSmtpTransporter();
  if (!transporter) return null;
  const cfg = notificationsConfig.smtp;
  // el remitente debe coincidir con la cuenta autenticada en Gmail
  const fromDefault = `NeuroDesk <${cfg.user}>`;
  const from = cfg.from && !cfg.from.includes("example.com") ? cfg.from : fromDefault;
  try {
    const info = await transporter.sendMail({ from, to, subject, text, html: textToHtml(text), attachments });
    return info?.messageId || null;
  } catch (err) {
    console.error("[NeuroDesk] SMTP error:", err.message);
    smtpTransporter = null;
    return null;
  }
}

const STATUS_LABELS = {
  abierto: "Abierto",
  en_proceso: "En proceso",
  en_espera: "En espera",
  resuelto: "Resuelto",
  cerrado: "Cerrado",
};

async function sendTicketNotification(type, ticket, opts = {}) {
  if (!notificationsConfig.smtp?.enabled) {
    console.log(`[NeuroDesk] Notificación "${type}" omitida — SMTP desactivado. Actívalo en Configuración > Notificaciones.`);
    return;
  }
  const tpl = notificationsConfig.templates?.[type] || DEFAULT_NOTIFICATIONS_CONFIG.templates[type];
  if (!tpl) return;

  const baseUrl = (notificationsConfig.app_url || "").replace(/\/$/, "");
  const vars = {
    ticket_id: ticket.id,
    ticket_title: ticket.subject || ticket.description || "(sin asunto)",
    user_name: ticket.name,
    user_email: ticket.contact || "",
    old_status: STATUS_LABELS[opts.oldStatus] || opts.oldStatus || "",
    new_status: STATUS_LABELS[ticket.status] || ticket.status,
    agent_name: opts.agentName || "Un agente",
    resolution_notes: ticket.resolution || opts.resolutionNote || "(sin resumen)",
    ticket_url: baseUrl ? `${baseUrl}/?ticket=${encodeURIComponent(ticket.id)}` : "",
    portal_url: baseUrl && ticket.contact ? `${baseUrl}/portal?email=${encodeURIComponent(ticket.contact)}` : (baseUrl ? `${baseUrl}/portal` : ""),
  };

  const subject = renderTemplate(tpl.subject, vars);
  // Collapse 3+ consecutive newlines to 2 — cleans empty lines from missing vars like ticket_url
  const bodyText = renderTemplate(tpl.body, vars).replace(/\n{3,}/g, "\n\n").trim();

  const adminEmails = String(notificationsConfig.adminEmails || "")
    .split(",")
    .map((e) => e.trim())
    .filter(Boolean);

  const adminEmailSet = new Set(adminEmails.map((e) => e.toLowerCase()));
  const promises = [];

  // Only send client email if the contact is NOT already in the admin list (avoids duplicates)
  if (ticket.contact && ticket.contact.includes("@") && !adminEmailSet.has(ticket.contact.toLowerCase())) {
    const clientEmailPromise = sendEmail(ticket.contact, subject, bodyText).then((msgId) => {
      // Store message ID on the ticket so we can match future replies via In-Reply-To header
      if (msgId && type === "resolved") {
        const raw = store.tickets.find((t) => t.id === ticket.id);
        if (raw) { raw.emailThreadId = msgId; saveStore(); }
      }
    });
    promises.push(clientEmailPromise);
  }

  if (adminEmails.length > 0) {
    const adminBody = `${bodyText}\n\n---\nSolicitante: ${ticket.name}\nContacto: ${ticket.contact || "—"}`;
    promises.push(sendEmail(adminEmails.join(", "), `[Admin] ${subject}`, adminBody));
  } else {
    console.log(`[NeuroDesk] Notificación "${type}" — no hay correos de administradores configurados. Agrégalos en Configuración > Notificaciones > Correos de administradores.`);
  }

  await Promise.allSettled(promises);
}

function stripEmailSignature(text) {
  return text
    .replace(/\n[-_*]{2,}\s*\n[\s\S]*/g, "")
    .replace(/\n\s*(Atentamente|Saludos|Cordialmente|Con respecto|Best regards?|Regards?|Thanks?,?|Sincerely)[,:\s][\s\S]*/gi, "")
    .replace(/\*[A-ZÁ-Ú][a-záéíóúñ]+ [A-ZÁ-Ú][a-záéíóúñ]+\*/g, "")
    .replace(/\n\s*[-\w.]+@[-\w.]+\s*\n[\s\S]{0,200}$/g, "")
    .trim();
}

function detectUrgency(subject, body) {
  const text = `${subject} ${body}`.toLowerCase();
  if (/urgent|critico|critica|emergencia|critical|urgente/.test(text)) return "critica";
  if (/alto|alta|importante|important|high/.test(text)) return "alta";
  if (/bajo|baja|cuando puedas|low|no urgente/.test(text)) return "baja";
  return "media";
}

function shouldIgnoreEmail(fromEmail) {
  const ignored = String(emailConfig.ignoreSenders || "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
  const from = String(fromEmail || "").toLowerCase();
  if (ignored.includes(from)) return true;
  // Always ignore emails sent FROM the outgoing SMTP account (our own notifications)
  const smtpUser = (notificationsConfig?.smtp?.user || "").toLowerCase();
  if (smtpUser && from === smtpUser) return true;
  return false;
}

function getEmailPollBlocker(config, force = false) {
  if (!force && !config.enabled)
    return "El sondeo de correo esta desactivado. Activalo o usa Sondear ahora.";
  if (!config.host) return "Falta el servidor IMAP.";
  if (!config.username) return "Falta el usuario/correo IMAP.";
  if (!config.password) return "Falta la contrasena o App Password.";
  return "";
}

async function pollEmails(options = {}) {
  const blocker = getEmailPollBlocker(emailConfig, options.force === true);
  if (blocker) {
    emailPollStatus.lastPoll = new Date().toISOString();
    emailPollStatus.lastError = blocker;
    emailPollStatus.lastMessagesChecked = 0;
    return { created: 0, checked: 0, skipped: true, error: blocker };
  }
  if (emailPollStatus.polling)
    return { created: 0, checked: 0, skipped: true, error: "Ya hay un sondeo en curso." };

  emailPollStatus.polling = true;
  let created = 0;
  emailPollStatus.lastMessagesChecked = 0;

  // Timeout absoluto: si el poll se cuelga, libera el flag después de 3 min
  let absoluteTimeoutHandle = null;
  const absoluteTimeoutPromise = new Promise((_, reject) => {
    absoluteTimeoutHandle = setTimeout(() => {
      reject(new Error(`Sondeo IMAP superó el tiempo límite de ${POLL_ABSOLUTE_TIMEOUT_MS / 1000}s`));
    }, POLL_ABSOLUTE_TIMEOUT_MS);
  });

  const client = new ImapFlow({
    host: emailConfig.host,
    port: emailConfig.port,
    secure: emailConfig.secure,
    auth: { user: emailConfig.username, pass: (emailConfig.password || "").replace(/\s/g, "") },
    logger: false,
    connectionTimeout: IMAP_CONN_TIMEOUT_MS,
    greetingTimeout: IMAP_CONN_TIMEOUT_MS,
    socketTimeout: IMAP_SOCKET_TIMEOUT_MS,
  });

  async function doPoll() {
    try {
      await client.connect();
      const lock = await client.getMailboxLock(emailConfig.folder);
      try {
        // Ventana deslizante: connectedAt se actualiza tras cada poll exitoso.
        // Si el servidor estuvo caído, connectedAt cubre el gap (last_poll - 2h).
        const connectedAt = emailConfig.connectedAt ? new Date(emailConfig.connectedAt) : null;
        const recentSince =
          connectedAt && !Number.isNaN(connectedAt.getTime())
            ? connectedAt
            : new Date(Date.now() - EMAIL_FALLBACK_LOOKBACK_MS);
        const unreadUids = await client.search({ seen: false });
        const recentUids = await client.search({ since: recentSince });
        const uids = [...new Set([...unreadUids, ...recentUids])];
        emailPollStatus.lastMessagesChecked = uids.length;
        for (const uid of uids) {
          const message = await client.fetchOne(uid, { source: true, uid: true });
          if (!message) continue;
          const parsed = await simpleParser(message.source);
          if (parsed.date && parsed.date < recentSince && !unreadUids.includes(uid)) continue;
          const messageId = parsed.messageId || `uid-${uid}-${Date.now()}`;
          if (isEmailProcessedStmt.get(messageId)) continue;
          const fromAddress = parsed.from?.value?.[0];
          const fromEmail = fromAddress?.address || "";
          const fromName = fromAddress?.name || fromEmail;
          if (shouldIgnoreEmail(fromEmail)) {
            markEmailProcessedStmt.run(messageId, new Date().toISOString());
            try {
              await client.messageFlagsAdd(uid, ["\\Seen"]);
            } catch (_) {}
            continue;
          }
          const subject = (parsed.subject || "(sin asunto)").slice(0, 200);
          const rawText = (parsed.text || (parsed.html || "").replace(/<[^>]+>/g, "")).trim();
          const bodyText = stripEmailSignature(rawText).slice(0, 4000);

          // ── Detect reply to existing ticket ────────────────────────────────
          // 1. Try to extract ticket ID from subject: "Re: ... #ND-1234 ..."
          const ticketIdInSubject = (subject.match(/#(ND-\d+)/i) || [])[1];
          // 2. Try In-Reply-To / References headers for threadId matching
          const inReplyTo = parsed.inReplyTo || "";
          const references = Array.isArray(parsed.references)
            ? parsed.references.join(" ")
            : String(parsed.references || "");

          let matchedTicket = null;
          if (ticketIdInSubject) {
            // Subject contains a ticket ID — find that ticket
            const found = store.tickets.find((t) => t.id.toLowerCase() === ticketIdInSubject.toLowerCase());
            if (found && (found.contact || "").toLowerCase() === fromEmail.toLowerCase()) {
              matchedTicket = found;
            } else if (found) {
              // Accept even if contact doesn't match (forwarded emails etc.)
              matchedTicket = found;
            }
          }
          if (!matchedTicket && (inReplyTo || references)) {
            // Look for stored threadId on tickets (set when we send outgoing email)
            const threadMatch = store.tickets.find((t) => {
              if (!t.emailThreadId) return false;
              return inReplyTo.includes(t.emailThreadId) || references.includes(t.emailThreadId);
            });
            if (threadMatch) matchedTicket = threadMatch;
          }
          if (!matchedTicket && fromEmail) {
            // Last resort: most recent resolved/closed ticket from this sender
            const recentCutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
            matchedTicket = store.tickets
              .filter(
                (t) =>
                  (t.contact || "").toLowerCase() === fromEmail.toLowerCase() &&
                  (t.status === "resuelto" || t.status === "cerrado") &&
                  t.resolvedAt &&
                  t.resolvedAt > recentCutoff
              )
              .sort((a, b) => new Date(b.resolvedAt) - new Date(a.resolvedAt))[0] || null;
          }

          if (matchedTicket) {
            // This email is a reply to an existing ticket
            const wasFinished = matchedTicket.status === "resuelto" || matchedTicket.status === "cerrado";
            const replyNote = `Respuesta del cliente:\n${bodyText}`;
            addTicketHistory(matchedTicket.id, replyNote, wasFinished ? "abierto" : matchedTicket.status);
            if (wasFinished) {
              // Bump urgency one level — dissatisfied client deserves higher priority
              const urgencyLevels = ["baja", "media", "alta", "critica"];
              const curIdx = urgencyLevels.indexOf(matchedTicket.urgency || "media");
              const newUrgency = urgencyLevels[Math.min(curIdx + 1, urgencyLevels.length - 1)];
              const prevUrgency = matchedTicket.urgency;
              // Reopen with escalated priority
              matchedTicket.status = "abierto";
              matchedTicket.urgency = newUrgency;
              matchedTicket.resolvedAt = null;
              matchedTicket.reopenedByClient = true;
              matchedTicket.reopenedAt = new Date().toISOString();
              saveStore();
              const escalationMsg = newUrgency !== prevUrgency
                ? `⚠️ Ticket reabierto por el cliente — prioridad escalada de "${prevUrgency}" a "${newUrgency}". Cliente insatisfecho con la solución entregada.`
                : `⚠️ Ticket reabierto por el cliente. Cliente insatisfecho con la solución entregada.`;
              addTicketHistory(matchedTicket.id, escalationMsg, "abierto");
              notifyClients("ticketsChanged", { action: "updated", id: matchedTicket.id });
              const reopened = getTickets().find((t) => t.id === matchedTicket.id);
              if (reopened) {
                sendTicketNotification("status_changed", reopened, { oldStatus: "resuelto" }).catch(() => {});
              }
              console.log(`[NeuroDesk] Ticket ${matchedTicket.id} reabierto por respuesta del cliente (${fromEmail}). Urgencia: ${prevUrgency} → ${newUrgency}.`);
            } else {
              notifyClients("ticketsChanged", { action: "updated", id: matchedTicket.id });
            }
            markEmailProcessedStmt.run(messageId, new Date().toISOString());
            try { await client.messageFlagsAdd(uid, ["\\Seen"]); } catch (_) {}
            continue; // Do NOT create a new ticket
          }
          // ── End reply detection ─────────────────────────────────────────────

          // If the subject looks like an internal notification or reply to one, skip silently
          if (/^\[Admin\]/i.test(subject) || /^re:\s*\[Admin\]/i.test(subject) || /^fwd?:\s*\[Admin\]/i.test(subject)) {
            markEmailProcessedStmt.run(messageId, new Date().toISOString());
            try { await client.messageFlagsAdd(uid, ["\\Seen"]); } catch (_) {}
            continue;
          }

          const urgency = detectUrgency(subject, bodyText);
          const ticketBase = normalizeTicket(
            {
              name: fromName || fromEmail,
              contact: fromEmail,
              area: emailConfig.defaultArea,
              urgency,
              subject,
              description: bodyText,
              htmlBody: parsed.html || "",
            },
            "email"
          );
          // Save image attachments to disk
          const savedAttachments = [];
          if (ticketBase && Array.isArray(parsed.attachments)) {
            const ticketAttachDir = path.join(ATTACH_DIR, ticketBase.id);
            for (const att of parsed.attachments) {
              if (!att.contentType || !att.contentType.startsWith("image/")) continue;
              const ext = att.filename
                ? path.extname(att.filename).toLowerCase() || ".bin"
                : ".bin";
              const safeName = `${crypto.randomUUID()}${ext}`;
              try {
                fs.mkdirSync(ticketAttachDir, { recursive: true });
                fs.writeFileSync(path.join(ticketAttachDir, safeName), att.content);
                savedAttachments.push({ name: att.filename || safeName, file: safeName, type: att.contentType, source: "client" });
              } catch (_) {}
            }
          }
          let ticket = ticketBase ? { ...ticketBase, attachments: savedAttachments } : null;
          if (ticket) {
            // Run AI triage — override keyword-based urgency with Claude's analysis
            const triage = await aiTriageTicket(subject, bodyText);
            if (triage) {
              if (triage.urgency && appConfig.sla[triage.urgency]) ticket.urgency = triage.urgency;
              ticket.aiCategory = triage.category || null;
              ticket.aiSentiment = triage.sentiment || null;
              ticket.aiSentimentScore = triage.sentimentScore ?? null;
            }
            insertTicket(ticket);
            markEmailProcessedStmt.run(messageId, new Date().toISOString());
            try {
              await client.messageFlagsAdd(uid, ["\\Seen"]);
            } catch (_) {}
            created++;
          }
        }
      } finally {
        lock.release();
      }
      await client.logout();
      emailPollStatus.lastPoll = new Date().toISOString();
      emailPollStatus.lastError = null;
      emailPollStatus.consecutiveErrors = 0;
      emailPollStatus.ticketsCreated += created;
      // Avanzar ventana: próximo poll busca desde ahora - 2h (cubre retrasos de entrega)
      emailConfig.connectedAt = new Date(Date.now() - POLL_LOOKBACK_OVERLAP_MS).toISOString();
      upsertConfigStmt.run("email_config", JSON.stringify(emailConfig));
      if (created > 0) {
        console.log(`[NeuroDesk] Sondeo IMAP: ${created} ticket(s) creado(s) desde correo.`);
      }
    } catch (err) {
      emailPollStatus.lastPoll = new Date().toISOString();
      emailPollStatus.lastError = err.message;
      emailPollStatus.consecutiveErrors += 1;
      console.error(
        `[NeuroDesk] Error en sondeo IMAP (intento ${emailPollStatus.consecutiveErrors}): ${err.message}`
      );
      if (emailPollStatus.consecutiveErrors >= 3) {
        console.error(
          `[NeuroDesk] AVISO: el sondeo IMAP lleva ${emailPollStatus.consecutiveErrors} fallos consecutivos. Verifica credenciales y conectividad en Configuración > Correo entrante.`
        );
      }
      try {
        await client.logout();
      } catch (_) {}
    } finally {
      emailPollStatus.polling = false;
      const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
      cleanOldEmailsStmt.run(cutoff);
    }
  }

  try {
    await Promise.race([doPoll(), absoluteTimeoutPromise]);
  } catch (timeoutErr) {
    emailPollStatus.lastPoll = new Date().toISOString();
    emailPollStatus.lastError = timeoutErr.message;
    emailPollStatus.consecutiveErrors += 1;
    emailPollStatus.polling = false;
    console.error(`[NeuroDesk] ${timeoutErr.message}`);
    try {
      await client.logout();
    } catch (_) {}
  } finally {
    clearTimeout(absoluteTimeoutHandle);
  }

  return {
    created,
    checked: emailPollStatus.lastMessagesChecked,
    skipped: false,
    error: emailPollStatus.lastError,
  };
}

async function testEmailConnection(cfg) {
  const client = new ImapFlow({
    host: cfg.host,
    port: parseInt(cfg.port) || 993,
    secure: cfg.secure !== false,
    auth: { user: cfg.username, pass: (cfg.password || "").replace(/\s/g, "") },
    logger: false,
  });
  try {
    await client.connect();
    await client.logout();
    return { ok: true };
  } catch (err) {
    const msg = err.message || "";
    let hint = msg;
    if (/command failed|authentication failed|invalid credentials|login failed/i.test(msg)) {
      hint =
        "Credenciales incorrectas. Para Gmail debes usar una Contraseña de Aplicación (App Password) con IMAP habilitado en la cuenta.";
    } else if (/ECONNREFUSED|ETIMEDOUT|ENOTFOUND/i.test(msg)) {
      hint = `No se pudo conectar al servidor ${cfg.host}:${cfg.port}. Verifica el host y el puerto.`;
    } else if (/self.signed|certificate/i.test(msg)) {
      hint = "Error de certificado SSL. Intenta desactivar la conexión segura.";
    }
    return { ok: false, error: hint };
  }
}

function startEmailPoller() {
  if (emailPollerTimer) {
    clearInterval(emailPollerTimer);
    emailPollerTimer = null;
  }
  if (!emailConfig.enabled) {
    console.log("[NeuroDesk] Sondeo IMAP desactivado — no se inicia el poller.");
    return;
  }
  const intervalMs = (emailConfig.pollIntervalMinutes || 5) * 60 * 1000;
  console.log(
    `[NeuroDesk] Sondeo IMAP iniciado — intervalo: ${emailConfig.pollIntervalMinutes || 5} min, cuenta: ${emailConfig.username}`
  );
  pollEmails().catch(() => {});
  emailPollerTimer = setInterval(() => pollEmails().catch(() => {}), intervalMs);
}

// ── Auto-close resolved tickets after 24h ────────────────────────────────────

function startAutoCloser() {
  function runAutoClose() {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const toClose = store.tickets.filter(
      (t) => t.status === "resuelto" && t.resolvedAt && t.resolvedAt < cutoff
    );
    for (const ticket of toClose) {
      const oldStatus = ticket.status;
      ticket.status = "cerrado";
      ticket.resolvedAt = null;
      addTicketHistory(
        ticket.id,
        "Cerrado automáticamente después de 24 h en estado resuelto.",
        "cerrado"
      );
      const snapshot = { ...ticket };
      sendTicketNotification("status_changed", snapshot, { oldStatus }).catch(() => {});
    }
    if (toClose.length > 0) {
      saveStore();
      notifyClients("ticketsChanged", { action: "status" });
      console.log(
        `[NeuroDesk] Auto-cerrados ${toClose.length} ticket(s) resuelto(s) hace más de 24 h.`
      );
    }
  }
  runAutoClose();
  setInterval(runAutoClose, 10 * 60 * 1000);
}

// ── Auth handler ──────────────────────────────────────────────────────────────

async function handleAuth(req, res) {
  if (req.method === "GET" && req.url === "/api/auth/me") {
    const session = getAuthSession(req);
    if (!session) {
      sendJson(res, 401, { error: "No autenticado." });
      return;
    }
    sendJson(res, 200, { username: session.username });
    return;
  }

  if (req.method === "POST" && req.url === "/api/auth/login") {
    const ip = getClientIp(req);
    if (!checkLoginRateLimit(ip)) {
      sendJson(res, 429, { error: "Demasiados intentos fallidos. Espera 15 minutos." });
      return;
    }
    try {
      const body = await readBody(req);
      const username = String(body.username || "")
        .trim()
        .toLowerCase();
      const password = String(body.password || "");
      const user = getUserStmt.get(username);
      if (!user || hashPassword(password, user.salt) !== user.password_hash) {
        sendJson(res, 401, { error: "Usuario o contraseña incorrectos." });
        return;
      }
      resetLoginRateLimit(ip);
      const token = createSession(username);
      res.writeHead(200, {
        "Content-Type": "application/json; charset=utf-8",
        "Set-Cookie": `nd_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${SESSION_COOKIE_MAX_AGE}`,
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
      "Set-Cookie": "nd_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0",
    });
    res.end(JSON.stringify({ ok: true }));
    return;
  }

  if (req.method === "POST" && req.url === "/api/auth/password") {
    const session = getAuthSession(req);
    if (!session) {
      sendJson(res, 401, { error: "No autenticado." });
      return;
    }
    try {
      const body = await readBody(req);
      const current = String(body.current || "");
      const newPass = String(body.password || "").trim();
      if (newPass.length < 4) {
        sendJson(res, 400, { error: "Mínimo 4 caracteres." });
        return;
      }
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

  if (req.method === "POST" && req.url === "/api/auth/forgot-password") {
    try {
      const body = await readBody(req);
      const username = String(body.username || "").trim().toLowerCase();
      const user = getUserStmt.get(username);
      // Always return ok to avoid leaking user existence
      if (user) {
        const token = crypto.randomBytes(32).toString("hex");
        resetTokens.set(token, { username, expiresAt: Date.now() + RESET_TOKEN_MAX_AGE_MS });
        const host = req.headers.host || "localhost";
        const proto = req.headers["x-forwarded-proto"] || "http";
        const resetUrl = `${proto}://${host}/reset-password?token=${token}`;
        const adminEmail = (notificationsConfig.adminEmails || "").split(",")[0].trim();
        if (adminEmail) {
          await sendEmail(
            adminEmail,
            "NeuroDesk — Restablecer contraseña",
            `Hola ${username},\n\nRecibimos una solicitud para restablecer tu contraseña en NeuroDesk.\n\nUsa este enlace (válido por 1 hora):\n${resetUrl}\n\nSi no solicitaste esto, ignora este correo.\n\n— NeuroDesk`
          );
        }
      }
      sendJson(res, 200, { ok: true });
    } catch {
      sendJson(res, 400, { error: "No se pudo procesar la solicitud." });
    }
    return;
  }

  if (req.method === "POST" && req.url === "/api/auth/reset-password") {
    try {
      const body = await readBody(req);
      const token = String(body.token || "").trim();
      const newPass = String(body.password || "").trim();
      const entry = resetTokens.get(token);
      if (!entry || Date.now() > entry.expiresAt) {
        sendJson(res, 400, { error: "El enlace de restablecimiento es inválido o ya expiró." });
        return;
      }
      if (newPass.length < 4) {
        sendJson(res, 400, { error: "Mínimo 4 caracteres." });
        return;
      }
      const newSalt = crypto.randomBytes(16).toString("hex");
      updatePasswordStmt.run(hashPassword(newPass, newSalt), newSalt, entry.username);
      resetTokens.delete(token);
      sendJson(res, 200, { ok: true });
    } catch {
      sendJson(res, 400, { error: "No se pudo restablecer la contraseña." });
    }
    return;
  }

  sendJson(res, 404, { error: "Ruta no encontrada." });
}

// ── API handler ───────────────────────────────────────────────────────────────

async function handleApi(req, res) {
  if (req.method === "GET" && req.url === "/api/events") {
    handleEvents(req, res);
    return;
  }

  if (req.method === "GET" && req.url === "/api/health") {
    sendJson(res, 200, { ok: true, version: packageInfo.version, store: STORE_PATH });
    return;
  }

  if (req.method === "GET" && req.url === "/api/version") {
    sendJson(res, 200, { version: packageInfo.version });
    return;
  }

  if (req.method === "GET" && req.url === "/api/config") {
    sendJson(res, 200, appConfig);
    return;
  }

  if (req.method === "PUT" && req.url === "/api/config") {
    try {
      sendJson(res, 200, saveConfig(await readBody(req)));
    } catch {
      sendJson(res, 400, { error: "No se pudo guardar la configuración." });
    }
    return;
  }

  if (req.method === "GET" && req.url === "/api/tickets") {
    sendJson(
      res,
      200,
      getTickets().map((t) => ({ ...t, sla: getSlaState(t) }))
    );
    return;
  }

  if (req.method === "GET" && req.url === "/api/stats") {
    sendJson(res, 200, getStats());
    return;
  }

  if (req.method === "POST" && req.url === "/api/tickets") {
    try {
      const body = await readBody(req);
      const ticket = normalizeTicket(body, "web");
      if (!ticket) {
        sendJson(res, 400, { error: "Nombre y urgencia válida son obligatorios." });
        return;
      }
      // Run AI triage async — don't block the response
      aiTriageTicket(ticket.subject || "", ticket.description || "").then((triage) => {
        if (!triage) return;
        const raw = store.tickets.find((t) => t.id === ticket.id);
        if (!raw) return;
        if (triage.urgency && appConfig.sla[triage.urgency]) raw.urgency = triage.urgency;
        raw.aiCategory = triage.category || null;
        raw.aiSentiment = triage.sentiment || null;
        raw.aiSentimentScore = triage.sentimentScore ?? null;
        saveStore();
        notifyClients("ticketsChanged", { action: "updated", id: ticket.id });
      }).catch(() => {});
      sendJson(res, 201, insertTicket(ticket));
    } catch {
      sendJson(res, 400, { error: "No se pudo leer la solicitud." });
    }
    return;
  }

  // GET /api/tickets/:id/ai-suggest — generate a suggested reply
  if (req.method === "GET" && /^\/api\/tickets\/[^/]+\/ai-suggest$/.test(req.url)) {
    const id = decodeURIComponent(req.url.split("/")[3] || "");
    const ticket = getTickets().find((t) => t.id === id);
    if (!ticket) { sendJson(res, 404, { error: "Ticket no encontrado." }); return; }
    if (!process.env.ANTHROPIC_API_KEY) {
      sendJson(res, 503, { error: "ANTHROPIC_API_KEY no configurada en el servidor." });
      return;
    }
    const suggestion = await aiSuggestReply(ticket);
    sendJson(res, 200, { suggestion });
    return;
  }

  // DELETE single ticket
  if (req.method === "DELETE" && /^\/api\/tickets\/[^/]+$/.test(req.url)) {
    const id = decodeURIComponent(req.url.split("/")[3] || "");
    deleteTicketHistoryStmt.run(id);
    const result = deleteTicketStmt.run(id);
    if (result.changes === 0) {
      sendJson(res, 404, { error: "Ticket no encontrado." });
      return;
    }
    notifyClients("ticketsChanged", { action: "deleted", id });
    sendJson(res, 200, { ok: true });
    return;
  }

  // DELETE bulk tickets
  if (req.method === "DELETE" && req.url === "/api/tickets") {
    try {
      const body = await readBody(req);
      const ids = Array.isArray(body.ids)
        ? body.ids.filter((id) => typeof id === "string").slice(0, 500)
        : [];
      if (ids.length === 0) {
        sendJson(res, 400, { error: "No se proporcionaron IDs válidos." });
        return;
      }
      const placeholders = ids.map(() => "?").join(",");
      ids.forEach((id) => deleteTicketHistoryStmt.run(id));
      const result = db.prepare(`DELETE FROM tickets WHERE id IN (${placeholders})`).run(...ids);
      if (result.changes > 0)
        notifyClients("ticketsChanged", { action: "deletedBulk", count: result.changes });
      sendJson(res, 200, { deleted: result.changes });
    } catch {
      sendJson(res, 400, { error: "No se pudo procesar la solicitud." });
    }
    return;
  }

  if (
    req.method === "PATCH" &&
    req.url.startsWith("/api/tickets/") &&
    req.url.endsWith("/status")
  ) {
    try {
      const id = decodeURIComponent(req.url.split("/")[3] || "");
      const body = await readBody(req);
      const ticket = updateTicketStatus(id, String(body.status || "").trim());
      if (!ticket) {
        sendJson(res, 400, { error: "Ticket no encontrado o estado inválido." });
        return;
      }
      sendJson(res, 200, { ...ticket, sla: getSlaState(ticket) });
    } catch {
      sendJson(res, 400, { error: "No se pudo actualizar el estado." });
    }
    return;
  }

  if (
    req.method === "PATCH" &&
    req.url.startsWith("/api/tickets/") &&
    req.url.endsWith("/position")
  ) {
    try {
      const id = decodeURIComponent(req.url.split("/")[3] || "");
      const body = await readBody(req);
      const ticket = updateTicketPosition(id, String(body.status || "").trim(), body.orderedIds);
      if (!ticket) {
        sendJson(res, 400, { error: "Ticket no encontrado, estado invalido u orden invalido." });
        return;
      }
      sendJson(res, 200, { ...ticket, sla: getSlaState(ticket) });
    } catch {
      sendJson(res, 400, { error: "No se pudo actualizar la posicion." });
    }
    return;
  }

  if (req.method === "PATCH" && /^\/api\/tickets\/[^/]+$/.test(req.url)) {
    try {
      const id = decodeURIComponent(req.url.split("/")[3] || "");
      const ticket = updateTicketFull(id, await readBody(req));
      if (!ticket) {
        sendJson(res, 400, { error: "Ticket no encontrado o datos inválidos." });
        return;
      }
      sendJson(res, 200, { ...ticket, sla: getSlaState(ticket) });
    } catch {
      sendJson(res, 400, { error: "No se pudo actualizar el ticket." });
    }
    return;
  }

  // POST /api/tickets/:id/reply — send email reply to ticket contact
  if (req.method === "POST" && /^\/api\/tickets\/[^/]+\/reply$/.test(req.url)) {
    try {
      const id = decodeURIComponent(req.url.split("/")[3] || "");
      const rawTicket = store.tickets.find((t) => t.id === id);
      if (!rawTicket) { sendJson(res, 404, { error: "Ticket no encontrado." }); return; }
      if (!rawTicket.contact) { sendJson(res, 400, { error: "El ticket no tiene correo de contacto." }); return; }
      const body = await readBody(req);
      const message = String(body.message || "").trim().slice(0, 4000);
      if (!message) { sendJson(res, 400, { error: "El mensaje no puede estar vacío." }); return; }
      // Build nodemailer attachments from already-uploaded files on disk
      const savedAtts = (() => { try { return JSON.parse(rawTicket.attachments || "[]"); } catch (_) { return []; } })();
      const requestedFiles = Array.isArray(body.attachmentFiles) ? body.attachmentFiles : [];
      const emailAttachments = requestedFiles.map((fname) => {
        const meta = savedAtts.find((a) => a.file === fname);
        const filePath = path.join(ATTACH_DIR, id, fname);
        if (!meta || !fs.existsSync(filePath)) return null;
        return { filename: meta.name, path: filePath };
      }).filter(Boolean);
      await sendEmail(rawTicket.contact, `Re: ${rawTicket.subject || rawTicket.id}`, message, emailAttachments);
      const attNote = emailAttachments.length > 0
        ? `\n[${emailAttachments.length} archivo(s) adjunto(s): ${emailAttachments.map(a => a.filename).join(", ")}]`
        : "";
      addTicketHistory(id, `Respuesta enviada al cliente:\n${message}${attNote}`, rawTicket.status);
      notifyClients("ticketsChanged", { action: "updated", id });
      sendJson(res, 200, { ok: true });
    } catch (err) {
      sendJson(res, 500, { error: err.message || "No se pudo enviar la respuesta." });
    }
    return;
  }

  // POST /api/tickets/:id/attachments — upload file (base64 JSON)
  if (req.method === "POST" && /^\/api\/tickets\/[^/]+\/attachments$/.test(req.url)) {
    try {
      const id = decodeURIComponent(req.url.split("/")[3] || "");
      const rawTicket = store.tickets.find((t) => t.id === id);
      if (!rawTicket) { sendJson(res, 404, { error: "Ticket no encontrado." }); return; }
      const body = await readBody(req, 12_000_000); // 12 MB max (base64 overhead)
      const { name: origName, type: mimeType, data: b64 } = body;
      if (!origName || !b64) { sendJson(res, 400, { error: "Nombre y datos requeridos." }); return; }
      const BLOCKED_MIME = /^(text\/html|application\/(javascript|x-sh|x-bash|x-php)|image\/svg\+xml)$/;
      if (mimeType && BLOCKED_MIME.test(mimeType)) { sendJson(res, 400, { error: "Tipo de archivo no permitido." }); return; }
      const ALLOWED_EXT = /\.(jpe?g|png|gif|webp|bmp|tiff?|pdf|docx?|xlsx?|txt|csv)$/i;
      if (!ALLOWED_EXT.test(path.extname(origName))) { sendJson(res, 400, { error: "Extensión no permitida." }); return; }
      const ext = path.extname(origName).toLowerCase() || ".bin";
      const safeName = `${crypto.randomUUID()}${ext}`;
      const ticketAttachDir = path.join(ATTACH_DIR, id);
      fs.mkdirSync(ticketAttachDir, { recursive: true });
      const buffer = Buffer.from(b64, "base64");
      if (buffer.length > 8_000_000) { sendJson(res, 400, { error: "Archivo muy grande (máx 8 MB)." }); return; }
      fs.writeFileSync(path.join(ticketAttachDir, safeName), buffer);
      const newAtt = { name: origName, file: safeName, type: mimeType || "application/octet-stream", source: "agent" };
      let attachments = [];
      try { attachments = rawTicket.attachments ? JSON.parse(rawTicket.attachments) : []; } catch (_) {}
      if (!Array.isArray(attachments)) attachments = [];
      attachments.push(newAtt);
      rawTicket.attachments = JSON.stringify(attachments);
      saveStore();
      notifyClients("ticketsChanged", { action: "updated", id });
      sendJson(res, 201, newAtt);
    } catch (err) {
      sendJson(res, 500, { error: err.message || "No se pudo subir el archivo." });
    }
    return;
  }

  // DELETE /api/tickets/:id/attachments/:filename — remove an attachment
  if (req.method === "DELETE" && /^\/api\/tickets\/[^/]+\/attachments\/[^/]+$/.test(req.url)) {
    const parts = req.url.split("/");
    const id = decodeURIComponent(parts[3] || "");
    const filename = decodeURIComponent(parts[5] || "");
    if (!id || !filename || filename.includes("..") || filename.includes("/")) { sendJson(res, 400, { error: "Solicitud inválida." }); return; }
    const rawTicket = store.tickets.find((t) => t.id === id);
    if (!rawTicket) { sendJson(res, 404, { error: "Ticket no encontrado." }); return; }
    let attachments = [];
    try { attachments = rawTicket.attachments ? JSON.parse(rawTicket.attachments) : []; } catch (_) {}
    rawTicket.attachments = JSON.stringify(attachments.filter((a) => a.file !== filename));
    saveStore();
    try { fs.unlinkSync(path.join(ATTACH_DIR, id, filename)); } catch (_) {}
    notifyClients("ticketsChanged", { action: "updated", id });
    sendJson(res, 200, { ok: true });
    return;
  }

  // POST /api/tickets/:id/notes — add quick note to history without changing status
  if (req.method === "POST" && /^\/api\/tickets\/[^/]+\/notes$/.test(req.url)) {
    try {
      const id = decodeURIComponent(req.url.split("/")[3] || "");
      const rawTicket = store.tickets.find((t) => t.id === id);
      if (!rawTicket) { sendJson(res, 404, { error: "Ticket no encontrado." }); return; }
      const body = await readBody(req);
      const note = String(body.note || "").trim().slice(0, 4000);
      if (!note) { sendJson(res, 400, { error: "La nota no puede estar vacía." }); return; }
      // Push directly so isQuickNote flag is preserved in the JSON store
      const entry = { id: crypto.randomUUID(), ticketId: id, note, status: rawTicket.status, createdAt: new Date().toISOString(), isQuickNote: true };
      store.ticketHistory.push(entry);
      saveStore();
      notifyClients("ticketsChanged", { action: "updated", id });
      sendJson(res, 201, { ok: true });
    } catch (err) {
      sendJson(res, 400, { error: err.message || "No se pudo guardar la nota." });
    }
    return;
  }

  // GET /api/tickets/:id/attachments/:filename — serve attachments
  if (req.method === "GET" && /^\/api\/tickets\/[^/]+\/attachments\/[^/]+$/.test(req.url)) {
    const parts = req.url.split("/");
    const ticketId = decodeURIComponent(parts[3] || "");
    const filename = decodeURIComponent(parts[5] || "");
    if (!ticketId || !filename || filename.includes("..") || filename.includes("/")) {
      res.writeHead(400); res.end("Bad request"); return;
    }
    const filePath = path.join(ATTACH_DIR, ticketId, filename);
    if (!filePath.startsWith(ATTACH_DIR)) { res.writeHead(403); res.end("Forbidden"); return; }
    fs.readFile(filePath, (err, data) => {
      if (err) { res.writeHead(404); res.end("Not found"); return; }
      const ext = path.extname(filename).toLowerCase();
      const mimeMap = {
        ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png",
        ".gif": "image/gif", ".webp": "image/webp",
        ".pdf": "application/pdf", ".txt": "text/plain",
        ".doc": "application/msword",
        ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        ".xls": "application/vnd.ms-excel",
        ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      };
      const mime = mimeMap[ext] || "application/octet-stream";
      const inline = mime.startsWith("image/") || mime === "application/pdf";
      res.writeHead(200, {
        "Content-Type": mime,
        "Cache-Control": "public, max-age=86400",
        "Content-Disposition": inline ? `inline; filename="${filename}"` : `attachment; filename="${filename}"`,
      });
      res.end(data);
    });
    return;
  }

  if (req.method === "GET" && req.url === "/api/email/config") {
    const safe = { ...emailConfig, password: emailConfig.password ? "••••••••" : "" };
    sendJson(res, 200, safe);
    return;
  }

  if (req.method === "PUT" && req.url === "/api/email/config") {
    try {
      const body = await readBody(req);
      if (body.password === "••••••••") body.password = emailConfig.password;
      const saved = saveEmailConfig(body);
      sendJson(res, 200, { ...saved, password: saved.password ? "••••••••" : "" });
    } catch {
      sendJson(res, 400, { error: "No se pudo guardar la configuración de correo." });
    }
    return;
  }

  if (req.method === "POST" && req.url === "/api/email/test") {
    try {
      const body = await readBody(req);
      if (body.password === "••••••••") body.password = emailConfig.password;
      const result = await testEmailConnection(body);
      sendJson(res, result.ok ? 200 : 400, result);
    } catch {
      sendJson(res, 400, { error: "No se pudo probar la conexión." });
    }
    return;
  }

  if (req.method === "POST" && req.url === "/api/email/poll") {
    try {
      const result = await pollEmails({ force: true });
      sendJson(res, result.error && result.skipped ? 400 : 200, { ok: !result.error, ...result });
    } catch {
      sendJson(res, 400, { error: "Error durante el sondeo." });
    }
    return;
  }

  if (req.method === "GET" && req.url === "/api/email/status") {
    sendJson(res, 200, { ...emailPollStatus });
    return;
  }

  if (req.method === "POST" && req.url === "/api/email/inbound") {
    try {
      const body = await readBody(req);
      const ticket = normalizeTicket(
        {
          name: body.from || body.name,
          contact: body.from || body.contact,
          area: body.area || "Correo",
          urgency: body.urgency || "media",
          subject: body.subject || "",
          description: body.description || body.text || body.body || "",
        },
        "email"
      );
      if (!ticket) {
        sendJson(res, 400, { error: "El correo no contiene datos suficientes." });
        return;
      }
      sendJson(res, 201, insertTicket(ticket));
    } catch {
      sendJson(res, 400, { error: "No se pudo procesar el correo entrante." });
    }
    return;
  }

  if (req.method === "GET" && req.url === "/api/notifications/config") {
    const safe = JSON.parse(JSON.stringify(notificationsConfig));
    if (safe.smtp?.pass) safe.smtp.pass = "••••••••";
    sendJson(res, 200, safe);
    return;
  }

  if (req.method === "PUT" && req.url === "/api/notifications/config") {
    try {
      const body = await readBody(req);
      const saved = saveNotificationsConfig(body);
      const safe = JSON.parse(JSON.stringify(saved));
      if (safe.smtp?.pass) safe.smtp.pass = "••••••••";
      sendJson(res, 200, safe);
    } catch {
      sendJson(res, 400, { error: "No se pudo guardar la configuración de notificaciones." });
    }
    return;
  }

  if (req.method === "POST" && req.url === "/api/notifications/test") {
    try {
      const body = await readBody(req);
      const to = String(body.to || "").trim();
      if (!to || !to.includes("@")) {
        sendJson(res, 400, { error: "Dirección de correo inválida." });
        return;
      }
      const type = String(body.type || "received");
      const tpl =
        notificationsConfig.templates?.[type] ||
        DEFAULT_NOTIFICATIONS_CONFIG.templates[type] ||
        DEFAULT_NOTIFICATIONS_CONFIG.templates.received;
      const baseUrl = (notificationsConfig.app_url || "").replace(/\/$/, "");
      const sampleVars = {
        ticket_id: "ND-1001",
        ticket_title: "Error de ejemplo en aplicación",
        user_name: "Usuario de Prueba",
        user_email: to,
        old_status: "Abierto",
        new_status: "En proceso",
        agent_name: "Agente de Soporte",
        resolution_notes: "Se reinició el servicio y se verificó el funcionamiento correcto.",
        ticket_url: baseUrl ? `${baseUrl}/?ticket=ND-1001` : "",
        portal_url: baseUrl ? `${baseUrl}/portal?email=${encodeURIComponent(to)}` : "",
      };
      const subject = renderTemplate(tpl.subject, sampleVars);
      const bodyText = renderTemplate(tpl.body, sampleVars);
      await sendEmail(to, `[TEST] ${subject}`, bodyText);
      sendJson(res, 200, { ok: true });
    } catch (err) {
      sendJson(res, 400, { error: err.message || "No se pudo enviar el correo de prueba." });
    }
    return;
  }

  // ── User management ──────────────────────────────────────────────────────────

  const session2 = getAuthSession(req);
  if (!session2) {
    sendJson(res, 401, { error: "No autenticado." });
    return;
  }

  if (req.method === "GET" && req.url === "/api/users") {
    sendJson(res, 200, { users: listUsersStmt.all().map((u) => u.username) });
    return;
  }

  if (req.method === "POST" && req.url === "/api/users") {
    try {
      const body = await readBody(req);
      const username = String(body.username || "")
        .trim()
        .toLowerCase();
      const password = String(body.password || "");
      if (!username || username.length < 2 || !/^[a-z0-9_.-]+$/.test(username)) {
        sendJson(res, 400, { error: "Usuario inválido (mín. 2 chars, solo letras/números/._-)." });
        return;
      }
      if (password.length < 4) {
        sendJson(res, 400, { error: "Contraseña mínimo 4 caracteres." });
        return;
      }
      if (getUserStmt.get(username)) {
        sendJson(res, 409, { error: "El usuario ya existe." });
        return;
      }
      const salt = crypto.randomBytes(16).toString("hex");
      insertUserStmt.run(username, hashPassword(password, salt), salt);
      sendJson(res, 201, { username });
    } catch {
      sendJson(res, 400, { error: "No se pudo crear el usuario." });
    }
    return;
  }

  if (req.method === "DELETE" && req.url.startsWith("/api/users/")) {
    const target = decodeURIComponent(req.url.slice("/api/users/".length));
    if (!target) {
      sendJson(res, 400, { error: "Usuario no especificado." });
      return;
    }
    if (target === session2.username) {
      sendJson(res, 400, { error: "No puedes eliminar tu propio usuario." });
      return;
    }
    if (countUsersStmt.get().total <= 1) {
      sendJson(res, 400, { error: "Debe existir al menos un usuario." });
      return;
    }
    const result = deleteUserStmt.run(target);
    if (result.changes === 0) {
      sendJson(res, 404, { error: "Usuario no encontrado." });
      return;
    }
    sendJson(res, 200, { ok: true });
    return;
  }

  if (req.method === "PUT" && /^\/api\/users\/[^/]+\/password$/.test(req.url)) {
    const target = decodeURIComponent(req.url.split("/")[3]);
    try {
      const body = await readBody(req);
      const newPass = String(body.password || "").trim();
      if (newPass.length < 4) {
        sendJson(res, 400, { error: "Contraseña mínimo 4 caracteres." });
        return;
      }
      if (!getUserStmt.get(target)) {
        sendJson(res, 404, { error: "Usuario no encontrado." });
        return;
      }
      const newSalt = crypto.randomBytes(16).toString("hex");
      updatePasswordStmt.run(hashPassword(newPass, newSalt), newSalt, target);
      sendJson(res, 200, { ok: true });
    } catch {
      sendJson(res, 400, { error: "No se pudo cambiar la contraseña." });
    }
    return;
  }

  if (req.method === "PATCH" && /^\/api\/users\/[^/]+$/.test(req.url)) {
    const target = decodeURIComponent(req.url.slice("/api/users/".length));
    try {
      const body = await readBody(req);
      const newUsername = String(body.username || "")
        .trim()
        .toLowerCase();
      if (!newUsername || newUsername.length < 2 || !/^[a-z0-9_.-]+$/.test(newUsername)) {
        sendJson(res, 400, { error: "Usuario inválido (mín. 2 chars, solo letras/números/._-)." });
        return;
      }
      if (!getUserStmt.get(target)) {
        sendJson(res, 404, { error: "Usuario no encontrado." });
        return;
      }
      if (newUsername !== target && getUserStmt.get(newUsername)) {
        sendJson(res, 409, { error: "El usuario ya existe." });
        return;
      }
      renameUserStmt.run(newUsername, target);
      sendJson(res, 200, { username: newUsername });
    } catch {
      sendJson(res, 400, { error: "No se pudo renombrar el usuario." });
    }
    return;
  }

  sendJson(res, 404, { error: "Ruta no encontrada." });
}

// ── Main server ───────────────────────────────────────────────────────────────

const isPublicApi = (method, url) =>
  (method === "GET" &&
    (url === "/api/health" || url === "/api/version" || url === "/api/config" ||
     url.startsWith("/api/portal/tickets"))) ||
  (method === "POST" && (url === "/api/tickets" || url === "/api/email/inbound"));
// All /api/notifications/* routes require authentication (handled by default guard)

const server = http.createServer(async (req, res) => {
  // Portal — always public
  if (req.url === "/portal") {
    serveFile(res, "portal.html");
    return;
  }

  // Portal ticket lookup — public, read-only, limited fields
  if (req.method === "GET" && req.url.startsWith("/api/portal/tickets")) {
    const email = new URL(req.url, "http://localhost").searchParams.get("email") || "";
    if (!email || !email.includes("@")) {
      sendJson(res, 400, { error: "Email requerido." });
      return;
    }
    const emailLower = email.toLowerCase().trim();
    const tickets = getTickets()
      .filter((t) => (t.contact || "").toLowerCase() === emailLower)
      .map((t) => ({
        id: t.id,
        subject: t.subject,
        status: t.status,
        urgency: t.urgency,
        createdAt: t.createdAt,
      }));
    sendJson(res, 200, tickets);
    return;
  }

  // Reset password page — always public
  if (req.url === "/reset-password" || req.url.startsWith("/reset-password?")) {
    serveFile(res, "reset-password.html");
    return;
  }

  // Auth endpoints — always public
  if (req.url.startsWith("/api/auth/")) {
    await handleAuth(req, res);
    return;
  }

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

  if (req.url.startsWith("/api/")) {
    await handleApi(req, res);
    return;
  }

  sendStatic(req, res);
});

process.on("uncaughtException", (err) => {
  console.error("[NeuroDesk] uncaughtException:", err.message, err.stack);
});

process.on("unhandledRejection", (reason) => {
  console.error("[NeuroDesk] unhandledRejection:", reason);
});

function startServer() {
  const isSocket = Number.isNaN(Number(PORT));
  const onListening = () => {
    const target = isSocket ? PORT : `${HOST}:${PORT}`;
    console.log(`NeuroDesk v${packageInfo.version} listo en ${target}`);
    console.log(`Node ${process.version} | cwd ${process.cwd()}`);
    console.log(`Datos: ${STORE_PATH}`);
  };

  if (isSocket) server.listen(PORT, onListening);
  else server.listen(Number(PORT), HOST, onListening);

  server.on("error", (err) => {
    console.error("[NeuroDesk] server error:", err.message, err.stack);
  });
}

/*
if (false) {
  server.listen(PORT, HOST, () => {
    console.log(`NeuroDesk v${packageInfo.version} listo en http://${HOST}:${PORT}`);
    console.log(`Datos: ${STORE_PATH}`);
    console.log(`Portal público en http://localhost:${PORT}/portal`);
  });

  server.on("error", (err) => {
    console.error("[NeuroDesk] server error:", err.message);
  });
}
*/

if ((require.main === module || process.env.NODE_ENV === "production") && !process.env.ND_TEST) {
  startServer();
}

module.exports = { server, startServer };
