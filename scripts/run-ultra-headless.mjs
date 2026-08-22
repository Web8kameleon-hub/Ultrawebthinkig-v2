import { spawn } from 'node:child_process';
import { resolve } from 'node:path';

const root = resolve(process.cwd());
function startProcess(name, command, args, cwd, env = {}) {
  const child = spawn(command, args, {
    cwd,
    env: { ...process.env, ...env },
    stdio: 'pipe',
    shell: true,
  });

  child.stdout.on('data', (chunk) => {
    process.stdout.write(`[${name}] ${chunk}`);
  });

  child.stderr.on('data', (chunk) => {
    process.stderr.write(`[${name}] ${chunk}`);
  });

  return child;
}

const backendPort = process.env.BACKEND_PORT || '3001';
const frontendPort = process.env.FRONTEND_PORT || process.env.NEXT_PUBLIC_PORT || '3000';
const frontendOrigin = `http://127.0.0.1:${frontendPort}`;
const backendOrigin = `http://127.0.0.1:${backendPort}`;

const backend = startProcess(
  'backend',
  'npm',
  ['run', 'dev:backend'],
  root,
  {
    BACKEND_HOST: '127.0.0.1',
    BACKEND_PORT: backendPort,
    FRONTEND_ORIGIN: frontendOrigin,
  },
);

const frontend = startProcess(
  'frontend',
  'npm',
  ['run', 'dev'],
  root,
  {
    PORT: frontendPort,
    FRONTEND_PORT: frontendPort,
    NEXT_PUBLIC_PORT: frontendPort,
    NEXT_PUBLIC_BASE_URL: frontendOrigin,
    NEXT_PUBLIC_API_URL: `${frontendOrigin}/api`,
    BACKEND_INTERNAL_URL: backendOrigin,
    NEXT_PUBLIC_BACKEND_BRIDGE_URL: `${frontendOrigin}/api/bridge`,
  },
);

let shuttingDown = false;

function shutdown(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  backend.kill();
  frontend.kill();
  process.exit(code);
}

backend.on('exit', (code) => {
  if (shuttingDown) return;
  console.error(`[backend] exited with code ${code}`);
  shutdown(code ?? 1);
});

frontend.on('exit', (code) => {
  if (shuttingDown) return;
  console.error(`[frontend] exited with code ${code}`);
  shutdown(code ?? 1);
});

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));
