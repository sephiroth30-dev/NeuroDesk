# Changelog

Todas las versiones importantes de NeuroDesk quedan documentadas aquí.

Para revertir a una versión específica:

```bash
git checkout <commit-hash>
# o en rama separada para no perder el estado actual:
git checkout -b rollback/vX.Y <commit-hash>
```

## Regla de versionado

A partir de v5.0 el esquema es `funcional.estetico` (se eliminó el cero inicial).

- Primer dígito: nuevas funcionalidades o cambios de flujo.
- Segundo dígito: ajustes visuales, pulido y cambios estéticos.

---

## [14.2] - 2026-05-14

### fix: correos duplicados + imágenes adjuntas visibles en tickets

**Correos duplicados:**
- Deduplicación de destinatarios: si `ticket.contact` ya está en `adminEmails`, no se envía el correo de cliente por separado — solo se envía la versión admin con los datos completos
- Limpieza del body: colapsa líneas vacías consecutivas al renderizar plantillas (evita blancos cuando `{{ticket_url}}` está vacío)

**Imágenes adjuntas desde correo:**
- Se crea `ATTACH_DIR` junto al `STORE_PATH` (fuera del repo, sobrevive deploys)
- Al procesar correos entrantes, las imágenes adjuntas (`image/*`) se guardan en disco bajo `attachments/{ticket_id}/`
- Nueva columna `attachments` en SQLite con migración automática
- Endpoint `GET /api/tickets/:id/attachments/:filename` sirve las imágenes con autenticación de sesión
- En la vista de detalle del ticket, las imágenes se muestran como thumbnails clicables (abren la imagen completa en nueva pestaña)

---

## [14.1] - 2026-05-14

### feat: botón "Ver ticket" en correos de resolución + deep link

- **Campo "URL base"** en Configuración → Notificaciones: se guarda la URL pública de la app (ej. `https://soporte.easystem.co`)
- **`{{ticket_url}}`**: nueva variable disponible en todas las plantillas de correo. Se expande a `{app_url}/?ticket={id}`
- **Correo de resolución** actualizado por defecto para incluir el enlace de acceso directo al ticket
- **Botón en HTML del correo**: cualquier URL en el cuerpo se renderiza como botón azul "Ver ticket →" en el HTML del email
- **Deep link al abrir la app**: si llegas a la app con `?ticket=ND-XXXX` en la URL, el ticket se abre automáticamente. Tras abrir, la URL se limpia con `history.replaceState`

---

## [14.0] - 2026-05-14

### Fix: caché de navegador rompía actualizaciones de CSS/JS

- `sendStatic`: HTML se sirve con `Cache-Control: no-cache, no-store, must-revalidate` — el navegador siempre pide el HTML fresco al servidor
- CSS y JS (con cache buster `?v=X.Y`) se sirven con `Cache-Control: public, max-age=31536000, immutable` — cacheados indefinidamente hasta que cambie la versión
- Esto elimina el problema donde el navegador cargaba `styles.css?v=13.8` antiguo incluso después de un deploy

---

## [13.9] - 2026-05-14

### Espaciado interior tarjetas Indicadores

- Incrementado padding de `.slaMetricItem` y `.slaChartItem` de `24px 28px` a `32px 36px` para más aire visual
- Aumentados márgenes entre label, valor y descripción en las métricas (`slaMetricLabel` → `0 0 10px`, `slaMetricValue` → `0 0 10px`)
- Incrementado margen inferior de `.slaChartSub` de `14px` a `20px` para separar el subtítulo de las barras
- Aumentado `gap` en `.statusBars` de `10px` a `12px`

---

## [13.8] - 2026-05-14

### Hotfix: Indicadores aparecía en el Panel

- **Bug crítico**: `#slaView { display: flex }` sobreescribía `.view { display: none }` por especificidad del selector ID — la vista de Indicadores quedaba siempre visible debajo del Panel
- **Fix**: cambiado a `#slaView.active { display: flex }` para que el flex solo aplique cuando la vista está activa

---

## [13.7] - 2026-05-14

### Indicadores — espaciado y compacidad del filtro

- **`#slaView` gap uniforme**: el contenedor ahora usa `display: flex; flex-direction: column; gap: 16px` — todas las secciones (sectionHeader, filterPanel, slaMetricsCard, slaChartsCard, reportTable) se separan uniformemente sin gestionar márgenes individuales
- **Padding interior aumentado**: `.slaMetricItem` y `.slaChartItem` pasan de `20px 24px` a `24px 28px` para dar más aire dentro de las cards
- **Inputs del filtro compactos**: `.filterPanel input, .filterPanel select` reducidos a `min-height: 32px` (el global era 40px) — el panel de filtros ocupa menos vertical y se acerca al diseño SERENE
- **Márgenes individuales eliminados**: se quitan `margin-bottom` de slaMetricsCard, slaChartsCard, filterPanel y `margin-top` de reportTable (el `gap` del flex container los reemplaza)

---

## [13.6] - 2026-05-14

### Corrección jerarquía tipográfica — "Detalle filtrado"

- **Fix**: el título "Detalle filtrado" se mostraba más pequeño que el subtítulo porque `.panelHeader h2` tiene estilo global de eyebrow (0.68rem + uppercase). Override contextual en `.reportTable` para que el h2 sea título real (0.9rem, bold, dark) y el meta debajo sea el texto pequeño muted.

---

## [13.5] - 2026-05-14

### Indicadores — rediseño SERENE

- **Card de métricas unificada**: las 3 métricas (Cumplimiento, Tickets filtrados, Promedio restante) pasan de 3 tarjetas independientes con borde azul superior a una sola card horizontal con divisores internos
- **Donut más pequeño** (96px): alineado horizontalmente con la etiqueta y descripción de Cumplimiento
- **Promedio restante en azul** (acento): antes era gris/negro
- **Card de gráficas unificada**: Estados SLA + Urgencia en una sola card con dos columnas (antes 2 cards separadas)
- **Sin borde-top azul** en ninguna metricCard
- **Subtitle limpio**: eliminado el título duplicado "Estadísticas SLA" del header de la vista (ya lo muestra el topbar)
- **Botón Exportar PDF** restyled como `secondaryAction` (antes era `primaryAction`)
- Responsive: en móvil las secciones apilan verticalmente con divisor horizontal

---

## [13.4] - 2026-05-14

### Panel — rediseño SERENE (Opción A)

