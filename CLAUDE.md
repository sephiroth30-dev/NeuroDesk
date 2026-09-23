# NeuroDesk — Reglas de Producción

**Versión actual en producción: v14.45**

## ⚠️ ESTE PROYECTO ESTÁ EN PRODUCCIÓN

Desplegado en **soporte.easystem.co** con datos reales. Cualquier cambio debe ser **no destructivo**.

---

## Almacenamiento de datos — NUNCA tocar `.neurodesk/data.json`

**Verificado en el servidor (2026-07-06):** el store real vive en
`/home/u532609482/domains/soporte.easystem.co/.neurodesk/data.json`
(`~/.neurodesk/data.json`, donde `~` es el `HOME` del proceso lsnode = raíz del dominio).
Esta ruta **ya está fuera de `nodejs/`** (el repo git), así que no requiere ninguna
migración adicional: `git pull`, `git clean -fd` o un re-clone de `nodejs/` nunca la tocan.

`STORE_PATH` en `server.js` es `process.env.ND_STORE_PATH || path.join(os.homedir(), ".neurodesk", "data.json")`.
`ND_STORE_PATH` **no está seteado** en el proceso actual — corre con el default de arriba, que ya es seguro.

Este archivo contiene:

- Todos los tickets abiertos y cerrados
- Configuración de correo entrante (SMTP/IMAP + App Password de Gmail)
- Configuración de notificaciones
- Configuración de SLA y campos
- Usuarios y sesiones

**Reglas absolutas:**

- **NO** borrar, sobreescribir ni reinicializar `.neurodesk/data.json`
- **NO** commitear ese archivo (no vive dentro del repo, pero por si se cambia `ND_STORE_PATH` a una ruta interna)
- **NO** hacer `rm -rf` sobre `.neurodesk/` en el servidor de producción
- **NO** setear `ND_STORE_PATH` a una ruta dentro de `nodejs/` — eso reintroduciría el riesgo de pérdida por deploy

Si el servidor arranca sin `.neurodesk/data.json`, arranca **con cero datos** — todos los tickets y configuración se pierden.

---

## Configuración guardada — NO sobrescribir con defaults

Las siguientes claves en `store.config` contienen datos ingresados manualmente por el usuario:

- `email_config` — host IMAP, App Password de Gmail, carpeta, intervalo de polling
- `notifications_config` — SMTP de salida, emails de admin, plantillas de notificación
- `app_config` — SLA por urgencia, campos habilitados, campos personalizados

**Regla:** en `loadStore()`, los defaults solo se aplican si la clave no existe. Si se agregan nuevas claves a los defaults, usar `Object.assign({}, DEFAULT, existingConfig)` (existing tiene precedencia), nunca reemplazar el objeto completo.

---

## Archivos protegidos — no modificar sin pedido explícito

| Archivo/Carpeta                                              | Razón                                                     |
| ------------------------------------------------------------ | --------------------------------------------------------- |
| `../.neurodesk/data.json` (fuera de `nodejs/`, ver arriba)   | Base de datos de producción (tickets + config + usuarios) |
| `.env` (si existe)                                            | Variables de entorno con credenciales                     |

---

## Estrategia de cambios seguros

1. **Cambios en `server.js`**: modificar lógica, rutas y endpoints
2. **Cambios de UI**: modificar `public/app.js`, `public/styles.css`, `public/index.html` libremente
3. **Nuevos campos en el store**: agregar con `?? defaultValue` — nunca reemplazar la estructura raíz
4. **Nuevas claves de config**: usar `deepMerge(DEFAULT, existing)` para que existing siempre gane
5. **Seeds / datos de prueba**: nunca en producción; detrás de `NODE_ENV=development`

---

## Deploy seguro en soporte.easystem.co

### ⚠️ Este servidor NO usa pm2 — lo administra LiteSpeed (lsnode)

`ecosystem.config.js` existe en el repo pero **no se ejecuta**: `pm2` no está instalado
en el servidor (ni global ni local — verificado con `which pm2` y `npm list -g`, 2026-07-06).
El proceso real que sirve `soporte.easystem.co` corre como `lsnode` (el manejador de apps
Node.js de LiteSpeed/hPanel), lanzado automáticamente al recibir tráfico.

**Consecuencia práctica:** cualquier comando `pm2 ...` (`pm2 restart`, `pm2 logs`,
`pm2 start ecosystem.config.js`) va a fallar con `command not found`. Si en algún momento
se instala pm2 de verdad y se migra a él, actualizar esta sección — mientras tanto, usar
el flujo de abajo.

### Flujo de deploy correcto (código)

```bash
cd /home/u532609482/domains/soporte.easystem.co/nodejs
git pull origin main         # trae el código nuevo
npm install --omit=dev       # solo si package.json cambió
```

