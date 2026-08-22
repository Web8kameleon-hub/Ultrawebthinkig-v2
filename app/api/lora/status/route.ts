import { proxyRealService } from '@/lib/server/real-service-proxy'
const config = { service: 'lora-status', urlEnv: 'LORA_STATUS_URL', apiKeyEnv: 'LORA_STATUS_API_KEY' }
export const GET = (request: Request) => proxyRealService(request, config)
export const POST = (request: Request) => proxyRealService(request, config)
