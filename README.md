# NeuroDesk

Mesa de soporte web minimalista para Neurofic.

## Inicio

```bash
npm start
```

Luego abre:

```text
http://localhost:3000
```

## Estructura inicial

- `server.js`: servidor web y API REST sin dependencias externas.
- `data/neurodesk.sqlite`: base de datos local SQLite creada automaticamente al iniciar.
- `public/index.html`: interfaz responsive para crear y ver tickets.
- `public/styles.css`: estilos minimalistas.
- `public/app.js`: consumo de API, creación de tickets y estadísticas.

## API inicial

- `GET /api/tickets`: lista tickets con estado de SLA.
- `POST /api/tickets`: crea ticket desde la web.
- `PATCH /api/tickets/:id/status`: actualiza el estado de un ticket.
- `GET /api/stats`: devuelve métricas básicas.
- `POST /api/email/inbound`: punto inicial para integrar creación desde correo.

## SLA y reportes

- La pantalla inicial muestra indicadores resumidos para lectura rápida.
- La vista `SLA` permite filtrar por fechas, estado, area, urgencia, vencimiento, tiempo restante y busqueda.
- El boton `Exportar PDF` abre la impresion del navegador con el reporte SLA listo para guardar como PDF.

## Datos mínimos del ticket

- `name`: nombre del solicitante.
- `contact`: correo o telefono de contacto.
- `area`: área relacionada.
- `urgency`: `baja`, `media`, `alta` o `critica`.

## Versionado

NeuroDesk usa versiones `estructura.funcional.estetica`.

- Primer digito: cambios criticos, estructurales o de arquitectura.
- Segundo digito: nuevas funcionalidades o cambios de flujo.
- Tercer digito: ajustes visuales, pulido y cambios esteticos.

Toda version se documenta en `CHANGELOG.md`, se confirma en Git local y se sube a GitHub.

## Estados del ticket

- `abierto`
- `en_proceso`
- `en_espera`
- `resuelto`

## Próximos pasos sugeridos

1. Conectar un proveedor de correo entrante.
2. Definir reglas SLA reales por área y urgencia.
3. Agregar autenticación para el equipo interno.
4. Crear pantalla de administracion de tickets.
