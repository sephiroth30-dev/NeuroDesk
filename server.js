const http = require("http");
const fs = require("fs");
const path = require("path");
const { DatabaseSync } = require("node:sqlite");

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

const countTicketsStmt = db.prepare("SELECT COUNT(*) AS total FROM tickets");
const listTicketsStmt = db.prepare(`
  SELECT
    id,
    name,
    contact,
    area,
    urgency,
    status,
    source,
    created_at AS createdAt
  FROM tickets
  ORDER BY created_at DESC
`);
const nextTicketNumberStmt = db.prepare(`
  SELECT COALESCE(MAX(CAST(SUBSTR(id, 4) AS INTEGER)), 1000) + 1 AS nextNumber
  FROM tickets
  WHERE id LIKE 'ND-%'
`);
const insertTicketStmt = db.prepare(`
  INSERT INTO tickets (id, name, contact, area, urgency, status, source, created_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`);
const updateTicketStatusStmt = db.prepare("UPDATE tickets SET status = ? WHERE id = ?");
const updateTicketFullStmt = db.prepare(`
  UPDATE tickets SET name = ?, contact = ?, area = ?, urgency = ?, status = ? WHERE id = ?
`);
const upsertConfigStmt = db.prepare(`
  INSERT INTO config (key, value) VALUES (?, ?)
  ON CONFLICT(key) DO UPDATE SET value = excluded.value
`);
const getConfigStmt = db.prepare("SELECT value FROM config WHERE key = 'app_config'");

migrateDatabase();
loadConfig();
seedDemoTicket();