- **Stat cards**: color "Resueltos hoy" cambiado de verde a azul (acento); "SLA vencido" solo se colorea en rojo cuando hay tickets realmente vencidos (antes siempre era rojo aunque fuera 0)
- **Kanban headers**: eliminados fondos de color por columna; ahora cada columna muestra un dot (●) del color del estado + texto neutro + conteo en gris
- **Tablero de tickets**: título convertido de eyebrow uppercase a encabezado real (1rem/700)
- **Controles del board**: "Tarjetas | Lista | Cerrados" unificados en un segmented control tipo pill; desaparece el dropdown "Estado" del header (la funcionalidad sigue vía click en stat cards)
- **Tarjetas de ticket**: eliminados el checkbox de selección y el dropdown de estado; SLA cambiado de pill con fondo a dot + texto (verde/rojo); fecha del ticket en la esquina inferior derecha
- **Filtro SLA vencido**: rojo dinámico (solo cuando `breached > 0`)

---

## [13.3] - 2026-05-14

### Fix: sondeo IMAP en segundo plano — causas raíz resueltas

**Problema 1 — `connectedAt` estático (causa principal)**
- `emailConfig.connectedAt` nunca se actualizaba: cada poll buscaba emails desde la fecha de configuración inicial (semanas/meses atrás), enviando miles de UIDs a Gmail cada 5 min → Gmail bloqueaba/cortaba la conexión silenciosamente
- **Fix**: tras cada poll exitoso, `connectedAt` avanza a `ahora - 2h`. El próximo poll solo escanea 2 horas de emails. Si el servidor estuvo caído N horas, el gap se cubre automáticamente al reiniciar.

**Problema 2 — Sin timeout en ImapFlow (causa del bloqueo total)**
- Si la conexión IMAP se colgaba (sin respuesta), `emailPollStatus.polling` quedaba en `true` indefinidamente → todos los polls siguientes eran bloqueados por el guard `if (polling) return`
- **Fix**: `connectionTimeout: 30s`, `socketTimeout: 90s` en ImapFlow + timeout absoluto de 3 min que libera el flag `polling` aunque la promesa no resuelva

**Problema 3 — Errores invisibles**
- `.catch(() => {})` silenciaba todo error; PM2 no mostraba nada
- **Fix** (ya en v13.2): `console.error()` en el catch con mensaje exacto; `console.log()` al iniciar el poller y al crear tickets

**UI — Estado del sondeo mejorado**
- Nueva fila "Fallos consecutivos" en el panel Configuración > Correo entrante
- Se colorea en naranja (1-2 fallos) o rojo en negrita (3+), con texto de error en rojo

---

## [13.2] - 2026-05-14

### Diagnóstico: sondeo IMAP en segundo plano

- **Logging en el poller**: `pollEmails()` ahora registra en consola (visible en `pm2 logs neurodesk`) cada error IMAP con el mensaje exacto — antes los errores eran silenciosos y el poller fallaba sin ninguna traza
- **`lastPoll` en fallo**: el timestamp `lastPoll` ahora se actualiza también cuando el sondeo falla, para que `/api/email/status` muestre cuándo ocurrió el último intento (no solo el último éxito)
- **Log de inicio**: `startEmailPoller()` registra en consola al arrancar — intervalo configurado y cuenta IMAP — confirmando que el poller quedó activo tras el boot de PM2
- **Log de tickets creados**: cuando el sondeo crea 1+ tickets desde correo, se registra en consola con el conteo

---

## [13.1] - 2026-05-13

### Correcciones de consistencia visual (SERENE)

- **Icono Tickets**: reemplazado el clipboard por ticket stub (rectángulo con hendiduras en los lados — estilo SF Symbols "ticket")
- **Icono Configuración**: reemplazado la rueda dentada por sliders horizontales (SF Symbols "slider.horizontal.3") — alineado con el mockup
- **Sidebar footer**: nuevo user card con avatar circular (iniciales), nombre de usuario, subtítulo "Equipo interno" y botón de logout compacto; comportamiento colapsado muestra solo avatar + logout
- **Badge de tickets**: número de tickets activos (no cerrados) al lado de "Tickets" en el sidebar; se oculta en estado colapsado
- **Topbar eyebrow dinámico**: ahora cambia por vista — Resumen muestra la fecha, Tickets muestra "ADMINISTRACIÓN", Indicadores muestra "INDICADORES", Configuración muestra "AJUSTES"
- **Section headers**: eliminado el estilo de tarjeta (borde + sombra + fondo) en las vistas — headers transparentes y planos
- **SLA config cards**: los inputs de horas en la pestaña "Tiempos SLA" se renderizan como tarjetas con el número grande editable en primer plano

---

## [13.0] - 2026-05-13

### Rediseño visual completo — Tema Indigo iOS (SERENE)

Rediseño puramente estético. No se modificó lógica de negocio, rutas, endpoints ni estructura de datos.

**Sistema de design tokens (`public/tokens.css`)**
- Nuevo archivo de tokens CSS: paleta Indigo iOS, tipografía SF Pro/Inter, escala de espaciado, radios, sombras y dimensiones del sidebar
- Todas las variables quedan centralizadas y documentadas para futuros cambios de tema

**Paleta de color**
- Fondo de app: `#F5F5F2` (warm off-white, antes `#f0f2f7` frío)
- Acento principal: `#0A6BFF` (Indigo iOS, antes `#7c3aed` morado — sin gradientes)
- Texto primario: `#1C1C1E` (casi negro, estilo iOS)
- Texto secundario: `#6E6E73`
- Líneas/bordes: `rgba(60, 60, 67, 0.10)` (hairlines suaves)
- Estados: open `#0A84FF`, process `#FF9F0A`, wait `#AF52DE`, done `#30D158`, danger `#FF3B30`

**Sidebar**
- Ancho expandido: 220 px (antes 232 px) — alineado con token `--nd-sidebar-w-expanded`
- Ancho colapsado: 64 px (antes 56 px) — alineado con token `--nd-sidebar-w-collapsed`
- Logo: cuadrado negro con icono SVG (4 cuadrados), sin gradiente morado
- Ítem activo: fondo azul suave + texto azul (sin cambio de comportamiento)

**Topbar**
- Eliminado estilo de "tarjeta" (borde + sombra) — el topbar es ahora plano y transparente
- Muestra día y fecha en español (ej. `LUNES · 13 MAYO`) en lugar del texto fijo "Neurofic"
- Título dinámico por vista: Resumen / Tickets / Estadísticas SLA / Configuración / Nuevo ticket
- Botón "**+ Nuevo ticket**" (texto completo, antes "+ Nuevo")

