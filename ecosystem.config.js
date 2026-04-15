// Strato.de Deployment Configuration
// PM2 Ecosystem for Clisonix production domains

const PRIMARY_DOMAIN = 'clisonix.com';
const APP_DOMAIN = `app.${PRIMARY_DOMAIN}`;
const API_DOMAIN = `api.${PRIMARY_DOMAIN}`;
const NEURO_DOMAIN = `neuro.${PRIMARY_DOMAIN}`;

module.exports = {
  apps: [
    {
      name: 'clisonix-app',
      script: 'node_modules/.bin/next',
      args: 'start -p 80',
      cwd: `/var/www/${PRIMARY_DOMAIN}`,
      instances: 1,
      exec_mode: 'cluster',
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: 80,
        NEXT_PUBLIC_APP_URL: `https://${APP_DOMAIN}`,
        NEXT_PUBLIC_CLISONIX_URL: `https://${API_DOMAIN}`,
        CLISONIX_URL: `https://${API_DOMAIN}`,
        LEGACY_REDIRECT_DOMAIN: 'https://kameleon.life'
      },
      error_file: '/var/log/pm2/clisonix-app.error.log',
      out_file: '/var/log/pm2/clisonix-app.out.log',
      log_file: '/var/log/pm2/clisonix-app.log'
    },
    {
      name: 'clisonix-api',
      script: 'python',
      args: '-m uvicorn app.main:app --host 0.0.0.0 --port 8080',
      cwd: `/var/www/${PRIMARY_DOMAIN}/ultracom`,
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      max_memory_restart: '512M',
      env: {
        PYTHONPATH: `/var/www/${PRIMARY_DOMAIN}/ultracom`,
        ENVIRONMENT: 'production',
        CLISONIX_URL: `https://${API_DOMAIN}`
      },
      error_file: '/var/log/pm2/clisonix-api.error.log',
      out_file: '/var/log/pm2/clisonix-api.out.log',
      log_file: '/var/log/pm2/clisonix-api.log'
    },
    {
      name: 'clisonix-neuro',
      script: 'python',
      args: '-m uvicorn neurosonix_server:app --host 0.0.0.0 --port 8081',
      cwd: `/var/www/${PRIMARY_DOMAIN}/ultracom`,
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      max_memory_restart: '512M',
      env: {
        PYTHONPATH: `/var/www/${PRIMARY_DOMAIN}/ultracom`,
        ENVIRONMENT: 'production',
        NEUROSONIX_PUBLIC_URL: `https://${NEURO_DOMAIN}`
      },
      error_file: '/var/log/pm2/clisonix-neuro.error.log',
      out_file: '/var/log/pm2/clisonix-neuro.out.log',
      log_file: '/var/log/pm2/clisonix-neuro.log'
    }
  ]
};
