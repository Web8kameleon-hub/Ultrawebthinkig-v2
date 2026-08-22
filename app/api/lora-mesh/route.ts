import { proxyRealService } from '@/lib/server/real-service-proxy'
const config = { service: 'lora-mesh', urlEnv: 'LORA_MESH_URL', apiKeyEnv: 'LORA_MESH_API_KEY' }
export const GET = (request: Request) => proxyRealService(request, config)
export const POST = (request: Request) => proxyRealService(request, config)
