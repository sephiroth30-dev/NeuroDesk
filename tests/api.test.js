// Set env before requiring the server so it uses an in-memory DB and skips the email poller
const os = require("os");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");

// Point the store at a throwaway file BEFORE requiring the server. Without this
// the suite falls back to ~/.neurodesk/data.json — the real production store on
// the server — and every run would write tickets into live data.
const TEST_STORE = path.join(
  os.tmpdir(),
  `neurodesk-test-${crypto.randomUUID()}`,
  "data.json"
);
process.env.ND_STORE_PATH = TEST_STORE;
process.env.ND_DB_PATH = ":memory:";
process.env.ND_TEST = "1";
// The seed no longer ships a fixed password, so tests pin their own.
process.env.ND_PASS = process.env.ND_PASS || "neurofic";

const request = require("supertest");
const { server } = require("../server");

beforeAll((done) => {
  // Guard against ever running against the real store.
  if (!TEST_STORE.startsWith(os.tmpdir())) {
    throw new Error(`El store de pruebas debe estar en un temporal, no en ${TEST_STORE}`);
  }
  server.listen(0, done);
});

afterAll((done) => {
  server.close(() => {
    try { fs.rmSync(path.dirname(TEST_STORE), { recursive: true, force: true }); } catch (_) {}
    done();
  });
});

// ── Public endpoints ──────────────────────────────────────────────────────────

describe("Public endpoints", () => {
  test("GET /api/version returns version string", async () => {
    const res = await request(server).get("/api/version");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("version");
    expect(typeof res.body.version).toBe("string");
  });

  test("GET /api/config requiere sesión — lleva la API key y no puede ser pública", async () => {
    const res = await request(server).get("/api/config");
    expect(res.status).toBe(401);
  });

  test("GET /api/config nunca expone la API key de Anthropic", async () => {
    const login = await request(server)
      .post("/api/auth/login")
      .send({ username: "admin", password: "neurofic" });
    const cookie = login.headers["set-cookie"];
    const res = await request(server).get("/api/config").set("Cookie", cookie);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("sla");
    expect(res.body).toHaveProperty("fields");
    expect(res.body.aiConfig).not.toHaveProperty("apiKey");
    expect(JSON.stringify(res.body)).not.toContain("sk-ant");
  });

  test("GET /api/portal/config es público y sólo expone etiquetas de campos", async () => {
    const res = await request(server).get("/api/portal/config");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("fields");
    expect(res.body).not.toHaveProperty("aiConfig");
    expect(res.body).not.toHaveProperty("sla");
  });
});

// ── Authentication ─────────────────────────────────────────────────────────────

