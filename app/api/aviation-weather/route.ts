import { proxyRealService } from '@/lib/server/real-service-proxy'
const config = { service: 'aviation-weather', urlEnv: 'AVIATION_WEATHER_URL', apiKeyEnv: 'AVIATION_WEATHER_API_KEY' }
export const GET = (request: Request) => proxyRealService(request, config)
export const POST = (request: Request) => proxyRealService(request, config)
