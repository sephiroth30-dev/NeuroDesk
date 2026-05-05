# Changelog

Todas las versiones importantes de NeuroDesk quedaran documentadas en este archivo.

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
