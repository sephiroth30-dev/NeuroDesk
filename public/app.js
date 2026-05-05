// ── DOM references ──────────────────────────────────────────────────────────

const form                 = document.querySelector("#ticketForm");
const formMessage          = document.querySelector("#formMessage");
const overviewView         = document.querySelector("#overviewView");
const createView           = document.querySelector("#createView");
const slaView              = document.querySelector("#slaView");
const settingsView         = document.querySelector("#settingsView");
const createTicketButton   = document.querySelector("#createTicketButton");
const cancelCreateButton   = document.querySelector("#cancelCreateButton");
const slaButton            = document.querySelector("#slaButton");
const settingsButton       = document.querySelector("#settingsButton");
const backToOverviewButton = document.querySelector("#backToOverviewButton");
const backFromSettings     = document.querySelector("#backFromSettingsButton");
const saveSettingsButton   = document.querySelector("#saveSettingsButton");
const exportSlaButton      = document.querySelector("#exportSlaButton");
const kanbanBoard          = document.querySelector("#kanbanBoard");
const ticketListView       = document.querySelector("#ticketListView");
const statusFilter         = document.querySelector("#statusFilter");
const appVersion           = document.querySelector("#appVersion");
const metricSla            = document.querySelector("#metricSla");
const metricBreached       = document.querySelector("#metricBreached");
const metricRemaining      = document.querySelector("#metricRemaining");
const slaFilteredCount     = document.querySelector("#slaFilteredCount");
const slaDonut             = document.querySelector("#slaDonut");
const activeDonut          = document.querySelector("#activeDonut");
const breachedDonut        = document.querySelector("#breachedDonut");
const slaDetailDonut       = document.querySelector("#slaDetailDonut");
const slaDetailCompliance  = document.querySelector("#slaDetailCompliance");
const statusBars           = document.querySelector("#statusBars");
const urgencyBars          = document.querySelector("#urgencyBars");
const slaStatusBars        = document.querySelector("#slaStatusBars");
const slaUrgencyBars       = document.querySelector("#slaUrgencyBars");
const slaTicketTable       = document.querySelector("#slaTicketTable");
const slaReportMeta        = document.querySelector("#slaReportMeta");
const slaDateFrom          = document.querySelector("#slaDateFrom");
const slaDateTo            = document.querySelector("#slaDateTo");
const slaStatusFilter      = document.querySelector("#slaStatusFilter");
const slaAreaFilter        = document.querySelector("#slaAreaFilter");
const slaUrgencyFilter     = document.querySelector("#slaUrgencyFilter");
const slaStateFilter       = document.querySelector("#slaStateFilter");
const slaTimeFilter        = document.querySelector("#slaTimeFilter");
const slaSearchFilter      = document.querySelector("#slaSearchFilter");
const createContactRow     = document.querySelector("#createContactRow");
const createAreaRow        = document.querySelector("#createAreaRow");
const contactFieldLabel    = document.querySelector("#contactFieldLabel");
const areaFieldLabel       = document.querySelector("#areaFieldLabel");

// Edit modal
const editModal        = document.querySelector("#editModal");
const editTicketForm   = document.querySelector("#editTicketForm");
const editTicketId     = document.querySelector("#editTicketId");
const editModalTicketId= document.querySelector("#editModalTicketId");
const closeEditModal   = document.querySelector("#closeEditModal");
const cancelEditButton = document.querySelector("#cancelEditButton");
const editName         = document.querySelector("#editName");
const editContact      = document.querySelector("#editContact");
const editArea         = document.querySelector("#editArea");
const editUrgency      = document.querySelector("#editUrgency");
const editStatus       = document.querySelector("#editStatus");
const editModalMessage = document.querySelector("#editModalMessage");
const editContactRow   = document.querySelector("#editContactRow");
const editAreaRow      = document.querySelector("#editAreaRow");

// Bulk bar
const bulkBar         = document.querySelector("#bulkBar");
const bulkCount       = document.querySelector("#bulkCount");
const bulkStatusSelect= document.querySelector("#bulkStatusSelect");
const bulkApplyButton = document.querySelector("#bulkApplyButton");
const bulkCancelButton= document.querySelector("#bulkCancelButton");

