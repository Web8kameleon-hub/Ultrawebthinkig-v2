import { proxyRealService } from '@/lib/server/real-service-proxy'

const config = { service: 'iot', urlEnv: 'IOT_SERVICE_URL', apiKeyEnv: 'IOT_SERVICE_API_KEY' }
export const GET = (request: Request) => proxyRealService(request, config)
export const POST = (request: Request) => proxyRealService(request, config)
