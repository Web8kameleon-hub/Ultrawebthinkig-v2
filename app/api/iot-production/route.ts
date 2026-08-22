import { proxyRealService } from '@/lib/server/real-service-proxy'

const config = { service: 'iot-production', urlEnv: 'IOT_PRODUCTION_URL', apiKeyEnv: 'IOT_PRODUCTION_API_KEY' }
export const GET = (request: Request) => proxyRealService(request, config)
export const POST = (request: Request) => proxyRealService(request, config)