// ── State ───────────────────────────────────────────────────────────────────

let currentFilter   = "todos";
let boardView       = "cards";
let cachedTickets   = [];
let appConfig       = null;
let selectedTickets = new Set();

// ── Constants ────────────────────────────────────────────────────────────────

const statuses = [
  { key: "abierto",    label: "Abierto"    },
  { key: "en_proceso", label: "En proceso" },
  { key: "en_espera",  label: "En espera"  },
  { key: "resuelto",   label: "Resuelto"   }
];

const urgencies = [
  { key: "baja",    label: "Baja"    },
  { key: "media",   label: "Media"   },
  { key: "alta",    label: "Alta"    },
  { key: "critica", label: "Crítica" }
];

const SLA_PRESETS = {
  standard: { baja: 24, media: 8,  alta: 4,   critica: 1   },
  relaxed:  { baja: 48, media: 16, alta: 8,   critica: 2   },
  strict:   { baja: 12, media: 4,  alta: 2,   critica: 0.5 }
};

const formatDate = new Intl.DateTimeFormat("es-CO", {
  dateStyle: "medium",
  timeStyle: "short"
});

// ── Utilities ────────────────────────────────────────────────────────────────

async function requestJson(url, options) {
  const response = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...options
  });
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Solicitud no completada.");
  }

  return data;
}

function escapeHtml(value) {
  return String(value || "").replace(/[&<>"']/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
  }[char]));
}

function getLabel(items, key) {
  return items.find(item => item.key === key)?.label || key;
}

// ── Views ────────────────────────────────────────────────────────────────────

function showView(viewName) {
  overviewView.classList.toggle("active",  viewName === "overview");
  createView.classList.toggle("active",    viewName === "create");
  slaView.classList.toggle("active",       viewName === "sla");
  settingsView.classList.toggle("active",  viewName === "settings");

  // Clear bulk selection when leaving list view
  if (viewName !== "overview") {
    selectedTickets.clear();
    updateBulkBar();
  }
}

// ── Config ───────────────────────────────────────────────────────────────────

async function loadConfig() {
  try {
    appConfig = await requestJson("/api/config");
  } catch (_) {
    appConfig = {
      sla: { baja: 24, media: 8, alta: 4, critica: 1 },
      fields: { contact: { enabled: true, label: "Contacto" }, area: { enabled: true, label: "Área" } }
    };
  }
  applyFieldConfig();
  populateSettingsPanel();
}

function applyFieldConfig() {
  if (!appConfig) return;
  const { contact, area } = appConfig.fields;

  // Create form
  createContactRow.hidden = !contact.enabled;
  createContactRow.querySelector("input").required = contact.enabled;
  contactFieldLabel.textContent = contact.label;

  createAreaRow.hidden = !area.enabled;
  createAreaRow.querySelector("input").required = area.enabled;
  areaFieldLabel.textContent = area.label;

  // Edit modal (always show all fields for internal agents)
  editContactRow.hidden = false;
  editAreaRow.hidden    = false;
}

function populateSettingsPanel() {
  if (!appConfig) return;

  document.querySelector("#slaBaja").value    = appConfig.sla.baja;
  document.querySelector("#slaMedia").value   = appConfig.sla.media;
  document.querySelector("#slaAlta").value    = appConfig.sla.alta;
  document.querySelector("#slaCritica").value = appConfig.sla.critica;

  document.querySelector("#fieldContactEnabled").checked = appConfig.fields.contact.enabled;
  document.querySelector("#fieldContactLabel").value     = appConfig.fields.contact.label;
  document.querySelector("#fieldAreaEnabled").checked    = appConfig.fields.area.enabled;
  document.querySelector("#fieldAreaLabel").value        = appConfig.fields.area.label;

  // Portal URL
  const portalUrl = `${window.location.origin}/portal`;
  document.querySelector("#portalUrlDisplay").textContent = portalUrl;
  document.querySelector("#openPortalLink").href = "/portal";
}

// ── Stats & charts ───────────────────────────────────────────────────────────

