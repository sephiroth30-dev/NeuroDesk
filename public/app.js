const form = document.querySelector("#ticketForm");
const message = document.querySelector("#formMessage");
const ticketList = document.querySelector("#ticketList");
const statTotal = document.querySelector("#statTotal");
const statOpen = document.querySelector("#statOpen");
const statSla = document.querySelector("#statSla");
const appVersion = document.querySelector("#appVersion");

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
}

function renderVersion(info) {
  appVersion.textContent = `v${info.version}`;
}

function renderTickets(tickets) {
  if (tickets.length === 0) {
    ticketList.innerHTML = '<p class="empty">Aún no hay tickets.</p>';
    return;
  }

  ticketList.innerHTML = tickets
    .map(ticket => {
      const slaText = ticket.sla.breached ? "SLA vencido" : `${ticket.sla.remainingHours}h SLA`;
      const createdAt = formatDate.format(new Date(ticket.createdAt));

      return `
        <article class="ticket">
          <div>
            <div class="ticketTitle">
              <span>${ticket.id}</span>
              <span class="badge ${ticket.urgency}">${ticket.urgency}</span>
            </div>
            <p class="ticketMeta">${ticket.name} · ${ticket.area} · ${ticket.source} · ${createdAt}</p>
          </div>
          <span class="sla ${ticket.sla.breached ? "breached" : ""}">${slaText}</span>
        </article>
      `;
    })
    .join("");
}

async function refresh() {
  const [tickets, stats, version] = await Promise.all([
    requestJson("/api/tickets"),
    requestJson("/api/stats"),
    requestJson("/api/version")
  ]);

  renderTickets(tickets);
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

refresh().catch(error => {
  ticketList.innerHTML = `<p class="empty">${error.message}</p>`;
});
