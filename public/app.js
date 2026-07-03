// ── DOM references ────────────────────────────────────────────────────────────

const form = document.querySelector("#ticketForm");
const formMessage = document.querySelector("#formMessage");
const overviewView = document.querySelector("#overviewView");
const createView = document.querySelector("#createView");
const slaView = document.querySelector("#slaView");
const settingsView = document.querySelector("#settingsView");
const adminView = document.querySelector("#adminView");
const createTicketButton = document.querySelector("#createTicketButton");
const cancelCreateButton = document.querySelector("#cancelCreateButton");
const slaButton = document.querySelector("#slaButton");
const settingsButton = document.querySelector("#settingsButton");
const adminButton = document.querySelector("#adminButton");
const backToOverviewButton = document.querySelector("#backToOverviewButton");
const backFromSettings = document.querySelector("#backFromSettingsButton");
const backFromAdminButton = document.querySelector("#backFromAdminButton");
const saveSettingsButton = document.querySelector("#saveSettingsButton");
const exportSlaButton = document.querySelector("#exportSlaButton");
const exportCsvButton = document.querySelector("#exportCsvButton");
const adminDeleteSelected = document.querySelector("#adminDeleteSelectedButton");
const kanbanBoard = document.querySelector("#kanbanBoard");
const ticketListView = document.querySelector("#ticketListView");
const statusFilter = document.querySelector("#statusFilter");
const appVersion = document.querySelector("#appVersion");
const statActiveCount = document.querySelector("#statActiveCount");
const statBreachedCount = document.querySelector("#statBreachedCount");
const statComplianceCount = document.querySelector("#statComplianceCount");
const statResolvedTodayCount = document.querySelector("#statResolvedTodayCount");
const metricRemaining = document.querySelector("#metricRemaining");
const slaFilteredCount = document.querySelector("#slaFilteredCount");
const slaDetailDonut = document.querySelector("#slaDetailDonut");
const slaDetailCompliance = document.querySelector("#slaDetailCompliance");
const slaStatusBars = document.querySelector("#slaStatusBars");
const slaUrgencyBars = document.querySelector("#slaUrgencyBars");
const slaTicketTable = document.querySelector("#slaTicketTable");
const slaReportMeta = document.querySelector("#slaReportMeta");
const slaDateFrom = document.querySelector("#slaDateFrom");
const slaDateTo = document.querySelector("#slaDateTo");
const slaStatusFilter = document.querySelector("#slaStatusFilter");
const slaAreaFilter = document.querySelector("#slaAreaFilter");
const slaUrgencyFilter = document.querySelector("#slaUrgencyFilter");
const slaStateFilter = document.querySelector("#slaStateFilter");
const slaTimeFilter = document.querySelector("#slaTimeFilter");
const slaSearchFilter = document.querySelector("#slaSearchFilter");
const createContactRow = document.querySelector("#createContactRow");
const createAreaRow = document.querySelector("#createAreaRow");
const createCustomFields = document.querySelector("#createCustomFields");
const contactFieldLabel = document.querySelector("#contactFieldLabel");
const areaFieldLabel = document.querySelector("#areaFieldLabel");
const currentUser = document.querySelector("#currentUser");
const logoutButton = document.querySelector("#logoutButton");
const sidebarToggle = document.querySelector("#sidebarToggle");
const sidebarOverviewButton = document.querySelector("#sidebarOverviewButton");
const addCustomFieldButton = document.querySelector("#addCustomFieldButton");
const customFieldsList = document.querySelector("#customFieldsList");

const ticketDetailModal = document.querySelector("#ticketDetailModal");
const closeTicketDetail = document.querySelector("#closeTicketDetail");
const ticketDetailId = document.querySelector("#ticketDetailId");
const detailSubject = document.querySelector("#detailSubject");
const detailDescription = document.querySelector("#detailDescription");
const detailName = document.querySelector("#detailName");
const detailContact = document.querySelector("#detailContact");
const detailAvatar = document.querySelector("#detailAvatar");
const detailStatus = document.querySelector("#detailStatus");
const detailUrgency = document.querySelector("#detailUrgency");
const detailArea = document.querySelector("#detailArea");
const detailResolution = document.querySelector("#detailResolution");
detailResolution?.addEventListener("input", () => updateAiSuggestLabel());
const detailWorkedHours = document.querySelector("#detailWorkedHours");
const detailMessage = document.querySelector("#detailMessage");
const detailCustomFields = document.querySelector("#detailCustomFields");
const detailHistory = document.querySelector("#detailHistory");
const saveTicketDetail = null; // button removed — fields auto-save on change
const resolveTicketDetail = document.querySelector("#resolveTicketDetail");
const closeTicketDetailStatus = document.querySelector("#closeTicketDetailStatus");
const detailDeleteButton = document.querySelector("#detailDeleteButton");
const detailAssignedTo = document.querySelector("#detailAssignedTo");
const sendReplyBtn = document.querySelector("#sendReplyBtn");
const boardSearch = document.querySelector("#boardSearch");
const boardAreaFilter = document.querySelector("#boardAreaFilter");
const boardDateFrom = document.querySelector("#boardDateFrom");
const boardDateTo = document.querySelector("#boardDateTo");
const attachFileInput = document.querySelector("#attachFileInput");
const uploadStatus = document.querySelector("#uploadStatus");
const saveQuickNote = document.querySelector("#saveQuickNote");
const globalSearch = document.querySelector("#globalSearch");
const notifPermBtn = document.querySelector("#notifPermBtn");
const closureNotifyClient = document.querySelector("#closureNotifyClient");

// Edit modal
const editModal = document.querySelector("#editModal");
const editTicketForm = document.querySelector("#editTicketForm");
const editTicketId = document.querySelector("#editTicketId");
const editModalTicketId = document.querySelector("#editModalTicketId");
const closeEditModal = document.querySelector("#closeEditModal");
const cancelEditButton = document.querySelector("#cancelEditButton");

// Closure reason modal
const closureReasonModal = document.querySelector("#closureReasonModal");
const closureReasonTitle = document.querySelector("#closureReasonTitle");
const closureReasonLabel = document.querySelector("#closureReasonLabel");
const closureReasonText = document.querySelector("#closureReasonText");
const closureReasonError = document.querySelector("#closureReasonError");
const confirmClosureBtn = document.querySelector("#confirmClosureBtn");
const cancelClosureBtn = document.querySelector("#cancelClosureBtn");
const cancelClosureX = document.querySelector("#cancelClosureX");
const editName = document.querySelector("#editName");
const editContact = document.querySelector("#editContact");
const editArea = document.querySelector("#editArea");
const editUrgency = document.querySelector("#editUrgency");
const editStatus = document.querySelector("#editStatus");
const editModalMessage = document.querySelector("#editModalMessage");
const editContactRow = document.querySelector("#editContactRow");
const editAreaRow = document.querySelector("#editAreaRow");

// Bulk bar
const bulkBar = document.querySelector("#bulkBar");
const bulkCount = document.querySelector("#bulkCount");
const bulkStatusSelect = document.querySelector("#bulkStatusSelect");
const bulkApplyButton = document.querySelector("#bulkApplyButton");
const bulkCancelButton = document.querySelector("#bulkCancelButton");
const bulkDeleteButton = document.querySelector("#bulkDeleteButton");

// Admin refs
const adminSearch = document.querySelector("#adminSearch");
const adminDateFrom = document.querySelector("#adminDateFrom");
const adminDateTo = document.querySelector("#adminDateTo");
const adminStatusFilter = document.querySelector("#adminStatusFilter");
const adminUrgencyFilter = document.querySelector("#adminUrgencyFilter");
const adminSummary = document.querySelector("#adminSummary");
const adminTicketTable = document.querySelector("#adminTicketTable");

// Change password form
const changePasswordForm = document.querySelector("#changePasswordForm");
const cpMessage = document.querySelector("#cpMessage");

// ── State ─────────────────────────────────────────────────────────────────────

let currentFilter = "todos";
let statFilter = null;

