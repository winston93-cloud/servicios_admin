import { rutasDireccionSecundaria } from '@/lib/boletasSecundariaRutas'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const rutas = rutasDireccionSecundaria().catalogo
export const GET = rutas.GET
export const POST = rutas.POST
export const DELETE = rutas.DELETE
