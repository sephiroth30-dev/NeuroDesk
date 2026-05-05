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
    area TEXT NOT NULL,
    urgency TEXT NOT NULL,
    status TEXT NOT NULL,
    source TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
`);

const urgencySlaHours = {
  baja: 24,
  media: 8,
  alta: 4,
  critica: 1
};

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
  INSERT INTO tickets (id, name, area, urgency, status, source, created_at)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);

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

function normalizeTicket(input, source = "web") {
  const name = String(input.name || "").trim();
  const area = String(input.area || "").trim();
  const urgency = String(input.urgency || "").trim().toLowerCase();

  if (!name || !area || !urgencySlaHours[urgency]) {
    return null;
  }

  return {
    id: getNextTicketId(),
    name,
    area,
    urgency,
    status: "abierto",
    source,
    createdAt: new Date().toISOString()
  };
}

function seedDemoTicket() {
  const { total } = countTicketsStmt.get();

  if (total > 0) {
    return;
  }

  insertTicket({
    id: "ND-1001",
    name: "Paciente demo",
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

function getSlaState(ticket) {
  const createdAt = new Date(ticket.createdAt).getTime();
  const elapsedHours = (Date.now() - createdAt) / 36e5;
  const limitHours = urgencySlaHours[ticket.urgency];
  const remainingHours = Math.max(limitHours - elapsedHours, 0);

  return {
    limitHours,
    remainingHours: Number(remainingHours.toFixed(1)),
    breached: elapsedHours > limitHours
  };
}

function getStats() {
  const tickets = getTickets();
  const openTickets = tickets.filter(ticket => ticket.status === "abierto");
  const breachedTickets = openTickets.filter(ticket => getSlaState(ticket).breached);

  return {
    total: tickets.length,
    open: openTickets.length,
    breached: breachedTickets.length,
    slaCompliance:
      openTickets.length === 0
        ? 100
        : Math.round(((openTickets.length - breachedTickets.length) / openTickets.length) * 100)
  };
}

async function handleApi(req, res) {
  if (req.method === "GET" && req.url === "/api/version") {
    sendJson(res, 200, { version: packageInfo.version });
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
        sendJson(res, 400, { error: "Nombre, area y urgencia valida son obligatorios." });
        return;
      }

      sendJson(res, 201, insertTicket(ticket));
    } catch (error) {
      sendJson(res, 400, { error: "No se pudo leer la solicitud." });
    }
    return;
  }

  if (req.method === "POST" && req.url === "/api/email/inbound") {
    try {
      const body = await readBody(req);
      const ticket = normalizeTicket(
        {
          name: body.from || body.name,
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

  sendStatic(req, res);
});

server.listen(PORT, () => {
  console.log(`NeuroDesk listo en http://localhost:${PORT}`);
});
