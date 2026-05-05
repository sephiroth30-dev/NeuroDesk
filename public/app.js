const form = document.querySelector("#ticketForm");
const message = document.querySelector("#formMessage");
const kanbanBoard = document.querySelector("#kanbanBoard");
const statusFilters = document.querySelector("#statusFilters");
const statTotal = document.querySelector("#statTotal");
const statOpen = document.querySelector("#statOpen");
const statSla = document.querySelector("#statSla");
const appVersion = document.querySelector("#appVersion");
const metricSla = document.querySelector("#metricSla");
const metricBreached = document.querySelector("#metricBreached");
const statusBars = document.querySelector("#statusBars");

let currentFilter = "todos";
let cachedTickets = [];

const statuses = [
  { key: "abierto", label: "Abierto" },
  { key: "en_proceso", label: "En proceso" },
  { key: "en_espera", label: "En espera" },
  { key: "resuelto", label: "Resuelto" }
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

function renderStats(stats) {
  statTotal.textContent = stats.total;
  statOpen.textContent = stats.open;
  statSla.textContent = `${stats.slaCompliance}%`;
  metricSla.textContent = `${stats.slaCompliance}%`;
  metricBreached.textContent = stats.breached;
  renderStatusBars(stats.byStatus || {});
}

function renderVersion(info) {
  appVersion.textContent = `v${info.version}`;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, char => {
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

function renderStatusBars(byStatus) {
  const max = Math.max(...statuses.map(status => byStatus[status.key] || 0), 1);

  statusBars.innerHTML = statuses
    .map(status => {
      const count = byStatus[status.key] || 0;
      const width = Math.max((count / max) * 100, count > 0 ? 12 : 0);
      return `
        <div class="statusBar">
          <span>${status.label}</span>
          <div><i style="width: ${width}%"></i></div>
          <strong>${count}</strong>
        </div>
      `;
    })
    .join("");
}

function renderFilters() {
  const filters = [{ key: "todos", label: "Todos" }, ...statuses];

  statusFilters.innerHTML = filters
    .map(
      filter => `
        <button class="filter ${currentFilter === filter.key ? "active" : ""}" type="button" data-filter="${filter.key}">
          ${filter.label}
        </button>
      `
    )
    .join("");
}

function getVisibleTickets() {
  if (currentFilter === "todos") {
    return cachedTickets;
  }

  return cachedTickets.filter(ticket => ticket.status === currentFilter);
}

function renderKanban(tickets) {
  const visibleTickets = getVisibleTickets();

  kanbanBoard.innerHTML = statuses
    .map(status => {
      const columnTickets = visibleTickets.filter(ticket => ticket.status === status.key);
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
      <p class="ticketMeta">${escapeHtml(ticket.area)} · ${escapeHtml(ticket.source)} · ${createdAt}</p>
      <div class="cardFooter">
        <span class="sla ${ticket.sla.breached ? "breached" : ""}">${slaText}</span>
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
      </div>
    </article>
  `;
}

async function refresh() {
  const [tickets, stats, version] = await Promise.all([
    requestJson("/api/tickets"),
    requestJson("/api/stats"),
    requestJson("/api/version")
  ]);

  cachedTickets = tickets;
  renderFilters();
  renderKanban(tickets);
  renderStats(stats);
  renderVersion(version);
}

form.addEventListener("submit", async event => {
  event.preventDefault();
  message.textContent = "";

  const formData = new FormData(form);
  const ticket = {
    name: formData.get("name"),
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
    await refresh();
  } catch (error) {
    message.textContent = error.message;
  }
});

statusFilters.addEventListener("click", event => {
  const filterButton = event.target.closest("[data-filter]");

  if (!filterButton) {
    return;
  }

  currentFilter = filterButton.dataset.filter;
  renderFilters();
  renderKanban(cachedTickets);
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

kanbanBoard.addEventListener("change", async event => {
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

  const ticketId = event.dataTransfer.getData("text/plain");
  const status = dropZone.dataset.status;

  try {
    await moveTicket(ticketId, status);
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

refresh().catch(error => {
  kanbanBoard.innerHTML = `<p class="empty">${error.message}</p>`;
});