### Cómo reiniciar la app (sin pm2)

LiteSpeed relanza el proceso Node automáticamente en la siguiente petición HTTP en
cuanto el proceso actual muere. Para forzar el reinicio tras un deploy:

```bash
pkill -f 'lsnode:/home/u532609482/domains/soporte.easystem.co/nodejs'
sleep 2
pgrep -f 'lsnode:/home/u532609482/domains/soporte.easystem.co/nodejs' && \
  echo "⚠️ Sigue vivo un proceso viejo — investigar antes de continuar (ver incidente 2026-09-10 abajo)" || \
  echo "✅ Ningún proceso viejo remanente"
# curl https://soporte.easystem.co para confirmar que respondió tras el respawn
```

No hace falta `sudo`, ni tocar hPanel — el pkill del propio usuario basta porque los
procesos `lsnode` corren con ese mismo usuario. **Desde v14.42 el propio proceso se
apaga solo en ~2-3s al recibir la señal de `pkill`** (antes podía tardar hasta 3 min
en morir a mitad de un poll IMAP) — el `pgrep` de verificación de arriba debería salir
siempre limpio, pero queda como chequeo explícito en vez de asumido.

### Verificar dónde están los datos tras un restart

```bash
curl -s https://soporte.easystem.co/api/health   # o el endpoint que exponga STORE_PATH
# debe apuntar a .../soporte.easystem.co/.neurodesk/data.json (fuera de nodejs/)
```

```bash
git pull origin main
npm install --omit=dev      # solo si package.json cambió
pkill -f 'lsnode:/home/u532609482/domains/soporte.easystem.co/nodejs'
# NUNCA: rm -rf .neurodesk/ | git clean -fd | npm run reset
```

---

## API pública v1 (desde v14.34)

Documentación completa en **`API.md`**.

- Superficie: `/api/v1/*`, autenticada con `Authorization: Bearer nd_live_…`
- Los tokens se guardan **hasheados** (SHA-256) en `store.apiKeys`; el token en claro
  se devuelve una única vez al crearlo y nunca se persiste
- Scopes: `tickets:read`, `tickets:write`, `stats:read`
- Límite: 120 req/min por llave
- Gestión desde el panel: **Configuración → 🔌 API**
- Webhooks firmados con HMAC-SHA256 en `store.webhooks` (secreto mostrado una sola vez)
- Spec OpenAPI 3.1 pública en `/api/v1/openapi.json`

**Reglas al tocar esta superficie:**

- `/api/v1/*` se resuelve **antes** del guard de sesión en `createServer` — usa Bearer,
  no cookies. No moverlo después del guard.
- El panel web sigue usando las rutas viejas con cookie de sesión. Son superficies
  paralelas: no unificar sin migrar el frontend.
- `GET /api/config` **NO es público** y **nunca** debe devolver `aiConfig.apiKey`.
  El formulario público usa `GET /api/portal/config`, que solo expone etiquetas de campos.
- `sendStatic()` debe seguir descartando el query string, o los cache-busters
  (`/app.js?v=…`) rompen el frontend cuando no hay proxy delante.

---

## Rendimiento — trampas conocidas (desde v14.35)

Cerrar un ticket llegó a tardar 30-40 s. Causa: `calcBusinessMs()` recorre un día
por cada día de antigüedad del ticket, y llamaba `toLocaleDateString` con `timeZone`
en cada iteración. Ese patrón cuesta **~106 µs por llamada** (medido); con 800 tickets
de 180 días y 4-6 refrescos por cierre son ~400.000 llamadas.

**Reglas para no reintroducirlo:**

- **Nunca** construir `Intl.DateTimeFormat` ni llamar `toLocaleDateString`/`toLocaleString`
  dentro de un bucle. Usar `getTzFormatter(tz)` (cacheado) o `getTzOffsetMs(tz, ms)` y
  aritmética con `getUTCDay()`.
- El SLA de tickets `resuelto`/`cerrado` es inmutable → lo sirve `finishedSlaCache`.
  Si se agrega un campo que altere el cálculo, incluirlo en `finishedSlaCacheKey()`.
- El historial se lee por índice (`getHistoryIndex()`). Cualquier código que mute
  `store.ticketHistory` **debe** llamar `invalidateHistoryIndex()`.
- Para leer un solo ticket usar `getTicketById(id)`, no `getTickets().find(...)`.
- Operaciones con varias escrituras: envolver en `withBatchedSave(() => ...)` para
  que `saveStore()` se vuelque una sola vez. El flush está garantizado incluso si lanza.