function complianceColor(pct) {
  if (pct >= 80) return "var(--donut-ok)";
  if (pct >= 50) return "var(--donut-warn)";
  return "var(--donut-danger)";
}

function renderStats(stats) {
  const compliance = stats.slaCompliance || 0;
  const active     = stats.open || 0;
  const breached   = stats.breached || 0;
  const resolved   = stats.byStatus?.resuelto || 0;
  const total      = active + resolved;

  metricSla.textContent      = `${compliance}%`;
  metricBreached.textContent = breached;
  document.querySelector("#statOpen").textContent = active;
  slaDetailCompliance.textContent = `${compliance}%`;

  // Donut 1: SLA compliance (reactive color)
  slaDonut.style.setProperty("--value", compliance);
  slaDonut.style.setProperty("--donut-color", complianceColor(compliance));

  // Donut 2: active vs total ratio
  const activeRatio = total > 0 ? Math.round((active / total) * 100) : 0;
  activeDonut.style.setProperty("--value", activeRatio);

  // Donut 3: breach rate
  const breachRate = active > 0 ? Math.round((breached / active) * 100) : 0;
  breachedDonut.style.setProperty("--value", breachRate);

  // SLA view donut
  slaDetailDonut.style.setProperty("--value", compliance);
  slaDetailDonut.style.setProperty("--donut-color", complianceColor(compliance));

  renderBars(statusBars,    statuses,  stats.byStatus  || {});
  renderBars(slaStatusBars, statuses,  stats.byStatus  || {});
  renderBars(urgencyBars,   urgencies, stats.byUrgency || {});
  renderBars(slaUrgencyBars,urgencies, stats.byUrgency || {});
}

function renderVersion(info) {
  appVersion.textContent = `v${info.version}`;
}

function renderBars(container, items, values) {
  if (!container) return;

  const max = Math.max(...items.map(item => values[item.key] || 0), 1);

  container.innerHTML = items.map(item => {
    const count = values[item.key] || 0;
    const width = Math.max((count / max) * 100, count > 0 ? 12 : 0);
    return `
      <div class="statusBar" data-key="${item.key}">
        <span>${item.label}</span>
        <div><i style="width: ${width}%"></i></div>
        <strong>${count}</strong>
      </div>
    `;
  }).join("");
}

// ── Ticket board ─────────────────────────────────────────────────────────────

function getVisibleTickets() {
  if (currentFilter === "todos") return cachedTickets;
  return cachedTickets.filter(ticket => ticket.status === currentFilter);
}

function renderTickets() {
  const visible    = getVisibleTickets();
  const isCardView = boardView === "cards";
  kanbanBoard.hidden    = !isCardView;
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
  kanbanBoard.innerHTML = statuses.map(status => {
    const cols  = tickets.filter(t => t.status === status.key);
    const cards = cols.map(renderTicketCard).join("");

    return `
      <section class="kanbanColumn" data-status="${status.key}">
        <header>
          <h3>${status.label}</h3>
          <span>${cols.length}</span>
        </header>
        <div class="dropZone" data-status="${status.key}">
          ${cards || '<p class="empty compact">Sin tickets</p>'}
        </div>
      </section>
    `;
  }).join("");
}

