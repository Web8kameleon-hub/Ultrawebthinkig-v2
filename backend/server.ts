import cors from 'cors';
import express from 'express';
import os from 'node:os';

const app = express();
const port = Number.parseInt(process.env.BACKEND_PORT || '23001', 10);
const host = process.env.BACKEND_HOST || '127.0.0.1';
const startedAt = new Date().toISOString();

type GatewayPayload = {
  channel: 'http' | 'lorawan';
  envelope: {
    id: string;
    to: string;
    from: string;
    message: string;
    priority: 'low' | 'normal' | 'high' | 'critical';
    ttlSeconds: number;
    createdAt: string;
    [key: string]: unknown;
  };
  payloadBase64: string;
};

const nodeSmsGatewayLog: Array<{ id: string; to: string; receivedAt: string; channel: 'http' }> = [];
const loRaGatewayLog: Array<{ id: string; to: string; receivedAt: string; channel: 'lorawan' }> = [];

app.disable('x-powered-by');
app.use(cors({ origin: process.env.FRONTEND_ORIGIN || 'http://127.0.0.1:2300' }));
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

function isGatewayPayload(value: unknown): value is GatewayPayload {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  if (candidate.channel !== 'http' && candidate.channel !== 'lorawan') {
    return false;
  }

  if (typeof candidate.payloadBase64 !== 'string' || candidate.payloadBase64.length === 0) {
    return false;
  }

  if (!candidate.envelope || typeof candidate.envelope !== 'object') {
    return false;
  }

  const envelope = candidate.envelope as Record<string, unknown>;
  return typeof envelope.id === 'string'
    && typeof envelope.to === 'string'
    && typeof envelope.from === 'string'
    && typeof envelope.message === 'string'
    && typeof envelope.createdAt === 'string'
    && typeof envelope.ttlSeconds === 'number';
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

app.post('/api/nodesms/gateway', (request, response) => {
  if (!isGatewayPayload(request.body) || request.body.channel !== 'http') {
    response.status(400).json({ ok: false, error: 'Invalid NodeSMS gateway payload' });
    return;
  }

  const receivedAt = new Date().toISOString();
  nodeSmsGatewayLog.unshift({
    id: request.body.envelope.id,
    to: request.body.envelope.to,
    receivedAt,
    channel: 'http',
  });

  if (nodeSmsGatewayLog.length > 500) {
    nodeSmsGatewayLog.length = 500;
  }

  response.status(200).json({
    ok: true,
    service: 'nodesms-gateway-local',
    accepted: true,
    id: request.body.envelope.id,
    receivedAt,
    queueDepth: nodeSmsGatewayLog.length,
  });
});

app.post('/api/lora-mesh/gateway', (request, response) => {
  if (!isGatewayPayload(request.body) || request.body.channel !== 'lorawan') {
    response.status(400).json({ ok: false, error: 'Invalid LoRa gateway payload' });
    return;
  }

  const receivedAt = new Date().toISOString();
  loRaGatewayLog.unshift({
    id: request.body.envelope.id,
    to: request.body.envelope.to,
    receivedAt,
    channel: 'lorawan',
  });

  if (loRaGatewayLog.length > 500) {
    loRaGatewayLog.length = 500;
  }

  response.status(200).json({
    ok: true,
    service: 'lora-mesh-gateway-local',
    accepted: true,
    id: request.body.envelope.id,
    receivedAt,
    queueDepth: loRaGatewayLog.length,
  });
});

app.get('/api/nodesms/gateway', (_request, response) => {
  response.json({
    ok: true,
    service: 'nodesms-gateway-local',
    total: nodeSmsGatewayLog.length,
    latest: nodeSmsGatewayLog.slice(0, 20),
  });
});

app.get('/api/lora-mesh/gateway', (_request, response) => {
  response.json({
    ok: true,
    service: 'lora-mesh-gateway-local',
    total: loRaGatewayLog.length,
    latest: loRaGatewayLog.slice(0, 20),
  });
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
      nodeSmsGatewayPost: '/api/nodesms/gateway',
      nodeSmsGatewayGet: '/api/nodesms/gateway',
      loRaGatewayPost: '/api/lora-mesh/gateway',
      loRaGatewayGet: '/api/lora-mesh/gateway',
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
