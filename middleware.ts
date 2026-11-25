/**
 * EuroWeb - Next.js Middleware
 * Security & Route Protection with Guardian AI Security
 * 
 * @author Ledjan Ahmati (100% Owner)
 * @version 8.0.0 Ultra + Guardian Security Integration
 */

import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { SecurityGuard } from '@/core/security/guardian'

// Initialize Guardian Security System
const guardian = new SecurityGuard();

export async function middleware(request: NextRequest) {
  const startTime = Date.now();

  try {
    // Guardian Security Scan for API routes
    if (request.nextUrl.pathname.startsWith('/api/')) {
      // Extract content for scanning
      let content = '';
      const url = request.nextUrl.toString();

      // Scan URL and parameters for threats
      const scanResult = await guardian.scanContent(url);

      if (!scanResult.isSafe && scanResult.riskScore > 70) {
        console.warn('🛡️ Guardian blocked high-risk request:', {
          path: request.nextUrl.pathname,
          ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
          violations: scanResult.violations,
          riskScore: scanResult.riskScore,
          userAgent: request.headers.get('user-agent')
        });

        return NextResponse.json(
          {
            error: 'Request blocked by Guardian Security',
            reason: 'High-risk threat detected',
            guardianActive: true
          },
          { status: 403 }
        );
      }
    }
  } catch (guardianError) {
    // Guardian fails gracefully - log error but continue
    console.error('🛡️ Guardian middleware error:', guardianError);
  }

  // Enhanced security headers
  const response = NextResponse.next()
  
  // Core security headers
  response.headers.set('X-Frame-Options', 'DENY')
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  response.headers.set('X-XSS-Protection', '1; mode=block')
  
  // Guardian headers
  response.headers.set('X-Guardian-Active', 'true')
  response.headers.set('X-Guardian-Version', '8.0.0')
  response.headers.set('X-Processing-Time', `${Date.now() - startTime}ms`)

  // Enhanced CSP for AI applications
  response.headers.set(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' http://localhost:11434 https://clisonix.com https://*.clisonix.com;"
  )
  
  return response
}

export const config = {
  matcher: [
    /*
     * Web8 Matcher: Only API routes and static assets
     * Skip homepage to avoid React Component conflicts
     */
    '/api/:path*',
    '/_next/:path*',
    '/favicon.ico'
  ],
}