function applyStatFilter(key) {
  statFilter = key;
  statusFilter.value = "todos";
  currentFilter = "todos";
  document.querySelectorAll("[data-stat-filter]").forEach((c) => {
    c.classList.toggle("statCard--active", c.dataset.statFilter === key);
  });
  if (key === "resueltos_hoy" && !showClosedTickets) {
    showClosedTickets = true;
    if (toggleClosedBtn) {
      toggleClosedBtn.textContent = "Ocultar cerrados";
      toggleClosedBtn.classList.add("active");
    }
  }
  renderTickets();
  document.querySelector("#ticketBoard")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function clearStatFilter() {
  statFilter = null;
  document
    .querySelectorAll("[data-stat-filter]")
    .forEach((c) => c.classList.remove("statCard--active"));
}
let boardView = "cards";
let cachedTickets = [];
let appConfig = null;
const selectedTickets = new Set();
const adminSelected = new Set();
let refreshInFlight = null;
let liveEvents = null;
let activeTicketId = null;
let pendingClosureStatus = null;
let pendingClosureSilent = false;
let pendingReplyFiles = []; // {file: safeName, name: origName} — files uploaded while composing
let showClosedTickets = false;
let listPage = 1;
const LIST_PAGE_SIZE = 50;
let lastVisitTs = localStorage.getItem("nd_lastVisit") || new Date(0).toISOString();

// ── Constants ─────────────────────────────────────────────────────────────────

const statuses = [
  { key: "abierto", label: "Abierto" },
  { key: "en_proceso", label: "En proceso" },
  { key: "en_espera", label: "En espera" },
  { key: "resuelto", label: "Resuelto" },
  { key: "cerrado", label: "Cerrado" },
];

const urgencies = [
  { key: "baja", label: "Baja" },
  { key: "media", label: "Media" },
  { key: "alta", label: "Alta" },
  { key: "critica", label: "Crítica" },
];

const SLA_PRESETS = {
  standard: { baja: 24, media: 8, alta: 4, critica: 1 },
  relaxed: { baja: 48, media: 16, alta: 8, critica: 2 },
  strict: { baja: 12, media: 4, alta: 2, critica: 0.5 },
};

const formatDate = new Intl.DateTimeFormat("es-CO", { dateStyle: "medium", timeStyle: "short" });

// ── Utilities ─────────────────────────────────────────────────────────────────

async function requestJson(url, options) {
  const response = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Solicitud no completada.");
  return data;
}

function escapeHtml(value) {
  return String(value || "").replace(
    /[&<>"']/g,
    (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[char]
  );
}

function getLabel(items, key) {
  return items.find((item) => item.key === key)?.label || key;
}

// ── Views ─────────────────────────────────────────────────────────────────────

const VIEW_TITLES = {
  overview: "Resumen",
  create: "Nuevo ticket",
  sla: "Estadísticas SLA",
  settings: "Configuración",
  admin: "Tickets",
};

const VIEW_EYEBROWS = {
  overview: null,
  create: null,
  sla: "INDICADORES",
  settings: "AJUSTES",
  admin: "ADMINISTRACIÓN",
};

function updateTopbarDate() {
  const el = document.getElementById("topbarDate");
  if (!el) return;
  const now = new Date();
  const day = now.toLocaleDateString("es-ES", { weekday: "long" }).toUpperCase();
  const date = now
    .toLocaleDateString("es-ES", { day: "numeric", month: "long" })
    .toUpperCase();
  el.textContent = `${day} · ${date}`;
}

function showView(name) {
  ticketDetailModal.hidden = true;
  overviewView.classList.toggle("active", name === "overview");
  createView.classList.toggle("active", name === "create");
  slaView.classList.toggle("active", name === "sla");
  settingsView.classList.toggle("active", name === "settings");
  adminView.classList.toggle("active", name === "admin");

  const topbarTitle = document.getElementById("topbarTitle");
  if (topbarTitle) topbarTitle.textContent = VIEW_TITLES[name] || "NeuroDesk";

  const topbarDateEl = document.getElementById("topbarDate");
  if (topbarDateEl) {
    const eyebrow = VIEW_EYEBROWS[name];
    if (eyebrow != null) {
      topbarDateEl.textContent = eyebrow;
    } else {
      updateTopbarDate();
    }
  }

  if (name !== "overview") {
    selectedTickets.clear();
    updateBulkBar();
  }
  if (name !== "admin") {
    adminSelected.clear();
  }
  document.querySelectorAll(".sidebarItem").forEach((btn) => btn.classList.remove("active"));
  if (name === "overview") {
    sidebarOverviewButton?.classList.add("active");
    lastVisitTs = new Date().toISOString();
    localStorage.setItem("nd_lastVisit", lastVisitTs);
    const badge = document.getElementById("sidebarTicketCount");
    if (badge) badge.classList.remove("sidebarBadge--new");
  }
  if (name === "admin") adminButton?.classList.add("active");
  if (name === "sla") slaButton?.classList.add("active");
  if (name === "settings") settingsButton?.classList.add("active");
}

updateTopbarDate();

function showDetailView() {
  overviewView.classList.remove("active");
  createView.classList.remove("active");
  slaView.classList.remove("active");
  settingsView.classList.remove("active");
  adminView.classList.remove("active");
  ticketDetailModal.hidden = false;
  document.querySelectorAll(".sidebarItem").forEach((btn) => btn.classList.remove("active"));
  sidebarOverviewButton?.classList.add("active");
}

// ── Config ────────────────────────────────────────────────────────────────────

async function loadConfig() {
  try {
    appConfig = await requestJson("/api/config");
  } catch (_) {
    appConfig = {
      sla: { baja: 24, media: 8, alta: 4, critica: 1 },
      fields: {
        contact: { enabled: true, label: "Contacto" },
        area: { enabled: true, label: "Área" },
      },
    };
  }
  applyFieldConfig();
  populateSettingsPanel();
}

function applyFieldConfig() {
  if (!appConfig) return;
  const { contact, area } = appConfig.fields;

  createContactRow.hidden = !contact.enabled;
  createContactRow.querySelector("input").required = contact.enabled;
  contactFieldLabel.textContent = contact.label;

  createAreaRow.hidden = !area.enabled;
  createAreaRow.querySelector("input").required = area.enabled;
  areaFieldLabel.textContent = area.label;

  editContactRow.hidden = false;
  editAreaRow.hidden = false;
  renderCreateCustomFieldInputs();
}

function populateSettingsPanel() {
  if (!appConfig) return;
  document.querySelector("#slaBaja").value = appConfig.sla.baja;
  document.querySelector("#slaMedia").value = appConfig.sla.media;
  document.querySelector("#slaAlta").value = appConfig.sla.alta;
  document.querySelector("#slaCritica").value = appConfig.sla.critica;

  // Business hours per-day
  const bh = appConfig.businessHours || {};
  const bhEnabled = document.querySelector("#bhEnabled");
  const bhSched = bh.schedule || {};
  if (bhEnabled) {
    bhEnabled.setAttribute("aria-pressed", bh.enabled ? "true" : "false");
    bhEnabled.querySelector(".bhToggleLabel").textContent = bh.enabled ? "Activo" : "Inactivo";
    document.getElementById("bhOptions").style.display = bh.enabled ? "" : "none";
  }
  document.querySelectorAll(".bhDayEntry").forEach(entry => {
    const day = String(entry.dataset.day);
    const dayConf = bhSched[day] || { enabled: [1,2,3,4,5].includes(Number(day)), start: "07:00", end: "17:00" };
    const check = entry.querySelector(".bhDayCheck");
    const startInput = entry.querySelector(".bhDayStart");
    const endInput = entry.querySelector(".bhDayEnd");
    if (check) check.checked = dayConf.enabled;
    if (startInput) startInput.value = dayConf.start || "07:00";
    if (endInput) endInput.value = dayConf.end || "17:00";
    entry.querySelectorAll(".bhTimeInput").forEach(inp => {
      inp.disabled = !dayConf.enabled;
      inp.style.opacity = dayConf.enabled ? "1" : "0.35";
    });
  });

  document.querySelector("#fieldContactEnabled").checked = appConfig.fields.contact.enabled;
  document.querySelector("#fieldContactLabel").value = appConfig.fields.contact.label;
  document.querySelector("#fieldAreaEnabled").checked = appConfig.fields.area.enabled;
  document.querySelector("#fieldAreaLabel").value = appConfig.fields.area.label;
  renderCustomFieldsBuilder();

  const portalUrl = `${window.location.origin}/portal`;
  document.querySelector("#portalUrlDisplay").textContent = portalUrl;
  document.querySelector("#openPortalLink").href = "/portal";
}

// Business hours toggle
document.querySelector("#bhEnabled")?.addEventListener("click", function () {
  const pressed = this.getAttribute("aria-pressed") === "true";
  const next = !pressed;
  this.setAttribute("aria-pressed", String(next));
  this.querySelector(".bhToggleLabel").textContent = next ? "Activo" : "Inactivo";
  const bhOptions = document.querySelector("#bhOptions");
  if (bhOptions) bhOptions.style.display = next ? "" : "none";
});

// Per-day checkbox toggle — dim/undim time inputs
document.querySelectorAll(".bhDayCheck").forEach(check => {
  check.addEventListener("change", () => {
    const entry = check.closest(".bhDayEntry");
    entry && entry.querySelectorAll(".bhTimeInput").forEach(inp => {
      inp.disabled = !check.checked;
      inp.style.opacity = check.checked ? "1" : "0.35";
    });
  });
});

// Validate and auto-correct HH:MM format on blur
document.querySelectorAll(".bhTimeInput").forEach(inp => {
  inp.addEventListener("blur", () => {
    const v = inp.value.trim();
    const m = v.match(/^(\d{1,2}):?(\d{2})$/);
    if (m) {
      const h = Math.min(23, parseInt(m[1], 10));
      const min = Math.min(59, parseInt(m[2], 10));
      inp.value = String(h).padStart(2, "0") + ":" + String(min).padStart(2, "0");
      inp.style.borderColor = "";
    } else if (v) {
      inp.style.borderColor = "var(--danger, #ff3b30)";
    }
  });
});

function renderCustomFieldsBuilder() {
  if (!customFieldsList) return;
  const fields = appConfig?.customFields || [];
  customFieldsList.innerHTML =
    fields
      .map(
        (field, index) => `
    <div class="customFieldRow" data-field-index="${index}">
      <label>Etiqueta<input class="customFieldLabel" type="text" value="${escapeHtml(field.label)}" maxlength="60"></label>
      <label>Tipo<select class="customFieldType"><option value="text" ${field.type !== "select" ? "selected" : ""}>Texto</option><option value="select" ${field.type === "select" ? "selected" : ""}>Lista</option></select></label>
      <label>Opciones<input class="customFieldOptions" type="text" value="${escapeHtml(field.options || "")}" placeholder="Opcion 1, Opcion 2"></label>
      <label class="toggleRow"><span>Activo</span><input class="customFieldEnabled" type="checkbox" ${field.enabled !== false ? "checked" : ""}></label>
      <button class="ghostButton removeCustomField" type="button">Eliminar</button>
    </div>
  `
      )
      .join("") || '<p class="empty compact">Sin campos personalizados.</p>';
}

function collectCustomFieldsConfig() {
  return [...document.querySelectorAll(".customFieldRow")].map((row, index) => {
    const label = row.querySelector(".customFieldLabel").value.trim() || `Campo ${index + 1}`;
    return {
      label,
      key: label
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9_]+/g, "_")
        .replace(/^_+|_+$/g, ""),
      type: row.querySelector(".customFieldType").value,
      options: row.querySelector(".customFieldOptions").value.trim(),
      enabled: row.querySelector(".customFieldEnabled").checked,
    };
  });
}

function renderCustomFieldInputs(ticket = {}) {
  const fields = (appConfig?.customFields || []).filter((f) => f.enabled);
  const values = ticket.customFields || {};
  detailCustomFields.innerHTML = fields
    .map((field) => {
      if (field.type === "select") {
        const options = String(field.options || "")
          .split(",")
          .map((opt) => opt.trim())
          .filter(Boolean);
        return `<label>${escapeHtml(field.label)}<select data-custom-field="${escapeHtml(field.key)}"><option value=""></option>${options.map((opt) => `<option value="${escapeHtml(opt)}" ${values[field.key] === opt ? "selected" : ""}>${escapeHtml(opt)}</option>`).join("")}</select></label>`;
      }
      return `<label>${escapeHtml(field.label)}<input data-custom-field="${escapeHtml(field.key)}" type="text" value="${escapeHtml(values[field.key] || "")}"></label>`;
    })
    .join("");
}

function renderCreateCustomFieldInputs() {
  if (!createCustomFields) return;
  const fields = (appConfig?.customFields || []).filter((f) => f.enabled);
  createCustomFields.innerHTML = fields
    .map((field) => {
      if (field.type === "select") {
        const options = String(field.options || "")
          .split(",")
          .map((opt) => opt.trim())
          .filter(Boolean);
        return `<label><span class="fieldLabel">${escapeHtml(field.label)}</span><select data-create-custom-field="${escapeHtml(field.key)}"><option value=""></option>${options.map((opt) => `<option value="${escapeHtml(opt)}">${escapeHtml(opt)}</option>`).join("")}</select></label>`;
      }
      return `<label><span class="fieldLabel">${escapeHtml(field.label)}</span><input data-create-custom-field="${escapeHtml(field.key)}" type="text"></label>`;
    })
    .join("");
}

function collectCreateCustomFields() {
  const values = {};
  createCustomFields?.querySelectorAll("[data-create-custom-field]").forEach((input) => {
    values[input.dataset.createCustomField] = input.value;
  });
  return values;
}

// ── Stats & charts ────────────────────────────────────────────────────────────

function complianceColor(pct) {
  if (pct >= 80) return "var(--donut-ok)";
  if (pct >= 50) return "var(--donut-warn)";
  return "var(--donut-danger)";
}

function renderStats(stats) {
  const compliance = stats.slaCompliance || 0;
  const active = stats.open || 0;
  const breached = stats.breached || 0;

  if (statActiveCount) statActiveCount.textContent = active;
  if (statBreachedCount) statBreachedCount.textContent = breached;
  if (statComplianceCount) statComplianceCount.textContent = `${compliance}%`;

  // Color rojo en SLA vencido solo cuando hay tickets fuera de SLA
  const slaCard = document.querySelector("[data-stat-filter='sla_vencido']");
  if (slaCard) slaCard.classList.toggle("statCard--danger", breached > 0);

  if (statResolvedTodayCount) {
    const today = new Date().toDateString();
    const resolvedToday = cachedTickets.filter(
      (t) =>
        (t.status === "resuelto" || t.status === "cerrado") &&
        t.resolvedAt &&
        new Date(t.resolvedAt).toDateString() === today
    ).length;
    statResolvedTodayCount.textContent = resolvedToday;
  }

  if (slaDetailCompliance) slaDetailCompliance.textContent = `${compliance}%`;
  if (slaDetailDonut) slaDetailDonut.style.setProperty("--value", compliance);
  if (slaDetailDonut)
    slaDetailDonut.style.setProperty("--donut-color", complianceColor(compliance));

  renderBars(slaStatusBars, statuses, stats.byStatus || {});
  renderBars(slaUrgencyBars, urgencies, stats.byUrgency || {});
}

function renderVersion(info) {
  if (appVersion) appVersion.textContent = `v${info.version}`;
}

function renderBars(container, items, values) {
  if (!container) return;
  const max = Math.max(...items.map((item) => values[item.key] || 0), 1);
  container.innerHTML = items
    .map((item) => {
      const count = values[item.key] || 0;
      const width = Math.max((count / max) * 100, count > 0 ? 12 : 0);
      return `
      <div class="statusBar" data-key="${item.key}">
        <span>${item.label}</span>
        <div><i style="width: ${width}%"></i></div>
        <strong>${count}</strong>
      </div>
    `;
    })
    .join("");
}

// ── Ticket board ──────────────────────────────────────────────────────────────

function getVisibleTickets() {
  const today = new Date().toDateString();
  if (statFilter === "activos") {
    return cachedTickets.filter((t) => ["abierto", "en_proceso", "en_espera"].includes(t.status));
  }
  if (statFilter === "sla_vencido") {
    return cachedTickets.filter((t) => t.sla && t.sla.breached && t.status !== "cerrado");
  }
  if (statFilter === "resueltos_hoy") {
    return cachedTickets.filter(
      (t) =>
        (t.status === "resuelto" || t.status === "cerrado") &&
        t.resolvedAt &&
        new Date(t.resolvedAt).toDateString() === today
    );
  }
  let tickets = showClosedTickets
    ? cachedTickets
    : cachedTickets.filter((t) => t.status !== "cerrado");
  if (currentFilter !== "todos") tickets = tickets.filter((t) => t.status === currentFilter);

  const search = boardSearch?.value.trim().toLowerCase() || "";
  if (search) {
    tickets = tickets.filter((t) => {
      const haystack = [t.id, t.name, t.contact, t.subject, t.description, t.area, t.assignedTo]
        .join(" ").toLowerCase();
      return haystack.includes(search);
    });
  }
  const area = boardAreaFilter?.value || "";
  if (area) tickets = tickets.filter((t) => t.area === area);

  const from = boardDateFrom?.value ? new Date(boardDateFrom.value) : null;
  const to = boardDateTo?.value ? new Date(boardDateTo.value + "T23:59:59") : null;
  if (from) tickets = tickets.filter((t) => new Date(t.createdAt) >= from);
  if (to) tickets = tickets.filter((t) => new Date(t.createdAt) <= to);

  return tickets;
}

function renderTickets() {
  const visible = getVisibleTickets();
  const isCardView = boardView === "cards";
  kanbanBoard.hidden = !isCardView;
  ticketListView.hidden = isCardView;

  if (isCardView) {
    ticketListView.innerHTML = "";
    renderKanban(visible);
  } else {
    kanbanBoard.innerHTML = "";
    renderTicketList(visible);
  }
}

function renderKanban(tickets) {
  const visibleStatuses = showClosedTickets
    ? statuses
    : statuses.filter((s) => s.key !== "cerrado");
  kanbanBoard.innerHTML = visibleStatuses
    .map((status) => {
      const cols = tickets.filter((t) => t.status === status.key);
      const cards = cols.map(renderTicketCard).join("");
      return `
      <section class="kanbanColumn" data-status="${status.key}">
        <header><h3>${status.label}</h3><span>${cols.length}</span></header>
        <div class="dropZone" data-status="${status.key}">
          ${cards || '<p class="empty compact">Sin tickets</p>'}
        </div>
      </section>
    `;
    })
    .join("");
}

function sentimentIcon(s) {
  if (s === "muy_negativo") return '<span class="sentimentIcon sentimentIcon--muy_negativo" title="Cliente muy frustrado">😤</span>';
  if (s === "negativo") return '<span class="sentimentIcon sentimentIcon--negativo" title="Cliente insatisfecho">😟</span>';
  if (s === "positivo") return '<span class="sentimentIcon sentimentIcon--positivo" title="Cliente satisfecho">😊</span>';
  return "";
}

function renderTicketCard(ticket) {
  const slaCls = ticket.sla.paused ? "paused" : ticket.sla.breached ? "breached" : "";
  const slaText = ticket.sla.paused
    ? "SLA pausado"
    : ticket.sla.breached
      ? "SLA vencido"
      : `SLA ${ticket.sla.remainingHours}h`;
  const createdAt = formatDate.format(new Date(ticket.createdAt));
  const isNew = ticket.createdAt > lastVisitTs;
  const reopenedBadge = ticket.reopenedByClient
    ? '<span class="badge badge--reopened" title="Cliente insatisfecho — reabrió el ticket">🔄 Reabierto</span>'
    : "";
  const categoryBadge = ticket.aiCategory
    ? `<span class="badge badge--ai-category">${escapeHtml(ticket.aiCategory)}</span>`
    : "";
  return `
    <article class="ticketCard urgency-${escapeHtml(ticket.urgency)}${isNew ? " ticketCard--new" : ""}${ticket.reopenedByClient ? " ticketCard--reopened" : ""}" draggable="true" data-ticket-id="${escapeHtml(ticket.id)}">
      <div class="ticketTitle">
        <span>${escapeHtml(ticket.id)}${isNew ? '<span class="newBadge">Nuevo</span>' : ""}${reopenedBadge}</span>
        <span style="display:flex;align-items:center;gap:4px">${sentimentIcon(ticket.aiSentiment)}<span class="badge ${escapeHtml(ticket.urgency)}">${escapeHtml(ticket.urgency)}</span></span>
      </div>
      <p class="ticketName">${escapeHtml(ticket.name)}</p>
      ${ticket.subject ? `<p class="ticketSubject">${escapeHtml(ticket.subject)}</p>` : ""}
      <p class="ticketMeta">${escapeHtml(ticket.contact)}</p>
      ${categoryBadge}
      ${ticket.assignedTo ? `<p class="ticketAssigned">👤 ${escapeHtml(ticket.assignedTo)}</p>` : ""}
      <div class="cardFooter">
        <span class="sla ${slaCls}"><span class="slaDot"></span>${slaText}</span>
        <span class="ticketDate">${createdAt}</span>
      </div>
    </article>
  `;
}

function renderTicketList(tickets) {
  if (tickets.length === 0) {
    ticketListView.innerHTML = '<p class="empty">Sin tickets para este filtro.</p>';
    return;
  }
  const visible = tickets.slice(0, listPage * LIST_PAGE_SIZE);
  const hasMore = tickets.length > visible.length;
  ticketListView.innerHTML = `
    <div class="tableWrap">
      <table>
        <thead>
          <tr>
            <th><input type="checkbox" id="selectAllCheckbox" class="bulkCheckbox" aria-label="Seleccionar todos"></th>
            <th>Ticket</th><th>Solicitante</th><th>Contacto</th><th>Área</th>
            <th>Urgencia</th><th>SLA</th><th>Estado</th><th>Asignado</th><th></th>
          </tr>
        </thead>
        <tbody>
          ${visible
            .map((ticket) => {
              const slaCls = ticket.sla.paused ? "paused" : ticket.sla.breached ? "breached" : "";
              const slaText = ticket.sla.paused ? "Pausado" : ticket.sla.breached ? "Vencido" : `${ticket.sla.remainingHours}h`;
              const isNew = ticket.createdAt > lastVisitTs;
              return `
              <tr class="ticketRow${isNew ? " ticketRow--new" : ""}" data-ticket-id="${escapeHtml(ticket.id)}">
                <td><input type="checkbox" class="bulkCheckbox rowCheckbox" data-ticket-id="${escapeHtml(ticket.id)}" ${selectedTickets.has(ticket.id) ? "checked" : ""}></td>
                <td><span class="ticketCode">${escapeHtml(ticket.id)}</span>${isNew ? '<span class="newBadge">Nuevo</span>' : ""}</td>
                <td class="subjectCell">${escapeHtml(ticket.subject || ticket.description || "(sin asunto)")}</td>
                <td>${escapeHtml(ticket.name)}</td>
                <td>${escapeHtml(ticket.contact)}</td>
                <td>${escapeHtml(ticket.area)}</td>
                <td><span class="badge ${escapeHtml(ticket.urgency)}">${escapeHtml(ticket.urgency)}</span></td>
                <td><span class="sla ${slaCls}">${slaText}</span></td>
                <td>${renderStatusSelect(ticket)}</td>
                <td class="assignedCell">${escapeHtml(ticket.assignedTo || "—")}</td>
                <td class="rowActions"></td>
              </tr>
            `;
            })
            .join("")}
        </tbody>
      </table>
    </div>
    ${hasMore ? `<button class="loadMoreBtn" id="loadMoreBtn">Cargar más (${tickets.length - visible.length} restantes)</button>` : ""}
  `;
  const allSelected = visible.every((t) => selectedTickets.has(t.id));
  const selectAll = document.querySelector("#selectAllCheckbox");
  if (selectAll) {
    selectAll.checked = allSelected && visible.length > 0;
    selectAll.indeterminate = !allSelected && selectedTickets.size > 0;
  }
  document.querySelector("#loadMoreBtn")?.addEventListener("click", () => {
    listPage++;
    renderTickets();
  });
}

function renderStatusSelect(ticket) {
  return `
    <select class="statusSelect" aria-label="Cambiar estado de ${escapeHtml(ticket.id)}" data-ticket-id="${escapeHtml(ticket.id)}">
      ${statuses.map((s) => `<option value="${s.key}" ${ticket.status === s.key ? "selected" : ""}>${s.label}</option>`).join("")}
    </select>
  `;
}

// ── Admin view ────────────────────────────────────────────────────────────────

function getFilteredAdminTickets() {
  const search = adminSearch.value.trim().toLowerCase();
  const from = adminDateFrom.value ? new Date(`${adminDateFrom.value}T00:00:00`) : null;
  const to = adminDateTo.value ? new Date(`${adminDateTo.value}T23:59:59`) : null;
  const status = adminStatusFilter.value;
  const urgency = adminUrgencyFilter.value;

  return cachedTickets.filter((t) => {
    const text = `${t.id} ${t.name} ${t.contact} ${t.area}`.toLowerCase();
    const createdAt = new Date(t.createdAt);
    if (search && !text.includes(search)) return false;
    if (from && createdAt < from) return false;
    if (to && createdAt > to) return false;
    if (status !== "todos" && t.status !== status) return false;
    if (urgency !== "todos" && t.urgency !== urgency) return false;
    return true;
  });
}

function renderAdminView() {
  const filtered = getFilteredAdminTickets();

  // Summary bar
  const byStatus = statuses.reduce((acc, s) => {
    acc[s.key] = filtered.filter((t) => t.status === s.key).length;
    return acc;
  }, {});
  adminSummary.innerHTML = `
    <span class="adminStat"><strong>${filtered.length}</strong> tickets</span>
    ${statuses.map((s) => `<span class="adminStat adminStat--${s.key}"><strong>${byStatus[s.key]}</strong> ${s.label.toLowerCase()}</span>`).join("")}
  `;

  adminDeleteSelected.hidden = adminSelected.size === 0;

  if (filtered.length === 0) {
    adminTicketTable.innerHTML =
      '<p class="empty">No hay tickets para los filtros seleccionados.</p>';
    return;
  }

  const allSelected = filtered.length > 0 && filtered.every((t) => adminSelected.has(t.id));

  adminTicketTable.innerHTML = `
    <div class="tableWrap">
      <table>
        <thead>
          <tr>
            <th><input type="checkbox" id="adminSelectAll" class="bulkCheckbox" ${allSelected ? "checked" : ""} aria-label="Seleccionar todos"></th>
            <th>Ticket</th><th>Nombre</th><th>Contacto</th><th>Área</th>
            <th>Urgencia</th><th>Estado</th><th>Creado</th><th></th>
          </tr>
        </thead>
        <tbody>
          ${filtered
            .map(
              (t) => `
            <tr>
              <td><input type="checkbox" class="bulkCheckbox adminRowCheckbox" data-id="${escapeHtml(t.id)}" ${adminSelected.has(t.id) ? "checked" : ""}></td>
              <td><code class="ticketCode">${escapeHtml(t.id)}</code></td>
              <td>${escapeHtml(t.name)}</td>
              <td>${escapeHtml(t.contact)}</td>
              <td>${escapeHtml(t.area)}</td>
              <td><span class="badge ${escapeHtml(t.urgency)}">${escapeHtml(t.urgency)}</span></td>
              <td><span class="statusPill status-${escapeHtml(t.status)}">${escapeHtml(getLabel(statuses, t.status))}</span></td>
              <td class="dateCell">${formatDate.format(new Date(t.createdAt))}</td>
              <td class="adminActions">
                <button class="editTicketButton" data-edit-id="${escapeHtml(t.id)}" type="button" title="Editar">✎</button>
                <button class="deleteTicketButton" data-delete-id="${escapeHtml(t.id)}" type="button" title="Eliminar">✕</button>
              </td>
            </tr>
          `
            )
            .join("")}
        </tbody>
      </table>
    </div>
  `;

  const selectAllEl = document.querySelector("#adminSelectAll");
  if (selectAllEl) selectAllEl.indeterminate = adminSelected.size > 0 && !allSelected;
}

async function deleteTicket(id) {
  if (!confirm(`¿Eliminar el ticket ${id}? Esta acción no se puede deshacer.`)) return;
  try {
    await requestJson(`/api/tickets/${encodeURIComponent(id)}`, { method: "DELETE" });
    adminSelected.delete(id);
    await refresh();
    renderAdminView();
  } catch (err) {
    alert(err.message);
  }
}

async function deleteSelectedTickets() {
  const ids = [...adminSelected];
  if (ids.length === 0) return;
  if (!confirm(`¿Eliminar ${ids.length} ticket(s)? Esta acción no se puede deshacer.`)) return;
  try {
    await requestJson("/api/tickets", { method: "DELETE", body: JSON.stringify({ ids }) });
    adminSelected.clear();
    await refresh();
    renderAdminView();
  } catch (err) {
    alert(err.message);
  }
}

async function deleteSelectedBoardTickets() {
  const ids = [...selectedTickets];
  if (ids.length === 0) return;
  if (!confirm(`¿Eliminar ${ids.length} ticket(s)? Esta acción no se puede deshacer.`)) return;
  try {
    await requestJson("/api/tickets", { method: "DELETE", body: JSON.stringify({ ids }) });
    selectedTickets.clear();
    updateBulkBar();
    await refresh();
  } catch (err) {
    alert(err.message);
  }
}

function downloadCsv() {
  const filtered = getFilteredAdminTickets();
  if (filtered.length === 0) {
    alert("No hay tickets para exportar.");
    return;
  }

  const headers = ["ID", "Nombre", "Contacto", "Área", "Urgencia", "Estado", "Fuente", "Horas trabajadas", "Creado"];
  const rows = filtered.map((t) => [
    t.id,
    t.name,
    t.contact,
    t.area,
    t.urgency,
    t.status,
    t.source,
    t.workedHours ?? "",
    t.createdAt,
  ]);
  const csv = [headers, ...rows]
    .map((row) => row.map((cell) => `"${String(cell || "").replace(/"/g, '""')}"`).join(","))
    .join("\n");

  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `neurodesk-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ── SLA report ────────────────────────────────────────────────────────────────

function renderSlaFilters() {
  const areas = [...new Set(cachedTickets.map((t) => t.area).filter(Boolean))].sort();
  const currentArea = slaAreaFilter.value || "todos";
  slaAreaFilter.innerHTML = `
    <option value="todos">Todas</option>
    ${areas.map((a) => `<option value="${escapeHtml(a)}">${escapeHtml(a)}</option>`).join("")}
  `;
  if (areas.includes(currentArea)) slaAreaFilter.value = currentArea;
}

function getFilteredSlaTickets() {
  const from = slaDateFrom.value ? new Date(`${slaDateFrom.value}T00:00:00`) : null;
  const to = slaDateTo.value ? new Date(`${slaDateTo.value}T23:59:59`) : null;
  const status = slaStatusFilter.value;
  const area = slaAreaFilter.value;
  const urgency = slaUrgencyFilter.value;
  const slaState = slaStateFilter.value;
  const timeLimit = slaTimeFilter.value === "todos" ? null : Number(slaTimeFilter.value);
  const search = slaSearchFilter.value.trim().toLowerCase();

  return cachedTickets.filter((ticket) => {
    const createdAt = new Date(ticket.createdAt);
    const text = `${ticket.id} ${ticket.name} ${ticket.contact} ${ticket.area}`.toLowerCase();
    if (from && createdAt < from) return false;
    if (to && createdAt > to) return false;
    if (status !== "todos" && ticket.status !== status) return false;
    if (area !== "todos" && ticket.area !== area) return false;
    if (urgency !== "todos" && ticket.urgency !== urgency) return false;
    if (slaState === "vigente" && ticket.sla.breached) return false;
    if (slaState === "vencido" && !ticket.sla.breached) return false;
    if (timeLimit !== null && ticket.sla.remainingHours > timeLimit) return false;
    if (search && !text.includes(search)) return false;
    return true;
  });
}

function hoursLabel(h) {
  if (h == null || isNaN(h)) return "—";
  if (h < 1) return `${Math.round(h * 60)}min`;
  if (h < 24) return `${h.toFixed(1)}h`;
  const days = Math.floor(h / 24);
  const rem = Math.round(h % 24);
  return rem > 0 ? `${days}d ${rem}h` : `${days}d`;
}

function summarizeTickets(tickets) {
  const active = tickets.filter((t) => t.status !== "resuelto" && t.status !== "cerrado");
  const breached = active.filter((t) => t.sla.breached);
  const byStatus = statuses.reduce((acc, s) => {
    acc[s.key] = tickets.filter((t) => t.status === s.key).length;
    return acc;
  }, {});
  const byUrgency = urgencies.reduce((acc, u) => {
    acc[u.key] = tickets.filter((t) => t.urgency === u.key).length;
    return acc;
  }, {});
  // Top areas
  const areaCounts = {};
  tickets.forEach((t) => { if (t.area) areaCounts[t.area] = (areaCounts[t.area] || 0) + 1; });
  const topAreas = Object.entries(areaCounts).sort((a, b) => b[1] - a[1]).slice(0, 8);

  // Top contacts
  const contactMap = {};
  tickets.forEach((t) => {
    const key = t.contact || t.name || "";
    if (!key) return;
    if (!contactMap[key]) contactMap[key] = { name: t.name || key, contact: t.contact || "", count: 0 };
    contactMap[key].count++;
  });
  const topContacts = Object.values(contactMap).sort((a, b) => b.count - a.count).slice(0, 8);

  // Compliance: sobre TODOS los tickets del período (activos + cerrados)
  // Un ticket cerrado que se resolvió a tiempo cuenta como cumplido
  const allBreached = tickets.filter((t) => t.sla.breached).length;
  const compliance = tickets.length === 0
    ? 100
    : Math.round(((tickets.length - allBreached) / tickets.length) * 100);
  const avgRemaining =
    active.length === 0
      ? 0
      : Number((active.reduce((sum, t) => sum + t.sla.remainingHours, 0) / active.length).toFixed(1));

  // Avg resolution time — from createdAt to first resolved/closed history entry
  const resTimes = [];
  tickets.forEach((t) => {
    if ((t.status === "resuelto" || t.status === "cerrado") && Array.isArray(t.history)) {
      const resolvedEntry = t.history.find((h) => h.status === "resuelto" || h.status === "cerrado");
      if (resolvedEntry) {
        const ms = new Date(resolvedEntry.createdAt) - new Date(t.createdAt);
        if (ms > 0) resTimes.push(ms / 3_600_000);
      }
    }
  });
  const avgResolutionHours = resTimes.length > 0
    ? Number((resTimes.reduce((s, v) => s + v, 0) / resTimes.length).toFixed(1))
    : null;

  // Avg first response time — from createdAt to first history entry
  const respTimes = [];
  tickets.forEach((t) => {
    if (Array.isArray(t.history) && t.history.length > 0) {
      const first = t.history[0];
      const ms = new Date(first.createdAt) - new Date(t.createdAt);
      if (ms > 0) respTimes.push(ms / 3_600_000);
    }
  });
  const avgFirstResponseHours = respTimes.length > 0
    ? Number((respTimes.reduce((s, v) => s + v, 0) / respTimes.length).toFixed(1))
    : null;

  return {
    byStatus,
    byUrgency,
    topAreas,
    topContacts,
    compliance,
    avgRemainingHours: avgRemaining,
    breached: breached.length,
    avgResolutionHours,
    avgFirstResponseHours,
  };
}


function renderSlaReport() {
  const filtered = getFilteredSlaTickets();
  const summary = summarizeTickets(filtered);

  if (slaFilteredCount) slaFilteredCount.textContent = filtered.length;
  if (slaDetailCompliance) slaDetailCompliance.textContent = `${summary.compliance}%`;
  if (metricRemaining) metricRemaining.textContent = `${summary.avgRemainingHours}h`;
  if (slaDetailDonut) slaDetailDonut.style.setProperty("--value", summary.compliance);
  if (slaDetailDonut) slaDetailDonut.style.setProperty("--donut-color", complianceColor(summary.compliance));

  const metricBreachedEl = document.getElementById("metricBreached");
  if (metricBreachedEl) metricBreachedEl.textContent = summary.breached;

  const metricAvgRes = document.getElementById("metricAvgResolution");
  if (metricAvgRes) metricAvgRes.textContent = hoursLabel(summary.avgResolutionHours);

  const metricAvgResp = document.getElementById("metricAvgFirstResponse");
  if (metricAvgResp) metricAvgResp.textContent = hoursLabel(summary.avgFirstResponseHours);

  renderBars(slaStatusBars, statuses, summary.byStatus);
  renderBars(slaUrgencyBars, urgencies, summary.byUrgency);

  // Top areas
  const areaEl = document.getElementById("slaAreaBars");
  if (areaEl && summary.topAreas.length > 0) {
    const maxA = summary.topAreas[0][1];
    areaEl.innerHTML = summary.topAreas.map(([area, count]) => {
      const pct = Math.round((count / maxA) * 100);
      return `<div class="statusBar">
        <span class="statusBarLabel">${escapeHtml(area)}</span>
        <div class="statusBarTrack"><div class="statusBarFill" style="width:${pct}%;background:var(--brand)"></div></div>
        <span class="statusBarCount">${count}</span>
      </div>`;
    }).join("");
  } else if (areaEl) {
    areaEl.innerHTML = '<p class="empty" style="font-size:0.8rem">Sin datos</p>';
  }

  // Top contacts
  const contactEl = document.getElementById("slaContactBars");
  if (contactEl && summary.topContacts.length > 0) {
    const maxC = summary.topContacts[0].count;
    contactEl.innerHTML = summary.topContacts.map(({ name, contact, count }) => {
      const pct = Math.round((count / maxC) * 100);
      const label = name && contact && name !== contact
        ? `${escapeHtml(name)} <span class="contactBarEmail">&lt;${escapeHtml(contact)}&gt;</span>`
        : escapeHtml(name || contact);
      return `<div class="statusBar">
        <span class="statusBarLabel">${label}</span>
        <div class="statusBarTrack"><div class="statusBarFill" style="width:${pct}%;background:var(--accent)"></div></div>
        <span class="statusBarCount">${count}</span>
      </div>`;
    }).join("");
  } else if (contactEl) {
    contactEl.innerHTML = '<p class="empty" style="font-size:0.8rem">Sin datos</p>';
  }

  if (slaReportMeta)
    slaReportMeta.textContent = `Generado ${formatDate.format(new Date())} · ${filtered.length} tickets`;
  renderSlaTicketTable(filtered);
}

let slaTableSort = { col: null, dir: 1 };

const SLA_COLS = [
  { key: "id",      label: "Ticket" },
  { key: "date",    label: "Fecha" },
  { key: "name",    label: "Solicitante" },
  { key: "contact", label: "Contacto" },
  { key: "area",    label: "Área" },
  { key: "urgency", label: "Urgencia" },
  { key: "status",  label: "Estado" },
  { key: "sla",     label: "SLA" },
];

const URGENCY_ORDER = { baja: 1, media: 2, alta: 3, critica: 4 };
const STATUS_ORDER  = { abierto: 1, en_proceso: 2, en_espera: 3, resuelto: 4, cerrado: 5 };

function sortSlaTickets(tickets) {
  if (!slaTableSort.col) return tickets;
  return [...tickets].sort((a, b) => {
    let va, vb;
    switch (slaTableSort.col) {
      case "id":      va = a.id; vb = b.id; break;
      case "date":    va = a.createdAt; vb = b.createdAt; break;
      case "name":    va = (a.name || "").toLowerCase(); vb = (b.name || "").toLowerCase(); break;
      case "contact": va = (a.contact || "").toLowerCase(); vb = (b.contact || "").toLowerCase(); break;
      case "area":    va = (a.area || "").toLowerCase(); vb = (b.area || "").toLowerCase(); break;
      case "urgency": va = URGENCY_ORDER[a.urgency] || 0; vb = URGENCY_ORDER[b.urgency] || 0; break;
      case "status":  va = STATUS_ORDER[a.status] || 0; vb = STATUS_ORDER[b.status] || 0; break;
      case "sla":     va = a.sla.breached ? -1 : a.sla.remainingHours; vb = b.sla.breached ? -1 : b.sla.remainingHours; break;
      default: return 0;
    }
    if (va < vb) return -1 * slaTableSort.dir;
    if (va > vb) return 1 * slaTableSort.dir;
    return 0;
  });
}

function renderSlaTicketTable(tickets) {
  if (tickets.length === 0) {
    slaTicketTable.innerHTML = '<p class="empty">No hay tickets para los filtros seleccionados.</p>';
    return;
  }
  const sorted = sortSlaTickets(tickets);
  const headers = SLA_COLS.map(({ key, label }) => {
    const active = slaTableSort.col === key;
    const arrow = active ? (slaTableSort.dir === 1 ? " ↑" : " ↓") : "";
    return `<th class="sortable${active ? " sorted" : ""}" data-sla-col="${key}">${label}${arrow}</th>`;
  }).join("");

  slaTicketTable.innerHTML = `
    <div class="tableWrap">
      <table>
        <thead><tr>${headers}</tr></thead>
        <tbody>
          ${sorted.map((ticket) => {
            const slaCls = ticket.sla.paused ? "paused" : ticket.sla.breached ? "breached" : "";
            const slaText = ticket.sla.paused ? "Pausado" : ticket.sla.breached ? "Vencido" : `${ticket.sla.remainingHours}h`;
            return `<tr class="tableRowClickable" data-ticket-id="${escapeHtml(ticket.id)}" title="Abrir ticket ${escapeHtml(ticket.id)}">
              <td>${escapeHtml(ticket.id)}</td>
              <td>${formatDate.format(new Date(ticket.createdAt))}</td>
              <td>${escapeHtml(ticket.name)}</td>
              <td>${escapeHtml(ticket.contact)}</td>
              <td>${escapeHtml(ticket.area)}</td>
              <td><span class="badge ${escapeHtml(ticket.urgency)}">${escapeHtml(ticket.urgency)}</span></td>
              <td>${escapeHtml(getLabel(statuses, ticket.status))}</td>
              <td><span class="sla ${slaCls}">${slaText}</span></td>
            </tr>`;
          }).join("")}
        </tbody>
      </table>
    </div>`;

  // Click en encabezado para ordenar
  slaTicketTable.querySelectorAll("th[data-sla-col]").forEach((th) => {
    th.addEventListener("click", () => {
      const col = th.dataset.slaCol;
      if (slaTableSort.col === col) {
        slaTableSort.dir *= -1;
      } else {
        slaTableSort.col = col;
        slaTableSort.dir = 1;
      }
      renderSlaTicketTable(tickets);
    });
  });

  // Click en fila → abrir ticket
  slaTicketTable.querySelectorAll("tr.tableRowClickable").forEach((tr) => {
    tr.addEventListener("click", () => {
      const ticket = cachedTickets.find((t) => t.id === tr.dataset.ticketId);
      if (ticket) openTicketDetail(ticket);
    });
  });
}

// ── Edit modal ────────────────────────────────────────────────────────────────

function openEditModal(ticket) {
  editTicketId.value = ticket.id;
  editModalTicketId.textContent = ticket.id;
  editName.value = ticket.name;
  editContact.value = ticket.contact || "";
  editArea.value = ticket.area;
  document.querySelector("#editSubject").value = ticket.subject || "";
  document.querySelector("#editDescription").value = ticket.description || "";
  editUrgency.value = ticket.urgency;
  editStatus.value = ticket.status;
  editModalMessage.textContent = "";
  editModal.hidden = false;
  editName.focus();
}

function closeModal() {
  editModal.hidden = true;
  editTicketForm.reset();
  editModalMessage.textContent = "";
}

closeEditModal.addEventListener("click", closeModal);
cancelEditButton.addEventListener("click", closeModal);
editModal.addEventListener("click", (e) => {
  if (e.target === editModal) closeModal();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !editModal.hidden) closeModal();
  if (e.key === "Escape" && !ticketDetailModal.hidden) closeTicketDetailModal();
});

editTicketForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  editModalMessage.textContent = "";
  const id = editTicketId.value;
  const payload = {
    name: editName.value.trim(),
    contact: editContact.value.trim(),
    area: editArea.value.trim(),
    subject: document.querySelector("#editSubject").value.trim(),
    description: document.querySelector("#editDescription").value.trim(),
    urgency: editUrgency.value,
    status: editStatus.value,
  };
  try {
    await requestJson(`/api/tickets/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
    closeModal();
    await refresh();
    if (adminView.classList.contains("active")) renderAdminView();
  } catch (error) {
    editModalMessage.textContent = error.message;
  }
});

