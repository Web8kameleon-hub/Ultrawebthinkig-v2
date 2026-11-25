import { proxyRealService } from '@/lib/server/real-service-proxy'
const config = { service: 'web-services', urlEnv: 'WEB_SERVICES_URL', apiKeyEnv: 'WEB_SERVICES_API_KEY' }
export const GET = (request: Request) => proxyRealService(request, config)
export const POST = (request: Request) => proxyRealService(request, config)
