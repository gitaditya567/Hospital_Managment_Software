module.exports = {
  apps: [
    {
      name: 'hospital-backend',
      script: 'supervisor.js',
      cwd: '/www/wwwroot/dpssitapur.in/server',
      interpreter: 'node',
      // Auto-restart on crash
      watch: false,
      max_restarts: 10,
      restart_delay: 1000,
      // Logs
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      out_file: '/www/wwwroot/dpssitapur.in/logs/backend-out.log',
      error_file: '/www/wwwroot/dpssitapur.in/logs/backend-error.log',
      merge_logs: true,
      // Environment
      env: {
        NODE_ENV: 'production',
        PORT: 5000
      }
    }
  ]
};
