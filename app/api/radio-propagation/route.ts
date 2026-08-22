import { proxyRealService } from '@/lib/server/real-service-proxy'
const config = { service: 'radio-propagation', urlEnv: 'RADIO_PROPAGATION_URL', apiKeyEnv: 'RADIO_PROPAGATION_API_KEY' }
export const GET = (request: Request) => proxyRealService(request, config)
export const POST = (request: Request) => proxyRealService(request, config)
