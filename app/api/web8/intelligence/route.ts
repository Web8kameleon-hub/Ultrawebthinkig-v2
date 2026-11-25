import { proxyRealService } from '@/lib/server/real-service-proxy'
const config = { service: 'web8-intelligence', urlEnv: 'WEB8_INTELLIGENCE_URL', apiKeyEnv: 'WEB8_INTELLIGENCE_API_KEY' }
export const GET = (request: Request) => proxyRealService(request, config)