document.addEventListener("click", (e) => {
  const editBtn = e.target.closest("[data-edit-id]");
  if (!editBtn) return;
  const ticket = cachedTickets.find((t) => t.id === editBtn.dataset.editId);
  if (ticket) openEditModal(ticket);
});

function renderTicketBody(container, ticket) {
  container.innerHTML = "";
  if (ticket.htmlBody) {
    const iframe = document.createElement("iframe");
    iframe.className = "emailHtmlFrame";
    iframe.setAttribute("sandbox", "allow-same-origin");
    iframe.setAttribute("title", "Contenido del correo");
    container.appendChild(iframe);
    // Write after appending so the document is accessible
    const doc = iframe.contentDocument || iframe.contentWindow.document;
    doc.open();
    doc.write(`<!DOCTYPE html><html><head>
<meta charset="utf-8">
<style>
  body { font-family: Arial, sans-serif; font-size: 14px; color: #222; margin: 12px; word-break: break-word; }
  img { max-width: 100%; height: auto; }
  a { color: #2563eb; }
  table { border-collapse: collapse; max-width: 100%; }
  td, th { padding: 4px 8px; }
</style>
</head><body>${ticket.htmlBody}</body></html>`);
    doc.close();
    // Auto-resize iframe to content height
    iframe.addEventListener("load", () => {
      try {
        iframe.style.height = iframe.contentDocument.body.scrollHeight + 32 + "px";
      } catch (_) {}
    });
    try {
      iframe.style.height = doc.body.scrollHeight + 32 + "px";
    } catch (_) {}
  } else {
    const pre = document.createElement("pre");
    pre.className = "emailPlainText";
    pre.textContent = ticket.description || "Sin descripcion registrada.";
    container.appendChild(pre);
  }
}

