import { rutasPortalPrimaria } from '@/lib/boletasPrimariaRutas'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const rutas = rutasPortalPrimaria('en')
export const GET = rutas.GET
export const PUT = rutas.PUT
export const POST = rutas.POST
