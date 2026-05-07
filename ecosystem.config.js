// PM2 ecosystem — configuración de producción para soporte.easystem.co
// Uso: pm2 start ecosystem.config.js
//      pm2 restart neurodesk

module.exports = {
  apps: [
    {
      name: "neurodesk",
      script: "server.js",
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "300M",
      env: {
        NODE_ENV: "production",
        PORT: 3000,
        // CRÍTICO: datos fuera del directorio del proyecto.
        // Nunca se borra con git pull, git clean ni re-clones.
        ND_STORE_PATH: "/var/lib/neurodesk/data.json",
      },
    },
  ],
};
