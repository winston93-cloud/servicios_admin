import { rutasPortalSecundaria } from '@/lib/boletasSecundariaRutas'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const rutas = rutasPortalSecundaria()
export const GET = rutas.GET
export const PUT = rutas.PUT
export const POST = rutas.POST
