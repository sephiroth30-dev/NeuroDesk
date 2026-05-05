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
