import cors from 'cors';
import express from 'express';
import os from 'node:os';

const app = express();
const port = Number.parseInt(process.env.BACKEND_PORT || '3001', 10);
const host = process.env.BACKEND_HOST || '127.0.0.1';
const startedAt = new Date().toISOString();

app.disable('x-powered-by');
app.use(cors({ origin: process.env.FRONTEND_ORIGIN || 'http://localhost:3000' }));
app.use(express.json({ limit: '1mb' }));

function systemSnapshot() {
  const totalMemory = os.totalmem();
  const freeMemory = os.freemem();
  const usedMemory = totalMemory - freeMemory;
  const cpuCount = Math.max(os.cpus().length, 1);
  const oneMinuteLoad = os.loadavg()[0];

  return {
    hostname: os.hostname(),
    platform: os.platform(),
    architecture: os.arch(),
    uptimeSeconds: os.uptime(),
    memory: {
      totalBytes: totalMemory,
      freeBytes: freeMemory,
      usedBytes: usedMemory,
      usedPercent: totalMemory > 0 ? Number(((usedMemory / totalMemory) * 100).toFixed(2)) : null,
    },
    cpu: {
      logicalProcessors: cpuCount,
      oneMinuteLoad: os.platform() === 'win32' ? null : oneMinuteLoad,
      loadPercent: os.platform() === 'win32'
        ? null
        : Number(Math.min(100, (oneMinuteLoad / cpuCount) * 100).toFixed(2)),
    },
  };
}

app.get(['/health', '/api/health'], (_request, response) => {
  response.json({
    ok: true,
    service: 'ultrawebthinking-backend',
    startedAt,
    checkedAt: new Date().toISOString(),
    uptimeSeconds: process.uptime(),
  });
});

app.get('/api/system', (_request, response) => {
  response.json({ ok: true, data: systemSnapshot(), measuredAt: new Date().toISOString() });
});

app.get('/', (_request, response) => {
  response.json({
    ok: true,
    service: 'ultrawebthinking-backend',
    message: 'Backend is running',
    endpoints: {
      health: '/health',
      apiHealth: '/api/health',
      system: '/api/system',
    },
  });
});

app.use((_request, response) => {
  response.status(404).json({ ok: false, error: 'Backend route not found' });
});

const server = app.listen(port, host, () => {
  console.log(`UltraWebThinking backend listening on http://${host}:${port}`);
});

function shutdown(signal: string) {
  console.log(`${signal} received; closing UltraWebThinking backend`);
  server.close(() => process.exit(0));
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