function renderTicketCard(ticket) {
  const slaText  = ticket.sla.breached ? "SLA vencido" : `${ticket.sla.remainingHours}h SLA`;
  const createdAt = formatDate.format(new Date(ticket.createdAt));

  return `
    <article class="ticketCard urgency-${escapeHtml(ticket.urgency)}" draggable="true" data-ticket-id="${escapeHtml(ticket.id)}">
      <div class="ticketTitle">
        <span>${escapeHtml(ticket.id)}</span>
        <span class="badge ${escapeHtml(ticket.urgency)}">${escapeHtml(ticket.urgency)}</span>
        <button class="editTicketButton" data-edit-id="${escapeHtml(ticket.id)}" type="button" title="Editar">✎ Editar</button>
      </div>
      <p class="ticketName">${escapeHtml(ticket.name)}</p>
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
            <th>Ticket</th>
            <th>Solicitante</th>
            <th>Contacto</th>
            <th>Área</th>
            <th>Urgencia</th>
            <th>SLA</th>
            <th>Estado</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          ${tickets.map(ticket => {
            const slaText = ticket.sla.breached ? "Vencido" : `${ticket.sla.remainingHours}h`;
            return `
              <tr>
                <td><input type="checkbox" class="bulkCheckbox rowCheckbox" data-ticket-id="${escapeHtml(ticket.id)}" ${selectedTickets.has(ticket.id) ? "checked" : ""}></td>
                <td>${escapeHtml(ticket.id)}</td>
                <td>${escapeHtml(ticket.name)}</td>
                <td>${escapeHtml(ticket.contact)}</td>
                <td>${escapeHtml(ticket.area)}</td>
                <td><span class="badge ${escapeHtml(ticket.urgency)}">${escapeHtml(ticket.urgency)}</span></td>
                <td><span class="sla ${ticket.sla.breached ? "breached" : ""}">${slaText}</span></td>
                <td>${renderStatusSelect(ticket)}</td>
                <td><button class="editTicketButton" data-edit-id="${escapeHtml(ticket.id)}" type="button">✎ Editar</button></td>
              </tr>
            `;
          }).join("")}
        </tbody>
      </table>
    </div>
  `;

  // Sync select-all checkbox state
  const allSelected = tickets.every(t => selectedTickets.has(t.id));
  const selectAll   = document.querySelector("#selectAllCheckbox");
  if (selectAll) {
    selectAll.checked       = allSelected && tickets.length > 0;
    selectAll.indeterminate = !allSelected && selectedTickets.size > 0;
  }
}

function renderStatusSelect(ticket) {
  return `
    <select class="statusSelect" aria-label="Cambiar estado de ${escapeHtml(ticket.id)}" data-ticket-id="${escapeHtml(ticket.id)}">
      ${statuses.map(s => `
        <option value="${s.key}" ${ticket.status === s.key ? "selected" : ""}>${s.label}</option>
      `).join("")}
    </select>
  `;
}

// ── SLA report ────────────────────────────────────────────────────────────────

function renderSlaFilters() {
  const areas       = [...new Set(cachedTickets.map(t => t.area).filter(Boolean))].sort();
  const currentArea = slaAreaFilter.value || "todos";

  slaAreaFilter.innerHTML = `
    <option value="todos">Todas</option>
    ${areas.map(a => `<option value="${escapeHtml(a)}">${escapeHtml(a)}</option>`).join("")}
  `;

  if (areas.includes(currentArea)) slaAreaFilter.value = currentArea;
}

function getFilteredSlaTickets() {
  const from    = slaDateFrom.value    ? new Date(`${slaDateFrom.value}T00:00:00`) : null;
  const to      = slaDateTo.value      ? new Date(`${slaDateTo.value}T23:59:59`)   : null;
  const status  = slaStatusFilter.value;
  const area    = slaAreaFilter.value;
  const urgency = slaUrgencyFilter.value;
  const slaState= slaStateFilter.value;
  const timeLimit = slaTimeFilter.value === "todos" ? null : Number(slaTimeFilter.value);
  const search  = slaSearchFilter.value.trim().toLowerCase();

  return cachedTickets.filter(ticket => {
    const createdAt = new Date(ticket.createdAt);
    const text = `${ticket.id} ${ticket.name} ${ticket.contact} ${ticket.area}`.toLowerCase();

    if (from && createdAt < from) return false;
    if (to   && createdAt > to)   return false;
    if (status   !== "todos" && ticket.status   !== status)   return false;
    if (area     !== "todos" && ticket.area     !== area)     return false;
    if (urgency  !== "todos" && ticket.urgency  !== urgency)  return false;
    if (slaState === "vigente"  &&  ticket.sla.breached) return false;
    if (slaState === "vencido"  && !ticket.sla.breached) return false;
    if (timeLimit !== null && ticket.sla.remainingHours > timeLimit) return false;
    if (search && !text.includes(search)) return false;
    return true;
  });
}