- En el frontend, un cambio de estado debe ser **1 PATCH + 1 refresh**. Los eventos SSE
  pasan por `scheduleRefreshFromEvent()` (debounce 250 ms); no añadir listeners que
  hagan su propio `GET /api/tickets`.

Referencia medida (800 tickets, 180 días): `GET /api/tickets` 3.1 s → 16 ms,
`GET /api/stats` 2.6 s → 8 ms, cierre completo en navegador 30 s+ → 1.4 s.

---

## Seguridad — reglas que no se pueden relajar (desde v14.36)

Auditoría completa en v14.36. Lo corregido y lo que **no** debe reintroducirse:

### Contenido no confiable

Los tickets nacen de **correos entrantes**: asunto, cuerpo, nombre del remitente y
adjuntos los controla cualquiera que sepa la dirección de soporte.

- **Todo** dato de ticket que se pinte con `innerHTML` pasa por `escapeHtml()`. Aplica
  a `public/app.js` **y a `public/portal.html`**, que tiene su propia copia de la función.
  El portal llegó a producción sin ella: era XSS almacenado, disparable enviando un correo.
- El `htmlBody` del correo se muestra en un iframe cuyo `sandbox` **nunca** puede incluir
  `allow-scripts`. Junto con el `allow-same-origin` que necesita para medirse, esa pareja
  daría a cualquier remitente acceso al DOM y la sesión del panel.
- Las imágenes remotas del correo empiezan bloqueadas (CSP dentro del iframe). Evita que
  un `<img src="https://rastreador/?id=X">` avise al atacante cuando el agente abre el
  ticket.
- El CSV de exportación antepone `'` a las celdas que empiecen por `= + - @`, o Excel
  ejecuta la fórmula al abrir el fichero.

### Autenticación

- `hashPassword()` usa **scrypt** con prefijo de algoritmo. Los hashes SHA-256 antiguos
  siguen validando y se migran solos en el siguiente inicio de sesión — no borrar ese
  camino hasta que no queden hashes sin prefijo.
- Mínimo **12 caracteres** (`passwordPolicyError`).
- `seedAdminUser()` **no** tiene contraseña por defecto: si no hay `ND_PASS`, genera una
  al azar y la imprime una vez. Nunca volver a poner una constante ahí.
- Restablecer la contraseña de otro usuario exige confirmar la propia; cambiarla revoca
  las demás sesiones de esa cuenta (`revokeUserSessions`).
- `getClientIp()` usa el socket, **no** `X-Forwarded-For`, salvo que se active
  `ND_TRUST_PROXY=1`. Confiar en la cabecera dejaba el límite de login en decorativo.

### Superficie pública

- El anti-spam del formulario **no** cuenta por IP (una oficina comparte una sola). Filtra
  bots: campo trampa `website`, token de formulario firmado con tiempo mínimo, y tope por
  remitente. El descarte silencioso responde 201 a propósito.
- `POST /api/email/inbound` exige `ND_INBOUND_SECRET` o sesión. Abierto permitía crear
  tickets suplantando a cualquier cliente.
- Los enlaces que se envían por correo se construyen con `getAppBaseUrl()` a partir de
  `app_url`, **nunca** con `req.headers.host` (envenenable).
- Las URLs de webhook se validan contra rangos internos en el registro **y** en cada
  entrega (`validateWebhookUrl`).

### Transporte

- `applySecurityHeaders()` va en la primera línea del handler: CSP, `X-Frame-Options`,
  `nosniff`, `Referrer-Policy`, `Permissions-Policy` y HSTS cuando la petición es HTTPS.
- La cookie de sesión lleva `Secure` cuando el navegador habló HTTPS.
- SMTP/IMAP validan certificado. `rejectUnauthorized: false` exponía el App Password de
  Gmail ante un intermediario.

---

## Correo entrante — deduplicación y matching de hilos (desde v14.37)

Dos bugs de producción corregidos aquí: tickets duplicados (correos sin `Message-ID`
recreaban un ticket en cada sondeo) y falsa alerta "cliente insatisfecho" (responder
dentro del mismo hilo de Gmail para pedir algo distinto reabría un ticket viejo).

**Reglas para no reintroducirlos:**

- La clave de deduplicación (`computeEmailKey`) **nunca** debe depender de `Date.now()`
  ni de ningún reloj. Prefiere el `Message-ID` normalizado; si falta, usa el hash de
  contenido. Cambiar el formato de clave sin más recrearía en masa el historial — por
  eso `findProcessedEmailEntry()` es tolerante al formato viejo (Message-ID crudo, sin
  prefijo) y esa tolerancia debe existir **antes** de escribir cualquier formato nuevo.
