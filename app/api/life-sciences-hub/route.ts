import { proxyRealService } from '@/lib/server/real-service-proxy'
const config = { service: 'life-sciences', urlEnv: 'LIFE_SCIENCES_URL', apiKeyEnv: 'LIFE_SCIENCES_API_KEY' }
export const GET = (request: Request) => proxyRealService(request, config)
