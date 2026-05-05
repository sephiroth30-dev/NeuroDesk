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
});