- **Reservar antes de crear**: `claimEmail()` persiste la reserva antes de `insertTicket()`.
  Ningún camino de salida del bucle puede saltarse `finalizeEmail()` — si `normalizeTicket()`
  devuelve `null`, el correo va a `store.emailQuarantine`, nunca se reprocesa ni se pierde.
- El matching de hilos (`matchEmailThread` + `classifyThreadAction`) compara Message-IDs
  por **igualdad exacta** (`extractMessageIds` + `Set.has`), nunca por `includes()` de
  subcadena — el header `References` es acumulativo y una subcadena compartida
  (`@mail.gmail.com`) produce falsos positivos. Siempre exige que el remitente coincida
  con `contact` del ticket, y ante varias coincidencias gana el ticket más reciente por
  `createdAt`, nunca el primero del array.
- La alerta roja de "cliente insatisfecho" (`reopenedByClient`) sólo se activa en la fila
  `direct-resolution` + `resuelto` + dentro de `REOPEN_ALERT_WINDOW_MS` de la tabla de
  decisión. Un ticket sólo puede llegar a esa fila si tiene un `resolutionMessageIds`
  propio — los tickets creados antes de v14.37 no lo tienen, así que nunca disparan la
  alerta automáticamente (comportamiento conservador por diseño, no un bug).
- `resolutionMessageIds` sólo se marca desde `sendTicketNotification` cuando `type` es
  `"resolved"` (o `"status_changed"` con `ticket.status === "resuelto"`). Una respuesta
  manual del agente (`/api/tickets/:id/reply`, `/api/v1/.../reply`) registra el hilo con
  `rememberThreadId()` pero **sin** `isResolution: true` — no es la notificación
  automática, así que no debe habilitar la alerta por sí sola.
- Ninguna fila de la tabla de decisión pierde la petición del cliente: cuando se crea un
  ticket nuevo por ambigüedad (`cross-reference-new`), se deja una nota cruzada en ambos
  tickets. El código viejo hacía `continue` tras un match y descartaba la solicitud nueva.

---

## Errores de conexión IMAP — mostrar la traducción, no el texto crudo (desde v14.38)

Incidente real: desde el 27 de agosto el sondeo llevaba **308 fallos consecutivos**
mostrando literalmente `"Command failed"` en el panel de Configuración → Correo entrante,
sin ninguna pista de qué hacer. La causa casi segura: la Contraseña de Aplicación de Gmail
venció o se rotó sin actualizarla aquí. El código **ya sabía** traducir ese mensaje —
`testEmailConnection()` (usado por "Probar conexión") lo hacía desde hace tiempo — pero
el sondeo automático nunca aplicaba esa traducción, así que el usuario vio el texto en
crudo durante días.

**Reglas para no reintroducirlo:**

- Cualquier `err.message` de IMAP que se vaya a mostrar al usuario (panel de estado,
  notificación, log visible) **debe** pasar por `emailErrorHint(msg, cfg)` antes de
  guardarse en `emailPollStatus.lastError`. El `console.error` interno sí puede seguir
  logueando el mensaje crudo — eso es para depurar, no para el usuario.
- Si se agrega un nuevo patrón de error reconocible (por ejemplo un código IMAP
  específico), añadirlo a `emailErrorHint()`, nunca duplicar la lógica de traducción en
  otro sitio — hubo exactamente ese bug (dos copias, una desactualizada).
