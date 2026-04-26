import { promises as fs } from 'node:fs'
import path from 'node:path'
import { NextResponse } from 'next/server'

const DEFAULT_EXTERNAL_OPENAPI_URL = 'https://ultra.clisonix.com/openapi.json'

async function loadLocalSpec() {
  const specPath = path.join(process.cwd(), 'openapi', 'internal-openapi.json')
  const raw = await fs.readFile(specPath, 'utf8')
  return JSON.parse(raw)
}

async function loadExternalSpec(url: string) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 10000)

  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'User-Agent': 'Ultrawebthinking-OpenAPI-Link/2026'
      },
      cache: 'no-store',
      signal: controller.signal
    })

    if (!res.ok) {
      throw new Error(`External OpenAPI returned HTTP ${res.status}`)
    }

    return await res.json()
  } finally {
    clearTimeout(timeout)
  }
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const source = (url.searchParams.get('source') || 'local').toLowerCase()
    const externalUrl = process.env.OPENAPI_EXTERNAL_URL || DEFAULT_EXTERNAL_OPENAPI_URL

    if (source === 'external' || source === 'clisonix') {
      const spec = await loadExternalSpec(externalUrl)
      return NextResponse.json(spec, {
        headers: {
          'Cache-Control': 'no-store',
          'X-OpenAPI-Source': 'external',
          'X-OpenAPI-External-URL': externalUrl,
        },
      })
    }

    if (source === 'auto') {
      try {
        const spec = await loadExternalSpec(externalUrl)
        return NextResponse.json(spec, {
          headers: {
            'Cache-Control': 'no-store',
            'X-OpenAPI-Source': 'external',
            'X-OpenAPI-External-URL': externalUrl,
          },
        })
      } catch {
        const spec = await loadLocalSpec()
        return NextResponse.json(spec, {
          headers: {
            'Cache-Control': 'no-store',
            'X-OpenAPI-Source': 'local-fallback',
            'X-OpenAPI-External-URL': externalUrl,
          },
        })
      }
    }

    const spec = await loadLocalSpec()

    return NextResponse.json(spec, {
      headers: {
        'Cache-Control': 'no-store',
        'X-OpenAPI-Source': 'local',
        'X-OpenAPI-External-URL': externalUrl,
      },
    })
  } catch (error: any) {
    return NextResponse.json(
      {
        error: 'OpenAPI spec unavailable',
        message: error?.message || 'Unknown error',
      },
      { status: 500 }
    )
  }
}
