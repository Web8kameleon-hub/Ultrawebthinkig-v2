import { proxyRealService } from '@/lib/server/real-service-proxy'
const config = { service: 'advanced-chat', urlEnv: 'ADVANCED_CHAT_URL', apiKeyEnv: 'ADVANCED_CHAT_API_KEY' }
export const GET = (request: Request) => proxyRealService(request, config)
export const POST = (request: Request) => proxyRealService(request, config)
