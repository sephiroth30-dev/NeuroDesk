// Force timezone before any date operations so business-hour checks use local time.
// LiteSpeed/lsnode does not inherit TZ from ecosystem.config.js.
process.env.TZ = process.env.TZ || "America/Bogota";

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
  sessions: [],
  apiKeys: [],
  webhooks: [],
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
      sessions: Array.isArray(parsed.sessions) ? parsed.sessions : [],
      apiKeys: Array.isArray(parsed.apiKeys) ? parsed.apiKeys : [],
      webhooks: Array.isArray(parsed.webhooks) ? parsed.webhooks : [],
    };
  } catch (_) {
    return JSON.parse(JSON.stringify(EMPTY_STORE));
  }
}

const store = loadStore();

// ── Timezone caches ──────────────────────────────────────────────────────────
// Declared here, before any module-level code runs, because seedDemoTicket()
// executes during load and reaches getSlaState() -> calcBusinessMs(). Leaving
// these next to their functions further down put them in the temporal dead
// zone and crashed the server on a fresh install.
// Building an Intl.DateTimeFormat costs ~100µs, so one is cached per timezone
// and never constructed inside a loop.
const tzFormatterCache = new Map();
const tzOffsetCache = new Map();
const DOW_MAP = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

// ── Ticket history index ─────────────────────────────────────────────────────
// Reading a ticket's history used to filter the entire history array, so listing
// N tickets was O(N*M). Built lazily and dropped whenever history changes.
let historyIndex = null;

function invalidateHistoryIndex() {
  historyIndex = null;
}

function getHistoryIndex() {
  if (historyIndex) return historyIndex;
  const index = new Map();
  for (const entry of store.ticketHistory) {
    let list = index.get(entry.ticketId);
    if (!list) { list = []; index.set(entry.ticketId, list); }
    list.push(entry);
  }
  for (const list of index.values()) {
    list.sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
  }
  historyIndex = index;
  return index;
}

// ── Store persistence ────────────────────────────────────────────────────────
// A single ticket close used to trigger 6-10 full-JSON writes. Callers can open
// a batch so the store is serialized once, at the end. Writes stay atomic
// (tmp + rename) and a batch always flushes, even on error.
let saveDepth = 0;
let savePending = false;

