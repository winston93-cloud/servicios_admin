import { proxyDesayunosDatabaseRequest } from '@/lib/insforgeDbProxyShared'

export const runtime = 'nodejs'

type RouteContext = { params: Promise<{ path: string[] }> }

async function handle(request: Request, context: RouteContext) {
  const { path } = await context.params
  const segment = path.map(encodeURIComponent).join('/')
  return proxyDesayunosDatabaseRequest(request, `/api/database/rpc/${segment}`)
}

export async function GET(request: Request, context: RouteContext) {
  return handle(request, context)
}

export async function POST(request: Request, context: RouteContext) {
  return handle(request, context)
}