- La construcción de `new ImapFlow(...)` en `pollEmails()` está envuelta en su propio
  try/catch que libera `emailPollStatus.polling` y limpia el timeout — antes de v14.38
  no lo estaba, y aunque no fue la causa de este incidente, una excepción síncrona ahí
  habría dejado `polling` atascado en `true` para siempre (todo sondeo futuro,
  incluido "Sondear ahora", se habría descartado en silencio con "Ya hay un sondeo en
  curso", sin loguear nada).
- Los correos que llegan mientras el sondeo falla **no se pierden**: nunca se marcan
  `\Seen` ni se reservan en `processedEmails`, así que en cuanto la conexión se
  restablece se procesan todos de golpe en el siguiente sondeo exitoso.

---

## Responsive / móvil (desde v14.39)

Auditoría de UX móvil: la app ya tenía una base responsive madura (viewport meta,
sidebar off-canvas, 5+ breakpoints, tabla/kanban con scroll contenido, portal público
con layout móvil dedicado). El único gap funcional real: **el tablero kanban usa
`draggable`/`dragstart`/`dragover`/`drop`, que no funcionan con touch** — en un
teléfono era imposible cambiar el estado de un ticket desde el tablero.

**Solución (no se tocó el drag-and-drop de escritorio):**

- Cada tarjeta del kanban (`renderTicketCard` en `public/app.js`) ahora incluye
  también el mismo `<select class="statusSelect">` que ya usaba la vista de lista
  (`renderStatusSelect()`), envuelto en `.cardStatusSelect`. Reutiliza el listener
  `change` ya existente (`document.addEventListener("change", ...)` → `moveTicket()`),
  el mismo que llama a `PATCH /api/tickets/:id/status`. Cero endpoints nuevos.
- En escritorio `.cardStatusSelect { display: none; }` — el select solo se muestra
  dentro del `@media (max-width: 768px)` ya existente en `styles.css`, así que el
  tablero de escritorio queda visualmente idéntico.
- `kanbanBoard`'s `dragstart` listener ya excluía `.statusSelect` de iniciar un drag
  (`e.target.closest(".statusSelect, .bulkCheckbox")`), así que no hubo que tocar la
  lógica de drag-and-drop para evitar conflictos.

**Reglas para no reintroducir el problema:**

- Cualquier acción que solo pueda dispararse con drag-and-drop (mouse) necesita una
  alternativa táctil visible en el breakpoint móvil — no asumir que un dispositivo
  táctil puede arrastrar.
- Ya existe una sección extensa `/* ── Responsive overhaul ── */` en `styles.css`
  (busca ese comentario) con más de un `@media (max-width: 768px)` — antes de agregar
  reglas de tamaño de objetivos táctiles (botones, inputs) revisar esa sección primero
  para no duplicar `min-height`/tamaños ya definidos ahí.
- Al añadir un control nuevo a las tarjetas del kanban, respetar el patrón `.ticketCard
  .cardFooter .statusSelect { display: none; }` (oculta un select si queda dentro de
  `.cardFooter`) — el select táctil se colocó **fuera** de `.cardFooter`, en su propio
  `.cardStatusSelect`, precisamente para no chocar con esa regla.

## API v1 enriquecida para agentes (desde v14.40)

El usuario quiere poder "hablarle" a NeuroDesk desde un agente de IA (vía token
Bearer): preguntar por sus tickets, recibir sugerencias, y — solo con su confirmación
explícita en la conversación, nunca de forma autónoma — responder a un cliente o
cambiar el estado de un ticket. La superficie `/api/v1/*` (desde v14.34) ya cubría
la mayor parte; v14.40 cierra 4 gaps concretos, documentados en `API.md`.

**Reglas para no reintroducir los gaps:**

- **`history[].origin`**: toda entrada nueva de `store.ticketHistory` debe indicar
  quién la generó — `"client_email" | "agent_note" | "agent_reply" | "system"` — para
  que un agente pueda distinguir el correo real del cliente de una nota interna o de
  una respuesta ya enviada. Se pasa como 4º argumento a `addTicketHistory(ticketId,
  note, status, origin)`, o como campo `origin` en los `push` directos a
  `store.ticketHistory` (notas rápidas). **Nunca reescribir historial existente** sin
  este campo — `serializeTicket()` sirve `origin: "unknown"` para entradas viejas en
  vez de adivinar, y así debe seguir.
- **`serializeTicket()`** expone `aiSentimentScore` (ya vive en el ticket crudo) y
  `attachments` como metadata (`filename, size, uploadedAt` — nunca el nombre interno
  del archivo en disco, que es el que usan las rutas de descarga). Cualquier campo
  nuevo que se quiera exponer a un agente pasa por aquí, no por otra serialización ad
  hoc.
- **`POST /api/v1/tickets/{id}/reply/preview`**: compone el correo (to/subject/text/html)
  tal como se enviaría, **sin** llamar a `sendEmail()` ni tocar `ticketHistory`. Es el
  mecanismo para que un agente muestre "esto es lo que voy a enviar, ¿confirmas?" antes
  de llamar al `POST .../reply` real — el flujo de confirmación vive en la conversación
  con el agente, no como un modo especial de la API.
- **`openapi.json` (`buildOpenApiSpec()`) debe reflejar exactamente lo que el handler
  acepta** — v14.40 corrigió un desalineamiento real (el `PATCH` documentado omitía
  `description`, `subject`, `resolutionNote`, `customFields`, `silent` que el código sí
  aceptaba). Al añadir o cambiar un campo de un endpoint v1, actualizar el spec en el
  mismo cambio, no después.

## Aviso a Telegram en creación de ticket (desde v14.41)

El usuario quería un aviso más inmediato que el correo cuando entra un ticket nuevo,
sin depender de webhooks genéricos ni de Zapier/n8n. Se agregó una llamada directa a
la API de Telegram (`https://api.telegram.org/bot<token>/sendMessage`) **desde el
propio backend**, en el único punto por el que pasan las 5 rutas de creación de
ticket: `insertTicket()` (`server.js`).

**Reglas para no romper este patrón:**

- **Best-effort siempre**: `sendTelegramNotification(ticket)` se llama envuelta en
  `try/catch` dentro de `insertTicket()`, exactamente igual que
  `sendTicketNotification("received", ...)`. Un fallo de Telegram (token inválido,
  sin red, rate limit de Telegram) **nunca** debe impedir que el ticket se cree — solo
  se loguea con `console.error`.
- **Solo dispara en creación**, no en cambios de estado ni respuestas — a propósito,
  para no saturar de mensajes. Si se quiere avisar también de SLA vencido o
  reapertura, es un cambio aparte y explícito, no agregarlo silenciosamente aquí.
- **Config en `store.config.notifications_config.telegram`** (`{enabled, botToken,
  chatId}`), mismo patrón que `smtp` — **nunca** en variables de entorno ni en un
  `.env` nuevo. El `botToken` se enmascara como `"••••••••"` en cualquier `GET`/`PUT`
  de `/api/notifications/config` (igual que `smtp.pass`), y `saveNotificationsConfig()`
  reconoce ese sentinela para no sobrescribir el token real con la máscara.
- La llamada HTTP reutiliza la forma de `deliverWebhook()` (`https.request` +
  timeout de 10s + reintentos con backoff 2s/4s hasta 3 intentos) — no introducir un
  segundo mecanismo de HTTP saliente si se agregan más integraciones de este tipo.
- El usuario aún no tenía token/chat_id al desplegar esta versión — la función queda
  activa pero inofensiva (`enabled: false` por defecto) hasta que genere un bot con
  **@BotFather**, obtenga el `chat_id` visitando
  `https://api.telegram.org/bot<TOKEN>/getUpdates`, y los pegue en
  **Configuración → Notificaciones → Aviso a Telegram**.

## Apagado ordenado y bloqueo de instancia única (desde v14.42)

**Incidente real (2026-09-10):** varios tickets "revirtieron" — `resolution` vacío,
`status` a un estado anterior, entradas de `history` de ese día desaparecidas — en una
ventana exacta de 20 minutos, con datos de antes y de después intactos. La causa **no
fue Docker/CI-CD ni un restore de base de datos** (este proyecto no tiene nada de
eso) — fue un *race condition* real de este código:

- `store` se carga en memoria **una sola vez** al arrancar (`const store =
  loadStore()`) y nunca se vuelve a leer desde disco durante la vida del proceso.
- `writeStoreToDisk()` escribe el **archivo completo** (`JSON.stringify(store)`) sin
  merge ni control de versión — cualquier proceso vivo, sin importar qué tan vieja sea
  su copia en memoria, que llame a `saveStore()` sobrescribe todo lo que otro proceso
  más nuevo haya escrito después.
- El flujo de deploy documentado (`pkill -f 'lsnode:...'`) no garantizaba que el
  proceso viejo muriera antes de que LiteSpeed levantara uno nuevo — un proceso a
  mitad de un poll IMAP podía seguir vivo hasta `POLL_ABSOLUTE_TIMEOUT_MS` (3 min),
  con su `setInterval` del poller de correo todavía activo, listo para volver a
  `saveStore()` con datos de horas atrás.

**Qué se corrigió:**

- **Apagado ordenado**: `process.on("SIGTERM"/"SIGINT", ...)` → `gracefulShutdown()`
  limpia `emailPollerTimer`/`autoCloserTimer`/`slaBreachTimer` de inmediato, libera el
  lock de proceso, y fuerza `process.exit(0)` en ~2s como máximo (antes podía tardar
  minutos). El `pkill` del flujo de deploy ahora mata el proceso casi al instante.
- **Lock de instancia** (`LOCK_PATH`, junto al store): al arrancar,
  `checkStaleProcessLock()` revisa si el lock apunta a un PID **todavía vivo**
  (`isPidAlive`) distinto del propio, y si es así lo grita fuerte en el log — no
  bloquea el arranque (para no arriesgar disponibilidad si el lock quedó huérfano por
  un crash), pero deja evidencia inequívoca de que dos procesos conviven sobre el
  mismo archivo. `writeProcessLock()`/`releaseProcessLock()` solo tocan el lock si es
  el propio PID.

**Reglas para no reintroducirlo:**

- Cualquier nuevo `setInterval` que pueda llamar a `saveStore()` (o mutar
  `store.ticketHistory`/`store.tickets` de forma que dispare una escritura) **debe**
  guardar su ID en una variable a nivel de módulo y limpiarse en `shutdownCleanup()` —
  si no se limpia, reintroduce exactamente esta ventana de carrera.
- Si algún día se necesita *de verdad* bloquear el arranque de un segundo proceso (no
  solo advertir), pensarlo dos veces: en un entorno lsnode que respawnea solo, un
  bloqueo duro mal calibrado podría dejar el sitio caído tras un crash con lock
  huérfano. La advertencia en log es la opción segura por defecto.
- `writeStoreToDisk()` sigue sin hacer merge contra el disco — el apagado ordenado y
  el lock reducen la ventana de carrera casi a cero, pero no la eliminan
  matemáticamente. Si en el futuro se corre más de una instancia a propósito (ej.
  balanceo de carga), esto necesitaría un rediseño real de la persistencia (base de
  datos con locking, o coordinación entre procesos) — no asumir que sigue siendo
  seguro con >1 proceso escribiendo el mismo `STORE_PATH` a la vez.

## Sondeo de correo dormido por reciclado de proceso (desde v14.43)

El usuario reportó tickets de correo que "llegan tarde, como si el servidor se
quedara dormido" — más en horas sin tráfico. Causa: `startEmailPoller()` depende
por completo de que el proceso Node siga vivo (`pollEmails()` al arrancar + cada
`pollIntervalMinutes` vía `setInterval`, sin cron externo ni keep-alive). LiteSpeed
recicla procesos `lsnode` inactivos en hosting compartido — sin tráfico HTTP, el
proceso muere y el `setInterval` con él; los correos que lleguen mientras tanto no
se pierden (no se marcan `\Seen`) pero tampoco se procesan hasta que una petición
HTTP relance el proceso.

**Qué se corrigió:**

- `maybeRecoverStalePoll()` (llamada desde `GET /api/health`): si
  `emailPollStatus.lastPoll` es más viejo que `2×pollIntervalMinutes` y el correo
  está habilitado, dispara `pollEmails()` de inmediato — cualquier petición HTTP
  (no solo abrir el panel) recupera el sondeo atrasado sin esperar al próximo tick.
- **Esto no reemplaza mantener el proceso despierto** — sin tráfico periódico, el
  proceso se sigue reciclando igual. Falta el paso operativo: un Cron Job de hPanel
  (Avanzado → Cron Jobs) haciendo `curl -s https://soporte.easystem.co/api/health`
  cada 3-5 min, o un servicio externo gratuito (UptimeRobot, cron-job.org) si no hay
  acceso a hPanel. **Pendiente de que el usuario lo configure** — no es algo que se
  resuelva solo con código.

**Reglas para no reintroducirlo:** cualquier nuevo timer que dependa del proceso
vivo (como `emailPollerTimer`) debería tener, idealmente, un mecanismo de
auto-recuperación similar si su ausencia puede perder trabajo — no asumir que el
proceso nunca se recicla en este hosting.

## Fallback de matching por asunto+remitente (desde v14.44)

Llegó un reporte externo (de una sesión sin acceso al código) alegando que el
threading de correo no existía y que se creaban tickets duplicados masivamente al
responder. Se verificó cada afirmación contra el código real antes de tocar nada:
la mayoría eran falsas (threading, `reopenedByClient` e IDs estables ya funcionaban
desde v14.37/v14.34) — pero **dos** eran reales: el asunto nunca se normalizaba
(`Re:`/`Fwd:` no se limpiaban) y `matchEmailThread` se rendía de inmediato si el
correo no traía `In-Reply-To`/`References` (cliente de correo que no las manda, o
un relay que las quita), sin ningún intento de recuperación.

**Qué se corrigió:**

- `normalizeSubjectForMatching()`: quita prefijos `Re:`/`Fwd:`/`Fw:`/`RV:`
  anidados, **solo para comparar** — nunca sobrescribe `ticket.subject`, que el
  usuario sigue viendo tal cual llegó.
- `matchEmailThread()`: cuando no hay ninguna cabecera de hilo que comparar
  (`allIds.size === 0`, antes retornaba `"none"` de inmediato), como último recurso
  busca un ticket del mismo `contact` con el mismo asunto normalizado, dentro de
  `THREAD_MATCH_MAX_AGE_MS`. Nuevo `matchKind: "subject-fallback"`.
- **Regla de oro (aprendida del incidente de v14.36):** un match por asunto es una
  señal más débil que un Message-ID exacto. `classifyThreadAction()` para
  `"subject-fallback"` solo hace `attach-reply` si el ticket sigue activo — **nunca**
  reabre un ticket `resuelto`/`cerrado` por esta vía, y nunca dispara
  `reopenedByClient`. En vez de eso, el ticket nuevo se crea como siempre y queda
  marcado con `possibleDuplicateOf: "<id>"` (expuesto en `serializeTicket()` y en
  `openapi.json`) para que un humano decida si fusionar — nunca automático.
- **Este camino solo se activa si NO hay ninguna cabecera de hilo.** Si
  `In-Reply-To`/`References` existen pero no calzan con nada conocido, sigue siendo
  `matchKind: "none"` tal cual — eso sí es (probablemente) un hilo distinto de
  verdad, no hay que "rescatarlo" por asunto.

**Reglas para no reintroducirlo:**

- No convertir `"subject-fallback"` en una señal fuerte — si algún día se necesita
  fusionar automáticamente, que sea un endpoint explícito de merge con confirmación
  del usuario (fuera de alcance de v14.44 a propósito), nunca aumentando la
  confianza de este matchKind.
- Al truncar `store.ticketHistory`/`store.tickets` directamente en tests (en vez de
  vía las funciones normales), llamar también a `invalidateHistoryIndex()` —
  `getHistoryIndex()` cachea un `Map` por `ticketId` que un truncado de array no
  invalida por sí solo; con IDs de ticket que se repiten entre tests (uno sembrado a
  mano, otro generado dinámicamente por `getNextTicketId()`), esto puede filtrar
  historial "fantasma" de un test anterior. `tests/email-matching.test.js` lo hace
  en su `beforeEach` — replicar el patrón en cualquier archivo de test nuevo que
  manipule `store.ticketHistory` directamente.

## Detección activa de procesos zombie invisibles al lock (desde v14.45)

**Incidente real (2026-09-23):** dos tickets cerrados manualmente reaparecieron
horas después como `"abierto"`, sin `reopenedByClient`. Se descartó el pipeline de
correo (`classifyThreadAction()` estructuralmente no puede reabrir un ticket
`cerrado` sin dejar rastro — verificado rama por rama) y los timers de auto-cierre/
SLA (ninguno escribe `status: "abierto"` en ningún camino). Causa confirmada: el
mismo patrón de v14.42, pero con un hueco real en esa mitigación — **el lock de PID
solo detecta procesos que ESCRIBIERON el lock**. Un proceso vivo desde ANTES de que
existiera `writeProcessLock()` (de un deploy previo a v14.42) nunca lo escribió, así
que `checkStaleProcessLock()` no podía verlo — quedaba libre para seguir llamando
`saveStore()` con una copia de memoria de hace días/semanas, revirtiendo lo que
cualquier proceso nuevo escribiera.

**Qué se corrigió:**

- `killOtherServerProcesses()`, llamada al inicio de `startServer()` (antes de
  `checkStaleProcessLock()`): busca directamente en el sistema operativo
  (`pgrep -f __filename`) cualquier otro proceso corriendo este mismo `server.js`,
  **sin depender del lock file en absoluto**, y le manda `SIGTERM` de forma activa
  — no solo loguea como hacía `checkStaleProcessLock()`. Verificado con dos procesos
  reales: el segundo mata al primero antes de terminar de arrancar.
- Best-effort real: si `pgrep` no existe, no hay coincidencias (el caso normal —
  `execSync` lanza con exit code 1), o cualquier otro fallo, el arranque **nunca**
  se interrumpe.
- El lock de PID (`checkStaleProcessLock`/`writeProcessLock`) se mantiene como
  registro/diagnóstico adicional — la detección real ya no depende solo de él.

**Reglas para no reintroducirlo:**

- `childProcess.execSync(...)` se llama **a través del objeto del módulo**
  (`childProcess.execSync`), nunca destructurado (`const { execSync } = ...`) —
  destructurar rompe el mockeo en tests (`jest.spyOn(childProcess, "execSync")`
  no afecta una copia ya destructurada de la referencia). Mismo patrón que
  `https.request` en `deliverWebhook`/`sendTelegramNotification`.
- Si en producción **ahora mismo** hay un ticket que se revierte solo, no esperar al
  próximo deploy — ningún cambio de código mata un proceso que ya está vivo. Hay
  que matarlo a mano en el servidor: `ps aux | grep -i node`, identificar todos los
  procesos sirviendo `soporte.easystem.co` y matarlos todos, dejando que LiteSpeed
  levante uno limpio.
- Esto sigue sin ser una solución matemáticamente perfecta (`writeStoreToDisk()`
  sigue sin merge) — es una segunda capa que cierra el hueco específico de "proceso
  más viejo que el propio mecanismo de detección". Ver también la sección de v14.42
  para el resto de las reglas sobre timers y `saveStore()`.

## Antes de cada entrega, verificar

- [ ] ¿El cambio modifica o reinicializa `data/neurodesk.json`?
- [ ] ¿Se sobrescribe alguna clave de config con valores de ejemplo?
- [ ] ¿Se requiere reconfigurar Gmail o App Password para que funcione?
- [ ] ¿El `.gitignore` sigue ignorando `data/` completo?
- [ ] ¿Los nuevos defaults usan merge (no replace) sobre la config existente?

Si alguna respuesta es **sí**, replantear el enfoque antes de entregar.
