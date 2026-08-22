import { proxyRealService } from '@/lib/server/real-service-proxy'
const config = { service: 'global-news', urlEnv: 'GLOBAL_NEWS_URL', apiKeyEnv: 'GLOBAL_NEWS_API_KEY' }
export const GET = (request: Request) => proxyRealService(request, config)