function summarizeTickets(tickets) {
  const activeTickets  = tickets.filter(t => t.status !== "resuelto");
  const breachedTickets= activeTickets.filter(t => t.sla.breached);
  const byStatus   = statuses.reduce((acc, s) => { acc[s.key] = tickets.filter(t => t.status === s.key).length; return acc; }, {});
  const byUrgency  = urgencies.reduce((acc, u) => { acc[u.key] = tickets.filter(t => t.urgency === u.key).length; return acc; }, {});
  const compliance = activeTickets.length === 0 ? 100 : Math.round(((activeTickets.length - breachedTickets.length) / activeTickets.length) * 100);
  const avgRemaining = activeTickets.length === 0 ? 0 : Number((activeTickets.reduce((sum, t) => sum + t.sla.remainingHours, 0) / activeTickets.length).toFixed(1));

  return { byStatus, byUrgency, compliance, avgRemainingHours: avgRemaining, breached: breachedTickets.length };
}

function renderSlaReport() {
  const filtered = getFilteredSlaTickets();
  const summary  = summarizeTickets(filtered);

  slaFilteredCount.textContent    = filtered.length;
  slaDetailCompliance.textContent = `${summary.compliance}%`;
  metricRemaining.textContent     = `${summary.avgRemainingHours}h`;
  slaDetailDonut.style.setProperty("--value", summary.compliance);
  slaDetailDonut.style.setProperty("--donut-color", complianceColor(summary.compliance));
  renderBars(slaStatusBars,  statuses,  summary.byStatus);
  renderBars(slaUrgencyBars, urgencies, summary.byUrgency);
  slaReportMeta.textContent = `Generado ${formatDate.format(new Date())} · ${filtered.length} tickets`;
  renderSlaTicketTable(filtered);
}

function renderSlaTicketTable(tickets) {
  if (tickets.length === 0) {
    slaTicketTable.innerHTML = '<p class="empty">No hay tickets para los filtros seleccionados.</p>';
    return;
  }

  slaTicketTable.innerHTML = `
    <div class="tableWrap">
      <table>
        <thead>
          <tr>
            <th>Ticket</th><th>Fecha</th><th>Solicitante</th><th>Contacto</th>
            <th>Área</th><th>Urgencia</th><th>Estado</th><th>SLA</th>
          </tr>
        </thead>
        <tbody>
          ${tickets.map(ticket => {
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
          }).join("")}
        </tbody>
      </table>
    </div>
  `;
}

// ── Edit modal ────────────────────────────────────────────────────────────────

function openEditModal(ticket) {
  editTicketId.value          = ticket.id;
  editModalTicketId.textContent = ticket.id;
  editName.value              = ticket.name;
  editContact.value           = ticket.contact || "";
  editArea.value              = ticket.area;
  editUrgency.value           = ticket.urgency;
  editStatus.value            = ticket.status;
  editModalMessage.textContent= "";
  editModal.hidden            = false;
  editName.focus();
}

function closeModal() {
  editModal.hidden = true;
  editTicketForm.reset();
  editModalMessage.textContent = "";
}

closeEditModal.addEventListener("click", closeModal);
cancelEditButton.addEventListener("click", closeModal);

editModal.addEventListener("click", e => {
  if (e.target === editModal) closeModal();
});

document.addEventListener("keydown", e => {
  if (e.key === "Escape" && !editModal.hidden) closeModal();
});

