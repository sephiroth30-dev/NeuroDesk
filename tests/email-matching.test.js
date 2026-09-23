// Exercises the v14.37 email-matching redesign end-to-end: dedup key stability,
// claim-before-create, and the thread-matching decision table that eliminates
// the false "cliente insatisfecho" alert. IMAP is faked (mockMailbox below) —
// no network is used, and mailparser runs for real against handwritten RFC822
// source so the parsing behaviour matches production exactly.

const os = require("os");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");

const TEST_STORE = path.join(
  os.tmpdir(),
  `neurodesk-test-email-${crypto.randomUUID()}`,
  "data.json"
);
process.env.ND_STORE_PATH = TEST_STORE;
process.env.ND_DB_PATH = ":memory:";
process.env.ND_TEST = "1";
process.env.ND_PASS = process.env.ND_PASS || "neurofic";

// Jest hoists jest.mock() above these declarations, but the factory only runs
// lazily the first time "imapflow" is required (from inside ../server) — by
// then mockMailbox already exists. Must be prefixed "mock" per Jest's
// out-of-scope-variable check on factories.
const mockMailbox = { messages: [], failConnectWith: null };

jest.mock("imapflow", () => ({
  ImapFlow: class FakeImapFlow {
    async connect() {
      if (mockMailbox.failConnectWith) {
        const err = new Error(mockMailbox.failConnectWith);
        throw err;
      }
    }
    async getMailboxLock() {
      return { release() {} };
    }
    async search(criteria) {
      if (criteria && criteria.seen === false) {
        return mockMailbox.messages.filter((m) => !m.seen).map((m) => m.uid);
      }
      if (criteria && criteria.since) {
        const since = criteria.since.getTime();
        return mockMailbox.messages.filter((m) => m.date.getTime() >= since).map((m) => m.uid);
      }
      return [];
    }
    async fetchOne(uid) {
      const m = mockMailbox.messages.find((x) => x.uid === uid);
      return m ? { source: Buffer.from(m.source, "utf8") } : null;
    }
    async messageFlagsAdd(uid) {
      const m = mockMailbox.messages.find((x) => x.uid === uid);
      if (m) m.seen = true;
    }
    async logout() {}
    close() {}
  },
}));

// No real SMTP connection — sendMail resolves immediately with a
// deterministic, unique Message-ID so outbound "resolution" emails can be
// threaded against in a later inbound reply, exactly like Gmail would.
let mockSentCounter = 0;
jest.mock("nodemailer", () => ({
  createTransport: () => ({
    sendMail: async () => ({ messageId: `sent-${++mockSentCounter}@neurofic.com` }),
  }),
}));

const { server, __internals: internals } = require("../server");

let nextUid = 1;
function addToMailbox({ from, subject, date, messageId, inReplyTo, references, text }) {
  const headers = [
    `From: ${from}`,
    "To: soporte@neurofic.com",
    `Subject: ${subject}`,
    `Date: ${date.toUTCString()}`,
  ];
  if (messageId) headers.push(`Message-ID: <${messageId}>`);
  if (inReplyTo) headers.push(`In-Reply-To: <${inReplyTo}>`);
  if (references && references.length) {
    headers.push(`References: ${references.map((r) => `<${r}>`).join(" ")}`);
  }
  headers.push("MIME-Version: 1.0");
  headers.push("Content-Type: text/plain; charset=utf-8");
  const source = `${headers.join("\r\n")}\r\n\r\n${text}`;
  const uid = nextUid++;
  mockMailbox.messages.push({ uid, source, date, seen: false });
  return uid;
}

function enableEmailPolling() {
  internals.setEmailConfigForTest({
    enabled: true,
    host: "imap.example.com",
    username: "soporte@neurofic.com",
    password: "app-password",
    folder: "INBOX",
    defaultArea: "Correo",
    connectedAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
  });
}

async function pollOnce() {
  return internals.pollEmails({ force: true });
}

function enableSmtp() {
  internals.setNotificationsConfigForTest({
    smtp: { enabled: true, host: "smtp.example.com", port: 587, user: "soporte@neurofic.com", pass: "x" },
  });
}

