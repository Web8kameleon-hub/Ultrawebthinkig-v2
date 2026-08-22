import { proxyRealService } from '@/lib/server/real-service-proxy'

const config = { service: 'neural-acceleration', urlEnv: 'NEURAL_ACCELERATION_URL', apiKeyEnv: 'NEURAL_ACCELERATION_API_KEY' }
export const GET = (request: Request) => proxyRealService(request, config)
export const POST = (request: Request) => proxyRealService(request, config)