function openTicketDetail(ticket) {
  activeTicketId = ticket.id;
  ticketDetailId.textContent = ticket.id;
  detailSubject.textContent = ticket.subject || "(sin asunto)";
  renderTicketBody(detailDescription, ticket);
  renderAttachments(ticket);
  detailName.textContent = ticket.name;
  detailContact.textContent = ticket.contact || "Sin contacto";
  detailAvatar.textContent = (ticket.name || "N").trim().charAt(0).toUpperCase();
  detailStatus.innerHTML = statuses
    .map(
      (s) =>
        `<option value="${s.key}" ${ticket.status === s.key ? "selected" : ""}>${s.label}</option>`
    )
    .join("");
  detailUrgency.innerHTML = urgencies
    .map(
      (u) =>
        `<option value="${u.key}" ${ticket.urgency === u.key ? "selected" : ""}>${u.label}</option>`
    )
    .join("");
  detailArea.value = ticket.area || "";
  detailResolution.value = "";
  pendingReplyFiles = [];
  updateReplyBtnLabel();
  updateAiSuggestLabel();
  detailWorkedHours.value = ticket.workedHours != null ? ticket.workedHours : "";
  detailMessage.textContent = "";
  if (detailAssignedTo) {
    const agents = [...new Set(cachedTickets.map((t) => t.assignedTo).filter(Boolean))];
    const agentsList = document.getElementById("agentsList");
    if (agentsList) agentsList.innerHTML = agents.map((a) => `<option value="${escapeHtml(a)}">`).join("");
    detailAssignedTo.value = ticket.assignedTo || "";
  }
  // Show "Enviar al cliente" only for email-sourced tickets with a contact address
  if (sendReplyBtn) sendReplyBtn.hidden = !(ticket.source === "email" && ticket.contact);
  // Reopened by client — show alert banner
  const reopenedBanner = document.getElementById("detailReopenedBanner");
  if (reopenedBanner) {
    reopenedBanner.hidden = !ticket.reopenedByClient;
  }
  // AI category/sentiment badges
  const aiInfoEl = document.getElementById("detailAiInfo");
  if (aiInfoEl) {
    const parts = [];
    if (ticket.aiCategory) parts.push(`<span class="badge badge--ai-category">🏷️ ${escapeHtml(ticket.aiCategory)}</span>`);
    if (ticket.aiSentiment && ticket.aiSentiment !== "neutro") parts.push(sentimentIcon(ticket.aiSentiment));
    aiInfoEl.innerHTML = parts.join(" ");
    aiInfoEl.hidden = parts.length === 0;
  }
  // AI suggest button — show only for email tickets
  const aiSuggestBtn = document.getElementById("aiSuggestBtn");
  if (aiSuggestBtn) aiSuggestBtn.hidden = !(ticket.source === "email" && ticket.contact);
  renderTicketHistory(ticket);
  renderCustomFieldInputs(ticket);
  showDetailView();
  detailResolution.focus();
}

function closeTicketDetailModal() {
  ticketDetailModal.hidden = true;
  activeTicketId = null;
  showView("overview");
}

const STATUS_COLORS = {
  abierto: "#3b82f6",
  en_proceso: "#f59e0b",
  en_espera: "#f97316",
  resuelto: "#22c55e",
  cerrado: "#94a3b8",
};

function renderTicketHistory(ticket) {
  const history = Array.isArray(ticket.history) ? ticket.history : [];
  if (history.length === 0) {
    detailHistory.innerHTML = '<p class="empty compact">Sin notas guardadas.</p>';
    return;
  }
  detailHistory.innerHTML = `<div class="timeline">${history
    .slice() // oldest first — natural reading order top→bottom
    .map((item) => {
      const isQuick = item.isQuickNote === true;
      const color = isQuick ? "#f59e0b" : (STATUS_COLORS[item.status] || "#94a3b8");
      const label = isQuick ? "Nota" : getLabel(statuses, item.status);
      return `
      <div class="timelineItem${isQuick ? " timelineItem--note" : ""}">
        <div class="timelineDot" style="background:${color}" title="${escapeHtml(label)}"></div>
        <div class="timelineBody${isQuick ? " timelineBody--note" : ""}">
          <div class="timelineMeta">
            <span class="timelineStatus" style="color:${color}">${escapeHtml(label)}</span>
            <span class="timelineDate">${formatDate.format(new Date(item.createdAt))}</span>
          </div>
          <p class="timelineNote">${escapeHtml(item.note)}</p>
        </div>
      </div>`;
    })
    .join("")}</div>`;
  // Scroll timeline to bottom so latest entry is visible
  detailHistory.scrollTop = detailHistory.scrollHeight;
}

function buildAttachFigures(atts, ticketId) {
  const IMAGE_TYPES = /^image\//;
  return atts.map((a) => {
    const url = `/api/tickets/${encodeURIComponent(ticketId)}/attachments/${encodeURIComponent(a.file)}`;
    const isImage = IMAGE_TYPES.test(a.type || "");
    const isPdf = (a.type || "").includes("pdf");
    const icon = isPdf
      ? `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#e24" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><text x="6" y="18" font-size="6" fill="#e24" stroke="none">PDF</text></svg>`
      : `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#64748b" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>`;
    return `<figure class="attachFigure">
      <a href="${url}" target="_blank" rel="noopener" title="${escapeHtml(a.name || "archivo")}">
        ${isImage
          ? `<img src="${url}" alt="${escapeHtml(a.name || "imagen")}" class="attachThumb" loading="lazy">`
          : `<div class="attachIcon">${icon}</div>`}
      </a>
      <figcaption>
        <span class="attachName">${escapeHtml(a.name || "archivo")}</span>
        <button class="attachDelete" data-att-file="${escapeHtml(a.file)}" title="Eliminar adjunto" aria-label="Eliminar adjunto">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </figcaption>
    </figure>`;
  }).join("");
}

function renderAttachments(ticket) {
  const allAtts = Array.isArray(ticket.attachments) ? ticket.attachments.filter((a) => a.file) : [];
  // Client attachments (from email) go at top; agent-uploaded go near resolutionBox
  const clientAtts = allAtts.filter((a) => a.source !== "agent");
  const agentAtts  = allAtts.filter((a) => a.source === "agent");

  const clientEl = document.querySelector("#detailAttachments");
  if (clientEl) {
    clientEl.innerHTML = buildAttachFigures(clientAtts, ticket.id);
    clientEl.hidden = clientAtts.length === 0;
  }

  const agentEl = document.querySelector("#agentAttachments");
  if (agentEl) {
    agentEl.innerHTML = agentAtts.length > 0 ? buildAttachFigures(agentAtts, ticket.id) : "";
    agentEl.hidden = agentAtts.length === 0;
  }
}

function collectDetailPayload(statusOverride) {
  const ticket = cachedTickets.find((t) => t.id === activeTicketId);
  if (!ticket) return null;
  const customFields = {};
  detailCustomFields.querySelectorAll("[data-custom-field]").forEach((input) => {
    customFields[input.dataset.customField] = input.value;
  });
  return {
    name: ticket.name,
    contact: ticket.contact || "",
    area: detailArea.value.trim() || "General",
    subject: ticket.subject || "",
    description: ticket.description || "",
    urgency: detailUrgency.value,
    status: statusOverride || detailStatus.value,
    resolution: "",
    resolutionNote: detailResolution.value.trim(),
    workedHours: detailWorkedHours.value !== "" ? parseFloat(detailWorkedHours.value) : null,
    assignedTo: detailAssignedTo?.value || "",
    customFields,
  };
}

async function saveDetail(statusOverride, silent = false) {
  const payload = collectDetailPayload(statusOverride);
  if (payload && silent) payload.silent = true;
  if (!payload) return;
  if (
    (payload.status === "resuelto" || payload.status === "cerrado") &&
    !payload.resolution &&
    !payload.resolutionNote
  ) {
    detailMessage.textContent = "Agrega la nota de lo realizado antes de resolver o cerrar.";
    return;
  }
  if (!statusOverride) {
    const currentTicket = cachedTickets.find((t) => t.id === activeTicketId);
    if (payload.resolutionNote && currentTicket && payload.status === currentTicket.status) {
      const wantsStatusChange = confirm(
        "Guardaste una nota. ¿Deseas cambiar el estado del ticket ahora?"
      );
      if (wantsStatusChange) {
        detailStatus.focus();
        detailMessage.textContent = "Selecciona el nuevo estado y vuelve a guardar.";
        return;
      }
    }
  }
  await requestJson(`/api/tickets/${encodeURIComponent(activeTicketId)}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
  await refresh();
  const isStatusChange = statusOverride && statusOverride !== cachedTickets.find((t) => t.id === activeTicketId)?.status;
  const toastMsg = statusOverride === "resuelto" ? "✓ Ticket marcado como resuelto"
    : statusOverride === "cerrado" ? "✓ Ticket cerrado"
    : "✓ Cambios guardados";
  closeTicketDetailModal();
  showToast(toastMsg);
}

function showToast(msg) {
  let toast = document.getElementById("appToast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "appToast";
    toast.className = "appToast";
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.classList.add("appToast--visible");
  clearTimeout(toast._hideTimer);
  toast._hideTimer = setTimeout(() => toast.classList.remove("appToast--visible"), 3000);
}

document.addEventListener("click", (e) => {
  const openBtn = e.target.closest("[data-open-id]");
  if (!openBtn) return;
  const ticket = cachedTickets.find((t) => t.id === openBtn.dataset.openId);
  if (ticket) openTicketDetail(ticket);
});

document.addEventListener("click", (e) => {
  const interactive = e.target.closest("button, input, select, textarea, label, a");
  if (interactive) return;
  const card = e.target.closest(".ticketCard");
  const row = e.target.closest(".ticketRow");
  const ticketId = card?.dataset.ticketId || row?.dataset.ticketId;
  if (!ticketId) return;
  const ticket = cachedTickets.find((t) => t.id === ticketId);
  if (ticket) openTicketDetail(ticket);
});

function showClosureModal(statusOverride) {
  pendingClosureStatus = statusOverride;
  const isResolve = statusOverride === "resuelto";
  closureReasonTitle.textContent = isResolve ? "Marcar como resuelto" : "Cerrar ticket";
  document.getElementById("closureReasonLabel").textContent = isResolve ? "Motivo de resolución" : "Motivo de cierre";
  confirmClosureBtn.textContent = isResolve ? "✓ Marcar resuelto" : "Cerrar ticket";
  // Mostrar checkbox de notificación solo para cerrar (resolver siempre notifica)
  const notifyRow = closureNotifyClient?.closest(".closureNotifyToggle");
  if (notifyRow) notifyRow.hidden = false;
  if (closureNotifyClient) closureNotifyClient.checked = true;
  closureReasonText.value = detailResolution.value.trim();
  closureReasonError.textContent = "";
  // Pre-rellenar horas trabajadas si ya tienen valor
  const hoursRow = document.getElementById("closureWorkedHoursRow");
  const hoursInput = document.getElementById("closureWorkedHours");
  if (hoursRow) hoursRow.hidden = !isResolve;
  if (hoursInput) {
    const currentTicket = cachedTickets.find(t => t.id === activeTicketId);
    hoursInput.value = (isResolve && currentTicket?.workedHours != null) ? currentTicket.workedHours : "";
  }
  closureReasonModal.hidden = false;
  setTimeout(() => closureReasonText.focus(), 50);
}

function hideClosureModal() {
  closureReasonModal.hidden = true;
  closureReasonText.value = "";
  closureReasonError.textContent = "";
  pendingClosureStatus = null;
  pendingClosureSilent = false;
}

cancelClosureX.addEventListener("click", hideClosureModal);
cancelClosureBtn.addEventListener("click", hideClosureModal);
confirmClosureBtn.addEventListener("click", async () => {
  const reason = closureReasonText.value.trim();
  if (!reason) {
    closureReasonError.textContent = "El motivo es requerido para cerrar o resolver el ticket.";
    closureReasonText.focus();
    return;
  }
  const status = pendingClosureStatus;
  const silent = closureNotifyClient ? !closureNotifyClient.checked : false;
  const closureHoursInput = document.getElementById("closureWorkedHours");
  const closureHoursVal = closureHoursInput && closureHoursInput.value !== "" ? Number(closureHoursInput.value) : null;
  hideClosureModal();
  detailResolution.value = reason;
  // Auto-guardar cambios de campos antes de resolver/cerrar
  const currentTicket = cachedTickets.find((t) => t.id === activeTicketId);
  if (currentTicket) {
    const resolvedHours = closureHoursVal !== null ? closureHoursVal :
      (detailWorkedHours?.value !== "" ? Number(detailWorkedHours?.value) : currentTicket.workedHours);
    const payload = {
      status: currentTicket.status,
      urgency: detailUrgency?.value || currentTicket.urgency,
      area: detailArea?.value?.trim() || currentTicket.area,
      assignedTo: detailAssignedTo?.value?.trim() || currentTicket.assignedTo,
      workedHours: resolvedHours,
    };
    try {
      await requestJson(`/api/tickets/${encodeURIComponent(activeTicketId)}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      });
    } catch (_) {}
  }
  try {
    await saveDetail(status, silent);
  } catch (err) {
    detailMessage.textContent = err.message;
  }
});

