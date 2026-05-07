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
const sidebar = document.querySelector("#sidebar");
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
const detailMessage = document.querySelector("#detailMessage");
const detailCustomFields = document.querySelector("#detailCustomFields");
const detailHistory = document.querySelector("#detailHistory");
const saveTicketDetail = document.querySelector("#saveTicketDetail");
const resolveTicketDetail = document.querySelector("#resolveTicketDetail");
const closeTicketDetailStatus = document.querySelector("#closeTicketDetailStatus");
const detailDeleteButton = document.querySelector("#detailDeleteButton");

// Edit modal
const editModal = document.querySelector("#editModal");
const editTicketForm = document.querySelector("#editTicketForm");
const editTicketId = document.querySelector("#editTicketId");
const editModalTicketId = document.querySelector("#editModalTicketId");
const closeEditModal = document.querySelector("#closeEditModal");
const cancelEditButton = document.querySelector("#cancelEditButton");
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
let boardView = "cards";
let cachedTickets = [];
let appConfig = null;
let selectedTickets = new Set();
let adminSelected = new Set();
let refreshInFlight = null;
let liveEvents = null;
let activeTicketId = null;
let showClosedTickets = false;

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

function showView(name) {
  ticketDetailModal.hidden = true;
  overviewView.classList.toggle("active", name === "overview");
  createView.classList.toggle("active", name === "create");
  slaView.classList.toggle("active", name === "sla");
  settingsView.classList.toggle("active", name === "settings");
  adminView.classList.toggle("active", name === "admin");

  if (name !== "overview") {
    selectedTickets.clear();
    updateBulkBar();
  }
  if (name !== "admin") {
    adminSelected.clear();
  }
  document.querySelectorAll(".sidebarItem").forEach((btn) => btn.classList.remove("active"));
  if (name === "overview") sidebarOverviewButton?.classList.add("active");
  if (name === "admin") adminButton?.classList.add("active");
  if (name === "sla") slaButton?.classList.add("active");
  if (name === "settings") settingsButton?.classList.add("active");
}

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

  document.querySelector("#fieldContactEnabled").checked = appConfig.fields.contact.enabled;
  document.querySelector("#fieldContactLabel").value = appConfig.fields.contact.label;
  document.querySelector("#fieldAreaEnabled").checked = appConfig.fields.area.enabled;
  document.querySelector("#fieldAreaLabel").value = appConfig.fields.area.label;
  renderCustomFieldsBuilder();

  const portalUrl = `${window.location.origin}/portal`;
  document.querySelector("#portalUrlDisplay").textContent = portalUrl;
  document.querySelector("#openPortalLink").href = "/portal";
}

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
  if (slaDetailDonut) slaDetailDonut.style.setProperty("--donut-color", complianceColor(compliance));

  renderBars(slaStatusBars, statuses, stats.byStatus || {});
  renderBars(slaUrgencyBars, urgencies, stats.byUrgency || {});
}

