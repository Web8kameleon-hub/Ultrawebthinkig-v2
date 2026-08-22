import { proxyRealService } from '@/lib/server/real-service-proxy'

const config = { service: 'system-real', urlEnv: 'REAL_SYSTEM_STATUS_URL', apiKeyEnv: 'REAL_SYSTEM_STATUS_API_KEY' }
export const GET = (request: Request) => proxyRealService(request, config)
export const POST = (request: Request) => proxyRealService(request, config)