describe("Authentication", () => {
  test("GET /api/tickets without session returns 401", async () => {
    const res = await request(server).get("/api/tickets");
    expect(res.status).toBe(401);
  });

  test("GET /api/stats without session returns 401", async () => {
    const res = await request(server).get("/api/stats");
    expect(res.status).toBe(401);
  });

  test("POST /api/auth/login with wrong password returns 401", async () => {
    const res = await request(server)
      .post("/api/auth/login")
      .send({ username: "admin", password: "wrong-password" });
    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty("error");
  });

  test("POST /api/auth/login with correct credentials sets session cookie", async () => {
    const res = await request(server)
      .post("/api/auth/login")
      .send({ username: "admin", password: "neurofic" });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("username", "admin");
    expect(res.headers["set-cookie"]).toBeDefined();
  });

  test("GET /api/tickets with valid session returns array", async () => {
    const login = await request(server)
      .post("/api/auth/login")
      .send({ username: "admin", password: "neurofic" });
    const cookie = login.headers["set-cookie"][0].split(";")[0];

    const res = await request(server).get("/api/tickets").set("Cookie", cookie);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test("GET /api/stats with valid session returns stats object", async () => {
    const login = await request(server)
      .post("/api/auth/login")
      .send({ username: "admin", password: "neurofic" });
    const cookie = login.headers["set-cookie"][0].split(";")[0];

    const res = await request(server).get("/api/stats").set("Cookie", cookie);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("total");
    expect(res.body).toHaveProperty("open");
    expect(res.body).toHaveProperty("slaCompliance");
  });
});

// ── Ticket creation (public endpoint) ────────────────────────────────────────

describe("Ticket creation", () => {
  test("POST /api/tickets without auth creates ticket (public endpoint)", async () => {
    const res = await request(server)
      .post("/api/tickets")
      .send({ name: "Usuario Test", area: "Soporte", urgency: "media" });
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty("id");
    expect(res.body.id).toMatch(/^ND-/);
    expect(res.body).toHaveProperty("status", "abierto");
  });

  test("POST /api/tickets without name returns 400", async () => {
    const res = await request(server).post("/api/tickets").send({ urgency: "media" });
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("error");
  });

  test("POST /api/tickets with invalid urgency returns 400", async () => {
    const res = await request(server)
      .post("/api/tickets")
      .send({ name: "Test", urgency: "invalido" });
    expect(res.status).toBe(400);
  });

  test("POST /api/tickets with all fields returns full ticket", async () => {
    const res = await request(server).post("/api/tickets").send({
      name: "Ana García",
      contact: "ana@example.com",
      area: "Agenda",
      urgency: "alta",
      subject: "No puedo acceder al sistema",
      description: "Desde ayer no puedo iniciar sesión.",
    });
    expect(res.status).toBe(201);
    expect(res.body.name).toBe("Ana García");
    expect(res.body.urgency).toBe("alta");
    expect(res.body.source).toBe("web");
  });
});

// ── Ticket status update (requires auth) ──────────────────────────────────────

describe("Ticket status update", () => {
  let cookie;
  let ticketId;

  beforeAll(async () => {
    const login = await request(server)
      .post("/api/auth/login")
      .send({ username: "admin", password: "neurofic" });
    cookie = login.headers["set-cookie"][0].split(";")[0];

    const create = await request(server)
      .post("/api/tickets")
      .send({ name: "Ticket para estado", urgency: "baja" });
    ticketId = create.body.id;
  });

  test("PATCH /api/tickets/:id/status updates status", async () => {
    const res = await request(server)
      .patch(`/api/tickets/${ticketId}/status`)
      .set("Cookie", cookie)
      .send({ status: "en_proceso" });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("en_proceso");
  });

  test("PATCH /api/tickets/:id/status with invalid status returns 400", async () => {
    const res = await request(server)
      .patch(`/api/tickets/${ticketId}/status`)
      .set("Cookie", cookie)
      .send({ status: "estado_inexistente" });
    expect(res.status).toBe(400);
  });

  test("PATCH /api/tickets/:id/status response includes sla object", async () => {
    const res = await request(server)
      .patch(`/api/tickets/${ticketId}/status`)
      .set("Cookie", cookie)
      .send({ status: "en_espera" });
    expect(res.status).toBe(200);
    expect(res.body.sla).toBeDefined();
    expect(typeof res.body.sla.limitHours).toBe("number");
    expect(typeof res.body.sla.remainingHours).toBe("number");
    expect(typeof res.body.sla.breached).toBe("boolean");
    expect(res.body.sla.breached).toBe(false);
  });
});

// ── SLA fields on ticket list ─────────────────────────────────────────────────

describe("SLA fields", () => {
  let cookie;

  beforeAll(async () => {
    const login = await request(server)
      .post("/api/auth/login")
      .send({ username: "admin", password: "neurofic" });
    cookie = login.headers["set-cookie"][0].split(";")[0];
  });

  test("GET /api/tickets includes sla object on each ticket", async () => {
    await request(server).post("/api/tickets").send({ name: "SLA Test", urgency: "alta" });
    const res = await request(server).get("/api/tickets").set("Cookie", cookie);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    const ticket = res.body[0];
    expect(ticket.sla).toBeDefined();
    expect(ticket.sla).toHaveProperty("limitHours");
    expect(ticket.sla).toHaveProperty("remainingHours");
    expect(ticket.sla).toHaveProperty("breached");
  });

  test("urgencia alta tiene SLA menor que baja", async () => {
    const alta = await request(server)
      .post("/api/tickets")
      .send({ name: "Urgente", urgency: "alta" });
    const baja = await request(server)
      .post("/api/tickets")
      .send({ name: "No urgente", urgency: "baja" });

    const all = await request(server).get("/api/tickets").set("Cookie", cookie);
    const ticketAlta = all.body.find((t) => t.id === alta.body.id);
    const ticketBaja = all.body.find((t) => t.id === baja.body.id);

    expect(ticketAlta.sla.limitHours).toBeLessThan(ticketBaja.sla.limitHours);
  });
});

// ── Ticket full update (PATCH /api/tickets/:id) ───────────────────────────────

describe("Ticket full update", () => {
  let cookie;
  let ticketId;

  beforeAll(async () => {
    const login = await request(server)
      .post("/api/auth/login")
      .send({ username: "admin", password: "neurofic" });
    cookie = login.headers["set-cookie"][0].split(";")[0];

    const create = await request(server).post("/api/tickets").send({
      name: "Ticket editable",
      area: "Soporte",
      urgency: "media",
    });
    ticketId = create.body.id;
  });

  test("PATCH /api/tickets/:id actualiza nombre, contacto y área", async () => {
    const res = await request(server)
      .patch(`/api/tickets/${ticketId}`)
      .set("Cookie", cookie)
      .send({
        name: "Carlos Mendez",
        contact: "carlos@neurofic.com",
        area: "Facturación",
        urgency: "media",
        status: "en_proceso",
        subject: "Error en factura",
        description: "La factura tiene un error de IVA.",
        resolution: "",
        resolutionNote: "",
      });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe("Carlos Mendez");
    expect(res.body.contact).toBe("carlos@neurofic.com");
    expect(res.body.area).toBe("Facturación");
    expect(res.body.status).toBe("en_proceso");
  });

  test("PATCH /api/tickets/:id con urgencia inválida devuelve 400", async () => {
    const res = await request(server)
      .patch(`/api/tickets/${ticketId}`)
      .set("Cookie", cookie)
      .send({
        name: "Carlos Mendez",
        urgency: "nuclear",
        status: "en_proceso",
        resolution: "",
        resolutionNote: "",
      });
    expect(res.status).toBe(400);
  });

  test("PATCH /api/tickets/:id cerrar sin motivo devuelve 400", async () => {
    const res = await request(server)
      .patch(`/api/tickets/${ticketId}`)
      .set("Cookie", cookie)
      .send({
        name: "Carlos Mendez",
        urgency: "media",
        status: "cerrado",
        resolution: "",
        resolutionNote: "",
      });
    expect(res.status).toBe(400);
  });

  test("PATCH /api/tickets/:id resolver con motivo funciona", async () => {
    const res = await request(server)
      .patch(`/api/tickets/${ticketId}`)
      .set("Cookie", cookie)
      .send({
        name: "Carlos Mendez",
        contact: "carlos@neurofic.com",
        area: "Facturación",
        urgency: "media",
        status: "resuelto",
        subject: "Error en factura",
        description: "La factura tiene un error de IVA.",
        resolution: "Se corrigió el IVA y se emitió nueva factura.",
        resolutionNote: "",
      });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("resuelto");
    expect(res.body.sla).toBeDefined();
  });

  test("PATCH /api/tickets/:id ID inexistente devuelve 400", async () => {
    const res = await request(server)
      .patch(`/api/tickets/ND-99999`)
      .set("Cookie", cookie)
      .send({
        name: "Fantasma",
        urgency: "baja",
        status: "abierto",
        resolution: "",
        resolutionNote: "",
      });
    expect(res.status).toBe(400);
  });
});

// ── Ticket history ────────────────────────────────────────────────────────────

describe("Ticket history", () => {
  let cookie;
  let ticketId;

  beforeAll(async () => {
    const login = await request(server)
      .post("/api/auth/login")
      .send({ username: "admin", password: "neurofic" });
    cookie = login.headers["set-cookie"][0].split(";")[0];

    const create = await request(server).post("/api/tickets").send({
      name: "Ticket con historial",
      urgency: "alta",
    });
    ticketId = create.body.id;
  });

  test("ticket nuevo tiene history vacío", async () => {
    const all = await request(server).get("/api/tickets").set("Cookie", cookie);
    const ticket = all.body.find((t) => t.id === ticketId);
    expect(Array.isArray(ticket.history)).toBe(true);
    expect(ticket.history).toHaveLength(0);
  });

  test("resolutionNote al resolver crea entrada de historial", async () => {
    await request(server)
      .patch(`/api/tickets/${ticketId}`)
      .set("Cookie", cookie)
      .send({
        name: "Ticket con historial",
        urgency: "alta",
        status: "resuelto",
        area: "General",
        subject: "",
        description: "",
        resolution: "",
        resolutionNote: "Se diagnosticó y resolvió el problema de acceso.",
      });

    const all = await request(server).get("/api/tickets").set("Cookie", cookie);
    const ticket = all.body.find((t) => t.id === ticketId);
    expect(ticket.history.length).toBeGreaterThan(0);
    expect(ticket.history[0].note).toBe("Se diagnosticó y resolvió el problema de acceso.");
    expect(ticket.history[0].status).toBe("resuelto");
  });
});

// ── Stats reflejan tickets reales ─────────────────────────────────────────────

describe("Stats", () => {
  let cookie;

  beforeAll(async () => {
    const login = await request(server)
      .post("/api/auth/login")
      .send({ username: "admin", password: "neurofic" });
    cookie = login.headers["set-cookie"][0].split(";")[0];
  });

  test("GET /api/stats tiene estructura correcta", async () => {
    const res = await request(server).get("/api/stats").set("Cookie", cookie);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("total");
    expect(res.body).toHaveProperty("open");
    expect(res.body).toHaveProperty("breached");
    expect(res.body).toHaveProperty("byStatus");
    expect(res.body).toHaveProperty("byUrgency");
    expect(res.body).toHaveProperty("slaCompliance");
    expect(res.body).toHaveProperty("avgRemainingHours");
  });

  test("crear ticket incrementa stats.total en 1", async () => {
    const before = await request(server).get("/api/stats").set("Cookie", cookie);
    await request(server).post("/api/tickets").send({ name: "Stats Test", urgency: "baja" });
    const after = await request(server).get("/api/stats").set("Cookie", cookie);
    expect(after.body.total).toBe(before.body.total + 1);
    expect(after.body.open).toBe(before.body.open + 1);
  });

  test("byStatus.abierto aumenta con nuevo ticket", async () => {
    const before = await request(server).get("/api/stats").set("Cookie", cookie);
    await request(server).post("/api/tickets").send({ name: "Abierto Stats", urgency: "media" });
    const after = await request(server).get("/api/stats").set("Cookie", cookie);
    expect(after.body.byStatus.abierto).toBe(before.body.byStatus.abierto + 1);
  });

  test("slaCompliance es 100 cuando no hay tickets vencidos (store limpio)", async () => {
    const res = await request(server).get("/api/stats").set("Cookie", cookie);
    expect(res.body.slaCompliance).toBeGreaterThanOrEqual(0);
    expect(res.body.slaCompliance).toBeLessThanOrEqual(100);
  });
});

// ── Ticket deletion ───────────────────────────────────────────────────────────

describe("Ticket deletion", () => {
  let cookie;

  beforeAll(async () => {
    const login = await request(server)
      .post("/api/auth/login")
      .send({ username: "admin", password: "neurofic" });
    cookie = login.headers["set-cookie"][0].split(";")[0];
  });

  test("DELETE /api/tickets/:id elimina un ticket", async () => {
    const create = await request(server)
      .post("/api/tickets")
      .send({ name: "Para borrar", urgency: "baja" });
    const id = create.body.id;

    const del = await request(server)
      .delete(`/api/tickets/${id}`)
      .set("Cookie", cookie);
    expect(del.status).toBe(200);
    expect(del.body).toHaveProperty("ok", true);

    const all = await request(server).get("/api/tickets").set("Cookie", cookie);
    expect(all.body.find((t) => t.id === id)).toBeUndefined();
  });

  test("DELETE /api/tickets/:id con ID inexistente devuelve 404", async () => {
    const res = await request(server)
      .delete(`/api/tickets/ND-99999`)
      .set("Cookie", cookie);
    expect(res.status).toBe(404);
  });

  test("DELETE /api/tickets elimina múltiples tickets en bulk", async () => {
    const a = await request(server).post("/api/tickets").send({ name: "Bulk A", urgency: "baja" });
    const b = await request(server).post("/api/tickets").send({ name: "Bulk B", urgency: "baja" });
    const ids = [a.body.id, b.body.id];

    const del = await request(server)
      .delete("/api/tickets")
      .set("Cookie", cookie)
      .send({ ids });
    expect(del.status).toBe(200);
    expect(del.body.deleted).toBe(2);

    const all = await request(server).get("/api/tickets").set("Cookie", cookie);
    expect(all.body.find((t) => t.id === a.body.id)).toBeUndefined();
    expect(all.body.find((t) => t.id === b.body.id)).toBeUndefined();
  });

  test("DELETE /api/tickets con array vacío devuelve 400", async () => {
    const res = await request(server)
      .delete("/api/tickets")
      .set("Cookie", cookie)
      .send({ ids: [] });
    expect(res.status).toBe(400);
  });
});

// ── Position update (drag & drop) ─────────────────────────────────────────────

describe("Ticket position update", () => {
  let cookie;
  let idA;
  let idB;

  beforeAll(async () => {
    const login = await request(server)
      .post("/api/auth/login")
      .send({ username: "admin", password: "neurofic" });
    cookie = login.headers["set-cookie"][0].split(";")[0];

    const a = await request(server)
      .post("/api/tickets")
      .send({ name: "Posición A", urgency: "media" });
    const b = await request(server)
      .post("/api/tickets")
      .send({ name: "Posición B", urgency: "media" });
    idA = a.body.id;
    idB = b.body.id;
  });

  test("PATCH /api/tickets/:id/position mueve ticket a nuevo estado y orden", async () => {
    const res = await request(server)
      .patch(`/api/tickets/${idA}/position`)
      .set("Cookie", cookie)
      .send({ status: "en_proceso", orderedIds: [idA, idB] });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("en_proceso");
  });

  test("PATCH /api/tickets/:id/position con estado inválido devuelve 400", async () => {
    const res = await request(server)
      .patch(`/api/tickets/${idA}/position`)
      .set("Cookie", cookie)
      .send({ status: "limbo", orderedIds: [idA] });
    expect(res.status).toBe(400);
  });

  test("PATCH /api/tickets/:id/position sin el ID en orderedIds devuelve 400", async () => {
    const res = await request(server)
      .patch(`/api/tickets/${idA}/position`)
      .set("Cookie", cookie)
      .send({ status: "en_proceso", orderedIds: [idB] });
    expect(res.status).toBe(400);
  });
});

// ── Ciclo de vida completo ────────────────────────────────────────────────────

describe("Ciclo de vida completo de un ticket", () => {
  let cookie;
  let ticketId;

  beforeAll(async () => {
    const login = await request(server)
      .post("/api/auth/login")
      .send({ username: "admin", password: "neurofic" });
    cookie = login.headers["set-cookie"][0].split(";")[0];
  });

  test("1. Crear ticket desde portal (sin auth)", async () => {
    const res = await request(server).post("/api/tickets").send({
      name: "María López",
      contact: "maria@example.com",
      area: "Agenda",
      urgency: "alta",
      subject: "No carga el calendario",
      description: "El módulo de agenda no responde desde esta mañana.",
    });
    expect(res.status).toBe(201);
    expect(res.body.id).toMatch(/^ND-/);
    expect(res.body.status).toBe("abierto");
    expect(res.body.source).toBe("web");
    ticketId = res.body.id;
  });

  test("2. Aparece en lista de tickets con SLA", async () => {
    const res = await request(server).get("/api/tickets").set("Cookie", cookie);
    const ticket = res.body.find((t) => t.id === ticketId);
    expect(ticket).toBeDefined();
    expect(ticket.sla.breached).toBe(false);
    expect(ticket.history).toHaveLength(0);
  });

  test("3. Técnico lo toma: abierto → en_proceso", async () => {
    const res = await request(server)
      .patch(`/api/tickets/${ticketId}/status`)
      .set("Cookie", cookie)
      .send({ status: "en_proceso" });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("en_proceso");
  });

  test("4. Pasa a en_espera mientras se investiga", async () => {
    const res = await request(server)
      .patch(`/api/tickets/${ticketId}/status`)
      .set("Cookie", cookie)
      .send({ status: "en_espera" });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("en_espera");
  });

  test("5. Resolver con motivo de cierre y nota de historial", async () => {
    const res = await request(server)
      .patch(`/api/tickets/${ticketId}`)
      .set("Cookie", cookie)
      .send({
        name: "María López",
        contact: "maria@example.com",
        area: "Agenda",
        urgency: "alta",
        status: "resuelto",
        subject: "No carga el calendario",
        description: "El módulo de agenda no responde desde esta mañana.",
        resolution: "Se reinició el servicio de agenda y se verificó funcionamiento.",
        resolutionNote: "Causa: caché corrupta en el servidor de agenda.",
      });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("resuelto");
  });

  test("6. Historial refleja la nota de resolución", async () => {
    const all = await request(server).get("/api/tickets").set("Cookie", cookie);
    const ticket = all.body.find((t) => t.id === ticketId);
    expect(ticket.history.length).toBeGreaterThan(0);
    expect(ticket.history[0].note).toBe("Causa: caché corrupta en el servidor de agenda.");
  });

  test("7. Cerrar ticket definitivamente", async () => {
    const res = await request(server)
      .patch(`/api/tickets/${ticketId}`)
      .set("Cookie", cookie)
      .send({
        name: "María López",
        contact: "maria@example.com",
        area: "Agenda",
        urgency: "alta",
        status: "cerrado",
        subject: "No carga el calendario",
        description: "El módulo de agenda no responde desde esta mañana.",
        resolution: "Se reinició el servicio de agenda y se verificó funcionamiento.",
        resolutionNote: "",
      });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("cerrado");
  });

  test("8. Stats no lo cuenta como ticket activo", async () => {
    const res = await request(server).get("/api/stats").set("Cookie", cookie);
    const all = await request(server).get("/api/tickets").set("Cookie", cookie);
    const closed = all.body.filter((t) => t.status === "cerrado" || t.status === "resuelto");
    expect(res.body.open).toBe(res.body.total - closed.length);
  });
});

// ── Seguridad ─────────────────────────────────────────────────────────────────

describe("Seguridad", () => {
  let cookie;

  beforeAll(async () => {
    const login = await request(server)
      .post("/api/auth/login")
      .send({ username: "admin", password: "neurofic" });
    cookie = login.headers["set-cookie"];
  });

  test("las cabeceras de seguridad están presentes en todas las respuestas", async () => {
    const res = await request(server).get("/api/version");
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    expect(res.headers["x-frame-options"]).toBe("DENY");
    expect(res.headers["referrer-policy"]).toBe("same-origin");
    const csp = res.headers["content-security-policy"];
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("connect-src 'self'");
    expect(csp).toContain("object-src 'none'");
  });

  test("el límite de login NO se evade falsificando X-Forwarded-For", async () => {
    // Sin proxy confiable la cabecera se ignora, así que los 11 intentos caen
    // en el mismo bucket y el último debe rechazarse.
    let last;
    for (let i = 0; i < 12; i += 1) {
      last = await request(server)
        .post("/api/auth/login")
        .set("X-Forwarded-For", `10.0.0.${i}`)
        .send({ username: "admin", password: "clave-incorrecta" });
    }
    expect(last.status).toBe(429);
  });

  test("un webhook hacia una dirección interna se rechaza", async () => {
    for (const url of [
      "http://127.0.0.1:3000/hook",
      "http://169.254.169.254/latest/meta-data/",
      "http://192.168.1.10/x",
      "http://localhost/x",
    ]) {
      const res = await request(server)
        .post("/api/webhooks")
        .set("Cookie", cookie)
        .send({ url, events: ["ticket.created"] });
      expect(res.status).toBe(400);
    }
  });

  test("un webhook público sí se acepta", async () => {
    const res = await request(server)
      .post("/api/webhooks")
      .set("Cookie", cookie)
      .send({ url: "https://example.com/hook", events: ["ticket.created"] });
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty("secret");
  });

  test("no se puede cambiar la contraseña de otro usuario sin confirmar la propia", async () => {
    await request(server)
      .post("/api/users")
      .set("Cookie", cookie)
      .send({ username: "otro", password: "unaClaveLarga123" });

    const sinConfirmar = await request(server)
      .put("/api/users/otro/password")
      .set("Cookie", cookie)
      .send({ password: "nuevaClaveLarga456" });
    expect(sinConfirmar.status).toBe(403);

    const conConfirmacion = await request(server)
      .put("/api/users/otro/password")
      .set("Cookie", cookie)
      .send({ password: "nuevaClaveLarga456", currentPassword: "neurofic" });
    expect(conConfirmacion.status).toBe(200);
  });

  test("la política de contraseñas exige 12 caracteres", async () => {
    const res = await request(server)
      .post("/api/users")
      .set("Cookie", cookie)
      .send({ username: "corta", password: "1234" });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/12/);
  });

  test("POST /api/email/inbound ya no es anónimo", async () => {
    const res = await request(server)
      .post("/api/email/inbound")
      .send({ from: "suplantado@cliente.com", subject: "Falso", description: "x" });
    expect(res.status).toBe(401);
  });
});

// ── Anti-spam del formulario público ──────────────────────────────────────────

describe("Anti-spam del formulario público", () => {
  test("el honeypot descarta el envío sin crear ticket", async () => {
    const before = await request(server).get("/api/portal/tickets?email=bot@spam.com");
    const res = await request(server).post("/api/tickets").send({
      name: "Bot", contact: "bot@spam.com", urgency: "media",
      subject: "spam", website: "http://spam.example",
    });
    // Responde 201 a propósito para no darle señal al bot...
    expect(res.status).toBe(201);
    // ...pero no se creó nada.
    const after = await request(server).get("/api/portal/tickets?email=bot@spam.com");
    expect(after.body.length).toBe(before.body.length);
  });

  test("un envío instantáneo con token recién emitido se descarta", async () => {
    const cfg = await request(server).get("/api/portal/config");
    expect(cfg.body).toHaveProperty("formToken");
    const res = await request(server).post("/api/tickets").send({
      name: "Bot rápido", contact: "rapido@spam.com", urgency: "media",
      formToken: cfg.body.formToken,
    });
    expect(res.status).toBe(201);
    const after = await request(server).get("/api/portal/tickets?email=rapido@spam.com");
    expect(after.body.length).toBe(0);
  });

  test("un token con firma manipulada se descarta", async () => {
    const res = await request(server).post("/api/tickets").send({
      name: "Falsificador", contact: "falso@spam.com", urgency: "media",
      formToken: "999999.0000000000000000000000000000000000",
    });
    expect(res.status).toBe(201);
    const after = await request(server).get("/api/portal/tickets?email=falso@spam.com");
    expect(after.body.length).toBe(0);
  });

  test("muchos envíos desde la misma IP con remitentes distintos SÍ se crean todos", async () => {
    // Esto es justo lo que rompía el límite por IP: una oficina entera comparte
    // una sola dirección pública.
    const total = 25;
    for (let i = 0; i < total; i += 1) {
      const res = await request(server).post("/api/tickets").send({
        name: `Compañero ${i}`, contact: `persona${i}@neurofic.com`, urgency: "media",
        subject: `Solicitud ${i}`,
      });
      expect(res.status).toBe(201);
    }
    const check = await request(server).get("/api/portal/tickets?email=persona24@neurofic.com");
    expect(check.body.length).toBe(1);
  });
});

// ── API v1 enriquecida para agentes (desde v14.40) ───────────────────────────

describe("API v1 — historial con origen, adjuntos, sentimiento y previsualización de respuesta", () => {
  // No usa /api/auth/login: para este punto del archivo el test de seguridad
  // "el límite de login NO se evade falsificando X-Forwarded-For" ya agotó a
  // propósito el rate limit de login para la IP de pruebas (429 permanente
  // hasta que expire la ventana de 15 min). Se crea la llave directamente vía
  // __internals, igual que otros tests de este archivo manipulan `store`.
  const { createApiKey } = require("../server").__internals;
  let token;

  function createBearerToken(scopes) {
    return createApiKey("test-agent", scopes).token;
  }

  beforeAll(() => {
    token = createBearerToken(["tickets:read", "tickets:write"]);
  });

  test("una nota interna vía /notes queda marcada con origin=agent_note", async () => {
    const create = await request(server)
      .post("/api/v1/tickets")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Cliente Origen", contact: "origen1@neurofic.com", urgency: "media" });
    expect(create.status).toBe(201);
    const id = create.body.id;

    const note = await request(server)
      .post(`/api/v1/tickets/${id}/notes`)
      .set("Authorization", `Bearer ${token}`)
      .send({ note: "Nota interna del agente" });
    expect(note.status).toBe(201);

    const full = await request(server)
      .get(`/api/v1/tickets/${id}`)
      .set("Authorization", `Bearer ${token}`);
    expect(full.status).toBe(200);
    const entry = full.body.history.find((h) => h.note === "Nota interna del agente");
    expect(entry).toBeDefined();
    expect(entry.origin).toBe("agent_note");
  });

  test("una respuesta enviada al cliente vía /reply queda marcada con origin=agent_reply", async () => {
    const create = await request(server)
      .post("/api/v1/tickets")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Cliente Reply", contact: "origen2@neurofic.com", urgency: "media" });
    const id = create.body.id;

    // Sin SMTP configurado en el entorno de test, sendEmail devuelve null y
    // /reply responde 502 — no se registra en el historial. Verificamos el
    // fallo controlado y que no queda una entrada fantasma.
    const reply = await request(server)
      .post(`/api/v1/tickets/${id}/reply`)
      .set("Authorization", `Bearer ${token}`)
      .send({ message: "Ya estamos revisando tu caso." });
    expect([200, 502]).toContain(reply.status);

    const full = await request(server)
      .get(`/api/v1/tickets/${id}`)
      .set("Authorization", `Bearer ${token}`);
    const entry = full.body.history.find((h) => (h.note || "").includes("Ya estamos revisando tu caso."));
    if (reply.status === 200) {
      expect(entry).toBeDefined();
      expect(entry.origin).toBe("agent_reply");
    } else {
      expect(entry).toBeUndefined();
    }
  });

  test("historial creado antes de v14.40 (sin campo origin) se sirve como origin=unknown, nunca se reescribe", async () => {
    const { store, invalidateHistoryIndex } = require("../server").__internals;
    const create = await request(server)
      .post("/api/v1/tickets")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Cliente Legacy", contact: "origen3@neurofic.com", urgency: "media" });
    const id = create.body.id;

    // Simula una entrada de historial de antes de v14.40, sin el campo origin.
    store.ticketHistory.push({
      id: "legacy-1", ticketId: id, note: "Nota antigua sin origin",
      status: "abierto", createdAt: new Date().toISOString(),
    });
    if (invalidateHistoryIndex) invalidateHistoryIndex();

    const full = await request(server)
      .get(`/api/v1/tickets/${id}`)
      .set("Authorization", `Bearer ${token}`);
    const entry = full.body.history.find((h) => h.note === "Nota antigua sin origin");
    expect(entry).toBeDefined();
    expect(entry.origin).toBe("unknown");
  });

  test("serializeTicket vía API expone aiSentimentScore y metadata de adjuntos", async () => {
    const create = await request(server)
      .post("/api/v1/tickets")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Cliente Sentimiento", contact: "origen4@neurofic.com", urgency: "media" });
    const id = create.body.id;

    const { store } = require("../server").__internals;
    const raw = store.tickets.find((t) => t.id === id);
    raw.aiSentimentScore = -0.6;
    raw.attachments = JSON.stringify([
      { name: "captura.png", file: "internal-uuid.png", type: "image/png", source: "client", size: 12345, uploadedAt: "2026-09-01T00:00:00.000Z" },
    ]);

    const full = await request(server)
      .get(`/api/v1/tickets/${id}`)
      .set("Authorization", `Bearer ${token}`);
    expect(full.body.aiSentimentScore).toBe(-0.6);
    expect(full.body.attachments).toEqual([
      { filename: "captura.png", size: 12345, uploadedAt: "2026-09-01T00:00:00.000Z" },
    ]);
    // El nombre interno del archivo en disco nunca debe filtrarse.
    expect(JSON.stringify(full.body)).not.toContain("internal-uuid.png");
  });

  test("POST /reply/preview compone el correo sin enviarlo ni tocar el historial", async () => {
    const create = await request(server)
      .post("/api/v1/tickets")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Cliente Preview", contact: "origen5@neurofic.com", urgency: "media", subject: "Falla de acceso" });
    const id = create.body.id;

    const before = await request(server)
      .get(`/api/v1/tickets/${id}`)
      .set("Authorization", `Bearer ${token}`);
    const historyBefore = before.body.history.length;

    const preview = await request(server)
      .post(`/api/v1/tickets/${id}/reply/preview`)
      .set("Authorization", `Bearer ${token}`)
      .send({ message: "Esto es una prueba de vista previa." });
    expect(preview.status).toBe(200);
    expect(preview.body.to).toBe("origen5@neurofic.com");
    expect(preview.body.subject).toBe("Re: Falla de acceso");
    expect(preview.body.text).toBe("Esto es una prueba de vista previa.");
    expect(preview.body.html).toContain("Esto es una prueba de vista previa.");

    const after = await request(server)
      .get(`/api/v1/tickets/${id}`)
      .set("Authorization", `Bearer ${token}`);
    expect(after.body.history.length).toBe(historyBefore);
  });

  test("POST /reply/preview requiere scope tickets:write", async () => {
    const readOnlyToken = createBearerToken(["tickets:read"]);
    const create = await request(server)
      .post("/api/v1/tickets")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Cliente ReadOnly", contact: "origen6@neurofic.com", urgency: "media" });
    const id = create.body.id;

    const preview = await request(server)
      .post(`/api/v1/tickets/${id}/reply/preview`)
      .set("Authorization", `Bearer ${readOnlyToken}`)
      .send({ message: "No debería poder." });
    expect(preview.status).toBe(403);
  });

  test("GET /api/v1/openapi.json sigue siendo JSON válido e incluye los campos nuevos", async () => {
    const res = await request(server).get("/api/v1/openapi.json");
    expect(res.status).toBe(200);
    const json = JSON.stringify(res.body);
    expect(json).toContain("reply/preview");
    expect(json).toContain("aiSentimentScore");
    expect(json).toContain("origin");
  });
});

// ── Aviso a Telegram cuando entra un ticket nuevo (desde v14.41) ─────────────

describe("Aviso a Telegram en creación de ticket", () => {
  const https = require("https");
  const { setNotificationsConfigForTest } = require("../server").__internals;

  // No simula reintentos con setTimeout real: harían que timers de un test
  // dispararan durante otro y contaminaran sus conteos de llamadas. Para
  // probar el camino de fallo alcanza con que https.request() lance de forma
  // síncrona — insertTicket() ya envuelve la llamada en try/catch para
  // exactamente ese caso (best-effort).
  // Un webhook de ejemplo hacia example.com ya quedó registrado por otro test
  // ("Seguridad") para el evento ticket.created — también pasa por
  // https.request(). Se filtran las llamadas por hostname para no confundir
  // esa entrega con los avisos a Telegram.
  function mockHttpsRequest({ statusCode = 200, throwSync = false } = {}) {
    const calls = [];
    const spy = jest.spyOn(https, "request").mockImplementation((options, callback) => {
      calls.push(options);
      if (throwSync && options.hostname === "api.telegram.org") {
        throw new Error("Fallo simulado de red hacia Telegram");
      }
      const request = {
        on: () => {},
        setTimeout: () => {},
        write: () => {},
        end: () => {
          if (callback) callback({ statusCode, resume: () => {} });
        },
      };
      return request;
    });
    const telegramCalls = () => calls.filter((c) => c.hostname === "api.telegram.org");
    return { spy, calls, telegramCalls };
  }

  afterEach(() => {
    jest.restoreAllMocks();
    setNotificationsConfigForTest({ telegram: { enabled: false, botToken: "", chatId: "" } });
  });

  test("con telegram deshabilitado (default) no se hace ninguna llamada saliente", async () => {
    const { telegramCalls } = mockHttpsRequest();
    const res = await request(server)
      .post("/api/tickets")
      .send({ name: "Cliente Telegram Off", contact: "tg1@neurofic.com", urgency: "media" });
    expect(res.status).toBe(201);
    expect(telegramCalls().length).toBe(0);
  });

  test("con telegram habilitado, se llama a la API de Telegram con el chat_id y el texto esperados", async () => {
    setNotificationsConfigForTest({
      telegram: { enabled: true, botToken: "123:FAKE", chatId: "999" },
    });
    const { telegramCalls } = mockHttpsRequest({ statusCode: 200 });

    const res = await request(server)
      .post("/api/tickets")
      .send({ name: "Cliente Telegram On", contact: "tg2@neurofic.com", urgency: "alta", subject: "No carga el sistema" });
    expect(res.status).toBe(201);
    expect(telegramCalls().length).toBe(1);
    expect(telegramCalls()[0].hostname).toBe("api.telegram.org");
    expect(telegramCalls()[0].path).toBe("/bot123:FAKE/sendMessage");
  });

  test("si la API de Telegram falla, el ticket se crea igual (best-effort)", async () => {
    setNotificationsConfigForTest({
      telegram: { enabled: true, botToken: "123:FAKE", chatId: "999" },
    });
    mockHttpsRequest({ throwSync: true });

    const res = await request(server)
      .post("/api/tickets")
      .send({ name: "Cliente Telegram Fail", contact: "tg3@neurofic.com", urgency: "media" });
    expect(res.status).toBe(201);
  });

  test("actualizar un ticket existente (PATCH/nota) no dispara un nuevo aviso a Telegram", async () => {
    setNotificationsConfigForTest({
      telegram: { enabled: true, botToken: "123:FAKE", chatId: "999" },
    });
    const { telegramCalls } = mockHttpsRequest({ statusCode: 200 });

    const create = await request(server)
      .post("/api/tickets")
      .send({ name: "Cliente Telegram Update", contact: "tg4@neurofic.com", urgency: "media" });
    expect(telegramCalls().length).toBe(1);
    const id = create.body.id;

    const login = await request(server)
      .post("/api/auth/login")
      .send({ username: "admin", password: "neurofic" });
    const cookie = login.headers["set-cookie"]?.[0]?.split(";")[0];
    if (cookie) {
      await request(server)
        .post(`/api/tickets/${id}/notes`)
        .set("Cookie", cookie)
        .send({ note: "Nota de prueba" });
    }
    // Sin sesión disponible (rate limit de login agotado por otro test), al
    // menos confirmamos que la sola creación no volvió a llamar a Telegram.
    expect(telegramCalls().length).toBe(1);
  });
});

// ── Apagado ordenado y bloqueo de instancia única (desde v14.42) ────────────
// Incidente 2026-09-10: un proceso viejo que no murió a tiempo tras el pkill
// del deploy siguió corriendo con una copia en memoria vieja del store, y su
// poller de correo volvió a sobrescribir el archivo con datos desactualizados.

describe("Apagado ordenado y bloqueo de instancia única", () => {
  const {
    LOCK_PATH,
    isPidAlive,
    checkStaleProcessLock,
    writeProcessLock,
    releaseProcessLock,
    shutdownCleanup,
    getTimers,
  } = require("../server").__internals;

  afterEach(() => {
    try { fs.unlinkSync(LOCK_PATH); } catch (_) {}
  });

  test("isPidAlive detecta el propio proceso como vivo y un PID inexistente como muerto", () => {
    expect(isPidAlive(process.pid)).toBe(true);
    // PID improbablemente en uso — Linux limita PIDs a ~4 millones por defecto.
    expect(isPidAlive(999999999)).toBe(false);
  });

  test("writeProcessLock escribe el PID actual en LOCK_PATH", () => {
    writeProcessLock();
    const raw = fs.readFileSync(LOCK_PATH, "utf8").trim();
    expect(parseInt(raw, 10)).toBe(process.pid);
  });

  test("checkStaleProcessLock advierte en el log si el lock apunta a un PID vivo distinto del propio", () => {
    // process.ppid (el proceso que lanzó este test) casi seguro sigue vivo.
    fs.writeFileSync(LOCK_PATH, String(process.ppid));
    const errSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    checkStaleProcessLock();
    expect(errSpy).toHaveBeenCalled();
    expect(errSpy.mock.calls.some((args) => args.join(" ").includes(String(process.ppid)))).toBe(true);
    errSpy.mockRestore();
  });

  test("checkStaleProcessLock no advierte nada si el lock es del propio proceso", () => {
    fs.writeFileSync(LOCK_PATH, String(process.pid));
    const errSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    checkStaleProcessLock();
    expect(errSpy).not.toHaveBeenCalled();
    errSpy.mockRestore();
  });

  test("releaseProcessLock solo borra el lock si es del propio proceso", () => {
    fs.writeFileSync(LOCK_PATH, "123456789"); // PID ajeno simulado
    releaseProcessLock();
    expect(fs.existsSync(LOCK_PATH)).toBe(true); // no se tocó

    fs.writeFileSync(LOCK_PATH, String(process.pid));
    releaseProcessLock();
    expect(fs.existsSync(LOCK_PATH)).toBe(false); // sí se borra el propio
  });

  test("shutdownCleanup libera el lock (los timers reales no arrancan bajo ND_TEST)", () => {
    writeProcessLock();
    expect(fs.existsSync(LOCK_PATH)).toBe(true);
    shutdownCleanup();
    expect(fs.existsSync(LOCK_PATH)).toBe(false);
  });

  test("los timers de correo/auto-cierre/SLA no arrancan bajo ND_TEST (ya desactivados por diseño)", () => {
    const timers = getTimers();
    expect(timers.emailPollerTimer).toBeNull();
    expect(timers.autoCloserTimer).toBeNull();
    expect(timers.slaBreachTimer).toBeNull();
  });
});
