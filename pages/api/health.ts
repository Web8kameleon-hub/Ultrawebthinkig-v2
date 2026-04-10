/**
 * Health Check API - Quick status check
 */

import type { NextApiRequest, NextApiResponse } from 'next';

const CLISONIX_URL = process.env.NEXT_PUBLIC_CLISONIX_URL || 'https://clisonix.com';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const startTime = Date.now();

  // Check local services
  const localServices = {
    nextjs: true,
    api: true
  };

  // Check Clisonix internal network
  let clisonixStatus = 'unknown';
  try {
    const response = await fetch(`${CLISONIX_URL}/api/ping`, {
      signal: AbortSignal.timeout(5000)
    });
    if (response.ok) {
      clisonixStatus = 'operational';
    } else {
      clisonixStatus = 'degraded';
    }
  } catch {
    clisonixStatus = 'unreachable';
  }

  // Check Ollama
  let ollamaStatus = 'unknown';
  try {
    const response = await fetch('http://localhost:11434/api/tags', {
      signal: AbortSignal.timeout(3000)
    });
    if (response.ok) {
      ollamaStatus = 'operational';
    } else {
      ollamaStatus = 'not_running';
    }
  } catch {
    ollamaStatus = 'not_installed';
  }

  return res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    response_time_ms: Date.now() - startTime,
    services: {
      local: localServices,
      clisonix_internal: clisonixStatus,
      ollama: ollamaStatus
    },
    version: '8.0.0-industrial',
    environment: process.env.NODE_ENV || 'development'
  });
}