function ticketsFor(contact) {
  return internals.store.tickets.filter((t) => t.contact === contact);
}

beforeAll(() => {
  if (!TEST_STORE.startsWith(os.tmpdir())) {
    throw new Error(`El store de pruebas debe estar en un temporal, no en ${TEST_STORE}`);
  }
  enableEmailPolling();
});

beforeEach(() => {
  mockMailbox.messages = [];
  mockMailbox.failConnectWith = null;
  // Full isolation between tests. Without this, tickets seeded with fixed IDs
  // like "ND-9001" in one test collide with getNextTicketId()'s MAX(existing
  // numeric id)+1 in a later test — a ticket created by polling in an earlier
  // test can end up with the exact ID a later test hardcodes for its seed,
  // and getTicketById() (first-match-in-array) then resolves to the wrong one.
  internals.store.tickets.length = 0;
  internals.store.ticketHistory.length = 0;
  internals.store.processedEmails.length = 0;
  internals.store.emailQuarantine.length = 0;
  // getHistoryIndex() cachea un Map por ticketId — truncar el array arriba no
  // lo invalida por sí solo. Sin esto, un ticket sembrado en un test con un ID
  // que por azar coincide con el ID generado dinámicamente en un test anterior
  // puede leer entradas de historial "fantasma" de ese test anterior.
  internals.invalidateHistoryIndex();
});

afterAll((done) => {
  server.close(() => {
    try {
      fs.rmSync(path.dirname(TEST_STORE), { recursive: true, force: true });
    } catch (_) {}
    done();
  });
});

describe("Deduplicación de correo (BUG A)", () => {
  test("correo sin Message-ID sondeado dos veces crea un solo ticket", async () => {
    const contact = "sinmsgid@cliente.com";
    addToMailbox({
      from: contact,
      subject: "Firma correo",
      date: new Date(),
      text: "Me podrías ayudar con el cambio de la firma",
      // no messageId — forces the sha256 content-hash fallback
    });

    const first = await pollOnce();
    expect(first.created).toBe(1);
    expect(ticketsFor(contact).length).toBe(1);

    // Same message polled again (as if the IMAP search returned it a second
    // time) — the old code appended Date.now() to the key, so this recreated
    // a ticket on every poll. It must not anymore.
    const second = await pollOnce();
    expect(second.created).toBe(0);
    expect(ticketsFor(contact).length).toBe(1);
  });

  test("normalizeTicket() inválido va a cuarentena y no se reprocesa", async () => {
    // No From header at all -> fromEmail/fromName both empty -> normalizeTicket
    // returns null. This used to never get marked processed and looped forever.
    const uid = nextUid++;
    const source =
      "To: soporte@neurofic.com\r\nSubject: Sin remitente\r\n" +
      "Date: " +
      new Date().toUTCString() +
      "\r\nMIME-Version: 1.0\r\nContent-Type: text/plain\r\n\r\ncuerpo";
    mockMailbox.messages.push({ uid, source, date: new Date(), seen: false });

    const before = internals.store.emailQuarantine.length;
    const first = await pollOnce();
    expect(first.created).toBe(0);
    expect(internals.store.emailQuarantine.length).toBe(before + 1);

    const second = await pollOnce();
    expect(second.created).toBe(0);
    expect(internals.store.emailQuarantine.length).toBe(before + 1); // not re-quarantined
  });

  test("una reserva huérfana (claim sin finalizar) se reintenta y crea exactamente un ticket", async () => {
    const contact = "recover@cliente.com";
    const messageId = `recover-${crypto.randomUUID()}@cliente.com`;
    const parsedLike = { messageId };
    const key = internals.computeEmailKey(parsedLike);

    // Simulates a crash between claimEmail() and finalizeEmail(): the entry
    // exists, is still `pending`, and its claim is older than the stale
    // threshold, so the next poll must retry it instead of skipping forever.
    internals.store.processedEmails.push({
      messageId: key,
      altKeys: [],
      processedAt: new Date(0).toISOString(),
      claimedAt: new Date(Date.now() - internals.EMAIL_CLAIM_STALE_MS - 1000).toISOString(),
      pending: true,
      attempts: 1,
      from: contact,
      subject: "Recuperación",
    });

    addToMailbox({ from: contact, subject: "Recuperación", date: new Date(), messageId, text: "hola" });

    const result = await pollOnce();
    expect(result.created).toBe(1);
    expect(ticketsFor(contact).length).toBe(1);
  });
});