closeTicketDetail.addEventListener("click", closeTicketDetailModal);

// Auto-save when the agent changes a field in the right panel
async function autoSaveField() {
  if (!activeTicketId) return;
  const ticket = cachedTickets.find((t) => t.id === activeTicketId);
  if (!ticket) return;
  const newStatus = detailStatus.value;
  // Terminal states go through their dedicated modals
  if (newStatus === "resuelto") { detailStatus.value = ticket.status; resolveTicketDetail.click(); return; }
  if (newStatus === "cerrado") { detailStatus.value = ticket.status; closeTicketDetailStatus.click(); return; }
  try {
    await requestJson(`/api/tickets/${encodeURIComponent(activeTicketId)}`, {
      method: "PATCH",
      body: JSON.stringify({
        name: ticket.name,
        contact: ticket.contact || "",
        subject: ticket.subject || "",
        description: ticket.description || "",
        resolution: ticket.resolution || "",
        urgency: detailUrgency.value,
        status: newStatus,
        area: detailArea.value || ticket.area,
        assignedTo: detailAssignedTo?.value || ticket.assignedTo || "",
        workedHours: detailWorkedHours?.value ?? ticket.workedHours ?? "",
        customFields: ticket.customFields || {},
        silent: true,
      }),
    });
    await refresh();
  } catch (_) {}
}

detailStatus?.addEventListener("change", autoSaveField);
detailUrgency?.addEventListener("change", autoSaveField);
detailArea?.addEventListener("change", autoSaveField);
detailAssignedTo?.addEventListener("change", autoSaveField);
detailWorkedHours?.addEventListener("blur", autoSaveField);

function updateReplyBtnLabel() {
  if (!sendReplyBtn) return;
  const n = pendingReplyFiles.length;
  sendReplyBtn.textContent = n > 0 ? `Enviar al cliente (${n} archivo${n > 1 ? "s" : ""})` : "Enviar al cliente";
}

document.getElementById("aiSuggestBtn")?.addEventListener("click", async function () {
  if (!activeTicketId) return;
  const btn = this;
  const textarea = document.querySelector("#detailResolution");
  const msgEl = document.querySelector("#detailMessage");
  const draft = textarea?.value.trim() || "";
  const isPilotMode = draft.length > 0;
  btn.disabled = true;
  btn.textContent = isPilotMode ? "✨ Mejorando..." : "✨ Generando...";
  if (msgEl) { msgEl.textContent = ""; msgEl.style.color = ""; }
  try {
    const data = await requestJson(`/api/tickets/${encodeURIComponent(activeTicketId)}/ai-suggest`, {
      method: "POST",
      body: JSON.stringify({ draft }),
    });
    if (data.suggestion && textarea) {
      textarea.value = data.suggestion;
      textarea.focus();
      if (msgEl) {
        msgEl.textContent = isPilotMode ? "✓ Texto mejorado — revísalo antes de enviar." : "✓ Sugerencia IA lista — revísala antes de enviar.";
        msgEl.style.color = "var(--color-success, #16a34a)";
      }
    } else {
      if (msgEl) { msgEl.textContent = "No se pudo generar una sugerencia."; }
    }
  } catch (err) {
    if (msgEl) { msgEl.textContent = err.message || "Error al generar sugerencia."; }
  } finally {
    btn.disabled = false;
    updateAiSuggestLabel();
  }
});

function updateAiSuggestLabel() {
  const btn = document.getElementById("aiSuggestBtn");
  const textarea = document.querySelector("#detailResolution");
  if (!btn) return;
  btn.textContent = textarea?.value.trim() ? "✨ Mejorar mi texto" : "✨ Sugerir respuesta IA";
}

sendReplyBtn?.addEventListener("click", async () => {
  if (!activeTicketId) return;
  const textarea = document.querySelector("#detailResolution");
  const msgEl = document.querySelector("#detailMessage");
  const message = textarea?.value.trim();
  if (!message) { if (msgEl) msgEl.textContent = "Escribe el mensaje antes de enviarlo al cliente."; textarea?.focus(); return; }
  sendReplyBtn.disabled = true;
  if (msgEl) msgEl.textContent = "Enviando…";
  try {
    const attachmentFiles = pendingReplyFiles.map((f) => f.file);
    await requestJson(`/api/tickets/${encodeURIComponent(activeTicketId)}/reply`, {
      method: "POST",
      body: JSON.stringify({ message, attachmentFiles }),
    });
    if (textarea) textarea.value = "";
    pendingReplyFiles = [];
    updateReplyBtnLabel();
    if (msgEl) {
      msgEl.textContent = attachmentFiles.length > 0
        ? `Respuesta enviada con ${attachmentFiles.length} archivo(s).`
        : "Respuesta enviada al cliente.";
      msgEl.style.color = "var(--ok)";
    }
    setTimeout(() => { if (msgEl) { msgEl.textContent = ""; msgEl.style.color = ""; } }, 4000);
    await refresh();
    const updated = cachedTickets.find((t) => t.id === activeTicketId);
    if (updated) renderTicketHistory(updated);
  } catch (err) {
    if (msgEl) { msgEl.textContent = err.message; msgEl.style.color = ""; }
  } finally {
    sendReplyBtn.disabled = false;
  }
});
// ── File upload ───────────────────────────────────────────────────────────────

function setUploadStatus(msg, ok = null) {
  if (!uploadStatus) return;
  uploadStatus.textContent = msg;
  uploadStatus.className = "attachStatus" + (ok === true ? " attachStatus--ok" : ok === false ? " attachStatus--err" : "");
  if (msg) setTimeout(() => { if (uploadStatus.textContent === msg) uploadStatus.textContent = ""; }, 4000);
}

async function uploadFile(file) {
  if (!activeTicketId) return;
  if (file.size > 8_000_000) { setUploadStatus(`${file.name} excede 8 MB`, false); return; }
  setUploadStatus(`Subiendo ${file.name}…`);
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onerror = () => { setUploadStatus("No se pudo leer el archivo.", false); resolve(); };
    reader.onload = async (ev) => {
      const result = ev.target.result;
      const b64 = result.includes(",") ? result.split(",")[1] : result;
      // Derive name for clipboard pastes that arrive without a real filename
      const name = file.name && file.name !== "image.png" ? file.name
        : `captura-${new Date().toISOString().slice(0,19).replace(/[:T]/g,"-")}.png`;
      try {
        const saved = await requestJson(`/api/tickets/${encodeURIComponent(activeTicketId)}/attachments`, {
          method: "POST",
          body: JSON.stringify({ name, type: file.type || "image/png", data: b64 }),
        });
        if (saved && saved.file) {
          pendingReplyFiles.push({ file: saved.file, name: saved.name || name });
          updateReplyBtnLabel();
        }
        setUploadStatus(`✓ ${name} adjuntado`, true);
        const updated = (await requestJson("/api/tickets")).find((t) => t.id === activeTicketId);
        if (updated) { Object.assign(cachedTickets.find((t) => t.id === activeTicketId) || {}, updated); renderAttachments(updated); }
      } catch (err) {
        setUploadStatus(`Error: ${err.message}`, false);
      }
      resolve();
    };
    reader.readAsDataURL(file);
  });
}

attachFileInput?.addEventListener("change", async (e) => {
  for (const file of Array.from(e.target.files || [])) await uploadFile(file);
  attachFileInput.value = "";
});

// Drag & drop onto the conversation area
const ticketConversation = document.querySelector(".ticketConversation");
ticketConversation?.addEventListener("dragover", (e) => { e.preventDefault(); ticketConversation.classList.add("dropTarget"); });
ticketConversation?.addEventListener("dragleave", () => ticketConversation.classList.remove("dropTarget"));
ticketConversation?.addEventListener("drop", async (e) => {
  e.preventDefault(); ticketConversation.classList.remove("dropTarget");
  if (!activeTicketId) return;
  for (const file of Array.from(e.dataTransfer.files || [])) await uploadFile(file);
});

// Paste from clipboard (Ctrl+V / screenshot)
document.addEventListener("paste", async (e) => {
  if (!activeTicketId) return;
  if (!ticketDetailModal || ticketDetailModal.hidden) return;
  const items = Array.from(e.clipboardData?.items || []);
  const imageItem = items.find((i) => i.kind === "file" && i.type.startsWith("image/"));
  if (!imageItem) return;
  e.preventDefault();
  const file = imageItem.getAsFile();
  if (file) await uploadFile(file);
});

// Delete attachment (client or agent section)
document.addEventListener("click", async (e) => {
  if (!e.target.closest("#detailAttachments") && !e.target.closest("#agentAttachments")) return;
  const btn = e.target.closest(".attachDelete");
  if (!btn || !activeTicketId) return;
  if (!confirm("¿Eliminar este adjunto?")) return;
  try {
    await requestJson(`/api/tickets/${encodeURIComponent(activeTicketId)}/attachments/${encodeURIComponent(btn.dataset.attFile)}`, { method: "DELETE" });
    await refresh();
    const updated = cachedTickets.find((t) => t.id === activeTicketId);
    if (updated) renderAttachments(updated);
  } catch (err) { alert(err.message); }
});

// Nota rápida — guarda el contenido del textarea sin cambiar estado del ticket
document.addEventListener("click", async (e) => {
  if (!e.target.closest("#saveQuickNote")) return;
  if (!activeTicketId) return;
  const textarea = document.querySelector("#detailResolution");
  const msgEl = document.querySelector("#detailMessage");
  const note = textarea?.value.trim();
  if (!note) {
    if (msgEl) msgEl.textContent = "Escribe algo antes de guardar la nota.";
    textarea?.focus();
    return;
  }
  const btn = document.querySelector("#saveQuickNote");
  if (btn) btn.disabled = true;
  if (msgEl) msgEl.textContent = "";
  try {
    await requestJson(`/api/tickets/${encodeURIComponent(activeTicketId)}/notes`, {
      method: "POST",
      body: JSON.stringify({ note }),
    });
    if (textarea) textarea.value = "";
    pendingReplyFiles = [];
    updateReplyBtnLabel();
    await refresh();
    const updated = cachedTickets.find((t) => t.id === activeTicketId);
    if (updated) renderTicketHistory(updated);
  } catch (err) {
    if (msgEl) msgEl.textContent = err.message;
  } finally {
    if (btn) btn.disabled = false;
  }
});

resolveTicketDetail.addEventListener("click", () => showClosureModal("resuelto"));
closeTicketDetailStatus.addEventListener("click", () => showClosureModal("cerrado"));
detailDeleteButton.addEventListener("click", async () => {
  if (!activeTicketId) return;
  await deleteTicket(activeTicketId);
  closeTicketDetailModal();
});

document.addEventListener("click", (e) => {
  const deleteBtn = e.target.closest("[data-delete-id]");
  if (deleteBtn) deleteTicket(deleteBtn.dataset.deleteId);
});

// ── Bulk actions (overview list) ──────────────────────────────────────────────

function updateBulkBar() {
  const count = selectedTickets.size;
  bulkBar.hidden = count === 0;
  bulkCount.textContent = `${count} seleccionado${count !== 1 ? "s" : ""}`;
}

document.addEventListener("change", (e) => {
  const row = e.target.closest(".rowCheckbox, .cardCheckbox");
  if (row) {
    row.checked
      ? selectedTickets.add(row.dataset.ticketId)
      : selectedTickets.delete(row.dataset.ticketId);
    updateBulkBar();
    const visible = getVisibleTickets();
    const selectAll = document.querySelector("#selectAllCheckbox");
    if (selectAll) {
      selectAll.checked = visible.every((t) => selectedTickets.has(t.id));
      selectAll.indeterminate = !selectAll.checked && selectedTickets.size > 0;
    }
    return;
  }

  const selectAll = e.target.closest("#selectAllCheckbox");
  if (selectAll) {
    getVisibleTickets().forEach((t) =>
      selectAll.checked ? selectedTickets.add(t.id) : selectedTickets.delete(t.id)
    );
    updateBulkBar();
    renderTickets();
  }

  // Admin checkboxes
  const adminRow = e.target.closest(".adminRowCheckbox");
  if (adminRow) {
    adminRow.checked
      ? adminSelected.add(adminRow.dataset.id)
      : adminSelected.delete(adminRow.dataset.id);
    adminDeleteSelected.hidden = adminSelected.size === 0;
    const filtered = getFilteredAdminTickets();
    const adminAll = document.querySelector("#adminSelectAll");
    if (adminAll) {
      adminAll.checked = filtered.length > 0 && filtered.every((t) => adminSelected.has(t.id));
      adminAll.indeterminate = !adminAll.checked && adminSelected.size > 0;
    }
    return;
  }

  const adminSelectAll = e.target.closest("#adminSelectAll");
  if (adminSelectAll) {
    getFilteredAdminTickets().forEach((t) =>
      adminSelectAll.checked ? adminSelected.add(t.id) : adminSelected.delete(t.id)
    );
    adminDeleteSelected.hidden = adminSelected.size === 0;
    renderAdminView();
  }
});

bulkCancelButton.addEventListener("click", () => {
  selectedTickets.clear();
  updateBulkBar();
  renderTickets();
});

bulkDeleteButton.addEventListener("click", deleteSelectedBoardTickets);

bulkApplyButton.addEventListener("click", async () => {
  if (selectedTickets.size === 0) return;
  const status = bulkStatusSelect.value;
  try {
    await Promise.all(
      [...selectedTickets].map((id) =>
        requestJson(`/api/tickets/${encodeURIComponent(id)}/status`, {
          method: "PATCH",
          body: JSON.stringify({ status }),
        })
      )
    );
    selectedTickets.clear();
    updateBulkBar();
    await refresh();
  } catch (error) {
    formMessage.textContent = error.message;
  }
});