function writeStoreToDisk() {
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

function saveStore() {
  if (saveDepth > 0) { savePending = true; return; }
  writeStoreToDisk();
}

// Runs fn with store writes coalesced into one. Always flushes if anything was
// written, including when fn throws — data must never be left only in memory.
function withBatchedSave(fn) {
  saveDepth += 1;
  try {
    return fn();
  } finally {
    saveDepth -= 1;
    if (saveDepth === 0 && savePending) {
      savePending = false;
      writeStoreToDisk();
    }
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
        invalidateHistoryIndex();
        saveStore();
        return { changes: before - store.ticketHistory.length };
      },
    };
  }
  if (compact.startsWith("INSERT INTO ticket_history")) {
    return {
      run: (id, ticketId, note, status, createdAt) => {
        store.ticketHistory.push({ id, ticketId, note, status, createdAt });
        invalidateHistoryIndex();
        saveStore();
        return { changes: 1 };
      },
    };
  }
  if (compact.startsWith("SELECT id, note, status")) {
    // Was a full filter+sort over the whole history array per ticket — O(N*M)
    // across a listing. Served from a lazily-built index instead.
    return { all: (ticketId) => getHistoryIndex().get(ticketId) || [] };
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

// ── Sessions (persisted in store.sessions, survive restarts) ─────────────────

const SESSION_MAX_AGE_MS = 24 * 60 * 60 * 1000;

function pruneSessions() {
  const now = Date.now();
  store.sessions = store.sessions.filter((s) => s.expiresAt > now);
}

const resetTokens = new Map(); // token -> { username, expiresAt }
const RESET_TOKEN_MAX_AGE_MS = 60 * 60 * 1000; // 1 hour

// ── Login rate limiting ───────────────────────────────────────────────────────
const loginAttempts = new Map();
const LOGIN_MAX = 10;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;

// The socket address is the only value a client cannot forge. Trusting the
// first entry of X-Forwarded-For let anyone reset every rate-limit bucket just
// by varying the header, which made the login throttle decorative.
// Set ND_TRUST_PROXY=1 only when a reverse proxy you control sets the header.
const TRUST_PROXY = process.env.ND_TRUST_PROXY === "1";

function getClientIp(req) {
  if (TRUST_PROXY) {
    // With a trusted proxy the LAST hop is the one it appended, not the first,
    // which the client controls.
    const chain = String(req.headers["x-forwarded-for"] || "")
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean);
    if (chain.length) return chain[chain.length - 1];
  }
  return req.socket.remoteAddress || "unknown";
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

// ── Anti-spam for the open ticket form ───────────────────────────────────────
// Counting submissions per IP was the wrong tool: an office shares one public
// IP, so the counter measured "everyone together" rather than "one abuser", and
// legitimate tickets got rejected once the team got busy. Instead we identify
// automation directly — bots fill hidden fields and submit instantly — and cap
// per sender, so one person's excess never blocks a colleague.
const PUBLIC_SUBMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour

// Per-contact cap. Generous: a human filling a form never approaches it.
const submitsByContact = new Map();
const PUBLIC_SUBMIT_PER_CONTACT = Number(process.env.ND_SUBMIT_PER_CONTACT) || 20;

// Absolute circuit breaker per IP. Not a ration — it only exists so a flood
// cannot exhaust the process. A human will never see it.
const submitsByIp = new Map();
const PUBLIC_SUBMIT_IP_CEILING = Number(process.env.ND_SUBMIT_IP_CEILING) || 1000;

const MIN_FORM_FILL_MS = 3000;             // faster than this is not a human
const FORM_TOKEN_MAX_AGE_MS = 24 * 60 * 60 * 1000;

function bumpCounter(map, key, limit) {
  const now = Date.now();
  let entry = map.get(key);
  if (!entry || now > entry.resetAt) entry = { count: 0, resetAt: now + PUBLIC_SUBMIT_WINDOW_MS };
  entry.count += 1;
  map.set(key, entry);
  if (map.size > 10000) {
    for (const [k, v] of map) if (now > v.resetAt) map.delete(k);
  }
  return entry.count <= limit;
}

// Secret for signing form timestamps. Regenerated on restart, which at worst
// makes a form open across a restart fail closed — the visitor just resubmits.
const FORM_TOKEN_SECRET = crypto.randomBytes(32).toString("hex");

function issueFormToken() {
  const ts = Date.now().toString(36);
  const sig = crypto.createHmac("sha256", FORM_TOKEN_SECRET).update(ts).digest("hex").slice(0, 32);
  return `${ts}.${sig}`;
}

// Returns null when the token is acceptable, or a reason string.
function checkFormToken(token) {
  const [ts, sig] = String(token || "").split(".");
  if (!ts || !sig) return "missing";
  const expected = crypto.createHmac("sha256", FORM_TOKEN_SECRET).update(ts).digest("hex").slice(0, 32);
  if (!safeEqual(sig, expected)) return "bad_signature";
  const issuedAt = parseInt(ts, 36);
  if (!isFinite(issuedAt)) return "bad_timestamp";
  const age = Date.now() - issuedAt;
  if (age < MIN_FORM_FILL_MS) return "too_fast";
  if (age > FORM_TOKEN_MAX_AGE_MS) return "expired";
  return null;
}

// Decides whether an anonymous submission should become a ticket.
// `silentDrop` means: answer 200 but create nothing — never tell a bot it was
// detected, or it just adapts.
function screenPublicSubmission(req, body) {
  // 1. Honeypot: a field hidden by CSS that only automation fills in.
  if (String(body.website || body.empresa_url || "").trim()) {
    return { accept: false, silentDrop: true, reason: "honeypot" };
  }

  // 2. Timing. Only enforced when the form supplied a token, so API clients and
  //    integrations that post directly are unaffected.
  if (body.formToken !== undefined) {
    const tokenProblem = checkFormToken(body.formToken);
    if (tokenProblem) return { accept: false, silentDrop: true, reason: `token_${tokenProblem}` };
  }

  // 3. Per-sender cap — isolates abuse to whoever is causing it.
  const contact = String(body.contact || "").trim().toLowerCase();
  if (contact && !bumpCounter(submitsByContact, contact, PUBLIC_SUBMIT_PER_CONTACT)) {
    return { accept: false, silentDrop: false, reason: "contact_limit" };
  }

  // 4. Process-protection ceiling.
  if (!bumpCounter(submitsByIp, getClientIp(req), PUBLIC_SUBMIT_IP_CEILING)) {
    console.warn(`[NeuroDesk] Techo de envíos alcanzado desde ${getClientIp(req)} — posible flood.`);
    return { accept: false, silentDrop: false, reason: "ip_ceiling" };
  }

  return { accept: true };
}
const SESSION_COOKIE_MAX_AGE = 86400;

// ── Password hashing ─────────────────────────────────────────────────────────
// Stored hashes carry an algorithm prefix. Legacy records are bare SHA-256 hex
// with no prefix; they keep working and are silently upgraded to scrypt the next
// time that user signs in, so nobody has to reset anything.
const SCRYPT_PREFIX = "scrypt$";
const SCRYPT_KEYLEN = 64;
const MIN_PASSWORD_LENGTH = 12;

function legacyHashPassword(password, salt) {
  return crypto.createHash("sha256").update(salt + password).digest("hex");
}

function hashPassword(password, salt) {
  return SCRYPT_PREFIX + crypto.scryptSync(String(password), salt, SCRYPT_KEYLEN).toString("hex");
}

// Constant-time comparison so the response time can't leak how much matched.
function safeEqual(a, b) {
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

function verifyPassword(password, user) {
  if (!user || !user.password_hash) return { ok: false, needsUpgrade: false };
  if (String(user.password_hash).startsWith(SCRYPT_PREFIX)) {
    return { ok: safeEqual(hashPassword(password, user.salt), user.password_hash), needsUpgrade: false };
  }
  const ok = safeEqual(legacyHashPassword(password, user.salt), user.password_hash);
  return { ok, needsUpgrade: ok };
}

// Re-hash a legacy record with scrypt, keeping the same password.
function upgradePasswordHash(username, password) {
  try {
    const salt = crypto.randomBytes(16).toString("hex");
    updatePasswordStmt.run(hashPassword(password, salt), salt, username);
    console.log(`[NeuroDesk] Hash de contraseña migrado a scrypt para "${username}".`);
  } catch (err) {
    console.error("[NeuroDesk] No se pudo migrar el hash de contraseña:", err.message);
  }
}

function passwordPolicyError(password) {
  if (String(password).length < MIN_PASSWORD_LENGTH) {
    return `La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.`;
  }
  return null;
}

function createSession(username) {
  pruneSessions();
  const token = crypto.randomBytes(32).toString("hex");
  store.sessions.push({ token, username, expiresAt: Date.now() + SESSION_MAX_AGE_MS });
  saveStore();
  return token;
}

function getSession(token) {
  if (!token) return null;
  const session = store.sessions.find((s) => s.token === token);
  if (!session) return null;
  if (Date.now() > session.expiresAt) {
    store.sessions = store.sessions.filter((s) => s.token !== token);
    saveStore();
    return null;
  }
  return session;
}

function deleteSession(token) {
  store.sessions = store.sessions.filter((s) => s.token !== token);
  saveStore();
}

// Drop every session belonging to a user, optionally sparing the one making the
// request. Used after a password change so a stolen session can't outlive it.
function revokeUserSessions(username, keepToken = null) {
  const before = store.sessions.length;
  store.sessions = store.sessions.filter(
    (s) => s.username !== username || (keepToken && s.token === keepToken)
  );
  if (store.sessions.length !== before) saveStore();
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

// ── API keys (Bearer tokens for the public /api/v1 surface) ──────────────────

const API_SCOPES = ["tickets:read", "tickets:write", "stats:read"];
const API_RATE_LIMIT = 120; // requests per minute per key
const apiRateBuckets = new Map(); // keyId -> { count, resetAt }

function hashApiToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function createApiKey(label, scopes) {
  const raw = `nd_live_${crypto.randomBytes(24).toString("hex")}`;
  const entry = {
    id: crypto.randomUUID(),
    label: String(label || "Sin nombre").trim().slice(0, 60) || "Sin nombre",
    hash: hashApiToken(raw),
    prefix: raw.slice(0, 16),
    scopes: (Array.isArray(scopes) ? scopes : []).filter((s) => API_SCOPES.includes(s)),
    createdAt: new Date().toISOString(),
    lastUsedAt: null,
    revokedAt: null,
  };
  if (entry.scopes.length === 0) entry.scopes = ["tickets:read"];
  store.apiKeys.push(entry);
  saveStore();
  // raw token is returned once and never stored in clear
  return { ...publicApiKey(entry), token: raw };
}

function publicApiKey(entry) {
  return {
    id: entry.id,
    label: entry.label,
    prefix: entry.prefix,
    scopes: entry.scopes,
    createdAt: entry.createdAt,
    lastUsedAt: entry.lastUsedAt,
    revoked: !!entry.revokedAt,
  };
}

function revokeApiKey(id) {
  const entry = store.apiKeys.find((k) => k.id === id);
  if (!entry || entry.revokedAt) return false;
  entry.revokedAt = new Date().toISOString();
  saveStore();
  return true;
}

// Resolves an Authorization: Bearer <token> header to an active key entry.
function getApiKeyFromRequest(req) {
  const header = String(req.headers.authorization || "");
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) return null;
  const hash = hashApiToken(match[1].trim());
  const entry = store.apiKeys.find((k) => k.hash === hash && !k.revokedAt);
  if (!entry) return null;
  // touch lastUsedAt at most once per minute to avoid a disk write per request
  const now = Date.now();
  const last = entry.lastUsedAt ? new Date(entry.lastUsedAt).getTime() : 0;
  if (now - last > 60000) {
    entry.lastUsedAt = new Date(now).toISOString();
    saveStore();
  }
  return entry;
}

function checkApiRateLimit(keyId) {
  const now = Date.now();
  let bucket = apiRateBuckets.get(keyId);
  if (!bucket || now > bucket.resetAt) bucket = { count: 0, resetAt: now + 60000 };
  bucket.count += 1;
  apiRateBuckets.set(keyId, bucket);
  return {
    allowed: bucket.count <= API_RATE_LIMIT,
    remaining: Math.max(API_RATE_LIMIT - bucket.count, 0),
    resetAt: bucket.resetAt,
  };
}

function sendApiError(res, status, code, message, extraHeaders = {}) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", ...extraHeaders });
  res.end(JSON.stringify({ error: { code, message } }));
}

// ── Webhooks ─────────────────────────────────────────────────────────────────

const WEBHOOK_EVENTS = [
  "ticket.created",
  "ticket.updated",
  "ticket.resolved",
  "ticket.reopened",
  "ticket.sla_breached",
];

// Webhook URLs are user-supplied, so a delivery is a request the server makes on
// someone else's behalf. Without this check a panel user could point one at
// 127.0.0.1 or the cloud metadata endpoint and use the recorded status code as
// an oracle to map the internal network.
const BLOCKED_HOST_PATTERNS = [
  /^localhost$/i,
  /^127\./,
  /^0\./,
  /^10\./,
  /^192\.168\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^169\.254\./,          // link-local, includes cloud metadata at 169.254.169.254
  /^::1$/,
  /^\[?::1\]?$/,
  /^f[cd][0-9a-f]{2}:/i,  // IPv6 unique local
  /^fe80:/i,              // IPv6 link-local
  /\.internal$/i,
  /\.local$/i,
];

function validateWebhookUrl(raw) {
  let parsed;
  try { parsed = new URL(String(raw)); } catch { return { ok: false, error: "URL inválida." }; }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    return { ok: false, error: "Sólo se permiten URLs http:// o https://." };
  }
  const host = parsed.hostname.replace(/^\[|\]$/g, "");
  if (BLOCKED_HOST_PATTERNS.some((re) => re.test(host))) {
    return { ok: false, error: "No se permiten destinos internos ni direcciones privadas." };
  }
  return { ok: true, url: parsed };
}

function publicWebhook(w) {
  return {
    id: w.id,
    url: w.url,
    events: w.events,
    enabled: w.enabled !== false,
    createdAt: w.createdAt,
    lastDeliveryAt: w.lastDeliveryAt || null,
    lastStatus: w.lastStatus || null,
    failCount: w.failCount || 0,
    secretPrefix: String(w.secret || "").slice(0, 8),
  };
}

function deliverWebhook(hook, event, payload) {
  const body = JSON.stringify({ event, deliveredAt: new Date().toISOString(), data: payload });
  const signature = crypto.createHmac("sha256", hook.secret).update(body).digest("hex");
  // Re-checked at delivery time, not only at registration: a hostname that was
  // public when the webhook was created could later resolve somewhere internal.
  const check = validateWebhookUrl(hook.url);
  if (!check.ok) {
    console.error(`[NeuroDesk] Webhook ${hook.id} descartado — destino no permitido: ${hook.url}`);
    return;
  }
  const target = check.url;
  const client = target.protocol === "https:" ? https : http;
  const attempt = (tryNum) => {
    const request = client.request(
      {
        hostname: target.hostname,
        port: target.port || (target.protocol === "https:" ? 443 : 80),
        path: `${target.pathname}${target.search}`,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(body),
          "User-Agent": `NeuroDesk/${packageInfo.version}`,
          "X-NeuroDesk-Event": event,
          "X-NeuroDesk-Signature": `sha256=${signature}`,
        },
      },
      (response) => {
        response.resume();
        hook.lastDeliveryAt = new Date().toISOString();
        hook.lastStatus = response.statusCode;
        if (response.statusCode >= 200 && response.statusCode < 300) {
          hook.failCount = 0;
        } else if (tryNum < 3) {
          setTimeout(() => attempt(tryNum + 1), 2000 * tryNum);
          return;
        } else {
          hook.failCount = (hook.failCount || 0) + 1;
        }
        saveStore();
      }
    );
    request.on("error", () => {
      if (tryNum < 3) { setTimeout(() => attempt(tryNum + 1), 2000 * tryNum); return; }
      hook.lastDeliveryAt = new Date().toISOString();
      hook.lastStatus = 0;
      hook.failCount = (hook.failCount || 0) + 1;
      saveStore();
    });
    request.setTimeout(10000, () => request.destroy());
    request.write(body);
    request.end();
  };
  attempt(1);
}