describe("Matching de hilos de correo (BUG B — falsa alerta)", () => {
  test("responder en el mismo hilo de Gmail pidiendo algo distinto crea un ticket NUEVO, sin alerta", async () => {
    const contact = "recurrente@neurofic.com";
    const resolutionMsgId = `res-${crypto.randomUUID()}@mail.gmail.com`;

    // Seed a ticket that was resolved and had a resolution email sent.
    const seeded = {
      id: "ND-9001",
      name: "Empleado Recurrente",
      contact,
      area: "Correo",
      urgency: "media",
      status: "resuelto",
      source: "email",
      subject: "Ticket viejo ya resuelto",
      description: "...",
      resolution: "listo",
      customFields: "{}",
      attachments: "[]",
      workedHours: null,
      position: -1,
      createdAt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString(),
      resolvedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
      emailThreadId: resolutionMsgId,
      threadMessageIds: [resolutionMsgId],
      resolutionMessageIds: [resolutionMsgId],
    };
    internals.store.tickets.push(seeded);

    // The client replies inside the same Gmail thread (References accumulates
    // the old resolution Message-ID) but is NOT directly replying to it —
    // In-Reply-To points at some OTHER message, simulating "typed a new email
    // in the same thread" rather than hitting Reply on the resolution email.
    const unrelatedParentId = `unrelated-${crypto.randomUUID()}@mail.gmail.com`;
    addToMailbox({
      from: contact,
      subject: "Necesito otra cosa",
      date: new Date(),
      messageId: `new-${crypto.randomUUID()}@mail.gmail.com`,
      inReplyTo: unrelatedParentId,
      references: [resolutionMsgId, unrelatedParentId],
      text: "Esto es una solicitud totalmente distinta",
    });

    const result = await pollOnce();
    expect(result.created).toBe(1);

    const old = internals.getTicketById("ND-9001");
    expect(old.status).toBe("resuelto"); // untouched
    expect(old.reopenedByClient).toBeFalsy(); // never alerted

    const created = ticketsFor(contact).find((t) => t.id !== "ND-9001");
    expect(created).toBeTruthy();
    expect(created.status).toBe("abierto");
  });

  test("responder directamente al correo de resolución reabre CON alerta", async () => {
    const contact = "insatisfecho@neurofic.com";
    const resolutionMsgId = `res-${crypto.randomUUID()}@mail.gmail.com`;
    internals.store.tickets.push({
      id: "ND-9002",
      name: "Cliente",
      contact,
      area: "Correo",
      urgency: "media",
      status: "resuelto",
      source: "email",
      subject: "Ticket resuelto reciente",
      description: "...",
      resolution: "listo",
      customFields: "{}",
      attachments: "[]",
      workedHours: null,
      position: -1,
      createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
      resolvedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), // within 7d window
      emailThreadId: resolutionMsgId,
      threadMessageIds: [resolutionMsgId],
      resolutionMessageIds: [resolutionMsgId],
    });

    addToMailbox({
      from: contact,
      subject: "Re: Ticket resuelto reciente",
      date: new Date(),
      messageId: `reply-${crypto.randomUUID()}@mail.gmail.com`,
      inReplyTo: resolutionMsgId,
      references: [resolutionMsgId],
      text: "No quedó bien resuelto",
    });

    const result = await pollOnce();
    expect(result.created).toBe(0); // no new ticket — reopened the same one

    const ticket = internals.getTicketById("ND-9002");
    expect(ticket.status).toBe("abierto");
    expect(ticket.reopenedByClient).toBe(true);
    expect(ticket.urgency).toBe("alta"); // escalated from media
  });

  test("misma respuesta directa pero fuera de la ventana de alerta reabre SIN alerta", async () => {
    const contact = "viejo@neurofic.com";
    const resolutionMsgId = `res-${crypto.randomUUID()}@mail.gmail.com`;
    internals.store.tickets.push({
      id: "ND-9003",
      name: "Cliente",
      contact,
      area: "Correo",
      urgency: "media",
      status: "resuelto",
      source: "email",
      subject: "Ticket resuelto hace tiempo",
      description: "...",
      resolution: "listo",
      customFields: "{}",
      attachments: "[]",
      workedHours: null,
      position: -1,
      createdAt: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000).toISOString(),
      resolvedAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(), // >7d, <=30d
      emailThreadId: resolutionMsgId,
      threadMessageIds: [resolutionMsgId],
      resolutionMessageIds: [resolutionMsgId],
    });

    addToMailbox({
      from: contact,
      subject: "Re: Ticket resuelto hace tiempo",
      date: new Date(),
      messageId: `reply-${crypto.randomUUID()}@mail.gmail.com`,
      inReplyTo: resolutionMsgId,
      references: [resolutionMsgId],
      text: "Una cosa más sobre esto",
    });

    const result = await pollOnce();
    expect(result.created).toBe(0);

    const ticket = internals.getTicketById("ND-9003");
    expect(ticket.status).toBe("abierto");
    expect(ticket.reopenedByClient).toBeFalsy();
    expect(ticket.urgency).toBe("media"); // not escalated
  });

  test("responder a un ticket CERRADO nunca lo reabre: nota + ticket nuevo", async () => {
    const contact = "cerrado@neurofic.com";
    const resolutionMsgId = `res-${crypto.randomUUID()}@mail.gmail.com`;
    internals.store.tickets.push({
      id: "ND-9004",
      name: "Cliente",
      contact,
      area: "Correo",
      urgency: "media",
      status: "cerrado",
      source: "email",
      subject: "Ticket cerrado",
      description: "...",
      resolution: "listo",
      customFields: "{}",
      attachments: "[]",
      workedHours: null,
      position: -1,
      createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
      resolvedAt: null,
      emailThreadId: resolutionMsgId,
      threadMessageIds: [resolutionMsgId],
      resolutionMessageIds: [resolutionMsgId],
    });

    addToMailbox({
      from: contact,
      subject: "Re: Ticket cerrado",
      date: new Date(),
      messageId: `reply-${crypto.randomUUID()}@mail.gmail.com`,
      inReplyTo: resolutionMsgId,
      references: [resolutionMsgId],
      text: "Sigo con el mismo problema",
    });

    const result = await pollOnce();
    expect(result.created).toBe(1); // new ticket, closed one is never reopened

    const old = internals.getTicketById("ND-9004");
    expect(old.status).toBe("cerrado");
    expect(old.history.some((h) => h.note.includes("se creó el ticket"))).toBe(true);
  });

  test("remitente distinto al contacto del ticket nunca hace match: siempre ticket nuevo", async () => {
    const resolutionMsgId = `res-${crypto.randomUUID()}@mail.gmail.com`;
    internals.store.tickets.push({
      id: "ND-9005",
      name: "Dueño real",
      contact: "dueno@neurofic.com",
      area: "Correo",
      urgency: "media",
      status: "resuelto",
      source: "email",
      subject: "Ticket de otra persona",
      description: "...",
      resolution: "listo",
      customFields: "{}",
      attachments: "[]",
      workedHours: null,
      position: -1,
      createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      resolvedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
      emailThreadId: resolutionMsgId,
      threadMessageIds: [resolutionMsgId],
      resolutionMessageIds: [resolutionMsgId],
    });

    const impostor = "impostor@neurofic.com";
    addToMailbox({
      from: impostor,
      subject: "Re: Ticket de otra persona",
      date: new Date(),
      messageId: `reply-${crypto.randomUUID()}@mail.gmail.com`,
      inReplyTo: resolutionMsgId,
      references: [resolutionMsgId],
      text: "Yo también tengo este problema",
    });

    const result = await pollOnce();
    expect(result.created).toBe(1);

    const original = internals.getTicketById("ND-9005");
    expect(original.status).toBe("resuelto");
    expect(original.reopenedByClient).toBeFalsy();
    expect(ticketsFor(impostor).length).toBe(1);
  });
});