**Tarjetas de métricas (stat cards)**
- Eliminadas las barras de color superiores (`::before` gradient)
- Eliminados los íconos decorativos flotantes — números más prominentes y limpios

**Botones**
- `primaryAction` y `button[type=submit]`: color sólido `#0A6BFF` sin gradiente
- Hover: `#0857D6`
- Focus rings: azul (antes morado)

**Badges de urgencia**
- Baja: gris suave · Media: azul suave · Alta: amarillo/naranja suave · Crítica: rojo suave
- Colores alineados con tokens iOS

**Login (`login.html`) — rediseño completo**
- Fondo: `#F5F5F2`
- Card: blanca, `border-radius: 16px`, borde hairline, sombra mínima
- Logo: cuadrado negro con icono SVG
- Versión de app en esquina superior derecha de la card
- Etiquetas en uppercase + input limpio
- Botón "Continuar" azul sólido, sin gradiente
- Footer con "Restablecer contraseña" (izquierda) y "Portal de clientes ↗" (derecha)

**Cache-busting**: versiones actualizadas a `?v=13.0`

---

## [12.0] - 2026-05-07

### Restablecimiento de contraseña por correo

- **Enlace en login**: el formulario de acceso muestra "¿Olvidaste tu contraseña? → Restablecerla" que lleva a `/reset-password`
- **Página de reset**: `/reset-password` tiene dos estados — sin token muestra el formulario para ingresar el usuario; con `?token=` muestra el formulario para elegir nueva contraseña
- **Envío de correo**: al solicitar el reset, el servidor genera un token seguro (32 bytes, 1 hora de validez) y envía un enlace al email del admin configurado en Ajustes de notificaciones
- **Seguridad**: el endpoint siempre responde con `{ ok: true }` para no revelar si el usuario existe; los tokens se almacenan en memoria y se eliminan tras uso o expiración
- Versiones CSS/JS cache-busting actualizadas a `?v=12.0`

---

## [11.13] - 2026-05-07

### Motivo de cierre/resolución obligatorio con modal dedicado

- **Modal de motivo**: al presionar "Marcar resuelto" o "Cerrar ticket" aparece un modal que pide el motivo antes de cerrar — garantiza trazabilidad en todos los cierres
- **Título dinámico**: el modal muestra "Marcar como resuelto" o "Cerrar ticket" según la acción, y el botón de confirmación se etiqueta acorde
- **Pre-relleno inteligente**: si el textarea de notas ya tenía contenido, el modal lo muestra como punto de partida
- **Validación inline**: si el campo queda vacío al confirmar, muestra error dentro del modal sin cerrarlo
- **Flujo automático**: al confirmar, guarda el motivo, cambia el estado, cierra la vista de detalle y regresa al tablero — sin pasos extra
- **Botón guardar inalterado**: "Guardar ticket" mantiene su flujo actual (sin modal, sin cambio de estado forzado)
- Versiones CSS/JS cache-busting actualizadas a `?v=11.13`

---

## [11.12] - 2026-05-07

### Sidebar: icono activo sombreado + nuevo icono de colapsar

- **Icono activo**: cuando un ítem del sidebar está activo, su `<span>` de icono recibe fondo de color brand (`--brand`) con texto blanco y bordes redondeados — resaltado visual claro sin afectar al texto de la etiqueta
- **Nuevo botón colapsar**: reemplazado el ícono de flecha izquierda + texto "Contraer" por chevrones dobles `«`/`»` sin texto; el ícono cambia según el estado (expandido ↔ colapsado)
- **Título dinámico**: el `title` del botón de colapsar actualiza entre "Contraer menú" y "Expandir menú" según el estado
- **Tooltip logout**: añadido `title="Cerrar sesión"` al botón de Salir en el sidebar footer
- Versión CSS cache-busting actualizada a `?v=11.12`

---

## [11.11] - 2026-05-07

### Fix: botón "+ Nuevo" pegado al extremo derecho del topbar

- **CSS selector fix**: cambiado `.topbar > div` a `.topbar > div:not(.topBarRight)` — el selector anterior aplicaba `flex: 1` a todos los divs hijos del topbar (logo y botón por igual), haciendo que el botón quedara centrado en vez de al extremo derecho

---

## [11.10] - 2026-05-07

### Tarjetas del panel como filtros + fixes móvil

- **Stat cards clicables**: cada tarjeta del panel actúa como atajo de filtro
  - _Tickets activos_ → filtra tablero a abiertos/en proceso/en espera
  - _SLA vencido_ → filtra tablero a tickets con SLA incumplido
  - _Cumplimiento SLA_ → navega a la vista de estadísticas SLA
  - _Resueltos hoy_ → filtra tablero a resueltos en las últimas 24h
  - Click en tarjeta activa la desactiva (toggle)
  - Cambiar el selector de estado limpia el filtro de tarjeta
- **Móvil topbar fix**: botón "+ Nuevo" alineado al extremo derecho; se eliminó `flex-wrap: wrap` que lo desplazaba al centro
- **Móvil botón guardar**: "Guardar cambios" en Ajustes es ancho completo en pantallas pequeñas

---

## [11.9] - 2026-05-07

### Fix UI: topbar, formularios usuarios, admin y ajustes

- **Topbar**: botón "+ Nuevo" alineado al extremo derecho, misma altura que el ícono hamburger
- **Usuarios**: fix — los formularios "Editar nombre" y "Cambiar contraseña" ahora se mantienen ocultos hasta hacer clic en el botón correspondiente (CSS `display:grid` sobreescribía el atributo `hidden`)
- **Admin/Tickets**: eliminado el accordion "Cambiar contraseña" — está disponible en Configuración → Usuarios
- **Ajustes**: eliminado el botón "Volver" del pie, queda solo "Guardar cambios"

---

## [11.8] - 2026-05-07

### UI: sidebar, ajustes, portal y usuarios