// Fire-and-forget: never blocks or throws into the caller's path.
function emitWebhook(event, payload) {
  try {
    const hooks = store.webhooks.filter((w) => w.enabled !== false && (w.events || []).includes(event));
    for (const hook of hooks) deliverWebhook(hook, event, payload);
  } catch (err) {
    console.error("[NeuroDesk] webhook emit error:", err.message);
  }
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
  aiConfig: { apiKey: "" },
  timezone: "America/Bogota",
  businessHours: {
    enabled: true,
    schedule: {
      "0": { enabled: false, start: "07:00", end: "17:00" },
      "1": { enabled: true,  start: "07:00", end: "17:00" },
      "2": { enabled: true,  start: "07:00", end: "17:00" },
      "3": { enabled: true,  start: "07:00", end: "17:00" },
      "4": { enabled: true,  start: "07:00", end: "17:00" },
      "5": { enabled: true,  start: "07:00", end: "17:00" },
      "6": { enabled: false, start: "07:00", end: "17:00" },
    },
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

// Base URL for links we email out. Prefers the configured app_url; the Host
// header is only a last resort because a client can set it to anything.
function getAppBaseUrl(req) {
  const configured = String(notificationsConfig.app_url || "").trim().replace(/\/+$/, "");
  if (configured) return configured;
  const proto = isSecureRequest(req) ? "https" : "http";
  return `${proto}://${req.headers.host || "localhost"}`;
}

// True when the browser reached us over HTTPS. Behind LiteSpeed the TLS
// termination happens upstream, so the only signal is the forwarded header.
function isSecureRequest(req) {
  const proto = String(req.headers["x-forwarded-proto"] || "").split(",")[0].trim();
  if (proto) return proto === "https";
  return !!req.socket.encrypted;
}

// Applied to every response. The app loads no third-party resources, so the
// policy can be tight. 'unsafe-inline' is still required because index.html,
// login.html and portal.html carry inline <script> blocks and the markup uses
// inline style attributes throughout; removing it would need nonces on every
// inline block. connect-src 'self' is the valuable part: even if markup were
// injected, it could not phone home.
function applySecurityHeaders(req, res) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "same-origin");
  res.setHeader("Permissions-Policy", "geolocation=(), microphone=(), camera=(), payment=()");
  res.setHeader(
    "Content-Security-Policy",
    [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline'",
      // https: keeps images in forwarded emails working; http: stays blocked.
      "img-src 'self' data: https:",
      "font-src 'self' data:",
      "connect-src 'self'",
      "form-action 'self'",
      "base-uri 'self'",
      "object-src 'none'",
      "frame-ancestors 'none'",
    ].join("; ")
  );
  if (isSecureRequest(req)) {
    res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }
}

function sendStatic(req, res) {
  // Strip the query string — cache-busters like /app.js?v=14.33 must still
  // resolve to app.js on disk. (In production LiteSpeed serves static assets
  // before Node sees them, which is why this only shows up without a proxy.)
  const urlPath = req.url.split("?")[0].split("#")[0];
  const requestedPath = urlPath === "/" || urlPath === "" ? "/index.html" : urlPath;
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
  const defaultSchedule = { "0":{enabled:false,start:"07:00",end:"17:00"},"1":{enabled:true,start:"07:00",end:"17:00"},"2":{enabled:true,start:"07:00",end:"17:00"},"3":{enabled:true,start:"07:00",end:"17:00"},"4":{enabled:true,start:"07:00",end:"17:00"},"5":{enabled:true,start:"07:00",end:"17:00"},"6":{enabled:false,start:"07:00",end:"17:00"} };
  const inSched = bh.schedule && typeof bh.schedule === 'object' ? bh.schedule : {};
  // backward compat: if old format (has bh.days array), convert it
  const oldDays = Array.isArray(bh.days) ? new Set(bh.days.map(Number)) : null;
  const oldStart = /^\d{2}:\d{2}$/.test(bh.start) ? bh.start : "07:00";
  const oldEnd = /^\d{2}:\d{2}$/.test(bh.end) ? bh.end : "17:00";
  const validatedSchedule = {};
  for (let d = 0; d <= 6; d++) {
    const key = String(d);
    const src = inSched[key] || {};
    const dayEnabled = oldDays ? oldDays.has(d) : (src.enabled === true || src.enabled === "true");
    const dayStart = /^\d{2}:\d{2}$/.test(src.start) ? src.start : (oldDays ? oldStart : "07:00");
    const dayEnd = /^\d{2}:\d{2}$/.test(src.end) ? src.end : (oldDays ? oldEnd : "17:00");
    validatedSchedule[key] = { enabled: dayEnabled, start: dayStart, end: dayEnd };
  }
  const validatedBh = {
    enabled: bh.enabled === true || bh.enabled === "true",
    schedule: validatedSchedule,
  };

  // aiConfig is NEVER touched by saveConfig — it has its own dedicated endpoint
  const validatedAi = { apiKey: appConfig.aiConfig?.apiKey || "" };

  // Validate IANA timezone string — must be accepted by Intl.DateTimeFormat
  let validatedTimezone = appConfig.timezone || DEFAULT_CONFIG.timezone;
  if (incoming.timezone) {
    const tz = String(incoming.timezone).trim();
    try { new Intl.DateTimeFormat("en-US", { timeZone: tz }); validatedTimezone = tz; } catch { /* keep current */ }
  }

  appConfig = { sla: validatedSla, fields: validatedFields, customFields: validatedCustomFields, aiConfig: validatedAi, timezone: validatedTimezone, businessHours: validatedBh };
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
  // No fixed fallback password. Shipping one meant every install that didn't
  // set ND_PASS was reachable with credentials published in the source.
  const generated = !process.env.ND_PASS;
  const password = process.env.ND_PASS || crypto.randomBytes(12).toString("base64url");
  const salt = crypto.randomBytes(16).toString("hex");
  insertUserStmt.run(username, hashPassword(password, salt), salt);
  console.log("─".repeat(64));
  console.log(`Credenciales iniciales → usuario: ${username}  contraseña: ${password}`);
  if (generated) {
    console.log("Contraseña generada al azar. Anótala ahora: no se vuelve a mostrar.");
    console.log("Para fijarla tú, define ND_PASS antes del primer arranque.");
  }
  console.log("─".repeat(64));
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
  emitWebhook("ticket.created", serializeTicket(ticket));
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

// Hydrate a single ticket. Callers used to build the whole list just to find one.
function getTicketById(id) {
  const raw = store.tickets.find((t) => t.id === id);
  if (!raw) return undefined;
  let customFields = {};
  try { customFields = raw.customFields ? JSON.parse(raw.customFields) : {}; } catch (_) {}
  let attachments = [];
  try { attachments = raw.attachments ? JSON.parse(raw.attachments) : []; } catch (_) {}
  return { ...raw, customFields, attachments, history: getTicketHistory(raw.id) };
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
  const ticket = getTicketById(id);
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
  // Coalesce the 3-5 store writes this function performs into a single flush.
  return withBatchedSave(() => updateTicketFullInner(id, {
    name, contact, area, urgency, status, subject, description,
    resolution, resolutionNote, assignedTo, workedHours, customFields, silent: data.silent,
  }));
}

function updateTicketFullInner(id, data) {
  const {
    name, contact, area, urgency, status, subject, description,
    resolution, resolutionNote, assignedTo, workedHours, customFields,
  } = data;
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
      if (updatedRaw.reopenedByClient) { updatedRaw.reopenedByClient = false; }
      saveStore();
    } else if (status !== "resuelto" && status !== "cerrado" && updatedRaw.resolvedAt) {
      updatedRaw.resolvedAt = null;
      saveStore();
    }
    // Clear reopened flag when agent moves ticket to en_proceso or any active handling state
    if (updatedRaw.reopenedByClient && status === "en_proceso") {
      updatedRaw.reopenedByClient = false;
      saveStore();
    }
  }
  if (resolutionNote) addTicketHistory(id, resolutionNote, status);
  notifyClients("ticketsChanged", { action: "updated", id });
  const ticket = getTicketById(id);
  if (ticket) {
    emitWebhook("ticket.updated", serializeTicket(ticket));
    if (oldStatus !== status && (status === "resuelto" || status === "cerrado")) {
      emitWebhook("ticket.resolved", serializeTicket(ticket));
    }
  }
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
      if (rawTicket.reopenedByClient) { rawTicket.reopenedByClient = false; }
      saveStore();
    } else if (status !== "resuelto" && status !== "cerrado" && rawTicket.resolvedAt) {
      rawTicket.resolvedAt = null;
      saveStore();
    }
    if (rawTicket.reopenedByClient && status !== "abierto") {
      rawTicket.reopenedByClient = false;
      saveStore();
    }
  }
  notifyClients("ticketsChanged", { action: "position", id });
  const ticket = getTicketById(id);
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