// ── Settings ──────────────────────────────────────────────────────────────────

document.querySelectorAll(".tabButton").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tabButton").forEach((b) => {
      b.classList.remove("active");
      b.setAttribute("aria-selected", "false");
    });
    btn.classList.add("active");
    btn.setAttribute("aria-selected", "true");
    document.querySelectorAll(".tabPanel").forEach((p) => {
      p.hidden = true;
    });
    const panel = document.querySelector(`#${btn.dataset.tab}`);
    if (panel) panel.hidden = false;
  });
});

addCustomFieldButton?.addEventListener("click", () => {
  const fields = collectCustomFieldsConfig();
  fields.push({
    label: `Campo ${fields.length + 1}`,
    key: `campo_${fields.length + 1}`,
    type: "text",
    options: "",
    enabled: true,
  });
  appConfig.customFields = fields;
  renderCustomFieldsBuilder();
});

customFieldsList?.addEventListener("click", (e) => {
  if (!e.target.closest(".removeCustomField")) return;
  const row = e.target.closest(".customFieldRow");
  row?.remove();
});

sidebarToggle?.addEventListener("click", () => {
  const collapsed = document.body.classList.toggle("sidebarCollapsed");
  sidebarToggle.title = collapsed ? "Expandir menú" : "Contraer menú";
});

// Auto-collapse sidebar on tablet (769–1024px)
(function initResponsiveSidebar() {
  if (window.innerWidth > 768 && window.innerWidth <= 1024) {
    document.body.classList.add("sidebarCollapsed");
  }
  window.addEventListener("resize", () => {
    if (window.innerWidth > 768 && window.innerWidth <= 1024) {
      if (!document.body.classList.contains("sidebarCollapsed")) {
        document.body.classList.add("sidebarCollapsed");
      }
    }
  });
})();

sidebarOverviewButton?.addEventListener("click", () => showView("overview"));

document.querySelectorAll(".presetBtn").forEach((btn) => {
  btn.addEventListener("click", () => {
    const preset = SLA_PRESETS[btn.dataset.preset];
    if (!preset) return;
    document.querySelector("#slaBaja").value = preset.baja;
    document.querySelector("#slaMedia").value = preset.media;
    document.querySelector("#slaAlta").value = preset.alta;
    document.querySelector("#slaCritica").value = preset.critica;
  });
});

document.querySelector("#copyPortalUrl").addEventListener("click", () => {
  navigator.clipboard.writeText(`${window.location.origin}/portal`).then(() => {
    const btn = document.querySelector("#copyPortalUrl");
    const orig = btn.textContent;
    btn.textContent = "¡Copiado!";
    setTimeout(() => {
      btn.textContent = orig;
    }, 1800);
  });
});

// ── AI settings ───────────────────────────────────────────────────────────────

async function loadAiSettings() {
  try {
    const data = await requestJson("/api/config/ai");
    const statusEl = document.getElementById("aiKeyStatus");
    if (statusEl) {
      if (data.source === "env") {
        statusEl.innerHTML = `<div class="aiKeyStatusBadge aiKeyStatusBadge--ok">✓ API Key activa — configurada vía variable de entorno del servidor (ENV). No es necesario agregarla aquí.</div>`;
      } else if (data.source === "config" && data.masked) {
        statusEl.innerHTML = `<div class="aiKeyStatusBadge aiKeyStatusBadge--ok">✓ API Key guardada: <code>${data.masked}</code></div>`;
      } else {
        statusEl.innerHTML = `<div class="aiKeyStatusBadge aiKeyStatusBadge--warn">⚠ Sin API Key — el triaje automático y las sugerencias IA están desactivados.</div>`;
      }
    }
    // No pre-llenamos el input con la clave real por seguridad
    const keyInput = document.getElementById("aiApiKey");
    if (keyInput) keyInput.value = "";
  } catch (_) {}
}

// Toggle show/hide de la clave IA
document.getElementById("toggleAiApiKey")?.addEventListener("click", function () {
  const input = document.getElementById("aiApiKey");
  if (!input) return;
  const show = input.type === "password";
  input.type = show ? "text" : "password";
  this.textContent = show ? "🙈" : "";
});

// Guardar API Key IA
document.getElementById("aiConfigForm")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const keyInput = document.getElementById("aiApiKey");
  const resultEl = document.getElementById("aiConfigResult");
  const key = keyInput?.value.trim() || "";
  resultEl.style.display = "block";
  if (!key) {
    resultEl.style.color = "var(--muted)";
    resultEl.textContent = "Ingresa una API Key para guardar.";
    return;
  }
  resultEl.textContent = "Guardando…";
  try {
    const cfg = await requestJson("/api/config");
    await requestJson("/api/config", {
      method: "PUT",
      body: JSON.stringify({ ...cfg, aiConfig: { apiKey: key } }),
    });
    resultEl.style.color = "var(--ok)";
    resultEl.textContent = "✓ API Key guardada correctamente.";
    if (keyInput) keyInput.value = "";
    loadAiSettings();
  } catch (err) {
    resultEl.style.color = "var(--danger)";
    resultEl.textContent = err.message || "Error al guardar.";
  }
});

// Borrar API Key IA
document.getElementById("clearAiKeyBtn")?.addEventListener("click", async () => {
  const resultEl = document.getElementById("aiConfigResult");
  resultEl.style.display = "block";
  resultEl.textContent = "Borrando…";
  try {
    const cfg = await requestJson("/api/config");
    await requestJson("/api/config", {
      method: "PUT",
      body: JSON.stringify({ ...cfg, aiConfig: { apiKey: "" } }),
    });
    resultEl.style.color = "var(--ok)";
    resultEl.textContent = "Clave borrada.";
    loadAiSettings();
  } catch (err) {
    resultEl.style.color = "var(--danger)";
    resultEl.textContent = err.message || "Error al borrar.";
  }
});

// ── Email settings ────────────────────────────────────────────────────────────

async function loadEmailSettings() {
  try {
    const cfg = await requestJson("/api/email/config");
    document.querySelector("#emailEnabled").checked = cfg.enabled;
    document.querySelector("#emailHost").value = cfg.host || "";
    document.querySelector("#emailPort").value = cfg.port || 993;
    document.querySelector("#emailSecure").checked = cfg.secure !== false;
    document.querySelector("#emailUsername").value = cfg.username || "";
    document.querySelector("#emailPassword").value = cfg.password || "";
    document.querySelector("#emailFolder").value = cfg.folder || "INBOX";
    document.querySelector("#emailPollInterval").value = cfg.pollIntervalMinutes || 5;
    document.querySelector("#emailIgnoreSenders").value = cfg.ignoreSenders || "";
    document.querySelector("#emailDefaultArea").value = cfg.defaultArea || "Correo";
    document.querySelector("#emailDefaultUrgency").value = cfg.defaultUrgency || "media";
    await loadEmailStatus();
  } catch (_) {}
}

async function loadEmailStatus() {
  try {
    const st = await requestJson("/api/email/status");
    const box = document.querySelector("#emailStatusBox");
    box.style.display = "block";
    document.querySelector("#emailLastPoll").textContent = st.lastPoll
      ? new Date(st.lastPoll).toLocaleString()
      : "—";
    const errEl = document.querySelector("#emailLastError");
    errEl.textContent = st.lastError || "—";
    errEl.style.color = st.lastError ? "var(--nd-danger, #e53e3e)" : "";
    const consecEl = document.querySelector("#emailConsecutiveErrors");
    if (consecEl) {
      consecEl.textContent = st.consecutiveErrors || 0;
      consecEl.style.color =
        st.consecutiveErrors >= 3
          ? "var(--nd-danger, #e53e3e)"
          : st.consecutiveErrors > 0
            ? "var(--nd-warning, #d97706)"
            : "";
      consecEl.style.fontWeight = st.consecutiveErrors >= 3 ? "700" : "";
    }
    document.querySelector("#emailTicketsCreated").textContent = st.ticketsCreated || 0;
    const checked = document.querySelector("#emailMessagesChecked");
    if (checked) checked.textContent = st.lastMessagesChecked || 0;
  } catch (_) {}
}

const EYE_OPEN = `<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`;
const EYE_CLOSED = `<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`;

function initPasswordToggle(inputId, btnId) {
  const input = document.querySelector(`#${inputId}`);
  const btn = document.querySelector(`#${btnId}`);
  if (!input || !btn) return;
  btn.innerHTML = EYE_OPEN;
  btn.addEventListener("click", () => {
    if (input.type === "password") {
      input.type = "text";
      btn.innerHTML = EYE_CLOSED;
    } else {
      input.type = "password";
      btn.innerHTML = EYE_OPEN;
    }
  });
}

initPasswordToggle("emailPassword", "toggleEmailPassword");
initPasswordToggle("smtpPass", "toggleSmtpPass");
initPasswordToggle("cpCurrent", "toggleCpCurrent");
initPasswordToggle("cpNew", "toggleCpNew");
initPasswordToggle("cpConfirm", "toggleCpConfirm");

document.querySelector("#emailConfigForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const result = document.querySelector("#emailTestResult");
  result.style.display = "none";
  const body = {
    enabled: document.querySelector("#emailEnabled").checked,
    host: document.querySelector("#emailHost").value.trim(),
    port: parseInt(document.querySelector("#emailPort").value) || 993,
    secure: document.querySelector("#emailSecure").checked,
    username: document.querySelector("#emailUsername").value.trim(),
    password: document.querySelector("#emailPassword").value,
    folder: document.querySelector("#emailFolder").value.trim() || "INBOX",
    pollIntervalMinutes: parseInt(document.querySelector("#emailPollInterval").value) || 5,
    ignoreSenders: document.querySelector("#emailIgnoreSenders").value.trim(),
    defaultArea: document.querySelector("#emailDefaultArea").value.trim() || "Correo",
    defaultUrgency: document.querySelector("#emailDefaultUrgency").value,
  };
  if (!body.enabled && body.host && body.username && body.password) {
    body.enabled = true;
    document.querySelector("#emailEnabled").checked = true;
  }
  try {
    await requestJson("/api/email/config", { method: "PUT", body: JSON.stringify(body) });
    result.style.display = "block";
    result.style.color = "var(--ok)";
    result.textContent = "Configuración guardada correctamente.";
    await loadEmailStatus();
  } catch (err) {
    result.style.display = "block";
    result.style.color = "var(--danger)";
    result.textContent = err.message;
  }
});

document.querySelector("#testEmailBtn").addEventListener("click", async () => {
  const btn = document.querySelector("#testEmailBtn");
  const result = document.querySelector("#emailTestResult");
  btn.disabled = true;
  btn.textContent = "Probando…";
  result.style.display = "none";
  const body = {
    host: document.querySelector("#emailHost").value.trim(),
    port: parseInt(document.querySelector("#emailPort").value) || 993,
    secure: document.querySelector("#emailSecure").checked,
    username: document.querySelector("#emailUsername").value.trim(),
    password: document.querySelector("#emailPassword").value,
  };
  try {
    await requestJson("/api/email/test", { method: "POST", body: JSON.stringify(body) });
    document.querySelector("#emailEnabled").checked = true;
    result.style.display = "block";
    result.style.color = "var(--ok)";
    result.textContent = "Conexión exitosa. Credenciales correctas.";
  } catch (err) {
    result.style.display = "block";
    result.style.color = "var(--danger)";
    result.textContent = `Error: ${err.message}`;
  }
  btn.disabled = false;
  btn.textContent = "Probar conexión";
});

document.querySelector("#pollNowBtn").addEventListener("click", async () => {
  const btn = document.querySelector("#pollNowBtn");
  btn.disabled = true;
  btn.textContent = "Sondeando…";
  try {
    const r = await requestJson("/api/email/poll", { method: "POST", body: "{}" });
    await loadEmailStatus();
    await refresh();
    const result = document.querySelector("#emailTestResult");
    result.style.display = "block";
    result.style.color = "var(--ok)";
    result.textContent = `Sondeo completo. ${r.checked || 0} mensaje(s) revisado(s), ${r.created || 0} ticket(s) creado(s).`;
  } catch (err) {
    await loadEmailStatus();
    const result = document.querySelector("#emailTestResult");
    result.style.display = "block";
    result.style.color = "var(--danger)";
    result.textContent = err.message;
  }
  btn.disabled = false;
  btn.textContent = "Sondear ahora";
});

saveSettingsButton.addEventListener("click", async () => {
  const newConfig = {
    sla: {
      baja: Number(document.querySelector("#slaBaja").value) || 24,
      media: Number(document.querySelector("#slaMedia").value) || 8,
      alta: Number(document.querySelector("#slaAlta").value) || 4,
      critica: Number(document.querySelector("#slaCritica").value) || 1,
    },
    fields: {
      contact: {
        enabled: document.querySelector("#fieldContactEnabled").checked,
        label: document.querySelector("#fieldContactLabel").value.trim() || "Contacto",
      },
      area: {
        enabled: document.querySelector("#fieldAreaEnabled").checked,
        label: document.querySelector("#fieldAreaLabel").value.trim() || "Área",
      },
    },
    customFields: collectCustomFieldsConfig(),
    // Always pass the existing aiConfig so the key is never lost on save
    aiConfig: appConfig?.aiConfig || { apiKey: "" },
    businessHours: (() => {
      const schedule = {};
      document.querySelectorAll(".bhDayEntry").forEach(entry => {
        const day = String(entry.dataset.day);
        const check = entry.querySelector(".bhDayCheck");
        const startInput = entry.querySelector(".bhDayStart");
        const endInput = entry.querySelector(".bhDayEnd");
        schedule[day] = {
          enabled: check ? check.checked : false,
          start: startInput ? startInput.value : "07:00",
          end: endInput ? endInput.value : "17:00",
        };
      });
      return {
        enabled: document.querySelector("#bhEnabled")?.getAttribute("aria-pressed") === "true",
        schedule,
      };
    })(),
  };
  try {
    appConfig = await requestJson("/api/config", {
      method: "PUT",
      body: JSON.stringify(newConfig),
    });
    applyFieldConfig();
    await refresh();
    showView("overview");
  } catch (error) {
    document.querySelector("#slaSettingsMessage").textContent = error.message;
  }
});

// ── Notifications settings ────────────────────────────────────────────────────

const DEFAULT_TEMPLATES_CLIENT = {
  received: {
    subject: "Tu ticket #{{ticket_id}} fue recibido — NeuroDesk",
    body: 'Hola {{user_name}},\n\nHemos recibido tu ticket #{{ticket_id}}: "{{ticket_title}}".\n\nUn agente lo atenderá a la brevedad.\n\nGracias por comunicarte con nosotros.\n\nNeurofic · NeuroDesk',
  },
  status_changed: {
    subject: "Actualización del ticket #{{ticket_id}} — {{new_status}}",
    body: 'Hola {{user_name}},\n\nEl estado de tu ticket #{{ticket_id}} "{{ticket_title}}" ha cambiado:\n\nEstado anterior: {{old_status}}\nNuevo estado: {{new_status}}\n\nSi tienes preguntas, puedes responder a este correo.\n\nNeurofic · NeuroDesk',
  },
  resolved: {
    subject: "Tu ticket #{{ticket_id}} fue resuelto — NeuroDesk",
    body: 'Hola {{user_name}},\n\nNos complace informarte que tu ticket #{{ticket_id}} "{{ticket_title}}" ha sido resuelto.\n\nResumen de la atención:\n{{resolution_notes}}\n\nGracias por tu confianza en Neurofic.\n\nNeurofic · NeuroDesk',
  },
};

const SAMPLE_VARS = {
  ticket_id: "ND-1001",
  ticket_title: "Error en la aplicación",
  user_name: "María García",
  user_email: "maria@ejemplo.com",
  old_status: "Abierto",
  new_status: "En proceso",
  agent_name: "Carlos López",
  resolution_notes: "Se reinició el servicio y se verificó el funcionamiento correcto.",
};

function renderTemplateClient(tpl, vars) {
  return String(tpl || "").replace(/\{\{(\w+)\}\}/g, (match, key) =>
    vars[key] !== undefined ? String(vars[key]) : match
  );
}