- **Sidebar**: botón "Salir" movido al panel inferior del sidebar con icono; nombre de usuario visible ahí mismo
- **Topbar**: botón "+ Crear ticket" renombrado a "+ Nuevo", barra más compacta
- **Tablero**: botón "Mostrar cerrados" simplificado a "Cerrados"
- **Ajustes**: botones "Guardar cambios" y "Volver" movidos al pie de la página (fuera del encabezado)
- **Placeholders**: color mucho más tenue en todos los campos de la app y del portal público
- **Portal público**: paleta actualizada a morado/rosa (igual que la app interna)
- **Usuarios**: nuevo botón "Editar nombre" por usuario para renombrar sin recrear
- **Contraseñas**: confirmación doble al crear usuario y al cambiar contraseña desde la lista
- **Tabs de ajustes (escritorio)**: tamaño de botones reducido para evitar scroll horizontal
- **API**: endpoint `PATCH /api/users/:username` para renombrar usuarios

---

## [11.7] - 2026-05-07

### Fix definitivo en código: datos en home del usuario, sin configuración de servidor

- `STORE_PATH` por defecto cambiado de `./data/neurodesk.json` (dentro del proyecto) a `~/.neurodesk/data.json` (home del usuario del servidor)
- En cPanel: los datos quedan en `/home/tu_usuario/.neurodesk/data.json` — fuera del proyecto, intocable por git
- El directorio `~/.neurodesk/` se crea automáticamente al arrancar si no existe
- Sin variables de entorno ni configuración adicional requerida
- `ecosystem.config.js` simplificado (ya no necesita `ND_STORE_PATH` hardcodeado)

**Migración automática al hacer git pull + reiniciar:** el servidor arranca con la nueva ruta y crea el archivo vacío si no existe. La primera vez que configures el correo se guardará en la nueva ubicación permanente.

---

## [11.6] - 2026-05-07

### Fix definitivo: datos de producción fuera del directorio del proyecto

#### Causa raíz identificada

`data/neurodesk.json` vivía dentro del proyecto — cualquier `git clean -fd`, re-clone o script de deploy que limpie la carpeta lo destruía silenciosamente.

#### Cambios

- `ecosystem.config.js` (nuevo): configuración de PM2 con `ND_STORE_PATH=/var/lib/neurodesk/data.json` — los datos quedan en una ruta que git nunca toca
- `CLAUDE.md` actualizado: instrucciones de migración única y flujo de deploy seguro documentados

#### Migración requerida en el servidor (una sola vez)

```bash
sudo mkdir -p /var/lib/neurodesk && sudo chown $USER:$USER /var/lib/neurodesk
cp data/neurodesk.json /var/lib/neurodesk/data.json 2>/dev/null || true
pm2 start ecosystem.config.js   # o: pm2 restart neurodesk --update-env
```

---

## [11.5] - 2026-05-07

### Gestión de usuarios, versión en login y seguridad

#### Gestión de usuarios (Ajustes → Usuarios)

- Nueva pestaña "Usuarios" en el panel de configuración
- Lista todos los usuarios activos con avatar de inicial
- **Crear usuario**: formulario con usuario + contraseña (validación mínimo 2/4 chars, solo alfanumérico)
- **Cambiar contraseña**: formulario inline expandible por usuario, sin salir de la vista
- **Eliminar usuario**: con confirmación; protecciones: no se puede eliminar el propio usuario ni el último existente
- El usuario activo aparece marcado con etiqueta "tú"
- Nuevos endpoints: `GET /api/users`, `POST /api/users`, `DELETE /api/users/:username`, `PUT /api/users/:username/password`

#### Login

- Versión de la app visible en la esquina inferior derecha del login (texto gris pequeño, no interactivo)
- Se obtiene dinámicamente de `/api/version`

#### Seguridad — Rate limiting en login

- Máximo 10 intentos fallidos por IP en ventana de 15 minutos
- Responde `429 Too Many Requests` al sobrepasar el límite
- El contador se resetea automáticamente tras un login exitoso
- Soporta `X-Forwarded-For` para detectar IP real detrás de nginx/proxy

---

## [11.4] - 2026-05-07

### Layout — corrección overflow en 1024×768 y aprovechamiento de pantallas grandes

#### Problema raíz corregido

La fórmula de ancho del `.shell` usaba `calc(100% - 32px)` (≈ ancho viewport completo) ignorando los 232px del sidebar. En 1024px el total era **1240px → 216px fuera de pantalla**.

#### Cambios

- `.shell` y `.ticketDetailOverlay`: fórmula corregida a `calc(100vw - 232px - 32px)` (sidebar expandido) y `calc(100vw - 56px - 32px)` (sidebar colapsado)
- Ancho máximo de contenido aumentado de **1300px → 1600px**: en monitores 1440p y 1920p el contenido aprovecha más espacio horizontal
- Fórmulas de centrado actualizadas (1548 → 1848 con sidebar, 1372 → 1672 sin sidebar)

#### Resultado por resolución

| Resolución | Sidebar          | Contenido antes   | Contenido ahora |
| ---------- | ---------------- | ----------------- | --------------- |
| 1024×768   | Colapsado (auto) | ~992px → overflow | 936px ✅        |
| 1440p      | Colapsado        | 1300px            | 1352px ✅       |
| 1920p      | Expandido        | 1300px            | 1600px ✅       |

---

## [11.3] - 2026-05-07

### Protección de datos y responsive ajustes

#### Protección de datos de producción

- `.gitignore` actualizado: ahora ignora `data/` completo (antes solo `.sqlite`). Esto garantiza que `neurodesk.json` (tickets, email config, configuración) **nunca sea sobreescrito ni eliminado por operaciones de git** en el servidor de producción.

#### Configuración — Mobile (≤768px)

- Tab bar de ajustes: reemplazado scroll horizontal por grilla 2×2. Todos los tabs son visibles sin deslizar: [Tiempos SLA] [Formulario] / [Portal público] [Correo entrante] / [Notificaciones] (ancho completo al ser impar)
- Campos de formulario: ancho 100%, padding de toque cómodo (10px), font-size 0.938rem
- Botones de acción dentro del form: apilados verticalmente, ancho completo
- Panel de cada tab: padding lateral reducido a 16px para mejor uso del espacio

---

## [11.2] - 2026-05-07

### Responsive móvil — Detalle de ticket

#### Layout vertical en mobile (≤768px)

- Detalle de ticket rediseñado para mobile: layout ahora es columna única en lugar de la vista dividida izquierda/derecha del escritorio
- Orden de secciones en mobile: descripción del ticket → textarea de gestión → historial → información del ticket → botones de acción
- Descripción y textarea ocupan el 100% del ancho disponible
- Historial ordenado de más reciente a más antiguo en todas las pantallas
- Avatar centrado en la sección de propiedades del ticket
- Botones (Guardar, Marcar resuelto, Cerrar ticket) ocupan el 100% del ancho, centrados y con padding inferior de 32px para evitar el área segura de iOS
- Añadido `-webkit-overflow-scrolling: touch` al overlay para scroll fluido en iOS Safari

