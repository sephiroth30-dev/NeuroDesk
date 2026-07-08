# NeuroDesk — Reglas de Producción

**Versión actual en producción: v14.31**

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

## Antes de cada entrega, verificar

- [ ] ¿El cambio modifica o reinicializa `data/neurodesk.json`?
- [ ] ¿Se sobrescribe alguna clave de config con valores de ejemplo?
- [ ] ¿Se requiere reconfigurar Gmail o App Password para que funcione?
- [ ] ¿El `.gitignore` sigue ignorando `data/` completo?
- [ ] ¿Los nuevos defaults usan merge (no replace) sobre la config existente?

Si alguna respuesta es **sí**, replantear el enfoque antes de entregar.
