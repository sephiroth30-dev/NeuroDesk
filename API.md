# NeuroDesk API v1

API REST para conectar NeuroDesk con agentes de IA, automatizaciones (Zapier, n8n, Make) o scripts propios.

Base: `https://soporte.easystem.co`

---

## Autenticación

Todas las rutas (excepto `openapi.json`) requieren un token Bearer:

```bash
curl -H "Authorization: Bearer nd_live_xxxxx" \
  https://soporte.easystem.co/api/v1/inbox
```

### Crear un token

Panel → **Configuración → 🔌 API → Llaves de acceso**.

El token se muestra **una sola vez** al crearlo. Si lo pierdes, revócalo y crea otro.

### Permisos (scopes)

| Scope | Permite |
|---|---|
| `tickets:read` | Leer tickets, la bandeja priorizada y el historial |
| `tickets:write` | Crear tickets, cambiar estado, agregar notas, responder al cliente |
| `stats:read` | Leer métricas y cumplimiento de SLA |

Una llave sin el scope requerido recibe `403 invalid_scope`.

### Límite de peticiones

120 por minuto por llave. Cada respuesta incluye:

```
X-RateLimit-Limit: 120
X-RateLimit-Remaining: 118
X-RateLimit-Reset: 1784948263
```

Al excederlo: `429 rate_limited`.

---

## Errores

Formato uniforme:

```json
{ "error": { "code": "invalid_scope", "message": "Este token no tiene el permiso tickets:write." } }
```

| Código | HTTP | Significado |
|---|---|---|
| `unauthorized` | 401 | Token ausente, inválido o revocado |
| `invalid_scope` | 403 | El token no tiene el permiso necesario |
| `not_found` | 404 | El ticket o la ruta no existe |
| `validation_error` | 400 | Datos inválidos o faltantes |
| `rate_limited` | 429 | Excediste el límite de peticiones |
| `email_failed` | 502 | No se pudo enviar el correo (revisar SMTP) |

---

## `GET /api/v1/inbox` — trabajo pendiente priorizado

**El endpoint principal.** Devuelve el trabajo ya clasificado para que nada se pase por alto.
Todos los cálculos respetan el horario laboral y la zona horaria configurados.

```bash
curl -H "Authorization: Bearer $TOKEN" \
  https://soporte.easystem.co/api/v1/inbox
```

```json
{
  "generatedAt": "2026-07-25T09:30:00.000Z",
  "timezone": "America/Bogota",
  "insideBusinessHours": true,
  "summary": {
    "breached": 2, "atRisk": 1, "unassigned": 3,
    "reopened": 0, "waitingOnClient": 1, "totalActive": 6
  },
  "buckets": {
    "breached":        [ { "id": "ND-1003", "overdueHours": 49, "...": "..." } ],
    "atRisk":          [ { "id": "ND-1074", "...": "..." } ],
    "unassigned":      [],
    "reopened":        [],
    "waitingOnClient": []
  }
}
```

| Grupo | Criterio |
|---|---|
| `breached` | SLA vencido. Incluye `overdueHours`. Ordenado del más vencido al menos |
| `atRisk` | Queda 20% o menos del SLA. Ordenado por menos tiempo restante |
| `unassigned` | Activo y sin responsable asignado |
| `reopened` | El cliente respondió a un ticket ya resuelto |
| `waitingOnClient` | Estado `en_espera` |

Un ticket puede aparecer en varios grupos (ej. vencido *y* sin asignar).

---

## `GET /api/v1/tickets` — listar con filtros

```bash
curl -H "Authorization: Bearer $TOKEN" \
  "https://soporte.easystem.co/api/v1/tickets?active=true&urgency=alta&limit=50"
```

| Parámetro | Valores |
|---|---|
| `status` | `abierto` `en_proceso` `en_espera` `resuelto` `cerrado` |
| `active` | `true` — excluye resueltos y cerrados |
| `urgency` | `baja` `media` `alta` `critica` |
| `area` | texto exacto (sin distinguir mayúsculas) |
| `assignedTo` | usuario, o `none` para sin asignar |
| `contact` | correo exacto del solicitante |
| `slaBreached` | `true` — solo con SLA vencido |
| `updatedSince` | fecha ISO 8601 |
| `limit` | 1–100 (por defecto 25) |
| `cursor` | valor de `nextCursor` de la respuesta previa |

```json
{
  "data": [ { "id": "ND-1075", "...": "..." } ],
  "pagination": { "total": 87, "limit": 25, "cursor": "0", "nextCursor": "25" }
}
```

Cuando `nextCursor` es `null`, no hay más páginas.

---

## `GET /api/v1/tickets/{id}` — detalle con historial

Igual que el objeto de la lista, más el arreglo `history`:

```json
{
  "id": "ND-1075",
  "subject": "Firma correo",
  "status": "en_proceso",
  "urgency": "baja",
  "sla": { "limitHours": 24, "elapsedHours": 3.2, "remainingHours": 20.8, "breached": false,
           "paused": false, "finished": false, "outsideBusinessHours": false },
  "history": [ { "note": "...", "status": "en_proceso", "createdAt": "...", "isQuickNote": true } ]
}
```