function sendJson(res, status, data) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(data));
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
    res.writeHead(200, { "Content-Type": contentTypes[ext] || "application/octet-stream" });
    res.end(data);
  });
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";

    req.on("data", chunk => {
      body += chunk;
      if (body.length > 1_000_000) {
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
      } catch (error) {
        reject(error);
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

function loadConfig() {
  const row = getConfigStmt.get();
  if (!row) return;

  try {
    appConfig = deepMerge(DEFAULT_CONFIG, JSON.parse(row.value));
  } catch (_) {
    // corrupted config — keep defaults
  }
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

function normalizeTicket(input, source = "web") {
  const name = String(input.name || "").trim();
  const contact = String(input.contact || "").trim();
  const area = String(input.area || "").trim() || "General";
  const urgency = String(input.urgency || "").trim().toLowerCase();

  if (!name || !appConfig.sla[urgency]) {
    return null;
  }

  return {
    id: getNextTicketId(),
    name,
    contact,
    area,
    urgency,
    status: "abierto",
    source,
    createdAt: new Date().toISOString()
  };
}

function migrateDatabase() {
  const columns = db.prepare("PRAGMA table_info(tickets)").all();
  const hasContact = columns.some(column => column.name === "contact");

  if (!hasContact) {
    db.exec("ALTER TABLE tickets ADD COLUMN contact TEXT");
  }
}

function seedDemoTicket() {
  const { total } = countTicketsStmt.get();

  if (total > 0) {
    return;
  }

  insertTicket({
    id: "ND-1001",
    name: "Paciente demo",
    contact: "demo@neurofic.com",
    area: "Agenda",
    urgency: "media",
    status: "abierto",
    source: "web",
    createdAt: new Date(Date.now() - 42 * 60 * 1000).toISOString()
  });
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
    ticket.createdAt
  );
  return ticket;
}

function getTickets() {
  return listTicketsStmt.all();
}

function updateTicketStatus(id, status) {
  if (!ticketStatuses.includes(status)) {
    return null;
  }

  const result = updateTicketStatusStmt.run(status, id);

  if (result.changes === 0) {
    return null;
  }

  return getTickets().find(ticket => ticket.id === id);
}

function updateTicketFull(id, data) {
  const name = String(data.name || "").trim();
  const contact = String(data.contact || "").trim();
  const area = String(data.area || "").trim() || "General";
  const urgency = String(data.urgency || "").trim().toLowerCase();
  const status = String(data.status || "").trim();

  if (!name || !appConfig.sla[urgency] || !ticketStatuses.includes(status)) {
    return null;
  }

  const result = updateTicketFullStmt.run(name, contact, area, urgency, status, id);

  if (result.changes === 0) {
    return null;
  }

  return getTickets().find(ticket => ticket.id === id);
}

function getSlaState(ticket) {
  const createdAt = new Date(ticket.createdAt).getTime();
  const elapsedHours = (Date.now() - createdAt) / 36e5;
  const limitHours = appConfig.sla[ticket.urgency] || 8;
  const remainingHours = Math.max(limitHours - elapsedHours, 0);

  return {
    limitHours,
    remainingHours: Number(remainingHours.toFixed(1)),
    breached: elapsedHours > limitHours
  };
}

function getStats() {
  const tickets = getTickets();
  const activeTickets = tickets.filter(ticket => ticket.status !== "resuelto");
  const breachedTickets = activeTickets.filter(ticket => getSlaState(ticket).breached);
  const byStatus = ticketStatuses.reduce((summary, status) => {
    summary[status] = tickets.filter(ticket => ticket.status === status).length;
    return summary;
  }, {});
  const byUrgency = Object.keys(appConfig.sla).reduce((summary, urgency) => {
    summary[urgency] = tickets.filter(ticket => ticket.urgency === urgency).length;
    return summary;
  }, {});
  const avgRemainingHours =
    activeTickets.length === 0
      ? 0
      : Number(
          (
            activeTickets.reduce((total, ticket) => total + getSlaState(ticket).remainingHours, 0) /
            activeTickets.length
          ).toFixed(1)
        );

  return {
    total: tickets.length,
    open: activeTickets.length,
    breached: breachedTickets.length,
    byStatus,
    byUrgency,
    avgRemainingHours,
    slaCompliance:
      activeTickets.length === 0
        ? 100
        : Math.round(((activeTickets.length - breachedTickets.length) / activeTickets.length) * 100)
  };
}

async function handleApi(req, res) {
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
      const body = await readBody(req);
      const updated = saveConfig(body);
      sendJson(res, 200, updated);
    } catch (error) {
      sendJson(res, 400, { error: "No se pudo guardar la configuración." });
    }
    return;
  }

  if (req.method === "GET" && req.url === "/api/tickets") {
    const tickets = getTickets();
    sendJson(res, 200, tickets.map(ticket => ({ ...ticket, sla: getSlaState(ticket) })));
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

      sendJson(res, 201, insertTicket(ticket));
    } catch (error) {
      sendJson(res, 400, { error: "No se pudo leer la solicitud." });
    }
    return;
  }

  if (req.method === "PATCH" && req.url.startsWith("/api/tickets/") && req.url.endsWith("/status")) {
    try {
      const id = decodeURIComponent(req.url.split("/")[3] || "");
      const body = await readBody(req);
      const status = String(body.status || "").trim();
      const ticket = updateTicketStatus(id, status);

      if (!ticket) {
        sendJson(res, 400, { error: "Ticket no encontrado o estado inválido." });
        return;
      }

      sendJson(res, 200, { ...ticket, sla: getSlaState(ticket) });
    } catch (error) {
      sendJson(res, 400, { error: "No se pudo actualizar el estado." });
    }
    return;
  }

  if (req.method === "PATCH" && /^\/api\/tickets\/[^/]+$/.test(req.url)) {
    try {
      const id = decodeURIComponent(req.url.split("/")[3] || "");
      const body = await readBody(req);
      const ticket = updateTicketFull(id, body);

      if (!ticket) {
        sendJson(res, 400, { error: "Ticket no encontrado o datos inválidos." });
        return;
      }

      sendJson(res, 200, { ...ticket, sla: getSlaState(ticket) });
    } catch (error) {
      sendJson(res, 400, { error: "No se pudo actualizar el ticket." });
    }
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
          urgency: body.urgency || "media"
        },
        "email"
      );

      if (!ticket) {
        sendJson(res, 400, { error: "El correo no contiene datos suficientes para crear el ticket." });
        return;
      }

      sendJson(res, 201, insertTicket(ticket));
    } catch (error) {
      sendJson(res, 400, { error: "No se pudo procesar el correo entrante." });
    }
    return;
  }

  sendJson(res, 404, { error: "Ruta no encontrada." });
}

const server = http.createServer((req, res) => {
  if (req.url.startsWith("/api/")) {
    handleApi(req, res);
    return;
  }

  if (req.method === "GET" && req.url === "/portal") {
    fs.readFile(path.join(PUBLIC_DIR, "portal.html"), (error, data) => {
      if (error) {
        res.writeHead(404);
        res.end("Not found");
        return;
      }
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(data);
    });
    return;
  }

  sendStatic(req, res);
});

server.listen(PORT, () => {
  console.log(`NeuroDesk v${packageInfo.version} listo en http://localhost:${PORT}`);
  console.log(`Portal público en http://localhost:${PORT}/portal`);
});
