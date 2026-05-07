# NeuroDesk — Reglas de Producción

## ⚠️ ESTE PROYECTO ESTÁ EN PRODUCCIÓN

Desplegado en **soporte.easystem.co** con datos reales. Cualquier cambio debe ser **no destructivo**.

---

## Almacenamiento de datos — NUNCA tocar `data/`

El servidor usa **`data/neurodesk.json`** como base de datos (no SQLite). Este archivo contiene:

- Todos los tickets abiertos y cerrados
- Configuración de correo entrante (SMTP/IMAP + App Password de Gmail)
- Configuración de notificaciones
- Configuración de SLA y campos
- Usuarios y sesiones

**Reglas absolutas:**

- **NO** borrar, sobreescribir ni reinicializar `data/neurodesk.json`
- **NO** commitear archivos dentro de `data/` (está en `.gitignore` completo)
- **NO** hacer `rm -rf data/` ni `git clean -fd` en el servidor de producción
- **NO** cambiar `STORE_PATH` ni la ruta del archivo de datos sin migrar primero

Si el servidor arranca sin `data/neurodesk.json`, arranca **con cero datos** — todos los tickets y configuración se pierden.

---

## Configuración guardada — NO sobrescribir con defaults

Las siguientes claves en `store.config` contienen datos ingresados manualmente por el usuario:

- `email_config` — host IMAP, App Password de Gmail, carpeta, intervalo de polling
- `notifications_config` — SMTP de salida, emails de admin, plantillas de notificación
- `app_config` — SLA por urgencia, campos habilitados, campos personalizados

**Regla:** en `loadStore()`, los defaults solo se aplican si la clave no existe. Si se agregan nuevas claves a los defaults, usar `Object.assign({}, DEFAULT, existingConfig)` (existing tiene precedencia), nunca reemplazar el objeto completo.

---

## Archivos protegidos — no modificar sin pedido explícito

| Archivo/Carpeta           | Razón                                                     |
| ------------------------- | --------------------------------------------------------- |
| `data/neurodesk.json`     | Base de datos de producción (tickets + config + usuarios) |
| `data/` (toda la carpeta) | Ignorada en git — nunca subir ni borrar                   |
| `.env` (si existe)        | Variables de entorno con credenciales                     |

---

## Estrategia de cambios seguros

1. **Cambios en `server.js`**: modificar lógica, rutas y endpoints
2. **Cambios de UI**: modificar `public/app.js`, `public/styles.css`, `public/index.html` libremente
3. **Nuevos campos en el store**: agregar con `?? defaultValue` — nunca reemplazar la estructura raíz
4. **Nuevas claves de config**: usar `deepMerge(DEFAULT, existing)` para que existing siempre gane
5. **Seeds / datos de prueba**: nunca en producción; detrás de `NODE_ENV=development`

---

## Deploy seguro en soporte.easystem.co

### Causa raíz de pérdidas de datos

`data/neurodesk.json` vive dentro del directorio del proyecto. Cualquier `git clean -fd`, re-clone o script de deploy que limpie la carpeta lo destruye.

### Solución permanente: ND_STORE_PATH fuera del proyecto

El archivo `ecosystem.config.js` apunta los datos a `/var/lib/neurodesk/data.json`.
Esa ruta nunca es tocada por git ni por deploys.

### Migración única (ejecutar en el servidor una sola vez)

```bash
# 1. Crear el directorio de datos fuera del proyecto
sudo mkdir -p /var/lib/neurodesk
sudo chown $USER:$USER /var/lib/neurodesk

# 2. Si ya existe data/neurodesk.json con datos, moverlo
cp data/neurodesk.json /var/lib/neurodesk/data.json 2>/dev/null || echo "no habia datos previos"

# 3. Iniciar/reiniciar con PM2 usando el ecosystem
pm2 start ecosystem.config.js
# o si ya corre:
pm2 restart neurodesk --update-env

# 4. Verificar que arrancó con la ruta correcta (debe decir /var/lib/neurodesk/data.json)
pm2 logs neurodesk --lines 10
```

### Flujo de deploy después de la migración

```bash
git pull origin main        # solo actualiza código
npm install --omit=dev      # solo si package.json cambió
pm2 restart neurodesk       # reinicia — datos en /var/lib/neurodesk/data.json intactos
# NUNCA: rm -rf data/ | git clean -fd | npm run reset
```

---

## Antes de cada entrega, verificar

- [ ] ¿El cambio modifica o reinicializa `data/neurodesk.json`?
- [ ] ¿Se sobrescribe alguna clave de config con valores de ejemplo?
- [ ] ¿Se requiere reconfigurar Gmail o App Password para que funcione?
- [ ] ¿El `.gitignore` sigue ignorando `data/` completo?
- [ ] ¿Los nuevos defaults usan merge (no replace) sobre la config existente?

Si alguna respuesta es **sí**, replantear el enfoque antes de entregar.
