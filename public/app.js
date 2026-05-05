const form = document.querySelector("#ticketForm");
const message = document.querySelector("#formMessage");
const overviewView = document.querySelector("#overviewView");
const createView = document.querySelector("#createView");
const slaView = document.querySelector("#slaView");
const createTicketButton = document.querySelector("#createTicketButton");
const cancelCreateButton = document.querySelector("#cancelCreateButton");
const slaButton = document.querySelector("#slaButton");
const backToOverviewButton = document.querySelector("#backToOverviewButton");
const kanbanBoard = document.querySelector("#kanbanBoard");
const ticketListView = document.querySelector("#ticketListView");
const statusFilter = document.querySelector("#statusFilter");
const statOpen = document.querySelector("#statOpen");
const appVersion = document.querySelector("#appVersion");
const metricSla = document.querySelector("#metricSla");
const metricBreached = document.querySelector("#metricBreached");
const metricRemaining = document.querySelector("#metricRemaining");
const slaDonut = document.querySelector("#slaDonut");
const slaDetailDonut = document.querySelector("#slaDetailDonut");
const slaDetailCompliance = document.querySelector("#slaDetailCompliance");
const statusBars = document.querySelector("#statusBars");
const urgencyBars = document.querySelector("#urgencyBars");
const slaStatusBars = document.querySelector("#slaStatusBars");
const slaUrgencyBars = document.querySelector("#slaUrgencyBars");

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
  metricRemaining.textContent = `${stats.avgRemainingHours || 0}h`;
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
  kanbanBoard.hidden = boardView !== "cards";
  ticketListView.hidden = boardView !== "list";

  if (boardView === "cards") {
    renderKanban(visibleTickets);
    return;
  }

  renderTicketList(visibleTickets);
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
  renderTickets();
  renderStats(stats);
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
  showView("sla");
});

backToOverviewButton.addEventListener("click", () => {
  showView("overview");
});

statusFilter.addEventListener("change", event => {
  currentFilter = event.target.value;
  renderTickets();
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
