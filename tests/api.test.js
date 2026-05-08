// Set env before requiring the server so it uses an in-memory DB and skips the email poller
process.env.ND_DB_PATH = ":memory:";
process.env.ND_TEST = "1";

const request = require("supertest");
const { server } = require("../server");

beforeAll((done) => {
  server.listen(0, done);
});

afterAll((done) => {
  server.close(done);
});

// ── Public endpoints ──────────────────────────────────────────────────────────

describe("Public endpoints", () => {
  test("GET /api/version returns version string", async () => {
    const res = await request(server).get("/api/version");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("version");
    expect(typeof res.body.version).toBe("string");
  });

  test("GET /api/config is public and returns SLA + fields", async () => {
    const res = await request(server).get("/api/config");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("sla");
    expect(res.body).toHaveProperty("fields");
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