function updateTemplatePreview(type) {
  const subject = document.querySelector(`#tpl_${type}_subject`)?.value || "";
  const body = document.querySelector(`#tpl_${type}_body`)?.value || "";
  const preview = document.querySelector(`#tpl_${type}_preview`);
  if (!preview) return;
  const renderedSubject = renderTemplateClient(subject, SAMPLE_VARS);
  const renderedBody = renderTemplateClient(body, SAMPLE_VARS);
  preview.innerHTML = `<strong>Vista previa — Asunto:</strong> ${escapeHtml(renderedSubject)}<br><br>${escapeHtml(renderedBody).replace(/\n/g, "<br>")}`;
}

async function loadNotificationsSettings() {
  try {
    const cfg = await requestJson("/api/notifications/config");
    document.querySelector("#smtpEnabled").checked = cfg.smtp?.enabled || false;
    document.querySelector("#smtpHost").value = cfg.smtp?.host || "";
    document.querySelector("#smtpPort").value = cfg.smtp?.port || 587;
    document.querySelector("#smtpSecure").checked = cfg.smtp?.secure || false;
    document.querySelector("#smtpUser").value = cfg.smtp?.user || "";
    document.querySelector("#smtpPass").value = cfg.smtp?.pass ? "••••••••" : "";
    document.querySelector("#smtpFrom").value = cfg.smtp?.from || "";
    document.querySelector("#adminEmailsList").value = cfg.adminEmails || "";
    document.querySelector("#appUrl").value = cfg.app_url || "";
    const templates = cfg.templates || {};
    ["received", "status_changed", "resolved"].forEach((type) => {
      const tpl = templates[type] || DEFAULT_TEMPLATES_CLIENT[type];
      const subjectEl = document.querySelector(`#tpl_${type}_subject`);
      const bodyEl = document.querySelector(`#tpl_${type}_body`);
      if (subjectEl) subjectEl.value = tpl.subject || "";
      if (bodyEl) bodyEl.value = tpl.body || "";
      updateTemplatePreview(type);
    });
  } catch (_) {}
}

document.querySelector("#notificationsConfigForm")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const result = document.querySelector("#notifConfigResult");
  result.style.display = "none";
  const body = {
    smtp: {
      enabled: document.querySelector("#smtpEnabled").checked,
      host: document.querySelector("#smtpHost").value.trim(),
      port: parseInt(document.querySelector("#smtpPort").value) || 587,
      secure: document.querySelector("#smtpSecure").checked,
      user: document.querySelector("#smtpUser").value.trim(),
      pass: document.querySelector("#smtpPass").value,
      from: document.querySelector("#smtpFrom").value.trim(),
    },
    adminEmails: document.querySelector("#adminEmailsList").value.trim(),
    app_url: document.querySelector("#appUrl").value.trim(),
    templates: {
      received: {
        subject: document.querySelector("#tpl_received_subject")?.value || "",
        body: document.querySelector("#tpl_received_body")?.value || "",
      },
      status_changed: {
        subject: document.querySelector("#tpl_status_changed_subject")?.value || "",
        body: document.querySelector("#tpl_status_changed_body")?.value || "",
      },
      resolved: {
        subject: document.querySelector("#tpl_resolved_subject")?.value || "",
        body: document.querySelector("#tpl_resolved_body")?.value || "",
      },
    },
  };
  try {
    await requestJson("/api/notifications/config", { method: "PUT", body: JSON.stringify(body) });
    result.style.display = "block";
    result.style.color = "var(--ok)";
    result.textContent = "Configuración SMTP guardada correctamente.";
  } catch (err) {
    result.style.display = "block";
    result.style.color = "var(--danger)";
    result.textContent = err.message;
  }
});

document.querySelectorAll(".saveTplBtn").forEach((btn) => {
  btn.addEventListener("click", async () => {
    const type = btn.dataset.tplType;
    const subject = document.querySelector(`#tpl_${type}_subject`)?.value || "";
    const body = document.querySelector(`#tpl_${type}_body`)?.value || "";
    try {
      const current = await requestJson("/api/notifications/config");
      current.templates = current.templates || {};
      current.templates[type] = { subject, body };
      if (current.smtp?.pass === "••••••••") current.smtp.pass = "••••••••";
      await requestJson("/api/notifications/config", {
        method: "PUT",
        body: JSON.stringify(current),
      });
      btn.textContent = "¡Guardado!";
      setTimeout(() => {
        btn.textContent = "Guardar plantilla";
      }, 2000);
    } catch (err) {
      alert(err.message);
    }
  });
});

document.querySelectorAll("[data-restore-tpl]").forEach((btn) => {
  btn.addEventListener("click", () => {
    const type = btn.dataset.restoreTpl;
    const defaults = DEFAULT_TEMPLATES_CLIENT[type];
    if (!defaults) return;
    const subjectEl = document.querySelector(`#tpl_${type}_subject`);
    const bodyEl = document.querySelector(`#tpl_${type}_body`);
    if (subjectEl) subjectEl.value = defaults.subject;
    if (bodyEl) bodyEl.value = defaults.body;
    updateTemplatePreview(type);
  });
});

document.querySelectorAll(".tplTestBtn").forEach((btn) => {
  btn.addEventListener("click", async () => {
    const type = btn.dataset.tplType;
    const adminEmails = document.querySelector("#adminEmailsList")?.value.trim();
    const smtpUser = document.querySelector("#smtpUser")?.value.trim();
    const to = adminEmails?.split(",")[0]?.trim() || smtpUser || "";
    if (!to || !to.includes("@")) {
      alert("Agrega al menos un correo admin o configura el usuario SMTP para enviar la prueba.");
      return;
    }
    btn.disabled = true;
    btn.textContent = "Enviando…";
    try {
      await requestJson("/api/notifications/test", {
        method: "POST",
        body: JSON.stringify({ to, type }),
      });
      btn.textContent = `¡Enviado a ${to}!`;
      setTimeout(() => {
        btn.textContent = "Enviar prueba";
        btn.disabled = false;
      }, 3000);
    } catch (err) {
      alert(err.message);
      btn.textContent = "Enviar prueba";
      btn.disabled = false;
    }
  });
});

["received", "status_changed", "resolved"].forEach((type) => {
  document
    .querySelector(`#tpl_${type}_subject`)
    ?.addEventListener("input", () => updateTemplatePreview(type));
  document
    .querySelector(`#tpl_${type}_body`)
    ?.addEventListener("input", () => updateTemplatePreview(type));
});

// Change password
changePasswordForm?.addEventListener("submit", async (e) => {
  e.preventDefault();
  cpMessage.textContent = "";
  const newPass = document.querySelector("#cpNew").value;
  const confirmPass = document.querySelector("#cpConfirm").value;
  if (newPass !== confirmPass) {
    cpMessage.style.color = "var(--danger)";
    cpMessage.textContent = "Las contraseñas no coinciden.";
    return;
  }
  try {
    await requestJson("/api/auth/password", {
      method: "POST",
      body: JSON.stringify({
        current: document.querySelector("#cpCurrent").value,
        password: newPass,
      }),
    });
    cpMessage.style.color = "var(--ok)";
    cpMessage.textContent = "Contraseña actualizada correctamente.";
    changePasswordForm.reset();
  } catch (err) {
    cpMessage.style.color = "var(--danger)";
    cpMessage.textContent = err.message;
  }
});

// ── Drag & drop ───────────────────────────────────────────────────────────────

function getDragAfterCard(zone, y) {
  const cards = [...zone.querySelectorAll(".ticketCard:not(.dragging)")];
  return cards.reduce(
    (closest, child) => {
      const box = child.getBoundingClientRect();
      const offset = y - box.top - box.height / 2;
      if (offset < 0 && offset > closest.offset) return { offset, element: child };
      return closest;
    },
    { offset: Number.NEGATIVE_INFINITY, element: null }
  ).element;
}

kanbanBoard.addEventListener("dragstart", (e) => {
  if (e.target.closest(".statusSelect, .bulkCheckbox")) {
    e.preventDefault();
    return;
  }
  const card = e.target.closest(".ticketCard");
  if (!card) return;
  e.dataTransfer.setData("text/plain", card.dataset.ticketId);
  e.dataTransfer.effectAllowed = "move";
  card.classList.add("dragging");
});

kanbanBoard.addEventListener("dragend", (e) => {
  e.target.closest(".ticketCard")?.classList.remove("dragging");
  kanbanBoard.querySelectorAll(".dropZone").forEach((zone) => zone.classList.remove("over"));
});
kanbanBoard.addEventListener("dragover", (e) => {
  const z = e.target.closest(".dropZone");
  if (!z) return;
  e.preventDefault();
  z.classList.add("over");
  const dragging = kanbanBoard.querySelector(".ticketCard.dragging");
  if (!dragging) return;
  const after = getDragAfterCard(z, e.clientY);
  if (after) z.insertBefore(dragging, after);
  else z.appendChild(dragging);
});
kanbanBoard.addEventListener("dragleave", (e) => {
  const z = e.target.closest(".dropZone");
  if (z && !z.contains(e.relatedTarget)) z.classList.remove("over");
});

kanbanBoard.addEventListener("drop", async (e) => {
  const zone = e.target.closest(".dropZone");
  if (!zone) return;
  e.preventDefault();
  zone.classList.remove("over");
  const orderedIds = [...zone.querySelectorAll(".ticketCard")].map((card) => card.dataset.ticketId);
  try {
    await moveTicketPosition(e.dataTransfer.getData("text/plain"), zone.dataset.status, orderedIds);
  } catch (error) {
    formMessage.textContent = error.message;
  }
});

// ── Navigation ────────────────────────────────────────────────────────────────

createTicketButton.addEventListener("click", () => {
  formMessage.textContent = "";
  showView("create");
});
cancelCreateButton.addEventListener("click", () => {
  form.reset();
  form.urgency.value = "media";
  formMessage.textContent = "";
  showView("overview");
});
slaButton.addEventListener("click", () => {
  // Activar "Este mes" por defecto si no hay fechas seleccionadas
  if (!slaDateFrom.value && !slaDateTo.value) {
    const now = new Date();
    slaDateFrom.value = toDateInput(new Date(now.getFullYear(), now.getMonth(), 1));
    slaDateTo.value = toDateInput(now);
    document.querySelectorAll(".slaPresetBtn").forEach((b) => b.classList.remove("active"));
    const mesBtn = document.querySelector('.slaPresetBtn[data-preset="month"]');
    if (mesBtn) mesBtn.classList.add("active");
  }
  renderSlaReport();
  showView("sla");
});
backToOverviewButton.addEventListener("click", () => showView("overview"));
settingsButton.addEventListener("click", () => {
  populateSettingsPanel();
  loadEmailSettings();
  loadNotificationsSettings();
  loadAiSettings();
  showView("settings");
});
backFromSettings?.addEventListener("click", () => showView("overview"));
adminButton.addEventListener("click", () => {
  renderAdminView();
  showView("admin");
});
backFromAdminButton.addEventListener("click", () => showView("overview"));
exportCsvButton.addEventListener("click", downloadCsv);
adminDeleteSelected.addEventListener("click", deleteSelectedTickets);

exportSlaButton.addEventListener("click", () => {
  renderSlaReport();
  document.body.classList.add("printing-sla");
  window.print();
  setTimeout(() => document.body.classList.remove("printing-sla"), 500);
});

// ── Presets de fecha para Indicadores ────────────────────────────────────────
function toDateInput(d) { return d.toISOString().slice(0, 10); }

document.addEventListener("click", (e) => {
  const btn = e.target.closest(".slaPresetBtn");
  if (!btn) return;
  const now = new Date();
  let from, to;
  switch (btn.dataset.preset) {
    case "today":
      from = to = now;
      break;
    case "week": {
      const day = now.getDay() || 7;
      from = new Date(now); from.setDate(now.getDate() - day + 1);
      to = now;
      break;
    }
    case "month":
      from = new Date(now.getFullYear(), now.getMonth(), 1);
      to = now;
      break;
    case "lastmonth":
      from = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      to = new Date(now.getFullYear(), now.getMonth(), 0);
      break;
    case "30d":
      from = new Date(now); from.setDate(now.getDate() - 29);
      to = now;
      break;
    case "90d":
      from = new Date(now); from.setDate(now.getDate() - 89);
      to = now;
      break;
    default: return;
  }
  if (slaDateFrom) slaDateFrom.value = toDateInput(from);
  if (slaDateTo) slaDateTo.value = toDateInput(to);
  // Mark active preset
  document.querySelectorAll(".slaPresetBtn").forEach((b) => b.classList.remove("active"));
  btn.classList.add("active");
  renderSlaReport();
});

statusFilter.addEventListener("change", (e) => {
  clearStatFilter();
  currentFilter = e.target.value;
  selectedTickets.clear();
  updateBulkBar();
  listPage = 1;
  renderTickets();
});

boardSearch?.addEventListener("input", () => { listPage = 1; renderTickets(); });
boardAreaFilter?.addEventListener("change", () => { listPage = 1; renderTickets(); });
boardDateFrom?.addEventListener("change", () => { listPage = 1; renderTickets(); });
boardDateTo?.addEventListener("change", () => { listPage = 1; renderTickets(); });

document.querySelector(".statsGrid")?.addEventListener("click", (e) => {
  const card = e.target.closest("[data-stat-filter]");
  if (!card) return;
  const key = card.dataset.statFilter;
  if (key === "cumplimiento_sla") {
    showView("sla");
    return;
  }
  if (statFilter === key) {
    clearStatFilter();
    renderTickets();
    return;
  }
  applyStatFilter(key);
});

document.querySelector(".statsGrid")?.addEventListener("keydown", (e) => {
  if (e.key !== "Enter" && e.key !== " ") return;
  const card = e.target.closest("[data-stat-filter]");
  if (!card) return;
  e.preventDefault();
  card.click();
});

const toggleClosedBtn = document.querySelector("#toggleClosedBtn");
toggleClosedBtn?.addEventListener("click", () => {
  showClosedTickets = !showClosedTickets;
  toggleClosedBtn.classList.toggle("active", showClosedTickets);
  selectedTickets.clear();
  updateBulkBar();
  renderTickets();
});

document.querySelectorAll("[data-board-view]").forEach((button) => {
  button.addEventListener("click", () => {
    boardView = button.dataset.boardView;
    document
      .querySelectorAll("[data-board-view]")
      .forEach((b) => b.classList.toggle("active", b === button));
    renderTickets();
  });
});

[
  slaDateFrom,
  slaDateTo,
  slaStatusFilter,
  slaAreaFilter,
  slaUrgencyFilter,
  slaStateFilter,
  slaTimeFilter,
  slaSearchFilter,
].forEach((input) => {
  input.addEventListener("input", renderSlaReport);
  input.addEventListener("change", renderSlaReport);
});

[adminSearch, adminDateFrom, adminDateTo, adminStatusFilter, adminUrgencyFilter].forEach(
  (input) => {
    input.addEventListener("input", renderAdminView);
    input.addEventListener("change", renderAdminView);
  }
);

// ── Ticket creation ───────────────────────────────────────────────────────────

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  formMessage.textContent = "";
  const fd = new FormData(form);
  const ticket = {
    name: fd.get("name"),
    contact: fd.get("contact") || "",
    area: fd.get("area") || "",
    urgency: fd.get("urgency"),
    subject: fd.get("subject") || "",
    description: fd.get("description") || "",
    customFields: collectCreateCustomFields(),
  };
  try {
    await requestJson("/api/tickets", { method: "POST", body: JSON.stringify(ticket) });
    form.reset();
    form.urgency.value = "media";
    formMessage.textContent = "Ticket creado.";
    showView("overview");
    await refresh();
  } catch (error) {
    formMessage.textContent = error.message;
  }
});

document.addEventListener("change", async (e) => {
  const select = e.target.closest(".statusSelect");
  if (!select) return;
  try {
    await moveTicket(select.dataset.ticketId, select.value);
  } catch (error) {
    formMessage.textContent = error.message;
    await refresh();
  }
});

// ── Data refresh ──────────────────────────────────────────────────────────────