---

## `POST /api/v1/tickets` — crear

Requiere `tickets:write`. Obligatorios: `name` y `urgency`.

```bash
curl -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  https://soporte.easystem.co/api/v1/tickets \
  -d '{
    "name": "Leydi Navas",
    "contact": "leydi@neurofic.com",
    "subject": "Cambio de firma",
    "description": "Necesito actualizar la firma del correo",
    "urgency": "baja",
    "area": "Correo"
  }'
```

Si hay API key de Anthropic configurada, el triaje de IA ajusta urgencia, categoría y
sentimiento en segundo plano (unos segundos después de la respuesta).

---

## `PATCH /api/v1/tickets/{id}` — actualizar

Requiere `tickets:write`. Envía **solo los campos que cambian**; el resto se conserva.

```bash
curl -X PATCH -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  https://soporte.easystem.co/api/v1/tickets/ND-1075 \
  -d '{ "status": "en_proceso", "assignedTo": "admin" }'
```

Campos: `status`, `urgency`, `area`, `assignedTo`, `subject`, `description`,
`resolution`, `resolutionNote`, `workedHours`, `customFields`.

Al pasar a `resuelto` o `cerrado` es obligatorio `resolution` o `resolutionNote`.
Agrega `"silent": true` para no enviar el correo de notificación al cliente.

---

## `POST /api/v1/tickets/{id}/notes` — nota interna

Requiere `tickets:write`. No notifica al cliente.

```bash
curl -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  https://soporte.easystem.co/api/v1/tickets/ND-1075/notes \
  -d '{ "note": "Revisado, pendiente respuesta del proveedor" }'
```

---

## `POST /api/v1/tickets/{id}/reply` — responder al cliente

Requiere `tickets:write` y que el ticket tenga correo de contacto.

```bash
curl -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  https://soporte.easystem.co/api/v1/tickets/ND-1075/reply \
  -d '{ "message": "Hola Leydi, ya quedó actualizada la firma." }'
```

Registra el `Message-ID` como ancla del hilo, así las respuestas del cliente
vuelven a este ticket en vez de crear uno nuevo.

---

## `GET /api/v1/stats` — métricas

Requiere `stats:read`. Tickets activos, SLA vencidos, cumplimiento, distribución
por estado y urgencia.

---

## `GET /api/v1/me` — verificar token

Sin scope. Útil para comprobar que una integración quedó bien configurada.

```json
{
  "keyId": "…", "label": "Agente de correo", "prefix": "nd_live_a930ea0b",
  "scopes": ["tickets:read", "tickets:write"],
  "rateLimit": { "limit": 120, "remaining": 119, "resetAt": "…" },
  "version": "14.34", "timezone": "America/Bogota"
}
```

---

## Webhooks

En vez de consultar la API periódicamente, recibe un `POST` cuando algo cambia.

Se registran en **Configuración → 🔌 API → Webhooks**.

### Eventos

`ticket.created` · `ticket.updated` · `ticket.resolved` · `ticket.reopened` · `ticket.sla_breached`

### Formato

```json
{
  "event": "ticket.sla_breached",
  "deliveredAt": "2026-07-25T14:30:00.000Z",
  "data": { "id": "ND-1075", "...": "objeto ticket completo" }
}
```

### Verificar la firma

Cada entrega incluye `X-NeuroDesk-Signature: sha256=<hex>`, que es el HMAC-SHA256
del cuerpo crudo usando el secreto del webhook. **Verifícalo siempre** antes de confiar
en el contenido:

```js
const crypto = require("crypto");

function esValido(cuerpoCrudo, firmaHeader, secreto) {
  const esperado = "sha256=" + crypto.createHmac("sha256", secreto).update(cuerpoCrudo).digest("hex");
  return crypto.timingSafeEqual(Buffer.from(firmaHeader), Buffer.from(esperado));
}
```

Reintentos: hasta 3 intentos con espera creciente (2s, 4s) si la respuesta no es 2xx.
Responde `200` rápido y procesa de forma asíncrona.

---

## OpenAPI

```
GET /api/v1/openapi.json
```

Público, sin token. Impórtalo en Claude, ChatGPT (Actions), Zapier o n8n para generar
las llamadas automáticamente.

---

## Ejemplo: agente de repaso diario

```bash
#!/usr/bin/env bash
# Reporta lo que requiere atención hoy
TOKEN="nd_live_xxxxx"
curl -s -H "Authorization: Bearer $TOKEN" \
  https://soporte.easystem.co/api/v1/inbox \
| jq -r '
  "SLA vencido: \(.summary.breached)  |  En riesgo: \(.summary.atRisk)  |  Sin asignar: \(.summary.unassigned)",
  "",
  (.buckets.breached[] | "VENCIDO  \(.id)  \(.subject)  (\(.overdueHours)h de retraso)"),
  (.buckets.atRisk[]   | "EN RIESGO \(.id)  \(.subject)  (quedan \(.sla.remainingHours)h)")
'
```
