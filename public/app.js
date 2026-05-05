const form = document.querySelector("#ticketForm");
const message = document.querySelector("#formMessage");
const overviewView = document.querySelector("#overviewView");
const createView = document.querySelector("#createView");
const slaView = document.querySelector("#slaView");
const createTicketButton = document.querySelector("#createTicketButton");
const cancelCreateButton = document.querySelector("#cancelCreateButton");
const slaButton = document.querySelector("#slaButton");
const backToOverviewButton = document.querySelector("#backToOverviewButton");
const exportSlaButton = document.querySelector("#exportSlaButton");
const kanbanBoard = document.querySelector("#kanbanBoard");
const ticketListView = document.querySelector("#ticketListView");
const statusFilter = document.querySelector("#statusFilter");
const statOpen = document.querySelector("#statOpen");
const appVersion = document.querySelector("#appVersion");
const metricSla = document.querySelector("#metricSla");
const metricBreached = document.querySelector("#metricBreached");
const metricRemaining = document.querySelector("#metricRemaining");
const slaFilteredCount = document.querySelector("#slaFilteredCount");
const slaDonut = document.querySelector("#slaDonut");
const slaDetailDonut = document.querySelector("#slaDetailDonut");
const slaDetailCompliance = document.querySelector("#slaDetailCompliance");
const statusBars = document.querySelector("#statusBars");
const urgencyBars = document.querySelector("#urgencyBars");
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

let currentFilter = "todos";
let boardView = "cards";
let cachedTickets = [];

const statuses = [
  { key: "abierto", label: "Abierto" },
  { key: "en_proceso", label: "En proceso" },
  { key: "en_espera", label: "En espera" },
  { key: "resuelto", label: "Resuelto" }
];

const urgencies = [
  { key: "baja", label: "Baja" },
  { key: "media", label: "Media" },
  { key: "alta", label: "Alta" },
  { key: "critica", label: "Crítica" }
];

const formatDate = new Intl.DateTimeFormat("es-CO", {
  dateStyle: "medium",
  timeStyle: "short"
});

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

function showView(viewName) {
  overviewView.classList.toggle("active", viewName === "overview");
  createView.classList.toggle("active", viewName === "create");
  slaView.classList.toggle("active", viewName === "sla");
}

function renderStats(stats) {
  const compliance = stats.slaCompliance || 0;
  statOpen.textContent = stats.open;
  metricSla.textContent = `${compliance}%`;
  metricBreached.textContent = stats.breached;
  slaDetailCompliance.textContent = `${compliance}%`;
  slaDonut.style.setProperty("--value", compliance);
  slaDetailDonut.style.setProperty("--value", compliance);
  renderBars(statusBars, statuses, stats.byStatus || {});
  renderBars(slaStatusBars, statuses, stats.byStatus || {});
  renderBars(urgencyBars, urgencies, stats.byUrgency || {});
  renderBars(slaUrgencyBars, urgencies, stats.byUrgency || {});
}

function renderVersion(info) {
  appVersion.textContent = `v${info.version}`;
}

function escapeHtml(value) {
  return String(value || "").replace(/[&<>"']/g, char => {
    const entities = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    };
    return entities[char];
  });
}

function renderBars(container, items, values) {
  if (!container) {
    return;
  }

  const max = Math.max(...items.map(item => values[item.key] || 0), 1);

  container.innerHTML = items
    .map(item => {
      const count = values[item.key] || 0;
      const width = Math.max((count / max) * 100, count > 0 ? 12 : 0);
      return `
        <div class="statusBar">
          <span>${item.label}</span>
          <div><i style="width: ${width}%"></i></div>
          <strong>${count}</strong>
        </div>
      `;
    })
    .join("");
}

function getVisibleTickets() {
  if (currentFilter === "todos") {
    return cachedTickets;
  }

  return cachedTickets.filter(ticket => ticket.status === currentFilter);
}

function renderTickets() {
  const visibleTickets = getVisibleTickets();
  const isCardView = boardView === "cards";
  kanbanBoard.hidden = !isCardView;
  ticketListView.hidden = isCardView;

  if (isCardView) {
    ticketListView.innerHTML = "";
    renderKanban(visibleTickets);
    return;
  }

  kanbanBoard.innerHTML = "";
  renderTicketList(visibleTickets);
}

