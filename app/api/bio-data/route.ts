import { proxyRealService } from '@/lib/server/real-service-proxy'
const config = { service: 'bio-data', urlEnv: 'BIO_DATA_URL', apiKeyEnv: 'BIO_DATA_API_KEY' }
export const GET = (request: Request) => proxyRealService(request, config)
export const POST = (request: Request) => proxyRealService(request, config)