function renderVersion(info) {
  appVersion.textContent = `v${info.version}`;
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
  let tickets = showClosedTickets ? cachedTickets : cachedTickets.filter((t) => t.status !== "cerrado");
  if (currentFilter === "todos") return tickets;
  return tickets.filter((t) => t.status === currentFilter);
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
  const visibleStatuses = showClosedTickets ? statuses : statuses.filter((s) => s.key !== "cerrado");
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

function renderTicketCard(ticket) {
  const slaText = ticket.sla.breached ? "SLA vencido" : `${ticket.sla.remainingHours}h SLA`;
  const createdAt = formatDate.format(new Date(ticket.createdAt));
  return `
    <article class="ticketCard urgency-${escapeHtml(ticket.urgency)}" draggable="true" data-ticket-id="${escapeHtml(ticket.id)}">
      <div class="ticketTitle">
        <input type="checkbox" class="bulkCheckbox cardCheckbox" data-ticket-id="${escapeHtml(ticket.id)}" ${selectedTickets.has(ticket.id) ? "checked" : ""} aria-label="Seleccionar ${escapeHtml(ticket.id)}">
        <span>${escapeHtml(ticket.id)}</span>
        <span class="badge ${escapeHtml(ticket.urgency)}">${escapeHtml(ticket.urgency)}</span>
      </div>
      <p class="ticketName">${escapeHtml(ticket.name)}</p>
      ${ticket.subject ? `<p class="ticketSubject">${escapeHtml(ticket.subject)}</p>` : ""}
      <p class="ticketMeta">${escapeHtml(ticket.contact)} · ${escapeHtml(ticket.area)} · ${createdAt}</p>
      <div class="cardFooter">
        <span class="sla ${ticket.sla.breached ? "breached" : ""}">${slaText}</span>
        ${renderStatusSelect(ticket)}
      </div>
    </article>
  `;
}

function renderTicketList(tickets) {
  if (tickets.length === 0) {
    ticketListView.innerHTML = '<p class="empty">Sin tickets para este filtro.</p>';
    return;
  }
  ticketListView.innerHTML = `
    <div class="tableWrap">
      <table>
        <thead>
          <tr>
            <th><input type="checkbox" id="selectAllCheckbox" class="bulkCheckbox" aria-label="Seleccionar todos"></th>
            <th>Ticket</th><th>Solicitante</th><th>Contacto</th><th>Área</th>
            <th>Urgencia</th><th>SLA</th><th>Estado</th><th></th>
          </tr>
        </thead>
        <tbody>
          ${tickets
            .map((ticket) => {
              const slaText = ticket.sla.breached ? "Vencido" : `${ticket.sla.remainingHours}h`;
              return `
              <tr class="ticketRow" data-ticket-id="${escapeHtml(ticket.id)}">
                <td><input type="checkbox" class="bulkCheckbox rowCheckbox" data-ticket-id="${escapeHtml(ticket.id)}" ${selectedTickets.has(ticket.id) ? "checked" : ""}></td>
                <td><span class="ticketCode">${escapeHtml(ticket.id)}</span></td>
                <td class="subjectCell">${escapeHtml(ticket.subject || ticket.description || "(sin asunto)")}</td>
                <td>${escapeHtml(ticket.name)}</td>
                <td>${escapeHtml(ticket.contact)}</td>
                <td>${escapeHtml(ticket.area)}</td>
                <td><span class="badge ${escapeHtml(ticket.urgency)}">${escapeHtml(ticket.urgency)}</span></td>
                <td><span class="sla ${ticket.sla.breached ? "breached" : ""}">${slaText}</span></td>
                <td>${renderStatusSelect(ticket)}</td>
                <td class="rowActions"></td>
              </tr>
            `;
            })
            .join("")}
        </tbody>
      </table>
    </div>
  `;
  const allSelected = tickets.every((t) => selectedTickets.has(t.id));
  const selectAll = document.querySelector("#selectAllCheckbox");
  if (selectAll) {
    selectAll.checked = allSelected && tickets.length > 0;
    selectAll.indeterminate = !allSelected && selectedTickets.size > 0;
  }
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

  const headers = ["ID", "Nombre", "Contacto", "Área", "Urgencia", "Estado", "Fuente", "Creado"];
  const rows = filtered.map((t) => [
    t.id,
    t.name,
    t.contact,
    t.area,
    t.urgency,
    t.status,
    t.source,
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
  const compliance =
    active.length === 0
      ? 100
      : Math.round(((active.length - breached.length) / active.length) * 100);
  const avgRemaining =
    active.length === 0
      ? 0
      : Number(
          (active.reduce((sum, t) => sum + t.sla.remainingHours, 0) / active.length).toFixed(1)
        );
  return {
    byStatus,
    byUrgency,
    compliance,
    avgRemainingHours: avgRemaining,
    breached: breached.length,
  };
}

function renderSlaReport() {
  const filtered = getFilteredSlaTickets();
  const summary = summarizeTickets(filtered);

  slaFilteredCount.textContent = filtered.length;
  slaDetailCompliance.textContent = `${summary.compliance}%`;
  metricRemaining.textContent = `${summary.avgRemainingHours}h`;
  slaDetailDonut.style.setProperty("--value", summary.compliance);
  slaDetailDonut.style.setProperty("--donut-color", complianceColor(summary.compliance));
  renderBars(slaStatusBars, statuses, summary.byStatus);
  renderBars(slaUrgencyBars, urgencies, summary.byUrgency);
  slaReportMeta.textContent = `Generado ${formatDate.format(new Date())} · ${filtered.length} tickets`;
  renderSlaTicketTable(filtered);
}

function renderSlaTicketTable(tickets) {
  if (tickets.length === 0) {
    slaTicketTable.innerHTML =
      '<p class="empty">No hay tickets para los filtros seleccionados.</p>';
    return;
  }
  slaTicketTable.innerHTML = `
    <div class="tableWrap">
      <table>
        <thead>
          <tr><th>Ticket</th><th>Fecha</th><th>Solicitante</th><th>Contacto</th><th>Área</th><th>Urgencia</th><th>Estado</th><th>SLA</th></tr>
        </thead>
        <tbody>
          ${tickets
            .map((ticket) => {
              const slaText = ticket.sla.breached ? "Vencido" : `${ticket.sla.remainingHours}h`;
              return `
              <tr>
                <td>${escapeHtml(ticket.id)}</td>
                <td>${formatDate.format(new Date(ticket.createdAt))}</td>
                <td>${escapeHtml(ticket.name)}</td>
                <td>${escapeHtml(ticket.contact)}</td>
                <td>${escapeHtml(ticket.area)}</td>
                <td><span class="badge ${escapeHtml(ticket.urgency)}">${escapeHtml(ticket.urgency)}</span></td>
                <td>${escapeHtml(getLabel(statuses, ticket.status))}</td>
                <td><span class="sla ${ticket.sla.breached ? "breached" : ""}">${slaText}</span></td>
              </tr>
            `;
            })
            .join("")}
        </tbody>
      </table>
    </div>
  `;
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

function openTicketDetail(ticket) {
  activeTicketId = ticket.id;
  ticketDetailId.textContent = ticket.id;
  detailSubject.textContent = ticket.subject || "(sin asunto)";
  detailDescription.textContent = ticket.description || "Sin descripcion registrada.";
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
  detailMessage.textContent = "";
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

function renderTicketHistory(ticket) {
  const history = Array.isArray(ticket.history) ? ticket.history : [];
  if (history.length === 0) {
    detailHistory.innerHTML = '<p class="empty compact">Sin notas guardadas.</p>';
    return;
  }
  detailHistory.innerHTML = history
    .map(
      (item) => `
    <article class="historyItem">
      <div>
        <strong>${escapeHtml(getLabel(statuses, item.status))}</strong>
        <span>${formatDate.format(new Date(item.createdAt))}</span>
      </div>
      <p>${escapeHtml(item.note)}</p>
    </article>
  `
    )
    .join("");
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
    customFields,
  };
}

async function saveDetail(statusOverride) {
  const payload = collectDetailPayload(statusOverride);
  if (!payload) return;
  if (
    (payload.status === "resuelto" || payload.status === "cerrado") &&
    !payload.resolution &&
    !payload.resolutionNote
  ) {
    detailMessage.textContent = "Agrega la nota de lo realizado antes de resolver o cerrar.";
    return;
  }
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
  await requestJson(`/api/tickets/${encodeURIComponent(activeTicketId)}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
  await refresh();
  closeTicketDetailModal();
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

closeTicketDetail.addEventListener("click", closeTicketDetailModal);
saveTicketDetail.addEventListener("click", () =>
  saveDetail().catch((err) => {
    detailMessage.textContent = err.message;
  })
);
resolveTicketDetail.addEventListener("click", () =>
  saveDetail("resuelto").catch((err) => {
    detailMessage.textContent = err.message;
  })
);
closeTicketDetailStatus.addEventListener("click", () =>
  saveDetail("cerrado").catch((err) => {
    detailMessage.textContent = err.message;
  })
);
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
  document.body.classList.toggle("sidebarCollapsed");
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
    document.querySelector("#emailLastError").textContent = st.lastError || "—";
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
    body: "Hola {{user_name}},\n\nHemos recibido tu ticket #{{ticket_id}}: \"{{ticket_title}}\".\n\nUn agente lo atenderá a la brevedad.\n\nGracias por comunicarte con nosotros.\n\nNeurofic · NeuroDesk",
  },
  status_changed: {
    subject: "Actualización del ticket #{{ticket_id}} — {{new_status}}",
    body: "Hola {{user_name}},\n\nEl estado de tu ticket #{{ticket_id}} \"{{ticket_title}}\" ha cambiado:\n\nEstado anterior: {{old_status}}\nNuevo estado: {{new_status}}\n\nSi tienes preguntas, puedes responder a este correo.\n\nNeurofic · NeuroDesk",
  },
  resolved: {
    subject: "Tu ticket #{{ticket_id}} fue resuelto — NeuroDesk",
    body: "Hola {{user_name}},\n\nNos complace informarte que tu ticket #{{ticket_id}} \"{{ticket_title}}\" ha sido resuelto.\n\nResumen de la atención:\n{{resolution_notes}}\n\nGracias por tu confianza en Neurofic.\n\nNeurofic · NeuroDesk",
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
      await requestJson("/api/notifications/config", { method: "PUT", body: JSON.stringify(current) });
      btn.textContent = "¡Guardado!";
      setTimeout(() => { btn.textContent = "Guardar plantilla"; }, 2000);
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
      await requestJson("/api/notifications/test", { method: "POST", body: JSON.stringify({ to, type }) });
      btn.textContent = `¡Enviado a ${to}!`;
      setTimeout(() => { btn.textContent = "Enviar prueba"; btn.disabled = false; }, 3000);
    } catch (err) {
      alert(err.message);
      btn.textContent = "Enviar prueba";
      btn.disabled = false;
    }
  });
});

["received", "status_changed", "resolved"].forEach((type) => {
  document.querySelector(`#tpl_${type}_subject`)?.addEventListener("input", () => updateTemplatePreview(type));
  document.querySelector(`#tpl_${type}_body`)?.addEventListener("input", () => updateTemplatePreview(type));
});

// Change password
changePasswordForm.addEventListener("submit", async (e) => {
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
  renderSlaReport();
  showView("sla");
});
backToOverviewButton.addEventListener("click", () => showView("overview"));
settingsButton.addEventListener("click", () => {
  populateSettingsPanel();
  loadEmailSettings();
  loadNotificationsSettings();
  showView("settings");
});
backFromSettings.addEventListener("click", () => showView("overview"));
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

statusFilter.addEventListener("change", (e) => {
  currentFilter = e.target.value;
  selectedTickets.clear();
  updateBulkBar();
  renderTickets();
});

const toggleClosedBtn = document.querySelector("#toggleClosedBtn");
toggleClosedBtn?.addEventListener("click", () => {
  showClosedTickets = !showClosedTickets;
  toggleClosedBtn.textContent = showClosedTickets ? "Ocultar cerrados" : "Mostrar cerrados";
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

async function init() {
  try {
    const me = await requestJson("/api/auth/me");
    currentUser.textContent = me.username;
  } catch {
    window.location.replace("/login");
    return;
  }
  try {
    await Promise.all([refresh(), loadConfig()]);
    connectLiveUpdates();
    setInterval(() => refresh().catch(() => {}), 15000);
    setInterval(() => loadEmailStatus().catch(() => {}), 30000);
  } catch (error) {
    kanbanBoard.innerHTML = `<p class="empty">${escapeHtml(error.message)}</p>`;
  }
}

init();