// Returns { dow, hours, minutes } for the current moment in the configured timezone.
// Uses Intl.DateTimeFormat — works in any Node.js environment regardless of process.env.TZ.
function getTzFormatter(tz) {
  const key = tz || "America/Bogota";
  let fmt = tzFormatterCache.get(key);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat("en-US", {
      timeZone: key,
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    tzFormatterCache.set(key, fmt);
  }
  return fmt;
}

// Offset (ms) between UTC and the given timezone at a given instant. Cached per
// (timezone, day) because it only changes at DST boundaries.
function getTzOffsetMs(tz, atMs) {
  const key = `${tz}|${Math.floor(atMs / 86400000)}`;
  let offset = tzOffsetCache.get(key);
  if (offset !== undefined) return offset;
  try {
    // 'sv' locale yields an ISO-like "YYYY-MM-DD HH:mm:ss" that Date can parse as UTC.
    const local = new Date(new Date(atMs).toLocaleString("sv", { timeZone: tz }) + "Z");
    offset = local.getTime() - Math.floor(atMs / 1000) * 1000;
  } catch {
    offset = 0;
  }
  if (tzOffsetCache.size > 5000) tzOffsetCache.clear();
  tzOffsetCache.set(key, offset);
  return offset;
}

function getNowInTz(tz) {
  try {
    const now = new Date();
    const parts = getTzFormatter(tz).formatToParts(now);
    const get = (type) => parts.find((p) => p.type === type)?.value || "";
    const dow = DOW_MAP[get("weekday")] ?? now.getDay();
    let hours = parseInt(get("hour"), 10);
    if (hours === 24) hours = 0; // some impls return 24 for midnight
    const minutes = parseInt(get("minute"), 10) || 0;
    return { dow, hours, minutes };
  } catch {
    const now = new Date();
    return { dow: now.getDay(), hours: now.getHours(), minutes: now.getMinutes() };
  }
}

// Returns true if the current moment is inside business hours.
function isInsideBusinessHours(bh) {
  if (!bh || !bh.enabled) return true; // no BH config = always running
  const tz = appConfig.timezone || "America/Bogota";
  const { dow, hours, minutes } = getNowInTz(tz);
  const sched = bh.schedule || {};
  const day = sched[String(dow)];
  if (!day || !day.enabled) return false;
  const [sh, sm] = String(day.start || "00:00").split(":").map(Number);
  const [eh, em] = String(day.end || "00:00").split(":").map(Number);
  const nowMins = hours * 60 + minutes;
  const startMins = (sh || 0) * 60 + (sm || 0);
  const endMins = (eh || 0) * 60 + (em || 0);
  return nowMins >= startMins && nowMins < endMins;
}

// Returns how many milliseconds of "business time" elapsed between fromMs and toMs.
// Non-business hours and non-working days are excluded from the count.
function calcBusinessMs(fromMs, toMs, bh) {
  if (!bh || !bh.enabled || fromMs >= toMs) return Math.max(toMs - fromMs, 0);
  const parseTime = (t) => {
    const [h, m] = String(t || "00:00").split(":").map(Number);
    return ((h || 0) * 60 + (m || 0)) * 60000;
  };
  const tz = appConfig.timezone || "America/Bogota";
  const sched = bh.schedule || {};

  // Precompute each weekday's window once — start/end are constants, so parsing
  // them inside the loop was pure waste.
  const dayWindows = [];
  for (let d = 0; d <= 6; d++) {
    const day = sched[String(d)];
    if (!day || !day.enabled) { dayWindows.push(null); continue; }
    const start = parseTime(day.start);
    const end = parseTime(day.end);
    dayWindows.push(end > start ? { start, end } : null);
  }
  if (dayWindows.every((w) => w === null)) return 0;

  // Walking day by day with Intl per iteration cost ~106µs each and dominated
  // the whole request. Resolve the UTC offset once and use plain arithmetic.
  const offsetStart = getTzOffsetMs(tz, fromMs);
  const offsetEnd = getTzOffsetMs(tz, toMs);
  const dstShift = offsetStart !== offsetEnd;

  let total = 0;
  // Local midnight of the day containing fromMs, expressed as a UTC timestamp.
  let cursor = Math.floor((fromMs + offsetStart) / 86400000) * 86400000 - offsetStart;

  while (cursor < toMs) {
    // Only pay for a per-day offset lookup when the range crosses a DST change
    // (Colombia has none, but the code must stay correct for zones that do).
    const offset = dstShift ? getTzOffsetMs(tz, cursor) : offsetStart;
    const dow = new Date(cursor + offset).getUTCDay();
    const win = dayWindows[dow];
    if (win) {
      const overlapStart = Math.max(cursor + win.start, fromMs);
      const overlapEnd = Math.min(cursor + win.end, toMs);
      if (overlapEnd > overlapStart) total += overlapEnd - overlapStart;
    }
    cursor += 86400000;
  }
  return total;
}

// A finished ticket's SLA can no longer change, so it is computed once and
// cached in-process. Keyed by the inputs that could alter the result, so any
// edit (status, urgency, config, reopen) produces a different key and recomputes.
const finishedSlaCache = new Map();

function finishedSlaCacheKey(ticket, bh) {
  return [
    ticket.id, ticket.status, ticket.urgency, ticket.createdAt, ticket.resolvedAt,
    ticket.slaBusinessPausedMs || 0, ticket.slaPausedMs || 0,
    appConfig.sla[ticket.urgency] || 8, bh && bh.enabled ? 1 : 0, appConfig.timezone,
  ].join("|");
}

function getSlaState(ticket) {
  const status = ticket.status;
  const isFinished = status === "resuelto" || status === "cerrado";
  const isPaused = status === "en_espera";
  const createdMs = new Date(ticket.createdAt).getTime();
  const bh = appConfig.businessHours;

  let cacheKey = null;
  if (isFinished) {
    cacheKey = finishedSlaCacheKey(ticket, bh);
    const cached = finishedSlaCache.get(cacheKey);
    if (cached) return cached;
  }

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
  const bhEnabled = !!(bh && bh.enabled);
  const outsideBusinessHours = bhEnabled && !isFinished && !isPaused && !isInsideBusinessHours(bh);
  const state = {
    limitHours,
    remainingHours: Number(Math.max(limitHours - elapsedHours, 0).toFixed(1)),
    elapsedHours: Number(elapsedHours.toFixed(1)),
    breached: elapsedHours > limitHours,
    paused: isPaused,
    finished: isFinished,
    businessHours: bhEnabled,
    outsideBusinessHours,
  };
  if (cacheKey) {
    if (finishedSlaCache.size > 20000) finishedSlaCache.clear();
    finishedSlaCache.set(cacheKey, state);
  }
  return state;
}

function getStats() {
  const tickets = getTickets();
  const byStatus = ticketStatuses.reduce((s, st) => { s[st] = 0; return s; }, {});
  const byUrgency = Object.keys(appConfig.sla).reduce((s, u) => { s[u] = 0; return s; }, {});

  // Single pass: the previous version walked the list four times and computed
  // getSlaState twice per active ticket.
  let activeCount = 0;
  let breachedCount = 0;
  let remainingSum = 0;
  for (const ticket of tickets) {
    if (byStatus[ticket.status] !== undefined) byStatus[ticket.status] += 1;
    if (byUrgency[ticket.urgency] !== undefined) byUrgency[ticket.urgency] += 1;
    if (ticket.status === "resuelto" || ticket.status === "cerrado") continue;
    activeCount += 1;
    const sla = getSlaState(ticket);
    if (sla.breached) breachedCount += 1;
    remainingSum += sla.remainingHours;
  }

  return {
    total: tickets.length,
    open: activeCount,
    breached: breachedCount,
    byStatus,
    byUrgency,
    avgRemainingHours: activeCount === 0 ? 0 : Number((remainingSum / activeCount).toFixed(1)),
    slaCompliance:
      activeCount === 0
        ? 100
        : Math.round(((activeCount - breachedCount) / activeCount) * 100),
  };
}

// ── AI (Anthropic Claude Haiku) ───────────────────────────────────────────────

function anthropicRequest(messages, systemPrompt, maxTokens = 512) {
  const apiKey = process.env.ANTHROPIC_API_KEY || appConfig.aiConfig?.apiKey || "";
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

urgency — reglas estrictas:
- "critica": sistema caído, pérdida de datos, acceso bloqueado para todos, incidente de seguridad, impacta operación crítica inmediatamente
- "alta": funcionalidad importante no funciona, afecta a varios usuarios, bloquea trabajo parcialmente, errores que impiden procesar transacciones
- "media": problema funcional que tiene alternativa, demora o fallo intermitente, un usuario afectado con workaround posible
- "baja": solicitud cosmética, cambio de preferencia, pregunta de cómo hacer algo, actualizar datos menores (firma de correo, cambio de nombre, ajuste de perfil, consulta de procedimiento, solicitud de acceso no urgente)

IMPORTANTE: si la solicitud NO bloquea trabajo ni afecta operaciones, es "baja" por defecto. Firma de correo, cambio de logo, preguntas de uso, solicitudes de licencias de software no crítico → siempre "baja".

category: categoría corta en español (máx 25 chars). Ejemplos: "Facturación","Acceso","Error técnico","Consulta","Instalación","Rendimiento","Configuración","Solicitud"
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

async function aiSuggestReply(ticket, draft) {
  const urgencyLabel = { baja: "Baja", media: "Media", alta: "Alta", critica: "Crítica" }[ticket.urgency] || ticket.urgency || "Media";
  // Collect past agent responses to infer writing style
  const agentReplies = (ticket.history || [])
    .filter((h) => h.status === "respuesta" || h.status === "nota")
    .slice(-3)
    .map((h) => h.note)
    .join("\n---\n");
  const history = (ticket.history || [])
    .slice(-4)
    .map((h) => `[${h.status || "nota"}] ${h.note}`)
    .join("\n");

  if (draft && draft.trim()) {
    // Co-pilot mode: polish the agent's draft, keep their style and intent
    const system = `Eres un corrector de estilo para el equipo de soporte de Neurofic.
Tienes UN borrador escrito por el agente. Mejóralo sin cambiar su intención ni agregar información que no está en el ticket.

Reglas:
- Mantén el tono y estilo del agente (no lo formalices en exceso)
- Corrige ortografía y gramática
- No inventes datos, pasos técnicos ni fechas que no estén en el texto
- No alargas el mensaje — si está bien, lo devuelves casi igual
- Firma con "Equipo de soporte · Neurofic" si no tiene firma
- Solo texto plano, sin markdown`;
    const content = `Ticket ${ticket.id} | Prioridad: ${urgencyLabel}
Asunto: ${ticket.subject || "(sin asunto)"}
Descripción: ${String(ticket.description || "").slice(0, 400)}

BORRADOR DEL AGENTE:
${draft.trim()}`;
    return await anthropicRequest([{ role: "user", content }], system, 350);
  }

  // Generate mode: short reply based only on ticket info
  const styleHint = agentReplies ? `\n\nEstilo de respuestas previas del agente (copia este tono):\n${agentReplies.slice(0, 400)}` : "";
  const system = `Eres asistente del equipo de soporte de Neurofic. Redacta una respuesta CORTA en español.

Reglas:
- Máximo 2 párrafos breves
- Usa SOLO lo que está escrito en el ticket — no inventes preguntas técnicas, pasos ni detalles
- Si no hay suficiente información para dar una solución, di brevemente que se está revisando el caso y se responderá pronto
- Firma: "Equipo de soporte · Neurofic"
- Sin markdown${styleHint}`;
  const content = `Ticket ${ticket.id} | Cliente: ${ticket.name || "Cliente"} | Prioridad: ${urgencyLabel}
Asunto: ${ticket.subject || "(sin asunto)"}
Descripción: ${String(ticket.description || "").slice(0, 600)}${history ? `\nHistorial reciente:\n${history.slice(0, 400)}` : ""}`;
  return await anthropicRequest([{ role: "user", content }], system, 350);
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
    // Certificates are validated. Skipping validation meant anyone able to
    // intercept the connection could present their own certificate and read
    // the Gmail App Password straight out of the handshake.
    // ND_SMTP_INSECURE_TLS=1 exists only for a self-signed internal relay.
    tls: { rejectUnauthorized: process.env.ND_SMTP_INSECURE_TLS !== "1" },
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
      // Store message ID so future client replies thread back to this ticket
      if (msgId) {
        const raw = store.tickets.find((t) => t.id === ticket.id);
        if (raw && !raw.emailThreadId) { raw.emailThreadId = msgId; saveStore(); }
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

          const recentCutoff = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
          let matchedTicket = null;
          let matchedClosed = null; // cerrado/old ticket — attach as note only, never reopen
          if (ticketIdInSubject) {
            const found = store.tickets.find((t) => t.id.toLowerCase() === ticketIdInSubject.toLowerCase());
            if (found) {
              if (found.status === "cerrado") matchedClosed = found;
              else if (found.status === "resuelto" && found.resolvedAt && found.resolvedAt < recentCutoff) matchedClosed = found;
              else matchedTicket = found;
            }
          }
          if (!matchedTicket && !matchedClosed && (inReplyTo || references)) {
            const threadMatch = store.tickets.find((t) => {
              if (!t.emailThreadId) return false;
              return inReplyTo.includes(t.emailThreadId) || references.includes(t.emailThreadId);
            });
            if (threadMatch) {
              if (threadMatch.status === "cerrado") matchedClosed = threadMatch;
              else if (threadMatch.status === "resuelto" && threadMatch.resolvedAt && threadMatch.resolvedAt < recentCutoff) matchedClosed = threadMatch;
              else matchedTicket = threadMatch;
            }
          }

          // Reply to a permanently closed ticket — attach as note without reopening, no new ticket
          if (matchedClosed && !matchedTicket) {
            addTicketHistory(matchedClosed.id, `Mensaje del cliente (ticket cerrado):\n${bodyText}`, "cerrado");
            saveStore();
            notifyClients("ticketsChanged", { action: "updated", id: matchedClosed.id });
            markEmailProcessedStmt.run(messageId, new Date().toISOString());
            try { await client.messageFlagsAdd(uid, ["\\Seen"]); } catch (_) {}
            console.log(`[NeuroDesk] Nota adjuntada a ticket cerrado ${matchedClosed.id} (${fromEmail}).`);
            continue;
          }

          // NOTE: no "last resort" email-only match — new email from same address = new ticket.

          if (matchedTicket) {
            // This email is a reply to an existing ticket
            const wasFinished = matchedTicket.status === "resuelto";
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
              const reopened = getTicketById(matchedTicket.id);
              if (reopened) {
                emitWebhook("ticket.reopened", serializeTicket(reopened));
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

  // Fire ticket.sla_breached once per ticket, for webhook subscribers.
  function scanSlaBreaches() {
    if (store.webhooks.length === 0) return;
    let dirty = false;
    for (const raw of store.tickets) {
      if (raw.status === "resuelto" || raw.status === "cerrado") continue;
      if (raw.slaBreachNotifiedAt) continue;
      const full = getTicketById(raw.id);
      if (!full || !getSlaState(full).breached) continue;
      raw.slaBreachNotifiedAt = new Date().toISOString();
      dirty = true;
      emitWebhook("ticket.sla_breached", serializeTicket(full));
    }
    if (dirty) saveStore();
  }
  setInterval(scanSlaBreaches, 5 * 60 * 1000);
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
      const check = verifyPassword(password, user);
      if (!check.ok) {
        sendJson(res, 401, { error: "Usuario o contraseña incorrectos." });
        return;
      }
      // Transparent upgrade: legacy SHA-256 records become scrypt on first login.
      if (check.needsUpgrade) upgradePasswordHash(username, password);
      resetLoginRateLimit(ip);
      const token = createSession(username);
      res.writeHead(200, {
        "Content-Type": "application/json; charset=utf-8",
        // Secure only when the browser actually spoke HTTPS — otherwise local
        // HTTP development could never hold a session.
        "Set-Cookie": `nd_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${SESSION_COOKIE_MAX_AGE}${isSecureRequest(req) ? "; Secure" : ""}`,
      });
      res.end(JSON.stringify({ username }));
    } catch {
      sendJson(res, 400, { error: "No se pudo leer la solicitud." });
    }
    return;
  }

  if (req.method === "POST" && req.url === "/api/auth/logout") {
    const cookies = parseCookies(req);
    if (cookies.nd_session) deleteSession(cookies.nd_session);
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
      const policyError = passwordPolicyError(newPass);
      if (policyError) {
        sendJson(res, 400, { error: policyError });
        return;
      }
      const user = getUserStmt.get(session.username);
      if (!verifyPassword(current, user).ok) {
        sendJson(res, 401, { error: "Contraseña actual incorrecta." });
        return;
      }
      const newSalt = crypto.randomBytes(16).toString("hex");
      updatePasswordStmt.run(hashPassword(newPass, newSalt), newSalt, session.username);
      // Changing the password must evict anyone else holding a stolen session.
      revokeUserSessions(session.username, parseCookies(req).nd_session);
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
        // Built from configuration, never from the Host header: a poisoned Host
        // would have sent a working reset token to the attacker's domain.
        const resetUrl = `${getAppBaseUrl(req)}/reset-password?token=${token}`;
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

  // Public, minimal config for the portal form — field labels only, no secrets.
  if (req.method === "GET" && req.url === "/api/portal/config") {
    sendJson(res, 200, {
      fields: appConfig.fields,
      customFields: (appConfig.customFields || []).filter((f) => f.enabled),
      // Signed timestamp: proves the form was actually loaded and lets the
      // server tell a human apart from a script that posts instantly.
      formToken: issueFormToken(),
    });
    return;
  }

  if (req.method === "GET" && req.url === "/api/config") {
    // Never expose the Anthropic key here — the panel reads its masked status
    // from GET /api/config/ai instead.
    const { aiConfig: _omit, ...safeConfig } = appConfig;
    sendJson(res, 200, { ...safeConfig, aiConfig: { configured: !!appConfig.aiConfig?.apiKey } });
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
      // Screening applies only to anonymous submissions from the open form.
      if (!getAuthSession(req)) {
        const screen = screenPublicSubmission(req, body);
        if (!screen.accept) {
          console.warn(`[NeuroDesk] Envío público descartado (${screen.reason}).`);
          if (screen.silentDrop) {
            // Look like a success so automation gets no feedback to adapt to.
            sendJson(res, 201, { ok: true });
          } else {
            sendJson(res, 429, { error: "Demasiadas solicitudes. Intenta de nuevo más tarde." });
          }
          return;
        }
      }
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

  // GET /api/config/ai — return masked key status
  // PUT /api/config/ai — dedicated endpoint, only touches apiKey, never the rest of config
  if (req.method === "PUT" && req.url === "/api/config/ai") {
    try {
      const body = await readBody(req);
      const key = typeof body.apiKey === "string" ? body.apiKey.trim() : null;
      if (key === null) { sendJson(res, 400, { error: "apiKey requerida." }); return; }
      if (key === "") {
        // Explicit clear requested
        appConfig.aiConfig = { apiKey: "" };
      } else {
        appConfig.aiConfig = { apiKey: key };
      }
      upsertConfigStmt.run("app_config", JSON.stringify(appConfig));
      const stored = appConfig.aiConfig.apiKey;
      const masked = stored ? stored.slice(0, 7) + "••••••••••••••••" + stored.slice(-4) : "";
      sendJson(res, 200, { ok: true, active: !!stored, masked });
    } catch {
      sendJson(res, 400, { error: "No se pudo guardar la API Key." });
    }
    return;
  }

  if (req.method === "GET" && req.url === "/api/config/ai") {
    const key = appConfig.aiConfig?.apiKey || "";
    const envKey = process.env.ANTHROPIC_API_KEY || "";
    const active = !!(key || envKey);
    const source = envKey ? "env" : key ? "config" : "none";
    const masked = key ? key.slice(0, 7) + "••••••••••••••••" + key.slice(-4) : "";
    sendJson(res, 200, { active, source, masked });
    return;
  }

  // POST /api/tickets/:id/ai-suggest — generate or polish a reply
  if (req.method === "POST" && /^\/api\/tickets\/[^/]+\/ai-suggest$/.test(req.url)) {
    const id = decodeURIComponent(req.url.split("/")[3] || "");
    const ticket = getTicketById(id);
    if (!ticket) { sendJson(res, 404, { error: "Ticket no encontrado." }); return; }
    if (!process.env.ANTHROPIC_API_KEY && !appConfig.aiConfig?.apiKey) {
      sendJson(res, 503, { error: "API key de Anthropic no configurada. Ve a Configuración → IA para agregarla." });
      return;
    }
    const body = await readBody(req);
    const draft = typeof body.draft === "string" ? body.draft : "";
    const suggestion = await aiSuggestReply(ticket, draft);
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
      const replyMsgId = await sendEmail(rawTicket.contact, `Re: ${rawTicket.subject || rawTicket.id}`, message, emailAttachments);
      // Register thread ID so client replies come back to this ticket instead of creating a new one
      let needsSave = false;
      if (replyMsgId && !rawTicket.emailThreadId) { rawTicket.emailThreadId = replyMsgId; needsSave = true; }
      // Agent replied → no longer an unattended reopened case
      if (rawTicket.reopenedByClient) { rawTicket.reopenedByClient = false; needsSave = true; }
      if (needsSave) saveStore();
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
      invalidateHistoryIndex();
      saveStore();
      notifyClients("ticketsChanged", { action: "updated", id });
      sendJson(res, 201, { ok: true });
    } catch (err) {
      sendJson(res, 400, { error: err.message || "No se pudo guardar la nota." });
    }
    return;
  }

  // POST /api/tickets/:id/dismiss-reopened — clear reopenedByClient flag without changing status
  if (req.method === "POST" && /^\/api\/tickets\/[^/]+\/dismiss-reopened$/.test(req.url)) {
    const id = decodeURIComponent(req.url.split("/")[3] || "");
    const raw = store.tickets.find((t) => t.id === id);
    if (!raw) { sendJson(res, 404, { error: "Ticket no encontrado." }); return; }
    raw.reopenedByClient = false;
    saveStore();
    notifyClients("ticketsChanged", { action: "updated", id });
    sendJson(res, 200, { ok: true });
    return;
  }

  // ── API key management (panel only, session-authenticated) ─────────────────
  if (req.method === "GET" && req.url === "/api/apikeys") {
    sendJson(res, 200, {
      keys: store.apiKeys.filter((k) => !k.revokedAt).map(publicApiKey),
      availableScopes: API_SCOPES,
    });
    return;
  }

  if (req.method === "POST" && req.url === "/api/apikeys") {
    try {
      const body = await readBody(req);
      // The plain token is present in this response only — it is never stored.
      sendJson(res, 201, createApiKey(body.label, body.scopes));
    } catch {
      sendJson(res, 400, { error: "No se pudo crear la llave." });
    }
    return;
  }

  if (req.method === "DELETE" && /^\/api\/apikeys\/[^/]+$/.test(req.url)) {
    const id = decodeURIComponent(req.url.split("/")[3] || "");
    if (!revokeApiKey(id)) { sendJson(res, 404, { error: "Llave no encontrada." }); return; }
    sendJson(res, 200, { ok: true });
    return;
  }

  // ── Webhook management (panel only, session-authenticated) ──────────────────
  if (req.method === "GET" && req.url === "/api/webhooks") {
    sendJson(res, 200, {
      webhooks: store.webhooks.map(publicWebhook),
      availableEvents: WEBHOOK_EVENTS,
    });
    return;
  }

  if (req.method === "POST" && req.url === "/api/webhooks") {
    try {
      const body = await readBody(req);
      const target = String(body.url || "").trim();
      const urlCheck = validateWebhookUrl(target);
      if (!urlCheck.ok) { sendJson(res, 400, { error: urlCheck.error }); return; }
      const events = (Array.isArray(body.events) ? body.events : []).filter((e) => WEBHOOK_EVENTS.includes(e));
      if (events.length === 0) { sendJson(res, 400, { error: "Selecciona al menos un evento." }); return; }
      const secret = `whsec_${crypto.randomBytes(20).toString("hex")}`;
      const hook = {
        id: crypto.randomUUID(),
        url: target.slice(0, 500),
        events,
        secret,
        enabled: true,
        createdAt: new Date().toISOString(),
        lastDeliveryAt: null,
        lastStatus: null,
        failCount: 0,
      };
      store.webhooks.push(hook);
      saveStore();
      // Secret shown once so the receiver can verify the HMAC signature.
      sendJson(res, 201, { ...publicWebhook(hook), secret });
    } catch {
      sendJson(res, 400, { error: "No se pudo crear el webhook." });
    }
    return;
  }

  if (req.method === "DELETE" && /^\/api\/webhooks\/[^/]+$/.test(req.url)) {
    const id = decodeURIComponent(req.url.split("/")[3] || "");
    const before = store.webhooks.length;
    store.webhooks = store.webhooks.filter((w) => w.id !== id);
    if (store.webhooks.length === before) { sendJson(res, 404, { error: "Webhook no encontrado." }); return; }
    saveStore();
    sendJson(res, 200, { ok: true });
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
      // This route sets the sender verbatim, so leaving it open let anyone
      // create tickets impersonating any client. It now requires either a
      // shared secret (for an external mail relay) or a normal session.
      const expectedSecret = process.env.ND_INBOUND_SECRET || "";
      const providedSecret = String(req.headers["x-neurodesk-inbound-secret"] || "");
      const authorized = expectedSecret
        ? safeEqual(providedSecret, expectedSecret)
        : !!getAuthSession(req);
      if (!authorized) {
        sendJson(res, 401, {
          error: expectedSecret
            ? "Secreto de entrada inválido."
            : "Ruta no autenticada. Configura ND_INBOUND_SECRET o usa una sesión.",
        });
        return;
      }
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
      const createPolicyError = passwordPolicyError(password);
      if (createPolicyError) {
        sendJson(res, 400, { error: createPolicyError });
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
      // This endpoint used to let ANY authenticated session set ANY user's
      // password without knowing the current one — a one-request account
      // takeover. Resetting someone else's password now requires proving you
      // hold your own.
      const session = getAuthSession(req);
      if (target !== session.username) {
        const actor = getUserStmt.get(session.username);
        if (!verifyPassword(String(body.currentPassword || ""), actor).ok) {
          sendJson(res, 403, {
            error: "Para restablecer la contraseña de otro usuario debes confirmar la tuya.",
          });
          return;
        }
      }
      const newPass = String(body.password || "").trim();
      const policyError = passwordPolicyError(newPass);
      if (policyError) {
        sendJson(res, 400, { error: policyError });
        return;
      }
      if (!getUserStmt.get(target)) {
        sendJson(res, 404, { error: "Usuario no encontrado." });
        return;
      }
      const newSalt = crypto.randomBytes(16).toString("hex");
      updatePasswordStmt.run(hashPassword(newPass, newSalt), newSalt, target);
      revokeUserSessions(target, target === session.username ? parseCookies(req).nd_session : null);
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

// ── Public API v1 ─────────────────────────────────────────────────────────────

function ticketUrl(id) {
  const base = String(notificationsConfig.app_url || "").replace(/\/+$/, "");
  return base ? `${base}/#${id}` : null;
}

function serializeTicket(ticket, { includeHistory = false } = {}) {
  const sla = getSlaState(ticket);
  const out = {
    id: ticket.id,
    subject: ticket.subject || "",
    description: ticket.description || "",
    name: ticket.name,
    contact: ticket.contact || null,
    area: ticket.area,
    urgency: ticket.urgency,
    status: ticket.status,
    source: ticket.source,
    assignedTo: ticket.assignedTo || null,
    resolution: ticket.resolution || "",
    workedHours: ticket.workedHours ?? null,
    customFields: ticket.customFields || {},
    createdAt: ticket.createdAt,
    resolvedAt: ticket.resolvedAt || null,
    reopenedByClient: !!ticket.reopenedByClient,
    aiCategory: ticket.aiCategory || null,
    aiSentiment: ticket.aiSentiment || null,
    sla: {
      limitHours: sla.limitHours,
      elapsedHours: sla.elapsedHours,
      remainingHours: sla.remainingHours,
      breached: sla.breached,
      paused: sla.paused,
      finished: sla.finished,
      outsideBusinessHours: sla.outsideBusinessHours,
    },
    url: ticketUrl(ticket.id),
  };
  if (includeHistory) {
    out.history = (ticket.history || []).map((h) => ({
      note: h.note,
      status: h.status,
      createdAt: h.createdAt,
      isQuickNote: !!h.isQuickNote,
    }));
  }
  return out;
}

const AT_RISK_FRACTION = 0.2; // 20% of the SLA budget left or less

function buildInbox() {
  const tickets = getTickets();
  const active = tickets.filter((t) => t.status !== "resuelto" && t.status !== "cerrado");

  const breached = [];
  const atRisk = [];
  const unassigned = [];
  const reopened = [];
  const waitingOnClient = [];

  for (const ticket of active) {
    const sla = getSlaState(ticket);
    const item = serializeTicket(ticket);
    if (sla.breached) {
      breached.push({ ...item, overdueHours: Number((sla.elapsedHours - sla.limitHours).toFixed(1)) });
    } else if (!sla.paused && sla.remainingHours <= sla.limitHours * AT_RISK_FRACTION) {
      atRisk.push(item);
    }
    if (!ticket.assignedTo) unassigned.push(item);
    if (ticket.reopenedByClient) reopened.push(item);
    if (ticket.status === "en_espera") waitingOnClient.push(item);
  }

  // Most urgent first: overdue the longest, then least time remaining.
  breached.sort((a, b) => b.overdueHours - a.overdueHours);
  atRisk.sort((a, b) => a.sla.remainingHours - b.sla.remainingHours);

  const tz = appConfig.timezone || "America/Bogota";
  return {
    generatedAt: new Date().toISOString(),
    timezone: tz,
    insideBusinessHours: isInsideBusinessHours(appConfig.businessHours),
    summary: {
      breached: breached.length,
      atRisk: atRisk.length,
      unassigned: unassigned.length,
      reopened: reopened.length,
      waitingOnClient: waitingOnClient.length,
      totalActive: active.length,
    },
    buckets: { breached, atRisk, unassigned, reopened, waitingOnClient },
  };
}

function buildOpenApiSpec() {
  const base = String(notificationsConfig.app_url || "").replace(/\/+$/, "");
  const ticketSchema = {
    type: "object",
    properties: {
      id: { type: "string", example: "ND-1075" },
      subject: { type: "string" },
      description: { type: "string" },
      name: { type: "string" },
      contact: { type: "string", nullable: true },
      area: { type: "string" },
      urgency: { type: "string", enum: ["baja", "media", "alta", "critica"] },
      status: { type: "string", enum: ticketStatuses },
      source: { type: "string" },
      assignedTo: { type: "string", nullable: true },
      createdAt: { type: "string", format: "date-time" },
      resolvedAt: { type: "string", format: "date-time", nullable: true },
      reopenedByClient: { type: "boolean" },
      sla: {
        type: "object",
        properties: {
          limitHours: { type: "number" },
          elapsedHours: { type: "number" },
          remainingHours: { type: "number" },
          breached: { type: "boolean" },
          paused: { type: "boolean" },
          finished: { type: "boolean" },
          outsideBusinessHours: { type: "boolean" },
        },
      },
      url: { type: "string", nullable: true },
    },
  };
  return {
    openapi: "3.1.0",
    info: {
      title: "NeuroDesk API",
      version: packageInfo.version,
      description:
        "API de la mesa de soporte NeuroDesk. Autenticación con token Bearer. " +
        "Usa GET /api/v1/inbox para obtener el trabajo pendiente ya priorizado.",
    },
    servers: [{ url: base || "https://soporte.easystem.co" }],
    security: [{ bearerAuth: [] }],
    components: {
      securitySchemes: { bearerAuth: { type: "http", scheme: "bearer" } },
      schemas: { Ticket: ticketSchema },
    },
    paths: {
      "/api/v1/me": {
        get: {
          summary: "Verificar el token y ver sus permisos",
          operationId: "getMe",
          responses: { 200: { description: "Información del token" } },
        },
      },
      "/api/v1/inbox": {
        get: {
          summary: "Trabajo pendiente priorizado (SLA vencido, en riesgo, sin asignar, reabiertos)",
          operationId: "getInbox",
          responses: { 200: { description: "Bandeja priorizada" } },
        },
      },
      "/api/v1/tickets": {
        get: {
          summary: "Listar tickets con filtros",
          operationId: "listTickets",
          parameters: [
            { name: "status", in: "query", schema: { type: "string", enum: ticketStatuses } },
            { name: "urgency", in: "query", schema: { type: "string", enum: ["baja", "media", "alta", "critica"] } },
            { name: "area", in: "query", schema: { type: "string" } },
            { name: "assignedTo", in: "query", schema: { type: "string" } },
            { name: "contact", in: "query", schema: { type: "string" } },
            { name: "active", in: "query", schema: { type: "boolean" }, description: "true = excluye resueltos y cerrados" },
            { name: "slaBreached", in: "query", schema: { type: "boolean" } },
            { name: "updatedSince", in: "query", schema: { type: "string", format: "date-time" } },
            { name: "limit", in: "query", schema: { type: "integer", default: 25, maximum: 100 } },
            { name: "cursor", in: "query", schema: { type: "string" } },
          ],
          responses: { 200: { description: "Lista paginada de tickets" } },
        },
        post: {
          summary: "Crear un ticket",
          operationId: "createTicket",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["name", "urgency"],
                  properties: {
                    name: { type: "string" },
                    urgency: { type: "string", enum: ["baja", "media", "alta", "critica"] },
                    subject: { type: "string" },
                    description: { type: "string" },
                    contact: { type: "string" },
                    area: { type: "string" },
                    assignedTo: { type: "string" },
                  },
                },
              },
            },
          },
          responses: { 201: { description: "Ticket creado" } },
        },
      },
      "/api/v1/tickets/{id}": {
        get: {
          summary: "Obtener un ticket con su historial",
          operationId: "getTicket",
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
          responses: { 200: { description: "Ticket", content: { "application/json": { schema: ticketSchema } } } },
        },
        patch: {
          summary: "Actualizar estado, urgencia o asignación",
          operationId: "updateTicket",
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    status: { type: "string", enum: ticketStatuses },
                    urgency: { type: "string", enum: ["baja", "media", "alta", "critica"] },
                    assignedTo: { type: "string" },
                    area: { type: "string" },
                    resolution: { type: "string", description: "Obligatorio al pasar a resuelto o cerrado" },
                    workedHours: { type: "number" },
                  },
                },
              },
            },
          },
          responses: { 200: { description: "Ticket actualizado" } },
        },
      },
      "/api/v1/tickets/{id}/notes": {
        post: {
          summary: "Agregar una nota interna",
          operationId: "addNote",
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { type: "object", required: ["note"], properties: { note: { type: "string" } } },
              },
            },
          },
          responses: { 201: { description: "Nota agregada" } },
        },
      },
      "/api/v1/tickets/{id}/reply": {
        post: {
          summary: "Responder al cliente por correo",
          operationId: "replyToTicket",
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { type: "object", required: ["message"], properties: { message: { type: "string" } } },
              },
            },
          },
          responses: { 200: { description: "Respuesta enviada" } },
        },
      },
      "/api/v1/stats": {
        get: {
          summary: "Métricas y cumplimiento de SLA",
          operationId: "getStats",
          responses: { 200: { description: "Estadísticas" } },
        },
      },
    },
  };
}

