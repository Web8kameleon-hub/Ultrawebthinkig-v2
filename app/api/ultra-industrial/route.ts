import { proxyRealService } from '@/lib/server/real-service-proxy'
const config = { service: 'ultra-industrial', urlEnv: 'ULTRA_INDUSTRIAL_URL', apiKeyEnv: 'ULTRA_INDUSTRIAL_API_KEY' }
export const GET = (request: Request) => proxyRealService(request, config)
export const POST = (request: Request) => proxyRealService(request, config)
