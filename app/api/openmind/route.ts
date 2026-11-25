import { proxyRealService } from '@/lib/server/real-service-proxy'
const config = { service: 'openmind', urlEnv: 'OPENMIND_SERVICE_URL', apiKeyEnv: 'OPENMIND_SERVICE_API_KEY' }
export const GET = (request: Request) => proxyRealService(request, config)
export const POST = (request: Request) => proxyRealService(request, config)
