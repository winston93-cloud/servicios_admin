import { rutasDireccionPrimaria } from '@/lib/boletasPrimariaRutas'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const rutas = rutasDireccionPrimaria('en').entregas
export const GET = rutas.GET
export const POST = rutas.POST
