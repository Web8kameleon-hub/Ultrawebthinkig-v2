import { NextResponse } from 'next/server'

const DEFAULT_EXTERNAL_OPENAPI_URL = 'https://ultra.clisonix.com/openapi.json'

export async function GET(request: Request) {
  const url = new URL(request.url)
  const source = (url.searchParams.get('source') || 'auto').toLowerCase()

  // Keep compatibility with existing API route behavior
  if (source === 'external' || source === 'clisonix') {
    return NextResponse.redirect(new URL('/api/openapi?source=external', url.origin), 307)
  }

  if (source === 'local') {
    return NextResponse.redirect(new URL('/api/openapi?source=local', url.origin), 307)
  }

  // auto default
  return NextResponse.redirect(new URL('/api/openapi?source=auto', url.origin), 307)
}

// Expose target in OPTIONS for diagnostics
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'X-OpenAPI-Endpoint': '/openapi.json',
      'X-OpenAPI-External-URL': process.env.OPENAPI_EXTERNAL_URL || DEFAULT_EXTERNAL_OPENAPI_URL,
      'Cache-Control': 'no-store'
    }
  })
}
