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
- `GET /api/stats`: devuelve métricas básicas.
- `POST /api/email/inbound`: punto inicial para integrar creación desde correo.

## Datos mínimos del ticket

- `name`: nombre del solicitante.
- `area`: área relacionada.
- `urgency`: `baja`, `media`, `alta` o `critica`.

## Próximos pasos sugeridos

1. Conectar un proveedor de correo entrante.
2. Definir reglas SLA reales por área y urgencia.
3. Agregar autenticación para el equipo interno.
4. Crear pantalla de administracion de tickets.
