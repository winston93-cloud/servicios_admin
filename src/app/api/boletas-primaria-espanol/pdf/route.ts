import { rutasDireccionPrimaria } from '@/lib/boletasPrimariaRutas'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const rutas = rutasDireccionPrimaria('es').pdf
export const GET = rutas.GET
