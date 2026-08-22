import { NextResponse } from 'next/server'

type ProxyConfig = {
  service: string
  urlEnv: string
  apiKeyEnv?: string
  timeoutEnv?: string
}

function configuredTarget(request: Request, config: ProxyConfig): URL {
  const configured = process.env[config.urlEnv]?.trim()
  if (!configured) throw new Error(`${config.urlEnv} is not configured`)
  const target = new URL(configured)
  if (target.protocol !== 'https:' && target.hostname !== '127.0.0.1' && target.hostname !== 'localhost') {
    throw new Error(`${config.urlEnv} must use HTTPS except for localhost`)
  }
  target.search = new URL(request.url).search
  return target
}

export async function proxyRealService(request: Request, config: ProxyConfig) {
  try {
    const target = configuredTarget(request, config)
    const headers: Record<string, string> = {
      accept: request.headers.get('accept') || 'application/json',
      'content-type': request.headers.get('content-type') || 'application/json',
    }
    const apiKey = config.apiKeyEnv ? process.env[config.apiKeyEnv] : undefined
    if (apiKey) headers.authorization = `Bearer ${apiKey}`

    const method = request.method.toUpperCase()
    const upstream = await fetch(target, {
      method,
      headers,
      body: method === 'GET' || method === 'HEAD' ? undefined : await request.arrayBuffer(),
      cache: 'no-store',
      signal: AbortSignal.timeout(Number(process.env[config.timeoutEnv || 'REAL_SERVICE_TIMEOUT_MS'] || '15000')),
    })
    const body = await upstream.arrayBuffer()
    return new NextResponse(body, {
      status: upstream.status,
      headers: {
        'content-type': upstream.headers.get('content-type') || 'application/octet-stream',
        'x-real-service': config.service,
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : `${config.service} is unavailable`
    return NextResponse.json(
      { success: false, service: config.service, error: message },
      { status: message.includes('not configured') ? 503 : 502 }
    )
  }
}