editTicketForm.addEventListener("submit", async e => {
  e.preventDefault();
  editModalMessage.textContent = "";

  const id = editTicketId.value;
  const payload = {
    name:    editName.value.trim(),
    contact: editContact.value.trim(),
    area:    editArea.value.trim(),
    urgency: editUrgency.value,
    status:  editStatus.value
  };

  try {
    await requestJson(`/api/tickets/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify(payload)
    });
    closeModal();
    await refresh();
  } catch (error) {
    editModalMessage.textContent = error.message;
  }
});

// Delegate edit button clicks (cards + list rows)
document.addEventListener("click", e => {
  const editBtn = e.target.closest("[data-edit-id]");
  if (!editBtn) return;

  const ticket = cachedTickets.find(t => t.id === editBtn.dataset.editId);
  if (ticket) openEditModal(ticket);
});

// ── Bulk actions ──────────────────────────────────────────────────────────────

function updateBulkBar() {
  const count = selectedTickets.size;
  bulkBar.hidden  = count === 0;
  bulkCount.textContent = `${count} seleccionado${count !== 1 ? "s" : ""}`;
}

document.addEventListener("change", e => {
  const row = e.target.closest(".rowCheckbox");
  if (row) {
    row.checked
      ? selectedTickets.add(row.dataset.ticketId)
      : selectedTickets.delete(row.dataset.ticketId);
    updateBulkBar();

    // Sync select-all state
    const visible  = getVisibleTickets();
    const selectAll= document.querySelector("#selectAllCheckbox");
    if (selectAll) {
      selectAll.checked       = visible.every(t => selectedTickets.has(t.id));
      selectAll.indeterminate = !selectAll.checked && selectedTickets.size > 0;
    }
    return;
  }

  const selectAll = e.target.closest("#selectAllCheckbox");
  if (selectAll) {
    getVisibleTickets().forEach(t =>
      selectAll.checked ? selectedTickets.add(t.id) : selectedTickets.delete(t.id)
    );
    updateBulkBar();
    renderTickets();
  }
});

bulkCancelButton.addEventListener("click", () => {
  selectedTickets.clear();
  updateBulkBar();
  renderTickets();
});

bulkApplyButton.addEventListener("click", async () => {
  if (selectedTickets.size === 0) return;
  const status = bulkStatusSelect.value;

  try {
    await Promise.all([...selectedTickets].map(id =>
      requestJson(`/api/tickets/${encodeURIComponent(id)}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status })
      })
    ));
    selectedTickets.clear();
    updateBulkBar();
    await refresh();
  } catch (error) {
    formMessage.textContent = error.message;
  }
});

// ── Settings ──────────────────────────────────────────────────────────────────

// Tab switching
document.querySelectorAll(".tabButton").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tabButton").forEach(b => {
      b.classList.remove("active");
      b.setAttribute("aria-selected", "false");
    });
    btn.classList.add("active");
    btn.setAttribute("aria-selected", "true");

    document.querySelectorAll(".tabPanel").forEach(p => { p.hidden = true; });
    const panel = document.querySelector(`#${btn.dataset.tab}`);
    if (panel) panel.hidden = false;
  });
});

// SLA presets
document.querySelectorAll(".presetBtn").forEach(btn => {
  btn.addEventListener("click", () => {
    const preset = SLA_PRESETS[btn.dataset.preset];
    if (!preset) return;
    document.querySelector("#slaBaja").value    = preset.baja;
    document.querySelector("#slaMedia").value   = preset.media;
    document.querySelector("#slaAlta").value    = preset.alta;
    document.querySelector("#slaCritica").value = preset.critica;
  });
});

// Copy portal URL
document.querySelector("#copyPortalUrl").addEventListener("click", () => {
  const url = `${window.location.origin}/portal`;
  navigator.clipboard.writeText(url).then(() => {
    const btn = document.querySelector("#copyPortalUrl");
    const orig = btn.textContent;
    btn.textContent = "¡Copiado!";
    setTimeout(() => { btn.textContent = orig; }, 1800);
  });
});

saveSettingsButton.addEventListener("click", async () => {
  const newConfig = {
    sla: {
      baja:    Number(document.querySelector("#slaBaja").value)    || 24,
      media:   Number(document.querySelector("#slaMedia").value)   || 8,
      alta:    Number(document.querySelector("#slaAlta").value)    || 4,
      critica: Number(document.querySelector("#slaCritica").value) || 1
    },
    fields: {
      contact: {
        enabled: document.querySelector("#fieldContactEnabled").checked,
        label:   document.querySelector("#fieldContactLabel").value.trim() || "Contacto"
      },
      area: {
        enabled: document.querySelector("#fieldAreaEnabled").checked,
        label:   document.querySelector("#fieldAreaLabel").value.trim() || "Área"
      }
    }
  };

  try {
    appConfig = await requestJson("/api/config", {
      method: "PUT",
      body: JSON.stringify(newConfig)
    });
    applyFieldConfig();
    await refresh();
    showView("overview");
  } catch (error) {
    document.querySelector("#slaSettingsMessage").textContent = error.message;
  }
});

