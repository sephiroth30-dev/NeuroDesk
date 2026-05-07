# NeuroDesk — Reglas de Producción

## ⚠️ ESTE PROYECTO ESTÁ EN PRODUCCIÓN

Está corriendo con datos reales y configuración activa. Cualquier cambio debe ser **no destructivo**.

---

## Base de Datos — NUNCA tocar `data/neurodesk.sqlite`

- **NO** borrar, recrear ni reemplazar `data/neurodesk.sqlite`
- **NO** hacer `DROP TABLE`, `DROP COLUMN` ni sentencias que eliminen datos
- **NO** vaciar tablas (`DELETE FROM ... WHERE 1=1`, `TRUNCATE`, etc.)
- **NO** correr migraciones que destruyan o recreen tablas existentes

Si el esquema necesita evolucionar, **solo agregar**:
```sql
-- ✅ Siempre aditivo
ALTER TABLE tickets ADD COLUMN nueva_columna TEXT DEFAULT '';
```

El servidor ya tiene lógica de migración aditiva en el arranque (`-- Run column migrations`). Úsala, no la reemplaces.

---

## Configuración guardada en BD — NO sobrescribir

Las siguientes claves en la tabla `config` contienen configuración ingresada manualmente por el usuario (incluye credenciales de Gmail / App Password):

- `email_config` — SMTP, cuenta Gmail, App Password
- `notifications_config` — reglas de notificaciones
- `app_config` — SLA, campos habilitados, nombre de la empresa

**Regla:** nunca ejecutar `upsertConfigStmt` con valores hardcodeados o de ejemplo que pisen la configuración existente. Los defaults solo se aplican si no existe el registro.

---

## Archivos protegidos — no modificar sin pedido explícito

| Archivo/Carpeta | Razón |
|---|---|
| `data/neurodesk.sqlite` | BD de producción con tickets y configuración |
| `.env` (si existe) | Variables de entorno con credenciales |

---

## Estrategia de cambios seguros

1. **Cambios en `server.js`**: modificar lógica, rutas y endpoints sin alterar esquema de BD
2. **Cambios de UI**: modificar `public/app.js`, `public/styles.css`, `public/index.html` libremente
3. **Nuevas columnas**: solo `ALTER TABLE ... ADD COLUMN` con `DEFAULT` para no romper registros existentes
4. **Nuevas tablas**: `CREATE TABLE IF NOT EXISTS` — nunca sin `IF NOT EXISTS`
5. **Seeds / datos de prueba**: nunca en producción; si se necesitan, ponerlos detrás de una flag `NODE_ENV=development`

---

## Antes de cada entrega, verificar

- [ ] ¿El cambio modifica el esquema de BD de forma destructiva?
- [ ] ¿Se sobrescribe alguna clave de `config` con valores de ejemplo?
- [ ] ¿Se toca `data/neurodesk.sqlite` directamente?
- [ ] ¿Se requiere reconfigurar Gmail o App Password para que funcione?

Si alguna respuesta es **sí**, replantear el enfoque antes de entregar.
