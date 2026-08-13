# NeuroDesk — Reglas de Producción

**Versión actual en producción: v14.35**

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

## Antes de cada entrega, verificar

- [ ] ¿El cambio modifica o reinicializa `data/neurodesk.json`?
- [ ] ¿Se sobrescribe alguna clave de config con valores de ejemplo?
- [ ] ¿Se requiere reconfigurar Gmail o App Password para que funcione?
- [ ] ¿El `.gitignore` sigue ignorando `data/` completo?
- [ ] ¿Los nuevos defaults usan merge (no replace) sobre la config existente?

Si alguna respuesta es **sí**, replantear el enfoque antes de entregar.
