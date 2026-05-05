# Changelog

Todas las versiones importantes de NeuroDesk quedaran documentadas en este archivo.

## [0.4.0] - 2026-05-05

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

## Regla de versionado

NeuroDesk usa versiones `estructura.funcional.estetica`.

- Primer digito: cambios criticos, estructurales o de arquitectura.
- Segundo digito: nuevas funcionalidades o cambios de flujo.
- Tercer digito: ajustes visuales, pulido y cambios esteticos.

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