// ── Kanban drag & drop ────────────────────────────────────────────────────────

kanbanBoard.addEventListener("dragstart", e => {
  if (e.target.closest(".statusSelect")) { e.preventDefault(); return; }
  const card = e.target.closest(".ticketCard");
  if (!card) return;

  e.dataTransfer.setData("text/plain", card.dataset.ticketId);
  e.dataTransfer.effectAllowed = "move";
  card.classList.add("dragging");
});

kanbanBoard.addEventListener("dragend", e => {
  e.target.closest(".ticketCard")?.classList.remove("dragging");
});

kanbanBoard.addEventListener("dragover", e => {
  const zone = e.target.closest(".dropZone");
  if (!zone) return;
  e.preventDefault();
  zone.classList.add("over");
});

kanbanBoard.addEventListener("dragleave", e => {
  const zone = e.target.closest(".dropZone");
  if (zone && !zone.contains(e.relatedTarget)) zone.classList.remove("over");
});

kanbanBoard.addEventListener("drop", async e => {
  const zone = e.target.closest(".dropZone");
  if (!zone) return;
  e.preventDefault();
  zone.classList.remove("over");

  try {
    await moveTicket(e.dataTransfer.getData("text/plain"), zone.dataset.status);
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
  showView("settings");
});

backFromSettings.addEventListener("click", () => showView("overview"));

exportSlaButton.addEventListener("click", () => {
  renderSlaReport();
  document.body.classList.add("printing-sla");
  window.print();
  setTimeout(() => document.body.classList.remove("printing-sla"), 500);
});

statusFilter.addEventListener("change", e => {
  currentFilter = e.target.value;
  // Clear selection when filter changes in list view
  selectedTickets.clear();
  updateBulkBar();
  renderTickets();
});

document.querySelectorAll("[data-board-view]").forEach(button => {
  button.addEventListener("click", () => {
    boardView = button.dataset.boardView;
    document.querySelectorAll("[data-board-view]").forEach(b =>
      b.classList.toggle("active", b === button)
    );
    // Clear bulk selection when switching to card view
    if (boardView === "cards") {
      selectedTickets.clear();
      updateBulkBar();
    }
    renderTickets();
  });
});

[slaDateFrom, slaDateTo, slaStatusFilter, slaAreaFilter,
 slaUrgencyFilter, slaStateFilter, slaTimeFilter, slaSearchFilter].forEach(input => {
  input.addEventListener("input", renderSlaReport);
  input.addEventListener("change", renderSlaReport);
});

// ── Ticket creation form ──────────────────────────────────────────────────────

form.addEventListener("submit", async e => {
  e.preventDefault();
  formMessage.textContent = "";

  const fd = new FormData(form);
  const ticket = {
    name:    fd.get("name"),
    contact: fd.get("contact") || "",
    area:    fd.get("area") || "",
    urgency: fd.get("urgency")
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

// Status select inline change (delegated)
document.addEventListener("change", async e => {
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
  await requestJson(`/api/tickets/${encodeURIComponent(ticketId)}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status })
  });
  await refresh();
}

async function refresh() {
  const [tickets, stats, version] = await Promise.all([
    requestJson("/api/tickets"),
    requestJson("/api/stats"),
    requestJson("/api/version")
  ]);

  cachedTickets = tickets;

  // Remove stale IDs from selection
  const ids = new Set(tickets.map(t => t.id));
  selectedTickets.forEach(id => { if (!ids.has(id)) selectedTickets.delete(id); });
  updateBulkBar();

  renderSlaFilters();
  renderTickets();
  renderStats(stats);
  renderSlaReport();
  renderVersion(version);
}

// ── Boot ──────────────────────────────────────────────────────────────────────

showView("overview");

Promise.all([refresh(), loadConfig()]).catch(error => {
  kanbanBoard.innerHTML = `<p class="empty">${escapeHtml(error.message)}</p>`;
});
