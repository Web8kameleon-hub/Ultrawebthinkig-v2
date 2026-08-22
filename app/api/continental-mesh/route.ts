import { proxyRealService } from '@/lib/server/real-service-proxy'
const config = { service: 'continental-mesh', urlEnv: 'CONTINENTAL_MESH_URL', apiKeyEnv: 'CONTINENTAL_MESH_API_KEY' }
export const GET = (request: Request) => proxyRealService(request, config)
export const POST = (request: Request) => proxyRealService(request, config)