---

## [11.1] - 2026-05-06

### Correcciones y ajustes de UI

#### Notificaciones

- Corregido: cambio de estado vía drag-and-drop no enviaba notificación — ahora `updateTicketPosition` detecta cambio de estado y dispara `status_changed` / `resolved` según corresponda

#### Header

- Eliminado borde gradiente morado/rosa en la parte superior del topbar

#### Responsive móvil

- Tarjetas de métricas: grilla 2×2 mantenida en todos los tamaños de pantalla (antes colapsaba a 1 columna en <480px)
- Botones del tablero (Tarjetas / Lista / Mostrar cerrados): ahora tienen el mismo tamaño, mismo espaciado y están alineados en una sola fila

---

## [11.0] - 2026-05-06

### Rediseño visual completo — UI/UX overhaul + responsividad

#### Paleta morado/rosa

- Reemplazada paleta roja (`#c82032`) por morado/rosa degradado (`#7c3aed → #db2777`)
- Nueva variable `--brand-gradient` usada en botones primarios, acento del topbar y tarjetas de métricas
- Sidebar: ícono de marca ahora usa el degradado; ítem activo en morado
- Todos los focus rings y sombras actualizados a morado

#### Header compacto

- Topbar reducido en altura (padding 8px vs 12px anterior)
- Borde izquierdo rojo eliminado; reemplazado por franja superior degradada morado/rosa
- H1 más compacto (`1.1rem` fijo)

#### Métricas rediseñadas (4 cards planas)

- Eliminados 3 donuts circulares; reemplazados por 4 stat cards rectangulares
- Cards: Tickets activos · SLA vencido · Cumplimiento SLA · Resueltos hoy
- Acento de 3px de color en la parte superior de cada card (morado/rojo/verde según tipo)
- "Resueltos hoy" calculado en tiempo real desde `cachedTickets` usando `resolvedAt`
- Grid responsivo: 4 columnas desktop → 2×2 tablet → 1 columna mobile pequeño

#### Sidebar responsivo

- Tablet (769–1024px): se contrae automáticamente al iniciar
- Al hacer hover sobre el sidebar colapsado en tablet, se expande con overlay sin mover el contenido
- Mobile (<768px): comportamiento drawer existente sin cambios

#### Responsividad general

- Todos los botones primarios usan `var(--brand-gradient)` (morado→rosa)
- Toggle activo usa degradado
- Stat cards responsivas en breakpoints 900px, 540px y 480px

## [10.1] - 2026-05-06

### Fix: layout del detalle de ticket en viewports intermedios

- **Bug crítico corregido**: el panel derecho (`ticketProperties`) salía del viewport en pantallas de ~1350px porque el cálculo de ancho del overlay no restaba el ancho del sidebar
- `.ticketDetailOverlay` ahora usa `width: min(1300px, calc(100vw - 232px - 32px))` en lugar de `calc(100% - 32px)`, restando correctamente los 232px del sidebar
- `body.sidebarCollapsed .ticketDetailOverlay` ahora incluye `width: min(1300px, calc(100vw - 56px - 32px))` para el sidebar colapsado (56px)
- El breakpoint de colapso a columna única del layout del detalle se movió de 900px → 1024px (tablet y ventanas reducidas), cumpliendo el requerimiento: >1024px = dos columnas, 768–1024px = columna única, <768px = pantalla completa

---

## [10.0] - 2026-05-06

### Notificaciones por correo, tickets cerrados y diseño responsive

#### Feature 1 — Notificaciones por correo saliente (SMTP)

- **Confirmación al crear ticket**: se envía correo automático al solicitante y a los admins cuando se crea un nuevo ticket
- **Cambio de estado**: correo automático al usuario y admins cada vez que un ticket cambia de estado
- **Ticket resuelto**: correo específico al marcar como "resuelto", con resumen de la resolución
- **Cierre automático a las 24h**: tickets en estado "resuelto" se cierran automáticamente a las 24 horas (scheduler `setInterval` cada 10 min + historial automático)
- **Correos de admin**: copia de todas las notificaciones al(los) correo(s) configurado(s) en ajustes
- Usa **nodemailer** (SMTP puro, sin dependencias nativas); errores se loguean y no crashean la app

#### Feature 2 — Ocultar tickets cerrados por defecto

- El tablero Kanban y la vista de lista ya **no muestran tickets cerrados** por defecto
- Nuevo botón **"Mostrar cerrados"** en las herramientas del tablero para activar/desactivar su visibilidad
- La columna "Cerrado" del Kanban también se oculta cuando no están visibles
- El panel de administración sigue mostrando todos los tickets (incluso cerrados) para auditoría

#### Feature 3 — Panel de configuración de notificaciones

- Nueva pestaña **"Notificaciones"** en Ajustes con:
  - Configuración SMTP completa (host, puerto, SSL, usuario, contraseña, remitente)
  - Lista de correos de administradores (comma-separated)
  - Editor de plantillas para los 3 tipos de notificación (recibido, cambio de estado, resuelto)
  - **Vista previa en tiempo real** con datos de muestra mientras se edita
  - Botón **"Restaurar por defecto"** por plantilla
  - Botón **"Enviar prueba"** que envía la plantilla al primer correo admin configurado
  - Variables soportadas: `{{ticket_id}}`, `{{ticket_title}}`, `{{user_name}}`, `{{user_email}}`, `{{old_status}}`, `{{new_status}}`, `{{agent_name}}`, `{{resolution_notes}}`

#### Feature 4 — Responsive móvil mejorado

- **Targets táctiles**: todos los botones tienen mínimo 44×44 px en móvil
- **Tamaño de fuente mínimo 14px** en pantallas < 768px (corregidos badges, meta info, columnas kanban)
- **Kanban en móvil**: tarjetas al 80% del viewport con scroll horizontal natural
- **Ticket detail**: pasa a pantalla completa en móvil (position fixed, inset 0)
- **Breakpoint 480px**: board tools y admin filters colapsan a columna única
- Estilo nuevo para columna/pill "Cerrado" en kanban y tabla de admin
- Nuevos estilos para el editor de plantillas y la vista previa

#### Nuevos endpoints API

