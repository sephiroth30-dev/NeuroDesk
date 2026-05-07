// PM2 ecosystem — producción soporte.easystem.co
// Uso: pm2 start ecosystem.config.js
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
      },
    },
  ],
};
