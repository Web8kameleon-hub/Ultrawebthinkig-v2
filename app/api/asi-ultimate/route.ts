import { proxyRealService } from '@/lib/server/real-service-proxy'

const config = { service: 'asi-ultimate', urlEnv: 'ASI_ULTIMATE_URL', apiKeyEnv: 'ASI_ULTIMATE_API_KEY' }
export const GET = (request: Request) => proxyRealService(request, config)
export const POST = (request: Request) => proxyRealService(request, config)