async function handleApiV1(req, res) {
  const url = new URL(req.url, "http://localhost");
  const route = url.pathname.replace(/^\/api\/v1/, "") || "/";

  // The spec itself is public so agent platforms can import it before auth.
  if (req.method === "GET" && route === "/openapi.json") {
    sendJson(res, 200, buildOpenApiSpec());
    return;
  }

  const key = getApiKeyFromRequest(req);
  if (!key) {
    sendApiError(res, 401, "unauthorized", "Token ausente o inválido. Usa el header Authorization: Bearer <token>.");
    return;
  }

  const rate = checkApiRateLimit(key.id);
  const rateHeaders = {
    "X-RateLimit-Limit": String(API_RATE_LIMIT),
    "X-RateLimit-Remaining": String(rate.remaining),
    "X-RateLimit-Reset": String(Math.ceil(rate.resetAt / 1000)),
  };
  if (!rate.allowed) {
    sendApiError(res, 429, "rate_limited", `Máximo ${API_RATE_LIMIT} peticiones por minuto.`, rateHeaders);
    return;
  }

  const requireScope = (scope) => {
    if (key.scopes.includes(scope)) return true;
    sendApiError(res, 403, "invalid_scope", `Este token no tiene el permiso ${scope}.`, rateHeaders);
    return false;
  };
  const ok = (status, data) => {
    res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", ...rateHeaders });
    res.end(JSON.stringify(data));
  };

  // GET /api/v1/me
  if (req.method === "GET" && route === "/me") {
    ok(200, {
      keyId: key.id,
      label: key.label,
      prefix: key.prefix,
      scopes: key.scopes,
      rateLimit: { limit: API_RATE_LIMIT, remaining: rate.remaining, resetAt: new Date(rate.resetAt).toISOString() },
      version: packageInfo.version,
      timezone: appConfig.timezone || "America/Bogota",
    });
    return;
  }

  // GET /api/v1/inbox
  if (req.method === "GET" && route === "/inbox") {
    if (!requireScope("tickets:read")) return;
    ok(200, buildInbox());
    return;
  }

  // GET /api/v1/stats
  if (req.method === "GET" && route === "/stats") {
    if (!requireScope("stats:read")) return;
    ok(200, getStats());
    return;
  }

  // GET /api/v1/tickets
  if (req.method === "GET" && route === "/tickets") {
    if (!requireScope("tickets:read")) return;
    const q = url.searchParams;
    let list = getTickets();

    const status = q.get("status");
    if (status) list = list.filter((t) => t.status === status);
    if (q.get("active") === "true") list = list.filter((t) => t.status !== "resuelto" && t.status !== "cerrado");
    const urgency = q.get("urgency");
    if (urgency) list = list.filter((t) => t.urgency === urgency);
    const area = q.get("area");
    if (area) list = list.filter((t) => (t.area || "").toLowerCase() === area.toLowerCase());
    const assignedTo = q.get("assignedTo");
    if (assignedTo) {
      list = assignedTo === "none"
        ? list.filter((t) => !t.assignedTo)
        : list.filter((t) => (t.assignedTo || "").toLowerCase() === assignedTo.toLowerCase());
    }
    const contact = q.get("contact");
    if (contact) list = list.filter((t) => (t.contact || "").toLowerCase() === contact.toLowerCase());
    if (q.get("slaBreached") === "true") list = list.filter((t) => getSlaState(t).breached);
    const since = q.get("updatedSince");
    if (since) {
      const sinceMs = new Date(since).getTime();
      if (isFinite(sinceMs)) {
        list = list.filter((t) => {
          const history = t.history || [];
          const lastTs = history.length ? history[history.length - 1].createdAt : t.createdAt;
          return new Date(lastTs).getTime() >= sinceMs;
        });
      }
    }

    const total = list.length;
    const limit = Math.min(Math.max(parseInt(q.get("limit") || "25", 10) || 25, 1), 100);
    const offset = Math.max(parseInt(q.get("cursor") || "0", 10) || 0, 0);
    const page = list.slice(offset, offset + limit);
    const nextOffset = offset + limit;
    ok(200, {
      data: page.map((t) => serializeTicket(t)),
      pagination: {
        total,
        limit,
        cursor: String(offset),
        nextCursor: nextOffset < total ? String(nextOffset) : null,
      },
    });
    return;
  }

  // POST /api/v1/tickets
  if (req.method === "POST" && route === "/tickets") {
    if (!requireScope("tickets:write")) return;
    let body;
    try { body = await readBody(req); } catch { sendApiError(res, 400, "validation_error", "JSON inválido.", rateHeaders); return; }
    const ticket = normalizeTicket(body, String(body.source || "api").slice(0, 20));
    if (!ticket) {
      sendApiError(res, 400, "validation_error", "Se requiere 'name' y una 'urgency' válida (baja, media, alta, critica).", rateHeaders);
      return;
    }
    insertTicket(ticket);
    // Triage in the background so the response is not delayed.
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
    const created = getTicketById(ticket.id);
    ok(201, serializeTicket(created || ticket));
    return;
  }

  // Routes below operate on a single ticket: /tickets/:id[/notes|/reply]
  const ticketMatch = route.match(/^\/tickets\/([^/]+)(\/notes|\/reply)?$/);
  if (ticketMatch) {
    const id = decodeURIComponent(ticketMatch[1]);
    const sub = ticketMatch[2] || "";
    const raw = store.tickets.find((t) => t.id === id);
    if (!raw) { sendApiError(res, 404, "not_found", `Ticket ${id} no encontrado.`, rateHeaders); return; }

    if (req.method === "GET" && !sub) {
      if (!requireScope("tickets:read")) return;
      const full = getTicketById(id);
      ok(200, serializeTicket(full, { includeHistory: true }));
      return;
    }

    if (req.method === "PATCH" && !sub) {
      if (!requireScope("tickets:write")) return;
      let body;
      try { body = await readBody(req); } catch { sendApiError(res, 400, "validation_error", "JSON inválido.", rateHeaders); return; }
      // Merge onto the current values so callers can send only what changes.
      const merged = {
        name: body.name ?? raw.name,
        contact: body.contact ?? raw.contact,
        area: body.area ?? raw.area,
        urgency: body.urgency ?? raw.urgency,
        status: body.status ?? raw.status,
        subject: body.subject ?? raw.subject,
        description: body.description ?? raw.description,
        resolution: body.resolution ?? raw.resolution,
        resolutionNote: body.resolutionNote || "",
        assignedTo: body.assignedTo ?? raw.assignedTo,
        workedHours: body.workedHours ?? raw.workedHours,
        customFields: body.customFields ?? raw.customFields,
        silent: body.silent === true,
      };
      const updated = updateTicketFull(id, merged);
      if (!updated) {
        sendApiError(res, 400, "validation_error",
          "Datos inválidos. Al pasar a 'resuelto' o 'cerrado' se requiere 'resolution' o 'resolutionNote'.", rateHeaders);
        return;
      }
      ok(200, serializeTicket(updated, { includeHistory: true }));
      return;
    }

    if (req.method === "POST" && sub === "/notes") {
      if (!requireScope("tickets:write")) return;
      let body;
      try { body = await readBody(req); } catch { sendApiError(res, 400, "validation_error", "JSON inválido.", rateHeaders); return; }
      const note = String(body.note || "").trim().slice(0, 4000);
      if (!note) { sendApiError(res, 400, "validation_error", "El campo 'note' es obligatorio.", rateHeaders); return; }
      store.ticketHistory.push({
        id: crypto.randomUUID(), ticketId: id, note, status: raw.status,
        createdAt: new Date().toISOString(), isQuickNote: true,
      });
      invalidateHistoryIndex();
      saveStore();
      notifyClients("ticketsChanged", { action: "updated", id });
      ok(201, { ok: true, ticketId: id });
      return;
    }

    if (req.method === "POST" && sub === "/reply") {
      if (!requireScope("tickets:write")) return;
      if (!raw.contact) { sendApiError(res, 400, "validation_error", "El ticket no tiene correo de contacto.", rateHeaders); return; }
      let body;
      try { body = await readBody(req); } catch { sendApiError(res, 400, "validation_error", "JSON inválido.", rateHeaders); return; }
      const message = String(body.message || "").trim().slice(0, 4000);
      if (!message) { sendApiError(res, 400, "validation_error", "El campo 'message' es obligatorio.", rateHeaders); return; }
      const msgId = await sendEmail(raw.contact, `Re: ${raw.subject || raw.id}`, message);
      if (!msgId) { sendApiError(res, 502, "email_failed", "No se pudo enviar el correo. Revisa la configuración SMTP.", rateHeaders); return; }
      let dirty = false;
      if (!raw.emailThreadId) { raw.emailThreadId = msgId; dirty = true; }
      if (raw.reopenedByClient) { raw.reopenedByClient = false; dirty = true; }
      if (dirty) saveStore();
      addTicketHistory(id, `Respuesta enviada al cliente (API):\n${message}`, raw.status);
      notifyClients("ticketsChanged", { action: "updated", id });
      ok(200, { ok: true, ticketId: id, messageId: msgId });
      return;
    }
  }

  sendApiError(res, 404, "not_found", "Ruta no encontrada en la API v1.", rateHeaders);
}

// ── Main server ───────────────────────────────────────────────────────────────

// NOTE: /api/config is NOT public — it carries aiConfig, SLA and business-hours
// data. The public ticket form uses /api/portal/config, which exposes only the
// field labels it needs to render.
const isPublicApi = (method, url) =>
  (method === "GET" &&
    (url === "/api/health" || url === "/api/version" ||
     url === "/api/portal/config" || url.startsWith("/api/portal/tickets"))) ||
  (method === "POST" && (url === "/api/tickets" || url === "/api/email/inbound"));
// All /api/notifications/* routes require authentication (handled by default guard)

const server = http.createServer(async (req, res) => {
  applySecurityHeaders(req, res);

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

  // Public API v1 — authenticated with Bearer tokens, not session cookies.
  if (req.url.startsWith("/api/v1/")) {
    await handleApiV1(req, res);
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
