import { proxyRealService } from '@/lib/server/real-service-proxy'
const config = { service: 'payments', urlEnv: 'PAYMENT_SERVICE_URL', apiKeyEnv: 'PAYMENT_SERVICE_API_KEY' }
export const GET = (request: Request) => proxyRealService(request, config)
export const POST = (request: Request) => proxyRealService(request, config)
