# NeuroDesk — Reglas de Producción

**Versión actual en producción: v14.37**

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
# curl https://soporte.easystem.co para confirmar que respondió tras el respawn
```

No hace falta `sudo`, ni tocar hPanel — el pkill del propio usuario basta porque los
procesos `lsnode` corren con ese mismo usuario.

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

## Antes de cada entrega, verificar

- [ ] ¿El cambio modifica o reinicializa `data/neurodesk.json`?
- [ ] ¿Se sobrescribe alguna clave de config con valores de ejemplo?
- [ ] ¿Se requiere reconfigurar Gmail o App Password para que funcione?
- [ ] ¿El `.gitignore` sigue ignorando `data/` completo?
- [ ] ¿Los nuevos defaults usan merge (no replace) sobre la config existente?

Si alguna respuesta es **sí**, replantear el enfoque antes de entregar.