- `GET /api/notifications/config` — configuración SMTP + plantillas
- `PUT /api/notifications/config` — guardar configuración
- `POST /api/notifications/test` — enviar correo de prueba

#### Variables de entorno para SMTP (se configuran en la UI, no se requieren en env)

- Se recomienda configurar vía la pestaña "Notificaciones" en Ajustes

---

## [9.4] - 2026-05-05

### Responsive real + rediseño portal

- **Topbar mobile corregido**: el topbar ya no se convierte en `display: grid` en mobile — mantiene layout flex con hamburger + título + acciones en una línea
- **Shell con padding horizontal**: `padding: 12px` en mobile (antes `0`); `overflow-x: clip` para evitar desbordamiento
- **Topbar compacto en mobile**: se ocultan `.eyebrow`, `.version` y `.userName`; h1 reducido a 1rem; `topBarRight` ocupa el espacio restante con `flex: 1`
- **ticketDetailOverlay en mobile**: ahora es full-width sin márgenes laterales
- **Portal rediseñado** (`/portal`):
  - Layout split 2 columnas en desktop (≥860px): panel izquierdo oscuro con branding + features, panel derecho con formulario
  - Mobile: panel izquierdo oculto, header sticky con logo ND, formulario full-screen blanco sin bordes
  - Logo "ND" en lugar de "N"
  - Diseño oscuro en el panel izquierdo (gradiente `#1e293b → #200e14`)

---

## [9.3] - 2026-05-05

### Responsive y sidebar compacto

- **Sidebar compacto**: items reducidos a una sola línea (min-height 34px, padding 5px), fuente 0.835rem, iconos SVG 18×18
- **Off-canvas drawer móvil**: en pantallas ≤768px el sidebar se oculta fuera de pantalla (`translateX(-100%)`) y se despliega con el botón hamburguesa; overlay semitransparente cierra el menú al tocar fuera
- **Hamburger button** (`#mobileMenuButton`) visible solo en mobile, integrado en el topbar
- **Shell full-width en móvil**: `margin-left: 0; width: 100%` en ≤768px — no hay espacio reservado para sidebar
- **Breakpoints actualizados**: 768px (mobile), 540px (small), 900px (tablet) en lugar del esquema anterior; todos los bloques de admin y settings alineados al mismo breakpoint
- **`sidebarCollapsed` en móvil**: la clase no colapsa el sidebar a 56px en mobile, simplemente mantiene el drawer cerrado (no hay mini-sidebar en pantallas pequeñas)

---

## [9.2] - 2026-05-05

### Tooling, tests y rediseño UI

- **ESLint 10** configurado (`eslint.config.cjs`) con reglas Node.js + globals de Jest para archivos de test
- **Prettier 3** configurado (`.prettierrc`) con `npm run format`; todos los archivos fuente formateados
- **Jest 30 + Supertest 7**: 14 tests de API en `tests/api.test.js` (endpoints públicos, auth, creación y actualización de tickets)
- `server.js` patched para testabilidad: DB configurable vía `ND_DB_PATH`, email poller deshabilitable con `ND_TEST=1`, exporta `server` y solo escucha cuando es el módulo principal
- **UI**: corrección de nombres ("Neurodex"→"NeuroDesk", "Neurofix"→"NeuroDesk"), iconos de sidebar reemplazados por SVG limpios
- **CSS**: bug de variables `var(--border)` y `var(--surface)` corregidos a `var(--line)` y `var(--soft)`; brand icon cambiado de verde a gradiente rojo de marca ("ND"); sidebar activo con estado visual de color de marca; bulk action bar rediseñada en oscuro; tipografía y espaciados refinados

---

## [9.1] - 2026-05-05

### Campos personalizados en creacion de tickets

- Los campos personalizados configurados ahora aparecen tambien en el formulario interno de creacion
- Los valores capturados se guardan en el ticket y se muestran luego en la vista de detalle
- Version visible actualizada a `9.1`

---

## [9.0] - 2026-05-05

### Detalle profesional de tickets, sidebar y sincronizacion IMAP segura

- Nuevo menu lateral izquierdo colapsable con accesos a Panel, Tickets, Indicadores y Configuracion
- La lista de tickets muestra el asunto y permite abrir cada ticket en una vista de detalle a pantalla completa
- La vista de detalle permite revisar descripcion, propiedades, campos personalizados y nota de resolucion
- Se agrega estado `Cerrado` y se exige nota de lo realizado al resolver o cerrar desde el detalle
- Se agrega boton de eliminar directamente en tarjetas/lista para borrar tickets basura o pruebas
- Configuracion de formulario ahora permite crear campos personalizados simples de texto o lista
- El sondeo IMAP marca como leidos los correos procesados y registra sus `Message-ID` para evitar duplicados
- Se agregan remitentes ignorados para filtrar mensajes automaticos como alertas de Google
- Version visible actualizada a `9.0`

---

## [8.0] - 2026-05-05

### Diagnostico IMAP y panel inicial compacto

- "Sondear ahora" fuerza una revision del buzon aunque el sondeo automatico este desactivado
- El backend registra ultimo sondeo, mensajes revisados y errores cuando falta activar o completar la configuracion de correo
- Al probar la conexion IMAP correctamente se activa el switch de sondeo para evitar guardar una cuenta conectada pero apagada
- El resultado manual ahora informa mensajes revisados y tickets creados
- El tablero inicial adopta tarjetas compactas de indicadores y un panel de informacion con accesos a Admin, SLA y Configuracion
- La barra superior queda enfocada en el boton principal "+ Crear ticket"
- Version visible actualizada a `8.0`

---

## [7.7] - 2026-05-05

### Tickets en vivo + correo entrante mas confiable

- El panel interno ahora escucha `/api/events` con Server-Sent Events y refresca tickets/estadisticas cuando se crea, edita, mueve o elimina un ticket
- Se agrega refresco automatico de respaldo cada 15 segundos para no depender de recargar la pagina
- El sondeo IMAP ya no depende solo de correos no leidos: tambien revisa mensajes recientes desde la conexion del buzon para convertir correos ya marcados como leidos
- El estado de Correo entrante muestra "Mensajes revisados" para diagnosticar si el sondeo esta encontrando mensajes aunque no cree tickets
- Los tickets creados desde webhook `/api/email/inbound` ahora conservan asunto y descripcion si llegan en el payload
- Version visible actualizada a `7.7`

---

## [7.6] - 2026-05-05

### Toggle ojo en todos los campos de contraseña

