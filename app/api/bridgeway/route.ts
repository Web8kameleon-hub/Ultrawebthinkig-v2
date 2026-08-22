import { proxyRealService } from '@/lib/server/real-service-proxy'
const config = { service: 'bridgeway', urlEnv: 'BRIDGEWAY_URL', apiKeyEnv: 'BRIDGEWAY_API_KEY' }
export const GET = (request: Request) => proxyRealService(request, config)
export const POST = (request: Request) => proxyRealService(request, config)