async function moveTicket(ticketId, status) {
  if (status === "resuelto" || status === "cerrado") {
    const ticket = cachedTickets.find((t) => t.id === ticketId);
    if (ticket) {
      await refresh();
      openTicketDetail({ ...ticket, status });
      return;
    }
  }
  await requestJson(`/api/tickets/${encodeURIComponent(ticketId)}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
  await refresh();
}

async function moveTicketPosition(ticketId, status, orderedIds) {
  if (status === "resuelto" || status === "cerrado") {
    const ticket = cachedTickets.find((t) => t.id === ticketId);
    if (ticket) {
      await refresh();
      openTicketDetail({ ...ticket, status });
      return;
    }
  }
  await requestJson(`/api/tickets/${encodeURIComponent(ticketId)}/position`, {
    method: "PATCH",
    body: JSON.stringify({ status, orderedIds }),
  });
  await refresh();
}

async function refresh() {
  if (refreshInFlight) return refreshInFlight;
  refreshInFlight = doRefresh().finally(() => {
    refreshInFlight = null;
  });
  return refreshInFlight;
}

async function doRefresh() {
  const [tickets, stats, version] = await Promise.all([
    requestJson("/api/tickets"),
    requestJson("/api/stats"),
    requestJson("/api/version"),
  ]);

  cachedTickets = tickets;

  const ids = new Set(tickets.map((t) => t.id));
  selectedTickets.forEach((id) => {
    if (!ids.has(id)) selectedTickets.delete(id);
  });
  adminSelected.forEach((id) => {
    if (!ids.has(id)) adminSelected.delete(id);
  });
  updateBulkBar();

  renderSlaFilters();
  renderTickets();
  renderVersion(version);
  renderStats(stats);

  // Update area filter dropdown with distinct areas
  if (boardAreaFilter) {
    const current = boardAreaFilter.value;
    const areas = [...new Set(tickets.map((t) => t.area).filter(Boolean))].sort();
    boardAreaFilter.innerHTML = '<option value="">Todas</option>' +
      areas.map((a) => `<option value="${escapeHtml(a)}" ${current === a ? "selected" : ""}>${escapeHtml(a)}</option>`).join("");
  }

  const badge = document.getElementById("sidebarTicketCount");
  if (badge) {
    const newCount = tickets.filter((t) => t.createdAt > lastVisitTs && t.status !== "cerrado").length;
    const active = tickets.filter((t) => t.status !== "cerrado").length;
    badge.textContent = newCount > 0 ? `+${newCount}` : (active > 0 ? active : "");
    badge.classList.toggle("sidebarBadge--new", newCount > 0);
  }
  renderSlaReport();
}

function connectLiveUpdates() {
  if (!window.EventSource || liveEvents) return;
  liveEvents = new EventSource("/api/events");
  liveEvents.addEventListener("ticketsChanged", () => {
    refresh().catch(() => {});
    loadEmailStatus().catch(() => {});
  });
  liveEvents.onerror = () => {
    liveEvents.close();
    liveEvents = null;
    setTimeout(connectLiveUpdates, 5000);
  };
}

// ── Auth ──────────────────────────────────────────────────────────────────────

logoutButton.addEventListener("click", async () => {
  await fetch("/api/auth/logout", { method: "POST" });
  window.location.replace("/login");
});

// ── Boot ──────────────────────────────────────────────────────────────────────

showView("overview");

// ── User management ───────────────────────────────────────────────────────────

let currentUsername = "";

const usersList = document.querySelector("#usersList");
const newUserForm = document.querySelector("#newUserForm");
const newUsernameInput = document.querySelector("#newUsername");
const newUserPasswordInput = document.querySelector("#newUserPassword");
const newUserMessage = document.querySelector("#newUserMessage");
const toggleNewUserPass = document.querySelector("#toggleNewUserPass");

const EYE_OPEN_SVG = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`;
const EYE_CLOSED_SVG = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`;

if (toggleNewUserPass) {
  toggleNewUserPass.innerHTML = EYE_OPEN_SVG;
  toggleNewUserPass.addEventListener("click", () => {
    const isPass = newUserPasswordInput.type === "password";
    newUserPasswordInput.type = isPass ? "text" : "password";
    toggleNewUserPass.innerHTML = isPass ? EYE_CLOSED_SVG : EYE_OPEN_SVG;
  });
}

function renderUsers(users) {
  if (!usersList) return;
  if (!users.length) {
    usersList.innerHTML = '<p class="empty compact">No hay usuarios registrados.</p>';
    return;
  }
  usersList.innerHTML = users
    .map((u) => {
      const isSelf = u === currentUsername;
      return `
      <div class="userCard" data-username="${escapeHtml(u)}">
        <div class="userCardAvatar">${escapeHtml(u.charAt(0).toUpperCase())}</div>
        <div class="userCardName">${escapeHtml(u)}${isSelf ? ' <span class="userCardSelf">tú</span>' : ""}</div>
        <div class="userCardActions">
          <button class="ghostButton userEditNameBtn" type="button" style="font-size:0.82rem">Editar nombre</button>
          <button class="ghostButton userChangePassBtn" type="button" style="font-size:0.82rem">Cambiar contraseña</button>
          ${!isSelf ? `<button class="dangerButton userDeleteBtn" type="button" style="font-size:0.82rem" title="Eliminar usuario">Eliminar</button>` : ""}
        </div>
        <form class="userEditNameForm" hidden>
          <input type="text" placeholder="Nuevo nombre de usuario" autocomplete="off" />
          <button type="submit" class="primaryAction" style="font-size:0.82rem;white-space:nowrap">Guardar</button>
          <p class="message" style="grid-column:1/-1;margin:0"></p>
        </form>
        <form class="userChangePassForm" hidden>
          <div class="userPassInputs">
            <input class="userNewPassInput" type="password" placeholder="Nueva contraseña (mín. 4 chars)" autocomplete="new-password" />
            <input class="userConfirmPassInput" type="password" placeholder="Confirmar contraseña" autocomplete="new-password" />
          </div>
          <button type="submit" class="primaryAction" style="font-size:0.82rem;white-space:nowrap;align-self:start">Guardar</button>
          <p class="message" style="grid-column:1/-1;margin:0"></p>
        </form>
      </div>`;
    })
    .join("");
}

async function loadUsers() {
  if (!usersList) return;
  try {
    const data = await requestJson("/api/users");
    renderUsers(data.users || []);
  } catch {
    usersList.innerHTML = '<p class="empty compact">No se pudo cargar la lista de usuarios.</p>';
  }
}

usersList?.addEventListener("click", async (e) => {
  const card = e.target.closest(".userCard");
  if (!card) return;
  const username = card.dataset.username;

  if (e.target.closest(".userEditNameBtn")) {
    const form = card.querySelector(".userEditNameForm");
    const passForm = card.querySelector(".userChangePassForm");
    passForm.hidden = true;
    form.hidden = !form.hidden;
    if (!form.hidden) {
      form.querySelector("input").value = username;
      form.querySelector("input").focus();
    }
    return;
  }

  if (e.target.closest(".userChangePassBtn")) {
    const form = card.querySelector(".userChangePassForm");
    const nameForm = card.querySelector(".userEditNameForm");
    nameForm.hidden = true;
    form.hidden = !form.hidden;
    if (!form.hidden) form.querySelector(".userNewPassInput").focus();
    return;
  }

  if (e.target.closest(".userDeleteBtn")) {
    if (!confirm(`¿Eliminar el usuario "${username}"? Esta acción no se puede deshacer.`)) return;
    try {
      await fetch(`/api/users/${encodeURIComponent(username)}`, { method: "DELETE" });
      await loadUsers();
    } catch {
      alert("No se pudo eliminar el usuario.");
    }
    return;
  }
});

usersList?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const card = e.target.closest(".userCard");
  if (!card) return;
  const username = card.dataset.username;

  if (e.target.closest(".userEditNameForm")) {
    const form = e.target.closest(".userEditNameForm");
    const input = form.querySelector("input");
    const msgEl = form.querySelector(".message");
    msgEl.textContent = "";
    const newName = input.value.trim().toLowerCase();
    if (!newName) {
      msgEl.textContent = "El nombre no puede estar vacío.";
      return;
    }
    try {
      const res = await fetch(`/api/users/${encodeURIComponent(username)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: newName }),
      });
      const data = await res.json();
      if (!res.ok) {
        msgEl.textContent = data.error || "Error al renombrar usuario.";
        return;
      }
      await loadUsers();
    } catch {
      msgEl.textContent = "Error de conexión.";
    }
    return;
  }

  if (e.target.closest(".userChangePassForm")) {
    const form = e.target.closest(".userChangePassForm");
    const passInput = form.querySelector(".userNewPassInput");
    const confirmInput = form.querySelector(".userConfirmPassInput");
    const msgEl = form.querySelector(".message");
    msgEl.textContent = "";
    if (passInput.value !== confirmInput.value) {
      msgEl.textContent = "Las contraseñas no coinciden.";
      return;
    }
    try {
      const res = await fetch(`/api/users/${encodeURIComponent(username)}/password`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: passInput.value }),
      });
      const data = await res.json();
      if (!res.ok) {
        msgEl.textContent = data.error || "Error al cambiar contraseña.";
        return;
      }
      passInput.value = "";
      confirmInput.value = "";
      form.hidden = true;
    } catch {
      msgEl.textContent = "Error de conexión.";
    }
  }
});

document.querySelector("#toggleNewUserPassConfirm")?.addEventListener("click", () => {
  const input = document.querySelector("#newUserPasswordConfirm");
  if (!input) return;
  input.type = input.type === "password" ? "text" : "password";
});

newUserForm?.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!newUserMessage) return;
  newUserMessage.textContent = "";
  const username = newUsernameInput.value.trim();
  const password = newUserPasswordInput.value;
  const confirmPassword = document.querySelector("#newUserPasswordConfirm")?.value;
  if (confirmPassword !== undefined && password !== confirmPassword) {
    newUserMessage.textContent = "Las contraseñas no coinciden.";
    return;
  }
  try {
    const res = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    const data = await res.json();
    if (!res.ok) {
      newUserMessage.textContent = data.error || "Error al crear usuario.";
      return;
    }
    newUsernameInput.value = "";
    newUserPasswordInput.value = "";
    newUserMessage.textContent = `Usuario "${data.username}" creado correctamente.`;
    await loadUsers();
  } catch {
    newUserMessage.textContent = "Error de conexión.";
  }
});

// Load users when tab is opened
document.querySelector('[data-tab="usersTab"]')?.addEventListener("click", loadUsers);

async function init() {
  try {
    const me = await requestJson("/api/auth/me");
    currentUser.textContent = me.username;
    currentUsername = me.username;
    const avatarEl = document.getElementById("sidebarUserAvatar");
    if (avatarEl) avatarEl.textContent = me.username.slice(0, 2).toUpperCase();
  } catch {
    window.location.replace("/login");
    return;
  }
  try {
    await Promise.all([refresh(), loadConfig()]);
    connectLiveUpdates();
    initBrowserNotifications();
    setInterval(() => refresh().catch(() => {}), 15000);
    setInterval(() => loadEmailStatus().catch(() => {}), 30000);
    const deepTicket = new URLSearchParams(location.search).get("ticket");
    if (deepTicket) {
      const t = cachedTickets.find((x) => x.id === deepTicket);
      if (t) openTicketDetail(t);
      history.replaceState(null, "", "/");
    }
  } catch (error) {
    kanbanBoard.innerHTML = `<p class="empty">${escapeHtml(error.message)}</p>`;
  }
}

// ── Global search ─────────────────────────────────────────────────────────────

let globalSearchResults = null; // div overlay
let globalSearchTimeout = null;

function buildGlobalSearchOverlay() {
  if (globalSearchResults) return;
  globalSearchResults = document.createElement("div");
  globalSearchResults.className = "globalSearchResults";
  globalSearchResults.setAttribute("role", "listbox");
  document.querySelector(".topBarRight")?.appendChild(globalSearchResults);
  document.addEventListener("click", (e) => {
    if (!e.target.closest(".globalSearchWrap") && !e.target.closest(".globalSearchResults")) {
      closeGlobalSearch();
    }
  }, true);
}

function closeGlobalSearch() {
  if (globalSearchResults) globalSearchResults.innerHTML = "";
  globalSearchResults?.classList.remove("open");
}

globalSearch?.addEventListener("input", () => {
  clearTimeout(globalSearchTimeout);
  globalSearchTimeout = setTimeout(() => runGlobalSearch(), 200);
});

globalSearch?.addEventListener("keydown", (e) => {
  if (e.key === "Escape") { closeGlobalSearch(); globalSearch.blur(); }
});

function runGlobalSearch() {
  const q = globalSearch?.value.trim().toLowerCase();
  if (!q || q.length < 2) { closeGlobalSearch(); return; }
  buildGlobalSearchOverlay();
  const matches = cachedTickets.filter((t) => {
    return (
      (t.id || "").toLowerCase().includes(q) ||
      (t.subject || "").toLowerCase().includes(q) ||
      (t.name || "").toLowerCase().includes(q) ||
      (t.contact || "").toLowerCase().includes(q) ||
      (t.area || "").toLowerCase().includes(q) ||
      (t.description || "").toLowerCase().includes(q)
    );
  }).slice(0, 8);

  if (!matches.length) {
    globalSearchResults.innerHTML = `<div class="globalSearchEmpty">Sin resultados para "${escapeHtml(q)}"</div>`;
    globalSearchResults.classList.add("open");
    return;
  }

  globalSearchResults.innerHTML = matches.map((t) => {
    const slaState = t.sla || {};
    const badge = slaState.breached ? `<span class="gsrBadge gsrBadge--danger">Vencido</span>` : "";
    const statusLabel = statuses.find((s) => s.key === t.status)?.label || t.status;
    return `<div class="globalSearchItem" role="option" data-ticket-id="${escapeHtml(t.id)}">
      <div class="gsrMain">
        <span class="gsrId">${escapeHtml(t.id)}</span>
        <span class="gsrSubject">${escapeHtml(t.subject || "(sin asunto)")}</span>
        ${badge}
      </div>
      <div class="gsrMeta">${escapeHtml(t.name || t.contact || "")} · ${escapeHtml(statusLabel)}</div>
    </div>`;
  }).join("");
  globalSearchResults.classList.add("open");

  globalSearchResults.querySelectorAll(".globalSearchItem").forEach((el) => {
    el.addEventListener("click", () => {
      const ticket = cachedTickets.find((t) => t.id === el.dataset.ticketId);
      if (ticket) {
        openTicketDetail(ticket);
        closeGlobalSearch();
        if (globalSearch) globalSearch.value = "";
      }
    });
  });
}

// ── Browser notifications ─────────────────────────────────────────────────────

let knownTicketIds = new Set();

function initBrowserNotifications() {
  if (!("Notification" in window)) return;
  // Show enable button if not yet granted
  if (Notification.permission === "default" && notifPermBtn) {
    notifPermBtn.hidden = false;
    notifPermBtn.title = "Activar notificaciones del navegador para tickets nuevos";
  } else if (Notification.permission === "granted") {
    setupNotifOnNewTickets();
  }
}

notifPermBtn?.addEventListener("click", async () => {
  const perm = await Notification.requestPermission();
  if (perm === "granted") {
    notifPermBtn.hidden = true;
    setupNotifOnNewTickets();
  }
});

function setupNotifOnNewTickets() {
  // Seed knownTicketIds with current tickets (no notification for existing ones)
  cachedTickets.forEach((t) => knownTicketIds.add(t.id));
  // Override the SSE event to also trigger notifications
  if (liveEvents) {
    liveEvents.addEventListener("ticketsChanged", handleTicketsChangedForNotif);
  }
}

async function handleTicketsChangedForNotif() {
  try {
    const freshTickets = await requestJson("/api/tickets");
    freshTickets.forEach((t) => {
      if (!knownTicketIds.has(t.id)) {
        knownTicketIds.add(t.id);
        if (Notification.permission === "granted") {
          const n = new Notification(`Nuevo ticket — ${t.id}`, {
            body: `${t.subject || "(sin asunto)"}\n${t.name || t.contact || ""}`,
            icon: "/favicon.ico",
            tag: t.id,
          });
          n.onclick = () => {
            window.focus();
            const ticket = cachedTickets.find((x) => x.id === t.id);
            if (ticket) openTicketDetail(ticket);
            n.close();
          };
        }
      }
    });
  } catch (_) {}
}

init();