describe("Integración real con sendTicketNotification", () => {
  // The unit tests above seed resolutionMessageIds directly on the fake
  // ticket. This test instead goes through the ACTUAL code path a real
  // resolution notification takes, to catch exactly the kind of bug where the
  // matching logic is correct but nothing upstream ever tags a message as a
  // resolution — which would make the whole "direct-resolution" match kind
  // permanently unreachable in production.
  test("la notificación real de 'resuelto' marca el correo; responder a ESE correo reabre con alerta", async () => {
    enableSmtp();
    const contact = "real@neurofic.com";
    const ticket = {
      id: "ND-9100",
      name: "Cliente Real",
      contact,
      area: "Correo",
      urgency: "media",
      status: "resuelto",
      source: "email",
      subject: "Ticket real",
      description: "...",
      resolution: "listo",
      customFields: "{}",
      attachments: "[]",
      workedHours: null,
      position: -1,
      createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
      resolvedAt: new Date().toISOString(),
    };
    internals.store.tickets.push(ticket);

    await internals.sendTicketNotification("resolved", ticket, {});

    const afterNotify = internals.getTicketById("ND-9100");
    expect(afterNotify.resolutionMessageIds?.length).toBe(1);
    const resolutionMsgId = afterNotify.resolutionMessageIds[0];

    addToMailbox({
      from: contact,
      subject: "Re: Ticket real",
      date: new Date(),
      messageId: `reply-${crypto.randomUUID()}@mail.gmail.com`,
      inReplyTo: resolutionMsgId,
      references: [resolutionMsgId],
      text: "No quedó resuelto de verdad",
    });

    const result = await pollOnce();
    expect(result.created).toBe(0);

    const reopened = internals.getTicketById("ND-9100");
    expect(reopened.status).toBe("abierto");
    expect(reopened.reopenedByClient).toBe(true);
  });
});