function renderSlaFilters() {
  const areas = [...new Set(cachedTickets.map(ticket => ticket.area).filter(Boolean))].sort();
  const currentArea = slaAreaFilter.value || "todos";

  slaAreaFilter.innerHTML = `
    <option value="todos">Todas</option>
    ${areas.map(area => `<option value="${escapeHtml(area)}">${escapeHtml(area)}</option>`).join("")}
  `;

  if (areas.includes(currentArea)) {
    slaAreaFilter.value = currentArea;
  }
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

  return cachedTickets.filter(ticket => {
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
  const activeTickets = tickets.filter(ticket => ticket.status !== "resuelto");
  const breachedTickets = activeTickets.filter(ticket => ticket.sla.breached);
  const byStatus = statuses.reduce((summary, status) => {
    summary[status.key] = tickets.filter(ticket => ticket.status === status.key).length;
    return summary;
  }, {});
  const byUrgency = urgencies.reduce((summary, urgency) => {
    summary[urgency.key] = tickets.filter(ticket => ticket.urgency === urgency.key).length;
    return summary;
  }, {});
  const compliance =
    activeTickets.length === 0
      ? 100
      : Math.round(((activeTickets.length - breachedTickets.length) / activeTickets.length) * 100);
  const avgRemainingHours =
    activeTickets.length === 0
      ? 0
      : Number(
          (
            activeTickets.reduce((total, ticket) => total + ticket.sla.remainingHours, 0) /
            activeTickets.length
          ).toFixed(1)
        );

  return { byStatus, byUrgency, compliance, avgRemainingHours, breached: breachedTickets.length };
}

function renderSlaReport() {
  const filteredTickets = getFilteredSlaTickets();
  const summary = summarizeTickets(filteredTickets);

  slaFilteredCount.textContent = filteredTickets.length;
  slaDetailCompliance.textContent = `${summary.compliance}%`;
  metricRemaining.textContent = `${summary.avgRemainingHours}h`;
  slaDetailDonut.style.setProperty("--value", summary.compliance);
  renderBars(slaStatusBars, statuses, summary.byStatus);
  renderBars(slaUrgencyBars, urgencies, summary.byUrgency);
  slaReportMeta.textContent = `Generado ${formatDate.format(new Date())} · ${filteredTickets.length} tickets`;
  renderSlaTicketTable(filteredTickets);
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
            <th>Ticket</th>
            <th>Fecha</th>
            <th>Solicitante</th>
            <th>Contacto</th>
            <th>Área</th>
            <th>Urgencia</th>
            <th>Estado</th>
            <th>SLA</th>
          </tr>
        </thead>
        <tbody>
          ${tickets
            .map(ticket => {
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

function getLabel(items, key) {
  return items.find(item => item.key === key)?.label || key;
}

function renderKanban(tickets) {
  kanbanBoard.innerHTML = statuses
    .map(status => {
      const columnTickets = tickets.filter(ticket => ticket.status === status.key);
      const cards = columnTickets.map(renderTicketCard).join("");

      return `
        <section class="kanbanColumn" data-status="${status.key}">
          <header>
            <h3>${status.label}</h3>
            <span>${columnTickets.length}</span>
          </header>
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
    <article class="ticketCard" draggable="true" data-ticket-id="${escapeHtml(ticket.id)}">
      <div class="ticketTitle">
        <span>${escapeHtml(ticket.id)}</span>
        <span class="badge ${escapeHtml(ticket.urgency)}">${escapeHtml(ticket.urgency)}</span>
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
            <th>Ticket</th>
            <th>Solicitante</th>
            <th>Contacto</th>
            <th>Área</th>
            <th>Urgencia</th>
            <th>SLA</th>
            <th>Estado</th>
          </tr>
        </thead>
        <tbody>
          ${tickets
            .map(ticket => {
              const slaText = ticket.sla.breached ? "Vencido" : `${ticket.sla.remainingHours}h`;
              return `
                <tr>
                  <td>${escapeHtml(ticket.id)}</td>
                  <td>${escapeHtml(ticket.name)}</td>
                  <td>${escapeHtml(ticket.contact)}</td>
                  <td>${escapeHtml(ticket.area)}</td>
                  <td><span class="badge ${escapeHtml(ticket.urgency)}">${escapeHtml(ticket.urgency)}</span></td>
                  <td><span class="sla ${ticket.sla.breached ? "breached" : ""}">${slaText}</span></td>
                  <td>${renderStatusSelect(ticket)}</td>
                </tr>
              `;
            })
            .join("")}
        </tbody>
      </table>
    </div>
  `;
}

function renderStatusSelect(ticket) {
  return `
    <select class="statusSelect" aria-label="Cambiar estado de ${escapeHtml(ticket.id)}" data-ticket-id="${escapeHtml(ticket.id)}">
      ${statuses
        .map(
          status => `
            <option value="${status.key}" ${ticket.status === status.key ? "selected" : ""}>
              ${status.label}
            </option>
          `
        )
        .join("")}
    </select>
  `;
}

async function refresh() {
  const [tickets, stats, version] = await Promise.all([
    requestJson("/api/tickets"),
    requestJson("/api/stats"),
    requestJson("/api/version")
  ]);

  cachedTickets = tickets;
  renderSlaFilters();
  renderTickets();
  renderStats(stats);
  renderSlaReport();
  renderVersion(version);
}

createTicketButton.addEventListener("click", () => {
  message.textContent = "";
  showView("create");
});

cancelCreateButton.addEventListener("click", () => {
  form.reset();
  form.urgency.value = "media";
  message.textContent = "";
  showView("overview");
});

slaButton.addEventListener("click", () => {
  renderSlaReport();
  showView("sla");
});

backToOverviewButton.addEventListener("click", () => {
  showView("overview");
});

exportSlaButton.addEventListener("click", () => {
  renderSlaReport();
  document.body.classList.add("printing-sla");
  window.print();
  setTimeout(() => document.body.classList.remove("printing-sla"), 500);
});

statusFilter.addEventListener("change", event => {
  currentFilter = event.target.value;
  renderTickets();
});

[
  slaDateFrom,
  slaDateTo,
  slaStatusFilter,
  slaAreaFilter,
  slaUrgencyFilter,
  slaStateFilter,
  slaTimeFilter,
  slaSearchFilter
].forEach(input => {
  input.addEventListener("input", renderSlaReport);
  input.addEventListener("change", renderSlaReport);
});

document.querySelectorAll("[data-board-view]").forEach(button => {
  button.addEventListener("click", () => {
    boardView = button.dataset.boardView;
    document.querySelectorAll("[data-board-view]").forEach(item => {
      item.classList.toggle("active", item === button);
    });
    renderTickets();
  });
});

form.addEventListener("submit", async event => {
  event.preventDefault();
  message.textContent = "";

  const formData = new FormData(form);
  const ticket = {
    name: formData.get("name"),
    contact: formData.get("contact"),
    area: formData.get("area"),
    urgency: formData.get("urgency")
  };

  try {
    await requestJson("/api/tickets", {
      method: "POST",
      body: JSON.stringify(ticket)
    });
    form.reset();
    form.urgency.value = "media";
    message.textContent = "Ticket creado.";
    showView("overview");
    await refresh();
  } catch (error) {
    message.textContent = error.message;
  }
});

document.addEventListener("change", async event => {
  const select = event.target.closest(".statusSelect");

  if (!select) {
    return;
  }

  try {
    await moveTicket(select.dataset.ticketId, select.value);
  } catch (error) {
    message.textContent = error.message;
    await refresh();
  }
});

kanbanBoard.addEventListener("dragstart", event => {
  if (event.target.closest(".statusSelect")) {
    event.preventDefault();
    return;
  }

  const card = event.target.closest(".ticketCard");

  if (!card) {
    return;
  }

  event.dataTransfer.setData("text/plain", card.dataset.ticketId);
  event.dataTransfer.effectAllowed = "move";
  card.classList.add("dragging");
});

kanbanBoard.addEventListener("dragend", event => {
  const card = event.target.closest(".ticketCard");

  if (card) {
    card.classList.remove("dragging");
  }
});

kanbanBoard.addEventListener("dragover", event => {
  const dropZone = event.target.closest(".dropZone");

  if (!dropZone) {
    return;
  }

  event.preventDefault();
  dropZone.classList.add("over");
});

kanbanBoard.addEventListener("dragleave", event => {
  const dropZone = event.target.closest(".dropZone");

  if (dropZone && !dropZone.contains(event.relatedTarget)) {
    dropZone.classList.remove("over");
  }
});

kanbanBoard.addEventListener("drop", async event => {
  const dropZone = event.target.closest(".dropZone");

  if (!dropZone) {
    return;
  }

  event.preventDefault();
  dropZone.classList.remove("over");

  try {
    await moveTicket(event.dataTransfer.getData("text/plain"), dropZone.dataset.status);
  } catch (error) {
    message.textContent = error.message;
  }
});

async function moveTicket(ticketId, status) {
  await requestJson(`/api/tickets/${encodeURIComponent(ticketId)}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status })
  });
  await refresh();
}

showView("overview");
refresh().catch(error => {
  kanbanBoard.innerHTML = `<p class="empty">${error.message}</p>`;
});