- Ícono SVG de ojo abierto / cerrado (sin emojis) en todos los campos password
- Campos cubiertos: login, correo entrante, cambiar contraseña (actual, nueva, confirmar)
- Función `initPasswordToggle` reutilizable para inicializar cualquier campo
- Estilos `.passwordWrapper` y `.eyeBtn` aplicados también en login.html

---

## [7.5] - 2026-05-05

### Ojito en contraseña + limpieza de espacios App Password

- Botón 👁/🙈 en el campo Contraseña del tab Correo entrante para ver/ocultar
- Los espacios del App Password de Google (ej. `medz aopx eeuk vbzq`) se eliminan automáticamente antes de enviarse a IMAP — Google los muestra con espacios por legibilidad pero IMAP los requiere sin ellos

---

## [7.4] - 2026-05-05

### Portal con campos Asunto y Descripción + mensajes IMAP claros

- Portal público (`/portal`) ahora incluye campos "Asunto" y "Descripción" en el formulario
- Textarea con estilos correctos en el portal (resize vertical, foco con ring de marca)
- Error IMAP "Command failed" reemplazado por mensajes explicativos:
  - Credenciales incorrectas → instrucciones de App Password para Gmail
  - Fallo de conexión → indica host y puerto problemáticos
  - Error SSL → sugiere desactivar SSL

---

## [7.3] - 2026-05-05

### Fix: ReferenceError emailPollerTimer antes de inicialización

- Las variables `emailConfig`, `emailPollStatus` y `emailPollerTimer` se declaraban después del bloque `Init` que llama a `startEmailPoller()`
- `let` no se eleva (temporal dead zone) causando `ReferenceError: Cannot access 'emailPollerTimer' before initialization`
- Se mueven las tres declaraciones a la sección de Config defaults, antes de los prepared statements y del bloque Init

---

## [7.2] - 2026-05-05

### Fix: error "no such column: subject" al iniciar servidor

- Las migraciones de columnas (`subject`, `description`, `contact`) ahora se ejecutan en un bloque IIFE inmediatamente después de `CREATE TABLE`, antes de que SQLite compile los prepared statements
- Corrige `ERR_SQLITE_ERROR: SQL logic error — no such column: subject` en Node 24

---

## [7.1] - 2026-05-05

### Campos Asunto y Descripción en tickets

- Nuevos campos `subject` (asunto) y `description` (descripción) en todos los tickets
- Aparecen en el formulario de creación y en el modal de edición
- El asunto se muestra como línea secundaria en las tarjetas kanban
- El poller IMAP mapea: subject del correo → asunto, cuerpo del mensaje → descripción, nombre del remitente → nombre
- Migración automática de BD con `ALTER TABLE` — no se pierden tickets existentes
- Textarea con estilos consistentes (borde de foco con ring de marca)

---

## [7.0] - 2026-05-05

### Correo entrante vía IMAP

- Sondeo automático de buzón IMAP (configurable, por defecto cada 5 min)
- Nuevo tab "Correo entrante" en Ajustes con formulario completo: host, puerto, SSL, usuario, contraseña, carpeta, intervalo, área y urgencia por defecto
- Botón "Probar conexión" que verifica las credenciales antes de guardar
- Botón "Sondear ahora" para forzar una revisión manual desde la UI
- Panel de estado del sondeo: último sondeo, último error, tickets creados en total
- Detección automática de urgencia por palabras clave en asunto y cuerpo del correo
- Deduplicación por `Message-ID` en tabla `processed_emails`; limpieza automática tras 90 días
- Tickets creados desde correo tienen `source = "email"` y el remitente como contacto
- Dependencias añadidas: `imapflow`, `mailparser`
- Endpoints nuevos: `GET/PUT /api/email/config`, `POST /api/email/test`, `POST /api/email/poll`, `GET /api/email/status`

---

## [6.0] - 2026-05-05 · commit `bd59d8d`

### Autenticación de equipo + pantalla de administración

**Autenticación:**

- Login en `/login` con usuario y contraseña (sesión cookie HttpOnly, 24 h)
- Todas las rutas del panel interno protegidas — `/portal` y la API pública siguen siendo accesibles sin sesión
- Usuario inicial: `admin` / `neurofic` (mostrado en consola al primer arranque)
- Tabla `users` en SQLite con hash SHA-256 + salt por usuario
- Cambio de contraseña desde la pantalla Admin (acordeón al fondo)
- Endpoint: `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`, `POST /api/auth/password`
- Nombre de usuario visible en topbar con botón "Salir"

**Pantalla de administración:**

- Vista "Admin" accesible desde el topbar
- Tabla completa de todos los tickets con filtros: búsqueda libre, rango de fechas, estado, urgencia
- Barra de resumen con conteo por estado (coloreado)
- Status pills con color por estado (azul/ámbar/morado/verde)
- Eliminar ticket individual con confirmación
- Selección múltiple + eliminar en lote
- Exportar CSV con BOM para apertura correcta en Excel
- Botón ✎ para editar desde la tabla de admin
- Endpoint: `DELETE /api/tickets/:id`, `DELETE /api/tickets` (bulk)

---

## [5.0] - 2026-05-05 · commit `6c3a371`

### Rediseño visual completo + log de versión

- Fondo con gradiente suave (tintes de marca y azul)
- Topbar con tinte de color de marca y versión visible como badge pill
- Columnas kanban con encabezados coloreados por estado: azul (Abierto), ámbar (En proceso), morado (En espera), verde (Resuelto)
- Borde izquierdo de tickets en el color de su urgencia: gris (baja), azul (media), ámbar (alta), rojo (crítica)
- Badges de urgencia con paleta propia para los 4 niveles
- Barras de distribución SLA coloreadas por urgencia y estado
- Hover con elevación suave en cards, donuts y métricas
- Inputs con estado de foco mejorado (ring de marca)
- Startup log del servidor incluye versión: `NeuroDesk v5.0 listo en ...`
- Esquema de versiones cambiado de `0.x.0` a `x.0`

---

## [0.4.0] - 2026-05-05 · commit `458f2f6`

### Agregado