describe("Errores de conexión IMAP (incidente 2026-09-01)", () => {
  // Production showed the raw "Command failed" text in the status panel for
  // days with zero tickets created — that text already meant "invalid/expired
  // Gmail App Password" to this codebase (testEmailConnection knew the hint),
  // but the automatic poller never applied the same translation.
  test("emailErrorHint traduce 'Command failed' a un mensaje accionable sobre credenciales", () => {
    const hint = internals.emailErrorHint("Command failed", {});
    expect(hint).toMatch(/contraseña de aplicaci[oó]n/i);
    expect(hint).not.toBe("Command failed");
  });

  test("un fallo de autenticación real dejar el estado del sondeo con el mensaje traducido, no el crudo", async () => {
    mockMailbox.failConnectWith = "Command failed";

    const result = await pollOnce();
    expect(result.created).toBe(0);
    expect(internals.emailPollStatus.lastError).toMatch(/contraseña de aplicaci[oó]n/i);
    expect(internals.emailPollStatus.lastError).not.toBe("Command failed");
  });

  test("tras un fallo de conexión, 'polling' vuelve a false y el siguiente sondeo no se salta", async () => {
    mockMailbox.failConnectWith = "Command failed";
    await pollOnce();
    expect(internals.emailPollStatus.polling).toBe(false);

    // If it were stuck, this second poll would short-circuit with
    // "Ya hay un sondeo en curso" instead of actually trying again.
    const second = await pollOnce();
    expect(second.error).not.toMatch(/ya hay un sondeo en curso/i);
  });

  test("una vez restablecida la conexión, los correos pendientes se crean de inmediato", async () => {
    mockMailbox.failConnectWith = "Command failed";
    await pollOnce();

    mockMailbox.failConnectWith = null; // credenciales corregidas
    const contact = "pendiente@neurofic.com";
    addToMailbox({
      from: contact,
      subject: "Correo que quedó esperando",
      date: new Date(),
      messageId: `pendiente-${crypto.randomUUID()}@cliente.com`,
      text: "Este correo llegó mientras la conexión fallaba",
    });

    const result = await pollOnce();
    expect(result.created).toBe(1);
    expect(ticketsFor(contact).length).toBe(1);
  });
});