- **Edición de tickets**: botón "✎ Editar" en tarjetas kanban y filas de lista. Abre modal animado para editar nombre, contacto, área, urgencia y estado. Nuevo endpoint `PATCH /api/tickets/:id`.
- **Acciones masivas**: columna de checkboxes en vista lista con selección individual, "seleccionar todos" y barra flotante en la base de pantalla para cambio de estado masivo.
- **Configuración SLA**: vista de ajustes con inputs para horas máximas por nivel de urgencia (baja/media/alta/crítica), tres presets (Estándar / Relajado / Exigente) y persistencia en SQLite. Nuevos endpoints `GET /api/config` y `PUT /api/config`.
- **Configuración de formulario**: pestaña en ajustes para activar/desactivar y renombrar campos "Contacto" y "Área" en el formulario de creación y portal público.
- **Portal público**: página `/portal` standalone (`portal.html`) con diseño de mesa de ayuda para clientes finales — sin acceso al panel interno. Respeta la configuración de campos. Muestra número de ticket en estado de éxito.
- **Vista de ajustes**: nueva vista con tres pestañas (Tiempos SLA / Formulario / Portal público), accesible desde el botón ⚙ Ajustes en la topbar.
- Se agrega tabla `config` en SQLite con `deepMerge` para evolución segura del esquema.
- Se actualiza la versión visible a `0.4.0`.

### Cambiado

- `urgencySlaHours` se reemplaza por `appConfig.sla` en el servidor — los tiempos de SLA son ahora dinámicos desde la configuración.
- `normalizeTicket` hace el campo `contact` opcional (era requerido) para soportar tickets desde portal cuando el campo está deshabilitado.
- Modal con animación `scale + fadeIn` y cierre via Escape, clic en overlay o botón.
- Barra de acciones masivas: animación de entrada, diseño oscuro flotante, se limpia al cambiar de vista o de modo de visualización.

## [0.3.1] - 2026-05-04

### Cambiado

- Se reemplaza la franja de métricas inicial por tres gráficas de dona a pantalla completa como visor de salud operativa.
- La dona de Adherencia SLA cambia de color dinámicamente: verde ≥80 %, ámbar ≥50 %, rojo <50 %.
- La dona de Tickets activos se llena según la proporción de tickets activos vs. resueltos.
- La dona de SLA vencido se llena según la tasa de incumplimiento (vencidos / activos).
- Se elimina la duplicidad de barras de estado y urgencia del overview (quedan únicamente en la vista SLA).
- Se renueva la paleta de colores: fondo azul-gris sutil, tarjetas blancas con sombras refinadas, tipografía más contrastada.
- Se actualiza el header: tamaño del título reducido, sin degradado pesado, con borde izquierdo rojo como acento de marca.
- Se mejora la responsividad en tres breakpoints (900 px, 760 px, 480 px): donuts se ajustan en tamaño y en móvil (<480 px) el layout pasa a columna única con las donuts en disposición horizontal.
- Se oculta el número de versión del header para reducir ruido visual.
- Se actualiza la versión visible de la app a `0.3.1`.

## [0.3.0] - 2026-05-05

### Agregado

- Se agrega panel avanzado de filtros SLA por fecha, estado, area, urgencia, estado SLA, tiempo restante y busqueda.
- Se agrega tabla de detalle filtrado para analisis SLA.
- Se agrega exportacion imprimible a PDF para reportes de junta.
- Se cargan tickets de prueba locales para validar el flujo operativo.

### Cambiado

- Se limpia la pantalla inicial para mostrar solo los indicadores mas importantes y graficas compactas.
- Se actualiza la version visible de la app a `0.3.0`.

## [0.2.1] - 2026-05-05

### Cambiado

- Se compactan las graficas iniciales en una franja superior tipo mini dashboard.
- Se reduce el alto de las tarjetas de metricas para que el tablero gane protagonismo.
- El tablero ahora limpia la vista no seleccionada para mostrar solo tarjetas o solo lista.
- Se actualiza la version visible de la app a `0.2.1`.

## [0.2.0] - 2026-05-05

### Agregado

- Se agrega contacto como dato obligatorio del ticket.
- Se agrega migracion local SQLite para incorporar `contact` sin perder tickets existentes.
- Se agrega vista inicial basada en graficas para revisar el estado de SLA al abrir la app.
- Se agrega vista exclusiva de estadisticas SLA.
- Se agrega modo de tablero en tarjetas o lista para mejorar efectividad operativa.
- Se agrega filtro de estado dentro del tablero.

### Cambiado

- Se reorganiza la navegacion para dejar como acciones principales `Crear ticket` y `SLA`.
- Se mueve la creacion de tickets a una vista dedicada.
- Se limpian los controles del Kanban para que vivan dentro del tablero.
- Se actualiza la version visible de la app a `0.2.0`.

## [0.1.4] - 2026-05-04

### Agregado

- Se agrega dashboard visual con metricas de SLA, vencidos y distribucion por estado.
- Se agrega menu de navegacion para ordenar Dashboard, Kanban y Nuevo ticket.
- Se agrega Kanban con columnas por estado y tarjetas arrastrables.
- Se agrega selector de estado dentro de cada tarjeta como alternativa para pantallas tactiles.
- Se agrega endpoint para actualizar el estado de un ticket.

### Cambiado

- Se actualiza la identidad visual a rojo corporativo con degradados a gris.
- La API ahora calcula tickets activos como todos los no resueltos.
- Se actualiza la version visible de la app a `0.1.4`.

## [0.1.3] - 2026-05-04

### Agregado

- Se agrega base de datos local SQLite en `data/neurodesk.sqlite`.
- Se agrega persistencia de tickets para que no se pierdan al reiniciar el servidor.
- Se ignora la base de datos local en Git para evitar subir datos operativos al repositorio.

### Cambiado

- La API ahora lista, crea y calcula estadisticas desde SQLite.
- Se actualiza la version visible de la app a `0.1.3`.

## [0.1.2] - 2026-05-04

### Agregado

- Se crea `CHANGELOG.md` como registro oficial de versiones y cambios.
- Se documenta el historial inicial del proyecto para trazabilidad.

### Cambiado

- Se actualiza la version visible de la app a `0.1.2`.

## [0.1.1] - 2026-05-04

### Agregado

- Se muestra la version de la aplicacion debajo del titulo principal.
- Se agrega el endpoint `GET /api/version`.

## [0.1.0] - 2026-05-04

### Agregado

- Se crea la estructura inicial del proyecto NeuroDesk.
- Se agrega servidor web con Node.js sin dependencias externas.
- Se agrega API inicial para tickets, estadisticas SLA y correo entrante.
- Se agrega interfaz responsive para crear tickets con nombre, area y urgencia.
- Se agrega README con instrucciones de uso y siguientes pasos.