describe("Auto-recuperación del sondeo vía /api/health (incidente 2026-09-23)", () => {
  test("con lastPoll viejo (más del doble del intervalo), /api/health dispara un sondeo", async () => {
    internals.setEmailConfigForTest({ pollIntervalMinutes: 5 });
    internals.emailPollStatus.lastPoll = new Date(Date.now() - 15 * 60 * 1000).toISOString(); // 15 min, > 2×5
    internals.emailPollStatus.polling = false;

    const contact = "dormido@neurofic.com";
    addToMailbox({
      from: contact,
      subject: "Llegó mientras el proceso dormía",
      date: new Date(),
      messageId: `sleepy-${crypto.randomUUID()}@cliente.com`,
      text: "Contenido de prueba",
    });

    internals.maybeRecoverStalePoll();
    // pollEmails() es async y fire-and-forget dentro de maybeRecoverStalePoll —
    // esperar a que termine antes de comprobar.
    while (internals.emailPollStatus.polling) {
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(ticketsFor(contact).length).toBe(1);
  });

  test("con lastPoll reciente, /api/health NO dispara un sondeo extra", async () => {
    internals.setEmailConfigForTest({ pollIntervalMinutes: 5 });
    internals.emailPollStatus.lastPoll = new Date(Date.now() - 30 * 1000).toISOString(); // 30s, muy reciente
    internals.emailPollStatus.polling = false;

    const contact = "reciente@neurofic.com";
    addToMailbox({
      from: contact,
      subject: "No debería procesarse todavía",
      date: new Date(),
      messageId: `fresh-${crypto.randomUUID()}@cliente.com`,
      text: "Contenido de prueba",
    });

    internals.maybeRecoverStalePoll();
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(ticketsFor(contact).length).toBe(0);
  });

  test("con el correo deshabilitado, no intenta nada aunque lastPoll esté viejo", () => {
    internals.setEmailConfigForTest({ enabled: false });
    internals.emailPollStatus.lastPoll = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    internals.emailPollStatus.polling = false;
    expect(() => internals.maybeRecoverStalePoll()).not.toThrow();
    expect(internals.emailPollStatus.polling).toBe(false);
    enableEmailPolling(); // deja el config como lo esperan los demás tests
  });

  test("si ya hay un sondeo en curso, no dispara uno segundo", () => {
    internals.setEmailConfigForTest({ pollIntervalMinutes: 5 });
    internals.emailPollStatus.lastPoll = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    internals.emailPollStatus.polling = true;
    expect(() => internals.maybeRecoverStalePoll()).not.toThrow();
    internals.emailPollStatus.polling = false; // limpieza para no afectar otros tests
  });
});

describe("Fallback de matching por asunto+remitente (desde v14.44)", () => {
  test("correo sin cabeceras de hilo, mismo contacto y asunto Re: normalizado igual, ticket ABIERTO → se anexa, no crea uno nuevo", async () => {
    const contact = "sinheaders@neurofic.com";
    internals.store.tickets.push({
      id: "ND-9101",
      name: "Cliente Sin Headers",
      contact,
      area: "Correo",
      urgency: "media",
      status: "abierto",
      source: "email",
      subject: "Solicitud de acceso",
      description: "...",
      resolution: "",
      customFields: "{}",
      attachments: "[]",
      workedHours: null,
      position: -1,
      createdAt: new Date().toISOString(),
    });

    // Sin messageId, inReplyTo ni references — el cliente de correo del
    // remitente no las manda (o un relay las quitó).
    addToMailbox({
      from: contact,
      subject: "Re: Solicitud de acceso",
      date: new Date(),
      text: "¿Alguna novedad con esto?",
    });

    const result = await pollOnce();
    expect(result.created).toBe(0);

    const original = internals.getTicketById("ND-9101");
    expect(original.status).toBe("abierto");
    const lastNote = original.history[original.history.length - 1];
    expect(lastNote.note).toContain("¿Alguna novedad con esto?");
  });

  test("mismo escenario pero ticket RESUELTO → crea ticket nuevo con possibleDuplicateOf, sin reabrir ni alertar", async () => {
    const contact = "resuelto-sinheaders@neurofic.com";
    internals.store.tickets.push({
      id: "ND-9102",
      name: "Cliente Resuelto",
      contact,
      area: "Correo",
      urgency: "media",
      status: "resuelto",
      source: "email",
      subject: "Problema de acceso a SIIGO",
      description: "...",
      resolution: "listo",
      customFields: "{}",
      attachments: "[]",
      workedHours: null,
      position: -1,
      createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
      resolvedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    });

    addToMailbox({
      from: contact,
      subject: "Re: Problema de acceso a SIIGO",
      date: new Date(),
      text: "Gracias, pero sigue sin funcionar",
    });

    const result = await pollOnce();
    expect(result.created).toBe(1);

    const original = internals.getTicketById("ND-9102");
    expect(original.status).toBe("resuelto"); // nunca se reabre solo
    expect(original.reopenedByClient).toBeFalsy(); // nunca alerta

    const created = ticketsFor(contact).find((t) => t.id !== "ND-9102");
    expect(created).toBeTruthy();
    expect(created.possibleDuplicateOf).toBe("ND-9102");
  });

  test("con In-Reply-To presente pero que no calza con nada, NO cae al fallback de asunto (sigue sin match)", async () => {
    const contact = "headerspresentes@neurofic.com";
    internals.store.tickets.push({
      id: "ND-9103",
      name: "Cliente Headers",
      contact,
      area: "Correo",
      urgency: "media",
      status: "abierto",
      source: "email",
      subject: "Consulta general",
      description: "...",
      resolution: "",
      customFields: "{}",
      attachments: "[]",
      workedHours: null,
      position: -1,
      createdAt: new Date().toISOString(),
    });

    // Tiene cabeceras de hilo, pero no referencian nada que conozcamos — el
    // hilo real es distinto, aunque el asunto normalizado coincida.
    addToMailbox({
      from: contact,
      subject: "Re: Consulta general",
      date: new Date(),
      messageId: `otro-${crypto.randomUUID()}@cliente.com`,
      inReplyTo: `desconocido-${crypto.randomUUID()}@otro-dominio.com`,
      references: [`desconocido2-${crypto.randomUUID()}@otro-dominio.com`],
      text: "Esto es de un hilo completamente distinto",
    });

    const result = await pollOnce();
    expect(result.created).toBe(1); // no se anexó al ND-9103

    const original = internals.getTicketById("ND-9103");
    const createdSecond = ticketsFor(contact).find((t) => t.id !== "ND-9103");
    expect(createdSecond.possibleDuplicateOf).toBeFalsy(); // no es el fallback débil, es "none"
    expect(original.history.length).toBe(0); // nada se anexó al original
  });

  test("normalizeSubjectForMatching quita prefijos Re:/Fwd: anidados", () => {
    // Vía comportamiento observable: dos asuntos con distintos prefijos
    // anidados deben matchear igual en el fallback.
    const contact = "anidado@neurofic.com";
    internals.store.tickets.push({
      id: "ND-9104",
      name: "Cliente Anidado",
      contact,
      area: "Correo",
      urgency: "media",
      status: "abierto",
      source: "email",
      subject: "Consulta",
      description: "...",
      resolution: "",
      customFields: "{}",
      attachments: "[]",
      workedHours: null,
      position: -1,
      createdAt: new Date().toISOString(),
    });

    addToMailbox({
      from: contact,
      subject: "Re: Fwd: RE: Consulta",
      date: new Date(),
      text: "Nested prefixes",
    });

    return pollOnce().then((result) => {
      expect(result.created).toBe(0);
      const original = internals.getTicketById("ND-9104");
      expect(original.history.some((h) => h.note.includes("Nested prefixes"))).toBe(true);
    });
  });
});
